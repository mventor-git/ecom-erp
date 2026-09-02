# Comfort Sign — UI/UX Closure Report

Date: 2026-09-01 · Scope: Supplier/Supply UI + UI/UX closure phase. This phase was entered AFTER the
FK/transactional-integrity checkpoint was closed (see `COMFORT-SIGN-PRODUCTION-HARDENING-CHANGELOG.md` Batch 4).
Backend foundation was **not** redesigned; this phase built the operator-facing interface on top of it.

> **Verification boundary:** No browser automation/tooling was available in this environment. All work was
> verified by source inspection, static sweeps, and the **Admin + Client Vite builds**. Anything that is
> inherently visual is marked **REQUIRES BROWSER VERIFICATION** — it is implemented and builds, but the pixel/
> interaction result has not been confirmed in a real browser.

---

## 1. Supplier Detail UI — IMPLEMENTED (new)

New page `client-admin/src/admin/pages/SupplierDetail.jsx` at route `/erp/suppliers/:id`.

Read-only surface over the existing, server-authoritative endpoints (no server calc duplicated in React):
- `GET /api/admin/suppliers/:id` — identity, contact, lead time, address, notes, active/inactive, product count.
- `GET /api/admin/suppliers/:id/products` — the products this supplier sources + current `product_suppliers.unit_cost`.
- `GET /api/admin/suppliers/:id/history` — **REAL** purchase-order cost history (never inferred from current cost).

The page presents:
- Header: name + Active/Inactive badge + Deactivate (ConfirmDialog).
- Identity/contact grid (contact, email, phone, lead time, address, notes).
- **Products Supplied** table: Product · Preferred · Current Cost · Latest Cost · Highest Cost (merged from
  live `product_suppliers` + history summary).
- **Purchase History** table: Date · Product · Qty · Unit Cost · Reference.
- **Cost History by Product** cards: per-product distinct historical costs + Latest/Highest pills + total units,
  making LATEST / HIGHEST / FIFO explainable.
- Loading / error / empty states on every section; responsive grid (1/2/4 col) and stacked cost cards.

**Verified:** `vite build` admin includes `SupplierDetail-*.js` chunk; no physical (left/right/pl/pr/ml/mr) props;
money via shared `currency.js` `format(cents)`.

## 2. Supplier Purchase-Cost History UI — IMPLEMENTED

Driven by the existing `/api/admin/suppliers/:id/history` endpoint (server-joins `purchase_orders` + items).
Displays real historical costs as they exist in `purchase_order_items` — the operator sees Latest, Highest and the
full distinct-cost trail per product. No history is overwritten; nothing is inferred from `products.cost_price`.
New `getSupplierHistory(id)` / `getSupplierProducts(id)` API wrappers added to `client-admin/src/api/adminApi.js`.

> **Note (resolved 2026-09-02):** The supplier-history view previously reflected **purchase orders** only. In Batch 6
> the supply-order data model was made relational — `supply_orders.supplier_id` FK added (nullable, additive), wired
> through `createSupplyOrder`, and the history endpoint now merges BOTH purchase-order and supply-order receipts into a
> date-ordered `entries` array with a `source` field (`'purchase_order' | 'supply_order'`). The two document types are
> distinguishable and never silently merged. Verified e2e (supplier history surfaces supply receipts; cost layers
> preserved; `npm test` 118/118, orphans 40/24/2/4 unchanged).

## 3. New Supply UI — IMPLEMENTED (enhanced)

`client-admin/src/admin/pages/SupplyOrdersList.jsx` — the operational Create → Add lines → Issue workflow,
reusing the existing backend (`POST /admin/supply-orders`, `POST /supply-orders/:id/items`,
`POST /supply-orders/:id/issue` atomic receipt). Enhancements this phase:
- **Line totals** (qty × unit_cost) displayed per line, plus **Subtotal** and **Grand Total** (server remains the
  authority on final value — the client never computes the financial total for the ledger).
- **Money validation** via the shared `money.js` `egpToCents` (rejects empty/malformed/negative/>2-decimals —
  i.e., NaN/Infinity/negative cost are caught client-side for UX; the server enforces authoritative correctness).
- **Quantity validation** (integer > 0) for both existing-product and new-product paths.
- **ConfirmDialog** replaces `window.confirm` for Issue and Cancel (destructive/financial actions).
- Arabic keys added for all new labels.

**Verified:** `vite build` admin includes `SupplyOrdersList-*.js` chunk; no `window.confirm`/`alert` remain in the file.

## 4. RMB: Suppliers list navigation + ConfirmDialog — IMPLEMENTED

`SuppliersList.jsx`: row now navigates to `/erp/suppliers/:id`; added a View action; Deactivate uses ConfirmDialog
(was `window.confirm`); fixed one physical `ml-2` → logical `ms-2` (RTL). Added Arabic keys.

## 5. Admin design system / StatusBadge / icons / destructive actions — PARTIAL

