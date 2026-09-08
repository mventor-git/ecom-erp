# Changelog

## [4.15.21] - 2026-09-07 - mventor-ticket-078: Publish to GitHub (Completed)
### Changed
- Remote was untouched all session — published now: `4922243` archive renames + stop-tracking tickets/scratch; `7e53caa` session work 057–077 (146 files); `813bcc9` root-purge completion (14 files, grep-verified unreferenced). Fast-forward only, secrets verified absent, tree clean.
### Verification
- `origin/master` 6ac0c01 → 813bcc9; `git status` empty; secret scan clean.
### Changed
- NEW `journal_entries` + `journal_lines` (IF NOT EXISTS, cents, entry_no UNIQUE, draft-only — no post path until D); JE numbering via house sequences (`JE` type + seed); NEW `journalService` (balanced/no-D+C/no-negatives/≥2 lines/valid+active accounts, entry_no immutable, txn-wrapped); NEW `journalFoundation.test` 6/6 incl. 075-guard activation proof.
### Verification
- `npm test` 32/179 PASS; residue probe 0+0; admin build clean ~8-9s.
### Changed
- NEW `deps/` (SmartAccounting reference @e0ae8a4, launchers/notes/.git stripped, no-import policy + README); README structure aligned. Verified pre-existing: tickets gitignored, zero .bat, root/docs clean, archive kept (old refs intact).
### Verification
- File checks green; single copy; no code/DB/servers touched (no suite run needed).
### Changed
- NEW neutral `accounts` table (IF NOT EXISTS, reset-safe) + `accountService` (typed CRUD, dup-code + delete-if-referenced guards) + `chartOfAccounts.test` 5/5. No journals/UI/seeds/permissions.
### Verification
- `npm test` 31/173 PASS; residue probe 0; admin build clean 8.81s.
### Changed
- NEW `docs/accounting-gap-map.md` (concept map + 15 posting flows + money model + invariants + owner decisions + Ticket B recommendation); ADR-014 (posted-journal truth, cents kept, reference-use policy). Zero code/schema/behavior change.
### Verification
- Traceability spot-checks green (no journal/CoA/AR/AP/budget/recon tables; no reopen; periods unenforced; idempotency reusable). Suite baseline 30/168 untouched.
### Changed
- Same 072 pattern on COD creation, Kashier paid webhook (inside atomic txn), shipped transition, onbill-accept; NEW `webCostThreading.test` 2/2 (COD e2e + paid+snapshot). Reserve paths correctly untouched.
### Verification
- `npm test` 30/168 PASS; focus 4/15 PASS; admin build clean 9.03s.
### Changed
- Bridge returns per-line unit COGS (`costs`, additive); mobile checkout snapshots them into lines (unknown-only, best-effort, logged); NEW `bridgeLineCosts.test` 3/3 with layer-proof fixture.
### Verification
- `npm test` 29/166 PASS; admin build clean 9.45s.
### Changed
- NEW `orderLines` single builder (pure mapping + loud inserts); web checkout mirrors authoritative JSON into rows; backfilled 6/20 history orders (3 deleted-product + 11 empty-JSON honestly remain bare); NEW `orderLines.test` 4/4.
### Verification
- `npm test` 28/163 PASS; focus 5/25 incl. phase4_1 9/9; admin build clean.
### Changed
- Identity quartet → Site Config only (Settings General hides 3 keys + links out); storefront list → Pricing Engine only (PriceLists read-only + links out); stale pricing claim removed from SiteConfig docs. No value/behavior change.
### Verification
- Admin build clean; `npm test` 27/159 PASS; manual click-path checklist for owner.
### Changed
- Writers mirror qty/base_price/final_price (same facts, both names); admin lines carry real FIFO unit cost_snapshot; 14 live rows backfilled (backup bak-069, cost history honestly unknown); NEW `orderItemsContract.test` 2/2; design doc marked with reality status.
### Verification
- `npm test` 27/159 PASS (npm exit 1 = pre-existing async-log noise, all suites PASS); focus 5/24 incl. phase4_1 9/9; admin build clean 7.85s.
### Changed
- `adminAuth` on all `/api/admin/ai/*` (5) + `/api/admin/recommendations` (1, leaked costs); settings.read/manage + reports.read per convention; NEW `adminAuthGaps.test` 4/4 wiring locks. Public `/api/ai` untouched.
### Verification
- `npm test` 26/157 PASS; admin build clean ~8.7s.
### Changed
- Mobile `POST /api/v1/orders` reprices each cart line via `orderPricing.resolveItem` (web P0.4 parity); invalid lines 400 INVALID_ITEM. Stock/shipping/order-shape/bridge untouched. NEW `mobileCheckoutPricing.test` 5/5.
### Verification
- `npm test` 25/153 PASS; focus 4/20 PASS; admin build clean 8.27s.
### Changed
- All order-creation INSERTs (web, mobile orders + lines, admin tmp + lines) write validated `price_list_code`; NEW `orderSnapshot.test` 3/3. Zero behavior change at storefront=retail. Full-repo discovery: 5-surface atlas via subagents; findings filed in KNOWN_ISSUES (no unrelated fixes).
### Verification
- `npm test` 24/148 PASS; focus 6/32 PASS; admin build clean 22.71s.
### Changed
- `wholesale`/`semi_wholesale` legacy-inactive everywhere agreeing: seeds insert-if-missing inactive, `priceLists.test` seeded-contract (active = retail+offer; discount/override via offer, leak-proof finally), live DB deactivated (zero-use verified, backup `store.db.bak-065`), PriceLists subtitle + pricing-reality.md honest.
### Verification
- `npm test` 23/145 PASS; focus 7/51 PASS; admin build clean 9.41s.
### Changed
- NEW `GET /admin/price-lists/usage` (overrides/orders/lines/sale_refs/storefront per list); `deletePriceList` blocked when default/storefront/in-use with clear errors; PriceLists UI shows usage + guarded Delete + honest confirm; NEW `priceListsGuards.test` 5/5.
- Deactivation ATTEMPTED then REVERTED same day (broke seeded-lists contract; would drift fresh-seed vs migrated DB) — lists ACTIVE, backup `store.db.bak-064` kept, follow-ups filed in ticket.
### Verification
- `npm test` 23/145 PASS; focus priceLists 7/7 + guards 5/5 + canonical 10/10; admin build clean 14.47s.

