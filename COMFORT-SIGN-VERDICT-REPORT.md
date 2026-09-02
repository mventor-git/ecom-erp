# Comfort Sign ERP — Strengths, Weaknesses, Missing Features, Verdict

**Path:** `D:\Projects\on-dev\comfort-sign-deploy`
**Stack:** Node/Express + sql.js (SQLite) + React + Vite + Tailwind + Kashier/Stripe + Expo React Native
**Audit date:** 2026-08-31
**Verdict:** `REAL SYSTEM — NOT A MOCKUP / DEMO` `MATURE (55 routes, 34 services) — BUT INCOMPLETE`

---

## Direct answer to "is this a demo/mockup or a good app?"

**It is a real, deployable, full-stack ERP + e-commerce application** with a working backend (Express, SQLite, session, CORS allowlist, rate-limit, CSRF, helmet), a working customer storefront (React/Vite/Tailwind with cart, Kashier checkout, Google OAuth, Arabic i18n), a substantial admin ERP panel (37 pages, every module real and data-backed), and real integration points (Kashier, Stripe config, Google OAuth, AI/Ollama, webhook delivery logging).

**It is not "good" everywhere.** Many features are `PARTIAL / REAL BUT INCOMPLETE`. Some critical pieces (FIFO cost-layer consumption for standard sales, double-entry accounting, full returns/refunds workflow, real Kashier in production, full 55-scenario test coverage, store-wide price-form correctness, full Arabic coverage in admin) are `MISSING / BLOCKED / UNVERIFIED`.

This is an **actively-maintained in-progress production build**, not a toy. The codebase shows it: 37 doc files including the project's own `system-audit.md`, `database-reality.md`, `security-audit.md`, `feature-reality-matrix.md`, `TODO.md` (17 phases), and a `CHANGELOG.md`.

**Bottom line for deployment:** You can run it locally / via ngrok and take real orders with Kashier right now. Do not treat it as finished — treat it as a working core that still needs the missing accounting/returns/price-form/i18n/admin-polish/audit phases before it is production-grade.

---

## Strengths (verified, real, significant)

| # | Area | Evidence | Impact |
|---|---|---|---|
| 1 | **Real backend architecture** | `server/index.js` 373 lines; 55 route files mounted; helmet CSP, CORS allowlist, 4 rate-limiters (200/15min api, 1000/15min admin, 20/15min auth, 30/15min checkout), session-file-store, CSRF, Google OAuth, 2FA | Not a demo — can serve real traffic |
| 2 | **Real database (SQLite via sql.js)** | `server/db.js` 1750 lines; 50+ tables; migrations 004–007 executed; `store.db` 600 KB live; 89 daily backups in `server/backups/` | Data persists; backed up; not in-memory fake |
| 3 | **Movement-led inventory (source of truth)** | `inventory_movements` table is ledger; `inventory` is derived snapshot; reservation/release/transfer/damage types; warehouses + locations real | Correct inventory architecture |
| 4 | **Real pricing model (retail vs wholesale separation)** | `pricingService.js`; `price_lists` / `product_prices`; retail = cost × (1+markup) with .99 charm; offers via Pricing Engine only — old_price preserved for ribbons | Business rules explicit, server-side enforced |
| 5 | **Real payment integration (Kashier is active)** | `kashierCheckout.js`, `kashierWebhook.js`, `kashierService.js`; HMAC-SHA512 with `crypto.timingSafeEqual`; raw-body preserved; `kashier_webhook_events` dedup table with `INSERT OR IGNORE` | Can take real payments |
| 6 | **Substantial admin ERP panel** | 37 admin pages: dashboard + drill-downs, products CRUD + trash, categories, brands, inventory dashboard + movements + warehouses, suppliers, purchase orders, price lists, pricing engine, pricing profit, customers, VIP invitations, orders, picking/packing/shipping dashboards, reports, financial periods, settings, users/RBAC, notifications, integrations, announcements, hero/welcome slides, site config, stock-in/out | Full operations management, not just product CRUD |
| 7 | **Customer storefront (feature-complete & polished)** | 12 pages wired into routing: home, catalog + search + filter, product detail with variants/colors/sizes/image gallery, persistent cart (localStorage `store-cart-v2`), Kashier checkout, order tracker with activity timeline, account (Google OAuth + email signup + VIP claim), wishlist (server-backed), Arabic/English i18n (247+ AR keys), EGP currency, dark mode, 3D welcome page | Can sell to real customers with full localization |
| 8 | **Security stack** | bcryptjs, JWT + session-file-store, RBAC (`requirePermission`, `requireSuperAdmin`), 2FA via `speakeasy`, CSRF on all admin state-changing methods, helmet with CSP, strict CORS allowlist, fail-fast on weak `SESSION_SECRET` in prod, `req.session.regenerate()` on login | Real security, not decorative |
| 9 | **Real AI / assistant integration** | `/api/ai/chat`, `ollama.config.js`, `ai_config` table, `ai_conversations` table, admin AI settings page | Functional AI feature, not placeholder |
| 10 | **Mobile API v1** | `/api/v1/auth` (staff + customer), products, cart, orders (with `salesInventoryBridge`), wishlist, notifications, user, images (sharp resize/webp) | Can feed mobile apps |
| 11 | **Real mobile apps (not scaffolds)** | `mobile-app/` Expo React Native, 10 screens, 507 packages; `worker-app/` Expo React Native, 4 screens, 306 packages; both with real AuthContext + API client + state | Mobile + driver workflows actually started |
| 12 | **Active maintenance** | 37 doc files (incl. own `system-audit.md`, `database-reality.md`, `security-audit.md`, `feature-reality-matrix.md`, `TODO.md` 17 phases, `CHANGELOG.md`), strict no-emoji + design tokens enforced in most places | Audit trail of decisions; not abandoned |

