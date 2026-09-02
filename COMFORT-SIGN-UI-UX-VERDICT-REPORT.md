# Comfort Sign ERP + E-Commerce — UI/UX Verdict Report

**Path:** `D:\Projects\on-dev\comfort-sign-deploy`
**Scope:** Customer Storefront (`client/` · :5173) + Admin ERP Panel (`client-admin/` · :5174) — visual interface and user experience only
**Date:** 2026-08-31
**Method:** Source-level inspection of every routed page, shared component, CSS/Tailwind token file, i18n dictionary, and entry point. No application files were modified. Every claim is evidence-cited (`file:line`, actual class names, actual hex values).
**Evidence tags used throughout:** `VERIFIED` · `PARTIAL` · `ISSUE` · `MISSING` · `UNVERIFIED`

---

## SECTION 1 — EXECUTIVE UI/UX VERDICT

### Customer Storefront

| Dimension | Score | One-line reason |
|---|:--:|---|
| Visual maturity | **8/10** | Genuinely polished glassmorphic design, rich typography, coherent warm palette |
| UX maturity | **6/10** | Good core flows; RTL and hardcoded English undercut the Arabic experience |
| Consistency | **6/10** | One visual language, but no shared primitives → competing button styles |
| Mobile readiness | **7/10** | Sticky CTA + responsive grids are excellent; category grid tight at 320px |
| Arabic/RTL UX | **3/10** | `dir` is set globally but geometry is ~90% physical → breaks under RTL |
| Accessibility | **5/10** | Great aria-labels/semantics; focus indicators missing everywhere |
| **Overall** | **POLISHED CORE — BROKEN ARABIC** | Looks premium in English; the Arabic experience is not production-quality |

### Admin ERP Panel

| Dimension | Score | One-line reason |
|---|:--:|---|
| Visual maturity | **5/10** | Functional and dense, but two brand colors fight, undefined dark classes, plain native dialogs |
| UX maturity | **7/10** | Operationally solid (good tables/modals/detail views); pagination + confirmation missing |
| Consistency | **4/10** | 3 competing status-badge systems; brown vs teal; lucide vs AdminIcon vs emoji |
| Mobile readiness | **3/10** | Tables are `overflow-x-auto` only — not usable at 375px |
| Arabic/RTL UX | **3/10** | Only a couple of `dir="rtl"`/`ar-EG` spots; sidebar labels + most pages untranslated |
| Accessibility | **5/10** | Toggle/StatCard/Sidebar are exemplary; DataTable rows + badges under-served |
| **Overall** | **OPERATIONALLY GOOD — VISUALLY & CULTURALLY INCONSISTENT** | Dense and usable; lacks a single design system and Arabic parity |

---

## SECTION 2 — "WHAT DOES THIS SOFTWARE LOOK LIKE?"

**These are two different products by two different visual identities.**

### Customer Storefront — warm, glassy, "modern e-commerce" (VERIFIED)

- **Not** a traditional ERP look. It is a **consumer storefront** with a strong, distinctive brand:
  - Brand primary is **terracotta**: `primary.500 #d97757`, `primary.600 #c65f3e`, `primary.700 #a54d33` (`client/tailwind.config.js:56-68`).
  - Background is **warm ivory**: `body #f6f2e8` (`client/src/index.css:57`), `gray.50 #faf8f3`, card `#fffdf7` (`index.css:62`).
  - **Gold** accent `#a8811f` (DEFAULT) / `#e9c46a` light.
  - **Muted** status colors — `green.500 #65744f`, `red.500 #a64b3f` (not pure traffic-light red/green) — a deliberate, tasteful choice.
- **Glassmorphism everywhere** (`index.css:94-99`): `shadow-glass`, `shadow-glass-lg`, `shadow-glow`; Navbar `bg-white/80 backdrop-blur-xl`; drawer `bg-white/95 backdrop-blur-xl`. Nothing is flat.
- **Rich typography** (`index.html:14`): Inter + Cairo + **Aref Ruqaa** + **Great Vibes** + **Playfair Display**; fluid type scale via `clamp()` (`index.css:412-422`); Arabic price wordmark in Aref Ruqaa / English in Playfair italic (`Price.css:17-34`).
- **Shapes**: cards `rounded-2xl`, buttons `rounded-xl`, badges `rounded-full` — coherent.
- **Icons**: zero emoji. Custom stroke `Icon` component + inline SVG + `EgpSymbol` monogram (`Icon.jsx`).

### Admin ERP Panel — dense, dark-wood/teal, "operational software" (VERIFIED)

- The dominant interactive color is **brown/terracotta**, not teal: Tailwind `primary` ramp is `#fdf5f0 → #6b3424` with `primary.600 #c65f3e` (`client-admin/tailwind.config.js:13-24`). **There is no teal in the Tailwind theme.**
  - ⚠️ The "Clinical Teal `#1f857a`" (in `design-tokens.css`) is **ignored by Tailwind** and survives only as **18 hardcoded** values: `ProfileCard.jsx:17,44,45,49,53`, `CustomerProfile.jsx:21,43,69,74,78`, `VipInvitations.jsx:43,49`, `SalesChart.jsx:42,43,59,63`, `CoffeeSplash.jsx:47`.
  - **Net effect:** the admin is mostly **brown** (`bg-primary-600` ×76) with **teal** sprinkled on profile/revenue/VIP/CoffeeSplash components. Two brand colors fighting for the same system.
- **Warm-stone dark mode**: `.dark` reskins `white→#0c0a09`, etc. (`client-admin/src/index.css:17-136`). A **second** theme system (`appearance.js`) injects a **navy** `admin-dark` sheet (`#0f172a`, `#1e293b`) — both can be active simultaneously.
- **Cards**: `rounded-xl shadow-sm border border-gray-200 bg-white` — consistent, flat, no glass. Buttons `rounded-lg`. Modals `rounded-2xl`. No elevation scale.
- **Icons**: mixed — `AdminIcon` (39 stroke SVG icons) for nav, but **lucide-react in 18 files** and **emoji** in `ColorPicker` (✏️←→🗑️), `DocumentViewer` (📄), `CourierConfig` (✓).

**Bottom line for "look":** a warm, glassy, well-typed consumer shop **vs** a flat, dense, wood-toned ERP with a teal identity crisis. They don't feel like the same company's product.

---

## SECTION 3 — DESIGN SYSTEM AUDIT

**Verdict: there is a design language but not a design system.** Several real primitives exist; they are not consistently consumed, and a whole component layer is defined but unused.

### What actually exists and is reused (VERIFIED)

| Primitive | Used by | Notes |
|---|---|---|
| `admin/components/DataTable.jsx` | **16 pages** (Customers, Events, FinancialPeriods, Inventory, Movements, Notifications, Orders, Products, Trash, POs, Reports, Suppliers, SupplyOrders, Users, Warehouses) | Columns/data/loading/empty/emptyAction/onRowClick. ⚠️ no sticky header, no sort, no pagination, no bulk |
| `admin/components/StatCard.jsx` | Overview, InventoryDashboard, RevenueDetail | TONES, expand/collapse, masked figures, `aria-expanded` |
| `admin/components/StatusBadge.jsx` | OrdersList, ProductsList, IntegrationsPage | `pill`/`dot` variants |
| `admin/components/Toggle.jsx` | WorkflowConfig, SiteConfig, UsersList, FeaturedList, PriceLists, WelcomeSlidesList | `role="switch"`, `aria-checked` |
| `admin/components/AdminIcon.jsx` | Sidebar nav + StatCard | 39 stroke icons, `aria-hidden` |

