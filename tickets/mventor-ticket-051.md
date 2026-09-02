# mventor-ticket-051 — Elevated Control Dashboard + Fresh Reset Support

## Status
Completed (2026-08-23)

## Goal
Replace start.bat popups with a silent, elevated, interactive CLI dashboard: Start All / Stop All /
Restart All / Status / Open Logs — no terminal windows; services run hidden in the background.

## Changes
- `start.bat` rewritten: self-elevates (net session → PowerShell RunAs); menu loop;
  launches backend/node, client/vite, admin/vite HIDDEN via Start-Process -WindowStyle Hidden
  with stdout/stderr redirected to logs\*.log; stop/restart kill by port owner PID
  (5172/5173/5174) — reliable termination under elevation; status shows RUNNING(PID)/off per service.
- `db.js`: demo-review seeder now requires a non-empty products table (and skips missing product
  ids per-row) — fixes boot crash `FOREIGN KEY constraint failed` after a fresh catalog reset.

## Validation
- Silent launch technique verified live: backend boots in ~1s on the fresh DB, port listens,
  logs written, killed cleanly by port.
- Full suite green earlier this session (16 suites / 118 tests).
- Owner performed full data reset (backup: server/data/backups/store-PRE-RESET-20260823-153037.db).
