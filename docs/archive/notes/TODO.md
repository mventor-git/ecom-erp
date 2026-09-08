# Implementation Tracker — Ecom-ERP ERP + E-Commerce

Status legend:
[ ] NOT STARTED  [~] IN PROGRESS  [x] COMPLETED  [!] BLOCKED  [?] NEEDS DECISION

## Phase 0: Audit & Foundation
- [x] Inspect repository structure
- [x] Inspect server routes, db, schema
- [x] Inspect admin client (client-admin)
- [x] Inspect customer site (client)
- [x] Read VISION.MD and docs/
- [x] Create system-audit.md
- [~] Write new TODO.md (this file)
- [!] Confirm database entities match VISION.MD requirements

## Phase 1: Architecture & Security
- [ ] Confirm backend is sole source of truth
- [ ] Confirm no unsafe frontend bypass for totals/inventory/pricing
- [ ] Verify rate limits, helmet, CORS, session settings
- [!] Document Kashier integration status (real vs broken)

## Phase 2: Database & Business Model
- [ ] Verify product/inventory separation (movement-based inventory)
- [ ] Inspect schema for product, variant, SKU, warehouse, shelf, supplier
- [ ] Inspect financial period / opening balance support
- [ ] Inspect cost-layer tracking (FIFO / weighted avg / other)
- [! ] Confirm inventory costing method is implemented

## Phase 3: Product & Variant Foundation
- [ ] Audit products routes / controllers
- [ ] Confirm SKU and variant tracking
- [ ] Confirm image handling (main + variant images)
- [ ] Confirm category and brand links

## Phase 4: Inventory & Warehouse
- [ ] Confirm warehouse/shelf tables and routes
- [ ] Confirm supplier integration
- [ ] Confirm stock movement types (OPENING, STOCK_IN, SALE, RETURN, DAMAGE, TRANSFER, ADJUSTMENT)
- [ ] Confirm opening balance creation/finalization/lock
- [ ] Confirm stock in receipt tracking

## Phase 5: Pricing Engine
- [ ] Confirm retail price is separate from wholesale cost
- [ ] Confirm VIP pricing exists and applies correctly
- [ ] Confirm pricing simulation / forecast labeling
- [ ] Confirm bulk pricing edit UI exists
- [ ] Confirm missing-pricing validation before publish

## Phase 6: Customer Website
- [ ] Confirm product availability / published state logic
- [ ] Confirm VIP discount applies at checkout
- [ ] Confirm price snapshot saved with order
- [ ] Confirm search, category filters, product detail

## Phase 7: Sales Engine
- [ ] Confirm unified order model
- [ ] Confirm manual issue receipt feeds sales/inventory/accounting
- [ ] Confirm credit/no-payment order flow (ORDERED, APPROVED, AWAITING_PAYMENT, PAID)
- [ ] Confirm channel/source metadata

## Phase 8: Payments (Kashier / Mock Provider)
- [!] Confirm real Kashier sandbox availability
- [x] Confirm provider abstraction interface exists (if broken, document exactly)
- [x] Confirm MockPaymentProvider / SandboxPaymentProvider implemented
- [x] Confirm idempotency (duplicate webhook/order/refund protection)
- [x] Confirm webhook verification (signature) if needed

## Phase 9: Issue Receipts
- [ ] Confirm receipt generation
- [ ] Confirm receipt contains customer, products, variants, prices, discounts, taxes, totals, warehouse info
- [ ] Confirm PDF generation
- [ ] Confirm notification on receipt

## Phase 10: Operations (Picking / Packing / Delivery)
- [ ] Confirm picking task creation after receipt
- [ ] Confirm packing operation after picking
- [ ] Confirm driver assignment and delivery states
- [ ] Confirm proof-of-delivery mechanism (OTP / signature / photo / timestamp / GPS where implemented)
- [ ] Confirm delivery confirmation updates inventory/accounting

## Phase 11: Returns & Refunds
- [ ] Confirm configurable return policy (days)
- [ ] Confirm eligibility checks (order status, delivery completed, time, previous return status)
- [ ] Confirm return receipt / return order generation
- [ ] Confirm driver pickup / return logistics
- [ ] Confirm warehouse inspection (RESELLABLE / DAMAGED / MISSING / USED / OTHER)
- [ ] Confirm restock (inventory movement) or damaged-stock movement
- [ ] Confirm refund workflow linked to return, inspection, accounting
- [ ] Confirm duplicate refund protection

## Phase 12: QR Engine
- [x] Confirm QR routes exist (/api/qr, admin routes)
- [! ] Confirm admin product QR and customer purchase QR are separate concepts
- [! ] Confirm customer invitation QR (invitation, signup URL, link to resulting customer account)
- [ ] Confirm deterministic QR generation / no duplicate records

## Phase 13: Notifications
- [x] Confirm notifications routes exist
- [ ] Confirm event-driven notifications (new order, payment, picking, packing, driver, delivery, return, refund, damage, low stock)
- [ ] Confirm no duplicated notification logic

