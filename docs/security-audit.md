# Security Audit — Comfort Sign (Audit Only, No Fixes)

CONFIRMED ARCHITECTURE (from index.js / routes / middleware):
- Helmet CSP with directives allowing self + fonts.googleapis.com + images + unsafe-inline/eval (needed for React dev)
- Rate limits: apiLimiter (200/15min, skips /api/admin) + adminLimiter (1000/15min) + authLimiter (not shown full but referenced)
- CORS strict allowlist based on allowedOrigins (process.env.CLIENT_URL + CLIENT_ADMIN_URL + ...)
- CSRF protection (`csrfProtection` middleware) applied globally; token endpoint `/api/admin/csrf-token` requires `isAdmin`
- Session secret from .env; fail-fast in production (`isProduction`) if SESSION_SECRET weak/default
- Express session (FileStore) with `trust proxy`, cookie httpOnly, secure='auto', sameSite='lax', maxAge 24h
- Passport (Google OAuth) + session-based admin auth (`isAdmin` session flag) + JWT fallback
- Middleware auth: `jwtAuth.js` (Bearer + session + role deactivation check) + `adminAuth.js` (session `isAdmin`) + `rbac.js` (permission mapping via user_roles)
- Raw body preserved (`req.rawBody`) for HMAC webhook verification (Kashier)

POTENTIAL SECURITY GAPS (documented, not fixed):
- Client-trusted totals/prices: customer checkout sends price_list_code but backend should recalculate total; order total stored; JSON items don't enforce price-at-time server-side (needs verification in orders controller).
- Customer site could attempt to manipulate cart/item prices; need server-side validation of item price vs price list at checkout (not verified in audit).
- No webhook idempotency key table: webhook_deliveries logs events but no dedup key enforcement at webhook handler (only log after processing).
- File uploads: routes/upload exists; need validation of file type/size/security.
- Authorization: admin routes use `isAdmin` session; mobile routes use JWT; RBAC exists but some routes may rely only on session flag, not granular permission check per endpoint.
- .env default SESSION_SECRET = 'dev-secret-change-in-production'; production fails fast (good), but test environments may use weak secret.
- No secure cookie enforcement for non-HTTPS (secure='auto') — fine for ngrok/proxy.
- Database: SQLite file `store.db` stored locally; no encryption at rest.
- Customer auth: Google OAuth only (passport-google); no email/password for customers (except mobile auth? mobile uses different routes).

NO PYTHON. NODE ONLY.
NO FIXES APPLIED.