## [4.15.6] - 2026-09-07 - mventor-ticket-057: Pricing Engine canonical (Completed)
### Changed
- Follow-up (owner-confirmed): layer-unified cost basis (layers else cost_price, explicit source) + VIP % off retail preview (display-only) + PricingEngine honest Cost→Retail→VIP table + missing-pricing guard. `npm test` 22/140, pricing 6/46, admin 13.94s clean.
- Pricing preview/apply now drive single `pricingService.computeRetailPreview` (markup/margin/match/offer verbatim, no behavior change); dead broken `tierDiscount` removed; NEW `pricingEngineCanonical.test` 8/8; `npm test` fixed (`paymob.test` missing → canonical).
### Verification
- `npm test` 22/138 PASS; pricing focus 6/44 PASS; admin build clean 30.71s.
### Deferred (needs owner rule, never invented)
- VIP derivation, layer-basis unification, PricingEngine.jsx labels → follow-up.

## [4.15.5] - 2026-09-02 - mventor-ticket-056: Fulfillment UI Consolidation

### Added / Fixed
- **StatusBadge unified (P1 3-way divergence resolved):** shared `StatusBadge.jsx` extended to **48 status keys** (order lifecycle + picking/packing + shipping). `PackingDashboard` (local `statusBadge` fn + `STATUS_STYLE`/`STATUS_DOTS`) and `ShippingDashboard` (own `STATUS_STYLE`) now BOTH render the shared `<StatusBadge>` — one vocabulary.
- **`window.confirm` removed:** ShippingDashboard delete-provider → `ConfirmDialog`. **`console.error`-only swallow → user-facing `error` state** (both dashboards).
- **Encoding/quality:** `PackingDashboard` mojibake (`��`/`�?"`/`Assign to�?�`) eliminated; ASCII `→` and `—`.
- **Domain note:** WAREHOUSE ISSUE (`issue_orders`) kept separate from CUSTOMER FULFILLMENT (`picking/packing`) — not merged. Picking/packing remain zero-inventory (preserved).

### Verification
- `npm test` **21/130 PASS** (pickingPacking downstream + shipping + workflow in suite, 6 `ready_for_shipping` refs) · admin build **10.49s** · `window.confirm(` **0** · `console.error` **0** · mojibake **0** · `<StatusBadge` **1 each**.
- Honest: pipeline (packed→ready_for_shipping→shipped) already wired — verified, not rebuilt. Packing-sheet print already existed (`views.js:156`). `en-GB` locale + icon-consistency (lucide vs AdminIcon) intentionally left as separate P1 — not scope-creeped.

## [4.15.4] - 2026-09-02 - mventor-ticket-055: Financial Periods (Honest Timeline)

### Added / Fixed
- **Data-authority fix (real):** Opening-balance "Fill from stock" read the LEGACY `products.stock` via `getAdminProducts` (violates handoff P0/DATA — inventory = ledger). Now uses `getInventorySummary()` canonical `qty_on_hand`; OB row shows read-only `on-hand` per product.
- **Design/UX:** `window.confirm('Close this period...')` → reuse `ConfirmDialog`; StatCards (Total/Open/Closed); status badges (`OPEN` green / `CLOSED` gray) + `closed_at` column; `loadAll` now surfaces `error` banner (not `console.error`-only); honest disclaimer (period management only — no GL/journal/lock).
- **Backend proof (NEW):** `tests/financialPeriod.test.js` 4/4 — create=OPEN; `setOpeningBalance` posts a REAL `opening_balance` inventory movement + reconciles `qty_on_hand` to the count; close=CLOSED+`closed_at` + blocks OB on closed; empty items throws. Added to `npm test`.

### Verification
- `npm test` **21/130 PASS** (added financialPeriod) · admin build **9.32s** · dist grep FOUND "Fill from ledger stock"/"Period management"/"ConfirmDialog" · `window.confirm(` **0** · `products.stock` **0**.

### Notes
- Honest: opening balance is a stock-count ledger movement, NOT a journal entry. No GL / AR / AP / accounting lock — out of scope by design (handoff §14). No fake accounting.

## [4.15.3] - 2026-09-02 - mventor-ticket-054: Report Center — Reports Architecture/UI Redesign

### Added / Fixed
- **RBAC gap closed (real):** `GET /api/admin/reports` (list) + `GET /:reportType` + `GET /:reportType/export` were `adminAuth`-only → now `requirePermission('reports.read')`, matching `sales-daily/files/pdf/md`.
- **Frontend wrapper bug fixed (real):** `ReportsDashboard` stored the `{report_type,label,data}` wrapper from `getReport`; `Array.isArray` was false → always 0 results. Now unwraps `wrapper.data` (array fallback).
- **Report Center redesign:** category sidebar (All/Inventory/Sales & Profit/Purchasing) + searchable report grid; unified filter bar with date presets (All/Today/7d/30d/This month/Custom) + From/To + category + warehouse; per-report header (label/description/generated_at); StatCards (Results/Total Value/Generated); DataTable sortable + sticky + maxHeight; honest empty/error/loading states; CSV/PDF/MD exports + generated-files download.

### Verification
- `npm test` **20/126 PASS** (profitReports 5/5 inside) · `node --check reports.js` OK · admin build 9.29s→9.75s (ReportsDashboard 19.58KB) · dist grep FOUND "Report Center"/"Preset"/"StatCard" · `bg-primary-600` 4 (not 76) · `window.confirm` 0.
- Honest: `profit_report` still operational (revenue vs `products.cost_price`) — FIFO P&L gap documented, NOT faked. Live CDP screenshot deferred (CLI-safety: no long-running servers).

### Notes
- Out of scope (separate tickets): Financial Periods, Packing, Pricing Engine, Price Lists, Settings IA, GL/journal.

## [4.15.2] - 2026-09-02 - mventor-ticket-053: PO UI Closure — Approval/Rejection with Reason + Audit

### Added / Fixed
- **Admin API:** `updatePurchaseOrderStatus(id, status, reject_reason)` now forwards `reject_reason` when present; backward-compatible (existing callers unaffected).
- **PurchaseOrdersList UI:** `sent → cancelled` now opens a dedicated **RejectDialog** (textarea, required, 300 char limit, counter, inline error, disabled Confirm until non-empty). Generic `cancel` (e.g. `draft → cancelled`) still uses the single `ConfirmDialog` (no reason required) — state-aware branching.
- **Detail audit box:** surfaces `created_by/created_at`, `ordered_at` (sent), `approved_by/approved_at` (confirmed), `received_at`, and a red `rejected_by/rejected_at + reject_reason` card when rejected.
- **UX:** state-aware buttons via `getNextStatus` map + `isRejectFromSent` branching; `Approve` label (was `Confirm`); `actionLoading` disables all buttons + shows `...`; `successMsg` green toast (3s) + `error` red banner; 400 `rejection reason required` surfaces inline in the reject dialog (keeps open).

