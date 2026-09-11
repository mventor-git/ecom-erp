# Handover Note

**Date:** 2026-09-12 (third stop of session — 089 owner-verified)
**From:** Mventor (Execution Owner)
**To:** Project Owner / Next Session

## ⏸️ CHECKPOINT — mventor-ticket-089 COMPLETED + OWNER BROWSER PASS PASSED

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
