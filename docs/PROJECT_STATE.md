# Project State

**Project:** Ecom-ERP — Open-Source E-commerce + ERP  
**Location:** `ecom-erp`  
**Current Phase:** ERP Platform â€” All Core Modules Complete  
**Status:** Active Development  

## Architecture
- **Backend:** Node.js + Express + SQL.js
- **Frontend (Customer):** React 18 + Vite + Tailwind CSS (port 5173)
- **Frontend (Admin):** React 18 + Vite + Tailwind CSS (port 5174)
- **Mobile (Customer):** Expo (React Native + TypeScript) â€” `mobile-app/`, runs via Expo Go on Android/iOS
- **Mobile (Staff/Worker):** Expo (React Native + TypeScript) â€” `worker-app/`, staff JWT app for drivers/pickers/packers
- **Payments:** Stripe Checkout
- **Tunnel:** ngrok (free HTTPS, no CC, no account)
- **Sessions:** File-based session store (custom `store_sid` cookie)
- **File Upload:** Multer (disk storage in `server/public/images/`)
- **Email:** Nodemailer with configurable SMTP (graceful degradation if unconfigured)
- **Caching:** In-memory TTL cache for product listings + settings cache
- **Compression:** Gzip on all responses
- **Rate Limiting:** Express-rate-limit on API, login, checkout
- **Security Headers:** Helmet (CSP, HSTS, X-Frame-Options)
- **CSRF Protection:** Token-based on admin state-changing routes
- **Input Validation:** Validate module for product, login, order status
- **RBAC:** Role-based access control with 6 roles, 26 permissions
- **Events:** Immutable event system with 27+ event types
- **QR Codes:** Generate/resolve QR codes for resources

