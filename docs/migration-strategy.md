# Migration Strategy — Design Only (No Execution)

STAGED (critical first, never big-bang):

1. ADD order_items normalized table (no deletion of orders.items JSON) — existing orders preserved; new orders write both.
2. DEPRECATED products.stock writes — add check in code; keep reads; create opening_balance if needed; migrate existing stock to inventory_movements + inventory (already done in db.js); after confirmation, remove writes to stock.
3. ADD cost_snapshot to order_items (new orders only; historical orders approximate from order date if needed).
4. ADD inventory cost-layer tracking via existing inventory_movements.unit_cost + new order_items.cost_snapshot — no new table needed.
5. UPDATE pricing snapshot logic: checkout writes final_price, discount, cost_snapshot; server validates; admin price changes only affect new orders.
6. Migrate VIP pricing enforcement to server-side at checkout; add customer_invitation_links attribution queries.
7. Add webhook idempotency checks (event_key check) without changing webhook payload format.
8. Financial period closing rules (status=closed, no edits).
9. Test each stage independently.

NO DATABASE MODIFICATION YET — design documented only.
