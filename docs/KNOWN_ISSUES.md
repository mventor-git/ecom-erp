# Known Issues

## Resolved During Development

### 1. better-sqlite3 Native Module Compilation
- **Issue:** `better-sqlite3` requires native compilation tools (node-gyp, Python, C++ compiler) which were not available
- **Fix:** Migrated to `sql.js` — a pure JavaScript SQLite implementation with zero native dependencies
- **Status:** ✅ Resolved

### 2. better-sqlite3-session-store Package Version
- **Issue:** Specified version `^0.4.3` did not exist; latest was `0.1.0`
- **Fix:** Updated package.json to `^0.1.0`, then switched to `session-file-store` after switching to sql.js
- **Status:** ✅ Resolved

### 3. Unauthenticated Admin AI / Recommendations Routes
- **Issue:** `GET/POST /api/admin/ai/*` and `GET /api/admin/recommendations` (leaked wholesale costs) had no adminAuth/RBAC (found in 2026-09-07 discovery)
- **Fix:** mventor-ticket-068 — adminAuth on all 6 routes + settings.read/manage and reports.read; wiring locked by `adminAuthGaps.test`
- **Status:** ✅ Resolved

### 4. Mobile Cart-Price Bypass
- **Issue:** `mobileOrders` charged raw `products.price`, skipping overrides/list-discounts and accepting invalid lines
- **Fix:** mventor-ticket-067 — repricing via `orderPricing.resolveItem` (web P0.4 parity)
- **Status:** ✅ Resolved

## Open Issues (current, 2026-09-13)
- **Pre-091 slider-'paid' orders unjournaled (live data):** revenue reconciliation reports ~105,000 EGP-cents operationally settled with no posted journal — a TRUTH SURFACE, not corruption; each healable via `POST /orders/:id/settle` (book-only) once evidence is confirmed. Severity: medium (report accuracy until triaged). Owner decision queued (BACKLOG).
- **mobileApi cart integration flake (pre-existing, intermittent):** `PUT /cart/items/:id updates quantity` + `GET reflects totals` can 400 on `INSUFFICIENT_STOCK` when the products-listing pick (`stock > 0`, legacy `products.stock` vs movement-derived availability — competing-truth class) lands on a low-actual-stock product while the cart PUT path compares the other number. Reproduced identically on the STASHED BASELINE during 091 verification (not a 091 regression); passes every clean run (final: 107/107 exit 0). Workaround: rerun; fix slice: make the mobile listing + cart stock checks read ONE source. Related: mventor-ticket-091.
- **Tests mutate the live DB on default `npm test`** (self-cleaning fixtures; `test:isolated` snapshot is the CI-safe path) — documented trade-off (F12). Backup retention still unbounded; shared-DB parallel-worker ordering remains a known flake class.

## Resolved history
- **order_items schema fork** — resolved in F11 (0f57522): fresh CREATE reconciles mirror cols + indexes.
- **`categories.icon` / `products.deleted_at` fresh-boot forks** — resolved 4.19.0 / 4.21.0 respectively (CREATE now holds the column + idempotent probe; brand-new-file boot + full 091 service flow verified).