## Current Progress
- [x] Project foundation â€” server, routes, DB, frontend scaffold, admin panel
- [x] 51 real products seeded from Excel data
- [x] Order management API â€” list/filter/stats/status update
- [x] Sales dashboard â€” 6 stat cards (revenue, orders, pending, today, avg)
- [x] Admin dashboard tabs â€” Products / Orders with status filters
- [x] Image upload â€” drag & drop, preview, replace/delete, file validation
- [x] Email notifications â€” order confirmation + admin notification via SMTP
- [x] Performance & Caching â€” compression, rate limiting, product cache, unit tests
- [x] Production Hardening â€” security headers, CSRF, input validation, error handling
- [x] ngrok tunnel â€” free HTTPS, no CC, no account needed
- [x] Google OAuth customer login â€” sign in with Google, account page, order history
- [x] Stacked Photos CSS effect â€” Polaroid-style photo stack on hero section
- [x] Modular Admin Dashboard â€” Sidebar layout, split pages, reusable admin components
- [x] Product Colors System â€” Per-product color variants with linked photos, color swatches, cart integration
- [x] Variant Indicator System â€” SizeSelector, ColorSwatches, cart integration
- [x] Featured Products System â€” Admin page, HomePage, PhotoStack integration
- [x] Neutral demo catalog (061) — 10 generic products across 5 neutral categories
- [x] Size Variants â€” Admin SizePicker, Customer SizeSelector, cart size tracking
- [x] Image Completion â€” All 51 products now have images
- [x] **Architectural Pivot** â€” VISION.MD rewritten as ERP platform blueprint
- [x] **mventor-ticket-020** â€” Admin auth verified (login, CSRF, session, protected routes)
- [x] **mventor-ticket-021** â€” Database Schema Redesign â€” ERP inventory tables created, existing stock migrated
- [x] **mventor-ticket-022** â€” Event System & Audit Trail â€” Immutable events, event service, API endpoints
- [x] **mventor-ticket-023** â€” Role-Based Access Control â€” Users/roles/permissions, RBAC middleware, user management API
- [x] **mventor-ticket-024-Beta-Test** â€” Comprehensive system testing â€” all passed
- [x] **mventor-ticket-024** â€” Inventory Movement Engine â€” 11 movement types, stock calculation, low stock alerts, audit replay
- [x] **mventor-ticket-025** â€” Warehouse & Location Management â€” Warehouse/location CRUD, atomic stock transfers
- [x] **mventor-ticket-026** â€” Supplier Management â€” Supplier CRUD, product-supplier links
- [x] **mventor-ticket-027** â€” Purchase Order System â€” Full PO lifecycle, goods receipt with inventory movements
- [x] **mventor-ticket-028** â€” Document Numbering System â€” Auto-generate document numbers (PO-2026-0001 format)
- [x] **mventor-ticket-029** â€” Notification Engine â€” Rule-driven notifications (email, in-app, webhook)
- [x] **mventor-ticket-030** â€” QR Code System â€” Generate/resolve QR codes for products, locations, documents
- [x] **mventor-ticket-031** â€” Settings & Configuration Engine â€” Centralized settings with categories, cache
- [x] **mventor-ticket-032** â€” Reporting Engine â€” 10 report types, CSV export
- [x] **mventor-ticket-017** â€” Currency Display â€” Changed from USD ($) to EGP (Ø¬.Ù…) across all frontend files
- [x] **mventor-ticket-019** â€” Variant Image Assignment â€” Link gallery images to specific color/size variants
- [x] **mventor-ticket-033** â€” Admin ERP Frontend â€” Inventory Dashboard, Stock Movements, Warehouses & Locations pages
- [x] **mventor-ticket-034** â€” Admin ERP Frontend â€” Remaining Modules: Suppliers, Purchase Orders, Reports, Settings, Events, Users, Notifications
- [x] **mventor-ticket-037** â€” Comprehensive System Debug & Variant Image Generation â€” Fixed 9 critical bugs, created missing tables, generated 119 variant images, seeded hero slides and announcements
- [x] **mventor-ticket-038** â€” API Integrations Management â€” Admin panel page (Mail SMTP, SendGrid, Paymob, Stripe, AI, Google Maps + custom keys), masked secrets, live Test Connection endpoints; services read config from settings at runtime
- [x] **mventor-ticket-035a** â€” Webhook System & Mobile API Testing â€” Webhook CRUD routes (`/api/v1/webhooks`), event integration, 63 mobile API tests; fixed 3 real bugs (google_id UNIQUE, customers.updated_at, route shadowing)
- [x] **mventor-ticket-039** â€” Customer Android App (Expo) â€” `mobile-app/`: JWT login/register, product browsing + search + categories, product detail with color/size variants, server-side cart, checkout (COD), order history + cancel, account profile
- [x] **mventor-ticket-040** â€” Mobile App Enhancements â€” push notifications (token registration + Notifications screen, backend push channel via Expo push API), wishlist (route + tab + hearts), Google sign-in (backend /auth/customer/google + expo-auth-session), APK build prep (eas.json, branded icons, app.json package)
- [x] **mventor-ticket-036 (v1)** â€” Worker App â€” `worker-app/` (Expo): staff JWT login, active order list + stats, workflow-validated status updates, proof-of-delivery photo capture with COD auto-pay; backend `/api/v1/worker` (orders/detail/status/proof/stats, staff-only)
- [x] **Admin email** — configured via `ADMIN_EMAIL` (.env, DB, db.js default)

## Database
- **Products:** 10 neutral demo products (+ test rows created by the suite)
- **Categories:** 5 neutral categories (Electronics, Home & Kitchen, Fashion, Grocery, Beauty & Care)
- **Brands:** Demo, Basics, Standard, Essential (+ Generic seed default)
- **Images:** 145 total product images (26 main gallery + 119 variant images)
- **ERP Tables:** warehouses, locations, inventory_movements, product_variants, inventory, events, roles, permissions, role_permissions, users, suppliers, product_suppliers, document_sequences, notification_rules, notifications, in_app_notifications, settings, purchase_orders, purchase_order_items
- **Mobile Tables:** cart_items, order_items, user_addresses, device_tokens, notification_preferences
- **ERP Product Columns:** cost_price, weight_kg, is_trackable, default_warehouse_id, barcode, sku, min_stock, max_stock, reorder_point

