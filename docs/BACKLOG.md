# Backlog

## Active
- **mventor-ticket-036 (v2):** Worker app follow-ups â€” order assignment to workers, picker/packer camera scanning, push for new assignments, offline queue, EAS APK (`eas build -p android --profile preview`)
- **mventor-ticket-041 (Ready â€” needs user):** Customer APK via EAS cloud â€” prep done (eas.json, package, icons), requires `npx eas-cli login` + `eas build --platform android --profile preview`

## Planned
- **mventor-ticket-011 (Planned):** Paymob Payment Gateway (Vodafone Cash + Instapay) â€” Plan ready in `tickets/mventor-ticket-011.md`

## Completed
- **mventor-ticket-036 (v1):** Worker App â€” `worker-app/` (Expo): staff JWT login, order list + stats, workflow-validated status updates, proof-of-delivery photo (COD auto-pay); backend `/api/v1/worker` staff-only endpoints; 12 integration tests (107/107 total)
- **mventor-ticket-040:** Mobile App Enhancements â€” push notifications (register/unregister + Notifications screen, backend push channel), wishlist (mobile route + tab + hearts), Google sign-in (backend token exchange + expo-auth-session), APK build prep (eas.json, branded icons, app.json package/scheme), fixed /me session-restore bug
- **mventor-ticket-039:** Customer Android App (Expo) â€” `mobile-app/`: JWT login/register, product browse/search/categories, variants, server cart, COD checkout, order history + cancel, account
- **mventor-ticket-037:** Comprehensive System Debug & Variant Image Generation â€” Fixed 9 critical bugs (missing tables, schema mismatches), created cart_items/order_items/user_addresses tables, generated 119 variant images with Sharp, seeded 145 gallery images, hero slider now uses featured products
- **mventor-ticket-034:** Admin ERP Frontend â€” Remaining Modules: Suppliers, Purchase Orders, Reports, Settings, Events, Users, Notifications pages, sidebar navigation, routes
- **mventor-ticket-033:** Admin ERP Frontend â€” Inventory Dashboard, Stock Movements, Warehouses & Locations pages, sidebar navigation, API client functions
- **mventor-ticket-032:** Reporting Engine â€” 10 report types (inventory value, stock aging, dead stock, low stock, out of stock, ABC analysis, turnover rate, sales, supplier performance, stockout frequency), CSV export
- **mventor-ticket-031:** Settings & Configuration Engine â€” Centralized settings with categories, in-memory cache, public/private settings, batch update
- **mventor-ticket-030:** QR Code System â€” Generate/resolve QR codes for products, locations, documents; permission-based resolution
- **mventor-ticket-029:** Notification Engine â€” Rule-driven notifications (email, in-app, webhook), template interpolation, notification log
- **mventor-ticket-028:** Document Numbering System â€” Auto-generate document numbers (PO-2026-0001 format), 8 document types, configurable sequences
- **mventor-ticket-027:** Purchase Order System â€” Full PO lifecycle (draftâ†’sentâ†’confirmedâ†’received), goods receipt with inventory movements, partial receipts
- **mventor-ticket-026:** Supplier Management â€” Supplier CRUD, product-supplier links, preferred supplier tracking
- **mventor-ticket-025:** Warehouse & Location Management â€” Warehouse/location CRUD, atomic stock transfers between locations
- **mventor-ticket-024:** Inventory Movement Engine â€” 11 movement types, stock calculation from movements, low stock alerts, audit replay
- **mventor-ticket-019:** Variant Image Assignment â€” Link gallery images to specific color/size variants, variant-filtered gallery on customer frontend
- **mventor-ticket-017:** Currency Display â€” Changed all price displays from USD ($) to EGP (Ø¬.Ù…) across 11 frontend files
- **mventor-ticket-024-Beta-Test:** Comprehensive System Testing â€” All backend APIs, frontends, database integrity, and ERP features verified. System stable.
- **mventor-ticket-023:** Role-Based Access Control (RBAC) â€” Users, roles, permissions tables, RBAC middleware, user management API, integrated with admin login
- **mventor-ticket-022:** Event System & Audit Trail â€” Immutable events table, event service, API endpoints, integrated with orders/products/admin login
- **mventor-ticket-021:** Database Schema Redesign â€” Products vs Inventory separation, warehouses, locations, inventory_movements, product_variants, inventory tables, migration of existing stock
- **mventor-ticket-020:** Fix Local Admin Authentication â€” Verified login, CSRF, session persistence, and protected routes
- **mventor-ticket-016:** Variant Indicator UI + Featured Products + Product Rebrand â€” SizeSelector, SizePicker, FeaturedList, full product rebrand, image completion (51/51 products)
- **mventor-ticket-015:** Seed Comfort-Sign Database from Excel Data â€” 51 real products
- **mventor-ticket-014:** Fork Project â€” Create "Comfort-Sign" Physical Therapy & Sports Site
- **mventor-ticket-013:** Modular Admin Dashboard + Product Colors â€” Sidebar layout, color swatches per product
- **mventor-ticket-012:** Stacked Photos CSS Effect â€” Polaroid photo stack on homepage hero
- **mventor-ticket-010:** Switch to ngrok (zero-cost HTTPS) â€” no CC, no account, no domain needed
- **mventor-ticket-009:** Google OAuth Customer Login â€” Google sign in, account page, order history
- **mventor-ticket-008:** Custom Domain & DNS â€” Tunnel config, setup guide, startup scripts
- **mventor-ticket-007:** Production Hardening â€” Helmet, CSRF, input validation, error handling
- **mventor-ticket-006:** Performance & Caching â€” Compression, rate limiting, cache, Jest test suite
- **mventor-ticket-005:** Email Notifications â€” Nodemailer order confirmation + admin notifications
- **mventor-ticket-004:** Image Upload â€” Drag & drop with multer, preview, replace/delete, validation
- **mventor-ticket-003:** Admin Order Management â€” Orders list, stats dashboard, status updates
- **mventor-ticket-002:** Sample Products & Category Polish â€” 15 products, sorting, "New" badge, sort dropdown
- **mventor-ticket-001:** Project Foundation â€” Server, frontend, admin panel, Stripe, docs
