# Comfort Sign — System Audit Report

Date: 2026-08-28
Audit target: `D:/Projects/on-dev/comfort-sign-deploy`
Stack: Node v24.18.0 / Express + sql.js (backend), Vite / React / Tailwind (two SPAs), Expo React Native (mobile-app, worker-app).
Method: read-only mapping, per-domain code audits, and adversarial verification against the live DB and running servers. No file mutations, no DB writes, no browser click-through.

Servers at audit start: backend 5172 (PID 4324), customer 5173 (PID 13052), admin 5174 (PID 14520).
Live DB file: `server/data/store.db` (512000 bytes, mtime 2026-08-28 08:42). The running backend may hold a divergent in-memory copy (db.js calls saveDb() at line 1592; file was in use at audit time).

---

## A. Current project architecture

Three-app monorepo plus two Expo apps:

- **Backend** — `server/`. Express with helmet, CORS (strict allowlist 5173/5174 + env CLIENT_URL), compression, rate-limit (api 200/15min, admin 1000/15min, auth 20/15min, checkout 30/15min), express-session + session-file-store, passport Google OAuth, CSRF (protects `/api/admin` POST/PUT/PATCH/DELETE, exemptions `/api/admin/login` and `/api/health`). Entrypoint `server/index.js`; DB init via `db.initPromise` before listen. Mounts 40+ route modules under `/api`, `/api/admin`, `/api/v1`, `/auth`. Serves `/images` and `/uploads` statically. **In production only** serves `client/dist` as SPA fallback (index.js:311-318). PORT from `.env` = 5172.
- **Customer frontend** — `client/`. Vite port 5173, proxies `/api`, `/images`, `/create-checkout-session`, `/auth` to 5172. BrowserRouter + CartProvider (localStorage `store-cart-v2`) + theme init. Lazy routes: WelcomePage, HomePage, ProductsPage, CartPage, LoginPage, AccountPage, OrderTrackerPage, OnboardingPage. **Isolated from admin** — no cross-imports into client-admin; a legacy admin subtree exists under `client/src/admin/` and is pulled into the bundle by `client/src/pages/AdminDashboard.jsx` and `client/src/pages/ProductForm.jsx`, but is NOT reachable from the customer router.
- **Admin frontend** — `client-admin/`. Vite port 5174, identical proxy to 5172. BrowserRouter with NO basename — all admin routes are root-level or `/erp/*`; there is **no `/admin` URL prefix** for pages (`/api/admin/*` is only the backend API base). 41 Route declarations in `client-admin/src/App.jsx`. Active sidebar `client-admin/src/admin/components/Sidebar.jsx` (11 sections, 30 items + Overview). `client-admin/src/components/Sidebar.jsx` is a 0-byte stale file.
- **Mobile** — `mobile-app/` (Expo RN, customer: Home/Cart/Wishlist/Orders/Account, ProductDetail, Checkout) and **worker-app/** (Expo RN, staff: Orders list, proof-of-delivery photo capture). Both JWT-auth, API base `http://192.168.1.50:5172/api/v1`. Documentation claims mobile apps complete (tickets 039, 040, 036v1); v2 worker + customer APK are backlog.

Services layer: 35 files in `server/services/`. All referenced services exist. Orphaned: `mockPaymentProvider.js` (0 imports anywhere — Phase 12 adapter, never integrated). Internal-only: `code39Service.js`, `inventoryCostLayers.js`.

Route modules all mounted in `server/index.js`. Dead code found: index.js lines 369-372 mount `/api/admin/vip` and `/api/admin/recommendations` **after** `module.exports` (line 369) — these routes are NEVER registered.

---

## B. Runtime topology (5172/5173/5174 + PIDs + DB)

| Process | Port | PID | Role | Evidence |
|---|---|---|---|---|
| Backend (Node) | 5172 | 4324 | Express + sql.js API | `/api/health` → `{status:'ok', uptime:38275s}`; root returns 404 ("Cannot GET /") in dev — confirms dev mode, server serves no HTML |
| Customer SPA (Vite) | 5173 | 13052 | client/ dev server | HTTP 200 at root, served index HTML |
| Admin SPA (Vite) | 5174 | 14520 | client-admin/ dev server | HTTP 200 at root |
| DB file | — | — | `server/data/store.db` | 512000 bytes; 60 sqlite_master entries (59 tables + sqlite_sequence); mtime 2026-08-28 08:42 |

Live probes (read-only): `GET /api/admin/inventory/stock?product_id=1&warehouse_id=1` → 401 (auth gate works); `GET /api/admin/customers` → 401; `GET /api/admin/reports` (anon) → 401; `GET /api/kashier/checkout/status` → `{kashierEnabled:false}` (gateway not configured locally); `GET /api/orders/mine` (anon) → 401 (JWT/session gate works); `GET /api/orders/statuses` → 12 statuses, `flowEnabled:true`; `GET /api/products` → `[]` (the single product has `active=0`).

**DB divergence risk (NOT VERIFIED):** db.js applies many `ALTER`/`CREATE IF NOT EXISTS` at init and calls `saveDb()` at line 1592. If the backend has unflushed in-memory changes, the file state below may not equal the running backend's state. DB file was actively modified at 08:42 on audit day.

---

## C. Active frontend sources (client-admin vs client)

- **Admin active source = `client-admin/`.** Self-contained: grep across `client-admin/src` found no imports of `client/`. 185 symbols exported by `client-admin/src/api/adminApi.js` (183 endpoint functions + fetchCsrfToken + clearCsrfToken). One referenced symbol is missing: `getAdminRecommendations` (imported by orphan `RecommendationsPage.jsx`; would throw synchronously if mounted).
- **Customer active source = `client/`.** Router at `client/src/App.jsx` (11 routes). Contains a legacy admin subtree at `client/src/admin/` (9 files) and unreachable legacy pages `AdminDashboard.jsx` / `AdminSalePage.jsx` / `ProductForm.jsx` — these ARE pulled into the customer bundle via imports but are NOT mounted in the customer router and NOT reachable from customer nav. The active customer router explicitly comments admin isolation (App.jsx lines 17, 106).
- **Cross-import verdict:** customer app DOES transitively import admin-tree code (`AdminDashboard.jsx` imports `../admin/layouts/AdminLayout` and `../admin/services/api`; `ProductForm.jsx` imports `{ checkAdmin, getAdminProducts }` from `../api/products`); admin app does NOT import client code. Not a runtime conflict (different bundles, different ports), but the legacy admin code ships dead weight in the customer bundle.

---

## D. DB state summary (table counts)

Live counts verified read-only via sql.js against `server/data/store.db`:

| Table | Rows | Table | Rows |
|---|---|---|---|
| users | 3 | roles | 3 |
| permissions | 33 | role_permissions | 38 |
| user_roles | 3 | customers | 6 |
| orders | 17 (2 paid, 15 pending) | order_items | 3 (LEGACY 9-col) |
| issue_orders | 5 | issue_order_items | 1 |
| inventory_movements | 0 | inventory_cost_layers | 3 |
| warehouses | 1 (WH-MAIN) | locations | 0 |
| products | 1 (inactive) | product_variants | 0 |
| categories | 1 | brands | 5 |
| suppliers | 0 | purchase_orders | 0 |
| picking_tasks | 0 | packing_tasks | 1 |
| notifications | 0 | in_app_notifications | 11 |
| notification_rules | 0 | device_tokens | 0 |
| events | 90 | settings | 93 |
| price_lists | 4 | product_prices | 0 |
| shipment_providers | 5 | shipments | 0 |
| vip_invites | 1 | wishlist / reviews | 0 / 0 |
| customer_verifications | 0 | ai_config / ai_conversations | present |

**Schema vs DB gaps (VERIFIED):**
1. `cost_consumption` table MISSING (expected by migration `007_cost_consumption.sql` + db.js ~line 888).
2. `customer_invitation_links` MISSING (expected by 005 + schema.sql:249).
3. `vip_customer_policies` MISSING (expected by 005 + schema.sql:257).
4. `order_items` is the LEGACY 9-col schema (`id, order_id, product_id, product_name, quantity, price, variant_color, variant_size, created_at`). Migrations 004/005 (19-col with `base_price`, `discount_*`, `final_price`, `price_list_code`, `tax_*`, `cost_snapshot`, `sku`) were NOT applied to this DB. Live price snapshot lives only as raw price values inside `orders.items` JSON.
5. `audit_log` NOT FOUND — it is NOT defined in schema.sql either (NOT VERIFIED whether it should exist); the `events` table is the de-facto immutable audit surface.

**Extra tables created at runtime by db.js (not in schema.sql):** `vip_cart` (db.js:104), `kashier_orders`, `kashier_webhook_events` (db.js:1283-1284), `product_suppliers`. DB `products` table has an extra `has_variants` column not in schema.sql.

---

## E. Business workflow map

Customer → Order → Issue Receipt → Inventory → Picking → Packing → Delivery/Returns (future).

1. **Browse/Add to cart** — customer `client/`: Home/Products/Detail → CartContext (localStorage `store-cart-v2`). No price snapshot to DB at cart time.
2. **Checkout** — CartPage calls `createKashierSession` → `POST /api/kashier/checkout/session`. **BLOCKED: body-shape mismatch** (see L1). Backend supports both Kashier redirect and COD (`web_cod`). `createOrder` (`POST /api/orders`) exists in api/products.js but is NEVER called by any customer page.
3. **Payment** — Kashier hosted checkout. `kashierWebhookService.handleTransactionSuccess` (HMAC-SHA512 verified, idempotent via `kashier_webhook_events` unique key, INSERT OR IGNORE) finds order by `kashier_orders`, sets status `paid`, calls `salesInventoryBridge.issueForOrder`. `kashierEnabled=false` locally.
4. **Issue Receipt** — the authoritative deduction event for sales is a **single `type='issue'` inventory movement**, created by `salesInventoryBridge.issueForOrder` (idempotent via `orderAlreadyHas` guard, salesInventoryBridge.js:41-48) or by `adminSaleService` (direct INSERT). `warehouseOrderService.issueIssueOrder` deducts stock for manual Issue Orders (status must be `draft`, rollback via correction movements on partial failure, lines 267-285). Auto-issue path `createIssueForOrder` (warehouseOrderService.js:399) is idempotent per order (skips if `issue_orders` row exists), skips stock when `temp=true`, and creates a packaging-consumption movement when `packaging_product_id` setting exists.
5. **Inventory** — `inventoryService` is the central movement engine (11 types, lines 4-16; trash guard; reservation-only `qty_reserved` bucket for RESERVATION/RELEASE; negative-stock config; smart costing lines 133-143; low-stock check; replay). Stock-on-hand = physical bucket; available = on-hand − reserved (inventoryService.js:108-114). `inventory_movements` is empty in the live DB.
6. **Picking** — triggered from order confirmation: `orderWorkflowService.js:226` calls `pickingPackingService.startPicking` (creates `picking_tasks` row). `updatePickingStatus` enforces ordered transitions, writes `picked_by`/`picked_at` only on first completion, and logs `picking_status_changed` only once. **Zero inventory_movements writes** (VERIFIED).
7. **Packing** — `orderWorkflowService.js:230` calls `createPackingTask`; also auto-created when a picking task completes (pickingPackingService.js:136-141). `updatePackingStatus` transitions `packed → ready_for_shipping`. **Zero inventory mutations** (VERIFIED). **BLOCKED as E2E:** no packing-sheet print endpoint (only picking sheet at views.js:139), no master-prompt packing Definition-of-Done, no verified downstream transition after `ready_for_shipping`.
8. **Delivery/Returns (future)** — shipment_providers (5 seeded) + shipments table (0 rows) exist; `shippingService` handles order→shipped transition. Issue-order fulfillment pipeline exists at service/route level (`pack/assign-driver/claim/send/delivering/delivered`, warehouseOrderService.js:479-592) but has **no UI**. Returns: sidebar `/erp/returns` is a dead link (no route, no component). Not implemented.

**Order lifecycle (server-side):** 12 statuses confirmed live. `orderWorkflowService.transitionOrder` validates against transitionMap; quadruple confirmation engine (payment/stock/manual/auto); auto-approval sweep via scheduler. On confirm → reserve stock; on ship → release + issue; on cancel/refund → release.

---

## F. Sidebar/route map (client-admin)

Router: `client-admin/src/App.jsx` — 41 root-level Routes, all lazy-loaded except AdminLogin/AdminLayout/ErrorBoundary. No `/admin` prefix, no catch-all/`*` route (any unknown path renders an empty `<main>` inside AdminLayout).

Active sidebar: `client-admin/src/admin/components/Sidebar.jsx` (302 lines, sections at 212-266). 31 targets (30 items + Overview). Full table in "Route audit" below.

**Dead links (VERIFIED):**
- `/erp/returns` (Sidebar.jsx:66) — no Route, no component, no other reference. Blank content on click.
- `/notifications` (Sidebar.jsx:79) — actual route is `/erp/notifications` (App.jsx:348-355). NotificationsPage unreachable from sidebar.

**Routes with no nav entry (reachable only by URL or internal Link):** `/erp/supply-orders` (App.jsx:207 → SupplyOrdersList), `/featured` (App.jsx:141 → FeaturedList; also rendered as tab inside SiteConfig), `/products/new` (App.jsx:125).

**Route-to-component miswiring (BROKEN):** `/products/new` (App.jsx:125) and `/products/:id/edit` (App.jsx:133, linked from ProductsList.jsx:172) both mount `InventoryMovementPage.jsx` — a **hardcoded mockup** (13 static rows, zero adminApi imports, comments admit it "simulates fetching"). Product create/edit UI does NOT call the real `POST/PUT /api/admin/products` endpoints. `/inventory/movement` (App.jsx:191) mounts the same mockup.

**Orphan page files (no route, no import, VERIFIED):** `MovementsList.jsx` (392 lines — the REAL movements page with adminApi calls), `MovementSubPage.jsx` (hardcoded prototype), `RecommendationsPage.jsx` (imports non-existent `getAdminRecommendations`).

**Not orphans:** AISettings, AnnouncementsList, HeroSlidesList, WelcomeSlidesList — SiteConfig sub-tabs (SiteConfig.jsx:12-15, 81-84).

---

## G. RBAC map

**Three-layer auth stack:**
1. `adminAuth` (middleware/adminAuth.js:3) — session flag `req.session.isAdmin` only.
2. `requirePermission` / `requireRole` / `requireSuperAdmin` / `isAuthenticated` (middleware/rbac.js:14, 112, 84, 153) — multi-role aware via `permissionService` (user_roles union + legacy role_id; services/permissionService.js:10, 26, 37, 41, 47).
3. CSRF on `/api/admin` POST/PUT/PATCH/DELETE (middleware/csrf.js:35).

**Live DB catalog:** roles=3 (admin id=1, sales_employee id=2, warehouse_employee id=3), permissions=33, role_permissions=38, user_roles=3 (users 1/2/3 → roles 1/2/3).

**Permission gaps (VERIFIED):**
- `customers.manage` and `customers.view` are enforced via `requirePermission` in `routes/customers.js` and `routes/vipInvitations.js` but have **NO DB rows** → always 403 for DB-backed users. **BROKEN.**
- Seeded but never enforced: `orders.create`, `orders.delete`, `orders.read`, `orders.update`, `purchase_orders.approve`, `reports.view` (no requirePermission call references them).
- Admin CRUD order routes (`/api/admin/orders`, `/orders/stats`, `/:id/status`, `/:id/refund`, admin.js:962-1157) use **adminAuth only** — no `orders.manage` guard. Print/email views correctly require `orders.manage` (views.js:21-157).
- `super_admin` is NOT a DB row. The super_admin bypass (rbac.js:18-29) is reachable only via env-bootstrap `ADMIN_USERNAME`/`ADMIN_PASSWORD` login, or a `user_roles` row naming role `super_admin` (none exists). **Env login is the only super_admin path.**
- `documents.manage` (required by warehouseOrders.js:192,200) — presence in DB catalog NOT VERIFIED; if absent, document endpoints 403 for DB users.
- Admin notifications routes (`routes/notifications.js`) and AI admin routes (`routes/adminAI.js`) use **adminAuth only, no RBAC**.
- Inventory/picking/packing RBAC fully enforced (inventory.view/manage/adjust/transfer, warehouses.read/manage, inventory.packing all in DB).
- Purchasing RBAC fully enforced (suppliers.read/manage, purchase_orders.read/create/update in DB). `purchase_orders.approve` seeded but unused.
- Reports: `reports.read` enforced on /sales-daily, /profit-report, /events; `reports.view` seeded but unused.

**Role assignments (live DB):** admin → all 33 permissions. sales_employee → orders.create + orders.read. warehouse_employee → inventory.manage + inventory.packing + inventory.view. **No role has customers.\* permissions** despite code enforcing them.

---

## H. Verified foundations

- **Issue Receipt is the single authoritative deduction event.** `issueForOrder` creates only `type='issue'` movements with idempotency guard `orderAlreadyHas`; adminSaleService direct-INSERTs `type='issue'`. No double-deduction path exists for the same order/issue (VERIFIED across salesInventoryBridge, mobileOrders, warehouseOrderService).
- **Picking and Packing perform ZERO inventory_movements writes.** Full pickingPackingService read — no `createMovement` calls. Packaging consumption happens at issue-order creation (warehouseOrderService.js:427-446), NOT at pack status change (VERIFIED).
- **Reservation touches only `qty_reserved`**, never physical on-hand; replay excludes reservation/release (inventoryService.js:72-73, 268-272, 361).
- **Picking idempotency:** `picked_by`/`picked_at` written once, preserved on retry; duplicate audit events suppressed on `picked→picked` (pickingPackingService.js:119-123, 129-133).
- **Kashier webhook idempotency:** deterministic event key + `INSERT OR IGNORE` on unique `event_key` (db.js:1283); duplicate returns `duplicate:true` without re-dispatch; status guards prevent double issue/refund/void (kashierWebhookService.js:40-116).
- **Admin app is source-level self-contained** (no client/ imports).
- **Sidebar→route→component wiring is CONFIRMED for 28/31 targets** (all except /erp/returns, /notifications — broken — and the miswired /products/new + /products/:id/edit which "resolve" to the wrong component).
- **Backend security posture:** strict CORS allowlist, rate limits, helmet CSP, httpOnly session cookies secure:'auto', 24h TTL, fail-fast SESSION_SECRET check, CSRF on admin state changes, sanitizeProducts strips cost_price from all public product responses.
- **Full domain audits VERIFIED end-to-end at code level:** Overview/Dashboard, Issue Receipts, Picking, Site Config, System (Users/Roles/Audit/Integrations/Settings). (Code-wiring verified; live browser click-through not performed.)

---

## I. Broken areas

1. **Customer checkout BLOCKED** — CartPage sends `{items, customer_email, phone, price_list_code, allowedMethods}` but `kashierCheckout.js:79-82` requires `{orderRef, total, customerEmail, redirectPath}` and rejects with "orderRef and total are required". The primary revenue path fails at runtime. **Highest-priority blocker.**
2. **Customers/VIP domain BROKEN** — `customers.manage`/`customers.view` missing from DB (403 for DB users on customers.js + vipInvitations.js); `/api/admin/vip` route never mounted (dead code after module.exports); `VipInvitations.jsx` is a local-state placeholder (zero adminApi); schema collision (`vipService` writes `code`/`invite_name` vs `vipInvitations.js` writes `invite_code`/`segment_type`/`discount_pct`); `vip_customer_policies` and `customer_invitation_links` tables MISSING → discount application and attribution impossible.
3. **Product create/edit UI miswired** — `/products/new` and `/products/:id/edit` mount the hardcoded `InventoryMovementPage` mockup, not a product form. Real `POST/PUT /api/admin/products` exist but are unreachable from UI.
4. **Two dead sidebar links** — `/erp/returns` (no route/component) and `/notifications` (should be `/erp/notifications`); no catch-all/404 route anywhere.
5. **DB migrations not applied** — `order_items` legacy 9-col (004/005 not applied → no price snapshot columns, no cost_snapshot), `cost_consumption` missing (007 → FIFO persistence broken), VIP tables missing (005).
6. **Dead code after `module.exports`** in `server/index.js:369-372` — `/api/admin/vip` and `/api/admin/recommendations` never registered.
7. **Order creation not idempotent** — `POST /api/orders` (orders.js:36-40) has no idempotency-key check and no dedup; a retry creates a second row. `idempotencyService` middleware is registered only on `routes/inventory.js:46` (movements). Mock payment provider REFUTED for dedup (no storage/guard).
8. **Order price snapshot integrity** — no DB-level price verification or tamper guard at order creation; order comes from localStorage cart items JSON; no order-confirmation email sent by kashier webhook.
9. **Legacy admin code ships in customer bundle** — `client/src/pages/AdminDashboard.jsx`, `ProductForm.jsx` import admin-tree code (`../admin/layouts/AdminLayout`, `../admin/services/api`, `checkAdmin`), contradicting the stated isolation intent (verification REFUTED the claim "customer app does not import admin code").

---

## J. Partial areas

- **Sales > Orders (PARTIAL):** full UI + workflow + documents, but admin CRUD routes lack `orders.manage`; order_items legacy schema; auto-approval requires manual admin_review first; VIP on-bill flow not exposed in customer UI.
- **Products/Catalog (PARTIAL):** list/categories/brands real; create/edit broken (see I3); no variant/image/CSV-import UI.
- **Purchasing (PARTIAL):** UI + routes + services complete (PO number, atomic receipt with transaction, event emit), all 4 tables empty in live DB; no supplier payments/invoices (AR/AP absent), no PO approval gate despite `purchase_orders.approve` seed.
- **Inventory (PARTIAL):** dashboard/warehouses real; movements UI is a hardcoded mockup while the real 392-line `MovementsList.jsx` is orphaned; `cost_consumption` missing; opening-balance finalize/lock NOT VERIFIED.
- **Pricing (PARTIAL):** full pricing engine wired (markup/margin/match/offer, charm .99, apply/revert via PRICING_APPLIED event, ribbons); `default_markup_percent`/`storefront_price_list` live values not directly observed; VIP pricing absent at checkout; storefront ribbon not visually verified.
- **Finance (PARTIAL):** real Kashier gateway service + webhook, reports, financial periods; but cost_consumption missing, inventory_movements empty (static stock valuation), no journal/ledger/AR/AP/settlement tables, `kashierEnabled=false` locally, warehouseOrders finance RBAC AMBIGUOUS.
- **Notifications (PARTIAL):** real service + UI + 11 in-app rows; but notification_rules=0 (rule engine inert), sidebar link broken, admin routes have no RBAC, `resolveRecipient` numeric-id bug class (string-key lookup, no `role` branch), push non-functional (device_tokens=0, notify_channel_push=0).
- **Customer Website Experience (PARTIAL):** all 11 routes real; checkout broken; VIP not applied; products list empty (data); i18n gaps (ProductDetail 13, Account 18, OrderTracker 22, Success 4 hardcoded English strings).
- **Packing (BLOCKED):** service + routes + real UI + RBAC exist and work to `packed→ready_for_shipping`, but no packing-sheet print endpoint, no master-prompt Definition-of-Done, no verified downstream after packing, emoji icons violate zero-emoji rule (PackingDashboard.jsx:102/104/129).

---

## K. Unknown / ambiguous areas

- **Live backend in-memory DB state** — may diverge from store.db file (saveDb at db.js:1592). NOT VERIFIED; only the file was audited.
- **`audit_log` table** — absent from DB and from schema.sql; NOT VERIFIED whether it is expected to exist (events table serves as the audit surface).
- **`documents.manage` permission** — required by warehouseOrders.js:192,200; NOT VERIFIED present in the 33-permission catalog.
- **Email/SMTP delivery** — SMTP config exists in .env shape; no SendGrid/SMTP verification; order confirmation email absent.
- **Kashier integration live behavior** — `kashierEnabled=false` locally; webhook handler verified in code only.
- **`default_markup_percent` and `storefront_price_list` live values** — not directly observed (db.js inline require failed; file digest used instead).
- **Opening-balance finalize/lock mechanism** — NOT VERIFIED to exist.
- **`warehouseOrders.js` financial-period endpoints RBAC** — AMBIGUOUS (not individually verified).
- **purchase_order_items count** — sql.js API limitation; unverified.
- **packing_tasks 1 row content** — unverified.
- **Browser-level end-to-end flows** — not tested (audit rules prohibit browser click-through); all runtime claims are code-wiring + HTTP probes.

---

## L. Immediate blockers (priority-ordered)

1. **Customer checkout is broken** — CartPage body does not match `/api/kashier/checkout/session` contract; customer cannot complete a purchase. This is the top revenue-path defect. Reference: `client/src/pages/CartPage.jsx:50-77` vs `server/routes/kashierCheckout.js:79-82`.
2. **Customers/VIP domain is non-functional for DB users** — `customers.manage`/`customers.view` missing from DB (403s); `/api/admin/vip` route not mounted; VIP tables missing; VipInvitations UI is a placeholder.
3. **Product create/edit routes render a mockup** — no UI path to create or edit a product; real API unreachable from UI.
4. **DB migrations 004-007 not applied** — order_items legacy schema (no price snapshot/cost columns), cost_consumption missing (FIFO breaks), VIP tables missing.
5. **No 404/catch-all + two dead sidebar links** — `/erp/returns`, `/notifications`; users can hit blank screens.

---

## M. Recommended execution order

1. **Runtime/arch integrity** — fix checkout body contract; apply missing migrations (004-007); remove dead code after module.exports; fix the two dead sidebar links + add catch-all 404; wire idempotency into order creation.
2. **Fulfillment — Packing E2E first** — master prompt 14.7. Close the pack flow to a defined done state: add packing-sheet print, define the Definition-of-Done, wire `ready_for_shipping` downstream.
3. **Inventory/procurement** — mount the real MovementsList, replace the mockup, wire product create/edit to real API, seed suppliers/POs, complete PO→receipt→AP.
4. **Pricing/finance** — apply cost_consumption migration, verify markup/storefront list live values, close FIFO costing, add journal/ledger/AR/AP.
5. **Control plane** — RBAC repair (customers.\* permission rows, orders.manage on admin CRUD, notifications/AI RBAC), super_admin/audit policy.
6. **Deployment** — production SPA serving (client/dist only — note admin dist is NOT served), env hardening, domain.
7. **AI** — tie out aiService + AISettings + recommendations (dead getAdminRecommendations), customer chat.

---

## N. FIRST implementation task

**Repair the broken customer checkout contract (blocker L1), then Packing E2E (master prompt 14.7).**

Rationale: the audit shows a higher-priority runtime blocker than 14.7 — the primary purchase path fails with HTTP 400 because `CartPage.jsx` sends `{items, customer_email, phone, price_list_code, allowedMethods}` while `server/routes/kashierCheckout.js:79-82` requires `{orderRef, total, customerEmail, redirectPath}` (validated server-side: "orderRef and total are required"). This is a small, fully-specified repair: align the client payload to the server contract (and/or extend the server to accept the client shape), confirm via a live checkout-session HTTP probe. After the checkout path is green, execute Packing E2E (14.7) as the first fulfillment feature: add a packing-sheet print endpoint (views.js currently only has picking at line 139), define the packing Definition-of-Done, and verify the `packed → ready_for_shipping → shipped` transition end-to-end including its issue-order/stock relationship.

---

## Domain table

| Domain | Active UI | API | Service | DB | RBAC | Runtime | Status |
|---|---|---|---|---|---|---|---|
| Overview / Control Center (Dashboard) | `client-admin/src/admin/pages/Overview.jsx` (/dashboard) | /api/admin/orders, /orders/stats, /reports/sales-daily, /overview | overviewService (orphaned — page uses raw SQL endpoints) | orders 17, customers 6, products 1, warehouses 1 | adminAuth only (stats/overview); reports.read (sales-daily) | 3 servers live; page real | VERIFIED |
| Sales > Orders | OrdersList.jsx (/orders) | /api/admin/orders + /orders/stats + statuses + timeline + status + refund + view/* docs | orderWorkflowService, salesInventoryBridge, printService, eventService | orders 17 (15 pending, 2 paid), order_items legacy 9-col | orders.manage on views only; CRUD adminAuth-only | Wiring verified; live browser flow not tested | PARTIAL |
| Sales / Customers / VIP / Invitations | CustomersList.jsx (real); VipInvitations.jsx (placeholder); LoginPage (invite capture) | /api/admin/customers, /api/admin/vip (NOT mounted), /api/customer/* | customerService, vipService (schema clash) | customers 6, vip_invites 1; vip_customer_policies + customer_invitation_links MISSING | customers.manage/view MISSING from DB → 403 | /api/admin/customers 401 unauth; domain broken for DB users | BROKEN |
| Sales > Issue Receipts | IssueOrdersList.jsx (/erp/issue-orders) | /api/admin/issue-orders/* (warehouseOrders.js) + /view/issue-order | warehouseOrderService.issueIssueOrder / createIssueForOrder | issue_orders 5, issue_order_items 1 | inventory.view/manage + adminAuth on every endpoint | VERIFIED (code + DB + curl 401) | VERIFIED |
| Products / Catalog | ProductsList, CategoriesList, BrandsList (real); /products/new + /:id/edit → InventoryMovementPage MOCKUP | /api/admin/products CRUD + images + categories + brands + bulk + import/export | productTrashService, inventoryService, pricingService, priceListService | products 1 (inactive), variants 0, images 0, price_lists 4, product_prices 0 | products.* on bulk/import only; adminAuth on admin.js CRUD | Create/edit UI miswired to mockup | PARTIAL |
| Purchasing | PurchaseOrdersList, SuppliersList (real) | /api/admin/suppliers/*, /api/admin/purchase-orders/* | No service; documentNumberService + inventoryService (receipt) + eventService | suppliers 0, purchase_orders 0, product_suppliers 0 (tables present) | suppliers.* / purchase_orders.* fully enforced, all in DB | Wiring complete; tables empty | PARTIAL |
| Inventory / Warehouses / Movements | InventoryDashboard (real), InventoryMovementPage (MOCKUP at /inventory/movement), WarehousesList | /api/admin/inventory/* (stock, movements, replay, low-stock, summary, transfer), /api/admin/warehouses/* | inventoryService (460 lines, 11 types) | warehouses 1, locations 0, inventory 1, movements 0, cost_consumption MISSING | inventory.* / warehouses.* fully enforced, all in DB | 401 gate confirmed; movements UI is mockup, real MovementsList orphaned | PARTIAL |
| Pricing | PricingEngine, PricingProfit, PriceLists (real) | /api/admin/pricing/* (preview/apply/last-apply/revert/offers/profit-report), /api/admin/price-lists | pricingService (DEFAULT_MARKUP 20, charm .99), priceListService, settingsService | products.cost_price/price/old_price/offer_badge, settings, price_lists, product_prices | products.update/read, reports.read enforced | Wiring verified; live markup/apply not executed; VIP pricing absent | PARTIAL |
| Operations > Picking | PickingDashboard (/erp/picking) | /api/admin/picking/tasks + assign + status | pickingPackingService.startPicking/updatePickingStatus | picking_tasks 0 (table present), events wired | inventory.view/manage enforced, in DB | VERIFIED (service, route, RBAC, zero inventory impact) | VERIFIED |
| Operations > Packing | PackingDashboard (/erp/packing, same file) | /api/admin/packing/tasks + assign + status + stats | pickingPackingService.createPackingTask/updatePackingStatus | packing_tasks 1 row | inventory.packing on status only (not assign) | Service/route/UI real but no packing sheet, no DoD, no verified downstream | BLOCKED |
| Finance (Accounting/Reports/Payments/Periods) | FinancialPeriods, ReportsDashboard, PricingEngine/Profit, RevenueDetail, KashierPage (all real) | /api/admin/reports/*, financial-periods, /api/admin/kashier, /api/kashier/checkout/* | kashierService (real, not mock), kashierWebhookService, reportService | orders 17, order_items legacy, cost_consumption MISSING, movements 0, kashier_orders present | reports.read, orders.manage enforced; warehouseOrders finance AMBIGUOUS | kashierEnabled=false; 401 on anon reports; no ledger/AR/AP | PARTIAL |
| Site Config / Branding / SEO | SiteConfig.jsx (6 sub-tabs: homepage/featured/ai/announcements/hero/welcome) | /api/admin/settings, /api/admin/ai/*, featured, welcome-slides (admin.js), hero-slides, announcements | settingsService (only real service); others direct SQL in routes | settings 93, announcements/hero_slides/welcome_slides/ai_config present (empty) | settings.read/manage enforced; featured/hero/announcements/welcome AI = adminAuth only (RBAC gap on AI) | Public endpoints live; identity fields empty (store_name=E-Commerce, logo empty) | VERIFIED |
| Notifications | NotificationsPage (/erp/notifications) + NotificationCenter (bell, polls 30s) | /api/admin/notifications/*, /api/v1/notifications/* (mobile) | notificationService, notificationChannels, eventService | notification_rules 0, notifications 0, in_app 11, device_tokens 0 | adminAuth only (no RBAC); JWT for mobile | Rules engine inert; sidebar link broken; resolveRecipient bug class | PARTIAL |
| System: Users/Roles/Audit/Integrations/Settings | UsersList, EventsList, IntegrationsPage, SettingsPage (all real) | /api/admin/users/*, events, integrations, settings | eventService (immutable events), permissionService, settingsService | users 3, roles 3, permissions 33, role_permissions 38, user_roles 3, events 90, settings 93; no audit_log table | users.*, settings.*, reports.read enforced; super_admin only via env bootstrap | Code-wiring verified; no browser flow; events = audit surface | VERIFIED |
| Customer Website Experience | client/src/pages/* (11 routes) | /api/products*, /api/orders*, /api/kashier/checkout/*, /api/customer/*, wishlist | priceListService, kashierService/Webhook, salesInventoryBridge, orderWorkflowService | products 1 inactive, customers 6, orders 17 (total=0), kashierEnabled=false | none (session/JWT only); sanitizeProducts strips cost | All servers live; checkout BLOCKED; products list empty; i18n gaps | PARTIAL |

---

## Route audit (client-admin sidebar → route → router → component → API → runtime)

| Sidebar Item | Route | Router Entry (App.jsx) | Component | API | Runtime | Status |
|---|---|---|---|---|---|---|
| Overview | /dashboard | 68-75 | Overview.jsx | /admin/orders, /admin/orders/stats, /admin/reports/sales-daily | Live | OK |
| Orders | /orders | 173-179 | OrdersList.jsx | /admin/orders, /orders/stats, /orders/statuses, /orders/:id/timeline, /orders/:id/status, /orders/:id/refund | Live | OK (adminAuth-only CRUD gap) |
| Customers | /erp/customers | 263-269 | CustomersList.jsx | /admin/customers | Live (401 unauth) | OK |
| Issue Receipts | /erp/issue-orders | 215-221 | IssueOrdersList.jsx | /admin/issue-orders/* | Live | OK |
| VIP & Invitations | /erp/vip-invitations | 277-281 | VipInvitations.jsx (placeholder) | (none — local state only) | Live | BROKEN (placeholder + perms missing) |
| Products | /products | 109-115 | ProductsList.jsx | /admin/products | Live | OK (list) |
| Categories | /categories | 149-155 | CategoriesList.jsx | /admin/categories | Live | OK |
| Brands | /brands | 165-171 | BrandsList.jsx | /admin/brands | Live | OK |
| Suppliers | /erp/suppliers | 285-291 | SuppliersList.jsx | /admin/suppliers/* | Live | OK |
| Purchase Orders | /erp/purchase-orders | 293-299 | PurchaseOrdersList.jsx | /admin/purchase-orders/* | Live | OK |
| Inventory Dashboard | /inventory | 183-189 | InventoryDashboard.jsx | /admin/inventory/summary, /low-stock, /warehouses | Live | OK |
| Inventory Movements | /inventory/movement | 191-197 | InventoryMovementPage.jsx | (none — MOCKUP) | Live | BROKEN (mockup; real MovementsList orphaned) |
| Warehouses | /inventory/warehouses | 199-205 | WarehousesList.jsx | /admin/warehouses/* | Live | OK |
| Retail Pricing | /pricing-engine | 77-83 | PricingEngine.jsx | /admin/pricing/* | Live | OK |
| Price Lists | /erp/price-lists | 231-237 | PriceLists.jsx | /admin/price-lists | Live | OK |
| Pricing Insights | /pricing-engine/profits | 85-91 | PricingProfit.jsx | /admin/pricing/profit-report | Live | OK |
| Picking | /erp/picking | 246-253 | PickingDashboard.jsx | /admin/picking/tasks + assign + status | Live | OK |
| Packing | /erp/packing | 238-245 | PackingDashboard.jsx | /admin/packing/tasks + assign + status + stats | Live | BLOCKED (no packing sheet / DoD / downstream) |
| Shipping | /erp/shipping | (route present) | ShippingPage | /admin/shipping/*, /admin/view/shipping | Live | OK |
| Returns | /erp/returns | NONE | NONE | — | — | BROKEN (dead link, blank screen) |
| Revenue Detail | /dashboard-detail/revenue | 93-99 | RevenueDetail.jsx | /admin/reports/sales-daily | Live | OK |
| Reports | /erp/reports | 301-307 | ReportsDashboard.jsx | /admin/reports/* | Live | OK |
| Financial Periods | /erp/financial-periods | 223-229 | FinancialPeriods.jsx | /admin/warehouseOrders/financial-periods | Live | OK |
| Kashier | /erp/kashier | 309-315 | KashierPage.jsx | /admin/kashier/* | Live (disabled) | OK (gateway off) |
| Site Config | /site-config, /site-config/:tab | 358-373 | SiteConfig.jsx (+ 5 sub-tab pages) | /admin/settings, /admin/ai/*, featured, welcome-slides, hero-slides, announcements | Live | OK |
| Notifications | /notifications → should be /erp/notifications | 348-355 (actual) | NotificationsPage.jsx | /admin/notifications/* | Live | BROKEN (sidebar mismatch) |
| Users & Roles | /erp/users | 341-347 | UsersList.jsx | /admin/users/* | Live | OK |
| Audit Log | /erp/events | 333-339 | EventsList.jsx | /admin/events, /events/counts | Live | OK |
| Integrations | /erp/integrations | 325-331 | IntegrationsPage.jsx | /admin/integrations | Live | OK |
| Settings | /erp/settings | 317-323 | SettingsPage.jsx | /admin/settings/* | Live | OK |

Dead routes with no nav entry: `/products/new` (App.jsx:125 → InventoryMovementPage MOCKUP — BROKEN), `/featured` (App.jsx:141 → FeaturedList), `/erp/supply-orders` (App.jsx:207 → SupplyOrdersList). Orphans: MovementsList.jsx, MovementSubPage.jsx, RecommendationsPage.jsx. No catch-all/404 route exists.

---

## Verification results

### A. Admin app routing / sidebar (all CONFIRMED)

| Claim | Result | Evidence |
|---|---|---|
| Active sidebar is `src/admin/components/Sidebar.jsx`; `src/components/Sidebar.jsx` is 0-byte stale | CONFIRMED | `src/components/Sidebar.jsx` empty; `AdminLayout.jsx:3` resolves `./components/Sidebar` to admin one (302 lines) |
| Sidebar Overview/Products/Purchasing/Inventory/Pricing/Finance/Website/System items → routes + components | CONFIRMED | Each sidebar target matches a real App.jsx Route + existing page file (lines cited above) |
| /erp/picking and /erp/packing map to routes + components | CONFIRMED | Sidebar.jsx:63-64; App.jsx:238-253; PickingDashboard.jsx exists |
| `/admin/picking` and `/admin/packing` are NOT frontend routes | CONFIRMED | App.jsx path= extraction has no /admin/... route; only adminApi endpoint strings + import specifiers |
| Canonical admin prefix is root + /erp; no /admin URL prefix | CONFIRMED | App.jsx + Sidebar.jsx agree on /dashboard, /erp/* |
| /erp/returns is a dead link (no route, no component) | CONFIRMED | Sidebar.jsx:66; no Route; no page file; no catch-all → blank outlet |
| /notifications is a dead link; component lives at /erp/notifications | CONFIRMED | Sidebar.jsx:79; App.jsx:348-355 |
| Orphans: MovementsList, MovementSubPage, RecommendationsPage | CONFIRMED | Files exist, no import site, no route |
| AISettings/Announcements/HeroSlides/WelcomeSlides are NOT orphans (SiteConfig sub-tabs) | CONFIRMED | SiteConfig.jsx:12-15 imports, 81-84 renders |
| Routes exist with no sidebar link (supply-orders, notifications, sub-pages) | CONFIRMED | App.jsx:207, 349, plus sub-page routes — reached via Links, not sidebar |
| Every routed component has an existing page file | CONFIRMED | All lazy imports resolve via Glob; no missing file |

### B. Inventory / sales integrity (all CONFIRMED)

| Claim | Result | Evidence |
|---|---|---|
| Issue receipt is the authoritative deduction event; no other sales-stage writes | CONFIRMED | salesInventoryBridge.js:63-103 only `type='issue'`; orderWorkflowService:213-219 (confirm→reserve, shipped→release+issue); adminSaleService.js:31-34 |
| Picking performs zero inventory_movements writes | CONFIRMED | pickingPackingService.js:48-143 touches picking_tasks only; route same |
| Packing performs zero inventory_movements writes | CONFIRMED | pickingPackingService.js:149-226 touches packing_tasks only |
| No double-deduction path for same order/issue | CONFIRMED | orderAlreadyHas guard (salesInventoryBridge.js:41-48); mobileOrders.js:15-21; createIssueForOrder skips if issue_orders row exists (warehouseOrderService.js:399-402) |
| Every inventory_movements write site found + events mapped | CONFIRMED | inventoryService.js:117 (central), adminSaleService.js:32, salesInventoryBridge.js:75/119/153, warehouseOrderService.js:121/253/432/643/271, inventory.js:57, warehouses.js:349/361, purchaseOrders.js:321, mobileOrders.js:407, db.js:1091 (seed only) |
| Reservation touches only qty_reserved | CONFIRMED | inventoryService.js:72-73, 268-272, 108-114; replay excludes reservation (line 361) |
| Packaging consumption only at issue-order creation, not at pack status change | CONFIRMED | warehouseOrderService.js:427-446 (referenceType='issue_order'); packing updates never call createMovement |

### C. Idempotency / dedup

| Claim | Result | Evidence |
|---|---|---|
| Picking: picked_by/picked_at written once, preserved on retry | CONFIRMED | pickingPackingService.js:119-123 firstCompletion gate |
| Picking: duplicate audit events suppressed on retry | CONFIRMED | pickingPackingService.js:129-133 isCompletion gate |
| Issue receipt: issueForOrder cannot double-issue | CONFIRMED | salesInventoryBridge.js:41-47 + 64; all entry points pass through |
| Kashier webhook: same event never processed twice | CONFIRMED | deterministic eventKey; INSERT OR IGNORE on unique event_key (db.js:1283); route returns duplicate:true |
| Kashier status guards prevent double effects | CONFIRMED | issue only if pending/pending_approval (84-87); refund only if ≠ refunded (103-106); void only if not delivered/completed (113-116) |
| Mock payment provider dedups | REFUTED | mockPaymentProvider.js:28-31 logs + returns fixed success; no lookup/storage/key |
| Order creation is idempotent | REFUTED | orders.js:36-40 raw INSERT, no key/dedup; idempotencyService not registered for /api/orders |
| Global idempotency middleware registered | REFUTED | idempotencyService only used at routes/inventory.js:46 |

### D. Frontend separation / serving topology

| Claim | Result | Evidence |
|---|---|---|
| Customer app does NOT import admin code | REFUTED | AdminDashboard.jsx:1,4 imports `../admin/layouts/AdminLayout` + `../admin/services/api`; ProductForm.jsx:3 imports checkAdmin/getAdminProducts |
| Admin app does NOT import client code | CONFIRMED | No `client/` imports across client-admin/src |
| Server serves customer HTML in dev | REFUTED | index.js:181-183 guarded by `isProduction`; live 5172 root = "Cannot GET /" |
| Server serves customer HTML in production | CONFIRMED | index.js:10 clientDist; 311-318 SPA fallback always client/dist (never client-admin/dist) |
| client vite: port 5173, proxies to 5172 | CONFIRMED | client/vite.config.js:5-18 |
| client-admin vite: port 5174, proxies to 5172 | CONFIRMED | client-admin/vite.config.js:5-16 |
| client/src/admin/ legacy tree exists | CONFIRMED | 9+ files incl. AdminLayout, AdminAuthContext, services/api, AdminSale, InventoryPage, Login, OverviewPage, WarehousePage |
| Legacy admin subtree imported outside itself | CONFIRMED | AdminDashboard.jsx (1,4) |
| Server port is 5172 | CONFIRMED | server/index.js:23 |

---

## Sources of truth (primary files)

- Router: `client-admin/src/App.jsx`, `client/src/App.jsx`
- Sidebar: `client-admin/src/admin/components/Sidebar.jsx`
- API client: `client-admin/src/api/adminApi.js`
- Backend: `server/index.js`, `server/db.js` (schema + init), `server/schema.sql`, `server/migrations/004-007`
- Middleware: `server/middleware/rbac.js`, `adminAuth.js`, `csrf.js`, `sanitizeProducts.js`
- Services: `server/services/inventoryService.js`, `orderWorkflowService.js`, `warehouseOrderService.js`, `salesInventoryBridge.js`, `pickingPackingService.js`, `pricingService.js`, `priceListService.js`, `kashierService.js`, `kashierWebhookService.js`, `eventService.js`, `notificationService.js`, `permissionService.js`, `settingsService.js`
- Routes: `server/routes/admin.js`, `orders.js`, `warehouseOrders.js`, `customers.js`, `vipInvitations.js`, `products.js`, `purchaseOrders.js`, `suppliers.js`, `inventory.js`, `warehouses.js`, `pickingPacking.js`, `pricingManager.js`, `priceLists.js`, `kashierCheckout.js`, `kashierWebhook.js`, `notifications.js`, `users.js`, `events.js`, `integrations.js`, `settings.js`, `views.js`, `reports.js`
- Mobile: `mobile-app/`, `worker-app/` (Expo RN, JWT, base http://192.168.1.50:5172/api/v1)

---

## Addendum (2026-08-28) — Checkout blocker fixed + two new pre-existing bugs found

### Phase 1 outcome: Customer Checkout REPAIRED and proven E2E

The audit's top blocker (L1) is fixed and verified at runtime against the live server:

| Layer | Evidence |
|---|---|
| Order create | `POST /api/orders` 201 (order id), **retry same idempotency_key → 200 SAME order id** (no duplicate); different key → distinct order; missing fields → 400 |
| Session contract | `POST /api/kashier/checkout/session` with valid orderRef/total → 400 "Kashier is not configured" (contract accepted, order validated); nonexistent orderRef → "Order not found"; missing → "orderRef and total are required" |
| Webhook | signed `transaction-success` → 200 `received:true`; **same event re-sent → `duplicate:true`**; bad signature → 401 |
| Order state | order transitioned `pending → paid` exactly once, `payment_method=kashier-card`, `idempotency_key` stored |
| Inventory | exactly ONE authoritative `type=issue` movement created (qty −1, before=50 after=49) |
| Fulfillment handoff | auto Issue Order (`ISS-...`) created for the paid order |
| Regression | `/api/orders/statuses` 200, `/api/kashier/checkout/status` 200, `/api/products` 200, admin customers/inventory unauth → 401; customer (5173) + admin (5174) builds exit 0 |

### Two NEW pre-existing bugs found (not in the original audit)

1. **`orders.stripe_session_id` UNIQUE + `''` default → second non-Stripe order fails.** Every order without a real gateway session inserted `''` into a UNIQUE column; the 2nd such order 500'd with `UNIQUE constraint failed: orders.stripe_session_id`. Fixed by storing `null` (SQLite UNIQUE permits multiple NULLs). File: `server/routes/orders.js`.
2. **Webhook never deducted stock.** `kashierWebhookService.handleTransactionSuccess` did `SELECT status FROM orders` (never selected `items`) AND called `parseItems(order.items)` (passed the string, not the row, into a helper that reads `.items` off the row). Result: every webhook-paid order was marked `paid` but **never created an inventory movement nor the pick/pack Issue Order** — a silent, invisible gap. Confirmed via instrumentation (`norm: []`), then fixed (`SELECT id,status,items` + `parseItems(order)`). Files: `server/services/kashierWebhookService.js`.

### Changes
- `client/src/pages/CartPage.jsx` — createOrder → createKashierSession → redirect `pay_url`; deterministic idempotency key (cart+email+price-list hash)
- `server/routes/orders.js` — `idempotency_key` support (returns existing order on retry); kashier methods skip immediate issue (webhook is the authority); `stripe_session_id || null`
- `server/routes/kashierCheckout.js` — order-exists validation; `allowedMethods` forwarded (honors card vs wallet); `order_id` stored on `kashier_orders`
- `server/services/kashierWebhookService.js` — items shape fix (root cause #2)
- `server/db.js` — `orders.idempotency_key TEXT` column
- Evidence harness: `server/_checkout_e2e_full.js` (re-runnable)

Note: the only pre-existing product (`id=1`) is in the **trash**, so a fresh product was created via the admin API for the E2E — the trash guard correctly refuses inventory operations on trashed products.

### Phase 1.1 (2026-08-28) — DB migrations 004–007 applied

Audit finding D ("migrations not applied") is resolved. Applied additively with the backend stopped (no live-DB overwrite), backed up to `data/store.db.migrate-004-007.bak`, no reset:

- `orders.sales_channel` added (004)
- `order_items` extended to the 19-col design: `variant_id, sku, base_price, discount_type, discount_value, discount_amount, final_price, price_list_code, tax_rate, tax_amount, cost_snapshot, qty` (005 + explicit `qty` because 004's `CREATE TABLE IF NOT EXISTS` is a no-op on the existing legacy table); 3 legacy rows backfilled `base_price=final_price=price`, `qty=quantity` (count preserved)
- `vip_customer_policies`, `customer_invitation_links` created (005) — unblocks VIP discount application + invitation attribution (still needs the missing `customers.*` permission rows from RBAC section G)
- `cost_consumption` + indexes created (007) — FIFO COGS persistence foundation now exists
- `inventory_cost_layers` indexes ensured (006)
- Verified persistence across restart; checkout smoke test passes (order 201, idempotent retry 200 same id, session contract accepted); all apps healthy.

Migration harness kept: `server/_migrate_004_007.js` (idempotent, re-runnable).

### Phase 1.2 (2026-08-28) — Packing E2E (master prompt 14.7)

The audit's "Packing BLOCKED" is now closed to the master-prompt Definition of Done. Service + routes + UI existed but lacked the transition guard, true idempotency, print, and zero-emoji UI. Verified E2E (`server/_packing_e2e_service.js`):

- Ordered transition guard added (pending→in_progress→packed→completed; problem flow; `packed→problem` re-open allowed per existing test semantics); invalid transitions rejected
- True idempotency: `packed_by`/`packed_at` preserved on retry (packed→packed); re-pack after problem is a real transition
- Zero inventory movements from packing (VERIFIED — Issue Receipt remains the single authority)
- Packing-sheet print added: `printService.packingSheetHtml` + `GET /api/admin/view/packing/:orderId` (HTML with QR/barcode, 12.9 KB)
- Notifications proven (22 packing in-app rows), audit proven (5 `packing_status_changed` events per lifecycle)
- UI: PackingDashboard emoji → Lucide icons (zero-emoji rule), packing-sheet button, action buttons aligned with the transition map; admin build ✓
- 10/10 E2E assertions pass

Files: `server/services/pickingPackingService.js`, `server/services/printService.js`, `server/routes/views.js`, `client-admin/src/api/adminApi.js`, `client-admin/src/admin/pages/PackingDashboard.jsx`.

Note: `tests/pickingPacking.test.js` is stale (expects `listPickingTasks` as array; current code returns `{items,pagination}`) — pre-existing, not related to this change.
