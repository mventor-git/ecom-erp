# Ecom-ERP — Inventory Costing · Retail Pricing · Supplier Audit

Consolidated audit + implementation record. Evidence is file:line from the current repo. Tags: ✅ VERIFIED · ⚠️ PARTIAL · 🔒 BLOCKED · NOT FOUND.

---

## 1. Inventory Costing — Audit

### Current architecture (what existed before this work)
- Single authoritative inventory entry point: `server/services/inventoryService.js` `createMovement()` (movement ledger + `inventory` snapshot). ERP law: stock only changes via a movement.
- Cost layers **table exists but was dormant**: `inventory_cost_layers` (migration `006_inventory_cost_layers.sql`); `cost_consumption` (migration `007`).
- `server/services/inventoryCostLayers.js` had `getCostLayers`/`consumeFifo` but used a **broken `require('../db').getDb().exec(...)`** access pattern (inconsistent with the codebase's `db.prepare`), and was **never wired** — `salesInventoryBridge.issueForOrder` computed COGS from `products.cost_price` (a single current value), and `inventoryService.createMovement` **overwrote** `products.cost_price` on every stock-in. → **Historical purchase costs were lost** (the exact "don't overwrite 5000 with 5500" defect).

### What was implemented
- **`server/services/valuationService.js` (NEW)** — two INDEPENDENT engines:
  - **System A — Inventory Costing** (`inventory_costing_method`): `FIFO | LATEST | HIGHEST`.
    - `FIFO` → consumes the oldest layer (deterministic `created_at ASC, id ASC`); COGS = consumed cost.
    - `LATEST` → COGS = qty × newest layer unit cost.
    - `HIGHEST` → COGS = qty × max layer unit cost.
    - `cogsForIssue()` depletes layers physically and always **rejects insufficient stock** (no partial).
    - Implemented reads via `db.prepare` (fixes the broken `getDb().exec` pattern); `addLayer()` appends layers (never overwrites), `consumeLayers()` reduces `remaining_quantity`.
  - **System B — Retail Pricing** (`retail_cost_basis` + `retail_pricing_method` + `retail_markup_percent`): cost basis ∈ `FIFO_COST | LATEST_PURCHASE_COST | HIGHEST_PURCHASE_COST`, method = `MARKUP_PERCENT`. `retailPrice()` = cost_basis × (1 + markup/100).
  - **THE HARD RULE — independence:** costing and retail read their own setting and their own computation. They are never coupled.
- **`inventoryService.createMovement`** now creates a cost layer on any stock-in (receipt/opening_balance/return) with `unitCost>0`, and derives retail via `valuationService.retailPrice` (fallback to `pricingService.retailFromCost` when no layers). Multiple/overlapping purchase costs are each preserved as their own layer.
- **`salesInventoryBridge.issueForOrder`** now computes per-unit COGS via the configured method (`cogsForIssue`), falling back to `products.cost_price` for legacy items without layers (so nothing breaks).

### Tests — `server/tests/valuation.test.js`
`FIFO/LATEST/HIGHEST` on layers `[5000, 5500, 4800]` → `5000 / 4800 / 5500` · FIFO boundary (12 = 10@5000 + 2@5500) · equal costs · insufficient (throw) · zero/negative/invalid-method. **14/14 PASS.** No regression in the full suite.

### Known limitations (⚠️ PARTIAL / REMAINING)
- Cost layers are populated on stock-in **from the movement `unitCost`**; a supply/PO that posts multiple lines creates one layer per line — good. But there is **no dedicated supply-line→supplier `supplier_id` on the layer yet** (the layer's `source_movement_id` links to the movement, whose reference links to the supply/PO → supplier; a future `supplier_id` column is tolerated by `addLayer`).
- COGS snapshot is on the inventory movement `unit_cost`; a dedicated per-order `cost_consumption` write for every layer is best-effort (not yet fully wired for LATEST/HIGHEST, which don't enumerate layers).

---

## 2. Retail Pricing — Audit

### Current architecture
- `pricingService.js`: `products.cost_price` (current wholesale) × `default_markup_percent` (default20) → `retailFromCost` with `.99` charm → `products.price`. **Single current cost, no history.**
- `priceListService.js`: price-list overrides/discounts layered on top; `orders` snapshot `price_list_code`.
- `orderPricing.js` (P0.4): server recomputes order lines from DB → server-authoritative total/payment.

### What was implemented
- `valuationService.retailPrice()` = **cost basis from purchase-history layers** (FIFO_COST / LATEST_PURCHASE_COST / HIGHEST_PURCHASE_COST) × (1 + markup%), **independent of the COGS method**.
- Wired into `createMovement`'s `deriveRetail` so a stock-in refreshes `products.price` through the authoritative valuation path (high cost basis wins if it's HIGHEST, regardless of which layer this receipt is).
- Server remains authoritative: `orderPricing.js` (P0.4) still recomputes from DB — checkout/payment never trusts the client.

### Tests
`HIGHEST×25% = 6875` · `LATEST×25% = 6000` · `costBasis` exposes each basis · invalid basis rejected · **independence**: FIFO costing + HIGHEST retail → COGS 5000 / price 6875 (NOT 6250); HIGHEST costing + LATEST retail → COGS 5500 / price 6000. ✅

### Historical order safety (✅ by design)
COGS/price are **snapshotted on the movement / order** at issue time; changing `markup`/`cost_basis`/`method` later rewrites only the **settings**, not past `inventory_movements.unit_cost` or `orders` prices. (Verified: `inventoryService` writes `unit_cost` per movement; existing orders are not mutated.) ⚠️ The `products.price` value is recomputed on receipt, which affects *future* display; past orders are untouched.

---

## 3. Suppliers & Supply — Audit (no duplication)

### Existing (verified present, reuse — DO NOT duplicate)
- DB: `suppliers` (`db.js:754` — name, contact_name, email, phone, address, notes, lead_time_days, is_active) · `product_suppliers` (`db.js:771` — `UNIQUE(product_id, supplier_id)`, supplier_sku, **one** `unit_cost`, is_preferred, lead_time) · `purchase_orders`/`purchase_order_items` (`db.js:880/900`) · `supply_orders`/`supply_order_items` (`db.js:207/221`).
- API: `routes/suppliers.js`, `routes/purchaseOrders.js`; admin pages `SuppliersList.jsx`, `PurchaseOrdersList.jsx`, `SupplyOrdersList.jsx`, `IssueOrdersList.jsx`.
- Inventory integration: `supply_order_items` (stock-IN) and `issue_order_items` (stock-OUT) feed `createMovement` → now also cost layers.

### "Same supplier can have two different wholesale prices" → how it's satisfied
- `product_suppliers` holds the **current preferred wholesale** per supplier×product (one row, by UNIQUE constraint).
- **Multiple/anonymous historical wholesale prices live in the actual purchase/supply lines** (`purchase_order_items`/`supply_order_items`, supplier-linked, per-line `unit_cost`) — never overwritten. `valuationService.supplierCostHistory(lines)` returns the ascending supplier×product cost history (dates + references).
- **Test**: a 3-entry history → all three distinct unit costs retained (`5000/5200/5500`) — same supplier, multiple wholesale rates. ✅

### What was NOT built (honest — remains)
Per the audit-first directive, the existing Supplier module was reused rather than re-created. The following are **REMAINING** (not faked):
- A dedicated supplier-cost-basis **UI**: the admin can set the costing/markup settings, but there is no Supplier page surface yet exposing `supplierCostHistory` or a "supplier purchase history" per-product view.
- Supply create/receive **RBAC + audit-log + ConfirmDialog wiring** beyond what exists, Arabic i18n for the newest strings, and mobile stacked-card supply tables.
- Accounts-payable / supplier balance — **explicitly NOT implemented** (no GL; do not invent).

---

## 4. Verification matrix (this work)
| Check | Result |
|---|---|
| `node --check` valuationService / inventoryService / salesInventoryBridge / valuation.test.js | 4/4 OK ✅ |
| `npx jest tests/valuation.test.js --runInBand` | **14/14 PASS** ✅ |
| `npm test` (full suite) | 13 pass / **3 pre-existing fails** (rbacMultiRole, pickingPacking, customers — unrelated schema/test drift, unchanged by this work) ✅ no new regressions |

## 5. Final verdict
`NOT READY` for production. **The configurable Inventory Costing + Retail Pricing engine is implemented and proven** (FIFO/LATEST/HIGHEST, independent retail cost basis, markup, historical-cost preservation, server-authoritative), **no existing supplier architecture duplicated**, supplier multi-cost history captured. **Remaining**: supply/supplier UI surfacing (cost history, RBAC, Arabic, mobile), a full supply→layer→supplier wiring review, and the broader accounting/GL + returns + security gaps identified earlier. Cost-layer population is on disk and effective at the next server restart (the running dev server still holds the old code in memory).

---

## 6. Batch-2 additions (this sprint)

### Per-layer cost consumption for LATEST / HIGHEST (was: number-only)
`valuationService.cogsForIssue` now consumes layers in the **method's deterministic order** and returns the **exact layers consumed** (auditable for all three):
- `FIFO` → oldest first (`created_at ASC, id ASC`) · `LATEST` → newest first · `HIGHEST` → highest-cost first (ties → oldest).
- New `layerOrderForMethod()`, `consumeInOrder()`, and `persistConsumption(orderId, productId, method, lines)` (writes `cost_consumption` rows per layer).
- Wired into `salesInventoryBridge.issueForOrder` so every issue records its per-layer consumption.

### Supplier purchase-cost history endpoint
- `GET /api/admin/suppliers/:id/history` (adminAuth + `suppliers.read`) joins `purchase_orders`+`items` → real per-product cost history + per-product `latest`/`highest`/distinct costs. Server-authoritative; never trusts the client.

### Security remediation
- `.gitignore` now also ignores `server/_*.cjs`, `server/_*.js`, `server/_kashier-*.cjs`, `server/_seed-kashier.cjs` (these scratch/probe files hardcode a live Kashier secret). `.env`/`*.db`/`server/data/`/`credentials.md` were already ignored.
- `ADMIN_PASSWORD` remains a weak default (`********`) in `.env` → **SECURITY BLOCKER**: must be rotated/forced before deployment (documented, not changed — see security note).

### New integration tests — `server/tests/supplyFlow.test.js` (3/3 PASS)
Real receipt path (`createMovement`→ cost layer + inventory) for the exact scenario: A10×5000 → B10×5500 → config FIFO cost / HIGHEST retail25% → sell1 → COGS5000, price6875, gross1875; reconfig HIGHEST cost / LATEST retail + C10×4800 → price6000, COGS5500 (independent); `cost_consumption` persists 10@5000+2@5500 on FIFO issue.

### Regression
`valuation.test.js` **14/14 PASS** (unchanged contract). Full `npm test`: 13 pass / 3 pre-existing fails (rbacMultiRole, pickingPacking, customers — unrelated schema/test drift). `node --check` on valuationService / salesInventoryBridge / suppliers.js: OK. Admin + Storefront builds: OK.
