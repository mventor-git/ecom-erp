# Product Discovery Report — Comfort Sign

## 1. What this product appears to be
A physical-therapy / sports-equipment e-commerce store ("Comfort Sign"). Customer-facing storefront + back-office admin + ERP/warehouse layer (ERP, inventory, pricing, orders, customers, finance). Brand theme: warm cream/gold (prestige/comfort), Arabic/English bilingual, dark mode supported.

## 2. Who the Customer Website serves
End customers buying therapy/sports products (categories, product variants by color/size, reviews, cart, checkout via Kashier/Stripe). Supports feature products, top-selling, announcements, trust badges, free-shipping thresholds.

## 3. Who the Admin Panel serves
Store operators / warehouse managers / finance / pricing / operations team. Manages catalog (products, categories, brands), inventory (stock, warehouses, movements), purchasing (suppliers, POs), operations (picking/packing, delivery), pricing engine (retail pricing, price lists, profits), sales (orders, customers, VIP invitations, receipts/issue orders), finance (accounting, reports, periods), website config, integrations (Kashier payments), users/roles, notifications, audit logs.

## 4. How the two systems relate
- Admin defines products, categories, prices, inventory, settings → Customer displays them.
- Customer actions (orders, cart, checkout) feed Admin orders/sales.
- Admin controls public settings (trust badges, features, section headers, announcements, reviews, price lists, storefront currency).
- Shared data: products, categories, prices, customers, orders, inventory status, announcements, settings.

## 5. Major business flows observed
Customer: discover → product detail (variants, reviews, gallery) → add to cart → checkout (email, payment via Kashier) → success/cancel → account/track orders.
Admin: dashboard → module (sales/inventory/pricing/finance/website/system) → CRUD/forms → actions (issue orders, VIP invites, movement, pricing updates, reports).

## 6. Major product concepts
Product / SKU / Category / Brand / Variant (color/size) / Warehouse / Stock / Supplier / Price List / Order / Receipt / Customer / VIP / Driver / Announcement / Trust Badge / Review / Currency / Price List Code (retail/wholesale).

## 7. Current strengths
Full bilingual (i18n) architecture; dark mode; feature-rich admin sidebar with ERP modules; pricing engine module; inventory movement/warehouses; VIP and receipt flow; Kashier integration; announcement rotation; public settings editable from admin; responsive customer layout with hero slider + product grids.

## 8. Current weaknesses (observed only — not fixed yet)
Some modules may be incomplete/placeholder based on code structure; dark mode CSS partially defined (needs verification); some admin pages may rely on data that isn't always present; customer checkout depends on external Kashier status; design consistency between customer and admin not yet unified.

## 9. Unclear areas
Exact ERP accounting rules; whether all inventory movements are fully wired; final business rules for VIP/reward tiers; exact warehouse operation sequences; whether all admin tabs are fully implemented; relationship between "Issue Receipts" and orders; exact pricing engine algorithm (wholesale → retail +20% default per memory).

## 10. Questions for later
- Is backend at 5172 fully running? (Not inspected deeply; only UI explored.)
- What is the exact data model for inventory/warehouse?
- What are the roles/permissions in users/roles?
- Which customer flows are fully end-to-end working vs mock?
- Are announcements and settings fully persisted?

## Observed routes
Customer (5173): /, /home, /products, /products/:id, /cart, /checkout/success, /checkout/cancel, /login, /account, /track-orders, /account/verify
Admin (5174): /dashboard, /orders, /erp/customers, /products, /categories, /brands, /inventory, /inventory/movement, /inventory/warehouses, /erp/supply-orders, /pricing-engine, /erp/price-lists, /site-config, /erp/users, /erp/events, /erp/notifications, /erp/integrations, /erp/settings, /erp/kashier, /dashboard-detail/revenue, /featured, /erp/issue-orders, /erp/vip-invitations, /erp/financial-periods
