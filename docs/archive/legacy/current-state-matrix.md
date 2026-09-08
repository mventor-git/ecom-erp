# Ecom-ERP — Current State Matrix

> **Scope note (2026-09-01):** This matrix tracks the sprint-0 UI/UX + correctness audit findings. The **FK insert-path + transactional-inventory checkpoint** is a separate, closed workstream — see `ECOM-ERP-PRODUCTION-HARDENING-CHANGELOG.md` Batch 4 and `ECOM-ERP-DATA-INTEGRITY-DELETE-POLICY.md` §5. Summary: `PRAGMA foreign_keys = 1`; `npm test` **118/118 PASS**; payment atomicity (nested-transaction bug) fixed; bridge + issue/supply transactions atomic; live orphans 40/24/2/4 unchanged (REQUIRES DATA-MIGRATION DECISION); UI/UX closure NOT started.

**Purpose:** Re-verified sprint-0 deliverable. Every row is the *current* state cross-checked against the repo this session, not the prior audits. Columns: `Previous Finding` (from the two audit reports) → `Re-verified Current State` (what the code actually does today) → `Verified?` (this session) → `Severity` → `Files`.
**Re-verification method:** direct file reads + 5 subsystem audit agents this session (backend, payments/security, storefront visual, storefront pages, admin visual, admin batches ×3, RTL/i18n).

---

## Backend / correctness

| Area | Previous Finding | Re-verified Current State | Verified? | Severity | Files |
|---|---|---|---|---|---|
| **Checkout total security** | Client total not re-verified server-side | **STILL PRESENT.** `orders.js` takes `total` from body and inserts it unchanged (`:11,47`); `kashierCheckout.js` builds the payment session amount from `req.body.total` (`:81,91,102`) and never compares it to the DB order total. Client defines the charge. | YES | **P0** | `server/routes/orders.js`, `server/routes/kashierCheckout.js` |
| **Stock reservation** | `reserveForOrder` not called at order creation | **STILL PRESENT.** `salesInventoryBridge.js:109` implements an idempotent `reserveForOrder`, but `orders.js` order-creation path never calls it — only `issueForOrder` for COD (`:57`). Kashier/card orders reserve nothing → oversell before payment. | YES | **P0** | `server/routes/orders.js`, `server/services/salesInventoryBridge.js` |
| **Payment provider** | Kashier active; Stripe dormant; Mock adapter blocked | **CONFIRMED.** Kashier is the live provider (`kashierService.js` direct `fetch()`); no provider abstraction; `mockPaymentProvider.js` marked `BLOCKED until real Kashier verified` and not wired to checkout. Stripe keys are dummy; zero `require('stripe')` in source. | YES | P1 | `routes/kashier*.js`, `services/kashierService.js`, `services/mockPaymentProvider.js` |
| **Webhook idempotency** | Duplicate webhook protection unverified | **GOOD.** HMAC-SHA512 + `timingSafeEqual`, raw body preserved, `kashier_webhook_events.event_key UNIQUE` + `INSERT OR IGNORE`. Refund idempotency only partial (status check). | YES | P1 | `routes/kashierWebhook.js`, `services/kashierWebhookService.js` |
| **FIFO integration** | Cost-layer table exists, not wired into standard sales | **STILL PARTIAL.** `inventory_cost_layers` + FIFO service exist, but `salesInventoryBridge.js` COGS uses current `products.cost_price` (`:73,83`); only `adminSaleService` consumes layers. | YES | P1 | `services/salesInventoryBridge.js`, `services/inventoryCostLayers.js` |
| **Double-entry accounting** | No GL/journals/AR/AP | **CONFIRMED ABSENT.** Reports derive COGS/profit from SQL sums of movements/orders; no chart of accounts, no journal, no AR/AP. | YES | P1 | `services/reportService.js` |
| **Returns/refunds** | Full workflow partial | **PARTIAL.** Refund route + event + release exist; no return-policy days, no warehouse inspection (RESELLABLE/DAMAGED/MISSING), no restock movement on refund, no duplicate-refund guard. | YES | P1 | `routes/admin.js`, `services/orderWorkflowService.js` |
| **Auth / RBAC / CSRF / 2FA / bcrypt** | Real, server-side enforced | **CONFIRMED SOLID.** Session+JWT; every admin route uses `adminAuth`; RBAC via `rbac.js`; 2FA via `speakeasy`; bcrypt; CSRF on admin state changes. | YES | PASS | `middleware/*`, `routes/*` |
| **Secrets / creds** | Hardcoded secrets, weak admin pw | **CONFIRMED.** `ADMIN_PASSWORD=********` in `.env`; real Kashier secret hardcoded in `_seed-kashier.cjs:11-12`, `_kashier-fix-probe.cjs:6`; `.env` is git-ignored but probe scripts violate it. | YES | P1 | `server/.env`, `server/_seed-kashier.cjs`, `server/_kashier-fix-probe.cjs` |
| **Input validation** | No validation library in checkout/orders | **CONFIRMED.** `orders.js:13` null-checks only; `kashierCheckout.js:82` null-checks only; no schema validation anywhere in these flows. | YES | P1 | `routes/orders.js`, `routes/kashierCheckout.js` |
| **Data integrity** | Legacy `products.stock`; JSON orders; current-cost COGS | **CONFIRMED.** `products.stock` kept for compat (movement ledger is source of truth); `orders.items` is a JSON blob; no historical wholesale-cost table. | YES | P1 | `db.js`, `schema.sql` |
| **Migrations** | No versioned migration table | **CONFIRMED.** Inline `try/catch` ALTERs in `db.js` + numbered SQL files; no tracking table. | YES | DEFERRED | `server/db.js`, `server/migrations/*.sql` |

