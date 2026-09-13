# Handover Note

**Date:** 2026-09-13 (eleventh stop — POST-091 verification gate: two status-only money holes found + closed)
**From:** Mventor (Execution Owner)
**To:** Project Owner / Next Session

## ✅ POST-091 GATE — VERDICT: 091 COMPLETE (with two gate fixes shipped in 4.21.1)

- **Read-only forensic pass over the settlement matrix found TWO status-only money paths 091 had left open (both reproduced at file level, then fixed + re-probed):**
  1. **Worker `PUT .../status` accepted `paid`/`refunded` bodies** (legacy `pending→paid` / `paid→refunded` are valid transitions; the worker route only special-cased `delivered`). Fix: the SAME `SETTLEMENT_REQUIRED` / `REFUND_REQUIRED` intent guards 091 added to the admin route now block money intents on the worker route too. Re-run of the exploit: 200→**400** for both; file stays `pending`, journals 0.
  2. **EVERY route into `cancelled` skipped the ledger** — an order with a posted sale (kashier/settled) could be "cancelled" by admin/worker, VIP decline, or a provider `trans-void`, abandoning posted revenue with no reversal. Fix (ledger authority at the choke point): `transitionOrder` now THROWS `LEDGER_BLOCKED` when entering `cancelled` if `salesPosting.hasPostedSale()` (covers all callers); mobile-customer cancel + on-bill decline pre-check the predicate (400 `REFUND_REQUIRED`/`LEDGER_BLOCKED`); `trans-void` on a booked order marks the session VOIDED but never cancels posted revenue (loud admin-handling warning). A booked order can now ONLY be corrected by the reversal seam.
- Guarded the payment-state-machine doc against its own stale design sketch (partial-refund states that were never built).
- **Re-verified the full matrix after the fixes:** new suite 33/33 (+4 gate-closure tests); unit `npm test` 46/46 **311/311 exit 0** (live) + isolated 311/311 exit 0; integration 107/107 exit 0; accounting group 13 suites/134 exit 0; focused HTTP gate-smoke 10/10 (real settle→refund→replay→booked-cancel-refused→worker-refused→recon identity over booted copy); fresh-DB brand-new-file probe (settle→cancel-REFUSED→reversal→recon) OK; exploits return 4xx and persist nothing; live residue 0.
- **Invariant now holds on all paths:** operational settlement on every supported path (P1 Kashier, P2 worker COD, P3 evidence-backed manual/admin) is exactly one posted journal; refunds are immutable reversals; money states cannot be fabricated by status anymore on any route; booked orders cannot be cancelled outside the reversal seam. Reconciliation still shows the ~105,000 EGP-cent legacy slider-'paid'-without-journal population as `settled_unbooked` (surfaced, healable via book-only settle — NOT auto-backfilled, awaiting owner triage).

**Deliberate out-of-scope remains:** RMA/physical-goods-return journals, partial refunds (refused, not faked), VIP on-bill AR recognition (no AR model — 092/093 dependency).

**Full 091 build detail: see the tenth-stop section below + CHANGELOG [4.21.0]/[4.21.1] + ADR-017(+ADDENDUM).**

---

**Date:** 2026-09-13 (tenth stop — ticket 091 sales settlement journaling + refund reversal; STOP for owner review)
**From:** Mventor (Execution Owner)
**To:** Project Owner / Next Session

## ✅ TICKET 091 — REVENUE-SIDE ACCOUNTING IS CANONICAL ON EVERY REAL PATH

