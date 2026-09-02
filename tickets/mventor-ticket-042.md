# mventor-ticket-042 — Sync stable copy from on-dev

**Status:** Completed
**Created:** 2026-08-08
**Priority:** Medium
**Classification:** Repository Maintenance

## Goal
Bring the frozen snapshot `D:\Projects\stable\comfort-sign` up to date with the
active working copy `D:\Projects\on-dev\comfort-sign` by copying the 4 files
that are newer/only present in on-dev.

## Scope
- Copy exactly 4 files on-dev → stable:
  1. `profile.md` (v2.0 — 15-section MUSE format)
  2. `.muse` (v2.0 metadata)
  3. `VISION_NEXT.MD` (new — next-era vision)
  4. `docs/PROJECT_STATE.md` (extra "External Tools" section)
- Verify both trees are identical afterwards (no other diffs expected).

## Out of Scope
- Port drift fix (start.bat / beta-test.ps1: 3000 → 5172) — deferred to a
  future ticket; both copies share the same drift.
- git init / DB backup — flagged audit tasks, not part of this ticket.
- Any code changes in either copy.

## Acceptance Criteria
- [ ] All 4 files copied to stable, contents byte-identical to on-dev
- [ ] Diff both directions reports zero newer/missing files
- [ ] CHANGELOG updated with this ticket's entry
- [ ] Stable copy remains a faithful mirror of on-dev

## Implementation Notes
- Verified via robocopy /L both directions: only these 4 files differ.
- Reverse diff (stable → on-dev) is empty: nothing in stable is newer or
  missing from on-dev, so the sync is strictly one-directional.

## Validation Notes
- Re-run robocopy /L both directions after the copy; both must return empty
  file-diff lists (exit code 1 with only directory entries = success).
- Spot-check file sizes match.

## Known Risks
- If future edits are made in only one copy, divergence returns — recommend
  making on-dev the single source of truth and re-syncing stable on demand.

## Related Tickets
- mventor-ticket-041 (APK, Ready — user step)
- Future: port drift fix ticket