This phase delivered the **nested/primary workflow** (Supplier + Supply) with the existing shared primitives
(`ConfirmDialog`, `DataTable`, `CurrencyFormatter`, `AdminIcon`). The broad consolidation sweep across the whole
admin (77× `bg-primary-600`, 18× `lucide-react`, 8× `.btn-primary`/`.card`, 3× StatusBadge systems) is **NOT**
complete — it is a separate, large design-system migration. Not faked; left REMAINING.

## 6. Remaining static-audit counts (classified, not hidden)

| Finding | Current count (admin src) | Status |
|---|---|---|
| `window.confirm` / `window.alert` | 19 refs across 11 files (Suppliers + Supply migrated this phase) | **PARTIAL** — 11 files REMAINING |
| `bg-primary-600` | 77 | **REMAINING** (design-system consolidation) |
| `lucide-react` imports | 18 files | **REMAINING** (icon migration) |
| `.btn-primary` / `.card` | 8 | **REMAINING** (dead/duplicate classes) |
| `en-GB` locale | 16 | **REMAINING** (locale centralization) |
| physical `left/right/pl/pr/ml/mr` | 92 | **REMAINING** (RTL geometry — many pages) |

New/edited pages (SupplierDetail, SuppliersList, SupplyOrdersList) are clean of `window.confirm/alert` and use
logical spacing (`ms-2`).

## 7. Backend + costing/retail regression — VERIFIED

- `npm test` → **16 suites / 118 PASS** (no backend change this phase).
- Targeted: `valuation` 14, `supplyFlow` 3, `transaction` 3, `concurrency`, `dbIntegrity`, `orderPricing` → **33/33 PASS**.
- **Supplier e2e proven**: Supplier A → 10×5000 → receive; Supplier B → 10×5500 → receive ⇒ `on_hand 20` and
  cost layers `[10@5000, 10@5500]` preserved. History exposes both costs.
- **Retail regression**: `HIGHEST_PURCHASE_COST` × 25% = 6875 (proven by `valuation.test.js`, unchanged).
- **Security**: production `ADMIN_PASSWORD` guard intact; probe scratch files with live secrets are git-ignored;
  RBAC guards present on supplier/supply routes.

## 7b. Real browser verification (2026-09-02) — headless Chrome via CDP

Chrome 152 headless was available in the environment (contrary to the Batch-5 assumption), so actual rendering was
captured for the admin pages this pass:

| Page | Result | Evidence |
|---|---|---|
| `/` Admin Login | **RENDERS** | title, language toggle (EN/ع), username/password; `admin-login-1280.png` |
| `/erp/suppliers` | **RENDERS** | sidebar + sections; `admin-suppliers-1280.png` |
| `/erp/supply-orders` | **RENDERS (after fix)** | was hitting the ErrorBoundary — TDZ fix; `admin-supply-1280.png` |
| `/erp/suppliers/:id` (new) | **RENDERS** | identity, Active, fields, products, history; `admin-supplier-detail-1280.png` |

All admin captures show English LTR at 1280×800 and 390×844 (light). Arabic toggling, dark mode, and full
interaction flows were **not** exhaustively driven this pass.

**Browser verification caught a real latent crash:** the `/erp/supply-orders` page threw a `ReferenceError` because
a `totalCents` computation referenced the `editing` state **before its declaration** (temporal dead zone). Fixed by
moving the computation below the state. This was only observable in a real browser (the production build compiled fine).

**Storefront:** client production build passes; all storefront API endpoints return 200 via both origins. Dev-mode
capture showed only a Vite cold-start loading spinner plus one benign resource 404 (no JS exception). The backend did
not serve the storefront dist root in this ad-hoc dev run (`Cannot GET /`), so a clean production-storefront capture
was not obtained → **REQUIRES BROWSER VERIFICATION (production-served)**.

## 8. Responsive / RTL / Arabic / a11y / locale / forms — PARTIAL

- The new pages are **responsive** (grid + stacked cost cards) and **RTL-safe** (logical props, `text-start/end`,
  DataTable `start/end`). Visual confirmation at 320/390/414/768/1024/1280 → **REQUIRES BROWSER VERIFICATION**.
- **Arabic** keys added for the supplier/supply domain; the full storefront+admin Arabic completion (dozens of
  hardcoded English strings across ~12 admin pages + storefront copy) is **REMAINING**.
- **RTL** physical-prop sweep (92 hits) and **locale** centralization (16 `en-GB`) stay **REMAINING**.
- **a11y** (focus-visible, keyboard DataTable rows, dialog focus) — ConfirmDialog already has Escape/focus/aria;
  broader sweep is **PARTIAL**.
- **Form UX** (required/error/loading/disabled/unsaved-changes) — supplier/supply forms do basic client validation
  + disabled submit; the general audit across Product/Purchase/Pricing/Settings/RBAC forms is **REMAINING**.

## Verdict

The **Supplier Detail + cost-history + New Supply operational fork** is **IMPLEMENTED and builds**. The broad
Admin/Storefront UI/UX closure (design system, icon migration, full Arabic, full RTL, locale, mobile-table strategy,
a11y, focus-visible) is **PARTIAL** — the concrete remaining counts are listed above and are not hidden. All visual
confirmation is **REQUIRES BROWSER VERIFICATION** in this environment.
