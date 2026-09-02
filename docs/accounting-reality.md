# Accounting Reality — Comfort Sign (Audit Only, No Fixes)

SCHEMA SUPPORT (exists in DB):
- financial_periods (open/closed, opening_balance_set, start/end, months)
- price_lists (retail/wholesale/semi_wholesale/offer) + product_prices
- orders (total, items JSON, status, price_list_code, subtotal/shipping/refund_amount)
- inventory_movements (qty_change, qty_before, qty_after, unit_cost) — allows cost tracking
- products (cost_price = current wholesale cost only; no historical table per purchase)
- settings: storefront_price_list (default 'retail'), default_markup_percent (20%), doc_tax_rate, currency (EGP), timezone

ACTUAL CALCULATIONS (need verification):
- Revenue = orders.total; COGS needs cost at sale but only current cost_price exists; no FIFO/weighted-average ledger in DB (only unit_cost on movement, not linked to sold order item price at time of sale).
- Inventory value from inventory.qty_on_hand * ??? (current cost? movement last cost?)
- Reports: reports dashboard exists; schedules exist (settings: report_frequency/off); scheduled reports via service/reportService.
- Discounts from price_lists (discount_percent) or VIP policies; no historical snapshot of discount on order.
- No separate accounting table linking transactions to GL accounts; financial_period opening_balance_set = flag, not ledger.

DANGER (documented):
- If same product sold at different wholesale costs, COGS uses current cost_price, not purchase-level cost.
- Order price stored as JSON + total integer; no normalized order_items table linked with historical unit_cost (manual issue_orders uses issue_order_items with qty+unit_cost, but customer orders use JSON items).
- No audit ledger linking each order sale back to inventory_movements and cost.
- Refund amount stored but no restock link; no refund ledger.

NO CODE CHANGED.
