# mventor-ticket-050 — Security & Data-Layer Hardening

## Status
Completed (2026-08-22)

## Goal
Fix the remaining high-severity findings: decorative CORS allowlist, JWT without active-check,
insecure default secrets in production, full-DB disk write on every statement, and missing transactions.

## Changes
- `index.js`: CORS now rejects non-allowlisted origins (no-origin requests still pass for
  mobile/server-to-server); logs blocked origins outside production. Startup guard refuses
  production boot with default SESSION_SECRET.
- `middleware/jwtAuth.js`: staff tokens verify the users row is still active on every request
  (deactivation takes effect immediately); startup guard refuses production boot with default
  JWT secrets.
- `db.js`:
  - Debounced persistence — writes mark the DB dirty and coalesce into one flush ~400ms later
    (`scheduleSave`/`flushSave`); process-exit hook flushes. Replaces O(db-size) synchronous
    write per statement.
  - NEW `transaction(fn)` helper (BEGIN IMMEDIATE / COMMIT / ROLLBACK).
- `routes/warehouses.js`: transfer is atomic (both legs commit together; compensation block removed).
- `routes/purchaseOrders.js`: goods receipt is atomic (all items + status commit together);
  validation errors mapped to HTTP 400.

## Validation
- node --check passes on all touched files; full suite green (**16 suites / 118 tests**).
- Known trade-off: up to ~400ms of writes may be lost on hard power loss (movements remain the
  source of truth; stock rebuilds via replay/restore).