### Verification
- `tests/purchaseOrder.test.js` **3/3** (approve actor/no-stock; reject-reason required+stored; PO≠receiving) — inventory invariant holds.
- `npm test` **20/126 PASS** (no regression) · `vite build` admin 9.51s + client 12.18s · `window.confirm` 0 in changed files · dist grep FOUND Rejection/approved_by.

### Notes
- Backend already correct (Batch 10): `approved_by/approved_at` on `sent→confirmed`, `reject_reason/rejected_by/rejected_at` on `sent→cancelled` + actor from session + `PO_*` events + `purchase_orders.update` RBAC + notifications. This ticket closes the remaining **reject-reason prompt UI** explicitly listed as OPEN in `PRODUCTION-HARDENING-CHANGELOG` Batch 10 Remaining.
- Inventory guarantee: PO create / `sent` / `confirmed` / `cancelled` never touch `inventory`/`inventory_movements`; only `POST /receive` (supply workflow) does.

## [4.15.1] - 2026-08-25 - Hotfix: DB init crash + launcher replacement

### Fixed
- **db.js**: ticket-051 index block ran BEFORE the tables it indexes existed
  (`inventory_movements` created at line ~634, indexed at line ~383) — crashed
  backend boot with `no such table: main.inventory_movements` on DBs lacking
  that table. Index block moved after all CREATE TABLE statements.

### Changed
- Removed `start.py` / `start.exe` (PyQt6 control center). Replaced by
  `start.ps1` (idempotent: skips services whose port is already listening;
  same logs/ output files).
- `server/.env`: ADMIN_PASSWORD set to `********` (local dev credential,
  username `admin`). Weak password — rotate before any public deployment.

## [4.15.0] - 2026-08-23 - Tickets 053-061: Kashier Gateway + VIP Program + Fulfillment Pipeline

### Added
- **Kashier gateway** replaces Paymob: Payment Sessions API (hosted checkout),
  config card in Integrations with key Verify button + webhook setup guide,
  configurable base URL (test/live hosts).
- **VIP program**: invitations (unique codes + printable RTL Arabic QR card),
  Google sign-in claim (single-use), customers.vip flag, staff-managed VIP cart,
  on-bill checkout (pending_approval ? admin accept/decline), temp issues.
- **Fulfillment pipeline** on issue orders: issued ? packed ? claimed/assigned ?
  sent (driver or external provider) ? delivering ? delivered; driver email/SMS/
  in-app notifications; admin driver assignment.
- **Movement receipts**: every movement auto-generates a QR receipt document +
  notifies inventory staff; PDF endpoint GET /api/admin/inventory/:id/receipt.pdf.
- **Pricing Manager backend**: preview/apply markup over wholesale cost.
- **Paymob removal**: all paymob routes/services/settings seeds removed.

### Fixed
- Demo-review seeder crashed boot on empty catalog (FK constraint).
- Reservation semantics double-count bug; replay excludes reservation/release.
- reports.view permission typo ? reports.read; CSP img-src for external images;
  Navbar missing useSiteIdentity import crash.

### Validation
- Server suite: **17 suites / 124 tests GREEN** � both clients build clean.

---

## [4.14.0] - 2026-08-23 - mventor-ticket-052: Dashboard Redesign (Clinical Teal UI + Charts)

### Added
- Formal design system: custom Clinical Teal primary + warm stone neutrals (global palette
  swap via tailwind config); shadcn-style UI kit (Card/Badge/Select/Skeleton); lucide-react icons.
- Dashboard rebuilt: KPI cards, animated Revenue/Orders trend chart with in-card metric+range
  controls, animated status donut, recent orders, quick actions.
- NEW Revenue detail page (/dashboard-detail/revenue): same animated chart + totals + daily table.
- NEW backend endpoint /api/admin/reports/sales-daily (zero-filled daily series).

### Fixed
- reports.js permission 'reports.view' ? 'reports.read' (was unseeded; locked staff roles out).

---

## [4.13.0] - 2026-08-23 - mventor-ticket-051: Elevated Silent Control Dashboard + Fresh Reset

