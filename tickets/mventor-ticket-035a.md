# mventor-ticket-035a: Webhook System & Mobile API Testing

**Status:** Completed âœ…  
**Priority:** High  
**Phase:** Platform Expansion  
**Parent:** mventor-ticket-035 (Mobile App Integration Preparation)  
**Created:** 2026-07-29  
**Completed:** 2026-07-31  
**Author:** CODEX

> **Session note (2026-07-31):** Resumed after mventor-ticket-038 (API Integrations).
> webhookService.js CRUD was done pre-pause; this session added the routes,
> event integration, and the full mobile API test suite.

---

## Objective

Complete the remaining mventor-ticket-035 deliverables: implement the webhook system (service, routes, event integration, signature verification) and write comprehensive tests for all mobile API endpoints.

---

## What Was Done

### 1. Webhook Service (`server/services/webhookService.js`) âœ…
- [x] Dispatch events to registered webhooks
- [x] HMAC-SHA256 signature generation for payload verification
- [x] Retry mechanism (3 attempts with exponential backoff)
- [x] Delivery logging (success/failure, response status)
- [x] CRUD: `createWebhook`, `getWebhooks`, `getWebhook`, `updateWebhook`, `deactivateWebhook` (soft delete), `sendTestEvent`

### 2. Webhook Management Routes (`server/routes/webhooks.js`) âœ…
- [x] POST /api/v1/webhooks â€” Register new webhook (auto-generates secret if omitted)
- [x] GET /api/v1/webhooks â€” List all webhooks
- [x] GET /api/v1/webhooks/:id â€” Get webhook details
- [x] PUT /api/v1/webhooks/:id â€” Update webhook
- [x] DELETE /api/v1/webhooks/:id â€” Deactivate webhook (soft delete)
- [x] GET /api/v1/webhooks/:id/deliveries â€” Delivery history + stats
- [x] POST /api/v1/webhooks/:id/test â€” Send test event
- [x] JWT staff-only auth (customers get 403)

### 3. Event System Integration âœ…
- [x] `eventService.emit()` now dispatches to registered webhooks (fire-and-forget)
- [x] All 27+ event types trigger webhook dispatch (wildcard `*` subscription supported)

### 4. Mobile API Tests (`server/tests/mobileApi.test.js`) âœ… â€” 63 tests
- [x] JWT staff auth (login, refresh, logout, me)
- [x] Customer auth (register, login, refresh, duplicate/wrong-password cases)
- [x] Products API (list, pagination, sparse fieldsets, featured, detail, categories, brands)
- [x] Cart API (get, add, update, remove, clear, auth/validation errors)
- [x] Orders API (create, list, detail, cancel, empty-cart/invalid-status cases)
- [x] User API (profile, password, addresses)
- [x] Images API (resize, webp conversion, 404)
- [x] Notifications API (device register, preferences, list, unregister)
- [x] Webhooks API (CRUD, deliveries, live test delivery with HMAC verification via local listener)

### 5. Test Runner (`server/run-integration-tests.js`) âœ…
- [x] Pre-seeds a known staff user (delete-then-insert) for JWT tests; removes it + test customers after
- [x] Runs `tests/api.test` + `tests/mobileApi.test`

---

## Real Bugs Found & Fixed During Testing

1. **`customers.google_id` UNIQUE collision** â€” mobile registration inserted default `''` which collides with existing rows; now inserts `NULL` (`server/routes/mobileCustomerAuth.js`)
2. **`customers` table missing `updated_at`** â€” profile/password updates crashed with 500; added migration in `server/db.js` (SQLite ALTER requires constant default â€” plain column, no DEFAULT)
3. **Route shadowing in `mobileProducts.js`** â€” `/categories` and `/brands` were declared AFTER `/:id` so they could never match (404); reordered
4. **Chunked DELETE bodies rejected** â€” Node clients must send `Content-Length` on DELETE (test helper fixed; server behavior unchanged)

---

## Acceptance Criteria

- [x] Webhook CRUD endpoints functional
- [x] Webhook signatures verifiable by recipients
- [x] Webhook delivery logging works
- [x] Event system triggers webhook dispatch
- [x] All mobile API tests pass
- [x] Existing unit tests still pass (28/28)
- [x] Server starts without errors
- [x] Both frontends build successfully

## Test Results (2026-07-31)

- **Unit tests:** 28/28 âœ…
- **Integration tests:** 82/82 âœ… (up from 58/62 â€” the 63 new mobile tests + 19 existing API tests)
- **Webhook end-to-end:** local listener received signed payload; HMAC-SHA256 verified; delivery logged âœ…
