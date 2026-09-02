# Technical Debt

## Known Items

### 1. No Unit Tests (Resolved)
- **Status:** âœ… Resolved in mventor-ticket-006
- **Test Suite:** Jest with 31 tests (13 unit + 18 integration)
- **Coverage:** Cache module, email module, API endpoints

### 2. SQL.js In-Memory Database
- **Risk:** Low-Medium
- **Impact:** Entire database loaded into RAM, scales to ~10K products
- **Plan:** Monitor usage; migrate to `better-sqlite3` or PostgreSQL if needed

### 3. No Input Rate Limiting (Resolved)
- **Status:** âœ… Resolved in mventor-ticket-006
- **Limits:** 200/15min API, 20/15min login, 30/15min checkout

### 4. No CSRF Protection (Resolved)
- **Status:** âœ… Resolved in mventor-ticket-007
- **Implementation:** Token-based CSRF via `X-CSRF-Token` header on admin state-changing routes

### 5. No Image Optimization
- **Risk:** Low
- **Impact:** Raw uploads stored at full resolution
- **Plan:** Add image resizing/compression (sharp) in a future ticket

### 6. 17 Products Missing Images
- **Risk:** Low
- **Impact:** 17 products display placeholder instead of actual product photo
- **Plan:** Source images from supplier or take product photos; add to `server/public/images/products/`

### 7. Currency Symbol Shows "$" Instead of "EGP"
- **Risk:** Low
- **Impact:** Prices display with $ sign but are actually in EGP
- **Status:** âœ… Resolved in mventor-ticket-033 (Overview page) and mventor-ticket-017 (all other pages)

## Resolved Items
- Native better-sqlite3 compilation issue â†’ Migrated to sql.js âœ…
- Session store dependency issues â†’ Migrated to file-based sessions âœ…