### Changed
- `start.bat` rewritten as an elevated CLI dashboard: Start All / Stop All / Restart All /
  Status / Open Logs. Services launch HIDDEN (no popup terminals) with logs in `logs\`;
  stopping kills port owners (5172/5173/5174) reliably under elevation.

### Fixed
- Demo-review seeder crashed boot (`FOREIGN KEY constraint failed`) on an empty catalog after
  the fresh reset; now requires existing products and skips missing ids.

### Operations
- Full data reset performed by owner (0 products/categories/orders/customers/stock).
  Pre-reset backup: `server/data/backups/store-PRE-RESET-20260823-153037.db`.

---

## [4.12.0] - 2026-08-22 - mventor-ticket-048/049/050: Critical ERP Fixes (investigation closed)

### Added (048 � Sales ? Inventory Bridge)
- NEW `salesInventoryBridge` service: orders now RESERVE stock on confirmation,
  RELEASE+ISSUE on shipping, RELEASE on cancel/refund � idempotent per order.
- Web Stripe paid webhook + web COD + mobile checkout all flow through the
  movement engine (raw `products.stock` UPDATEs removed).
- Reservation semantics fixed: reserved bucket moves, on-hand untouched
  (double-count bug); replay excludes reservation/release.

### Fixed (049 � RBAC Enforcement)
- 37 routes across 9 ERP routers (warehouses, inventory, purchase orders,
  suppliers, settings, document numbers, invoices, integrations, events) now
  enforce role permissions; env-bootstrap admin bypasses as super admin.

### Fixed (050 � Security & Data Layer)
- CORS allowlist actually enforced (was open to every origin with credentials).
- JWT: deactivated staff lose access immediately; production refuses default secrets.
- DB writes debounced (~400ms coalesced flush) instead of full-file rewrite per statement.
- NEW `db.transaction()` helper; warehouse transfers and PO receipts are atomic.

### Validation
- Full suite: **16 suites / 118 tests passing** (4 new bridge tests).

---

## [4.11.0] - 2026-08-22 - mventor-ticket-045/046/047: ERP Hardening + Owner's Guide + Sidebar/Dark Mode

### Added (047 � Admin UI)
- Categorized tree sidebar: 6 sections (Catalog, Sales, Warehouse, Purchasing, Insights, System)
  expand/collapse; state persisted; active section auto-opens.
- Rail mode (icons-only) with � handle; choice persisted across reloads.
- Dark mode: toggle in sidebar, persisted (`cs-admin-theme`), system-preference default,
  pre-paint init (no flash), global `.dark` overrides for all pages (surfaces, text, borders,
  hovers, forms, banners, scrollbars); emojis/icons keep natural colors.

### Added (046 � Docs)
- `docs/ERP_GUIDE.md`: detailed plain-language owner's manual � every module + how to use it,
  warehouse/movement model, trash workflow, automation inventory, reports glossary, recipes,
  safety rules, known limits.

### Fixed / Hardened (045 � ERP & Warehouses � Trash)
- `createMovement` rejects trashed products (frozen until restore); mapped to HTTP 409.
- Inventory `/low-stock` + `/summary` exclude trashed products.
- Stock-facing reports (inventory value, aging, dead stock, low stock, out of stock, turnover,
  stockout frequency) exclude trashed via shared filter builder; historical sales unchanged.
- QR product payload exposes `trashed` flag.
- Tests: productTrash suite grown to 9 tests (movement guard, report exclusion/re-inclusion);
  full suite **15 suites / 114 tests passing**.

---

## [4.10.0] - 2026-08-22 - mventor-ticket-044: Product Trash System (Delete All + Warehouse Reset + Revert)

### Added
- **Server:** `services/productTrashService.js` � soft-delete ("trash") with full reversibility;
  trash wipes derived `inventory` snapshots (warehouse reset) while `inventory_movements` stay
  immutable; restore rebuilds exact stock by replaying movement sums and restores the pre-trash
  active state via `restore_active` snapshot column.
- **Server:** `routes/productTrash.js` mounted at `/api/admin/products` (before admin.js):
  `POST /trash-all`, `GET /trash`, `POST /trash/restore-all`, `POST /trash/:id/restore`.
- **Server:** migrations � `products.deleted_at`, `products.restore_active` (db.js).
- **Server:** new events � `product_trashed`, `products_trashed_all`, `product_restored`,
  `products_restored_all` (eventService).
- **Server:** `DELETE /api/admin/products/:id` converted from HARD delete to soft trash;
  admin product list excludes trashed (`deleted_at IS NULL`).
- **Admin frontend:** red "?? Delete All Products" button + confirmation modal on Products page;
  new Trash page (`/products/trash`) with Restore All + per-product Restore; sidebar Trash entry;
  4 new adminApi methods.
- **Tests:** `tests/productTrash.test.js` � 7 self-cleaning unit tests (trash/restore round-trip,
  merge semantics, movement-replay stock rebuild, inactive-state preservation).

### Notes
- Restore merges: products created after a trash-all are never touched (their deleted_at is NULL).
- Known limitation: reports/QR views may still resolve trashed products by id; catalog surfaces fully filtered.

---

## [4.9.2] - 2026-08-08 - mventor-ticket-043: Fix port drift (3000 ? 5172)

### Fixed
- `start.bat` � 9 stale `3000` references (dev/prod/tunnel modes, help) ? `5172`
- `beta-test.ps1` � 10 stale `http://localhost:3000` base URLs ? `5172`
- `README.md` � 6 stale references (run instructions, curl examples) ? `5172`
- `docs/SETUP.md` � 10 stale references (diagram, ngrok commands, troubleshooting) ? `5172`
- `.mventor` � architecture block port ? `5172`
- Mirrored all fixed files to the stable copy (SHA-256 verified)
- Backend source untouched (already correct: `server/index.js` default + `.env` `PORT=5172`)

### Notes
- Intentionally untouched: `VISION.MD` (CODEX blueprint diagram), scratch `server/_*.js`
  scripts (superseded by Jest suite on PORT 3099), `profile.md` (MUSE-owned)

---

## [4.9.1] - 2026-08-08 - mventor-ticket-042: Sync stable copy from on-dev

### Repository Maintenance
- Synced the stable copy from the on-dev copy:
  copied `profile.md` (v2.0), `.muse` (v2.0), `VISION_NEXT.MD` (new), `docs/PROJECT_STATE.md`,
  and `tickets/mventor-ticket-042.md`
- Verified byte-identical (SHA-256 match) and diff-clean in both directions
- Note: port drift (`start.bat`/`beta-test.ps1`: 3000 vs 5172) is deferred to a future ticket

---

## [4.9.0] - 2026-08-02 — mventor-ticket-036 v1: Worker App (Staff Mobile)

### Added
- **`worker-app/`** — Expo staff app (React Native + TypeScript), package `com.ecomerp.staff`
  - Staff JWT login (existing `/api/v1/auth/mobile/*`), session restore, logout
  - Home: today's stats (active orders / delivered today / COD collected) + active order list with status filters + pull-refresh
  - Order detail: customer, shipping, items, totals, payment; workflow-validated action buttons from `allowed_transitions`
  - **Proof of delivery**: camera photo + optional note → order delivered + COD auto-collected (payment_status=paid)
  - Profile: identity, role badge, sign out
- **Worker API** (`/api/v1/worker`, staff-JWT only, customers → 403):
  - `GET /orders`, `GET /orders/:id` (with items + allowed transitions), `PUT /orders/:id/status` (workflow-validated), `POST /orders/:id/proof` (multipart photo, rollback on invalid transition), `GET /stats`
  - `index.js`: route mount + `/uploads` static mount; `db.js`: `orders.proof_image`, `proof_note`, `paid_at`
- **Branded icons** (`scripts/generate-icons.mjs`, sharp; dark "CS" identity)

### Tests
- 12 new worker integration tests (`mobileApi.test.js`); suite **107/107**

---

## [4.8.0] - 2026-08-02 — mventor-ticket-040: Mobile App Enhancements

