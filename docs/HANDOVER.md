# Handover Note

**Date:** 2026-09-12 (fifth stop — pre-090 readiness checkpoint + N1/N2)
**From:** Mventor (Execution Owner)
**To:** Project Owner / Next Session

## ✅ READINESS CHECKPOINT (pre-090): unit exit now honest 0; F11 data SAFE; 090 = BLOCKED on N1/N2

- **CHECK 1 F11:** live-DB data audit — every mirror family agrees on materialized rows (`qty=quantity`, `base_price=final_price=price` on all 67 rows; `price_list_code` never empty; `cost_snapshot`=0 only for never-issued/cancelled/fixture rows; 0 real orders missing rows) → **SAFE, no backfill**.
- **CHECK 2:** `npm test` = 42/42, 235/235, **process exit 0** (root-fixed: `server.closeAllConnections()` in 4 suites; 2 library `console.log` banners deleted from `db.js`; signature fixture idempotent). `npm run test:isolated` exit 0. `test:integration` exit 0 (107/107).
- **CHECK 3:** 086→089 accounting invariants re-verified on code: sourced journals immutable, no AP counter anywhere, outstanding derived from posted journals, idem_fp + ux + partial UNIQUE, fail-closed period controls both sides, integer cents + calendar dates + strict methods.
- **CHECK 4 NEW — 090 BLOCKED:** N1 `services/idempotencyService.js` (in-memory, no actor/request fingerprint → movements replay collision); N2 `POST /api/orders` `idempotency_key` unscoped lookup (PII cross-read + silent order drop). Details + recommended fixes in `docs/accounting-stabilization-findings.md` ADDENDUM + CHANGELOG [4.18.1].
- **State on `master`:** `0f57522` (F1-F13) pushed; checkpoint commit follows this note.

---

## 🔬 FORENSIC STABILIZATION F1–F13 (086–089) COMPLETED (fourth stop) — ALL VERIFICATION GREEN

Owner directive: review/fix integrity **before** AP aging (090). **No 090 code written.**

Findings: `docs/accounting-stabilization-findings.md` (13 confirmed, fixed):
- **F1** Payment posting replay treats a stranded DRAFT as already posted (both bridges); status=posted gates replay, retry posts stranded draft
- **F2** `Math.round` silently truncates fractional cents at 6 boundaries; `assertIntegerCents` now rejects them
- **F3** regex accepts impossible dates `2026-02-31`; calendar-validated + UTC-default documented
- **F4** reversal reason enforced only in the 089 React panel; `reversePayment` now requires non-blank+≤300 server-side
- **F5** same idempotency key + different request silently replays the first payment; request `idem_fp` fingerprint column, key-reuse+different-request → 409 `idempotency-conflict`
- **F6** `unpostEntry` silently converts a posted sourced journal back to draft; refused when `source_type` present (manual 079 cycle unchanged)
- **F7** period-lookup failure = allowed both journal gate + 084 movement twin; now **fail closed**
- **F8** unknown/stored method `||'1000'` fallback; absent → throw "no chart mapping"
- **F9** AP authority pre-txn only; validateApplications runs pre-txn (UX) + post-txn (authority under write lock)
- **F10** `findPosted*` functions named posted but query any status; renamed honestly
- **F11** fresh-DB `order_items` CREATE lacks the mirror cols 4 writers insert; db.js reconciles + indexes; fresh-DB probe passes full schema (`npm run test:isolated` twice proves)
- **F12** tests mutate/leak live store.db: purchaseOrder self-cleans products; mobile+api fixtures pick in-stock product/warehouse state so ambient litter can't cascade; `run-isolated-tests.js` + `ECOM_DB_PATH` snapshot runs → **7-fail→107/107 PASS, exit 0**
- **F13** docs lag at 4d2420d (baseline stale, "not committed")

