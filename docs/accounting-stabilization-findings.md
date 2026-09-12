# Accounting stabilization: forensic findings

**Date:** 2026-09-12  
**Repository state:** `origin/master @ 4d2420d`  
**Author:** Mventor (forensic review after 089, before 090)  
**Scope:** 086–089 accounting pipeline + known repo-wide integrity items found during review

This pass is **not feature expansion** — no AP aging started, no UI additions.
Every claim below was verified against actual code before touching it.

## Findings table

| # | Finding | Verdict | Sev | Files/functions | Intended invariant | Fix applied |
|---|---------|---------|-----|-----------------|-------------------|-------------|
| **F1** | `findPostedReceipt`/`findPostedEntry` return ANY status journal on replay — a stranded DRAFT (created but failed to `postEntry`) is treated as posted | CONFIRMED | P0 | `purchasePosting.js:19`, `salesPosting.js:19` | Replay means `status='posted'`; retry posts stranded draft | Both check `.status === 'posted'` first; on retry if `status==='draft'` the draft is **posted** (recovered) then returned as `posted:true`. `findPaymentJournal` named honestly; all 3 functions query `journal_entries`, return the entry, callers decide from `.status`. |
| **F2** | Financial amounts silently rounded via `Math.round(Number(...))` | CONFIRMED | P0 | `journalService.js:42-43`, `supplierPaymentService.js:167/170/254`, `salesPosting.js:45/51`, `purchasePosting.js:43/44` | Integer cents required, fractional rejected without rounding | `assertIntegerCents(value, label)` rejects non-integers with a clear error. Applied at: journal line amounts, payment totals, application lines, COGS units, receipt unit_cost, payment.amount |
| **F3** | `assertEntryDate` regex-only — `2026-02-31` accepted; `todayISO()` = UTC date, semantics not documented | CONFIRMED | P0 | `journalService.js:19-26`, `supplierPaymentService.js:38-47` | Calendar-valid dates; canonical YYYY-MM-DD, UTC default, semantics explicit | `isValidCalendarDate(s)` regex + `Date.UTC(y,m-1,d)` round-trip comparison. `todayISO()` comment documents UTC-calendar-day decision in `journalService.js`. Both entry_date and paid_at call `isValidCalendarDate` |
| **F4** | Reversal reason is UI-only (React enforces it but `reversePayment` accepts empty reason directly) | CONFIRMED | P0 | `supplierPaymentService.js:252-274` | Reason mandatory server-side, ≤ 300 chars, no edit/delete of posted payment | `reversePayment()` now `cleanReason = trim(req.reason)`; rejects empty/blank with clear error; length > 300 → reject. 300 is canonical server limit (matches UI maxLength). |
| **F5** | Idempotency: a reused `idempotency_key` returns the existing payment without checking whether the request (amount, apps, method, date) actually matches | CONFIRMED | P0 | `supplierPaymentService.js:87-90/153-156/193-200` | Same key + same canonical request ⇒ replay; different ⇒ conflict | `idem_fp TEXT` stored: `sha256({v:1,s,a,m,d,p:apps.sorted})`. `findByIdempotencyKey()` compares the fp; mismatch ⇒ `idempotency-conflict` (route 409). Probe adds `idem_fp` column idempotently on legacy DBs. |
| **F6** | `unpostEntry` can silently convert posted sourced journals (088/086/087 bridge payments) back to draft | CONFIRMED | P0 | `journalService.js:178-192` | Posted sourced journals immutable; manual (null source) keep 079 cycle | Refuse unpost when `header.source_type` is present. Error names the source (`sourced journals are immutable, source_type/source_id — use reversal flow`). Manual null-source journals cycle normally. No 079 semantics break. |
| **F7** | Period gate: a lookup failure returns null (fail open) — both journal `postEntry` and movement `createMovement` treat "no data" as "not closed" | CONFIRMED | P0 | `journalService.js:133-145`, `inventoryService.js:57-74` | Lookup failure ⇒ **refuse** to post/move; null result (no covering period) ⇒ allowed | Both period lookups wrapped in explicit try/catch throw: `Financial period control unavailable — refusing to post/move: <msg>`. Only a successful null (no CLOSED covering dates) means allowed. |
| **F8** | `reversePayment` silently maps unknown/stored method to Cash 1000 via `\|\|` fallback | CONFIRMED | P0 | `supplierPaymentService.js:252` | Unknown method ⇒ fail explicitly (never guess an account) | `METHOD_ACCOUNTS[m]` is looked up; absent ⇒ explicit throw "stored method has no chart mapping — repair". Cash path unchanged. |
| **F9** | Overpayment/outstanding check runs in the pre-transaction block only, before the write lock | CONFIRMED | P1 | `supplierPaymentService.js:167-210` | Authority check must run **inside** the transaction against live derived state | `validateApplications()` function created; called before transaction for fast UX rejection AND inside `db.transaction()` for atomic authority against the **live derived** outstanding. No fake counters. |
| **F10** | `findPostedReceipt`/`findPostedEntry`/`findPostedJournal` named "posted" but query without status filter | CONFIRMED | P1 | three posting helpers + export names | Name and query must agree | Renamed honestly: `findReceiptJournal`/`findOrderJournal`/`findPaymentJournal`, all return `journal_entries` rows (status explicit), callers check `.status`. |
| **F11** | `db.js` order_items schema: fresh-DB CREATE has legacy columns only, but four writers insert the normalized mirrored family — fresh installs crash on checkout write | CONFIRMED latent | P1 | `db.js:479-501` (creation) + 4 writers | `db.js` is the one canonical schema; all four writers insert the same 5 mirror columns | Added the mirrored family (variant_id, sku, qty, base_price, …, cost_snapshot) to `db.js` via an idempotent `if (missing) db.run(ALTER)` block. All fresh DBs now match live DB schema. |
| **F12** | Tests share live `store.db`: purchaseOrder.test leaks `po-item` rows into every run; mobileApi picks ambient in-stock products (litter po-item with 0 stock = 7 cascading worker-API integration failures on HEAD); no CI-repeatable isolation | CONFIRMED | P1 | 8 files: `db.js`, `purchaseOrder.test.js`, `mobileApi.test.js`, `run-integration-tests.js` + NEW `run-isolated-tests.js` | Deterministic repeated CI: isolated or cleaned fixtures; no test sees other tests' litter | a) `purchaseOrder.test.js`: self-cleans its products on teardown b) `api.test.js` + `mobileApi.test.js`: self-contained fixtures (create own product + warehouse state) c) `ECOM_DB_PATH` env var supported d) `run-isolated-tests.js`: snapshots to `store.test.db`, runs tests on copy, removes it **after** run e) `run-integration-tests.js` uses ECOM_DB_PATH for user seeding if present f) `package.json`: `test:isolated` + `test:isolated:integration` scripts |
| **F13** | Docs: `origin/master 4d2420d` already pushed (089 committed), but PROJECT_STATE baseline reads `41 suites / 217 tests`, HANDOVER "089 diff validated **not** committed", CHANGELOG has no 4.17.x entry, .mventor/PROJECT_STATE stale on 089 | CONFIRMED | P1 | `docs/PROJECT_STATE.md`, `docs/CHANGELOG.md`, `docs/HANDOVER.md`, `docs/BACKLOG.md`, `.mventor` | Synchronize actual state at 4d2420d + this stabilization | PROJECT_STATE: baseline 42/235 + 107/107 + "stabilization pass completed"; CHANGELOG: 4.17.1 entry; HANDOVER: fourth checkpoint with stabilization summary; BACKLOG: update accounting track status |