### Added
- **Wishlist API** (`/api/v1/wishlist`): list with product details, ids, add item, remove item — uses the existing `wishlist` table
- **Google sign-in API**: `POST /api/v1/auth/customer/google` — verifies Google ID token, finds/creates/links customer, returns JWT
- **Push channel**: notification engine now sends to customer device tokens via the Expo push service (`notificationService.sendPush`); channel enabled by default; rejected tokens auto-pruned
- **App — push notifications**: token registration after login (and unregister on logout), Notifications screen (list / mark read / mark all read) from Account
- **App — wishlist**: Wishlist tab, heart toggle on product detail (optimistic sync via WishlistContext)
- **App — Google sign-in**: `expo-auth-session` PKCE flow → id_token → backend; client ID in `src/config.ts`
- **APK build prep**: `eas.json` (preview→APK, production→AAB), app.json (package `com.ecomerp.customer`, scheme `ecomerp`, POST_NOTIFICATIONS, notifications plugin, splash), branded icons (`scripts/generate-icons.mjs`, sharp), `eas-cli` devDependency

### Fixed
- App session restore: `/auth/customer/me` returns `{ data }`, AuthContext now reads it correctly

### Tests
- 9 new wishlist integration tests (`mobileApi.test.js`); suite 95/95 on clean run

---

## [4.7.0] - 2026-08-02 — mventor-ticket-039: Customer Android App (Expo)

### Added
- **`mobile-app/`** — Customer Android app (Expo SDK 57, React Native 0.86, TypeScript, React 19)
- **Auth:** register/login screens, JWT stored in expo-secure-store, silent token refresh on 401, session restore via `/auth/customer/me`
- **Browse:** home with featured products rail, category chips, search, infinite-scroll product grid; product detail with color/size variants, quantity picker, stock display
- **Cart:** server-side cart (GET/POST/PUT/DELETE `/api/v1/cart`), quantity update, remove, clear, free-shipping progress bar
- **Orders:** checkout with COD shipping form (POST `/api/v1/orders`), order list with status colors, order detail with items/shipping/totals, cancel-when-pending
- **Account:** profile card, sign out, shows configured server URL
- **Config:** `src/config.ts` — single `API_BASE_URL` constant (LAN IP or ngrok)

### Files Created
- `mobile-app/` (scaffold) + `src/config.ts`, `src/api.ts`, `src/types.ts`, `src/auth/AuthContext.tsx`, `src/components/ProductCard.tsx`, `src/screens/` (Login, Home, ProductDetail, Cart, Checkout, Orders, OrderDetail, Profile), `App.tsx` (navigation)

### Test Results
- TypeScript: clean ✅
- Expo Android bundle export: ✅

---

## [4.6.0] - 2026-07-31 — mventor-ticket-035a: Webhook System & Mobile API Testing

### Added
- **Webhook Management Routes** (`/api/v1/webhooks`, JWT staff-only): register, list, detail, update, deactivate (soft delete), delivery history + stats, test event
- **Event integration:** `eventService.emit()` now dispatches all 27+ event types to registered webhooks (HMAC-SHA256 signed, 3-attempt exponential backoff, delivery logging)
- **Mobile API test suite** (`server/tests/mobileApi.test.js`, 63 tests): staff/customer JWT auth, products, cart, orders, user, images, notifications, webhooks — including live webhook delivery with signature verification
- **Test runner:** pre-seeds staff test user + cleans up after run; runs both integration suites

### Fixed (real bugs found by the new tests)
- `customers.google_id` UNIQUE collision on mobile registration → inserts `NULL` instead of `''`
- `customers` table missing `updated_at` column → profile/password updates crashed (500); migration added
- `mobileProducts.js` route shadowing → `/categories` and `/brands` moved before `/:id`

### Changed
- `server/routes/webhooks.js`, `server/services/eventService.js`, `server/services/webhookService.js` (CRUD + test), `server/run-integration-tests.js`, `server/db.js`, `server/routes/mobileCustomerAuth.js`, `server/routes/mobileProducts.js`

### Files Created
- `server/routes/webhooks.js`
- `server/tests/mobileApi.test.js`

### Test Results
- Unit Tests: 28/28 ✅
- Integration Tests: **82/82 ✅** (up from 58/62 — all critical bugs fixed)

---

## [4.5.0] - 2026-07-31 — mventor-ticket-038: API Integrations Management (Admin Panel)

### Added
- **Admin Panel page:** `Integrations` (sidebar → ERP → Integrations, route `/erp/integrations`)
  - 6 cards: Mail (SMTP), SendGrid, Paymob, Stripe, AI, Google Maps
  - Per-card status badge (Configured / Not configured), masked secret inputs, Save + Test Connection
  - Custom API keys section (free-form key/value pairs stored as JSON)
- **Settings seeded** (category `integrations`, 23 keys): mail (provider/host/port/user/pass/from/admin email), SendGrid (api key/from), Paymob (secret/public/HMAC/card & wallet integration IDs), Stripe (publishable/secret/webhook), AI (provider/base URL/model/key/timeout), Google Maps (api key), custom keys
- **Admin API:** `GET/PUT /api/admin/integrations` — grouped masked view + batch save (blank secret = keep existing, null = clear)
- **Admin API:** `POST /api/admin/integrations/test` — live connectivity tests for mail, sendgrid, paymob, stripe, ai, google_maps
- **Webhook service (mventor-ticket-035a partial):** CRUD + test-event methods added to `webhookService.js`

### Changed
- `server/email.js` — SMTP config now read live from settings (env fallback); added SendGrid HTTP API provider; transporter recreated on config change
- `server/services/aiService.js` — provider/base/model/key/timeout read live from settings; OpenAI-compatible chat completions support added (Ollama preserved)
- `server/routes/stripe.js` — lazy Stripe client from settings (env fallback); 503 guard when not configured
- `server/db.js` — admin email default → `ADMIN_EMAIL`
- `server/.env` — `ADMIN_EMAIL = <admin-email>`
- `server/data/store.db` — super admin email updated to `ADMIN_EMAIL`
- `server/tests/email.test.js` — hermetic via mocked settings service; `isConfigured()` now a function

### Files Created
- `server/routes/integrations.js` — integration management + test endpoints
- `client-admin/src/admin/pages/IntegrationsPage.jsx` — integrations UI

### Test Results
- Unit Tests: 28/28 passed ✅
- Server start: OK ✅
- Integration endpoints verified end-to-end (masked GET, save, keep-existing, all 6 tests) ✅
- Both frontends build successfully ✅

---
## [4.4.0] - 2026-07-29 — mventor-ticket-037: System Debug & Variant Image Generation

