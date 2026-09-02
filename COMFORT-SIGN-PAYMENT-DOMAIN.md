# Comfort Sign — Payment & Order Domain Findings (checkpoint)

Date: 2026-09-02 · Evidence-based audit of the REAL order/payment/customer model (Phase 3/4/5/6).
Every claim is traced to current code. Nothing inferred from assumptions.

---

## Order / payment state model (what actually exists)

- `orders` has **both** `status` (lifecycle) and `payment_status` (verification evidence) + `payment_method`,
  `paid_at`, `temp_issue`, `order_number`, `subtotal`, `shipping`, `price_list_code`, `refund_amount/refunded_at`,
  `sales_channel`, and a per-order `shipping_*` address snapshot (name/phone/address/city/governorate/postal_code).
- `order_items` carries variant identity: `variant_id`, `variant_color`, `variant_size`, `sku`, `base_price`,
  `discount_*`, `final_price`, `tax_rate/amount`, `cost_snapshot`, `qty`.
- `kashier_orders(mapping)` links `merchant_order_id`/`kashier_order_key` → `amount_cents`, `currency`, `order_id`.
- `kashier_webhook_events` has `event_key UNIQUE` (idempotency log).
- Two flows coexist: **legacy** (`order_flow_enabled=false` → `pending/paid/shipped`) and **full**
  (`draft → payment_pending → payment_verified → admin_review → confirmed → picking → packing → ready_for_shipping → shipped → delivered → completed`).

### Answers to the Phase-3 questions (code-traced)

1. **What does "Pending" mean?** `orders.status='pending'` = initial checkout state before gateway confirmation.
   Zero pending orders in the live DB (22 orders: cancelled1/completed6/delivered1/paid12/picking1/shipped1).
2. **Are Pending records test fixtures?** In the live DB there are no pending orders; pending is a startup/legacy state.
3. **VIP?** VIP orders use `payment_method='onbill'` + `status='pending_approval'` + `temp_issue=1` (`orders.js:50-59`)
   — VIP bypass is **already distinguished** from a Kashier payment.
4. **VIP bypass Kashier?** Yes — `vipOnBill` sets a TEMP issue + `pending_approval`, no gateway session.
   Admin accepts (`confirmed`, clears temp_issue) or declines (`cancelled`).
5. **Can normal customers become Paid without gateway confirmation?** Only via the webhook (`handleTransactionSuccess`),
   which now requires the **signed amount to equal the order's authoritative total** (Batch-7 fix) and currency match.
   Normal customers cannot self-mark paid.
6. **Can an Admin manually force Paid?** Yes — `PUT /api/admin/orders/:id/status` → `transitionOrder('paid')`.
   **Now RBAC-gated** with `orders.update` (was adminAuth-only). It sets `status='paid'` but NOT `payment_status`/
   `paid_at` and does NOT deduct stock (bridge hooks only run on `confirmed`/`shipped`) — so a manual "paid" is a
   lifecycle flag, not a verified payment (no inventory effect). **Gap:** a manual `paid` does not clear the
   reservation or record `payment_method='manual'` + an audit trail; that is a Phase-4 follow-up.
7. **Inventory on payment→paid?** The webhook success path is ATOMIC: release reservation → issue → `status='paid'`
   inside one `db.transaction()` (nesting-aware). Manual admin `paid` does NOT touch inventory.
8. **Revenue?** Reports sum from `order_items`/orders; `isPaid()` treats `status in paid/payment_verified/confirmed`
   OR `payment_status in paid/verified` as paid.
9. **Invoices/receipts?** Documents are generated server-side from order data; see `COMFORT-SIGN-ORDER-DOCUMENTS` (to be
   authored) — the `status='paid'` flag drives whether a receipt is issued.
