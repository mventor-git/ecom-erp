# Order Pricing / History Design — Design Only

ORDER MODEL: orders (metadata) + order_items (line-level normalized) + orders.items JSON (backward-compat).
ORDER_ITEMS COLUMNS (minimal safe addition):
id PK, order_id FK, product_id FK, variant_id FK, sku, qty, base_retail_price (cents), discount_type (percent/fixed/none), discount_value, discount_amount, final_price (cents), price_list_code, cost_snapshot (cents), tax_rate, tax_amount, notes, created_at.

SNAPSHOT RULES:
- At checkout time, server reads product price + price list + customer VIP policy + variant info.
- Writes final values into order_items (immutable after creation).
- Changing retail price / VIP discount / wholesale cost later does NOT modify historical order_items cost_snapshot or final_price.
- Accounting COGS uses cost_snapshot from order_items, not current products.cost_price.
- Refund calculates from order_items.final_price (snapshotted), not current price.

JSON COMPATIBILITY: orders.items remains; new code reads from order_items for calculations; JSON kept for legacy / display simplicity; sync script can regenerate JSON from order_items if needed.

NO DB MIGRATION APPLIED.

## Reality status (mventor-ticket-069, 2026-09-07)
- Migrations 004/005 HAVE applied the normalized columns live; writers now mirror qty/base_price/final_price (same facts, both names); admin lines carry real FIFO unit cost_snapshot.
- cost_snapshot is honestly UNKNOWN for pre-069 history and mobile lines — line-cost truth stays in inventory_movements + cost_consumption until a dedicated costing ticket. Never fabricated.
- orders.items JSON duality + "new code reads order_items for calculations" remain DESIGN (not yet reality) — separate track.