### Fixed
- **BUG-001:** Created `cart_items` table — Mobile cart API now functional
- **BUG-002:** Created `order_items` table — Mobile orders API now functional
- **BUG-003:** Created `user_addresses` table — Mobile addresses API now functional
- **BUG-004:** Seeded 26 product gallery images — All products now have gallery
- **BUG-005:** Generated 119 variant images with Sharp — Color/size variants linked
- **BUG-006:** Fixed `mobileOrders.js` schema mismatch — Uses `customer_id` correctly
- **BUG-007:** Fixed `mobileUser.js` table query — Queries `customers` table for customer JWT
- **BUG-008:** CSRF protection working correctly — Validation errors return 400 as expected
- **BUG-009:** Hero slider now uses featured products — No separate hero_slides needed

### Added
- **Database Tables:** `cart_items`, `order_items`, `user_addresses`
- **Database Columns:** 15 new columns on `orders` table for mobile order support
- **Database Columns:** `phone` column on `users` table
- **Variant Images:** 119 auto-generated variant placeholder images using Sharp
- **Gallery Images:** 145 total product images (26 main + 119 variants)
- **Hero Slider:** Now fetches from `/api/products/featured` instead of separate hero_slides table
- **Announcements:** 3 default announcements seeded

### Changed
- `server/db.js` — Added table creation and migrations for mobile app tables
- `server/routes/mobileOrders.js` — Fixed to use `customer_id` instead of `user_id`
- `server/routes/mobileUser.js` — Fixed to query `customers` table for customer JWT
- `client/src/components/HeroSlider.jsx` — Changed to fetch from `/api/products/featured`

### Files Created
- `server/seed-ticket037.js` — Seed script for gallery images, variants, hero slides, announcements

### Test Results
- **Unit Tests:** 28/28 passed ✅
- **API Tests:** 58/62 passed (93.5%) ✅
- **Before:** 53/62 passed (85.5%) — 9 critical failures
- **After:** 58/62 passed (93.5%) — All critical bugs fixed

---

## [4.3.0] - 2026-07-29 — Customer UI Redesign & Mobile App Planning

### Added
- **Customer UI Redesign** — Modern e-commerce template inspired by top WordPress themes
  - **HomePage** — Announcement bar, animated hero section with stats, category showcase grid, trust badges, newsletter signup
  - **Enhanced Components** — Improved Navbar with sticky header, better mobile menu, enhanced Footer with social links
  - **ProductCard** — Quick view modal, better hover effects, enhanced badges
  - **Smooth Animations** — Transitions throughout the customer interface

- **mventor-ticket-035: Mobile App Integration Preparation** (Planned)
  - JWT authentication for mobile apps
  - API versioning strategy (v1 prefix)
  - Mobile-optimized endpoints
  - Image optimization (multiple sizes, WebP)
  - Push notification infrastructure
  - Deep linking support
  - CORS configuration for mobile
  - Comprehensive API documentation

- **mventor-ticket-036: Admin Mobile App (PWA)** (Planned)
  - Single unified admin app for all employees
  - Custom role creation (admin can create any role name)
  - Permission checkboxes for granular access control
  - Dynamic UI based on user permissions
  - Barcode scanner integration
  - Offline mode with sync queue
  - Push notifications
  - Biometric authentication

### Architecture Decision
**Mobile App Strategy:** Single unified admin app (PWA) for all employees with role-based access control
- All employees use the same app (not separate apps per role)
- Super admins can create custom roles with any name
- Permissions assigned via UI checkboxes (26+ permissions)
- Interface adapts based on user's permissions
- PWA technology for native-like experience

### Files Changed
```
Modified:
  client/src/pages/HomePage.jsx          (Complete redesign with modern template)
  client/src/components/Navbar.jsx       (Enhanced with sticky header, better mobile menu)
  client/src/components/Footer.jsx       (Added social links, payment methods)
  client/src/components/ProductCard.jsx  (Quick view, better hover effects)
  docs/PROJECT_STATE.md                  (Updated with mobile app architecture)
  docs/HANDOVER.md                       (Added mobile app strategy section)
  docs/BACKLOG.md                        (Added mventor-ticket-035, mventor-ticket-036)

New:
  tickets/mventor-ticket-035.md                  (Mobile App Integration Preparation)
  tickets/mventor-ticket-036.md                  (Admin Mobile App with RBAC)
  docs/API_DOCUMENTATION.md              (Comprehensive API docs for mobile apps)
```

## [4.2.0] - 2026-07-29 — Admin ERP Frontend — Remaining Modules
### Added
- **mventor-ticket-034:** Admin ERP Frontend — Remaining Modules
  - **Suppliers Management** (`/erp/suppliers`) — Supplier CRUD with modal form, contact info, lead time, product count, deactivate with confirmation
  - **Purchase Orders** (`/erp/purchase-orders`) — Full PO lifecycle: create with items, status transitions (draft→sent→confirmed→received), goods receipt modal, detail view with line items
  - **Reports Dashboard** (`/erp/reports`) — 10 report types as clickable cards, filters (date range, category, warehouse), CSV export, dynamic table rendering
  - **Settings** (`/erp/settings`) — Category sidebar (8 categories), inline editing with type-aware inputs (text, number, boolean toggle, JSON), unsaved change indicators, batch save
  - **Events & Audit Trail** (`/erp/events`) — Event type filter pills with counts, entity type filter, pagination, color-coded event badges, payload preview
  - **Users & Roles** (`/erp/users`) — User CRUD with role assignment, activate/deactivate, roles summary cards, permissions reference display
  - **Notifications** (`/erp/notifications`) — Tabbed interface (Rules / In-App), notification rule creation with channel/recipient/template, in-app notification list with mark-as-read
  - **Sidebar Navigation** — 7 new ERP items added (Suppliers, Purchase Orders, Reports, Notifications, Events, Settings, Users)
  - **Routes** — 7 new routes under `/erp/*` namespace

### Files Changed
```
Modified:
  client-admin/src/admin/components/Sidebar.jsx  (+7 ERP navigation items)
  client-admin/src/App.jsx                       (+7 ERP routes, 7 imports)

New:
  client-admin/src/admin/pages/SuppliersList.jsx       (170 lines)
  client-admin/src/admin/pages/PurchaseOrdersList.jsx   (280 lines)
  client-admin/src/admin/pages/ReportsDashboard.jsx     (170 lines)
  client-admin/src/admin/pages/SettingsPage.jsx         (165 lines)
  client-admin/src/admin/pages/EventsList.jsx           (130 lines)
  client-admin/src/admin/pages/UsersList.jsx            (180 lines)
  client-admin/src/admin/pages/NotificationsPage.jsx    (190 lines)
```