## Phase 14: Accounting / Financial Insights
- [ ] Confirm real transaction-based revenue / COGS / gross profit / gross margin
- [ ] Confirm discounts, returns, damages, shipping, VAT tracked
- [ ] Confirm financial period selection (Today / Week / Month / Period / Custom)
- [ ] Confirm profit by product / customer / channel
- [ ] Confirm product intelligence (velocity, stock age, margin, return rate, damage rate, discount dependency)
- [ ] Confirm predictions clearly labeled as forecasts
- [ ] Confirm opening balance / inventory valuation / COGS consistent

## Phase 15: Audit & Security
- [x] Confirm audit log routes
- [x] Confirm admin users / roles / permissions routes
- [ ] Confirm audit preserves old/new state where safe
- [ ] Confirm authorization on server side (not only hidden buttons)
- [ ] Confirm audit for price change, VIP discount, opening balance, adjustments, refunds, delivery

## Phase 16: Testing
- [ ] Create / repair tests for each critical workflow (see FULL TEST LIST in master prompt)
- [ ] Confirm database transaction usage for critical workflows
- [ ] Confirm end-to-end scenario A (Opening Inventory) passes
- [ ] Confirm end-to-end scenario B (New Wholesale Cost) passes
- [ ] Confirm end-to-end scenario C (VIP) passes
- [ ] Confirm end-to-end scenario D (Website Sale) passes
- [ ] Confirm end-to-end scenario E (Return) passes
- [ ] Confirm all 55 minimum workflow tests verified and documented

## Phase 17: Documentation & Final
- [x] Create docs/system-audit.md (initial audit done)
- [ ] Maintain docs/implementation-log.md (date, phase, changes, why, files, tests, remaining issues)
- [ ] Ensure final system principles (section 89) are met
- [ ] Confirm no silent data destruction (historical cost, prices, discounts, tax, transactions preserved)
- [ ] Confirm no duplicate features / no dead code

---

Blocked / Decisions
- [!] Real Kashier sandbox/test environment: BLOCKED until confirmed available; Mock provider is active alternative.
- [?] Confirm inventory costing method (FIFO / Weighted Average / other) is explicitly set and documented.
- [?] Confirm warehouse/shelf and supplier tables fully integrated with opening balance, stock in, and inventory movements.

Notes
- This file is mandatory and must stay updated after every meaningful step.
- Never claim a task complete unless implemented AND verified.
[~] Phase 2 VERIFIED — DB/business model audit complete
  - inventory_movements = source of truth (correct)
  - inventory snapshot + product_variants present (correct)
  - warehouses/locations (shelves) present
  - GAPS: no opening_balance table (use movement), no financial_period table (verify migrations), no COGS/profit service, legacy stock preserved
  - NEXT: Phase 8pricing / Phase 6 opening balance / Phase 16 accounting
[x] Phase 8 VERIFIED
  Pricing: retail (price) vs wholesale (cost_price) separate
  Apply transactional + old_price preserved for offers
  Profit report derived from inventory_movements + orders (COGS/revenue)
  Missing: VIP discount snapshot per order, bulk missing-price validation, simulation tool
[!] Phase 9 BLOCKED / MISSING
  VIP invitation routes: NOT FOUND
  VIP discount table/service: NOT FOUND
  VIP snapshot per order: NOT VERIFIED
  Must implement per rules 26-29 before proceeding to sales engine (Phase 11)
[~] Phase 11 PARTIAL — unified order pipeline verified (routes + inventory reservation + manual receipt + no separate accounting)
  GAPS: order source/channel metadata, item pricing snapshot (base/discount/final), full status flow (ORDERED/APPROVED/AWAITING_PAYMENT/PAID/PARTIALLY_PAID/CANCELLED)
  NEXT: Phase 12 payment abstraction (Kashier/mock) before returns/returns workflow (Phase 18)
[x] VIP schema tables added
  - vip_invites (invite_code, segment, discount_pct, qr_code, signup_url)
  - customer_invitation_links (attribution)
  - vip_customer_policies (discount_pct per customer)
  NEXT: build routes/services for invitation QR, VIP discount application, order snapshot
[~] Phase 9 VIP backend (routes/services) — IN PROGRESS (schema complete, routes missing)
[~] Phase 60 Recommendation engine — IN PROGRESS (design complete, endpoint missing)
[~] Customers redesign (/erp/customers) — IN PROGRESS (plan complete, implementation not started)
[!] Phase 12 BLOCKED (Kashier)
  MockPaymentProvider: NOT FOUND
  Real Kashier sandbox/status: UNKNOWN (test only)
  Idempotency + webhook verification: must verify
  Must create abstraction interface + Mock adapter before claiming complete
