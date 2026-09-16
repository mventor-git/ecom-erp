# Handover Note

**Date:** 2026-09-16 (096 delivered — product-completion mission at STOP)
**From:** Mventor (Execution Owner)
**To:** Project Owner / Next Session

## CURRENT STATE
- HEAD = 096 commit (pending push at write time). 091 CLOSED · 092 GL · 094 setup · 095 onboarding · 093 inv↔GL · **096 journey 46/46 + FIRST_RUN docs (4.26.0)**.
- Matrix: unit 51/368 exit 0 live+isolated, integration 107/107 (one flaky 2-fail, green x2 retry), admin+storefront builds 0, residue 0, secret scan clean.

## WHAT'S LEFT
- Nothing in the mission. Owner triage only: ~105k legacy settled_unbooked (book or leave); next features need owner direction (invoices/terms, bank, VAT, mobile LAN, Paymob).

## STANDING RULES (proven, do not regress)
- One journal/CoA/ledger; posted sourced journals immutable, corrections = new reversal; booked money moves only through the reversal seam; no status-only money; closed periods fail closed; integer cents; backend-authoritative RBAC; import = preview + all-or-nothing; stock never changes via product import; 090 + 091 + 093 reconciliation controls preserved; fresh boot equals existing boot (probes in npm test); docs sync every milestone; one commit per milestone.

**Warnings:** ADMIN_PASSWORD + probe env secrets live in server/.env (gitignored) — rotate before any tunnel; live DB is server/data/store.db (npm test touches live by design, isolated uses a copy); do NOT auto-"fix" product-orphan events or legacy drift with destructive writes.
