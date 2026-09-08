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

## Open Issues (from 2026-09-07 full-repo discovery; each needs its own ticket)
- **order_items schema fork:** code writes legacy cols (product_name/quantity/price); migrations 004/005 expect (qty/base_price/final_price/cost_snapshot) → NULLs break COGS/profit reads. Needs schema-reconciliation ticket.
- **Tests mutate the live DB** (no isolation; mobileApi needs a running server) — parallel/CI unsafe. Needs test-isolation ticket.
- **Backup bloat:** `server/backups/` ~70MB, 106 files, no rotation; `server/data/*.bak*` growing. Needs retention ticket.
