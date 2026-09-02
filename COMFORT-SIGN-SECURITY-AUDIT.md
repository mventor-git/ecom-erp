# Comfort Sign — Security Audit (closure)

Evidence-based. No secret values are printed. Tags: ✅ SAFE · ⚠️ REMAINING · 🔴 BLOCKER · PRE-EXISTING.

---

## 1. Authentication — ✅
- Session-based admin auth (`express-session` file store) + JWT for mobile; `req.session.regenerate()` on login (session-fixation protection); bcrypt for RBAC `users` password hashes.
- **NEW — production fail-fast guard** (`server/index.js`): refuses to start in `NODE_ENV==='production'` if `ADMIN_PASSWORD` is missing, <8 chars, or a known default (`admin123`/`password`/`admin`/…). Mirrors the existing `SESSION_SECRET` guard. Dev server unaffected (dev mode). **Closes the "known default production password" blocker.**

## 2. Authorization / RBAC — ✅
- Server-side on every admin route via `adminAuth` + `requirePermission(...)` (e.g. suppliers `suppliers.read`/`suppliers.manage`; price/order routes gate `orders.manage`/`settings.manage`). Not UI-hidden. RBAC `users`/`roles`/`permissions`/`user_roles`; 2FA via `speakeasy`; CSRF on admin state-changing routes.

## 3. Secrets — ✅ (source) / ⚠️ (env)
- `.env` is git-ignored (`.env`, `.env*`); DB files, `server/data/`, `credentials.md`, `secrets/`, `logs/`, and now **probe/scratch files** (`server/_*.cjs`, `server/_*.js`, `server/_kashier-*.cjs`, `server/_seed-kashier.cjs`) are all in `.gitignore`.
- **NEW — live Kashier credential literals neutralized**: the hardcoded `mid$secret` in `_seed-kashier.cjs` (2 literals) and `_kashier-fix-probe.cjs` (4 literals) were replaced with env reads (`process.env.KASHIER_SECRET` / `process.env.KASHIER_MERCHANT_ID`). Verified: **0 hardcoded `mid$secret` literals remain** in source.
- ⚠️ `ADMIN_PASSWORD` and the live Kashier secret still exist in `server/.env` (dev, git-ignored). The Kashier secret should be **rotated** and the scratch probe files **deleted** before deployment; the production guard forces a strong `ADMIN_PASSWORD`.

## 4. Client/server authority — ✅
- Order totals, purchase totals, COGS, retail price, cost basis, and inventory quantities are all recomputed server-side (`orderPricing.js`, `valuationService.js`, `inventoryService.js`). Client never defines an amount charged (P0.4 verified). Webhook HMAC-SHA512 + `timingSafeEqual` + idempotency log (Kashier). Raw body preserved.

## 5. Financial calculations / destructive actions — ⚠️
- Financial correctness verified (valuation 14/14, supplyFlow 3/3, orderPricing 7/7). Duplicate-supply receipt prevention is handled by the movement-ledger idempotency (`orderAlreadyHas`) + cost-layer `addLayer` being append-only (never double-writes a layer for the same supply line — the supply/PO receipt path is reviewed as the single entry point).
- ⚠️ **13 admin files still use native `window.confirm`/`window.alert`** for destructive actions (Brands, Categories, FinancialPeriods, IssueOrders, PriceLists, Products, ProductsTrash, Shipping, SupplyOrders, Warehouses, ColorPicker, SizePicker, ProductGallery). The reusable `ConfirmDialog` exists (wired for PO cancel); the remaining consumers are **REMAINING** (no unsafe one-click destroy added this batch — these already had confirms; they just aren't the unified dialog).

## 6. Audit logging — ✅
- Uses the existing `events` audit system: `SUPPLIER_CREATED`, `SUPPLIER_UPDATED`, `SUPPLIER_DEACTIVATED` emitted by `routes/suppliers.js`; order/inventory/price events via `eventService`. No second audit mechanism.

## 7. Environment / git hygiene — ✅
- `.gitignore` now covers env, DB, credentials, logs, and the secret-bearing scratch files. The live Kashier literal is out of source. "admin123" only remains as an **intentional deny-list** (index.js guard, `utils/passwordValidator.js`) and in **test/scratch** files — no production credential.

## 8. Remaining risks (honest)
- Rotate the live Kashier secret (it was in source once; assume exposed) and delete the `_kashier-*`/`_seed-kashier` scratch probes before deploy.
- Enforce a strong `ADMIN_PASSWORD` env at deploy (now required by the production guard) and prefer a bcrypt-hashed admin in the RBAC `users` table.
- Migrate the remaining native `window.confirm`/`alert` to `ConfirmDialog`; continue the design-system consolidation (81× hand-rolled `bg-primary-600`, 18 lucide files).
- `products.cost_price` legacy fallback in COGS is **intentional/documented** (only for items without cost layers).

## Verdict
🔴→✅ **SECURITY BLOCKER CLOSED**: no known-default production password (fail-fast guard), no live `mid$secret` literal in source, probe/seed files git-ignored. ⚠️ **REMAINING**: rotate the actually-used Kashier secret in `.env`, delete scratch probes, and finish the destructive-action `ConfirmDialog` migration + design-system consolidation. Nothing printed here exposes a secret.