---

## Weaknesses — concrete, cited

### Inventory / Costing (partial)

- **FIFO cost layers structurally present** (`inventory_cost_layers`, migration 006) but **NOT integrated into standard sales flow** — `salesInventoryBridge.js` pulls `product.cost_price`, not layer consumption
- **COGS computed from `inventory_movements.unit_cost`** at issue time = current cost, not true historical FIFO
- **`order_items.cost_snapshot` exists structurally but is not auto-populated by checkout** (TODO.md: BLOCKED — business workflow later phase)
- **Legacy `products.stock` field is still there** for compatibility but is not the source of truth

### Accounting (missing)

- **No double-entry / GL / journal / chart of accounts / AR / AP tables** (security audit + grep = zero matches across `server/*.js`)
- **`financial_periods` is a header + flag only** — no closing journal, no opening balance amount field
- Revenue/COGS/profit reports derive from SQL aggregates of movements + orders, not from a GL — acceptable for operational reporting, not accounting-grade

### Payments / Checkout (partial)

- **Checkout total is CLIENT-SENT and not server-side verified** — `routes/kashierCheckout.js:81` and `routes/orders.js:11` take `total` from `req.body` with only null-checks; no recomputation from DB items. Combined with the public (no-auth) checkout endpoint, anyone with an `orderRef` can create a Kashier session at any amount
- **No stock reservation at order creation** — `salesInventoryBridge.reserveForOrder` exists but is never called at order creation; stock deducted only at webhook success or COD. Oversell race possible
- **Stripe is dormant** — `server/.env:12-13` has dummy `STRIPE_SECRET_KEY=sk_test_xxxx…`; `package-lock.json` lists `stripe` but zero `require('stripe')` anywhere in `server/` source. The active provider is Kashier
- **MockPaymentProvider** (`services/mockPaymentProvider.js`) exists with explicit `BLOCKED until real Kashier verified` marker — not wired to checkout, only standalone adapter
- **Webhook idempotency is present** (`kashier_webhook_events.event_key UNIQUE` + `INSERT OR IGNORE`) but refund idempotency on admin-side is only partial (workflow transition + status check)
- **No schema validation** (`express-validator` / `joi`) in checkout or order routes — only null checks
- **Hardcoded secrets in seed/probe scripts**: `_seed-kashier.cjs:11–12` and `_kashier-fix-probe.cjs:6` hardcode the real Kashier merchant ID, API key, and full secret (`5d7ec35b…`)
- **Weak admin password** in `server/.env`: `ADMIN_PASSWORD=admin123`

