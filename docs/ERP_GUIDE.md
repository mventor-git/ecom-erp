# 📖 Ecom-ERP — Owner's Guide to Your ERP & Warehouse System

**Written for:** You, the business owner. No accounting knowledge needed. No coding knowledge needed.
**Last updated:** August 2026 (after the Trash System was added)

---

## Table of Contents

1. [The Big Picture — What Is This System?](#1-the-big-picture)
2. [Your Admin Panel — Where Everything Lives](#2-your-admin-panel)
3. [The Storefront Side (What Customers See)](#3-the-storefront-side)
4. [The Warehouse System Explained](#4-the-warehouse-system)
5. [Every Module & How To Use It](#5-every-module--how-to-use-it)
6. [The Trash System (Delete All + Restore)](#6-the-trash-system)
7. [Automated Functions (Things That Happen By Themselves)](#7-automated-functions)
8. [Reports Explained Simply](#8-reports-explained-simply)
9. [Users, Roles & Permissions](#9-users-roles--permissions)
10. [Everyday Recipes (Step-by-Step)](#10-everyday-recipes)
11. [Safety Rules Built Into The System](#11-safety-rules)
12. [Known Limits & Good Habits](#12-known-limits--good-habits)

---

## 1. The Big Picture

Your system is one program running on your PC that manages **the whole life of a product**:

```
Supplier  →  Purchase Order  →  Warehouse (stock IN)  →  Customer Order
                                                              ↓
        Refund / Return  ←  Delivery  ←  Packing  ←  Picking
```

Think of it as **three shops in one**:

| Part | What it is | Where |
|------|-----------|-------|
| **Storefront** | Your online shop where customers browse and buy | http://localhost:5173 |
| **Admin Panel (ERP)** | Your private control room — products, stock, orders, reports | http://localhost:5174 |
| **API (the engine)** | The brain that stores everything and enforces the rules | http://localhost:5172 |

You normally only touch the **Admin Panel**. The other two work behind the scenes.

**The golden rule of your system:** stock is never "a number someone typed". Stock is the *result of every movement* that ever happened (goods in, goods out, damage, transfers...). That's why it can always be rebuilt and audited.

---

## 2. Your Admin Panel

Open **http://localhost:5174**, log in with your admin username/password.

The sidebar is organized like a filing cabinet:

- **Overview** — today's numbers at a glance
- **Catalog** — Products, Trash, Featured, Categories, Brands, Home Page
- **Sales** — Orders, Customers
- **Warehouse** — Inventory, Movements, Warehouses, Supply Orders, Issue Orders, Periods, Picking/Packing, Shipping
- **Purchasing** — Suppliers, Purchase Orders
- **Insights** — Reports, Events, Notifications
- **System** — Settings, Integrations, Users, Paymob, AI

*(If a section name looks closed, click it once — it opens like a tree branch.)*

---

## 3. The Storefront Side

Customers can also buy from a **mobile app** (Android) and there is a **worker app** for your driver/packers:

- **Customer app:** browse, cart, pay (card or cash on delivery), order history, wishlist.
- **Worker app:** staff log in, see assigned orders, mark picked → packed → shipped → delivered, take a **photo as proof of delivery**, and mark cash payments as received.

---

## 4. The Warehouse System

### 4.1 Warehouses and Locations
- A **Warehouse** is a physical place (e.g., "Main Warehouse").
- Inside each warehouse you can define **Locations** — shelves/bins (e.g., "A1", "A2") so you know exactly *where* inside the warehouse an item sits.

### 4.2 Stock = Movements
Every change to stock is recorded as a **Movement**. There are 11 types:

| Movement | Meaning | Stock |
|----------|---------|-------|
| Opening balance | Starting count when you begin | ▲ IN |
| Receipt | Goods arrived (from supplier/transfer) | ▲ IN |
| Return | Customer returned goods | ▲ IN |
| Correction | Fixing a mistake | ▲/▼ |
| Count | Physical stocktake ("we counted 23") | sets exact |
| Issue | Goods left the warehouse (sale/dispatch) | ▼ OUT |
| Damage | Broken/expired goods | ▼ OUT |
| Reservation | Someone reserved stock (promised) | 🔒 held |
| Release | Reservation cancelled | 🔓 freed |
| Transfer | Moved between warehouses/locations | moves |
| Adjustment | Manual correction by admin | ▲/▼ |

You almost never create movements by hand — they happen automatically when you receive POs, issue orders, or do counts. But you **can** do it manually from **Inventory → Movements** (e.g., "5 units got damaged").

### 4.3 Reservations (the "promise" system)
When stock is *reserved*, it stays on the shelf but is marked as promised to someone. Available stock = what's on hand minus what's reserved. This prevents selling the same item twice.

### 4.4 Low stock protection
Each product has a **Reorder Point** (e.g., alert me when fewer than 5 remain). When stock touches that line, the system raises a **Low Stock Alert** automatically (see §7).

### 4.5 Safety rails
- You **cannot** move more stock than exists (unless you explicitly allow negative stock in Settings).
- You **cannot** delete a warehouse that still has stock in it — transfer first.
- Trashed products (§6) are frozen: no movements can touch them until restored.

---

## 5. Every Module & How To Use It

### 📦 Products
Your catalog. Each product has name, price, cost price, category, brand, images, colors/sizes, barcode/SKU, reorder point.
- **Add:** Products → "+ Add" → fill the form → Save.
- **Edit:** click **Edit** on any row.
- **Remove one:** **Delete** on the row → goes to **Trash** (recoverable!).
- **Remove everything:** red **"🗑 Delete All Products"** button → confirm → all go to Trash and the warehouse resets (see §6).

### ⭐ Featured
Choose which products appear on the home page hero/featured area, and in what order.

### 📁 Categories / 🏷️ Brands
Groupings for the shop menu. Categories are required on products; brands are optional.

### 🏠 Home Page
Configure banners/slides customers see first.

### 🗑️ Trash
Deleted products wait here. Restore anytime — see §6.

### 📋 Orders
Every customer order with its status journey:
`pending → paid → confirmed → picking → packing → ready for shipping → shipped → delivered → completed`
Plus `cancelled` and `refunded`. Change status from the order page; the customer gets emails at key steps (confirmed/shipped/delivered). Orders follow the **quadruple confirmation** rule (see §7.2).

### 👤 Customers
Everyone who bought or signed up, with contact info and order history.

### 📦 Inventory (dashboard)
Live view of stock per product per warehouse/location, plus quick links to low-stock items.

### 📋 Movements
The full history log of every stock change — who did it, when, why, before/after quantities. This is your audit trail; entries here are permanent.

### 🏭 Warehouses
Create/edit warehouses and their shelf locations. Deactivate (never delete) empty ones.

### 📥 Supply Orders (إذن توريد)
"Goods IN note." Use when stock arrives without a formal purchase order (e.g., informal restock):
1. Create supply order → add products + quantities.
2. Click **Issue** → stock enters the warehouse and a printable document with QR code is generated.

### 📤 Issue Orders (إذن صرف)
"Goods OUT note." Use when stock leaves for reasons other than a website sale (e.g., gift, internal use):
1. Create issue order → add products + quantities.
2. Choose warehouse → **Issue** → stock leaves, document generated, packing team notified.

### 🗓️ Periods (Financial Periods)
A way to slice time (like "Year 2026"). For each period you can set an **opening balance** — the counted starting stock. Closing a period freezes it as a chapter of your history.

### 📦 Picking/Packing
When an order reaches *picking*/*packing* status, tasks appear here for warehouse staff to grab, pick the items from shelves, and pack them.

### 🚚 Shipping
Manage couriers/shipment providers and track dispatch.

### 🤝 Suppliers
Your source addresses. Link suppliers to products so you remember who sells what and at what cost.

### 📄 Purchase Orders (POs)
The formal buying flow:
`draft → sent → confirmed → partially received → received` (or cancelled).
- Create PO listing products/quantities/costs → send it to the supplier.
- When goods arrive: open the PO → **Receive** → enter what actually arrived (partial is fine) → stock enters the warehouse automatically with the correct cost.

### 🏷️ Price Lists
Alternative price groups (e.g., wholesale vs retail) you can define separately from the main price.

### 💳 Paymob
Local payment gateway page (Vodafone Cash / Instapay) — configure keys from Integrations first.

### 📊 Reports — see §8.

### 📜 Events
A security-camera-style log: every important action (login, product created, order shipped...) is recorded forever. If anything ever looks wrong, this is where you investigate.

### 🔔 Notifications
In-panel alerts for things like new orders, low stock, approvals waiting.

### ⚙️ Settings
Switches for the whole system: allow negative stock?, order statuses, auto-approval timeout, delivery estimate, scheduled reports, etc.

### 🔌 Integrations
Connect outside services: Stripe (cards), SendGrid/SMTP (email), Google Maps, AI keys. Paste keys once; the system uses them everywhere.

### 👥 Users
Your staff accounts and their roles (see §9).

---

## 6. The Trash System

**Nothing is ever deleted for real.** Deleting moves things to a safe waiting room.

### Delete ALL products (the big red button)
**Products → "🗑 Delete All Products"** → read the message → confirm.
What happens:
1. Every product moves to **Trash** (they vanish from the shop and admin lists).
2. **Warehouse stock resets to zero** (shelves are empty).
3. The full movement history is kept safely inside the system.

### Add products afterwards? No problem.
New products you add after deleting are completely independent.

### Restore everything
**Products → Trash → "♻ Restore All"**
All trashed products come back **with their original stock** (rebuilt from history) — *and* the new products you added in the meantime stay untouched. Nothing is lost on either side.

### Restore just one
**Products → Trash → "Restore"** next to that product.

### Rules
- Trashed products are frozen: nobody can move stock for them until restored.
- Deleting a single product (row Delete button) uses the same trash — same restore path.
- The Trash never auto-expires. Items wait as long as you want.

---

## 7. Automated Functions

Things the system does **by itself**, no action needed from you:

### 7.1 Stock sync between ERP and storefront
Whenever stock changes in the warehouse, the number shown to web/mobile customers updates automatically.

### 7.2 Quadruple order confirmation
When `order_flow_enabled` is ON in Settings, an order must pass up to four gates before it's confirmed:
1. **Payment verified** (Stripe said "paid")
2. **Stock available** (all items really exist in the warehouse)
3. **Manual approval** (you click approve), OR
4. **Auto-approval** after a timeout you set (default 24h) — so orders never get stuck if you're asleep.

Failed checks bounce the order to "admin review" and you get a notification explaining exactly which gate failed.

### 7.3 Scheduled reports
Reports can generate themselves daily/weekly/monthly (Settings → report schedule). Files land in the reports area automatically.

### 7.4 Low-stock & out-of-stock alerts
Crossing the reorder point fires an alert event → notification appears for staff with inventory permissions.

### 7.5 Notification engine
Events (order created, shipped, low stock...) automatically notify the right people inside the panel — based on their role permissions.

### 7.6 Webhooks
For tech-minded integrations: you can register a URL and the system will POST every chosen event to it in real time (with signature secret). Manage under the webhook endpoints/API.

### 7.7 Document numbering
Every PO, supply/issue order, invoice gets a sequential official number (`PO-2026-0001`) automatically — no duplicates, ever.

### 7.8 QR codes on documents
Every generated document carries a QR code + barcode. Scanning it later pulls up that exact document/product in the panel.

### 7.9 Idempotency protection
If a checkout or stock movement is submitted twice by accident (double-click, bad internet), the system recognizes the duplicate and ignores the second one. No double charges, no double stock.

---

## 8. Reports Explained Simply

| Report | Question it answers |
|--------|--------------------|
| Inventory Value | "How much money do I have sitting on shelves?" |
| Stock Aging | "How long has stuff been sitting here?" |
| Dead Stock | "What isn't moving at all?" |
| Low Stock | "What's about to run out?" |
| Out of Stock | "What's already gone?" |
| ABC Analysis | "Which few products make most of my money?" |
| Turnover Rate | "How fast does each product sell through?" |
| Sales Report | "What did I sell, when?" |
| Supplier Performance | "Who delivers well?" |
| Stockout Frequency | "What keeps running out on me?" |

All reports can be exported to **CSV (Excel)** and some to PDF/Markdown. Trashed products are excluded from stock reports automatically (they come back after restore).

---

## 9. Users, Roles & Permissions

Staff accounts live under **Users**. Roles decide what each person sees and can do:

| Role | Meant for |
|------|-----------|
| Super Admin | You — everything |
| Site Manager | Day-to-day operations |
| Warehouse Manager | Stock, warehouses, picking |
| Delivery Partner | Shipments/deliveries |
| Support | Customer service views |
| Viewer | Look but don't touch |

⚠️ **Honest note:** the permission system exists and works on most screens, but some warehouse/inventory screens currently trust any logged-in staff. Tightening that fully is on the fix list (see the August 2026 investigation report). Until then: only give accounts to people you trust.

---

## 10. Everyday Recipes

**📥 Goods arrived from supplier (formal):**
Suppliers → check it exists → Purchase Orders → New PO → add items → Send → later: Receive (enter actual quantities) → done, stock is in.

**📥 Goods arrived informally:**
Warehouse → Supply Orders → New → add items → Issue → stock is in + printable doc.

**📦 A website order arrives:**
Orders → open it → verify payment → Confirm → move through Picking → Packing → Ready → Shipped → Delivered. Staff can do the middle steps from the worker app.

**🧯 3 items got broken:**
Inventory → Movements → New movement → type **Damage**, quantity −3, reason → save.

**🔢 Yearly shelf counting:**
Periods → create period → set opening balances by walking the shelves and entering counted quantities → the system adjusts everything to reality.

**🚚 Moving 10 units from Main to Branch:**
Inventory → Warehouses → Transfer → pick product, from/to, quantity → done (two linked movements are recorded; if anything fails midway it rolls back).

**💣 Start over with an empty catalog:**
Products → **Delete All Products** → confirm. Shop empties, warehouse resets. Import fresh catalog (CSV import on Products page). Regret nothing → Trash → Restore All brings everything back with original stock.

---

## 11. Safety Rules

Built into the walls of the system:

1. **Documents are never deleted** — cancelled is a status, not erasure.
2. **Movements are forever** — stock can always be re-checked against history.
3. **Trash is reversible** — delete-all is recoverable, including stock.
4. **No overselling via reservations** — promised stock can't be promised again.
5. **No negative stock** unless you explicitly allow it in Settings.
6. **Duplicate submissions are ignored** (idempotency).
7. **Everything important is logged** in Events — who, what, when.
8. **Passwords are hashed**, sessions expire, login attempts are rate-limited.

---

## 12. Known Limits & Good Habits

**Limits (be aware):**
- Designed for **one PC, one warehouse team** — not for many simultaneous branches.
- Practical ceiling around ~10,000 products (database lives in memory for speed).
- ngrok free tunnel changes its web address on restart (a stable address is planned).
- Some screens still let any staff member do warehouse actions (permission tightening pending).

**Good habits:**
- Export a **CSV backup** of products monthly (Products → Export).
- Copy the folder `server/data/` somewhere safe weekly — that file IS your company's memory.
- Do a **Count** movement when physical stock doesn't match the screen — trust the shelves, not the screen.
- Before big experiments: use **Delete All → test → Restore All** freely. That's what it's for.

---

*This guide describes Ecom-ERP ERP v4.10 (tickets 044–046). Generated with care for a non-technical owner — if any section is unclear, ask and it will be rewritten.*