---

## Customer storefront (`client/`)

| Area | Previous Finding | Re-verified Current State | Verified? | Severity | Files |
|---|---|---|---|---|---|
| **Routing/coverage** | Feature-complete storefront | **CONFIRMED.** 11 routes; home, catalog+search+filter, product detail (variants/gallery), cart, checkout, success/cancel, login, account, tracker, welcome, onboarding. | YES | PASS | `client/src/App.jsx` |
| **Brand color** | Warm terracotta/ivory/gold | **CONFIRMED.** `primary.500 #d97757`, `#c65f3e`; ivory `body #f6f2e8`; gold `#a8811f`; muted status colors. (Not teal.) | YES | PASS | `client/tailwind.config.js`, `client/src/index.css` |
| **Dark mode** | Manual only, coherent | **CONFIRMED.** `.dark` class via `ThemeContext` (localStorage, no OS auto-switch); palette `dark.950 #101c2c`; large `.dark` override block. | YES | PASS | `client/src/context/ThemeContext.jsx`, `client/src/index.css` |
| **Design primitives** | No shared Button/Input/Card | **CONFIRMED.** Buttons/cards are CSS classes; multiple competing button styles (`CartToast` inline `bg-primary-600` vs `.btn-primary`); no component. | YES | P1 | `client/src/index.css`, `client/src/components/*` |
| **RTL** | Systematically broken | **CONFIRMED.** Global `dir` set in `i18n/index.jsx:30-32`, but ~90% geometry physical: ProductCard `left-0/right-0`, Navbar `right-0`, DrawerShell `fixed right-0`, SmartSearch `left-3/right-3`, `translate-x-1` arrows, `←/→` chars, `space-x-*`. Only LoginPage sets per-input `dir`. | YES | **P0** | `client/src/components/*`, `client/src/pages/*` |
| **Arabic i18n** | 247+ AR keys; copy partially untranslated | **CONFIRMED PARTIAL.** Keyed strings well covered, but a large volume of copy (errors, placeholders, labels) is hardcoded English: `OnboardingPage`, `SuccessPage`, `CancelPage`, `CartPage`, `ProductDetailPage`, `ProductsPage`, `LoginPage`, `AccountPage`. | YES | P1 | `client/src/pages/*`, `client/src/i18n/translations.js` |
| **Empty/loading/error states** | Missing on some pages | **CONFIRMED.** ProductsPage + HomePage missing empty state (blank grid / silent `catch`); Onboarding no loading during `getCustomerStatus`; others have spinners. | YES | P1 | `client/src/pages/{ProductsPage,HomePage,OnboardingPage}.jsx` |
| **Mobile** | Strong patterns; 320px category tight | **CONFIRMED.** Sticky bottom CTA, filter drawer, touch swipe, persistent search = good. Category grid `grid-cols-2` at 320px tight. | YES | PASS | `client/src/pages/ProductDetailPage.jsx`, `HomePage.jsx` |
| **Accessibility** | aria-labels good; focus indicators missing | **CONFIRMED.** `aria-label` on icon buttons, `role="dialog" aria-modal`, `alt` on images, `prefers-reduced-motion`. **Missing `focus-visible`** — `focus:outline-none` with no replacement. | YES | P1 | `client/src/components/*` |

