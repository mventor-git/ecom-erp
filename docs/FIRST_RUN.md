# First Run & Data Onboarding — the operator's path

**Audience:** a brand-new install. No developer required after the Quick Start in `README.md` (`copy .env.example`, set `ADMIN_USERNAME/ADMIN_PASSWORD/SESSION_SECRET/JWT_SECRET`, run).

## 1. Launch

```bash
cd server && npm install && npm start        # API on :5172
cd ../client-admin && npm install && npm run dev   # admin panel on :5174
cd ../client && npm install && npm run dev          # storefront on :5173
```
A brand-new database is born **empty by design**: no invented products, customers, reviews or transactions — only the universal scaffolding (roles/permissions, the starter "Main Warehouse", default price lists, accounting roles, one initial operator account from your env).

## 2. First login → the Setup wizard

Open the admin panel, log in with `ADMIN_USERNAME`/`ADMIN_PASSWORD`. Until the core is configured you land on **Setup** (also always reachable from the sidebar):

| Step | What it is | Where it writes |
|---|---|---|
| Company identity | your business name / tagline — every document, receipt, journal and the storefront read it | Settings |
| Currency & timezone | defaults EGP / Africa/Cairo — change BEFORE first data if different | Settings |
| Warehouse | rename “Main Warehouse”, add shelf locations | Warehouses |
| First financial period | **required**: postings and stock moves fail closed outside an open period | Financial Periods |
| Catalog | import or add products (stock comes later via receipts/opening balance) | Import / Products |
| Suppliers / customers / opening stock | next actions, not blockers | their pages |

The checklist is recomputed from your real records every visit — it can never claim something isn't true.

## 3. Bring real data in (recommended path)

**Setup → Import Data** (or add records by hand — same servers, same rules):

1. Pick the dataset (Products, Suppliers, Customers, Warehouses) and **Download template** for the exact expected columns.
2. Upload **CSV or XLSX** and **Preview**: you get the exact plan — every line marked *create*, *update*, or *error* with a reason; duplicates inside your sheet and against existing records are matched by business key (SKU→name, name, email, code); money must be plain EGP amounts up to 2 decimals (stored as integer cents — never rounded silently); products without price get the configured markup from their cost. New categories/brands listed in the sheet appear in the plan before anything is created.
3. **Commit** (only enabled with 0 errors): one atomic transaction — if any row fails validation the import applies **nothing**; fix the sheet and re-upload. Repeating an import on the same file updates matched records instead of duplicating them. Product imports never change existing stock: inventory arrives only through receipts, the period opening-balance sheet or counted adjustments.
4. Committed files are archived under `server/data/imports/` (audit), and every import writes one auditable event with the acting user.

Template: `name,cost_price,category,sku,stock` + optional `price,old_price,brand,barcode,min_stock,reorder_point,description,image_url,sizes,colors,active` (sizes/colors `;`-separated). Suppliers: `name,contact_name,email,phone,address,lead_time_days,notes,active`. Customers: `email,name,phone,address,city,governorate`. Warehouses: `code,name,address,active`.

## 4. Open the books correctly

- **Period opening stock**: Financial Periods → “Set Opening Balance” counts your shelves; each line posts a real opening movement and (with a known cost) its GL entry Dr Inventory / Cr Owner's Equity.
- A shrinkage/damage found while counting: Inventory → movement `adjustment` (negative) with its unit cost when known; it books Dr Adjustments / Cr Inventory automatically once costed. Unknown cost stays listed in **Inventory Recon** until a cost is entered — the system never guesses a number into your ledger.
- **Statements** (Finance): Trial Balance, P&L, Balance Sheet — all computed from posted journals only. Operational reports (Sales/Profit dashboards) stay explicitly operational and never pretend to be the books.

## 5. Run a real day

1. Suppliers → create; Purchase orders → create (items at real supplier prices), mark sent → confirmed, then Receive goods — inventory moves and AP recognizes (Dr Inventory / Cr Payables) line by line.
2. Sell: storefront/mobile/web orders, worker delivers & collects COD (auto-settled when payment is actually collected at delivery), counter sales settle at the register with cash/card (one atomic order+stock+journal), offline bank collections are settled with evidence (POST …/settle).
3. Refunds always go through the refund seam: the posted sale stays; an immutable reversal entry is posted; goods coming back is a separate counted return.
4. Pay suppliers: supplier payments apply to purchase orders (full/partial, idempotent replay protected), Dr Payables / Cr Cash.
5. Read truth: AP Aging, Revenue Reconciliation (collected vs books, per order), Inventory → GL Reconciliation (books vs warehouse, per movement), Chart of Accounts, Journals (every entry, source, actor, timeline).

## 6. Self-check (no human needed)

`cd server && npm test` includes a **business-journey acceptance test** that boots a brand-new database and plays a full company day over real HTTP (wizard → import → receive → pay → sell/refund/return/adjust → reconciliation → statements → audit trail), asserting every number and every refusal. `node probes/businessJourney096.js` runs just that journey.

## 7. Deliberate limits today (honest, by design)

- Supplier **invoicing/payment terms/true due-date aging** — not invented; AP ages from recognized receipts.
- **VAT, payroll, fixed assets, multiple entities, AR** — out of scope; accounts exist so an accountant can post any correction manually (with audit + period locks).
- Pre-093/096 legacy live data may show drift (e.g. old no-cost receipts or adjustments that did not consume FIFO layers); the controls list it — an operator decides to book it via a journal or leave it visible. Nothing is ever auto-"repaired" by editing history.
- `npm test`/journey run against real SQLite files: production data must exist before enabling anything that expects it; use `server/data/store.db`'s daily automatic backups (`server/` scheduler) + copy it off-machine.

## 8. Backup & recovery

Everything is one folder: `server/` + its `data/`. Nightly backups land in `server/data/backups/`. Recovery = stop server, copy the chosen `store.db` over `data/store.db`, start. Verify occasionally: the journal list on Financial Periods close/reopen, journals list and reconciliation are the audit trail your recovery depends on.
