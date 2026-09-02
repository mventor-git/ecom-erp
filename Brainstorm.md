# 🧠 Brainstorm: Comfort-Sign Inventory Manager

> **Date:** July 28, 2026
> **Inspired by:** Top ERP apps (Odoo, SAP, NetSuite, Zoho Inventory, Microsoft Dynamics)

---

## What You Already Have ✅
- Basic product CRUD with stock field
- Categories, brands, orders management
- Featured products & image gallery
- Stripe checkout with order tracking
- Simple stock number per product

## What Top ERPs Do That You Don't (Yet) ❌
Top ERP inventory modules treat stock as a **live, traceable, multi-location asset** — not just a number on a product record.

---

## 🎯 5 Inventory Manager Feature Buckets

### **1. 🏭 Multi-Warehouse & Location Tracking**
*Like Odoo/Zoho Inventory*

**The idea:** Don't just track total stock — track *where* the stock lives.

| Feature | Description |
|---------|-------------|
| **Warehouses** | Main storage, retail floor, returns bay, damaged goods |
| **Bin/Shelf locations** | Within each warehouse: Aisle-Row-Shelf (e.g., A-03-12) |
| **Transfer orders** | Move stock between locations with audit trail |
| **Default picking location** | Each product has a preferred bin |

**Why it fits Comfort-Sign:** Physical therapy equipment is bulky — knowing WHERE things are matters.

---

### **2. 📦 Inventory Movements & Audit Trail**
*Like SAP/Microsoft Dynamics*

**The idea:** Every stock change is a *transaction* with reason code, not a silent UPDATE.

```json
{
  "product_id": 42,
  "type": "outgoing",
  "reason": "sale",
  "reference": "Order #1034",
  "qty_change": -2,
  "before": 14,
  "after": 12,
  "warehouse_id": 1,
  "user_id": "admin",
  "timestamp": "2026-07-28T10:30:00Z"
}
```

**Movement types to support:**
- `sale` → Order fulfillment
- `purchase` → Supplier restock
- `return` → Customer returns
- `transfer` → Between warehouses
- `adjustment` → Physical count correction (+/-)
- `damage` → Write-off
- `sample` → Demo units

---

### **3. 🚨 Low Stock & Reorder Alerts**
*Like NetSuite/Zoho*

**Min/Max levels per product:**
- `min_stock` → Triggers "low stock" warning
- `max_stock` → Suggested max to hold
- `reorder_point` → When to auto-suggest purchase
- `preferred_supplier` → Link to supplier

**Dashboard widgets:**
- 🔴 Red items (below min)
- 🟡 Yellow items (approaching reorder point)
- 🟢 Green items (healthy stock)

**Smart notifications:**
- Email alert when stock drops below threshold
- In-app banner on admin dashboard
- "Suggested reorder" list generated weekly

---

### **4. 📊 Stock Intelligence & Reporting**
*The ERP "secret sauce"*

| Report | What It Shows |
|--------|---------------|
| **Stock Value Report** | `qty_on_hand * cost_price` per product/category |
| **ABC Analysis** | 80/20: which 20% of products drive 80% of revenue |
| **Slow Movers** | Products with zero sales in 90 days — candidates for discount |
| **Stock Aging** | How long items have been sitting (dead stock) |
| **Turnover Rate** | `COGS / avg_inventory` — how fast you sell through |
| **Stockout Frequency** | How many times a product hit zero and missed sales |

**Visual layer:** Charts.js or Recharts integration in admin dashboard:
- Inventory value over time (line chart)
- Category stock distribution (pie chart)
- Top 10 most-watched products (bar chart)

---

### **5. 🔄 Purchase Orders & Supplier Management**
*Full procurement cycle*

**Supplier table:**
- Name, contact, email, phone, lead time (days)
- Preferred/alternate status
- Historical performance (on-time %)

**Purchase Order (PO) workflow:**
1. Create PO for supplier (automated from reorder alerts)
2. Set status: `draft → sent → confirmed → received → cancelled`
3. On "received" → stock auto-increments with audit trail
4. Partial receipts supported

**Quick reorder:** One-click "Create PO" from the low-stock list.

---

## 🧩 Proposed Database Schema Additions

```sql
-- New tables for the ERP-like inventory manager

CREATE TABLE warehouses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  address TEXT,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE locations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
  name TEXT NOT NULL,
  barcode TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE inventory_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id),
  warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
  location_id INTEGER REFERENCES locations(id),
  type TEXT NOT NULL,
  reason TEXT,
  reference TEXT,
  qty_change INTEGER NOT NULL,
  qty_before INTEGER NOT NULL,
  qty_after INTEGER NOT NULL,
  unit_cost INTEGER,
  note TEXT,
  created_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE product_suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id),
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
  sku_code TEXT,
  unit_cost INTEGER,
  is_preferred INTEGER DEFAULT 0,
  lead_time_days INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  notes TEXT,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE purchase_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
  status TEXT DEFAULT 'draft',
  total_cost INTEGER,
  notes TEXT,
  ordered_at DATETIME,
  received_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE purchase_order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  po_id INTEGER NOT NULL REFERENCES purchase_orders(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  qty_ordered INTEGER NOT NULL,
  qty_received INTEGER DEFAULT 0,
  unit_cost INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Add new columns to existing products table
-- ALTER TABLE products ADD COLUMN min_stock INTEGER DEFAULT 0;
-- ALTER TABLE products ADD COLUMN max_stock INTEGER DEFAULT 0;
-- ALTER TABLE products ADD COLUMN reorder_point INTEGER DEFAULT 0;
-- ALTER TABLE products ADD COLUMN cost_price INTEGER DEFAULT 0;
-- ALTER TABLE products ADD COLUMN barcode TEXT DEFAULT '';
-- ALTER TABLE products ADD COLUMN weight_kg REAL DEFAULT 0;
```

