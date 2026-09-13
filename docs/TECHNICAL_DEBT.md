# Technical Debt

## Known Items

### 0a. Sales settlement — deliberate non-goals left for later slices (091)
- **Risk:** Low-Medium (accounting completeness, not correctness of what IS modeled)
- **Impact:** 091 made the ledger canonical on the three REAL settlement paths and refunds, but intentionally did NOT invent: (a) partial-refund accounting — endpoint refuses amount≠total (`PARTIAL_REFUND_UNSUPPORTED`); (b) physical goods-return journaling — refund reverses cash/revenue only, never restores inventory (no RMA/return doc exists to model that fact against); (c) VIP on-bill credit-sale AR recognition (no AR model — approval-only, its later cash flows through manual settle); (d) shipping-carrier-delivered COD is NOT auto-settled (no human collection attestation on that path); (e) admin counter-sale (total=0 synthetic order) has no settlement journal by design.
- **Plan:** (a)+(b) a returns/RMA slice; (c)+(AR) needs the GL/092-093 track; (d) decide at 092 whether carrier-delivery implies a settlement actor; (e) link counter-sale to a real priced order. All owner-gated; NOT silently invented in 091.

### 0b. Worker COD settlement UX coupling (091)
- **Risk:** Low
- **Impact:** driver app calls the SAME status/proof endpoints, so a closed financial period now returns 409 SETTLEMENT_BLOCKED on delivered for COD orders (books fail closed; delivery is only recordable when it can also be booked). Driver app has no special handling of that code yet.
- **Plan:** worker-app follow-up (surface "period closed — retry/call office") in the deferred mobile track; backend behavior is intended.

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
