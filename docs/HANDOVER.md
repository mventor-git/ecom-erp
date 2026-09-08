# Handover Note

**Date:** 2026-09-07
**From:** Mventor (Execution Owner)
**To:** Project Owner / Next Session

## ⏸️ CHECKPOINT — WHERE WE STOPPED

**State at stop:** 078 **COMPLETED** — https://github.com/mventor-git/ecom-erp at 813bcc9 (3 commits, secrets verified, tree clean). STOP — Ticket D NOT started.

**Completed this handoff:**
- 057 follow-up: layer-unified basis + VIP preview + honest Cost→Retail→VIP table + missing-pricing guard. Behavior preserved via fallback; VIP never applied/stored; overrides/history untouched.
- Prior slice: `pricingService.computeRetailPreview` single engine, manager delegates, dead `tierDiscount` removed, NEW canonical test, `npm test` fixed.
- Docs: CHANGELOG/BACKLOG/PROJECT_STATE updated; ticket 057 notes recorded.

**NEXT TASK (do NOT start inside this ticket)**
- OWNER DECISION needed: VIP derivation rule? layer-basis vs cost_price unification? PricingEngine.jsx label scope? Then follow-up UI slice. One ticket at a time; current STOPs here.

**Completed this handoff:**
- Re-read MUSE earlier reports (`CURRENT-STATE-MATRIX`, `PRODUCTION-HARDENING-CHANGELOG` Batches 1-10, `PAYMENT-DOMAIN`) — old P0s confirmed already fixed (money, PickingDashboard, orderPricing, reserve, wedding, FK SAVEPOINT, supplier FK, Kashier amount verify). 12 ECOM-ERP dumps are doc noise; code is healthier than docs.
- Ran current baseline: **20 suites / 126 tests green** (was 16/118 on 2026-08-23; new: paymentDomain, signature, addressSnapshot, purchaseOrder).
- Closed `mventor-ticket-053` PO UI Closure — see ticket for evidence. Gap was `sent→cancelled` required reason not wired: backend 400 if missing, frontend `adminApi` only sent `{status}` and detail had no audit display. Now: `adminApi(id,status,reject_reason)` + RejectDialog (textarea, required, 300 char, counter, inline error, disabled until non-empty) for `sent→cancelled`; ConfirmDialog for `draft→cancelled` (no reason); detail audit box (`created_by`, `ordered_at`, `approved_by/approved_at`, `received_at`, `rejected_by/rejected_at + reject_reason`); state-aware buttons; `actionLoading` + `successMsg`; inventory invariant proven (PO create/sent/confirmed/cancelled never move stock; only `receive` does).
- Closed `mventor-ticket-054` Report Center — `/erp/reports` redesigned (category sidebar + search grid, date-preset filter bar, Sortable/Sticky/Responsive DataTable, StatCards, CSV/PDF/MD exports, honest states). Real fixes: RBAC `reports.read` added to `GET /` + `/:reportType` + `/export` (were adminAuth-only); frontend wrapper-unwrap bug (always 0 results). FIFO P&L gap documented, not faked.
- Closed `mventor-ticket-055` Financial Periods (honest timeline) — data-authority fix (Opening-balance "Fill" read legacy `products.stock` → now canonical `getInventorySummary()` `qty_on_hand`); `window.confirm`→`ConfirmDialog`; StatCards/status/`closed_at`; honest disclaimer (no GL/journal/lock). NEW `tests/financialPeriod.test.js` 4/4 proves OB posts a REAL `opening_balance` ledger movement + reconciles on-hand. Verified 21/130 + admin build.
- Closed `mventor-ticket-056` Fulfillment UI consolidation — StatusBadge unified (48 status keys; Packing + Shipping dashboards render shared `<StatusBadge>`); `window.confirm`→`ConfirmDialog` (delete-provider); `console.error`-only→user-facing error; PackingDashboard mojibake eliminated. Pipeline (packed→ready_for_shipping→shipped) verified already wired (tested), NOT rebuilt. WAREHOUSE ISSUE kept separate from CUSTOMER FULFILLMENT. Verified 21/130 + admin build.

**NEXT TASK (do NOT start inside this ticket)**
`mventor-ticket-057` — Pricing Engine rebuild (Cost→Retail→VIP) — handoff §23 #4. One ticket at a time; current STOPs here.

**Previous session (2026-08-23) checkpoint still valid unless superseded:**
- Tickets 044–050 closed (trash, hardening, sidebar/dark, bridge, RBAC, security). Next planned then was warehouse redesign — now superseded by handoff roadmap.

## NEXT TASK (do NOT start inside this ticket)
**Per execution handoff §§22–23:** `mventor-ticket-057` Pricing Engine rebuild (Cost→Retail→VIP) — §23 #4. Then price-lists consolidation, settings IA. One ticket at a time. Current ticket STOPs here.

## What To Do Next (owner)
1. Hard-refresh admin (`Ctrl+Shift+R`) → `/erp/purchase-orders` → create PO (draft) → **Mark Sent** (ordered_at appears) → **Approve** (approved_by/at appears, no stock change) → create another → **Mark Sent → Cancel** (now opens RejectDialog requiring reason → sends `reject_reason`, shows red audit card, no stock change). `Receive` is the ONLY path that adds stock (with cost layer).
2. Verify: `npm test` still 20/126; both builds still pass.
3. Read `docs/archive/legacy/production-hardening-changelog` Batches 9-10 + ticket 053 for the full PO ≠ receiving proof.

## Warnings
- `ADMIN_PASSWORD=********` + probe `_seed-kashier.cjs` secrets still on disk (gitignored) — rotate before any public tunnel.
- `server/data/store.db` is the live DB (sql.js in-memory → file, FK ON, 400ms save window). Never edit the file while backend runs; use API. Integration tests boot against the REAL `store.db` — never add destructive tests.
- `mobile-app` / `worker-app` are gitignored + nested zero-commit repos + hardcoded `http://<dev-lan-ip>:5172/api/v1` + missing `projectId`/`eas.json` — do NOT delete, stabilize later as separate track.
- Do NOT fake GL/journal/AR/AP (reports are operational). Variant-level inventory is a **business decision** (MUSE P0-A) — do not implement blindly.

## Notes
- Docs drift remains: `profile.md` still says port 3000 / Stripe / 107+28 tests / no git — truth is `5172 / Kashier / 20/126 / git 6ac0c01`. `BACKLOG`/`TECHNICAL_DEBT`/`KNOWN_ISSUES` still frozen at 2026-08-23 — handoff §17 says update only relevant sections concisely, not another dump.
- Strong patterns to preserve: `valuationService` independence, nested SAVEPOINT, FK + `assertOrderExists`, webhook HMAC + `INSERT OR IGNORE` + amount verify, `money.js`, `salesInventoryBridge` idempotency, supplier FK, Kashier Payment Center.
