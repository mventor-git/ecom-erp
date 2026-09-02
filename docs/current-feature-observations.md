# Current Feature Observations — Discovery Phase Only

WORKING FROM USER PERSPECTIVE:
- Customer homepage loads with hero, featured/top-selling/categories/announcements/trust badges/features
- Product listing and detail pages render with variants, reviews, gallery
- Cart accumulates items; checkout uses Kashier/Stripe; success/cancel pages exist
- Account page with orders and tracking links
- Login/auth page exists
- Admin sidebar navigation renders all major sections (Sales/Inventory/Purchasing/Operations/Pricing/Finance/Website/System)
- Admin dashboard components (StatCard, charts, status donuts) present
- Dark mode toggle in admin; selection colors in customer CSS

PARTIALLY WORKING / OBSERVED ONLY:
- Some modules (ERP accounting, full inventory movement, VIP invitations, receipt issuance) have UI but backend full flow not verified in this phase
- Data may be mocked/seeded (seed scripts exist: seed-comfort-sign.js, seed-fake-data.js, seed-ticket037.js)
- Announcement rotation uses 5s interval; depends on /api/announcements/active

BROKEN / EMPTY / PLACEHOLDER (identified only — not fixed):
- Some pages may have empty states if no admin-configured data (e.g., no featured products → fallback to regular products in code)
- Admin pages relying on backend APIs not yet verified for all routes
- Potential dead-end navigation if routes mismatch between sidebar and App.jsx
- Customer site uses /admin path in README vs separate client-admin build; actual admin is at 5174

UNCLEAR:
- Exact backend database state (SQLite?); seed scripts available for inspection
- Whether all admin modules are fully implemented vs partially wired
- Full data flow between customer checkout and admin orders/issue-orders
- Pricing engine algorithm exact rules (memory says wholesale baseline → auto retail +20% default)

TOOLS USED (Node.js only — no Python):
- Bash / grep / find / cat / head for file inspection
- WebFetch attempts for localhost (failed; relied on source inspection instead)
- Source code inspection of React JSX / CSS / sidebar / routes
- Server scripts: seed-comfort-sign.js, seed.js, _test_db.js, verify-database.js available for DB inspection

DO NOT FIX IN THIS PHASE.