### Where the system breaks down (ISSUE)

1. **No shared `Button` / `Input` / `Modal` in either app.** `bg-primary-600 hover:bg-primary-700 rounded-lg` is hand-rolled **76 times** in admin. Each modal reimplements its own overlay/backdrop (`ImportCsvModal.jsx:71-73`, `DocumentViewer.jsx:87`, `IssueOrdersList.jsx:253`).
2. **A component layer is defined but dead.** `client-admin/src/index.css:96-112` defines `@layer components { .btn-primary, .btn-secondary, .input-field, .card }` — grep shows **0 usages** in JSX.
3. **The shadcn `ui/*` primitives are nearly unused.** `ui/card.jsx`, `badge.jsx`, `select.jsx`, `skeleton.jsx` are imported only by `ImportCsvModal` (uses `Card`); the rest of the admin ignores them. `ui/badge.jsx` and `admin/StatusBadge.jsx` **duplicate** each other with different color maps (emerald vs yellow).
4. **Storefront has no primitives at all.** Buttons/cards are CSS classes (`.btn-primary`, `.btn-secondary`, `.btn-glass`, `.card`, `.input-field` — `client/src/index.css:103-229`) with **competing inline styles** like `CartToast.jsx:50` using `bg-primary-600 text-white` instead of `.btn-primary`.
5. **Status badges are triplicated across workflow pages** (`StatusBadge.jsx` pill+dot vs `PackingDashboard.jsx` STATUS_STYLE text-pill vs `ShippingDashboard.jsx` STATUS_STYLE text-pill with different colors) — a shipped order, a packing task, and a shipment each use a different badge look.

---

## SECTION 4 — CUSTOMER STOREFRONT UI/UX

Routes (from `client/src/App.jsx:88-104`): `/` Welcome · `/home` Home · `/products` Catalog · `/products/:id` Detail · `/cart` Cart/Checkout · `/checkout/success` · `/checkout/cancel` · `/login` · `/account` · `/track-orders` · `/account/verify` Onboarding. Global: floating `AIAssistant`, `WishlistDrawer`, `CartToast`.

| Page | CTA | Loading | Empty | Error | Mobile | RTL | Notes / Evidence |
|---|---|---|---|---|---|---|---|
| **Welcome** `/` | Per-slide CTA + Skip-to-Shop (VERIFIED) | Full-screen spinner (VERIFIED) | **MISSING** — black screen + spinner if no slides | N/A | Touch-swipe + fixed home btn (VERIFIED) | ISSUE — home btn `left-4`, text left-aligned | `WelcomePage.jsx`; `bottom-24 left-4` wrong in RTL |
| **Home** `/home` | Implicit (browse) — no single CTA | PARTIAL — grid spinner, sections render empty | **MISSING** | **MISSING** — `catch(()=>{})` swallows | PARTIAL — `grid-cols-2` tight at 320 | ISSUE | `HomePage.jsx:159,188`; "View All" `translate-x-1` wrong in RTL |
| **Catalog** `/products` | ProductGrid is the destination | PARTIAL — spinner only, skeleton absent | **MISSING** — blank grid on 0 results | **MISSING** — console-only | VERIFIED — filter drawer + sort | ISSUE | `ProductsPage.jsx:51,80`; `left-0` drawer wrong in RTL; **hardcoded EN labels** |
| **Product detail** | Add-to-Cart (VERIFIED) | Skeleton (VERIFIED) | N/A | 404 state (VERIFIED) | **Sticky bottom CTA — best pattern** | ISSUE | `ProductDetailPage.jsx:648-727`; `mr-2` → `ml-2` RTL; many hardcoded EN strings |
| **Cart/Checkout** | Proceed to Checkout (VERIFIED) | Checkout button spinner (VERIFIED) | Friendly SVG + CTA (VERIFIED) | Inline red / amber Kashier banner (VERIFIED) | Stacks (VERIFIED) | ISSUE — `text-right` price, `space-x-3` | `CartPage.jsx:158,178`; `your@email.com` not localized |
| **Success** | Continue Shopping (VERIFIED) | N/A | N/A | PARTIAL — generic success w/o order data | VERIFIED | ISSUE — `text-left` order summary | `SuccessPage.jsx:38-43` hardcoded EN |
| **Cancel** | Return to Cart / Continue (VERIFIED) | N/A | N/A | N/A | VERIFIED | VERIFIED | `CancelPage.jsx:15-17` hardcoded EN |
| **Order tracker** | Order cards (no CTA) | Spinner only (PARTIAL) | Clipboard + CTA (VERIFIED) | Red + Retry (PARTIAL) | Stepper `overflow-x-auto` (VERIFIED) | ISSUE — `←` link, `en-GB` dates | `OrderTrackerPage.jsx:9-24,107,155` |
| **Account** | Track orders / Complete onboarding | Spinner (PARTIAL) | Orders + Delivery tabs (VERIFIED) | `bg-red-50` banner (VERIFIED) | Tabs wrap (VERIFIED) | ISSUE — `→` arrow, `text-right` | `AccountPage.jsx:98,111,225` hardcoded EN |
| **Login** | Google + email form | Spinner | N/A | `access_denied` styled alert (VERIFIED) | `max-w-md` (VERIFIED) | **VERIFIED** — `dir={isRTL…}` on inputs | `LoginPage.jsx:167-176`; only page with per-input RTL |
| **Onboarding** `/account/verify` | Save & Continue | **MISSING** for `getCustomerStatus` | N/A | Inline banners (VERIFIED) | `max-w-xl` (VERIFIED) | ISSUE — phone input no `dir` | `OnboardingPage.jsx:45-110` — **hardcoded EN strings** |

### Global storefront issues (ISSUE)

