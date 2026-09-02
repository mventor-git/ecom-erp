# System Audit — Comfort Sign ERP / E-Commerce Platform

Date: 2026-08-25
Source: D:\Projects\on-dev\comfort-sign-deploy (project root)
Status: INITIAL (post-audit, pre-implementation)

## A. System Architecture

- Customer Website (port ~5173): React + Vite + Tailwind (client/)
- Admin Panel (port ~5174): React + Vite + Tailwind (client-admin/)
- Backend (port 5172): Express 4.x + sql.js (SQLite file-based) + session-file-store + Helmet + CORS + rate-limit + compression + morgan + passport (Google OAuth) + CSRF middleware
- Database: SQLite (sql.js) — schema in server/schema.sql, initialized via server/db.js
- Payments: Stripe checkout/session + webhook; Kashier routes exist but real-access status unknown
- Static images: /images, /uploads; product images in server/public/images/

## B. Existing Modules (routes in server/index.js)

Public / Customer:
- /api/products, /api/orders, /auth (Google OAuth), /api/wishlist, /api/settings, /api/announcements, /api/hero-slides
- /api/qr (QR code routes)
- /api/v1/* mobile API (auth, products, cart, orders, wishlist, user, images, notifications, webhooks, worker)

Admin:
- /api/admin/products, bulk, trash, import/export, inventory, settings, notifications, users, upload, warehouses, purchase-orders, reports, integrations, invoices, warehouse-orders, views, price-lists, pickingPacking, pricing, kashier + checkout + webhook, shipping, suppliers, customers, systemReset, back-ups, 2fa, events, ai
- /api/admin/announcements, hero-slides, welcome-slides
- /api/admin/price-lists, document-numbers

## C. Current Admin Sidebar (client-admin/src/admin/Sidebar.jsx / AdminLayout.jsx)

Not fully reconstructed in audit, but pages exist for:
Overview, ProductsList, ProductEdit, CategoriesList, BrandsList, FeaturedList, OrdersList, IssueOrdersList, CustomersList, SuppliersList, SupplyOrdersList, PurchaseOrdersList, WarehouseOrdersList, WarehousesList, InventoryMovements / InventoryDashboard, ReportsDashboard, FinancialPeriods, SettingsPage, NotificationsPage, UsersList, EventsList, IntegrationsPage, ShippingDashboard, PackingDashboard, PriceLists, PricingEngine, PricingProfit, KashierPage, WelcomeSlidesList, Announcements (if built)

The sidebar needs consolidation around the business workflow (Dashboard → Sales → Inventory → Purchasing → Operations → Pricing → Finance → Website → System) per master prompt.

## D. Routes (key backend endpoints verified from index.js)

- Health: GET /api/health
- CSRF token: GET /api/admin/csrf-token
- Products (public + admin): listed above
- Orders (public + admin): /api/orders, mobile /api/v1/orders
- Admin auth: /api/admin/login (session-based, rate-limited)
- Payments: Stripe /create-checkout-session + /webhook; Kashier /api/admin/kashier, /api/kashier/checkout, /api/kashier/webhook
- AI: /api/ai (chat), /api/admin/ai
- Announcements / hero-slides / welcome-slides: both public + admin
- QR: /api/qr

## E. Backend Services (files in server/)

- db.js (init, queries)
- routes/*.js (many — see list above)
- middleware/adminAuth.js, csrf.js
- services/ (backupService, reportService, orderWorkflowService)
- cache.js

## F. Database Entities (from server/db.js / schema.sql — initial inspection)

Tables observed/referenced:
- categories, products, product_images, customers, orders, sessions, brands
- warehouses, shelves, suppliers (routes exist; verify tables)
- inventory movements (routes exist; verify table + movement types)
- announcements, hero_slides, welcome_slides
- settings / config tables (settings routes)
- users, roles, permissions (users route)
- audit/log tables (events route; audit route implied)
- financial periods (FinancialPeriods page)
- price lists (priceLists route)
- purchase orders / supply orders (purchaseOrders, suppliers routes)
- notifications (notifications route)
- QR records (qr route)
- AI settings/config (adminAI)

Exact schema must be verified in server/db.js and schema.sql to confirm all required entities (product variants, SKU tracking, inventory receipt items, cost layers, stock ledger, opening balance, return receipts, refund records, damage records, delivery states) are present.

## G. Working Features (verified / partially verified)

- Admin login with session + rate limit + CSRF
- Product CRUD (admin routes + public listing + detail)
- Category and brand management
- Image upload (admin upload route + static serving)
- Cart (client context + mobile cart API)
- Checkout with Stripe (session creation + webhook)
- Google OAuth for customers
- AI assistant (Ollama integration at /api/ai/chat, admin settings at /api/admin/ai)
- Announcements / hero slides / welcome slides (DB + API + customer display)
- Variant display on product page (fixed per TODO — colors first, sizes dependent)
- Search (client-side debounced)
- Hero slider component (Ken Burns, CSS transitions, admin-managed slides)
- Real-time announcements on homepage (via API fetch)

## H. Partially Working Features

- Variant management (UI exists; confirm SKU-level inventory tracking)
- Inventory management (routes exist; confirm movement-based ledger rather than simple stock field)
- Warehouse / shelf tracking (routes exist; confirm tables + integration)
- Supplier integration (routes exist; confirm purchase receipt / cost tracking)
- Pricing engine (routes exist; confirm retail vs wholesale separation + bulk edit + validation)
- VIP pricing / customer discounts (routes / pages exist; confirm backend applies correctly and saves snapshot with order)
- Returns / refunds (routes / pages exist; confirm full workflow with inspection and accounting)
- Delivery / driver workflow (routes exist; confirm proof-of-delivery)
- Accounting / profitability (reports / financial pages exist; confirm derived from real transactions)
- QR engine (routes exist; confirm separate admin / purchase / invitation types and deterministic generation)

## I. UI-Only Features (need backend verification)

- Some admin statistics / overview cards (verify data source)
- Hero slider config (verify DB persistence + event broadcast if real-time updates required)
- Announcement scheduling (verify start/end dates respected by public endpoint)
- Product analytics / intelligence (verify metrics computed from real transactions)

## J. Backend-Only Features

- Backup service (scheduled + manual via /api/admin/backups)
- Report generation (scheduled + on-demand)
- Order workflow auto-approval sweep (service-level)
- Mobile APIs (v1 endpoints) — need verification of complete coverage
- Webhook handling (Stripe + Kashier) — verify idempotency, signature verification, duplicate protection

## K. Broken / Unverified Features

- Price range slider (marked critical in old TODO; need test after audit)
- Variant photo upload (marked high priority; need DB + API verification)
- Real-time update infrastructure (SSE / WebSocket — may be partial or missing despite UI expectations)
- Google Maps integration (search for geocoding / delivery location usage)
- Kashier production integration (if broken/misconfigured — document and use Mock provider)
- Some admin modules may have duplicate or overlapping pages (need consolidation per prompt rule 4)

## L. Mocked Features

- If Kashier not testable: MockPaymentProvider / SandboxPaymentProvider must implement full interface and simulate PENDING / AUTHORIZED / PAID / FAILED / EXPIRED / REFUNDED / PARTIALLY_REFUNDED
- If any external API unavailable: must be documented in docs/implementation-log.md, not hidden behind fake success

## M. Duplicated Features (watch for per rule 4)

- Product management appears in admin routes + mobile products + import/export + trash — verify single authoritative service layer
- Orders appear in /api/orders + mobile /api/v1/orders + admin orders + warehouse orders — verify unified pipeline
- Inventory appears in inventory route + movements + warehouse orders + reports — verify single ledger source
- Notifications may appear in notifications route + events + mobile notifications — consolidate

## N. Missing Features (per master vision / VISION.MD)

- Explicit inventory-cost-layer tracking with historical receipt preservation (must verify)
- Opening Balance module with SKU-based entry + category/warehouse/shelf/supplier links + finalization + lock
- Financial period definition with start/end/status and opening inventory values
- Full stock movement ledger (OPENING_BALANCE, STOCK_IN, STOCK_OUT, SALE, RETURN, DAMAGE, ADJUSTMENT, TRANSFER, RESERVATION, RELEASE) — verify each has records
- Inventory valuation consistent with chosen method (FIFO / weighted avg)
- Customer invitation QR + signup linkage + attribution analytics
- Audit log for every critical mutation (price, VIP discount, opening balance, adjustments, refund, delivery, etc.)
- End-to-end test suite covering all 55 minimum scenarios (required by master prompt)

## O. Security Concerns

- Session secret default in dev; must be strong in production (already enforced via exit in index.js if production + weak secret)
- Admin auth uses session + password; verify hashing (bcrypt?) and no plaintext
- CSRF middleware applied globally; verify token endpoint and usage
- Rate limits applied correctly (api / admin / auth / checkout)
- Input validation on routes (must verify every mutation endpoint)
- SQL injection risk low if parameterized (verify db.js / route patterns)
- File upload security (verify image validation, size limits, path traversal protection)
- Webhook HMAC verification for Stripe (rawBody preserved) — verify Kashier webhook also has verification if applicable
- No secrets exposed in frontend code (verify .env not bundled into client/dist)

## P. Data Integrity Concerns

- Historical purchase cost must never be overwritten by new wholesale cost (rule 3 / 12)
- Order prices / discounts / tax must remain historically correct (rule 3)
- Inventory quantity must be derived from ledger, not overwritten (rule 21 / 22)
- Retail price changes must not retroactively change completed orders (rule 28 / 90)
- VIP discount changes must not change historical order prices (rule 28)
- Accounting must use actual transaction/inventory valuation (rule 11 / 49 / 51)
- Financial period opening balance must be locked after finalization (rule 15)

## Q. Inventory Concerns

- Must not treat inventory as simple quantity = X (rule 21)
- Must support multiple cost layers (rule 13 / 50)
- Must support same product with different wholesale costs over time (rule 12 / 18)
- Must not change historical inventory cost because most recent purchase changed (rule 13 / 51)
- Costing method must be documented and consistent for sales/returns/damage/transfers/valuation/COGS/profit (rule 14)
- Stock reservation / release must not allow double consumption (rule 39)

## R. Accounting Concerns

- Revenue = actual selling price; COGS = actual inventory valuation (rule 49)
- Gross Profit = Revenue - COGS; Gross Margin = Gross Profit / Revenue
- Discounts / returns / damages / shipping / VAT / inventory value tracked separately
- Profit by product / customer / channel derived from unified transactions with metadata (rules 53 / 54 / 55)
- Predictions clearly labeled as forecasts (rule 47 / 60)
- No invented accounting values (rule 48)

## S. Payment Concerns

- Do not trust client-side payment success (rule 35 / 36)
- Backend must confirm payment via webhook / provider (rule 35)
- Idempotency required: duplicate webhook must not create order twice / deduct stock twice / refund twice (rule 37 / 43)
- If real Kashier unavailable: Mock/Sandbox provider with same interface must be used (rule 36)
- Order status flow must include ORDERED / APPROVED / AWAITING_PAYMENT / PAID / PARTIALLY_PAID / CANCELLED (rule 32)

## T. Returns / Refunds Concerns

- Return eligibility: order status + delivery completed + delivery timestamp + current time + policy + product eligibility + previous return status (rule 61)
- Customer request must be recorded (date, order, customer, products, variants, qty, reason, contact, original transaction) (rule 62)
- Admin notification must include customer, email, phone, order, receipt, products, variants, qty, dates, driver, picker, packer, warehouse, timestamps, reason, submitted date (rule 64)
- Admin actions: APPROVE / REJECT / REQUEST MORE INFO / POSTPONE — must be logged (rule 64)
- Return receipt / return order must contain full metadata (rule 65)
- Driver logistics: accept, pick up, mark pickup, return to warehouse — record timestamps (rule 66)
- Warehouse inspection result: RESELLABLE / DAMAGED / MISSING_PARTS / USED / OTHER (rule 67)
- Restock through proper inventory movement; damaged through DAMAGED_STOCK movement (rule 67 / 68)
- Refund linked across order → return → inspection → payment → accounting (rule 69)
- Refund not complete until provider confirms (rule 69 / 70)

## U. Proposed Architecture (per master prompt + VISION.MD)

- One backend is source of truth; frontend requests only
- Inventory is event-sourced / movement-based (not direct quantity updates)
- Product and Variant are separate; Inventory belongs to Variant + SKU + Warehouse + Shelf
- Sales engine unified (website / VIP / manual / warehouse / credit) with channel metadata
- Pricing engine: base retail → VIP discount → final price; snapshot saved with order
- Payment provider abstraction (Kashier / Mock / Sandbox) with identical business logic
- Accounting derives from real transactions; never modifies historical cost / price
- Audit preserved for critical mutations (actor, action, entity, timestamp, reference, old/new state)
- Admin sidebar reorganized around business workflows (Dashboard, Sales, Inventory, Purchasing, Operations, Pricing, Finance, Website, System)

## V. Proposed Implementation Sequence

Refer to master prompt phases (0–25):
0 Audit → 1 Cleanup → 2 DB model → 3 Product/Variant → 4 Warehouse/Shelf/Supplier → 5 Stock Ledger / Movements → 6 Financial Period / Opening Balance → 7 Stock In / Multi-Cost → 8 Retail Pricing → 9 VIP Invitations / Pricing → 10 Website Pricing → 11 Sales Engine / Order → 12 Provider Abstraction / Payment → 13 Issue Receipts → 14 Reservation / Picking / Packing → 15 Drivers / Delivery → 16 Accounting / COGS / Profit → 17 Intelligence → 18 Returns / Return Receipt → 19 Damaged Stock → 20 Refund → 21 QR → 22 Notifications → 23 Audit / Security → 24 Testing → 25 Performance / Docs

Every phase requires: compile, tests, preserved features, rollback boundary, TODO.md update, docs/implementation-log.md entry.
