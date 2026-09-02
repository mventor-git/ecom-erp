# mventor-ticket-043 — Fix Port Drift (3000 → 5172)

**Status:** Completed
**Created:** 2026-08-08
**Priority:** High
**Classification:** Infrastructure Fix

## Goal
The backend actually listens on **5172** (`server/.env` → `PORT=5172`,
`server/index.js` default `5172`), but operational scripts and documentation
still reference **3000**. Fix all stale references so scripts tunnel to the
real port and docs match reality.

## Scope
- `start.bat` — 9 references (dev/prod/tunnel modes, help)
- `beta-test.ps1` — 10 references (`Invoke-RestMethod` base URLs)
- `README.md` — 6 references (run instructions, curl examples)
- `docs/SETUP.md` — 10 references (diagram, ngrok commands, troubleshooting)
- `.mventor` — 1 reference (port in architecture block)

## Out of Scope (explicitly NOT touched)
- `VISION.MD` — CODEX-authored blueprint; conceptual Cloudflare diagram kept
  as-is (flagged in Known Risks)
- `server/_test_profile.js`, `server/_full_api_test.js` — ad-hoc scratch scripts,
  superseded by the Jest suite (PORT 3099 via jest.setup.js); flagged for cleanup
- `profile.md` — MUSE-owned; MUSE must update its port references separately
- Any backend/frontend/mobile code

## Acceptance Criteria
- [ ] Zero `3000` references remain in start.bat, beta-test.ps1, README.md, SETUP.md
- [ ] `.mventor` architecture block shows port 5172
- [ ] Fixed files mirrored to `D:\Projects\stable\comfort-sign`
- [ ] CHANGELOG + HANDOVER updated in both copies
- [ ] No backend/mobile source files modified

## Validation Notes
- `rg -n "3000"` on each fixed file → no matches
- Remaining `3000` occurrences in repo (VISION.MD diagram, scratch `_*.js`) are
  documented as intentionally untouched
- Runtime verification requires starting the backend (blocking) — deferred to
  the user; static verification is authoritative for this ticket
- Test suites run for this ticket: **105/105 unit + 107/107 integration** ✅
- `server/data/` + `*.db` intentionally NOT synced to stable: they are runtime
  artifacts (excluded by `.gitignore`) and were modified by running the test
  suites (generated documents, sessions, worker-proof, DB writes) — not part of
  the source mirror

## Known Risks
- If any process still tunnels to 3000 (e.g., ngrok running manually), it will
  return 502 — users must use `start.bat tunnel` after this fix
- VISION.MD diagram remains stale (cosmetic, conceptual)

## Related Tickets
- mventor-ticket-042 (stable sync — this fix is mirrored the same way)
- mventor-ticket-041 (APK — mobile apps already use `:5172`, unaffected)
