-- Phase 6 — Cost Consumption Persistence (additive)
CREATE TABLE IF NOT EXISTS cost_consumption (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  order_item_id INTEGER REFERENCES order_items(id) ON DELETE SET NULL,
  cost_layer_id INTEGER NOT NULL REFERENCES inventory_cost_layers(id) ON DELETE RESTRICT,
  qty_consumed INTEGER NOT NULL DEFAULT 0,
  unit_cost INTEGER NOT NULL DEFAULT 0,
  total_cost INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_cost_consumption_order ON cost_consumption(order_id);
CREATE INDEX IF NOT EXISTS idx_cost_consumption_layer ON cost_consumption(cost_layer_id);
CREATE INDEX IF NOT EXISTS idx_cost_consumption_order_item ON cost_consumption(order_item_id);
