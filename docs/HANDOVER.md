# Handover Note

**Date:** 2026-09-14 (autonomous product-completion mission — milestones A+B delivered; C+D in flight)
**From:** Mventor (Execution Owner)
**To:** Project Owner / Next Session

## CURRENT STATE
- origin/master == `fd68555`. 091 CLOSED (accepted) · 092 GL operability · **094 fresh-install integrity + first-run setup** (systemic 51-column ADD-COLUMN-BEFORE-CREATE fork class fixed root-first; fake-data seed retired; wizard + derived setup status; WelcomePage escape; ADMIN_EMAIL/customer_site_url boot gaps closed) · **095 master-data onboarding** (preview→validate→dedupe→ALL-OR-NOTHING commit for products/suppliers/customers/warehouses at /setup/import + manual Add-customer; legacy import printer side-effect removed; 094 probe relocated+tracked).
- Matrix at fd68555: unit 49/353 exit 0 live+isolated (incl 094 probe suite 10, 095 11), integration 107/107, admin+storefront builds 0, residue 0 (76 pre-existing product-orphan events are immutable audit history — left intact deliberately), secret scan clean.

## MISSION REMAINING (in order)
1. ~~**093 inventory<->GL integrity**~~ \u2014 DELIVERED 4.25.0 (one-door inventoryPosting bridge, reconciliation control + catch-up posting, canonical atomic counter sales; ticket 093). Next: 096 acceptance (item below).
1. **096 acceptance + docs (IN FLIGHT):** scripted end-to-end BUSINESS JOURNEY on a real DB via real services/HTTP (setup wizard data → imports → supplier+PO+receive → sell+settle → payment → statements → both reconciliations → adjust → audit), fresh-install acceptance run, rewrite SETUP.md/operator docs (first launch, data onboarding, supported flows, limitations, backup/recovery), i18n check for new pages.
3. Full matrix + docs commit + FINAL PRODUCT READINESS REPORT at the STOP condition (A–O checklist in the mission brief).

## STANDING RULES (proven, do not regress)
- One journal/CoA/ledger; posted sourced journals immutable, corrections = new reversal; booked money moves only through the reversal seam (LEDGER_BLOCKED); no status-only money; closed periods fail closed everywhere incl. worker 409; integer cents NO truncation; backend-authoritative RBAC (5 GL perms + customers.manage now); import = preview + all-or-nothing; stock never changes via product import/update; 090 + 091 reconciliation controls preserved; the ~105k legacy settled-unbooked population stays VISIBLE (owner triage, book-only settle path exists); fresh boot must equal existing boot (probe in npm test); docs sync every milestone; one commit per milestone.

**Warnings:** ADMIN_PASSWORD + probe env secrets live in server/.env (gitignored) — rotate before any tunnel; live DB is server/data/store.db (tests self-clean; npm test touches live by design, isolated uses a copy); do NOT auto-"fix" product-orphan events or legacy drift with destructive writes.
