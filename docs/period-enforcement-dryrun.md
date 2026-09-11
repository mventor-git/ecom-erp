# Period Enforcement Dry-Run — would-block audit + safe-enforcement plan (081)

Verdict first: enforcing today FREEZES the system — 29 leaked CLOSED periods cover now. Do NOT gate before Phase 0–1. No code changed in this ticket.

## Freeze proof (read-only probes, 2026-09-08)
- `financial_periods`: 58 rows, 58/58 named `Jest FP *` (100% test litter, all `opening_balance_set=0` — never received OB, safe to purge with backup).
- 29 CLOSED cover today; 29 OPEN cover today. Any "today ∈ CLOSED ⇒ refuse" gate blocks NOW.
- Leaker: `financialPeriod.test.js` afterAll deletes only the LAST `periodId` (overwrite bug). `journalPosting` + `warehouseOrders` tests clean correctly.
- No backdating anywhere: `createMovement` has no date param; all timestamps CURRENT_TIMESTAMP. Enforcement = block-new-at-now only.

## Would-block map (condensed; full tables in ticket 081)
- Period-aware today (2 spots only): journal `postEntry` gate + `setOpeningBalance` OPEN-check. Everything else ignores periods.
- HIGH/CRITICAL if gated: web+mobile checkout create, COD issue, paid webhook (money taken, stock stuck), worker pick/ship/deliver+POD, admin status+refunds, transition choke, supply/issue orders, PO receive, admin POS sale.
- MED: onbill accept/decline, cancel paths (stranded promises), Kashier session init, refund/void mirroring.
- LOW/exemptible: cart CRUD (non-mutating stock), pricing preview/compute (SELECTs), packaging consumption (doc-only, zero live rows).
- Special cases: transfers must gate as PAIRS (issue leg books COGS — half-allowed shifts reports); `adminSaleService` RAW-inserts movements bypassing `createMovement` (no trash/negative guards) — gate would miss it entirely.

## Cleanup/migration plan (in order — each independently validatable)
- Phase 0 — litter purge (safe now): fix `financialPeriod.test.js` cleanup (delete ALL `Jest FP%`, not last id); one-shot DELETE of the 58 litter rows with backup (all OB-flag 0; verify no `opening_balance` movement references `financial_period:<litter-name>` first).
- Phase 1 — close the bypass: route `adminSaleService` through `createMovement` (keeps FIFO consume + persistConsumption; gains trash/negative/stock guards).
- Phase 2 — choke-point gate: `createMovement` refuses when today ∈ CLOSED (same `closedPeriodContaining` helper family as journals); corrections/counts INCLUDED (blocked) + queue the reopen/controlled-adjustment ticket alongside — a gate without it is a one-way lock.
- Phase 3 — document transitions: shipped/onbill-accept inherit the gate via bridge (no extra code); webhook atomicity already covers paid path.
- Explicitly NOT gated: carts, pricing reads/previews, reports, settings, notifications, non-stock status metadata.

## Recommended enforcement boundary
Gate = `createMovement` + journal post (exists) + order/PO creation timestamps are movement-driven already, so NO separate document gates needed — stock truth and document truth stay in one lock. Reopen/adjust ticket MUST ship with or before Phase 2.
