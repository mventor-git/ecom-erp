# mventor-ticket-020: Fix Local Admin Authentication

**Status:** Completed  
**Priority:** High  
**Started:** July 24, 2026
**Completed:** July 28, 2026

## Description
Restore reliable admin authentication when the customer storefront is exposed through
ngrok while the separate admin frontend runs locally on port 5174.

## Scope
- Remove temporary credential logging.
- Keep admin credentials environment-controlled.
- Support secure cookies over ngrok and non-secure cookies on localhost.
- Ensure login persists the session before requesting the CSRF token.
- Correct the admin login page mount check to use a React effect.
- Verify login, CSRF, admin identity, builds, and automated tests.

## Acceptance Criteria
- `admin` / the configured local password can log in through `http://localhost:5174`.
- Login returns a `store_sid` session cookie.
- The authenticated CSRF-token request returns HTTP 200.
- The authenticated `/api/admin/me` request reports `isAdmin: true`.
- No passwords or credential comparison results are logged.
- Customer ngrok operation remains compatible with secure cookies.
- Unit and integration tests pass.