## Verification evidence (stabilization at HEAD after commit)

- 42/42 unit suites, **235/235 PASS** (`npm test`); both HEAD and stable exit 1 → jest worker handle-leak is pre-existing (same on both)
- Integration **107/107 PASS, exit 0** (was 7 failed → 107 passed → 1 failed → 107 passed)
- HTTP focused smoke (all 88/89 + stabilization semantics): **14/14 PASS**, no crash on reasonless, 409 conflict, 400 fractional/impossible-date, reversal opposite journal posted, orphans=0
- DB smoke on a real **fresh DB** (probe2, then `fs probe`) + `probe_fresh`: ECOM_DB_PATH + F8 + F11 reconcile; order_items has all 12 normalized cols; supplier_payments has idem_fp
- Unit test on live **store.db** (default `npm test`) + isolated `npm run test:isolated` both pass 235 (snapshot copy proves no cross-contamination)
- **Secret scan** on 14 files: zero real credentials, only test fixtures (`IntegrationTest123!`, `sk_test_dummy` env var — `run-integration-tests.js` pre-existing, documented)
- Admin build: pass exit 0

## What was deferred from the scope

Nothing deferred. All 13 findings are confirmed and implemented here.

## Constraints honored

- **No new source of truth for AP or inventory**: outstanding = derived from posted journals, zero mutable counters.
- **Reversal model intact**: all 088/089 reversals still use `postEntry` + status; no 087/086 posting semantics broken
- **Manual 079 cycle preserved**: null-source journals keep `postEntry`/`unpostEntry`; only posted *sourced* journals become immutable (F6)
- **Existing test coverage maintained or strengthened**: 41 suites preserved, +1 new (accountingHardening = 18 regression tests)
- No ticket 090 / AP aging started
- No account codes added to routes/controllers; business logic in services; no silent fallbacks for financial semantics
- No test weakened or deleted
