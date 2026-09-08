# VISION â€” Ecom-ERP ERP Platform

> **Project:** Ecom-ERP â€” Modular ERP Platform for Physical Therapy & Sports Equipment
> **Location:** `D:\Projects\On-Dev\ecom-erp`
> **Date:** July 28, 2026
> **Author:** CODEX
> **Version:** 3.0.0 â€” Architectural Pivot to ERP Platform

---

## 0. THE REAL VISION

### You Are Not Building a Store. You Are Building an Operating System.

This is NOT an Inventory System.
This is NOT an E-commerce Website.
This is NOT an Admin Dashboard.

This is a **modular ERP platform** that manages the complete lifecycle of products from acquisition to customer delivery and beyond.

Every line of code must answer one question:

> **"Will this still be correct after 5 years?"**

If the answer is NO â€” redesign it.

---

## 1. Project Overview

A self-hosted, modular ERP platform that runs entirely from a personal PC with **zero monthly hosting costs**. It manages the complete lifecycle of physical therapy & sports equipment â€” from supplier procurement through warehouse storage to customer delivery and returns.

### Core Architecture

```
[Internet] â†’ [Cloudflare Tunnel (HTTPS)] â†’ [Your PC: localhost:3000]
                                                     â”‚
                                           â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
                                           â”‚   Express Backend   â”‚
                                           â”‚   (Node.js :3000)   â”‚
                                           â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                                                     â”‚
                           â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
                           â”‚                         â”‚                      â”‚
                     â”Œâ”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”           â”Œâ”€â”€â”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”€â”      â”Œâ”€â”€â”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”€â”
                     â”‚  React    â”‚           â”‚   SQLite     â”‚      â”‚   Stripe     â”‚
                     â”‚  Frontend â”‚           â”‚   Database   â”‚      â”‚   API        â”‚
                     â”‚ (Vite)    â”‚           â”‚  (file-based)â”‚      â”‚  (payments)  â”‚
                     â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜           â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜      â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### Key Design Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Backend | Node.js + Express | Natural fit with React; lightweight |
| Frontend | React (Vite) | Dynamic UI, fast builds |
| Database | SQLite via `sql.js` | Zero-config, file-based, no server |
| Payments | Stripe Checkout | Free to start, PCI-compliant |
| Tunnel | ngrok | Free HTTPS, no port forwarding |
| Styling | Tailwind CSS | Utility-first, rapid prototyping |
| State | React Context (Cart) | Simple, no Redux needed for MVP |
| Architecture | Modular ERP | Survives years of evolution |

---

## 2. Project Philosophy

Every line of code must answer one question:

> "Will this still be correct after 5 years?"

If the answer is NO, redesign it.

Never implement shortcuts that create technical debt.

Always prefer:

- **Maintainability** over cleverness
- **Scalability** over speed
- **Extensibility** over simplicity
- **Security** over convenience
- **Performance** over features
- **Auditability** over speed
- **Developer Experience** over hacks

---

## 3. Platform Goal

Eventually the platform should support **without redesigning the core**:

| Module | Status |
|--------|--------|
| Inventory | Planned |
| Warehouses | Planned |
| Suppliers | Planned |
| Purchase Orders | Planned |
| Sales Orders | Existing (basic) |
| Goods Receipts | Planned |
| Goods Issues | Planned |
| Transfers | Planned |
| Returns | Planned |
| Damaged Items | Planned |
| Delivery Partners | Planned |
| Customers | Existing (basic) |
| Notifications | Planned |
| Analytics | Planned |
| Reports | Planned |
| Accounting Integration | Planned |
| CRM | Planned |
| Manufacturing | Planned |
| AI Assistant | Planned |
| Mobile Applications | Planned |
| Public API | Planned |
| Third-party integrations | Planned |

---

## 4. Architecture Rules

### 4.1 Module Isolation
- Never couple modules.
- Everything communicates through services.
- Every module owns its own business logic.
- Never duplicate logic.

### 4.2 Configuration
- Never hardcode business rules.
- Everything configurable.
- Everything role-based.
- Everything auditable.
- Everything versionable.

### 4.3 Data Integrity
- Database first.
- Relationships first.
- Indexes first.
- Constraints first.
- Data integrity first.
- Never write code before the schema is correct.

---

## 5. Inventory Philosophy

> **Inventory is NEVER a number.**
> **Inventory is the result of movements.**

### Movement Types
- Opening Balance
- Goods Receipt
- Goods Issue
- Adjustment
- Transfer
- Return
- Damage
- Reservation
- Release
- Correction
- Inventory Count

**Every stock value must always be reproducible by replaying movements.**
**Never update stock directly.**

---

## 6. Products vs Inventory

> **Products are NOT inventory.**
> **Products describe what something IS.**
> **Inventory describes WHERE it is and HOW MUCH exists.**

### Product Attributes
- Unlimited Attributes
- Variants
- SKU
- Barcode
- QR Code
- Serial Numbers
- Lots
- Batches
- Expiry
- Images
- Documents
- Attachments
- Categories
- Brands
- Suppliers

**Every inventory movement belongs to a Product Variant. NOT the Product.**

---

## 7. Document Philosophy

> **Everything is a document.**

### Document Types
- Sales Order
- Purchase Order
- Goods Receipt
- Goods Issue
- Transfer Order
- Return
- Complaint
- Shipment
- Invoice
- Adjustment

### Every Document Has
- Unique Number
- Status
- Timeline
- History
- Creator
- Approver
- Notes
- Attachments
- Audit Log
- Cancellation Reason

**Never delete documents. Cancelled is a status.**

---

## 8. Event Philosophy

> **Everything produces events.**

### Event Types
- Order Created
- Order Approved
- Goods Issued
- Shipment Assigned
- QR Scanned
- Complaint Created
- Return Approved
- Delivery Confirmed
- Inventory Adjusted
- Label Printed

**Events are immutable.**
**The Timeline is generated from events.**
**Never fake history.**

---

## 9. User Roles

| Role | Scope |
|------|-------|
| Super Admin | Full system access |
| Site Manager | Multi-warehouse oversight |
| Warehouse Manager | Single warehouse operations |
| Delivery Partner | Shipments & deliveries |
| Support | Customer-facing operations |
| Viewer | Read-only access |

**Every action requires permissions.**
**Never trust the frontend.**
**Always validate permissions on the backend.**

---

## 10. Delivery Philosophy

Delivery Partners are generic. Never integrate directly with one shipping company.

### Supported Types
- Internal Driver
- External Courier
- Future API Integration

### Each Shipment Has
- Tracking
- Timeline
- Proof of Delivery
- QR Confirmation
- Auto Confirmation Rules
- Customer Confirmation

---

## 11. QR Code Philosophy

> **QR Codes identify resources.**
> **Never hardcode behavior.**

### Scanning a QR Resolves
- Product
- Variant
- Shipment
- Purchase Order
- Sales Order
- Warehouse Location
- Serial Number

**The same QR may display different information depending on user permissions.**
- Customer sees customer data.
- Warehouse sees warehouse data.
- Admin sees everything.

---

## 12. Notification Engine

> **Everything can generate notifications.**

### Channels
- Email
- SMS
- Push
- In-App
- Webhooks

**Notifications are driven by rules. Not hardcoded.**

---

## 13. Reporting Philosophy

> **Reports never contain business logic.**
> **Reports read data.**
> **Business rules belong elsewhere.**

### Report Types
- Inventory Reports
- Stock Aging
- Dead Stock
- Demand
- Out of Stock
- ABC Analysis
- Supplier Performance
- Delivery Performance
- Return Analysis
- Complaint Analysis
- Forecasts

---

## 14. Configuration Philosophy

> **Every configurable value belongs in Settings.**

### Configurable Values
- Auto Delivery Confirmation
- Default Warehouse
- Reservation Timeout
- Low Stock Thresholds
- Notification Rules
- Label Templates
- QR Templates
- Document Numbering

**Never hardcode settings.**

---

## 15. API Philosophy

- REST-first.
- Versioned.
- Documented.
- Stable.
- Frontend must consume APIs exactly like external clients.

---

## 16. UI Philosophy

- Fast.
- Minimal.
- Professional.
- Role-driven.
- Mobile-first where required.
- Desktop optimized for ERP workflows.
- No unnecessary animations.
- Every click should reduce work.

---

## 17. AI Philosophy

> **AI is not a chatbot. AI is a Business Copilot.**

### AI Capabilities
- Explains
- Predicts
- Detects anomalies
- Suggests actions
- Summarizes data
- Generates reports
- Answers natural language questions

**Never let AI own business logic.**

---

## 18. Development Rules

- Never create placeholder code.
- Never leave TODOs.
- Never generate duplicate components.
- Never generate dead code.
- Never ignore edge cases.
- Always refactor before complexity grows.
- Always write production-grade code.
- Always think about scalability.
- Always think about future modules.

---

## 19. Decision Rule

Before implementing ANY feature ask yourself:

> Will this design survive:
> - 10 warehouses?
> - 1 million products?
> - 100 delivery partners?
> - 50 employees?
> - Multiple countries?
> - Multiple currencies?
> - Offline mode?
> - Mobile app?
> - Public API?

**If not â€” Redesign.**

---

## 20. Current State (Legacy E-commerce)

### What Exists Today
- **Landing Page** â€” Hero section, featured products, categories
- **Product Catalog** â€” Search, filter by category, product details
- **Shopping Cart** â€” Add/remove items, quantity controls, persistent (localStorage)
- **Stripe Checkout** â€” Secure credit card payments (PCI-compliant)
- **Admin Panel** â€” CRUD products, manage categories, toggle active/inactive
- **Dynamic Inventory** â€” Add/edit/delete products without touching code
- **Free HTTPS** â€” ngrok exposes your local server (no CC, no account)
- **Google OAuth** â€” Customer login with Google
- **Email Notifications** â€” Order confirmation via SMTP
- **Image Upload** â€” Drag & drop product images
- **Variant System** â€” Size + Color variants per product
- **Featured Products** â€” Admin-curated homepage display

### What Needs to Change
The current architecture treats inventory as a simple `stock` number on the product record. This must evolve into an event-sourced inventory system where stock is the result of movements.

---

## 21. Product Information (Current)

- **Type:** Dynamic inventory (51 products)
- **Storage:** SQLite database
- **Images:** Stored locally in `/server/public/images/`
- **Categories:** 6 focused categories
- **Management:** Admin panel with CRUD operations

### Product Schema (Current)

```json
{
  "id": "integer (auto)",
  "name": "string",
  "description": "text",
  "price": "integer (cents)",
  "category_id": "integer",
  "image_url": "string",
  "stock": "integer",
  "active": "boolean",
  "sizes": "json",
  "colors": "json",
  "featured": "boolean",
  "featured_order": "integer",
  "brand_id": "integer",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

---

## 22. Backend Design (Current)

### Technology
- **Runtime:** Node.js 18+
- **Framework:** Express 4.x
- **Database:** sql.js (pure JavaScript SQLite)
- **Session:** express-session + file store
- **Payments:** Stripe SDK
- **CORS:** cors middleware
- **Auth (Admin):** Simple session-based admin login
- **Auth (Customer):** Google OAuth

### API Routes (Current)

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/products` | List all active products |
| GET | `/api/products/:id` | Get single product |
| GET | `/api/categories` | List categories |
| POST | `/api/orders` | Create order record |
| POST | `/create-checkout-session` | Create Stripe checkout |
| GET | `/api/admin/products` | Admin: list all products |
| POST | `/api/admin/products` | Admin: create product |
| PUT | `/api/admin/products/:id` | Admin: update product |
| DELETE | `/api/admin/products/:id` | Admin: delete product |
| POST | `/api/admin/login` | Admin: authenticate |
| POST | `/webhook` | Stripe webhook for payment confirm |

---

## 23. Frontend Design (Current)

### Technology
- **Framework:** React 18
- **Bundler:** Vite
- **Routing:** React Router v6
- **Styling:** Tailwind CSS
- **HTTP:** Axios
- **State:** React Context (CartContext)

### Page Routes (Current)

| Route | Component | Purpose |
|-------|-----------|---------|
| `/` | `HomePage` | Hero + featured products |
| `/products` | `ProductsPage` | Browse all products with filters |
| `/products/:id` | `ProductDetailPage` | Single product view |
| `/cart` | `CartPage` | Shopping cart |
| `/checkout/success` | `SuccessPage` | Post-payment success |
| `/checkout/cancel` | `CancelPage` | Post-payment cancel |
| `/admin` | `AdminLogin` | Admin login |
| `/admin/dashboard` | `AdminDashboard` | Product CRUD table |
| `/admin/products/new` | `ProductForm` | Add new product |
| `/admin/products/:id/edit` | `ProductForm` | Edit product |

---

## 24. Database (Current)

### Schema

```sql
CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  price INTEGER NOT NULL,
  category_id INTEGER REFERENCES categories(id),
  image_url TEXT DEFAULT '',
  colors TEXT DEFAULT '[]',
  stock INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1,
  sizes TEXT DEFAULT '[]',
  featured INTEGER DEFAULT 0,
  featured_order INTEGER DEFAULT 0,
  brand_id INTEGER REFERENCES brands(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  name TEXT DEFAULT '',
  google_id TEXT UNIQUE DEFAULT '',
  avatar_url TEXT DEFAULT '',
  stripe_customer_id TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER REFERENCES customers(id),
  stripe_session_id TEXT UNIQUE,
  total INTEGER NOT NULL,
  status TEXT DEFAULT 'pending',
  items TEXT DEFAULT '[]',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sessions (
  sid TEXT PRIMARY KEY,
  sess TEXT NOT NULL,
  expired DATETIME NOT NULL
);

CREATE TABLE product_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE brands (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  icon_url TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 25. Payment Integration (Stripe)

### Flow

```
User clicks "Checkout"
       â”‚
       â–¼
Frontend POST â†’ /create-checkout-session
       â”‚
       â–¼
Backend creates Stripe Checkout Session
       â”‚
       â–¼
Stripe returns session URL
       â”‚
       â–¼
Frontend redirects to Stripe Checkout page
       â”‚
       â–¼
Customer pays on Stripe's secure page
       â”‚
       â–¼
Stripe redirects to /checkout/success (or /cancel)
       â”‚
       â–¼
Stripe webhook â†’ /webhook updates order status
```

### Webhook Events Handled
- `checkout.session.completed` â€” Mark order as paid
- `checkout.session.expired` â€” Mark order as cancelled

---

## 26. Folder Structure (Current)

```
D:\Projects\On-Dev\ecom-erp\
â”œâ”€â”€ VISION.MD                    # This file
â”œâ”€â”€ Brainstorm.md                # ERP Inventory Manager brainstorm
â”œâ”€â”€ .codex/                      # CODEX internal files
â”œâ”€â”€ docs/                        # Documentation
â”œâ”€â”€ tickets/                     # Ticket tracking
â”œâ”€â”€ logs/                        # Execution logs
â”‚
â”œâ”€â”€ server/                      # Backend
â”‚   â”œâ”€â”€ index.js                 # Express entry point
â”‚   â”œâ”€â”€ db.js                    # Database setup
â”‚   â”œâ”€â”€ schema.sql               # SQL schema
â”‚   â”œâ”€â”€ routes/
â”‚   â”‚   â”œâ”€â”€ products.js          # Public product API
â”‚   â”‚   â”œâ”€â”€ orders.js            # Order API
â”‚   â”‚   â”œâ”€â”€ admin.js             # Admin CRUD + auth
â”‚   â”‚   â””â”€â”€ stripe.js            # Stripe routes
â”‚   â”œâ”€â”€ middleware/
â”‚   â”‚   â””â”€â”€ adminAuth.js         # Auth middleware
â”‚   â”œâ”€â”€ public/
â”‚   â”‚   â””â”€â”€ images/              # Product images
â”‚   â”œâ”€â”€ package.json
â”‚   â””â”€â”€ .env                     # Stripe keys
â”‚
â”œâ”€â”€ client/                      # Customer Frontend
â”‚   â”œâ”€â”€ src/
â”‚   â”‚   â”œâ”€â”€ App.jsx
â”‚   â”‚   â”œâ”€â”€ main.jsx
â”‚   â”‚   â”œâ”€â”€ index.css            # Tailwind imports
â”‚   â”‚   â”œâ”€â”€ api/
â”‚   â”‚   â”‚   â””â”€â”€ products.js      # Axios calls
â”‚   â”‚   â”œâ”€â”€ context/
â”‚   â”‚   â”‚   â””â”€â”€ CartContext.jsx
â”‚   â”‚   â”œâ”€â”€ components/
â”‚   â”‚   â”‚   â”œâ”€â”€ Navbar.jsx
â”‚   â”‚   â”‚   â”œâ”€â”€ Footer.jsx
â”‚   â”‚   â”‚   â”œâ”€â”€ ProductCard.jsx
â”‚   â”‚   â”‚   â”œâ”€â”€ ProductGrid.jsx
â”‚   â”‚   â”‚   â”œâ”€â”€ CartItem.jsx
â”‚   â”‚   â”‚   â””â”€â”€ AdminRoute.jsx
â”‚   â”‚   â””â”€â”€ pages/
â”‚   â”‚       â”œâ”€â”€ HomePage.jsx
â”‚   â”‚       â”œâ”€â”€ ProductsPage.jsx
â”‚   â”‚       â”œâ”€â”€ ProductDetailPage.jsx
â”‚   â”‚       â”œâ”€â”€ CartPage.jsx
â”‚   â”‚       â”œâ”€â”€ SuccessPage.jsx
â”‚   â”‚       â”œâ”€â”€ CancelPage.jsx
â”‚   â”‚       â”œâ”€â”€ AdminLogin.jsx
â”‚   â”‚       â”œâ”€â”€ AdminDashboard.jsx
â”‚   â”‚       â””â”€â”€ ProductForm.jsx
â”‚   â”œâ”€â”€ public/
â”‚   â”œâ”€â”€ index.html
â”‚   â”œâ”€â”€ package.json
â”‚   â”œâ”€â”€ vite.config.js
â”‚   â”œâ”€â”€ tailwind.config.js
â”‚   â””â”€â”€ postcss.config.js
â”‚
â”œâ”€â”€ client-admin/                # Admin Frontend
â”‚   â”œâ”€â”€ src/
â”‚   â”‚   â”œâ”€â”€ App.jsx
â”‚   â”‚   â”œâ”€â”€ admin/
â”‚   â”‚   â”‚   â”œâ”€â”€ AdminLayout.jsx
â”‚   â”‚   â”‚   â”œâ”€â”€ components/
â”‚   â”‚   â”‚   â”‚   â”œâ”€â”€ ColorPicker.jsx
â”‚   â”‚   â”‚   â”‚   â”œâ”€â”€ DataTable.jsx
â”‚   â”‚   â”‚   â”‚   â”œâ”€â”€ Header.jsx
â”‚   â”‚   â”‚   â”‚   â”œâ”€â”€ Sidebar.jsx
â”‚   â”‚   â”‚   â”‚   â”œâ”€â”€ SizePicker.jsx
â”‚   â”‚   â”‚   â”‚   â”œâ”€â”€ StatCard.jsx
â”‚   â”‚   â”‚   â”‚   â””â”€â”€ StatusBadge.jsx
â”‚   â”‚   â”‚   â””â”€â”€ pages/
â”‚   â”‚   â”‚       â”œâ”€â”€ BrandsList.jsx
â”‚   â”‚   â”‚       â”œâ”€â”€ CategoriesList.jsx
â”‚   â”‚   â”‚       â”œâ”€â”€ FeaturedList.jsx
â”‚   â”‚   â”‚       â”œâ”€â”€ OrdersList.jsx
â”‚   â”‚   â”‚       â”œâ”€â”€ Overview.jsx
â”‚   â”‚   â”‚       â”œâ”€â”€ ProductEdit.jsx
â”‚   â”‚   â”‚       â””â”€â”€ ProductsList.jsx
â”‚   â”‚   â”œâ”€â”€ api/
â”‚   â”‚   â”œâ”€â”€ components/
â”‚   â”‚   â””â”€â”€ pages/
â”‚   â”œâ”€â”€ package.json
â”‚   â”œâ”€â”€ vite.config.js
â”‚   â””â”€â”€ tailwind.config.js
â”‚
â”œâ”€â”€ start.bat                    # One-click launch
â”œâ”€â”€ README.md                    # Setup instructions
â””â”€â”€ package.json                 # Root package (optional)
```

---

## 27. Build Order (ERP Platform Evolution)

### Phase 1: Foundation (Current â€” E-commerce MVP)
- [x] Project directories
- [x] Server setup (Express + SQLite)
- [x] Product CRUD API
- [x] Customer frontend (React + Vite)
- [x] Admin panel
- [x] Stripe checkout
- [x] Image upload
- [x] Email notifications
- [x] Security hardening
- [x] Google OAuth
- [x] Variant system (size + color)
- [x] Featured products
- [x] 51 real products seeded

### Phase 2: ERP Core (Next)
- [ ] **mventor-ticket-021:** Database Schema Redesign â€” Products vs Inventory separation
- [ ] **mventor-ticket-022:** Event System & Audit Trail
- [ ] **mventor-ticket-023:** Role-Based Access Control (RBAC)
- [ ] **mventor-ticket-024:** Inventory Movement Engine
- [ ] **mventor-ticket-025:** Warehouse & Location Management
- [ ] **mventor-ticket-026:** Supplier Management
- [ ] **mventor-ticket-027:** Purchase Order System
- [ ] **mventor-ticket-028:** Document Numbering System
- [ ] **mventor-ticket-029:** Notification Engine
- [ ] **mventor-ticket-030:** QR Code System
- [ ] **mventor-ticket-031:** Settings & Configuration Engine
- [ ] **mventor-ticket-032:** Reporting Engine Foundation

### Phase 3: Advanced Modules (Future)
- [ ] Goods Receipt / Goods Issue
- [ ] Transfer Orders
- [ ] Returns & Complaints
- [ ] Delivery Partners
- [ ] Stock Intelligence (ABC, Aging, Dead Stock)
- [ ] AI Business Copilot
- [ ] Mobile Applications
- [ ] Public API
- [ ] Accounting Integration
- [ ] CRM Module
- [ ] Manufacturing Module

---

## 28. Security Checklist

- [x] Stripe keys stored in `.env` (never in code)
- [x] Admin session with password (hashed with bcrypt)
- [x] Input validation on all API routes
- [x] SQL injection prevention (parameterized queries)
- [x] CORS restricted to frontend origin
- [x] HTTPS via ngrok Tunnel (free)
- [x] No credit card data stored (Stripe handles it)
- [x] Rate limiting on login endpoint
- [x] Environment variables for all secrets
- [ ] Role-based access control (mventor-ticket-023)
- [ ] Audit trail for all mutations (mventor-ticket-022)
- [ ] Document-level permissions (mventor-ticket-023)
- [ ] API versioning (mventor-ticket-028)

---

## 29. Cost Breakdown

| Item | Cost |
|------|------|
| Code | Free (open source tools) |
| Backend runtime | Free (Node.js) |
| Database | Free (SQLite) |
| Frontend framework | Free (React + Vite) |
| Tunnel | Free (ngrok) |
| Stripe fees | 2.9% + $0.30 per transaction |
| Total monthly | **$0.00** (minus transaction fees) |

---

## 30. Final Mission

> **Build software that can become the operating system of a real company.**
>
> Do not chase features.
> Engineer a platform.
> Every module must feel inevitable.
> Every decision must have a reason.
> Every line of code must be worthy of production.
>
> **This is THE REAL VISION.**
> **Protect it.**

---

*This document serves as the architectural blueprint for the Ecom-ERP ERP Platform. All implementation shall follow this vision.*