- **RTL is systematically broken.** `dir` is set globally (`i18n/index.jsx:30-32`), but nearly all geometry is physical: ProductCard ribbon `left-0`/`right-0` (`:155,167`), Navbar `right-0` dropdown (`:163`), DrawerShell `fixed right-0` (`:42`), SmartSearch `absolute left-3`/`right-3`, FilterSidebar `ml-auto` (`:250`), `translate-x-1` hover arrows, literal `←`/`→` characters. Only `LoginPage` uses per-input `dir="rtl"`. Even the dark-mode toggle thumb slides the wrong physical direction in RTL (`ThemeToggle.jsx:9-10`).
- **Hardcoded English despite a `t()` framework.** Pervasive in every page except where `t()` is explicitly called: error strings, placeholders, button labels, confirmation copy in `OnboardingPage`, `SuccessPage`, `CancelPage`, `CartPage`, `ProductDetailPage`, `ProductsPage`, `LoginPage`, `AccountPage`. (Earlier feature audit said "247+ AR keys — well covered"; that's true for *keyed* strings, but a large volume of copy is not keyed at all.)
- **Missing empty states:** ProductsPage (blank grid), HomePage (silent API failure).
- **Loading inconsistency:** Home/Products show surrounding UI while the grid loads; Onboarding has no indicator during `getCustomerStatus()`.

---

## SECTION 5 — ADMIN ERP UI/UX

All 30+ routed pages inspected (App.jsx route table + three batch audits). Below, findings grouped by the page families.

### Dashboard / reporting
- **Overview.jsx** — strong: h1 + date subtitle, Reports + Movements actions, **privacy toggle for KPI figures** (VERIFIED), full skeleton, "No orders yet" empty. ⚠️ stats/orders/chart failures go to `console.error` only (`:59,70`) → a failed load looks like blank cards (ISSUE). Recent orders is a `divide-y` list, not a table.
- **RevenueDetail / DashboardDetailPage** — animated SalesChart, drill-downs (VERIFIED). (Charts use teal `#1f857a` hardcoded in `SalesChart.jsx`.)
- **ReportsDashboard** — **emoji corruption** in REPORT_CARDS (`'ðŸ'°'` — broken UTF-8 for 💰) (ISSUE); hardcoded English labels.

### Catalog
- **ProductsList** — dense, ERP-appropriate: instant smart search (name/name_ar/sku/barcode/category), price+margin tiny print, color swatches, right-aligned numeric (VERIFIED). ⚠️ no `h1`, no pagination/sort, mass-delete is dead code `{false && ...}` (`:216-227`), 7-col table only `overflow-x-auto` at 375px.
- **ProductForm** — h1 + back, 2-col grid (VERIFIED). ⚠️ **required indicators partial**, validation only `name.trim()`; `parseFloat` silently coerces bad price/cost to 0; empty category silently → id1. **No unsaved-changes guard.** (Separately, price unit bug — see Section 16.)
- **ProductsTrash** — empty state with action (VERIFIED); Restore All via `window.confirm`.

### Inventory / warehouse
- **InventoryDashboard** — **best operational page of the batch**: 5 stat cards + low-stock (hidden-when-empty) + summary table, warehouse filter, "Movement saved — stock updated" feedback (VERIFIED).
- **MovementsList** — 10-col audit-trail table, 11 color-coded type badges, +/- colored change, Load More pagination, dynamic New-Movement modal (VERIFIED). ⚠️ search missing, transfer has **no confirmation**, error swallowed to console.
- **WarehousesList** — **master/detail split-screen** (warehouses → locations) (VERIFIED). ⚠️ `window.confirm` + `alert()` errors, no pagination.

### Purchasing / suppliers
- **PurchaseOrdersList** — **strong**: 3 structured modals (create PO with dynamic line items + live running total, detail with status transitions, receive with per-item "N remaining") (VERIFIED). ⚠️ **Cancel = one-click destroy, no confirmation** (`:81-85,250-255`) — highest-risk unguarded action. No success toast; no pagination.
- **SuppliersList** — table + modal form (VERIFIED). ⚠️ lead-time not right-aligned; no pagination; `alert()` errors.

### Pricing
- **PriceLists** — card list + modal (VERIFIED). `window.confirm` for delete; `savedMsg` auto-clear green banner.
- **PricingEngine** — category cards with avg margin + live debounced preview + "Projected profit" (VERIFIED); `fmt()` uses `toLocaleString`; Undo + Fire visually distinct (gold vs primary). "Loading…" pulse used as empty. Numeric input has no RTL handling.
- **PricingProfit** — line chart "Operating profit — time periods" (labeled actual, not forecast) + "Potential profit" bars (clearly labeled) + lifetime table (VERIFIED). ⚠️ top-12 `slice()`, no pagination; "Loading…" shown for empty API (misleading).

### Customers / VIP
- **CustomersList** — tabs (Normal/VIP/Invitations), search, DataTable, VIP gold badge, Revenue green, CSV export (VERIFIED). ⚠️ no debounced server search, no bulk; `dateLocale ar-EG`.
- **CustomerProfile** — header, profit contribution, 3 info cards, Orders list; **Reviews + Wishlist tabs are literal placeholders** ("Review cards go here…", "Wishlist cards go here.") (ISSUE — only true stub).
- **VipInvitations** — create invite (Gift icon), Code/Customer/Created/Status table (Claimed/Unused badges) (VERIFIED). ⚠️ lucide icons.

### Orders / fulfillment
- **OrdersList** — ⚠️ **no `h1` title** (filter bar only). Deep: StatusBadge, `VALID_TRANSITIONS`, expandable workflow timeline, right-aligned totals, grouped actions (Invoice/Receipt/Ship/Sheet/Email/Update) (VERIFIED). Status update via `<select>`, no confirm; `alert()` on failure; `en-US` dates.
- **PickingDashboard / PackingDashboard** — ⚠️ **CRITICAL** `PickingDashboard.jsx:23` **exports `PackingDashboard`** — the `/erp/picking` route renders the Packing dashboard (identical content, different filename). Both deploy → wrong module shown, duplicate code. Otherwise task cards + status badges (5 states), per-task notes.
- **ShippingDashboard** — provider cards + shipment list, 6-state status progression (yellow→green→red logical), grouped actions, 2 modals (VERIFIED). ⚠️ no loading indicator in shipment section; `window.confirm` on provider delete.

### Settings / tools
- **SiteConfig** — **best-in-class i18n**: full `t()`, Arabic inputs `dir="rtl"` + `font-[Cairo]` (VERIFIED). ⚠️ sub-tab labels hardcoded in TABS array (`:29-35`), rendered via `t(tb.label)` — those keys are missing in translations.js, so English tab names remain in Arabic.
- **Login** — split-brand panel + CoffeeSplash (VERIFIED). ⚠️ error fallback hardcoded 'Invalid credentials'; "Brewing your session" not `t()`.
- **IssueOrdersList** — **best-in-class Arabic + dark mode**: full `t()`, AdminIcon, `dark:bg-dark-800`, translated confirm (VERIFIED).
- **IntegrationsPage** — lucide icons; secret masking blank=null (VERIFIED); ⚠️ "??" and empty-string placeholders in webhook guide.
- **Announcements / HeroSlides / WelcomeSlides / AISettings / FeaturedList** — all **hardcoded English** (no `t()`), emoji (📢 🖼️ 💡 📦), `window.confirm` untranslated.
- **KashierPage** — raw table markup (not DataTable), hardcoded English.
- **FinancialPeriods** — hardcoded English; destructive close via `window.confirm` untranslated.

### Sidebar / navigation
- **VERIFIED structure**: 11 sections / ~35 links, section headers with AdminIcon + chevron + `aria-expanded`, active state `bg-primary-50 text-primary-700 font-semibold`, rail-collapse `w-[68px]`, mobile overlay, persisted `cs-sidebar-open-sections`.
- **ISSUE**: two single-item sections (Website `globe`, Notifications `bell`) could collapse into System. Label ambiguity ("Issue Receipts" vs logic "Issue Orders"); lucide `TrendingUp` in brand logo (line6) with hardcoded brown `#c65f3e`.

---

## SECTION 6 — NAVIGATION & INFORMATION ARCHITECTURE

### Customer
- **VERIFIED good**: cart, wishlist, search, and account are always visible in the Navbar; mobile hamburger + a persistent mobile search row; Category→Featured→Trust-badges home hierarchy is logical.
- **ISSUE**: the home `/` is a **full-screen 3D welcome slider with no navbar**; users must click Skip-to-Shop. Returning customers are funneled through a marketing splash every visit (there's no "skip" memory). Slightly high-friction for repeat buyers.

### Admin
- **VERIFIED**: sidebar is grouped into real business domains (Overview, Sales, Products, Purchasing, Inventory, Pricing, Operations, Finance, Website, Notifications, System). This matches ERP mental models.
- **ISSUE — scalability & clarity**:
  - 35 links on one rail is a lot; single-item sections (Website, Notifications) waste an expandable group for one link.
  - Ambiguous labels: "Issue Receipts" (feature is *Issue Orders*), "Pricing Insights" vs "Retail Pricing", "Movements" vs "Inventory Movement" vs "Inventory".
  - Two different prefixes create path confusion: most modules live under `/erp/*`, but inventory is `/inventory/*` and some pages are top-level (`/products`, `/dashboard`, `/pricing-engine`). A user navigating doesn't see a uniform scheme.

---

## SECTION 7 — RESPONSIVE / MOBILE WEB

### Storefront
- **GOOD**: ProductDetail sticky bottom CTA (`fixed bottom-0 lg:hidden`, `pb-32 lg:pb-8`); mobile filter drawer (`fixed inset-0 z-50 lg:hidden`); grids collapse (`grid-cols-1/2 …`); HeroSlider touch swipe.
- **PROBLEMATIC**: Home category grid `grid-cols-2` at 320px with `p-6` cards (`HomePage.jsx:159`) — 2 narrow columns of 24px-tall icons; tight.
- **GOOD→ACCEPTABLE**: `max-w-[420px]` main image on detail; order-tracker stepper `overflow-x-auto`.

### Admin
- **PROBLEMATIC / near-BROKEN**: every table is `overflow-x-auto` **with no stacked-card fallback**. Products (7 cols), Movements (10 cols), Purchase Orders, Warehouses, Suppliers all become wide horizontal scroll at 375px. Only forms stack well (`flex-col` → `grid`).
- **PROBLEMATIC**: InventoryDashboard (5 cards + two wide tables), ReportsDashboard, OrderTracker admin landing — dense grid + wide tables → heavy scroll.
- **ACCEPTABLE**: stat-card grids (`grid-cols-2 md:grid-cols-4`), providers grid (`sm:grid-cols-2 lg:grid-cols-3`), modals.

---

## SECTION 8 — RTL / ARABIC UX

**This is the single largest systemic defect across both apps** — and Arabic is a first-class requirement here (full Arabic storefront + bilingual admin).

- **Global `dir` is set** (`client/src/i18n/index.jsx:30-32`, and admin via `useLanguage().isRTL`). But:
  - **Storefront geometry is ~90% physical.** Ribbons, dropdowns, drawers, search icons, hover translates, `←`/`→` arrows, `space-x-*`, `text-right`, `ml-auto`. Only `LoginPage` applies per-input `dir="rtl"`.
  - **Admin**: `DataTable` header uses `text-end` but cells use `text-right` (`DataTable.jsx:48-49,69`) → column misalignment under RTL. `Select.jsx:12` `pl-2.5 pr-7` with chevron `right-2` inverts in Arabic. Sidebar `-translate-x-full` slide not dir-aware. Numeric inputs don't set `dir="rtl"`.
- **Hardcoded English**: pervasive. Admin sidebar **group labels** Operations / Finance / Website have **no Arabic keys**; **item labels** Financial Periods / &minus;Audit Log &minus; Packing / Picking / Accounting / Retail Pricing / Warehouses & Shelves untranslated. `translations.js` (412 AR keys) is **missing** Reports, Notifications rules, Welcome/Hero slides, Events, AI Assistant, and the whole Operations/Finance/Website group.
- **Mixed LTR/RTL text**: bilingual product names/descriptions and Arabic+English inline (e.g., "Size:", "Select Color & Size:") use physical alignment, producing ragged mixed base lines.
- **Numbers/currency**: `formatPrice` uses `en-US` locale (`currency.js`), and `OrderTrackerPage` uses `en-GB` dates, `CustomersList` uses `ar-EG` — **three different locales**. Arabic orders show Western digits in dates but Arabic digits elsewhere → inconsistent.
- **Icons/arrows**: chevrons, back arrows, and "View All" `translate-x-1` all point right regardless of direction; only `PricingProfit.jsx:73` and `Header.jsx:46` use `rtl:rotate-*`.

---

## SECTION 9 — INTERACTION DESIGN

| Interaction | Storefront | Admin |
|---|---|---|
| Hover states | GOOD — cards lift + icons slide | GOOD — rows `hover:bg-*`, buttons transition |
| Focus states | **MISSING** — `focus:outline-none` with no `focus-visible` replacement (`ThemeToggle:23`, nav links) | GOOD — `index.css:37` global `:focus-visible` ring |
| Disabled states | Present (checkout button busy) | Present (`busyId`, `disabled`) |
| Loading | Inconsistent (skeleton on detail, spinner elsewhere, none on onboarding) | Skeleton in DataTable (generic), spinner on others |
| Confirmation dialogs | Mostly `<select>`/direct (status) | **Inconsistent** — `window.confirm`/`alert()` vs polished custom Trash modal; PO Cancel none |
| Toast/inline feedback | `CartToast` (good), inline errors | `savedMsg`/`flashMsg` (some pages); many saves just reload |
| Inline validation | Minimal (name/email/pass check only) | **Weak** — only `name.trim()`; price/cost/coerce silently to 0 |
| Success feedback | Checkmark on success page | Sporadic — no success toast on most CRUD |
| Transitions/animations | Rich (fx.js circle-wipe, coffee splash, Ken Burns, `prefers-reduced-motion` respected) | Moderate (SalesChart, StatCard expand, fx) |
| Modal behavior | Drawers (DrawerShell, `aria-modal`, Esc/close) | **Reimplemented per page** — no shared modal, inconsistent overlay/backdrop |

---

## SECTION 10 — FORMS UX

- **Storefront** (`LoginPage`, `OnboardingPage`, `ProductForm`-customer, checkout): `LoginPage` sets `dir={isRTL}` correctly (good); but most forms **lack required markers** beyond one `*`, validation is superficial, and error messages are untranslated.
- **Admin**:
  - **ProductForm** — the worst form: only checks `name.trim()`; `parseFloat` silently zeroes bad price/cost; empty category defaults to id1; **no unsaved-changes guard**; and a **price-unit bug** (see §16).
  - **PurchaseOrdersList** — the best form: modal with dynamic line items + live running total + per-item "N remaining"; but invalid line items aren't highlighted per-row (generic banner only).
  - **ImportCsvModal** — excellent: 3-step (menu → template/guide → result with Created/Updated/Errors counts + inline errors).
  - **WarehousesList / SuppliersList / Shipping / PriceLists modals** — solid: `*` markers, cancel+create. All lack unsaved-changes guards.
  - **SiteConfig** — best i18n (Arabic `dir="rtl"` + Cairo) and well grouped.
  - **Money presentation**: currency label "Retail Price (EGP)" explicit — good; but `ProductForm` edits in EGP units then writes without ×100 (bug); other admin pages use cents consistently → unit confusion in one place.

---

## SECTION 11 — TABLES & DATA-DENSE UI

- **`DataTable` (the whole app's table)** does not have: sticky header (`thead` is `bg-gray-50 border-b` with no `sticky top-0`), column sorting, per-column filter, pagination, or bulk selection. Across **16 pages**. For ERP data, this is the biggest structural gap:
  - Sorting/pagination is punted to each consumer.
  - The loading skeleton is 5 generic `h-8` pulse rows — **no column structure**, so a loading table conveys nothing.
  - Long non-truncated text cells make `w-full` tables wide.
- **Strong tables by contrast**: MovementsList (10-col, color-coded +/- and type badges, Before→After), ProductsList (price+margin microcopy, swatches), PurchaseOrdersList (status badges + mono PO#), InventoryDashboard (right-aligned on-hand/reserved/available + hide-when-empty low stock).
- **Failure mode**: no pagination anywhere means Products/Inventory/Warehouses/Suppliers/POs load **full lists** — fine at small seed size, unusable at scale.
- **Numeric alignment** is good where it exists (`text-end`/`align:'right'`), but SuppliersList lead-time and some price cols are left-aligned text.

---

## SECTION 12 — ACCESSIBILITY

**Observed quality: partial.** Strong in interactive components, weak in tables/badges/icon-only buttons.

**Good (VERIFIED):**
- `Toggle.jsx` `role="switch"` + `aria-checked` + `aria-label`.
- `StatCard.jsx` `role="button"`, `tabIndex`, Enter/Space, `aria-expanded`, `aria-label`.
- `Sidebar.jsx` `aria-expanded` on section buttons.
- Storefront `aria-label` on all icon-only buttons (Navbar, CartDrawer, FilterSidebar, ProductCard), `role="dialog" aria-modal` on DrawerShell, `alt` on product/logo/brand images, `role="radiogroup"` + `aria-label` on Stars, `prefers-reduced-motion` respected.

**Weak (ISSUE/MISSING):**
- `focus:outline-none` storefront-wide without `focus-visible` replacement.
- **DataTable rows not keyboard-accessible**: `<tr onClick>` with no `role="button"`, `tabIndex`, or key handler; `<th>` has no `scope="col"`.
- Status badges are `<span>` with color dots — no semantic status role.
- `ColorPicker.jsx:240-243` emoji buttons have no `aria-label`; arrows are raw `←`/`→`.
- `DocumentViewer.jsx:94` `📄` decorative span has no `aria-hidden`/`aria-label`.
- `ProfileCard.jsx:24-26` `aria-label` on non-interactive `<span>` (ignored by SRs).

---

## SECTION 13 — VISUAL CONSISTENCY

| Component/pattern | Standard | Conflicting occurrence | Recommendation |
|---|---|---|---|
| Status badge | `StatusBadge.jsx` (pill+dot) | `PackingDashboard` STATUS_STYLE (text pill) · `ShippingDashboard` STATUS_STYLE (text pill, diff colors) · `ui/badge.jsx` (emerald) | One `StatusBadge` with a shared variant map |
| Primary color | Teal token `#1f857a` (design-tokens.css) | **Brown** Tailwind ramp `#c65f3e` dominant · teal hardcoded ×18 | Pick one brand color; drive it from tokens |
| Button | `.btn-primary`/`.btn-secondary` (index.css) | `bg-primary-600` inline ×76 (admin) · `CartToast` inline (storefront) | A real `<Button>` component |
| Card/table container | DataTable/StatCard `rounded-xl shadow-sm border-gray-200` | Custom card grids (CategoryView, BrandsList, PricingEngine) | Shared Card primitives |
| Dark mode | `.dark` warm-stone (`theme.js`) | **Navy `admin-dark`** (`appearance.js`) | One theme system |
| `dark-NNN` classes | — | `dark:bg-dark-800/700/900` ×18 (DocumentViewer, InventoryDashboard, IssueOrdersList) — **undefined token** | Define or remove |
| Icons | AdminIcon (39 stroke) | lucide-react ×18 · emoji (ColorPicker, DocumentViewer, CourierConfig) | Enforce AdminIcon or a named lib, zero emoji |
| Tab bar / section header | — | SiteConfig uses tabs; Products/Customers use tabs; CategoryView uses cards | Consistent tab/page-header pattern |
| Empty state | DataTable icon+message | Custom per-page, missing on Products/Home | Shared EmptyState |
| Loading | Skeleton / spinner mixed | DataTable generic skeleton, others spinner, some none | Shared Skeleton |
| Fonts | `Inter,Cairo` (admin) | storefront adds Aref Ruqaa/Playfair/Great Vibes; `design-tokens.css` `Segoe UI`; `appearance.js` runtime override | One font stack + token |

---

## SECTION 14 — POLISH / "PRODUCTION FEEL"

**Functional issues (not just visual):**
- ✅ **Mojibake in browser-tab title**: `client-admin/index.html:7` `<title>Admin � Mventor-Store.Com</title>` (broken en-dash) — the most visible string in the product.
- ✅ **Emoji corruption**: `ReportsDashboard.jsx` `'ðŸ'°'` (broken UTF-8).
- ✅ **Placeholder mojibake**: `SupplyOrdersList` `"e.g. Supplier name"`.
- ✅ **Integrations** webhook guide contains `"??"` and empty-string placeholders.
- ✅ **`PickingDashboard.jsx` exports `PackingDashboard`** — wrong screen shown.
- ✅ **`ProductForm` price unit bug** — reads ÷100, writes ×1 (see §16).
- ✅ **Undefined `dark-NNN` tokens** — unstyled backgrounds in dark mode.
- ✅ **Theme.ts title**: `#c65f3e` (terracotta) browser chrome vs in-app brand.

**Visual polish issues (lower severity):**
- 6 pages leak emoji (📢 🖼️ 💡 📦 ✏️ ← → 🗑️ ✓) — against your "zero emoji" rule, some intentional (icons), some not.
- `CustomerProfile` Reviews + Wishlist tabs are placeholder text.
- Untranslated English copy on ~12 pages.
- `font-display` serif token defined but never used.
- `Client` (storefront) and admin use different radius vocabularies (storefront 2xl; admin lg/xl) — fine, but there's no single scale.

---

## SECTION 15 — UX FLOWS

### Customer
1. **Landing → browse**: full-screen splash → Skip to Shop → Home (category icons → featured). Friction: splash every visit; home has no single CTA. **Opportunity**: skip-remember flag.
2. **Search → product**: SmartSearch instant + category filter (GOOD). Filter drawer on mobile (GOOD). No empty-state on 0 results. **Opportunity**: "No products found" + clear-filters.
3. **Product → cart**: swatches/sizes, sticky Add-to-Cart (GOOD). **Minor**: variant/color/size selection to error if mismatch; message "Please select a star rating" hardcoded EN.
4. **Cart → checkout**: totals, email, payment method, Kashier redirect (GOOD). Kashier-unconfigured amber banner (GOOD).
5. **Payment → tracking**: success page → order tracker stepper with activity timeline (GOOD). Tracker uses `en-GB` dates; statuses keyed through `t()` (depends on dictionary).
6. **Login → account**: Google + email; onboarding verify phone/address (GOOD). Profile completeness banner; **Arabic prompts untranslated**.
7. **Wishlist**: server-backed, drawer (GOOD). Empty drawer shows no copy.
8. **Arabic shopping**: functional but physically misgeometried (drawers, arrows, alignment) + many hardcoded strings.
9. **Mobile**: sticky CTA, filter drawer, touch swipe, persistent search row — strong. Home category grid tight.

### Admin
1. **Login → dashboard**: CoffeeSplash brand panel → dashboard (GOOD). Privacy-toggle KPIs (strong).
2. **Product creation/edit**: smart search + dense table + structured form; **but price unit bug + weak validation + no unsaved-changes warning** → high risk of silent data error.
3. **Inventory movement**: InventoryDashboard stat cards → Movement modal (dynamic warehouses/locations, atomic-commit note) (GOOD). Transfer has no confirm; errors swallowed.
4. **Warehouse op**: master/detail split-screen (GOOD).
5. **Purchase order**: 3 structured modals with live totals (GOOD); **Cancel unguarded** (risk).
6. **Pricing**: PricingEngine preview + Undo (GOOD); Profit dashboard labeled actual/forecast clearly.
7. **Order processing**: status `<select>` + expandable timeline (GOOD); no confirm, `alert()` errors.
8. **Picking/packing**: task cards + status badges; **picking route renders packing** (bug).
9. **Customer management**: list tabs + profile (GOOD); **Reviews/Wishlist stubs**.
10. **Reporting**: ReportsDashboard/revenue detail; emoji corruption + hardcoded labels.
11. **RBAC**: UsersList + Toggle + permissions; functional but no bulk.

---

## SECTION 16 — UX BUGS vs DESIGN IMPROVEMENTS

**Actual UX/UI bugs (objective, likely to cause wrong interaction):**

| # | Bug | Evidence |
|---|---|---|
| B1 | `PickingDashboard.jsx` exports `PackingDashboard` → picking route shows packing screen | `PickingDashboard.jsx:23` |
| B2 | ProductForm price unit bug — read ÷100, write ×1 (silently corrupts price) | `ProductForm.jsx` read `p.price/100`, write `parseFloat(form.price)` |
| B3 | Admin browser-tab title mojibake | `client-admin/index.html:7` |
| B4 | Undefined `dark:bg-dark-NNN` classes → unstyled in dark mode | `DocumentViewer.jsx:90`, `InventoryDashboard.jsx:147`, `IssueOrdersList.jsx:12` |
| B5 | RTL geometry inverted (drawers, arrows, dropdowns, toggle thumb) | storefront §8; `ThemeToggle.jsx:9-10` |
| B6 | Confirmation/cancel inconsistency + PO Cancel unguarded | `PurchaseOrdersList.jsx:81-85,250-255` |
| B7 | `DataTable` no sticky/sort/pagination/bulk + generic skeleton | `DataTable.jsx:13-23,44` |
| B8 | Errors swallowed to console (Overview, Movements, Products, Warehouses) → blank cards | `Overview.jsx:59,70` |
| B9 | PricingProfit "Loading…" for empty API (false loading) | `PricingProfit.jsx:166` |
| B10 | Storefront empty states missing on Products/Home; Wishlist empty no copy | `ProductsPage.jsx:51` |

**Design improvements (works but could be better):**
- Consolidate to one Button/Input/Modal + one status-badge system.
- Stick to one brand color (teal or brown) via tokens.
- Replace `window.confirm`/`alert()` with the custom dialog layer.
- Add sticky table headers + pagination + bulk actions.
- Mobile stacked-card fallback for wide tables.
- Focus-visible styling storefront-wide.
- Unify date/number locale usage.
- Translate the remaining ~12 pages + add Arabic keys for the missing sidebar group/item labels.
- Add unsaved-changes guards to all forms.

---

## SECTION 17 — PRIORITY MATRIX

| Priority | Area | Problem | User Impact | Recommended Fix |
|---|---|---|---|---|
| **P0** | Admin picking | `/erp/picking` renders the *packing* dashboard | Wrong screen → worker picks with packing instructions | Point picking route at correct component; delete duplicate |
| **P0** | Catalog editing | `ProductForm` price-unit bug silently corrupts retail/cost on save | Real money data error with no warning | Store price in cents: read `Number(p.price)`, write `Math.round(v*100)` + add validation |
| **P0** | Checkout (admin) | PO "Cancel" has no confirmation | Accidental full-order cancellation | Add confirm dialog before destructive status change |
| **P0** | Arabic | RTL geometry broken across both apps | Arabic users get misaligned/mirrored UI | Convert physical props (`left/right`, `translate-x`, `space-x`) to logical (`start/end`, `rtl:` variants); set global `dir` on both apps |
| **P1** | Table UX | No sticky headers, sort, pagination, or bulk on 16-page shared DataTable | Slow scanning/selection at scale | Add sticky header, sort, pagination, bulk row-selection to `DataTable` |
| **P1** | i18n | ~12 pages hardcoded English + sidebar Operations/Finance/Website + items untranslated | Arabic admin users see mixed English | `t()` the remaining strings; add missing dictionary keys |
| **P1** | Mobile | Admin tables unusable at 375px | On-site/warehouse staff on phones can't operate | Stacked-card fallback below `md`; hide low-value columns |
| **P1** | Brand palette | Brown (Tailwind) vs teal (token ×18) — two identities | Inconsistent brand | Pick one; drive from tokens; remove hardcoded hex |
| **P1** | Forms | Weak validation + no unsaved-changes on ~8 forms | Silent data errors, lost work | Required markers, real validation, dirty-state guard |
| **P1** | Dark mode | Two theme systems + undefined `dark-NNN` tokens | Broken/washed-out dark surfaces | Pick one theme; define or remove dark tokens |
| **P2** | Icon system | lucide ×18 + emoji ×6+ vs AdminIcon rule | Inconsistent iconography | Standardize on AdminIcon (or one lib); remove stray emoji |
| **P2** | Feedback | Most CRUD saves no toast; errors → `alert()`/console | Ambiguous success/failure | Unified toast + inline error component |
| **P2** | A11y | No focus-visible storefront; DataTable rows not keyboard accessible; badge/emoji buttons unlabeled | Keyboard/screen-reader users excluded | `focus-visible` ring, `role`/`tabIndex`, `scope="col"`, `aria-label` |
| **P2** | Empty/loading | Missing empty states (Products/Home/Wishlist); false "Loading…" | Confusing blank areas | Shared EmptyState + honest loading |
| **P3** | Polish | Emoji corruption/mojibake (Reports, SupplyOrders, title), placeholder strings, dead mass-delete | Looks unfinished | Replace/corrigate; remove dead code |
| **P3** | Welcome flow | Splash every visit, no skip-remember | Repeat-user friction | LocalStorage skip flag |

---

## SECTION 18 — WHAT SHOULD THE UI LOOK LIKE AFTER IMPROVEMENT

### Customer Storefront
- **Keep** the warm terracotta/ivory/gold identity, glass cards, Aref Ruqaa wordmark, sticky mobile CTA, touch swipe, and custom stroke icons — these are genuinely good.
- **Fix RTL to be a first-class mirror**: convert all physical offsets to logical (`start/end`, `rtl:*` variants), set `dir` on the root, mirror arrows/chevrons/drawers, right-align Arabic text, use `ar-EG`/local formats consistently.
- **Introduce a tiny shared primitive set** (`Button`, `Input`, `Card`, `EmptyState`, `Skeleton`) so pages stop hand-rolling competing button styles.
- **Add the missing empty/error states** and move the splash behind a "skip" memory.
- **Complete Arabic**: key every remaining string, add the missing keys, set `dir="rtl"` on all inputs (not just Login).

### Admin ERP
- **One brand color** (recommend committing to Clinical Teal and rebuilding the Tailwind `primary` ramp to teal, OR committing to brown and removing hardcoded teal — don't keep both).
- **Keep** DataTable/StatCard/StatusBadge/Toggle/AdminIcon and grow them: add sticky header, sort, pagination, bulk selection, real skeleton that mimics columns.
- **Build a shared `Modal`, `Button`, `TextField`, `ConfirmDialog`, `Toast`** (the `.btn-primary/.card` layer already exists — actually use it). Replace `window.confirm`/`alert()`/raw `alert`.
- **Status system**: one `StatusBadge` with a shared variant map for orders/picking/packing/shipping/PO/supplier.
- **Stacked-card fallback** for wide tables below `md`.
- **Complete Arabic**: `t()` all pages, add Operations/Finance/Website + item keys, `dir="rtl"` + Cairo on all inputs, logical alignment in DataTable cells and Select.
- **Fix dark mode** to a single system with defined tokens; remove `dark-NNN` or define them.

---

## SECTION 19 — PAGE-BY-PAGE SCORECARD

| Application | Page | Visual | UX | Responsive | RTL | Consistency | Status | Main Issue |
|---|--:|--:|--:|--:|--:|---|---|---|
| Storefront | Welcome `/` | 8 | 7 | 8 | 4 | 8 | OK | No-empty-slides state; home btn RTL |
| Storefront | Home `/home` | 8 | 6 | 7 | 3 | 7 | OK | No empty/error state; category grid tight |
| Storefront | Catalog `/products` | 8 | 6 | 8 | 2 | 6 | OK | No empty state; EN labels; RTL drawer |
| Storefront | Product detail | 9 | 8 | 9 | 4 | 8 | GOOD | RTL; EN strings; long desc |
| Storefront | Cart/Checkout | 8 | 8 | 8 | 4 | 8 | GOOD | RTL price col; EN placeholders |
| Storefront | Success/Cancel | 7 | 7 | 8 | 4 | 7 | OK | EN copy |
| Storefront | Order tracker | 7 | 7 | 8 | 3 | 7 | OK | `en-GB` dates; `←` arrow |
| Storefront | Account | 7 | 7 | 7 | 3 | 7 | OK | EN copy; RTL arrows |
| Storefront | Login | 8 | 8 | 8 | 6 | 8 | GOOD | Only page w/ input RTL |
| Storefront | Onboarding | 7 | 6 | 7 | 3 | 7 | OK | No loading; EN copy |
| Admin | Overview/Dashboard | 7 | 8 | 7 | 3 | 7 | GOOD | Error swallow |
| Admin | ProductsList | 7 | 8 | 5 | 3 | 7 | GOOD | No h1/pagination; mobile |
| Admin | ProductForm | 6 | 5 | 7 | 3 | 6 | **RISK** | Price-unit bug; weak validation |
| Admin | CategoriesView/List | 7 | 7 | 7 | 3 | 7 | GOOD | Sparse long list |
| Admin | Brands | 7 | 7 | 7 | 3 | 7 | GOOD | No save toast |
| Admin | InventoryDashboard | 8 | 9 | 6 | 3 | 8 | GOOD | Mobile tables; no search/sort |
| Admin | MovementsList | 8 | 8 | 5 | 3 | 8 | GOOD | No search; mobile 10-col |
| Admin | WarehousesList | 8 | 8 | 5 | 3 | 8 | GOOD | No pagination; mobile |
| Admin | SuppliersList | 6 | 6 | 5 | 3 | 6 | OK | No pagination; alerts |
| Admin | PurchaseOrdersList | 8 | 9 | 5 | 3 | 8 | GOOD | **Cancel unguarded** |
| Admin | PriceLists | 7 | 7 | 7 | 3 | 7 | GOOD | Native confirm |
| Admin | PricingEngine | 8 | 8 | 7 | 4 | 8 | GOOD | Empty=Loading; RTL inputs |
| Admin | PricingProfit | 8 | 8 | 6 | 3 | 8 | GOOD | False Loading; no pagination |
| Admin | CustomersList | 7 | 8 | 6 | 4 | 7 | GOOD | No bulk; no server search |
| Admin | CustomerProfile | 7 | 6 | 7 | 4 | 7 | **STUB** | Reviews/Wishlist placeholder |
| Admin | VipInvitations | 7 | 7 | 7 | 4 | 7 | OK | lucide icons |
| Admin | OrdersList | 7 | 8 | 6 | 4 | 7 | GOOD | No h1; no confirm |
| Admin | Picking/Packing | 6 | 6 | 6 | 3 | 6 | **BUG** | Picking shows Packing |
| Admin | Shipping | 7 | 8 | 6 | 3 | 7 | GOOD | No loading in list |
| Admin | Reports | 6 | 6 | 6 | 2 | 6 | OK | Emoji corruption; EN |
| Admin | FinancialPeriods | 6 | 6 | 6 | 3 | 6 | OK | EN; untranslated confirm |
| Admin | Settings/Export | 8 | 8 | 7 | 4 | 8 | GOOD | — |
| Admin | UsersList/RBAC | 7 | 8 | 6 | 4 | 7 | GOOD | No bulk |
| Admin | Notifications | 6 | 6 | 6 | 2 | 6 | OK | EN; missing AR keys |
| Admin | Integrations | 6 | 7 | 6 | 3 | 6 | OK | lucide; "??" placeholders |
| Admin | Announcements/Hero/Welcome/AI | 5 | 5 | 6 | 2 | 5 | OK | EN + emoji + native confirm |
| Admin | SiteConfig | 8 | 8 | 7 | 5 | 8 | GOOD | Tab-label AR keys missing |
| Admin | AdminLogin | 8 | 8 | 7 | 4 | 8 | GOOD | Error fallback EN |
| Admin | IssueOrdersList | 8 | 9 | 7 | 6 | 9 | **BEST** | Model for the rest |

---

## SECTION 20 — FINAL VERDICT

### Customer Storefront Verdict
- **Already strong:** a genuinely distinctive, premium visual identity (terracotta/ivory/gold, glassmorphism, Aref Ruqaa wordmark, custom icons) and excellent mobile purchase mechanics (sticky CTA, touch swipe, filter drawer, persistent search). Empty states on cart/tracker and the success/error flows are good.
- **What prevents it from being excellent:** the Arabic/RTL experience is **not production-quality** (physical geometry + hardcoded strings), and the missing empty/error states + inconsistent loading make the catalog feel unfinished under real data.
- **Most important fixes:** (1) RTL mirroring; (2) complete Arabic keying; (3) shared primitives; (4) empty/error/loading states.

### Admin ERP Verdict
- **Already strong:** operationally it is genuinely usable and even sophisticated in places — InventoryDashboard (stat cards + hide-when-empty alerts), PurchaseOrdersList (3 structured modals + live totals), WarehousesList (master/detail), Movement audit-trail table, CSV import wizard, SiteConfig/IssueOrdersList Arabic, privacy-toggle KPIs. `DataTable`/`StatCard`/`StatusBadge`/`Toggle` are real reusable primitives.
- **What makes it feel inconsistent/unpolished:** two brand colors (brown dominant + teal token), three status-badge systems, two dark themes + undefined dark tokens, lucide+emoji vs AdminIcon, native `confirm()/alert()` mixed with a custom modal, no pagination/bulk/sticky headers on the shared table, mobile scroll-only tables, and the picking→packing route bug + the ProductForm price-unit bug.
- **Most important fixes:** (1) fix picking/packing + ProductForm bugs; (2) one color + one theme + one design system; (3) DataTable sticky/sort/pagination/bulk; (4) mobile stacked fallback; (5) full Arabic + untranslated pages; (6) unified confirm/feedback.

### Overall UI/UX Verdict
> **POLISHED CORE — NEEDS CONSISTENCY + UX HARDENING**

The storefront core is genuinely polished; the admin core is operationally strong. Both are undermined by **no true design system**, a **systemic RTL/Arabic gap**, and a handful of **real bugs** (picking/packing swap, price-unit corruption, unguarded PO cancel, undefined dark tokens). Executive summary in one line: *great bones, needs one design system, one Arabic experience, and a bug pass.*

---

## SECTION 21 — EXACT FILES TO FIX

### P0 — blocking/dangerous
| Issue | File | Component | Change |
|---|---|---|---|
| Picking shows Packing | `client-admin/src/admin/pages/PickingDashboard.jsx:23` | export | Return real picking component (or point route at correct file); delete dup |
| Price-unit corruption | `client-admin/src/admin/pages/ProductForm.jsx` | price/cost fields | Read `Number(p.price)` (cents), write `Math.round(v*100)`; add price/cost validation |
| PO cancel unguarded | `client-admin/src/admin/pages/PurchaseOrdersList.jsx:81-85,250-255` | cancel/status | Add ConfirmDialog before destructive status change |
| RTL geometry (storefront) | `client/src/components/{ProductCard,Navbar,DrawerShell,CartDrawer,SmartSearch,FilterSidebar,ThemeToggle}.jsx`; `client/src/pages/{CartPage,OrderTrackerPage,AccountPage,HomePage,ProductsPage}.jsx` | physical props | `left/right→start/end`, `translate-x→rtl:` variants, `space-x→gap`, mirror arrows, global `dir` |
| RTL geometry (admin cells/select) | `client-admin/src/admin/components/{DataTable,Select}.jsx` + all pages using `text-right` | alignment | `text-right→text-end`, `pl-2.5 pr-7→px-* start/end` + chevron logical |

### P1 — high
| Issue | File | Component | Change |
|---|---|---|---|
| No sort/pagination/bulk/sticky | `client-admin/src/admin/components/DataTable.jsx:13-23,41-49` | table | Add `sticky top-0` thead, sort, pagination, bulk selection, column-aware skeleton |
| Hardcoded EN (admin) | `client-admin/src/admin/pages/{ReportsDashboard,FinancialPeriods,CategoriesList,MovementsList,SuppliersList,FeaturedList,AnnouncementsList,HeroSlidesList,AISettings,WelcomeSlidesList,SupplyOrdersList,KashierPage,EventsList,NotificationsPage}.jsx` | labels | Wrap in `t()` |
| Sidebar AR labels missing | `client-admin/src/admin/components/Sidebar.jsx` + `client-admin/src/i18n/translations.js` | group/item keys | Add Operations/Finance/Website + Financial Periods/Audit Log/Packing/Picking/Accounting/Retail Pricing/Warehouses & Shelves AR keys |
| Mobile tables | all 16 DataTable consumers (esp. `ProductsList,MovementsList,WarehousesList,PurchaseOrdersList`) | responsive | Stacked-card fallback below `md`; hide low-value columns |
| Brand color split | `client-admin/tailwind.config.js:13-24` + `client-admin/src/styles/design-tokens.css` + `client-admin/src/admin/pages/{ProfileCard,CustomerProfile,VipInvitations}` + `SalesChart.jsx` | primary | Pick one color (commit to teal & rebuild `primary` ramp, or commit to brown & remove hardcoded teal ×18) |
| No shared Button/Input/Modal | `client-admin/src/index.css` (`.btn-primary/.card` exist unused) + storefront `client/src/index.css` | primitives | Build real `Button/TextField/Modal/ConfirmDialog/Toast`; consume; disable hand-rolled `bg-primary-600` |
| Weak form validation + no unsaved guard | `client-admin/src/admin/pages/{ProductForm,PriceLists,Shipping,WarehousesList,SuppliersList}.jsx` | forms | Required markers, real validation, dirty-state `beforeunload` |
| Two dark themes + undefined tokens | `client-admin/src/utils/{theme,appearance}.js`; `client-admin/src/admin/pages/{DocumentViewer,InventoryDashboard,IssueOrdersList}.jsx` (`dark-NNN`) | theme | Single system; define or remove dark tokens |

### P2 — medium
| Issue | File | Component | Change |
|---|---|---|---|
| Status badge ×3 systems | `client-admin/src/admin/components/{StatusBadge,ui/badge}.jsx` + `PackingDashboard.jsx` + `ShippingDashboard.jsx` STATUS_STYLE | badge | One StatusBadge variant map |
| lucide vs AdminIcon vs emoji | `client-admin/src/admin/pages/{VipInvitations,Overview,RevenueDetail,DashboardDetailPage,OrdersList,IntegrationsPage,ProductForm,ProductsList,ProductsTrash}.jsx` + `ColorPicker/DocumentViewer/CourierConfig` | icons | Standardize; remove stray emoji (✏️←→🗑️📄✓) |
| No focus-visible storefront | `client/src/components/*.{jsx}` (esp `ThemeToggle.jsx:23`) | buttons | `focus-visible:ring-2 ring-primary-500` |
| DataTable a11y | `client-admin/src/admin/components/DataTable.jsx:46-63` | table | `role="button"`, `tabIndex`, key handler, `scope="col"` |
| Missing empty/error states | `client/src/pages/{ProductsPage,HomePage}.jsx`; `client/src/context/WishlistContext.jsx` | pages | Shared EmptyState; honest error banner |
| Error swallow | `client-admin/src/admin/pages/{Overview,MovementsList,ProductsList,WarehousesList}.jsx` | data loads | User-facing error banner |

### P3 — low
| Issue | File | Change |
|---|---|---|
| Mojibake title | `client-admin/index.html:7` | Replace `�` with en-dash |
| Emoji corruption | `client-admin/src/admin/pages/ReportsDashboard.jsx` | Fix broken UTF-8 `ðŸ'°'` |
| Placeholder mojibake | `client-admin/src/admin/pages/SupplyOrdersList.jsx` | Fix `"name"` |
| Integrations "??" | `client-admin/src/admin/pages/IntegrationsPage.jsx` | Remove placeholder chars |
| Dead mass-delete | `client-admin/src/admin/pages/ProductsList.jsx:216-227` | Remove `{false && …}` |
| Splash skip-remember | `client/src/pages/WelcomePage.jsx` | LocalStorage skip flag |
| No-empty-slides state | `client/src/pages/WelcomePage.jsx` | Graceful empty state |
| False "Loading…" empty | `client-admin/src/admin/pages/PricingProfit.jsx:166` | Real empty state |

---

## Summary — 10 most important UI/UX changes to implement first

1. **Fix `PickingDashboard.jsx` to render Picking (not Packing)** — wrong screen shown today.
2. **Fix the `ProductForm` price-unit bug** — it silently corrupts retail/cost prices on every edit.
3. **Add a confirmation dialog before "Cancel" on a purchase order** — the highest-risk unguarded destructive action.
4. **Make Arabic/RTL a first-class mirror** — convert physical offsets to logical `start/end` + `rtl:` variants across both apps; set global `dir`.
5. **Complete Arabic i18n** — key the ~12 hardcoded-English pages and add the missing sidebar group/item labels (Operations/Finance/Website, Financial Periods, Audit Log, Packing, Picking, etc.).
6. **Upgrade the shared `DataTable`** — sticky header, sorting, pagination, bulk selection, column-aware skeleton; it powers 16 pages.
7. **Build one real design system** — shared `Button`/`TextField`/`Modal`/`ConfirmDialog`/`Toast`, one status-badge map; actually consume the already-defined `.btn-primary`/`.card` classes; kill hand-rolled `bg-primary-600`.
8. **Pick one brand color** — commit to teal (rebuild the Tailwind `primary` ramp) or commit to brown (remove the 18 hardcoded teal values); never both.
9. **Unify dark mode** — one theme system; define or remove the 18 undefined `dark-NNN` tokens.
10. **Add mobile fallback + empty/error states** — stacked-card tables below 768px, and real empty/error UI for Products/Home and the admin data grids.

---

*Report compiled from source inspection of `client/` and `client-admin/`. Evidence is `file:line`-cited. No files were modified. Cross-check where a tag is `UNVERIFIED` (e.g., runtime screenshots, exact 320px pixel widths) and treat those as inspect-at-runtime before relying on them.*