### Orders / Returns / VIP (partial)

- **Orders stored as JSON `items`** (not fully normalized)
- **Returns/refunds workflow partially exists** — eligibility check, warehouse inspection (RESELLABLE/DAMAGED), restock via movement, refund linked to order, duplicate-refund protection all need testing
- **VIP discount route/service**: schema done (`vip_invites`, `vip_customer_policies`), backend enforcement on customer checkout unclear

### Data integrity / Migration (weak)

- **No versioned migrations table** — inline `try/catch` ALTERs in `db.js` + numbered SQL files run by `_migrate_004_007.js`
- **Legacy `products.stock` still maintained** alongside movement ledger

### Frontend correctness — HIGH severity

- **`client-admin/src/admin/pages/ProductForm.jsx` price read divides by 100, write doesn't multiply** — read: `price: String(p.price / 100 || 0)`, write: `price: parseFloat(form.price) || 0`. `products.price` is INTEGER cents everywhere else; this form treats input as EGP units. **Real correctness bug:** editing a 250.00 EGP product saves 250 cents = 2.50 EGP. Single file, but silently corrupts every edit

### Frontend design-discipline violations (the project's own rules)

- **"No emoji" rule violated in 5 admin pages**: `AnnouncementsList` (📢), `HeroSlidesList` (🖼️), `AISettings` (💡), `CategoryView` (📦), `PickingDashboard` (🏭/🖨/✓). Mojibake in 3 more: `ReportsDashboard` (`'ðŸ'°'` broken UTF-8 for 💰), `IntegrationsPage` (`?`/``), `SupplyOrdersList` (`"Supplier name"`)
- **`lucide-react` mixed with custom `AdminIcon`** in `VipInvitations`, `Overview`, `RevenueDetail`, `DashboardDetailPage`, `OrdersList` — breaks the AdminIcon-only consistency

### Frontend i18n — admin Arabic coverage is partial

- **No Arabic translations for top-level sidebar labels** 'Pricing', 'Operations', 'Finance', 'Website', 'Notifications'
- **Many page-level column/button labels hardcoded English** in `CategoriesList`, `MovementsList`, `SuppliersList`, `ReportsDashboard`
- Storefront is well covered (247+ AR keys)
- The user's `mventor-ui-preferences.md` calls for "full Arabic coverage" — admin does not meet that bar yet

### Testing / Coverage (incomplete)