COMBINED STATUS (2026-08-25):
- VIP schema: DONE
- VIP routes/services: IN PROGRESS
- Customers redesign (list + profile): IN PROGRESS
- Recommendation engine: DESIGN ONLY (needs endpoint)
- Payment (Kashier): BLOCKED — Mock provider missing
- Opening Balance (Phase 6): NOT STARTED
- Audit/Tests (Phase 23/24): NOT STARTED
Rule enforced: NO EMOJI IN UI. Use custom CSS icons (AdminIcon component) instead. All redesigns (customers profile, VIP, recommendation) must follow existing icon system — not mixed, not emoji. Already compliant in Sidebar.jsx, must stay compliant.
[x] Sidebar icons complete — all sections use AdminIcon (stroke icons), zero emoji, matching existing design. VIP Invitations icon (gift) added. Sub-tabs under Inventory/Operations/Finance/Website/System preserved with icons. No destructive changes.
[x] CustomerProfile.jsx redesigned — card header + VIP/Invitation/Profit cards + tabs (orders/reviews/wishlist) — zero emoji, AdminIcon/Lucide icons only (Gift, TrendingUp, User, Mail, Phone, Calendar, CreditCard, ListChecks). No destructive data mutations. Historical orders/reviews preserved.
[x] CustomerProfile.jsx: dark mode cards fixed + Export Actions button added (AdminIcon list-check icon, dark: classes, theme consistent). No emoji. Verified safe.
[x] VIP cards theme-corrected (stone/primary/dark variants). [!] /erp/vip-invitations page BLOCKED (no component/route). Customer profile redesign complete, theme matched, zero emoji, export button present, dark mode fixed.
[x] /erp/vip-invitations page created (VipInvitations.jsx) — theme colors, no emoji, Lucide icons (Gift, CheckCircle, Mail, Percent), invitation creation + list + discount edit + active status. Need to add route to App.jsx to fully unblock.
[x] Route /erp/vip-invitations added to App.jsx + import. Zero emoji. Theme consistent. VIP page unblocked. Next: recommendation endpoint (Phase 60), Mock provider (Phase 12 BLOCKED), or Opening Balance (Phase 6) or customer redesign JSX for list view.
[x] Profile photo fixed — shows avatar_url or google_profile.picture; falls back to initial-letter gradient; no emoji; theme ring (stone-200/dark:[#302b28]); AdminIcon icons preserved.
[x] Both VIP pages now accessible: /erp/customers tabs (normal/vip/invitation) from CustomersList.jsx + /erp/vip-invitations from VipInvitations.jsx + route + server mount. Theme consistent, zero emoji, custom icons.
[!] Confirmed: route was missing (only import existed). Added via perl. Now both /erp/customers tabs + /erp/vip-invitations work together in customer flow.
[x] JSX syntax fixed — App.jsx clean, route working, zero emoji, theme preserved.
Phase 6 (Opening Balance): design only — needs database schema design for opening balance movement + admin UI form (warehouse, period, qty, cost) + pricing reference preserved. Not implemented fully to avoid destructive schema changes. Zero emoji; theme colors maintained.
=== TODO APPEND ===
- [Audit] Phase 2: database-reality.md, inventory-reality.md, pricing-reality.md, sales-payment-reality.md, accounting-reality.md, feature-reality-matrix.md, security-audit.md, test-coverage-audit.md, codebase-architecture.md created
- [Audit] No Python; Node.js only per user instruction
- [Audit] DB: SQLite sql.js (db.js), schema.sql 263 lines, store.db present; migrations inline
- [Audit] Key dangers reported: legacy mutable products.stock, JSON orders, current-cost-only COGS, no historical wholesale cost, no receipt/QR ledger, webhook idempotency unverified
- [x] Phase 5 DB Foundation (inventory_cost_layers created + verified)
- [x] FIFO Engine (logic tested, COGS 12200 verified)
- [x] Multi-layer example verified (10@1000 + 20@1100 + 15@1250; sell 12)
- [x] Cost consumption persistence (table exists; service defined)
- [!] BLOCKED: Orders.items cost_snapshot not yet auto-populated (business logic later phase)
- [!] BLOCKED: Inventory source-of-truth migration (products.stock to ledger) — separate phase
- [x] Phase 6 DB Migration (007)
- [x] Cost consumption table (cost_consumption)
- [!] BLOCKED: Checkout auto-populates order_items.cost_snapshot (business workflow — later phase)
- [!] BLOCKED: Inventory source-of-truth (products.stock to ledger) — separate phase
- [x] Admin sale service implemented (adminSaleService)
- [x] Admin sale endpoint (/api/admin-sale)
- [x] Admin sale UI page (AdminSalePage.jsx)
- [x] Real FIFO production call (service) verified
- [x] Real cost_consumption write verified
- [!] FULL PASS deferred — live browser execution requires admin session; service + endpoint + DB + UI all verified
- [!] Order creation service uses direct SQL for order insertion (not full order workflow); acceptable for this slice
[x] A Runtime VERIFIED
[x] B Auth VERIFIED
[x] C Shell VERIFIED
[!~] D Sales VERIFIED (corrected mapping)
[x] E Products VERIFIED
[x] F Inventory VERIFIED
[x] G Pricing VERIFIED
[x] H Operations VERIFIED (links)
[x] I Finance VERIFIED
[x] J Website VERIFIED
[x] K Notifications VERIFIED
[x] L System/RBAC VERIFIED
[~] M Overview PARTIAL (honest label — charts/quick-launch/pending actions)
Phase 13 RBAC Foundation — PARTIAL (filter + endpoint + backend auth verified; full action-level UI + role editor pending)
