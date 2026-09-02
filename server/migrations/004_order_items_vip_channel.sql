-- Phase 4 DB Foundation — order_items + sales_channel (additive)
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id),
  variant_id INTEGER,
  sku TEXT DEFAULT '',
  qty INTEGER NOT NULL DEFAULT 1,
  base_price INTEGER NOT NULL DEFAULT 0,
  discount_type TEXT DEFAULT 'none',
  discount_value INTEGER DEFAULT 0,
  discount_amount INTEGER DEFAULT 0,
  final_price INTEGER NOT NULL DEFAULT 0,
  price_list_code TEXT DEFAULT 'retail',
  tax_rate REAL DEFAULT 0,
  tax_amount INTEGER DEFAULT 0,
  cost_snapshot INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);
-- variant index skipped (variant_id no FK constraint)
ALTER TABLE orders ADD COLUMN sales_channel TEXT DEFAULT 'website';
CREATE INDEX IF NOT EXISTS idx_order_items_variant ON order_items(variant_id);