---

## 🖥️ Admin UI — New Pages

| Route | Component | Purpose |
|-------|-----------|---------|
| `/admin/inventory` | `InventoryDashboard` | Stock overview, low stock alerts, quick stats |
| `/admin/inventory/movements` | `MovementsList` | Full audit trail with filters (type, date range, product) |
| `/admin/inventory/warehouses` | `WarehousesList` | Manage warehouses & locations |
| `/admin/inventory/transfer` | `CreateTransfer` | Move stock between warehouses |
| `/admin/inventory/adjust` | `StockAdjustment` | Manual stock correction with reason |
| `/admin/suppliers` | `SuppliersList` | CRUD for suppliers |
| `/admin/purchase-orders` | `PurchaseOrdersList` | PO management |
| `/admin/purchase-orders/new` | `PurchaseOrderForm` | Create PO from low-stock suggestions |
| `/admin/reports/inventory` | `InventoryReports` | Charts & analysis |

**Navigation restructure:**
```
📦 Inventory
  ├── 🏠 Dashboard
  ├── 📋 Stock Movements
  ├── 🏭 Warehouses
  ├── 🔄 Transfer Stock
  ├── ✏️ Adjust Stock
📦 Purchasing
  ├── 🏢 Suppliers
  ├── 📄 Purchase Orders
📊 Reports
  ├── 📈 Inventory Reports
  ├── 📉 Stock Analysis
```

---

## 🚀 Implementation Phases (Low to High Effort)

### **Phase 1: Foundation (Week 1)**
1. Add `min_stock`, `max_stock`, `reorder_point`, `cost_price`, `barcode` columns to products
2. Create `warehouses` table + seed "Main Warehouse"
3. Create `inventory_movements` table
4. Add stock movement recording on every order checkout (Stripe webhook)
5. Simple "Inventory Dashboard" page showing stock levels + low-stock warnings

### **Phase 2: Warehouse & Locations (Week 2)**
1. Full CRUD for warehouses & locations
2. Transfer stock between warehouses
3. Manual stock adjustment with reason
4. Filter products by warehouse

### **Phase 3: Suppliers & Purchase Orders (Week 3)**
1. Supplier CRUD
2. Purchase order creation (manual + from reorder suggestions)
3. PO receiving workflow (partial support)
4. Auto-increment stock on PO receive

### **Phase 4: Reports & Intelligence (Week 4)**
1. Stock value report
2. ABC analysis
3. Slow movers report
4. Stock turnover rate
5. Charts in dashboard

---

## 💡 Wild Ideas (The "Wouldn't It Be Cool If..." List)

1. **Barcode scanning via webcam** — Use `quagga.js` or `html5-qrcode` to scan product barcodes for receiving/picking
2. **Inventory freeze during physical count** — Lock stock movements during annual inventory count, compare system vs. actual
3. **Auto-reorder with approval** — System generates POs automatically; admin approves in one click
4. **Serial number tracking** — For high-value medical equipment (wheelchairs, CPAP machines), track individual serial numbers through their lifecycle
5. **Kit/Bundle management** — "Knee Surgery Recovery Kit" = 1 brace + 2 packs of ice wraps + 1 exercise band; kitting decrements all component stock
6. **Expiry date tracking** — For medical supplies with expiry dates; alert before expiration
7. **Sales-to-inventory ratio per product** — "Sell-through rate" — how much of your stock actually sells per month
8. **Drop-ship mode** — Mark products as drop-shipped (no stock tracked); PO auto-sent to supplier on customer order
9. **Inventory reservation** — Hold stock for 15 minutes while customer is in checkout to prevent overselling
10. **Multi-currency cost tracking** — Import costs in USD/EUR, convert to local for reporting

---

## 🏆 Top Pick Recommendation

If I had to prioritize: **Phase 1 + Inventory Movements + Low Stock Alerts.**

Start with:
1. **Inventory movements table** (audit trail on every sale/return)
2. **Min/max stock levels** on products
3. **Dashboard widget** showing 🔴 items below min stock

This gives you the **core ERP inventory superpower** (traceability + proactive alerts) in under a week, with the least schema disruption. Everything else (warehouses, POs, suppliers, reports) builds naturally on this foundation.