## Build Verification (baseline 2026-09-12 — N1/N2 remediation)
- Backend: `5172` healthy + FK `PRAGMA foreign_keys=1` + nested SAVEPOINT transactions + audit events + Kashier HMAC/amount verify; **fresh DB-file boot verified working incl. `categories.icon` + durable idempotency schema**
- Frontend: admin build clean (no FE change in this pass)
- **Unit suite: 44 suites / 249 tests PASS, process exit 0** (+N1 claims suite 8, +N2 checkout-isolation suite 6; earlier root-fixes unchanged)
- **Integration: 107/107 PASS, exit 0** (was 7 failed / exit 1 at 4d2420d via `po-item` litter leaking `sort=newest`). `npm run test:isolated` → 249/249 **exit 0** on a snapshot copy (live DB untouched, proven deterministic)
- Payables live end-to-end: receipts Dr Inventory / Cr Payables per movement; supplier payments relieve AP (Dr 2100 / Cr 1000, full/partial/multi-PO, replay-safe + reversal) **with admin UI on PO detail** (payables panel, record + reverse dialogs)
- Mobile: Expo bundles OK (customer + worker) — but `API_BASE_URL http://<dev-lan-ip>:5172/api/v1` hardcoded LAN + missing `projectId`/`eas.json` — stabilization deferred
- DB: `server/data/store.db` 917KB + 30 daily backups (02:00) + `server/db.js` 61 tables (schema.sql is doc reference only)

## Blockers
- **mventor-ticket-041 (APK):** requires the user to run `npx eas-cli login` + `eas build` (Expo account) â€” no local Java/Android SDK on this machine

## Next Steps (updated 2026-09-12)
- **mventor-ticket-088/089 COMPLETED and committed** (push `42c300d`→`4d2420d`); **stabilization F1–F13 committed `0f57522`** (pushed).
- **Readiness checkpoint 4.18.1:** F11 data SAFE; unit exit 0 honest; N1 (idempotencyService) + N2 (orders idempotency_key) reported.
- **N1+N2 REMEDIATED 4.19.0 (owner directive):** durable actor+endpoint+key+request-fingerprint claims (`idempotency_records`); owner-scoped guest-order idempotency with `(customer_id,idempotency_key)` UNIQUE + `idem_fp`; fresh-start `categories.icon` boot blocker also fixed; 14 new regression tests.
- **Accounting stabilization F1–F13 + readiness checkpoint 4.18.1:** forensic review + fixes + 18 regression tests; details `docs/accounting-stabilization-findings.md`; CHANGELOG [4.18.0] + [4.18.1] + [4.19.0].
- **Next (await owner decision):** ticket 090 AP aging report — the prior N1/N2 blockers are resolved; still **not** implemented per directive; owner go pending. Remaining per gap-map: bank method, advances, supplier invoices (invoice-grain application), AP aging, financial statements.
- Deferred: mobile/worker LAN + eas.json stabilization, Paymob gateway, Google Android OAuth, AI Copilot, API docs refresh.

## Mobile App Architecture
**Decision:** Single unified admin app (PWA) for all employees with role-based access control

- **One App, Multiple Roles:** All employees use the same admin app
- **Custom Roles:** Super admins can create any role name (e.g., "Delivery Driver", "Cashier", "Inventory Clerk")
- **Permission Checkboxes:** Admin assigns granular permissions via UI checkboxes
- **Dynamic UI:** Interface adapts based on user's permissions (show/hide features)
- **PWA Technology:** Installable on mobile devices, works offline, native-like experience
- **No Separate Apps:** Employees don't need different apps â€” permissions control access

This approach reduces maintenance overhead while providing flexibility for different business needs.

## Architectural Direction
The project has pivoted from a simple e-commerce store to a **modular ERP platform**. The VISION.MD reflects "THE REAL VISION" â€” building software that can become the operating system of a real company. Key principles:

- Inventory is NEVER a number â€” it's the result of movements
- Products describe WHAT something IS â€” Inventory describes WHERE and HOW MUCH
- Everything is a document â€” never delete, cancelled is a status
- Everything produces events â€” immutable, auditable
- Never couple modules â€” communicate through services
- Every configurable value belongs in Settings