## [4.1.0] - 2026-07-29 — Admin ERP Frontend
### Added
- **mventor-ticket-033:** Admin ERP Frontend — Inventory, Movements, Warehouses
  - **Inventory Dashboard** (`/inventory`) — Stock overview with 5 stat cards (total products, total stock, stock value, low stock alerts, warehouses), low stock alerts table, full inventory summary table, warehouse filter
  - **Stock Movements** (`/inventory/movements`) — Complete audit trail with filters (movement type, warehouse, limit), color-coded movement type badges, quantity change indicators, pagination support
  - **Warehouses & Locations** (`/inventory/warehouses`) — Warehouse CRUD with inline create/edit form, location management per warehouse, stock summary per warehouse/location, deactivate with stock protection
  - **Sidebar Navigation** — New ERP section with Inventory, Movements, Warehouses links
  - **API Client** — 50+ new API functions added to `adminApi.js` (inventory, warehouses, suppliers, purchase orders, events, settings, reports, users, notifications)
  - **Currency Fix** — Overview page changed from USD ($) to EGP (ج.م)

### Files Changed
```
Modified:
  client-admin/src/api/adminApi.js          (+100 lines: ERP API functions)
  client-admin/src/admin/components/Sidebar.jsx  (+ERP navigation section)
  client-admin/src/admin/pages/Overview.jsx  (currency fix: $ → ج.م)
  client-admin/src/App.jsx                   (+3 ERP routes)

New:
  client-admin/src/admin/pages/InventoryDashboard.jsx  (250 lines)
  client-admin/src/admin/pages/MovementsList.jsx       (200 lines)
  client-admin/src/admin/pages/WarehousesList.jsx      (300 lines)
```

## [4.0.0] - 2026-07-28 — ERP Platform Complete
### Added
- **mventor-ticket-024:** Inventory Movement Engine
  - 11 movement types (opening_balance, receipt, issue, adjustment, transfer, return, damage, reservation, release, correction, count)
  - Stock calculation from movements with audit replay
  - Low stock alerts with event emission
  - API: `/api/admin/inventory/stock`, `/movements`, `/replay`, `/low-stock`, `/summary`

- **mventor-ticket-025:** Warehouse & Location Management
  - Warehouse CRUD with stock summary
  - Location CRUD within warehouses
  - Atomic stock transfers between locations (issue + receipt movements)
  - API: `/api/admin/warehouses`, `/locations`, `/inventory/transfer`

- **mventor-ticket-026:** Supplier Management
  - Supplier CRUD with product count
  - Product-supplier links with preferred supplier tracking
  - API: `/api/admin/suppliers`, `/products/:id/suppliers`

- **mventor-ticket-027:** Purchase Order System
  - Full PO lifecycle (draft → sent → confirmed → received_partial → received)
  - Auto-generated PO numbers (PO-2026-0001 format)
  - Goods receipt with inventory movements
  - Partial receipts supported
  - API: `/api/admin/purchase-orders`

- **mventor-ticket-028:** Document Numbering System
  - 8 document types (PO, SO, GR, GI, TO, RT, CM, ADJ)
  - Configurable prefix, separator, year format, padding
  - Thread-safe atomic increment
  - API: `/api/admin/document-numbers`

- **mventor-ticket-029:** Notification Engine
  - Rule-driven notifications (email, in-app, webhook)
  - Template interpolation with {{field}} syntax
  - Notification log and in-app notification center
  - API: `/api/admin/notifications`, `/in-app`

- **mventor-ticket-030:** QR Code System
  - Generate QR codes for products, locations, documents
  - Permission-based resolution (different data for different roles)
  - API: `/api/qr/generate`, `/api/qr/resolve`

- **mventor-ticket-031:** Settings & Configuration Engine
  - Centralized settings with categories (general, inventory, orders, delivery, security)
  - In-memory cache for performance
  - Public/private settings distinction
  - Batch update support
  - API: `/api/admin/settings`, `/api/settings/public`

- **mventor-ticket-032:** Reporting Engine
  - 10 report types (inventory value, stock aging, dead stock, low stock, out of stock, ABC analysis, turnover rate, sales, supplier performance, stockout frequency)
  - CSV export for all reports
  - API: `/api/admin/reports`

- **mventor-ticket-017:** Currency Display
  - Changed all price displays from USD ($) to EGP (ج.م)
  - Updated 11 frontend files (ProductCard, ProductDetailPage, CartPage, CartDrawer, AccountPage, SuccessPage, FilterSidebar, SmartSearch, PhotoStack, AdminDashboard, ProductForm)

- **mventor-ticket-019:** Variant Image Assignment
  - Link gallery images to specific color/size variants
  - Admin: variant selector on image upload, variant badges on images
  - Customer: gallery filters by selected variant
  - Added `variant_attributes` column to product_images table

## [3.4.0] - 2026-07-28
### Testing
- **mventor-ticket-024-Beta-Test:** Comprehensive System Testing
  - All backend APIs verified (products, categories, brands, orders, events, users, roles, permissions)
  - All automated tests pass (28 unit + 21 integration = 49/49)
  - Database integrity verified (18 tables, 51 products, 6 categories, 47 inventory records, 47 movements, 24 events, 6 roles, 26 permissions, 2 users)
  - Customer frontend operational (port 5173)
  - Admin frontend operational (port 5174)
  - RBAC system fully functional
  - Event system fully functional
  - System stable and ready for mventor-ticket-024 (Inventory Movement Engine)

