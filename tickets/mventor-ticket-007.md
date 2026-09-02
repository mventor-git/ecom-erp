# mventor-ticket-007: Production Hardening

**Status:** âœ… Completed  
**Priority:** Medium  
**Phase:** 7 â€” Hardening  

## Description
Harden the application for production: security headers, CSRF protection, input validation, and improved error handling.

## Tasks
### Dependencies
- [x] Install `helmet` for security headers

### Security Headers (helmet)
- [x] Content Security Policy (CSP) â€” restrict script/style sources
- [x] X-Frame-Options â€” prevent clickjacking
- [x] X-Content-Type-Options â€” prevent MIME sniffing
- [x] Strict-Transport-Security (HSTS) â€” enforce HTTPS
- [x] Hide X-Powered-By header
- [x] crossOriginResourcePolicy for images

### CSRF Protection
- [x] Generate CSRF token on admin login
- [x] Return token via `GET /api/admin/csrf-token` endpoint
- [x] Validate CSRF token on all state-changing admin routes via middleware

### Input Validation
- [x] Create `server/validate.js` â€” sanitization/validation helpers
- [x] Validate product input (name, price, category_id)
- [x] Validate login credentials
- [x] Validate order status transitions
- [x] Sanitize string inputs (trim, truncate)

### Error Handling
- [x] No stack traces in production (NODE_ENV check)
- [x] Consistent `{ error: string }` error response format

## Acceptance Criteria
- [x] Security headers present on all responses (CSP, X-Frame-Options, HSTS, etc.)
- [x] CSRF token required for admin POST/PUT/DELETE â†’ missing token = 403
- [x] Input validation rejects invalid product data (empty name, negative price)
- [x] Stack traces hidden in production mode
- [x] All 49 tests pass (28 unit + 21 integration)
- [x] 0 new vulnerabilities

## Files Changed
- **New:** `server/validate.js` â€” sanitization and validation helpers
- **New:** `server/middleware/csrf.js` â€” CSRF protection middleware
- **New:** `server/tests/validate.test.js` â€” 15 validation tests
- **Modified:** `server/index.js` â€” helmet, CSRF, checkout limiter, hardened error handler, session cookie config
- **Modified:** `server/routes/admin.js` â€” CSRF token on login, input validation on CRUD
- **Modified:** `server/tests/api.test.js` â€” CSRF token flow, 3 new tests
- **Modified:** `server/package.json` â€” added helmet dep, added validate to test script

## Verification
- 49/49 tests pass (28 unit + 21 integration)
- Frontend builds cleanly
- 0 vulnerabilities
