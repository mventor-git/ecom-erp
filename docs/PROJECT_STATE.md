# Project State

**Project:** Ecom-ERP — Open-Source E-commerce + ERP  
**Location:** `ecom-erp`  
**Current Phase:** Productization COMPLETE — 096 journey acceptance + operator docs delivered 4.26.0 (was: 096 in progress)
**Status:** Active Development - autonomous product-completion mission

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

## Build Verification (baseline 2026-09-14 — 091+gate · 092 ledger · 094/095 onboarding · 093 inventory↔GL)
- Backend: `5172` healthy + FK `PRAGMA foreign_keys=1` + nested SAVEPOINT transactions + audit events + Kashier HMAC/amount verify; **fresh DB-file boot verified**: 091 flow (JE settle→reversal→recon) + 092 (5 GL permissions, manual-JE lifecycle, statements) + **094: 55 formerly-forked columns ALL present on brand-new files, real bilingual/VIP/order inserts work, zero fake customers/reviews, ADMIN_EMAIL no longer crashes boot**; probe tracked at `server/probes/freshBootProbe.js` and spawn-safe on clean checkouts
- Frontend: admin + storefront builds clean (092 statements set; 094 /setup wizard + banner + WelcomePage empty-state escape; 095 /setup/import onboarding + Add-customer dialog)
- **Unit suite: 50 suites / 367 tests PASS, process exit 0** (live AND isolated snapshot) · **Integration 107/107** · HTTP smokes 17/17 + gate 10/10 + 092 22/22 · residue 0 incl. orphan events + stock-journal orphans (76 pre-existing product-type event orphans left INTACT by design — immutable audit history of old fixture deletions) · secret scan clean
- **Sales settlement is now canonical on every real path** (091): P1 Kashier webhook + P2 worker COD (status+proof) + P3 evidence-backed manual/admin settlement all post ONE `Dr Cash/Cr Revenue` + COGS-leg journal atomically (`sale-settled`, single-post-per-order UNIQUE, cross-channel replay-safe); refunds post a NEW mirrored cash/revenue reversal (`sale-reversed`, never edits/unposts, never restores inventory); provider refund webhook routed through the same seam; period controls fail closed on settlements AND reversals + both webhook directions. `revenueReconciliation` control flags settled-vs-journal divergence by order/source. **Post-091 gate closed the last status-only money doors: admin AND worker routes refuse `paid`/`refunded` intents (SETTLEMENT_REQUIRED / REFUND_REQUIRED), and a booked order can never be `cancelled` (LEDGER_BLOCKED at `transitionOrder` + pre-checks on mobile cancel / on-bill decline; provider trans-void never cancels posted revenue) — booked money moves ONLY through the immutable reversal seam.** Vendored docs kept honest: partial refunds / goods-returns / VIP on-bill AR / counter-sale cash are OUT of 091 (not fake-implemented).
- **GL is now OPERATIONAL (092):** /api/admin/accounting surface (CoA CRUD with referenced-delete refusal + per-account posted-only ledger · manual journals draft→post→manual-unpost with all invariants server-enforced and period-locked on BOTH sides · every bridge journal badged machine-owned and immutable · filtered journal list/detail with audit timeline) + journal-derived Trial Balance / P&L / truthful Balance Sheet (identity machine-checked, limitations surfaced) under permissions accounts.*/journals.*/ledger.read; reportService profit stays explicitly OPERATIONAL, statements are the accounting view. ADR-018.
- **THE PRODUCT ONBOARDS A REAL COMPANY (094+095):** fresh install is intentionally EMPTY (no invented customers/reviews ever again; starter scaffolding only) + derived SETUP checklist (`GET /api/admin/setup/status` → wizard `/setup`: identity/locale/warehouse/first period/catalog core + guidance; banner + redirect; never a lie — recomputed from records); master data arrives through `/setup/import` (CSV/XLSX: preview → per-line validation incl. exact-cent/money/phone/email checks → business-key dup detection → ALL-OR-NOTHING commit; products/suppliers/customers/warehouses; stock law: imports never mutate existing stock) or manual entry (Add-customer dialog with server 409/400 + audit). Legacy import force-printer side effect REMOVED.
- **LEDGER MEETS THE WAREHOUSE (093):** every value-changing stock movement reaches the books through ONE door (createMovement safePost): openings Dr1300/Cr3000, shrinkage/gains vs new 5100, booked-sale returns Dr1300/Cr5000 (091's return/refund split now complete), vendor returns Dr2100/Cr1300; receipts/issues stay owned by their bridges (classification-exclusive), transfers GL-inert; valuation = movement cost → labeled product-cost stopgap → unknown NEVER invented. Ledger-vs-inventory reconciliation GET + per-movement catch-up POST (idempotent, period fail-closed, drafts-only on block, invisible until posted) at /api/admin/accounting + admin page. Counter sales = canonical channel: validated integer-cents walk-in order → FIFO issue + settleCash sale (cash/revenue/COGS snapshot) in ONE transaction — 409 SETTLEMENT_BLOCKED leaves nothing (stock proven byte-identical), RBAC orders.create. jest.cleanup per-file sweep removes test-only orphan stock journals (production-state impossible).
- Payables live end-to-end: receipts Dr Inventory / Cr Payables per movement; supplier payments relieve AP (Dr 2100 / Cr 1000, full/partial/multi-PO, replay-safe + reversal) **with admin UI on PO detail** (payables panel, record + reverse dialogs)
- Mobile: Expo bundles OK (customer + worker) — but `API_BASE_URL http://<dev-lan-ip>:5172/api/v1` hardcoded LAN + missing `projectId`/`eas.json` — stabilization deferred
- DB: `server/data/store.db` 917KB + 30 daily backups (02:00) + `server/db.js` 61 tables (schema.sql is doc reference only)

## Blockers
- **mventor-ticket-041 (APK):** requires the user to run `npx eas-cli login` + `eas build` (Expo account) â€” no local Java/Android SDK on this machine

## Next Steps (updated 2026-09-13)
- **Autonomous product-completion mission (in progress):** 091 CLOSED (accepted) · 092 delivered · **094 (fresh-install integrity + first-run setup) + 095 (onboarding imports + manual customer entry) DELIVERED** (milestones A/B, pushed `fd68555`). **Next in flight:** 093 inventory<->GL integrity (opening-balance/shrinkage/gain + goods-return journaling + ledger-vs-inventory reconciliation control) then 096 end-to-end business-journey acceptance + product docs. STOP condition = usable-product acceptance, not ticket count.
- Prior: 091 gate fixes 4.21.1 (booked-cancel + worker money-intent closures); N1+N2 4.19.0; AP Aging 090 (+hardening); stabilization F1–F13. Details `docs/accounting-stabilization-findings.md`; ADRs 014–018.
- **Deferred accounting queue:** inventory↔GL 093 (valuation + adjustments + goods-return/RMA), supplier invoices + payment terms (true due-date aging), bank/transfer methods + bank accounts in CoA usage, cash-flow / VAT bookkeeping, retained-earnings closing. Not started without owner direction.
- **Owner triage carried (091):** ~105k-cents legacy settled_unbooked visible in revenue reconciliation — book-only-settle or leave; NOT auto-repaired.
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

