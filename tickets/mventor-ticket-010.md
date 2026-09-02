# mventor-ticket-010: Switch to ngrok (zero-cost HTTPS)

**Status:** âœ… Completed  
**Priority:** High  
**Phase:** 8 â€” Deployment  

## Description
Replace Cloudflare Tunnel with ngrok for exposing the local backend to the internet. Cloudflare requires a domain + Cloudflare account (may need credit card verification). ngrok free tier requires **no credit card, no budget** â€” just download and run.

## Motivation
- User has zero budget / no credit card
- ngrok free tier: no registration required, no CC
- Simpler setup: `ngrok http 3000` â€” instant URL
- Works out of the box with existing backend

## Tasks
### Scripts
- [x] Replace `start.bat tunnel` â€” use `ngrok http 3000` instead of `cloudflared tunnel run`
- [x] Update `start.bat prod` â€” use ngrok instead of cloudflared
- [x] Update help text and dev mode tips

### Documentation
- [x] Rewrite `docs/SETUP.md` â€” ngrok-based deployment guide (no CC, no account, no domain)
- [x] Update `docs/PROJECT_STATE.md` â€” ngrok instead of Cloudflare
- [x] Update `docs/HANDOVER.md` â€” mventor-ticket-010 section
- [x] Update `docs/BACKLOG.md` â€” add mventor-ticket-010
- [x] Update `docs/CHANGELOG.md` â€” v1.8.0
- [x] Update `docs/REVIEW_REPORT.md` â€” mventor-ticket-010 review
- [x] Update `docs/DECISIONS.md` â€” ADR-003 and ADR-014 superseded by ngrok
- [x] Update `README.md` â€” remove Cloudflare references, highlight ngrok

### Cleanup
- [x] Remove `cloudflared/` directory (no longer needed)

## Acceptance Criteria
- [x] `start.bat` has ngrok tunnel mode (all 5 modes updated)
- [x] `docs/SETUP.md` describes ngrok setup (no CC, no budget, no account)
- [x] All existing endpoints continue to work (no server code changed)
- [x] 49/49 tests pass â€” âœ… (28 unit + 21 integration)
- [x] Frontend builds cleanly
