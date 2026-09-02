# Sales / Payment / Receipt Reality — Audit Only (No Fixes)

SALES FLOW:
- Customer: cart → checkout via /api/kashier/checkout (Kashier) or Stripe session; email required; price_list_code used.
- Orders table: total INTEGER, status (pending/confirmed/etc.), items JSON, stripe_session_id.
- Admin: orders list; issue_orders (stock out document) linked to orders; receipt generation via document_sequences + PDF/QR routes.

PAYMENT:
- Kashier: merchant_id / api_key / base_url settings (default empty unless configured). Integration via routes/kashierCheckout, routes/kashierWebhook, routes/kashier. Webhook verification uses HMAC (middleware preserves rawBody). No actual webhook idempotency table observed besides webhook_deliveries.
- Status tracking: orders.payment_status ('pending' / paid), orders.temp_issue (VIP pre-approval), orders.confirmed_at, admin_review_at, delivered_at.
- Refund: orders.refund_amount + refunded_at; no separate refund ledger.

RECEIPTS / DOCUMENTS:
- document_sequences (PO, SO, GR, GI, TO, RT, CM, ADJ, ISS, SUP) provide auto-numbering.
- issue_orders (receipt/issue order document) + issue_order_items (qty + unit_cost) linked to orders.
- Supply orders (purchase/receipt) as separate document system.
- PDF/QR: routes/qr, routes/invoices, routes/documentNumbers exist.

BROKEN / UNCLEAR FROM CODE:
- Without actual .env credentials (SESSION_SECRET, ADMIN_PASSWORD, Stripe, Kashier mid/key), full end-to-end checkout can't be verified live.
- Customer site references /checkout/success and /checkout/cancel; admin issue-orders exist; but full receipt generation flow not fully verified.

NO PYTHON. NODE.JS ONLY.