10. **Audit event?** `transitionOrder` logs order events; the webhook records `kashier_webhook_events` (idempotent).
11. **Same payment processed twice?** `event_key UNIQUE` + `INSERT OR IGNORE` + HTTP-layer `isDuplicate` guard BEFORE
    `routeEvent` ⇒ a duplicate webhook is acknowledged as `duplicate:true` and the handler never re-runs.
12. **Forged client marks Paid?** `POST /api/orders` recomputes the total server-side (`computeAuthoritativeOrder`) and
    ignores the client total; the admin status route requires an authenticated admin + `orders.update`. A public
    attacker cannot mark paid.
13. **Webhook marks Paid without matching amount/order/reference?** Signature covers `amount;currency;merchantOrderId;
    status` (HMAC-SHA512, timing-safe) — a forged payload fails signature. The Batch-7 handler additionally rejects a
    success whose signed amount ≠ order total or whose currency ≠ EGP. Order/reference is resolved via `findOrderId`
    (numeric `orderId`/`merchantOrderId`, falling back to the stored `kashier_orders` mapping).
14. **Webhook replayed?** Idempotent (see 11).
15. **Old webhook mutates later order state?** `transaction-success` only acts on `pending/pending_approval`; `trans-void`
    refuses `delivered/completed`. **`transaction-refund` has NO such guard** — a stale refund webhook could set a
    shipped/delivered/completed order to `refunded`. **REQUIRES BUSINESS DECISION** (legitimate post-delivery returns
    are not yet modeled; hardening this needs the return workflow).

## Variant safety (Phase 6)

`order_items` stores variant fields (`variant_id`, `variant_color`, `variant_size`). **The payment representation is
Kashier session + hosted page; the gateway is never the source of truth** for product/variant/inventory/COGS —
those stay in `products`, `product_variants`, `inventory`, `inventory_cost_layers`, `valuationService`.

**Gap:** `salesInventoryBridge.normalizeItems` maps items to `product_id` (+qty) — two variants of the same product
collapse to one product_id in the inventory movement (the movement ledger is per-product, variants are not
individually stocked unless `product_variants` is used). Whether variant-level inventory is required is a **business
decision**; the order line/payment representation preserves variant identity (Phase 6 follow-up).

## Payments classification (Phase 5)

- A) payment-domain tests — `tests/paymentDomain.test.js` (NEW): verified-payment evidence, amount-mismatch rejection,
  currency-mismatch rejection. **3/3.**
- B) mocked/simulated provider — webhook signature + routing tested at the service layer; no sandbox.
- C) real Kashier sandbox — **NOT configured/available** ⇒ **REQUIRES PROVIDER**.
- D) production verification — **NOT performed**; no live secret deployed.

## What was hardened this pass (Batch 7)

- `PUT /api/admin/orders/:id/status` now requires `orders.update` (RBAC) — the status/slider mutation is no longer
  adminAuth-only.
- `handleTransactionSuccess` now VERIFIES the signed amount (major-units → cents) equals `order.total` and the
  currency equals EGP before concluding `paid`; on mismatch it logs and does NOT mark paid or touch inventory. It also
  records `payment_status='verified'`, `payment_method='kashier'`, `paid_at` so "paid" always carries verification
  evidence (never fabricable from a status slider).
- `npm test` **17 suites /121 pass** (added `paymentDomain`).

## Open / requires decision

- Manual admin "paid" should clear the reservation + record a `manual` audit trail (Phase 4).
- Stale `transaction-refund` guard (delivered/completed) — REQUIRES BUSINESS DECISION (return semantics).
- Web-checkout order-address snapshot: `orders` carries `shipping_*` and **mobile checkout populates it**;
  **the web checkout (`POST /api/orders`) does NOT receive/store shipping** → historical web-order documents would fall
  back to a possibly-changed customer profile address. **REQUIRES implementation on the storefront checkout** (Phase 11).
- Variant-level inventory semantics — REQUIRES BUSINESS DECISION.
- Real Kashier sandbox/production verification — REQUIRES PROVIDER.
