# Ecom-ERP — Kashier Source-Level Production Audit

Evidence-only. No real secret values printed. The current Kashier integration was audited against the official Kashier Payment Sessions + HPP webhook contract.

---

## CURRENT IMPLEMENTATION (identified exactly)
- **Integration model: Payment Sessions API → Hosted Payment Page (HPP).** `kashierService.createPaymentSession()` POSTs `{baseUrl}/v3/payment/sessions` (live `https://api.kashier.io`, test `https://test-api.kashier.io`) and returns `sessionId` + `sessionUrl`; the storefront redirects the customer to `https://payments.kashier.io/session/{id}` (the hosted page). This is Kashier's **current official** flow. ✅
- **Files:** `routes/kashier.js` (config/test-session/sessions), `routes/kashierCheckout.js` (`POST /session` — public), `routes/kashierWebhook.js`, `services/kashierService.js`, `services/kashierWebhookService.js`, DB `kashier_orders`/`kashier_webhook_events`.

## API CONTRACT / AUTH
- **Auth:** `Authorization: <secretKey>` + `api-key: <apiKey>` headers (Kashier's current key scheme). `cfg()` accepts the portal's combined `"<api_key>$<secret_key>"` and splits it. ✅
- **Request:** `amount` (decimal string, cents/100), `currency` (EGP), `order` (orderRef), `merchantId`, `merchantRedirect`, `allowedMethods`, `enable3DS`, `customer{email}`, `display`, `type='one-time'`, `expireAt`, `maxFailureAttempts`, `paymentType='credit'`, `interactionSource='ECOMMERCE'`, optional `serverWebhook`. Consistent with the current contract.

## AMOUNT INTEGRITY — ✅ (P0.4 verified)
- `routes/kashierCheckout.js` charges **`order.total` from the DB** (not `req.body.total`); `routes/orders.js` recomputes the total server-side via `orderPricing.computeAuthoritativeOrder`. Tamper test: client250 / DB1000 → charged1000. Quantity/price/product-ID manipulation rejected (unknown/inactive/zero/negative). Server/db authoritative.

## SIGNATURE + WEBHOOK
- **Signature:** HMAC-SHA512 over `amount;currency;merchantOrderId;status` (`kashierWebhookService.computeSignature`), compared with `crypto.timingSafeEqual` on the **raw body** (`req.rawBody` preserved). Unknown event types → 200 (stop retries); real failures → 500 (redelivery). Malformed/redirect-not-trusted: success is only honored from the webhook, never a browser redirect.
- **Secret source BUG — FIXED:** the webhook previously read only the `kashier_secret_key` **setting**, which is **not populated** when the portal's combined `kashier_api_key` (`api_key$secret`) is configured → empty secret → **every webhook rejected (401)** in production. `routes/kashierWebhook.js` now resolves the secret via `kashierService.cfg().secretKey` (the same split logic the gateway uses), falling back to `KASHIER_SECRET_KEY` env. **FIX APPLIED + `node --check` OK.**
- **Idempotency:** `kashier_webhook_events.event_key UNIQUE` + `INSERT OR IGNORE` (`eventKey = eventType::sessionId::merchantOrderId::status`) prevents duplicate webhook processing. ✅

## PAYMENT STATES / ATTEMPTS
- **States observed:** sessions logged in `kashier_orders` (status `created`/`CAPTURED`/`AUTHORIZED`/`REFUNDED`/`VOIDED`/`FAILED`); **order.status** transitions `pending→paid` (`transaction-success`), `→cancelled` (`trans-void`), `→refunded` (`transaction-refund`). Order state !== payment state (distinct columns). ⚠️
- **Payment-attempt model: PARTIAL.** `kashier_orders` rows approximate attempts (per-session) but there is **no dedicated attempts table** preserving every attempt/reason sequentially. Attempts are not lost (previous rows remain), but retry-sequence integrity is implicit, not modeled. **REMAINING.**
- **Refunds — GAP.** Ecom-ERP reacts to `transaction-refund` webhook by setting `refund_status`/order `refunded`; there is **no Kashier refund API call** from the app, **no partial refund**, and **no refund idempotency** beyond the webhook event-key. No provider-confirmation round-trip (it trusts the webhook). **REMAINING.**
- **Settlement — GAP (accounting).** No gross/fee/net/settlement-date tracking, and no reconciliation vs gateway. Merchant fee is account-config, not hardcoded. Accounting/GL is structurally absent → **OPEN REQUIREMENTS** (documented, not faked).

## SECURITY
- `kashier_service` secret is read from `settings` (git-ignored DB) / env; the hardcoded `mid$secret` literals in the scratch probe files were **neutralized** (batch earlier) — verified 0 in source; those files are now git-ignored. Live secret should be rotated (it was in source once). Webhook result is never trusted from a browser redirect. ✅/⚠️

## TEST EVIDENCE
- Baseline: `valuation.test.js` 14/14 · `supplyFlow.test.js` 3/3 · `orderPricing.test.js` 7/7 (amount integrity/tamper) · full suite 13 pass / 3 pre-existing (rbacMultiRole, pickingPacking, customers). `node --check` on `kashierWebhook.js`/`index.js`: OK. Admin + Storefront builds: PASS.
- ⚠️ No automated test exercises the LIVE Kashier webhook signature path (requires a configured secret + a real sandbox); the secret-source fix is code-verified, not runtime-verified against a sandbox.

## DECISION
**KEEP (current flow is the correct official model) + FIXED the webhook secret-source bug.** No migration to a different Kashier flow is justified — the Payment Sessions → HPP flow is Kashier's current production flow.

**GAPS (documented, not faked):** dedicated payment-attempts model, Kashier refund API + partial-refund + refund idempotency, settlement/reconciliation, and full GL/accounting. Rotate the live Kashier secret and set it via env/settings before deploy.