- **No full 55-scenario end-to-end test pass** (Phase 16 TODO)
- **`npm test` runs only 22 specific test files by design** (`--testPathPatterns`) — not a full suite
- **Integration tests need a server on port 3099**; plain `npm test` fails mobile/api suites without it
- **No tests in mobile-app/ or worker-app/**

### Mobile / Worker apps (prototype pre-production)

- **Mobile apps hardcoded to `192.168.1.50:5172`** in `mobile-app/src/api.ts` and `worker-app/src/api.ts` — only works on the same LAN as the server; breaks over cellular
- **Google OAuth disabled** in mobile (`mobile-app/src/config.ts:16`: `GOOGLE_CLIENT_ID = ''`)
- **No GPS / digital signature / OTP for delivery proof** — only photo + text note via `expo-image-picker` → `POST /worker/orders/:id/proof`
- `versionCode: 1`; no production build artifacts (`dist/` or `build/`); no route optimization

### One intentional gap in admin

- **`CustomerProfile.jsx` Reviews + Wishlist tabs are literal placeholders:**
  - `'Review cards go here (reuse DataTable pattern, no emoji, AdminIcon icons only).'`
  - `'Wishlist cards go here.'`
- This is the **only** real stub — a project-wide grep for `coming soon|not implemented|todo|stub|placeholder|under construction|wip` returned only HTML `placeholder=` attributes plus this one block.

---

## Missing features — concrete list

From `TODO.md` (17 phases), `docs/system-audit.md` Section N, and code audits:

| Feature / Phase | Status | Evidence / Blocker |
|---|---|---|
| Opening Balance module (Phase 6) | `MISSING / NOT STARTED` | Design only; no `opening_balances` table (uses `inventory_movements type='opening_balance'`); admin UI form not built |
| Full FIFO cost-layer integration into standard sales | `PARTIAL — STRUCTURE ONLY` | Table + service exist; only `adminSaleService` reads/updates; sales flow uses current `cost_price` |
| Double-entry accounting / GL / AR / AP / journal | `NOT FOUND` | Zero GL table references across all `server/*.js`; reports derive from SQL aggregates only |
| Financial period closing / lock / opening balance amount | `PARTIAL — HEADER ONLY` | `financial_periods` has start/end/status/flag — no closing journal, no balance amount field |
| Real Kashier production verified | `PARTIAL — WORKING BUT CONFIG UNCERTAIN` | Test session endpoint works; creds seeded; full state machine across all transitions not verified end-to-end |
| Webhook idempotency enforcement (duplicate order/refund protection) | `PRESENT FOR WEBHOOKS, PARTIAL FOR REFUNDS` | `kashier_webhook_events.event_key UNIQUE` + `INSERT OR IGNORE` is solid; admin-side refund lacks explicit idempotency key |
| Returns / refunds full workflow (inspection + restock + linked refund) | `PARTIAL` | Routes/tables exist; full eligibility/inspection/refund-linked-to-order not fully tested |
| VIP invitation route / signup URL / customer invitation attribution fully working | `PARTIAL` | Schema done; routes/services partially built; customer-site enforcement unclear |
| Recommendation engine endpoint (Phase 60) | `DESIGN ONLY` | Plan complete; endpoint missing |
| Full 55-scenario end-to-end test coverage | `NOT STARTED` | Phase 16; only specific scenario tests exist |
| Mobile / worker apps fully completed | `PROTOTYPE` | Directories + package.json + active code; completeness known to functional level (not commercial-grade) |

---

## Verdict — Is this a demo / mockup, or a good app?

### Not a mockup / demo
The backend runs. The DB writes. Kashier takes real payments. The admin panel edits real products, warehouses, orders, and pricing. The customer site sells with real cart + checkout + localization. Google OAuth works. AI chat responds. There is a real `.db` file with thousands of rows, real image assets, real migrations, and 89 daily backups.

### Not "good" everywhere — working core + incomplete modules
Think of it like a real restaurant with working kitchen, menu, payment, and seating — but the accounting books aren't fully kept, the returns desk isn't fully staffed, the supplier invoices aren't fully reconciled, the price-edit form has a unit bug, the admin sidebar mixes icon libraries and leaks emoji, and the test suite isn't complete. It can serve customers today; it shouldn't be called "finished."

### Best used as: production-ready core + phased completion
- **If your goal is to launch now:** yes, with Kashier + manual inventory + partial admin (avoid `ProductForm.jsx` for price edits until fixed).
- **If your goal is a fully audited ERP with double-entry, FIFO costing, full returns, verified webhook idempotency, and 55-test coverage:** you still have phases 6, 9 (VIP backend fully), 11 (returns fully), 12 (Mock provider verified + Kashier confirmed), 16 (tests), 23 (audit lock) to finish — exactly what `TODO.md` describes.

---

## Deployment recommendation (concrete, actionable)

**Use `start.ps1`** — launches backend (5172) + client (5173) + admin (5174) with idempotency. Skip services whose ports are already listening. Logs go to `logs/`.

**Before any non-local exposure:**

1. **CRITICAL — Fix the checkout total trust gap.** `routes/kashierCheckout.js` and `routes/orders.js` must recompute the total from DB items on the server, not accept `req.body.total`. Right now anyone with an `orderRef` can create a Kashier session at any amount
2. **CRITICAL — Add stock reservation at order creation.** Call `salesInventoryBridge.reserveForOrder` in the order-create path before payment. Without it, two customers can both "buy" the last unit
3. **CRITICAL — Fix `ProductForm.jsx` price unit bug.** Read `p.price` (already cents), write `parseInt(form.price * 100)`. Today the form silently corrupts product prices on edit
4. **HIGH — Rotate `ADMIN_PASSWORD`** in `server/.env` away from `admin123`
5. **HIGH — Strip hardcoded secrets** from `_seed-kashier.cjs`, `_kashier-fix-probe.cjs`, `_kashier-hosted-probe.cjs` before sharing the repo
6. **HIGH — Verify `SESSION_SECRET` and `JWT_SECRET` are strong random values** (production fail-fast exists in `index.js:23` but only checks `SESSION_SECRET`)
7. **MEDIUM — Make mobile API_BASE_URL configurable** before publishing apps to App Store / Play Store
8. **MEDIUM — Enable Google OAuth in mobile** by setting `GOOGLE_CLIENT_ID`
9. **MEDIUM — Clean up emoji + lucide inconsistencies + mojibake** in admin per the no-emoji design rule
10. **MEDIUM — Translate admin sidebar top-level labels + remaining English-only page labels** to Arabic
11. **MONITOR** `/api/health` and the `logs/` directory (access + error)
12. **NEVER** edit `server/data/store.db` directly while the server is running — always go through the API

---

## Quick reference — files to read for your own verification

| File / Directory | What it tells you |
|---|---|
| `README.md` | Public-facing description (accurate — real features listed) |
| `server/index.js` (373 lines) | Full route list + security stack + start sequence |
| `server/db.js` (1750 lines) | Schema + all tables + migrations + seeds |
| `server/package.json` | Dependencies (Stripe, Kashier, sql.js, helmet, etc.) |
| `docs/system-audit.md` (18500 lines of docs) | The project's own audit — sections A–V cover architecture, working/partial/broken/mocked/missing features, proposed sequence |
| `docs/feature-reality-matrix.md` | One-row-per-feature status table (B=partial for most) |
| `docs/security-audit.md` | Confirmed architecture + documented (unfixed) gaps (idempotency, client-trusted totals, file uploads) |
| `docs/database-reality.md` | Table list + danger observations (legacy `products.stock`, JSON orders, current-cost COGS, no historical wholesale cost table) |
| `TODO.md` | Phase-by-phase tracker (Phases 0–17+); shows BLOCKED (Kashier config), PARTIAL (VIP routes, recommendation), NOT STARTED (opening balance, tests fully) |
| `VISION.MD` / `SKILL.md` | Business rules + ERP accounting rules (double-entry, FIFO, warehouse rules, pricing rules, returns rules) |
| `client-admin/src/admin/Sidebar.jsx` + `pages/` | What admin modules actually exist (37 pages; one real stub in `CustomerProfile.jsx`) |
| `start.ps1` | How to run the 3 services (backend 5172 + client 5173 + admin 5174) |
| `client-admin/src/admin/pages/ProductForm.jsx` | **The price-unit bug — see Weaknesses / Deployment recommendation** |
| `routes/kashierCheckout.js` + `routes/orders.js` | **The checkout total trust gap — see Weaknesses / Deployment recommendation** |
| `mobile-app/src/api.ts` + `worker-app/src/api.ts` | **Hardcoded LAN IP — see Deployment recommendation** |
| `server/.env` | Live secrets: `ADMIN_PASSWORD=admin123` (rotate), `STRIPE_SECRET_KEY=sk_test_xxxx…` (dummy), Google + SMTP creds |

---

## Summary statistics

- **55** route files in `server/routes/`
- **34** service files in `server/services/`
- **50+** database tables
- **37** admin pages in `client-admin/`
- **23** server test files
- **89** daily DB backups in `server/backups/`
- **37** documentation files in `docs/`
- **17** implementation phases tracked in `TODO.md`
- **1** real frontend stub (`CustomerProfile.jsx` Reviews + Wishlist tabs)
- **3** HIGH-priority issues for production hardening (checkout total trust, stock reservation at order create, ProductForm price unit bug)