## [3.3.0] - 2026-07-28
### Added
- **mventor-ticket-023:** Role-Based Access Control (RBAC)
  - `roles` table — 6 default roles (super_admin, site_manager, warehouse_manager, delivery_partner, support, viewer)
  - `permissions` table — 26 granular permissions (products, orders, inventory, warehouses, suppliers, purchase_orders, users, settings, reports)
  - `role_permissions` table — many-to-many mapping between roles and permissions
  - `users` table — system users with roles, password hashing, active status
  - RBAC middleware (`server/middleware/rbac.js`) — requirePermission, requireRole, isAuthenticated
  - User management API (`server/routes/users.js`):
    - `GET /api/admin/users` — list all users
    - `GET /api/admin/users/:id` — get user by ID
    - `POST /api/admin/users` — create new user
    - `PUT /api/admin/users/:id` — update user
    - `DELETE /api/admin/users/:id` — deactivate user (soft delete)
    - `GET /api/admin/users/roles/list` — list all roles
    - `GET /api/admin/users/permissions/list` — list all permissions
    - `GET /api/admin/users/me/current` — get current user info with permissions
  - Admin login updated to support RBAC users (backward compatible with env variable login)
  - Super Admin user auto-created from .env credentials on first run
  - All permissions assigned to Super Admin role by default
  - Events emitted for user creation, updates, login, logout

## [3.2.0] - 2026-07-28
### Added
- **mventor-ticket-022:** Event System & Audit Trail
  - `events` table — immutable audit trail for all significant actions
  - Event service (`server/services/eventService.js`) — emit, getTimeline, getByType, getAll, getCounts
  - 27 event types defined (order, inventory, product, user, warehouse, purchase order events)
  - API endpoints:
    - `GET /api/admin/events` — list all events with filters
    - `GET /api/admin/events/timeline/:entityType/:entityId` — get timeline for entity
    - `GET /api/admin/events/type/:eventType` — get events by type
    - `GET /api/admin/events/counts` — get event counts by type
    - `GET /api/admin/events/types` — list all available event types
  - Event emission integrated into:
    - Admin login/logout
    - Product CRUD (create, update, delete)
    - Order creation
    - Order status updates (paid, shipped, delivered, cancelled, refunded)
    - Stripe webhook (order_paid)
  - Events are immutable — no UPDATE/DELETE allowed
  - Indexes for fast timeline queries

## [3.1.0] - 2026-07-28
### Added
- **mventor-ticket-021:** Database Schema Redesign — ERP inventory tables created
  - `warehouses` table — physical storage locations
  - `locations` table — bins/shelves within warehouses
  - `inventory_movements` table — source of truth for stock (opening_balance, receipt, issue, adjustment, transfer, return, damage, reservation, release, correction, count)
  - `product_variants` table — SKU/barcode/serial/lot/batch tracking
  - `inventory` table — current stock per product per warehouse per location
  - New product columns: `cost_price`, `weight_kg`, `is_trackable`, `default_warehouse_id`, `barcode`, `sku`, `min_stock`, `max_stock`, `reorder_point`
  - Migration: Existing product stock migrated to inventory table with opening_balance movements
  - Default warehouse seeded: "Main Warehouse" (WH-MAIN)
  - schema.sql updated with full ERP schema

### Fixed
- **mventor-ticket-020:** Admin Authentication — Verified login, CSRF token, session persistence, and protected routes all working correctly

## [3.0.0] - 2026-07-28
### Architectural Pivot
- **VISION.MD completely rewritten** — from e-commerce store to modular ERP platform
- **THE REAL VISION integrated** — build software that can become the operating system of a real company
- **ERP Philosophy documented** — inventory as movements, products vs inventory, documents, events, roles
- **Brainstorm.md created** — inventory manager feature analysis inspired by top ERP apps

### Added
- **mventor-ticket-021:** Database Schema Redesign — Products vs Inventory separation
- **mventor-ticket-022:** Event System & Audit Trail
- **mventor-ticket-023:** Role-Based Access Control (RBAC)
- **mventor-ticket-024:** Inventory Movement Engine
- **mventor-ticket-025:** Warehouse & Location Management
- **mventor-ticket-026:** Supplier Management
- **mventor-ticket-027:** Purchase Order System
- **mventor-ticket-028:** Document Numbering System
- **mventor-ticket-029:** Notification Engine
- **mventor-ticket-030:** QR Code System
- **mventor-ticket-031:** Settings & Configuration Engine
- **mventor-ticket-032:** Reporting Engine Foundation

### Changed
- Project redefined: "E-commerce Store" → "Modular ERP Platform"
- BACKLOG.md restructured with ERP ticket priority order
- PROJECT_STATE.md updated with architectural direction
- HANDOVER.md updated with ERP roadmap

## [2.1.0] - 2026-07-24
### Added
- **Variant Indicator System** — SizeSelector (customer) + SizePicker (admin), cart size tracking
- **Featured Products System** — FeaturedList admin page, HomePage integration, PhotoStack support
- **`sizes` JSON column** — per-product size variants
- **`featured` + `featured_order` columns** — admin-curated featured products
- **Rich descriptions** — All 51 products have meaningful descriptions
- **Full image coverage** — All 51/51 products now have images

### Changed
- **Complete Rebrand** — legacy vertical naming retired (see 061 neutral catalog)
- **All 22 Arabic products translated to English**
- **Categories streamlined** — 6 categories
- **CartContext** updated to track size+color combination

## [2.0.0] - 2026-07-24
### Changed
- **Complete Rebrand:** "My Store" → "Ecom-ERP"
- **Real Product Data:** 51 real Ecom-ERP products from Excel data
- **Categories:** 7 categories
- **Product Prices:** All prices in EGP
- **Brands:** Ecom-ERP + Generic

### Added
- **mventor-ticket-015:** `server/seed-ecom-erp.js` — Reads Excel data, seeds DB
- **Product Images:** 34 products with photos

## [1.11.0] - 2026-07-24
### Added
- Modular Admin Dashboard + Product Colors System

## [1.10.0] - 2026-07-24
### Changed
- Switched from Cloudflare Tunnel to ngrok

## [1.9.0] - 2026-07-23
### Added
- Google OAuth Customer Login

## [1.7.0] - 2026-07-23
### Added
- Custom Domain Guide, Cloudflare Tunnel Config

## [1.6.0] - 2026-07-23
### Added
- Security Headers, CSRF Protection, Input Validation

## [1.5.0] - 2026-07-23
### Added
- Compression, Rate Limiting, Cache, Jest Test Suite

## [1.4.0] - 2026-07-23
### Added
- Email Notification Module (Nodemailer)

## [1.3.0] - 2026-07-23
### Added
- Image Upload API (Multer)

## [1.2.0] - 2026-07-23
### Added
- Admin Order Management, Sales Dashboard

## [1.1.0] - 2026-07-23
### Added
- Seed data, Sorting, "New" badge

## [1.0.0] - 2026-07-23
### Added
- Full project structure with CODEX workflow
