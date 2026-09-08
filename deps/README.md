# deps/ — External reference material (read-only prior art, never dependencies)

## What lives here
- `smartaccounting/` — reference clone of https://github.com/ahmedboney/SmartAccounting
  at upstream commit `e0ae8a4` (cloned 2026-09-07). Used ONLY for accounting
  DOMAIN semantics (journal model, invariants, report meanings) — see
  `docs/accounting-gap-map.md` (074) for the harvest log.

## Hard rules
- NEVER import, require, or execute anything under `deps/` from ECOM-ERP code.
- NEVER copy its Flask/app.py/database.py structure, SQLite usage, REAL-money
  arithmetic, credentials, or seeds into this project.
- NEVER edit the reference copy (re-clone on pin change instead).
- Upstream-local notes/launchers (Arabic `.txt`/`.bat`/`.vbs`) and nested `.git`
  were stripped on import — reference value is code + tests only.

## Other deps
- Node packages stay in place (`node_modules/`, gitignored) — never moved here.
- `mobile-app/` + `worker-app/` are separate nested repos (gitignored) — not deps.