---

## Admin ERP panel (`client-admin/`)

| Area | Previous Finding | Re-verified Current State | Verified? | Severity | Files |
|---|---|---|---|---|---|
| **ProductForm price-unit** | Read ÷100, write ×1 (corrupts price) | **CONFIRMED STILL BROKEN.** Read `p.price/100` (`:30`); write `parseFloat(form.price)` raw (`:44-45`) — 250 EGP → `250` cents (should be `25000`). Only `name` validated; price/cost `||0`; no `Math.round`. | YES | **P0** | `client-admin/src/admin/pages/ProductForm.jsx` |
| **Picking vs Packing** | Picking exports Packing | **CONFIRMED STILL PRESENT.** `PickingDashboard.jsx:22` = `export default function PackingDashboard` (identical to `PackingDashboard.jsx`), and its default tab is `'packing'` (`:24`). `/erp/picking` renders the Packing tab. | YES | **P0** | `client-admin/src/admin/pages/{PickingDashboard,PackingDashboard}.jsx` |
| **PO destructive actions** | Cancel one-click, no confirm | **CONFIRMED STILL PRESENT.** `PurchaseOrdersList.jsx:250-255` renders "Cancel" as a plain button → `handleStatusChange(...,'cancelled')` with no confirmation. | YES | **P0** | `client-admin/src/admin/pages/PurchaseOrdersList.jsx` |
| **Brand color (admin)** | Brown primary + teal token | **CONFIRMED. Two identities.** Tailwind `primary` ramp is brown (`#c65f3e@600`); teal `#1f857a` only in `design-tokens.css` (ignored by Tailwind) + 18 hardcoded uses (ProfileCard, CustomerProfile, VipInvitations, SalesChart, CoffeeSplash). `bg-primary-600` (brown) used 76×. | YES | P1 | `client-admin/tailwind.config.js`, `client-admin/src/styles/design-tokens.css`, `client-admin/src/admin/pages/*` |
| **Dark mode** | Two systems; undefined `dark-NNN` | **CONFIRMED.** `theme.js` (`.dark`, warm-stone) + `appearance.js` (a second `admin-dark` navy palette); **18 undefined `dark:bg-dark-800/700/900`** in DocumentViewer, InventoryDashboard, IssueOrdersList (no token exists → unstyled). | YES | P1 | `client-admin/src/utils/{theme,appearance}.js`, `client-admin/src/admin/pages/{DocumentViewer,InventoryDashboard,IssueOrdersList}.jsx` |
| **Design primitives** | No shared Button/Input/Modal | **CONFIRMED.** `DataTable`/`StatCard`/`StatusBadge`/`Toggle`/`AdminIcon` reused; but no shared Button/Input/Modal; `bg-primary-600` hand-rolled 76×; `.btn-primary`/`.card` classes in `index.css` have **0 usages**; shadcn `ui/*` mostly unused; `ui/badge.jsx` and `StatusBadge.jsx` duplicate with different colors. | YES | P1 | `client-admin/src/index.css`, `client-admin/src/admin/components/*`, `client-admin/src/components/ui/*` |
| **Status badges** | 3 different systems | **CONFIRMED.** `StatusBadge.jsx` (pill+dot) vs `PackingDashboard` STATUS_STYLE (text pill) vs `ShippingDashboard` STATUS_STYLE (different colors). | YES | P1 | `client-admin/src/admin/components/StatusBadge.jsx`, `PackingDashboard.jsx`, `ShippingDashboard.jsx` |
| **Icon system** | lucide + emoji vs AdminIcon | **CONFIRMED.** `lucide-react` in 18 files; emoji in `ColorPicker` (✏️←→🗑️), `DocumentViewer` (📄), `CourierConfig` (✓), plus `Announcements` 📢, `HeroSlides` 🖼️, `AISettings` 💡, `Featured` 📦; mojibake `ðŸ'°'` in ReportsDashboard; `Admin �` in tab title. | YES | P1 | `client-admin/src/admin/pages/*`, `client-admin/index.html` |
| **DataTable** | No sticky/sort/pagination/bulk | **CONFIRMED.** `DataTable.jsx` used by 16 pages; no sticky header, no sort, no pagination, no bulk; loading skeleton is 5 generic pulse rows (no column structure); rows `<tr onClick>` not keyboard accessible. | YES | P1 | `client-admin/src/admin/components/DataTable.jsx` |
| **Mobile admin** | `overflow-x-auto` only | **CONFIRMED.** All wide tables (Products 7-col, Movements 10-col, PO, Warehouse, Suppliers) rely on `overflow-x-auto` with **no stacked-card fallback** → unusable at 375px. | YES | P1 | `client-admin/src/admin/pages/*` |
| **Empty/error/loading** | Inconsistent / swallowed | **CONFIRMED.** Overview, Movements, Products, Warehouses swallow errors to `console.error` (blank cards); some pages use `alert()`; most CRUD saves give no success toast. | YES | P1 | `client-admin/src/admin/pages/*` |
| **Arabic i18n (admin)** | Partial; sidebar labels missing | **CONFIRMED.** `translations.js` 412 AR keys; but sidebar **group labels** Operations/Finance/Website untranslated + **item labels** Financial Periods/Audit Log/Packing/Picking/Accounting/Retail Pricing/Warehouses & Shelves untranslated; ~12 pages fully hardcoded English. `IssueOrdersList` + `SiteConfig` are excellent models. | YES | P1 | `client-admin/src/i18n/translations.js`, `client-admin/src/admin/components/Sidebar.jsx`, `client-admin/src/admin/pages/*` |
| **RTL (admin)** | Basically unimplemented | **CONFIRMED.** Logical `start/end` in Sidebar/DataTable headers, but DataTable cells `text-right` vs header `text-end`, `Select.jsx` `pl-2.5 pr-7` + chevron `right-2`, physical `md:text-right` in ProfileCard/pages; only 2 `dir="rtl"` / `ar-EG` spots. | YES | **P0** | `client-admin/src/admin/components/{DataTable,Select}.jsx`, pages |
| **Locale** | Mixed `en-US`/`en-GB`/`ar-EG` | **CONFIRMED.** `currency.js` `en-US`; `OrderTrackerPage` `en-GB`; `CustomersList` `ar-EG` — three locales for the same concept. | YES | P1 | `client-admin/src/utils/currency.js`, `client/src/utils/*`, pages |
| **Accessibility (admin)** | Mixed; gaps | **CONFIRMED.** `Toggle` (`role="switch"`) / `StatCard` (`role="button"`, tabIndex) / Sidebar (`aria-expanded`) excellent; but DataTable rows not keyboard accessible, `<th>` no `scope`, ColorPicker emoji buttons no `aria-label`, badge spans no role. | YES | P1 | `client-admin/src/admin/components/*` |

---

## Milestone verdict (this matrix)

- **All 5 P0 findings are real and still present** → they are the first implementation batch (P0.1–P0.5).
- **The top systemic P1 items** are: two brand colors, three status-badge systems, no shared primitives (dead `.btn-primary`/`.card`), DataTable capabilities, mobile table fallback, RTL geometry, untranslated Arabic, undefined `dark-NNN`, mixed locales, mixed icon/emoji.
- **Strong patterns to preserve** (do not regress): InventoryDashboard stat cards + hide-when-empty alerts; PurchaseOrdersList structured modals + live totals; WarehousesList master/detail; IssueOrdersList + SiteConfig (best Arabic/dark model); storefront glassmorphic cards, sticky mobile CTA, Aref Ruqaa wordmark, custom icons, touch-swipe, `prefers-reduced-motion`.

_Next action: implement P0.1 → P0.5 first, then the P1 system work, verifying each change (vite build for frontend, jest for backend) and re-checking consumers of any shared component before/after._
