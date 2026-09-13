# Payment State Machine Design — Kashier / Checkout (No Implementation)

> **STATUS NOTE (mventor-ticket-091):** this remains a design sketch. The ONLY implemented refund reality is below; inbound webhook dedup actually uses `kashier_webhook_events.event_key` (`webhook_deliveries` is outbound-only), and no REFUND_REQUESTED/PROCESSING/PARTIALLY_REFUNDED states exist anywhere in code.

STATES: CREATED → PENDING → PAID / FAILED / EXPIRED → REFUND_REQUESTED → REFUND_PROCESSING → REFUNDED / PARTIALLY_REFUNDED.

ORDER-PAYMENT RELATION: orders.id + kashier_orders (merchant_order_id, kashier_order_key, status, raw_response, amount_cents, currency). Paymob links (paymob_links) for bulk.

IDEMPOTENCY: webhook_deliveries has event_key (unique) + event_type + payload + delivered_at + success. Webhook handler checks: (1) event_key already processed (success=1) → skip; (2) event type valid for order status; (3) amount matches order.total / settings.currency; (4) order current status < target (e.g., don't process PAID if already REFUNDED unless explicit transition allowed); (5) update order + kashier_orders + webhook_deliveries atomically (transaction).

DUPLICATE BEHAVIOR: duplicate event with same event_key = idempotent skip; duplicate with different event_key but same payload = process if transition valid; log both.

AMOUNT/CURRENCY: verify against order.total (cents) and settings.currency (EGP default) at webhook time; if mismatch → log error, do not change state.

REFUND (design sketch — NOT implemented): refund request creates order status update + payment state REFUND_REQUESTED; processing updates to REFUND_PROCESSING; confirmation to REFUNDED + orders.refund_amount + refunded_at. Partial refund uses PARTIALLY_REFUNDED + order_items adjustment.

REFUND (implemented reality, ADR-017): refunds are FULL only — `salesSettlementService.refundOrder` transitions the order to `refunded` AND posts ONE immutable mirrored reversal journal (Dr Revenue / Cr Cash) of the posted `sale-settled` entry in one transaction; duplicate reversals are structurally refused (`ux_journal_source`); amounts other than the full total are refused with `PARTIAL_REFUND_UNSUPPORTED`; no posted journal is ever edited/unposted; the reversal NEVER touches inventory or COGS (a refund is not a physical goods return). `refund_amount`/`refunded_at` record the full refund operationally. True partial refunds + returns await a future RMA/returns slice.

NO CODE CHANGED.
