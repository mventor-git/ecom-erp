# Review Report — latest full pass (post-091)

**Date:** 2026-09-13 · **Scope:** accounting + sales-settlement domain (074→091 chain), repo health · **Reviewer:** Mventor

## Architecture — PASS
- One posting machine (`journalService`/createEntry→postEntry), one chart home (`accountChart`), three thin bridges (purchase 087, supplier-payment 088, sales 086→091). Account codes exist ONLY in services; routes/UI hold zero accounting semantics (091 proved the boundary: settle/refund routes are arg+response shells).
- ADRs 013–017 coherently applied: derived truth (no counters), posted-journal authority, recognition-date + causal as-of aging, immutable corrections via reversals, settlement-must-be-booked.
- Dependency direction clean; no cycles introduced (services lazily require across bridges); nesting SAVEPOINT transactions cover multi-service mutations.

## Security — PASS
- Money routes RBAC-gated server-side (`orders.manage` for settle/refund, `reports.read` recon, `orders.update` lifecycle-only); slider cannot book money; worker endpoints staff-JWT. Provider webhook: HMAC + amount/currency match, unsigned rejected (smoke). CSRF+session intact. No secrets in diff; validation fails closed (period gate, evidence, integer cents, reference rules).

## Performance — PASS
- Reconciliation = 3 bounded queries + JS compare (per-order maps, no N+1); settlement adds one journal write per mutation; refund/reversal O(lines). No caches introduced.

## Regression — PASS
- Full matrix green twice (46/307 exit 0 live+isolated; 107/107 integration; smoke 17/17; fresh-DB probe). Pre-existing mobileCart flake isolated via stashed A/B and documented. Behavior changes are intentional-policy (documented in ADR-017 + KNOWN_ISSUES), none silent: slider paid/refunded, webhook 500-retry semantics, worker 409 on closed-period delivery.

## Documentation — PASS
- CHANGELOG 4.21.0, ADR-017, PROJECT_STATE/HANDOVER/BACKLOG/KNOWN_ISSUES/TECHNICAL_DEBT synced; fresh-DB fork class fixed + noted.

## Dependencies — PASS
- Zero new packages (both server and client) in 091.

**Follow-ups (owner-gated):** triage live ~105,000-cents `settled_unbooked` list; 092 GL operability; 093 inventory↔GL + returns/RMA; worker-app SETTLEMENT_BLOCKED messaging.