- **Settlement matrix (code truth):** P1 Kashier webhook (only journalled path before, best-effort post-commit) · P2 worker COD delivered/proof (stamped paid, journaled NOTHING) · P3 admin slider → paid (zero evidence, zero journal) · P4 VIP on-bill (approval-only + deferred) · P5 shipping-sync / P6 counter-sale / P7 Stripe-dead (non-settlement) · refunds: 3 paths, all status-only.
- **Shipped:** all three REAL settlement paths (P1/P2/P3) now post the canonical `Dr 1000 / Cr 4000 (+ Dr 5000 / Cr 1300 from cost snapshots)` journal via `salesPosting` `sale-settled` — ONE journal per order across channels (checked + `ux_journal_source`), INSIDE the mutation transaction. Manual paid = policy B: `POST /orders/:id/settle` (method + reference where traceable + mandatory reason, `orders.manage`), slider `→paid` refused `SETTLEMENT_REQUIRED`. Worker COD journals at delivery via `salesSettlementService.settleCodOnDelivery` (route holds no accounting). Refunds (admin endpoint + provider webhook) route through `refundOrder` → immutable `sale-reversed` mirror of cash/revenue legs only — goods returns explicitly not conflated, never invents restock; reversal ≤1/order; unposted sale → honest no-op; partial refunds REFUSED (`PARTIAL_REFUND_UNSUPPORTED`) — domain has no partial truth, documented for RMA slice.
- **Failure recovery:** webhook handler failure now rolls back the WHOLE mutation and the route CLEARS the event claim → provider redelivery truly retries (paid-without-journal structurally impossible; reverse too). Closed period fails closed on both directions and both endpoints (409 SETTLEMENT_BLOCKED on worker; webhook 500+redeliver). Stuck-provider-order escape hatch after reopen: manual settle with evidence.
- **Reconciliation control:** `GET /api/admin/revenue-reconciliation` + `/erp/revenue-reconciliation` page — operational settled vs POSTED nets per order; five difference classes (settled_unbooked, booked_unsettled, amount_mismatch, refunded_unreversed, reversed_not_refunded); never forces equality; every row carries order id/source; book-only settle heals legacy slider-'paid'. **Live DB currently shows ~105,000 EGP-cents of pre-091 slider-'paid'-without-journal — surfaced, classed, healable; owner decision how to process.**
- **Verification:** unit 46/307 exit 0 (live) + isolated 307 exit 0; integration 107/107 exit 0 (two transient mobileCart 400s proven PRE-EXISTING via stashed-baseline A/B, pass every clean run); HTTP smoke 17/17 (booted throwaway copy); fresh-DB probe OK — unblocked by fixing a pre-existing fresh-boot fork: `products.deleted_at` ALTER-before-CREATE (all movements crashed on brand-new DBs; CREATE now holds the column + idempotent probe, categories.icon precedent); admin build 0; secret scan clean; zero jest091 residue.
- ADR-017 records policy B + reversal + reconciliation semantics. CHANGELOG [4.21.0].

**Deliberately NOT in 091:** VIP on-bill AR recognition (no AR model — 092/093-track dependency; its later cash collection flows through settle), supplier invoices/payment terms, tax/VAT, bank accounts, statements, counter-sale register, goods-return journals.

## Carried context (full detail: CHANGELOG, tickets, .mventor)

- AP complete: 086–090 incl. 089 payment UI, 090 AP Aging + 090 hardening causal back-dated-payment invariant (ADR-016 + ADDENDUM). F1–F13 stabilization + N1/N2 durable idempotency live.
- Baseline pattern: unit 46 suites incl. accounting + 091, integration 107, `ECOM_DB_PATH` + `run-isolated-tests.js` CI-safe; journal UNIQUE seams; nesting-aware `db.transaction`; money = integer cents; period gates fail closed.

**Warnings:** `ADMIN_PASSWORD` + probe secrets on disk (gitignored) — rotate before tunnel; live DB = `server/data/store.db`; integration tests hit REAL db (non-destructive); do NOT fake GL/AR/AP beyond posted journals; `npm test` runs 2 mobileApi suites in parallel against one server — mobileCart may flake on product-selection ordering (pre-existing, tracked in KNOWN_ISSUES).

**Next:** owner review of 091 (esp. policy B + reconciliation-heal of legacy slider-'paid' + the 105,000-cents live list). 092 (GL operability/CoA/journal UI/statements) and 093 (inventory↔GL/valuation+returns) stay UNAUTHORIZED until then. STOP.
