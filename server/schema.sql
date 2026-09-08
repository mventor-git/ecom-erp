-- Ecom-ERP - Database Schema (v3.0.0 — ERP Platform)
-- Ecom-ERP — Modular ERP Platform

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- CORE TABLES (E-commerce Foundation)
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS brands (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  icon_url TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  price INTEGER NOT NULL,
  category_id INTEGER REFERENCES categories(id),
  image_url TEXT DEFAULT '',
  colors TEXT DEFAULT '[]',
  stock INTEGER DEFAULT 0,              -- LEGACY: kept for backward compatibility
  active INTEGER DEFAULT 1,
  sizes TEXT DEFAULT '[]',
  featured INTEGER DEFAULT 0,
  featured_order INTEGER DEFAULT 0,
  hero_title_color TEXT DEFAULT '#ffffff',
  hero_desc_color TEXT DEFAULT '#ffffff',
  hero_price_color TEXT DEFAULT '#ffffff',
  hero_badge_color TEXT DEFAULT '#ffffff',
  brand_id INTEGER REFERENCES brands(id),
  -- ERP columns (mventor-ticket-021)
  cost_price INTEGER DEFAULT 0,         -- cents, for COGS calculation
  weight_kg REAL DEFAULT 0,
  is_trackable INTEGER DEFAULT 1,       -- track inventory?
  default_warehouse_id INTEGER REFERENCES warehouses(id),
  barcode TEXT DEFAULT '',
  sku TEXT DEFAULT '',
  min_stock INTEGER DEFAULT 0,
  max_stock INTEGER DEFAULT 0,
  reorder_point INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS product_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  name TEXT DEFAULT '',
  google_id TEXT UNIQUE DEFAULT '',
  avatar_url TEXT DEFAULT '',
  stripe_customer_id TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER REFERENCES customers(id),
  stripe_session_id TEXT UNIQUE,
  total INTEGER NOT NULL,
  status TEXT DEFAULT 'pending',
  items TEXT DEFAULT '[]',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
  sid TEXT PRIMARY KEY,
  sess TEXT NOT NULL,
  expired DATETIME NOT NULL
);

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- ERP INVENTORY TABLES (mventor-ticket-021)
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

-- Warehouses â€” physical storage locations
CREATE TABLE IF NOT EXISTS warehouses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  address TEXT DEFAULT '',
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Locations â€” bins/shelves within warehouses
CREATE TABLE IF NOT EXISTS locations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
  name TEXT NOT NULL,
  barcode TEXT DEFAULT '',
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Inventory Movements â€” the source of truth for stock
-- Inventory is NEVER a number. Inventory is the result of movements.
CREATE TABLE IF NOT EXISTS inventory_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id),
  warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
  location_id INTEGER REFERENCES locations(id),
  type TEXT NOT NULL,                   -- opening_balance, receipt, issue, adjustment, transfer, return, damage, reservation, release, correction, count
  reason TEXT DEFAULT '',
  reference_type TEXT DEFAULT '',       -- purchase_order, sales_order, transfer_order, adjustment, etc.
  reference_id INTEGER,
  qty_change INTEGER NOT NULL,
  qty_before INTEGER NOT NULL,
  qty_after INTEGER NOT NULL,
  unit_cost INTEGER DEFAULT 0,          -- cents, for COGS calculation
  note TEXT DEFAULT '',
  created_by TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Product Variants â€” for SKU/barcode/serial tracking
CREATE TABLE IF NOT EXISTS product_variants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id),
  sku TEXT DEFAULT '',
  barcode TEXT DEFAULT '',
  qr_code TEXT DEFAULT '',
  serial_number TEXT DEFAULT '',
  lot_number TEXT DEFAULT '',
  batch_number TEXT DEFAULT '',
  expiry_date DATE,
  attributes TEXT DEFAULT '{}',         -- JSON: {size: "Large", color: "Red"}
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Inventory â€” current stock per product per warehouse per location
-- This is a snapshot table for fast reads. Source of truth is inventory_movements.
CREATE TABLE IF NOT EXISTS inventory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id),
  variant_id INTEGER REFERENCES product_variants(id),
  warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
  location_id INTEGER REFERENCES locations(id),
  qty_on_hand INTEGER DEFAULT 0,
  qty_reserved INTEGER DEFAULT 0,
  min_stock INTEGER DEFAULT 0,
  max_stock INTEGER DEFAULT 0,
  reorder_point INTEGER DEFAULT 0,
  last_counted_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(product_id, variant_id, warehouse_id, location_id)
);

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- MOBILE APP TABLES (mventor-ticket-035)
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

CREATE TABLE IF NOT EXISTS device_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  device_token TEXT NOT NULL,
  platform TEXT NOT NULL, -- 'android', 'ios', 'web'
  app_version TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, device_token)
);

CREATE TABLE IF NOT EXISTS notification_preferences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) UNIQUE,
  order_updates INTEGER DEFAULT 1,
  promotions INTEGER DEFAULT 1,
  new_arrivals INTEGER DEFAULT 0,
  price_alerts INTEGER DEFAULT 1,
  low_stock_alerts INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS webhooks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL,
  secret TEXT NOT NULL,
  events TEXT NOT NULL DEFAULT '[]', -- JSON array of event types
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  webhook_id INTEGER NOT NULL REFERENCES webhooks(id),
  event_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  response_status INTEGER,
  response_body TEXT,
  delivered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  success INTEGER DEFAULT 0
);

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- SEED DATA
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

-- Seed default medical categories
INSERT OR IGNORE INTO categories (name, slug) VALUES ('Diagnostic Equipment', 'diagnostic');
INSERT OR IGNORE INTO categories (name, slug) VALUES ('Patient Monitoring', 'monitoring');
INSERT OR IGNORE INTO categories (name, slug) VALUES ('Mobility & Accessibility', 'mobility');
INSERT OR IGNORE INTO categories (name, slug) VALUES ('Respiratory Care', 'respiratory');
INSERT OR IGNORE INTO categories (name, slug) VALUES ('First Aid & Emergency', 'firstaid');

-- Seed default warehouse
INSERT OR IGNORE INTO warehouses (name, code, address) VALUES ('Main Warehouse', 'WH-MAIN', '');

-- VIP Invitation + Customer Attribution (Phase 9)
CREATE TABLE IF NOT EXISTS vip_invites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invite_code TEXT UNIQUE NOT NULL,
  customer_name TEXT DEFAULT '',
  customer_email TEXT DEFAULT '',
  segment_type TEXT DEFAULT 'vip',           -- vip, premium, regular
  discount_pct INTEGER DEFAULT 0,             -- e.g., 10 for 10%
  qr_code TEXT DEFAULT '',
  signup_url TEXT DEFAULT '',
  is_active INTEGER DEFAULT 1,
  created_by TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customer_invitation_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  invite_id INTEGER NOT NULL REFERENCES vip_invites(id),
  attribution_confirmed INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vip_customer_policies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id) UNIQUE,
  discount_pct INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
