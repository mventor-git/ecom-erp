# Data Integrity Decisions — Ecom-ERP (Design Only)

SOURCE OF TRUTH (Part A): inventory_movements ledger is authoritative; inventory snapshot is derived materialized state; products is metadata only. products.stock should become read-only or deprecated (backward compat via migration that copies current value into opening_balance + removes writes to stock field).

MOVEMENT TYPES (Part B): OPENING_BALANCE (creates, +qty, carries unit_cost, affects accounting opening balance, can be finalized not reversed easily); STOCK_IN (receipt, +, cost, yes); STOCK_OUT (sale/issue, -, yes); SALE (from order, -, cost from cost layer, yes); RETURN (restock, +, cost = original sale cost, yes); DAMAGE (waste, -, yes, no restock); ADJUSTMENT (count correction, +/-, yes if cost applies); TRANSFER_IN/OUT (warehouse, +/-, cost preserved); RESERVATION (reserved qty, no cost change, affects available); RELEASE (unreserve, no qty change, frees available).

MULTIPLE COSTS (Part C): Keep existing product_variants + inventory snapshot; ADD InventoryLot / cost-layer tracking via inventory_movements.unit_cost historical + purchase_order_items.unit_cost. Minimal safe model: inventory_movements retains unit_cost at time; order_items (normalized) store cost_snapshot. No new table required if movements + order_items both store historical cost.

FIFO vs WEIGHTED AVERAGE (Part D): Recommend FIFO for simplicity + historical traceability (oldest cost consumed first) + easy return matching. Weighted average requires layer recalculation. SQLite sufficient for FIFO (order by movement date). Migration: existing stock gets opening_balance with current cost; future receipts use FIFO.

COGS (Part E): Historical COGS = cost_snapshot from order_items (or movement at sale time) — must NOT change when newer purchase cost updates. Changing cost_price tomorrow must not revise yesterday's order cost.

ORDERS (Part F): Hybrid. Keep orders.items JSON for simple cases but ADD normalized order_items (product_id, variant_id, qty, price, discount, cost_snapshot, tax, price_list_code, channel). Preserve existing JSON; new orders write both. Migration reads JSON to populate new table.

PRICING HISTORY (Part G): order_items.price = historical selling price; product_prices = current price list overrides; vip_customer_policies = active discount; historical orders immutable.

VIP (Part H): customer → vip_customer_policies (discount_pct, active). Order must store price_list_code + applied_discount + final_price. Customer site reads settings + policies and applies to displayed price; server validates at checkout.

INVITATIONS (Part I): vip_invites (code, customer_id via used_by, discount) + customer_invitation_links (attribution_confirmed) + vip_cart (items for VIP by admin). Reports can aggregate by invite_id via customer_invitation_links.

CHANNEL (Part J): orders.sales_channel (website/vip_website/manual/warehouse/credit) + orders.customer_id (same customer across channels). Analytics break down by channel.

FINANCIAL PERIOD (Part K): financial_periods control opening balance + period closing; opening balance attaches to period start; finalized period cannot change (status closed + closing timestamp). Historical transactions reference period via created_at within range.

KASHIER (Part L): State machine: CREATED → PENDING → PAID / FAILED / EXPIRED → REFUND_REQUESTED → REFUND_PROCESSING → REFUNDED / PARTIALLY_REFUNDED. Idempotency: webhook_deliveries + event_key unique + order_state check (only process if current < target). Amount/currency verification against order.total / settings.currency.

RETURNS (Part M): return_request → approved → picked_up → received → inspected → restocked / damaged → refunded. Each stage creates inventory movement + refund record.

DAMAGE (Part N): damaged_stock table or inventory_movements with type='damage' + note + inspection result; qty reduced; not restocked; accounting write-off.

NO IMPLEMENTATION YET.
