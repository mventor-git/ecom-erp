# Handover Note

**Date:** 2026-09-13 (twelfth stop — ticket 092 GL operability; STOP for owner review)
**From:** Mventor (Execution Owner)
**To:** Project Owner / Next Session

## ✅ TICKET 092 — THE LEDGER NOW HAS AN OPERATOR SURFACE (service truth, thin shell)

- **Reality found pre-code:** every accounting capability already existed at service level (075–080) but had **ZERO HTTP exposure** — no journal route, no account route, no statement route ever shipped; 079-era tests are all service-level. So 092 = surfacing, not building a second anything.
- **Shipped:** one new router `/api/admin/accounting/*` + one operator orchestrator `accountingService` that only delegates: Chart of Accounts CRUD (dup/type/refused-delete-when-referenced all enforced by accountService; per-account posted-only ledger), manual journal lifecycle (draft→post→manual-unpost; **source forced NULL** — posted OR stranded bridge journals are machine-owned at every layer; posting inherits ALL existing gates: revalidate, active accounts, integer cents, `Unbalanced`, fail-closed period; unpost now period-locked too), filtered/paginated journal list + detail + audit timeline, **Trial Balance (verbatim ledgerService)**, **journal-only P&L** (order status/product cost are NOT inputs — proven), **truthful Balance Sheet** (normal-side nets, derived earnings + unclassified bucket → `assets+other == liabilities+equity+earnings` arithmetic identity machine-checked; `limitations[]` states plainly: no closing/retained-earnings, no revaluation, coverage = what is booked; inventory physical-vs-ledger is 093, legacy unbooked settlements stay visible only via the 091 control — nothing forced or auto-repaired).
- **RBAC:** `accounts.read/.manage`, `journals.read/.manage`, `ledger.read` (boot-safe seed, super_admin auto-granted; period UI keeps `inventory.*`). **Audit:** manual draft lifecycle + CoA mutations + period close/reopen now emit events with the acting user (bridges unchanged — their posted-event audit already existed); the 4 period-closing suites + integration janitor sweep orphan events → residue 0.
- **UI:** Finance nav → Chart of Accounts · Journals · Statements (TB/P&L/BS tabs, balance banners, server errors verbatim inline); Financial Periods finally has the missing Reopen button; money entry via utils/money cents; zero accounting math in React.
- **Verification (all exit 0):** unit **47/332** live + isolated (new `glOperability.test.js` 21) · integration **107/107** · accounting regression group green before UI · 092 HTTP gate smoke **22/22** on booted throwaway (auth, full 403 matrix, close→post-refused→reopen→post, TB/P&L/BS over HTTP, referenced delete refused, sourced unpost/edit refused, timeline audit chain) · fresh-DB probe: 5 permissions + JE-0001 lifecycle + statements + events · admin build 0 · secret scan clean · residue 0 (incl. orphans).
- ADR-018; CHANGELOG [4.22.0].

## Carried context (detail: CHANGELOG / tickets / .mventor / PROJECT_STATE)

- 091 CLOSED (owner-accepted incl. 4.21.1 gate): canonical `sale-settled` journaling on all real settlement paths, immutable `sale-reversed` refunds, no status can fabricate money anywhere, booked-cancel blocked (LEDGER_BLOCKED), revenue reconciliation control live. **~105k EGP-cents legacy settled_unbooked still needs owner triage** (book-only settle; never auto-backfilled).
- AP complete 086–090 (payment UI, recognition-date AP aging + causal back-dating ADR-016). F1–F13 + N1/N2 hardening live. Fresh boot incl. deleted_at/categories.icon forks verified.
- Patterns: journal UNIQUE seams; nesting-aware `db.transaction`; integer cents; fail-closed period controls; servers-side authority, thin routes; docs = AI memory.

**Warnings:** `ADMIN_PASSWORD` + probe secrets on disk (gitignored) — rotate before tunnel; live DB = `server/data/store.db`; integration tests hit REAL db (non-destructive); do NOT fake GL/AR/AP beyond posted journals; statements never reconcile reality — the 090/091 controls own that.

**Next:** owner review of 092. 093 (inventory↔GL: adjustment/transfer/return journaling + valuation alignment) stays UNAUTHORIZED. STOP.