**Verification:** 42/42 unit suites 235/235 tests; integration 107/107 exit 0 (was 7 failed + exit 1); HTTP smoke 14/14 (replay/409/integer/date/immutability/fail-closed/reason/orphan); admin build 25.26s; secret scan clean.

---

**State:** 41 / 218 PASS + admin build 11.20s + **owner browser pass 2026-09-12: ALL STEPS PASSED** (panel 50.00 derivation, partial 20, settle 30, reverse with reason/restore/immutable history, overpayment inline "applying X but only Y outstanding"). Remote `origin/master` = `42c300d` (079–088); the validated 089 diff is NOT yet committed (awaiting owner checkpoint go, same as before). Backend :5172 currently stopped after smoke-fixture purge (residue 0) — relaunch with `start.ps1`. STOP — AP aging NOT started.

**089 added:** `PurchaseOrdersList.jsx` detail modal → payables panel (server-derived Receipt-value/Paid/Outstanding, this-PO payments list, `StatusBadge` recorded/reversed) + record-payment dialog (EGP→cents `utils/money`, idempotency key stable per edit, server "Overpayment…" verbatim inline) + reverse dialog (required reason, RejectDialog mirror). adminApi 4 fns; `GET /api/admin/supplier-payments?purchase_order_id=` (+`applied_amount`) via `listPayments({poId})` join; test 10/10. No route/sidebar/permission-gating infra churn (house style: 403 surfaces inline). **Owner: browser-pass steps in ticket-089.**

---

**Previous checkpoint (mventor-ticket-088 completed, same day) — supplier payment postings:**

**⏸️ (Historical) 088 State at stop:** 41/217 + admin clean + route smoke ALL PASS (residue 0). STOP — next ticket NOT started.

**What shipped (088 — AP relief; owner rules honored):**
- Payments are their own persisted transactions: `supplier_payments` (PAY-YYYY-NNNN) + `supplier_payment_applications` (supplier → PO → amount).
- `supplierPaymentService.recordPayment`: full/partial, multi-PO, sum(apps) == amount enforced, per-PO overpayment rejected, foreign-supplier PO rejected. Posts once: `Dr 2100 AP / Cr 1000 Cash` via `accountChart.resolveAccount` — **no account codes anywhere outside services**. `recordPayment`+`reversePayment` are the only writers; route = thin.
- Atomic (one `db.transaction`, nesting-aware SAVEPOINT) — posting failure test verifies rollback leaves payment, applications and journal untouched.
- Replay-safe: caller `idempotency_key` UNIQUE + `ux_journal_source` backstop; tested — replay returns existing payment, never double-posts.
- Immutable corrections: `reversePayment` posts the opposite entry (source `payment-recorded`/`payment-reversed`), original + applications stay as history.
- Outstanding AP **derived from posted journals** (ADR-014: receipt postings from 087 = payable; recorded payments reduce; reversal auto-restores). No counter drift.
- ADR-015 appended; fresh-start wipe order + `supplier_payments.read|manage` permissions + PAY sequence seeded.

**NEXT TASK (superseded by the 089 stop above — historical):**
- ~~Supplier payment UI (record/reverse on PO detail)~~ ✅ 089. Then AP aging report. Bank/transfer methods + advances/prepayments deferred — `METHOD_ACCOUNTS` ready.

**Previous (087 etc., unchanged):** 2026-09-07 purchase receipt posting; shared `accountChart`; 053–056 PO UI, Reports, Financial Periods, Fulfillment consolidation.

**Warnings:** `ADMIN_PASSWORD` + probe secrets still on disk (gitignored) — rotate before tunnel; live DB = `server/data/store.db`, FK ON, integration tests hit REAL db (non-destructive); mobile/worker LAN-IP + eas quirks deferred; do NOT fake GL/AR/AP beyond posted journals; supplier advances out of scope.

**Notes:** patterns preserved: journal UNIQUE seams, nesting-aware `db.transaction`, best-effort `console.error` logging. Docs may lag on non-core areas.
