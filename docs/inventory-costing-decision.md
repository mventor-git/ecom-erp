# Inventory Costing Decision — Design (No Implementation)

APPROACH: FIFO (First-In-First-Out) — recommended.
REASON: Matches existing movement ledger (inventory_movements ordered by created_at); easy historical cost tracking (consume oldest qty_before/qty_after cost first); easy returns match original lot; simpler SQLite query (ORDER BY created_at ASC per warehouse/product); less computation than weighted average.

REPRESENTATION:
- Purchase receipt creates inventory_movements (qty_change +, unit_cost = purchase cost, reference_type='purchase_order', reference_id=PO item)
- Sale creates movement (qty_change -, unit_cost = current cost of oldest unconsumed layer, reference='sales_order', reference_id=order_id/item_id or order_id)
- Return creates movement (qty_change +, unit_cost = original sale cost — must reference original order item cost snapshot; if lost, use current FIFO layer at time of return; note discrepancy)
- Damage/adjustment: movement with reason/note; accounting impact depends.

MIGRATION FROM CURRENT STATE:
1. Existing products.cost_price = current wholesale cost.
2. Existing inventory_movements from seed have 'opening_balance' with current cost.
3. Existing orders with JSON items: during migration, compute approximate historical cost from order date + current cost (approximate) OR from inventory_movements at that time (if logs exist) — but since orders are historical, exact historical cost may be lost. Migration strategy: preserve orders as-is; new orders from migration date forward use FIFO with exact cost snapshot in order_items.
4. Migration path: add order_items table (normalized) with cost_snapshot = products.cost_price at order time (approx) for historical; future orders capture exact movement cost.

NO SCHEMA CHANGES YET.
