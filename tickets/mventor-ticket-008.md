# mventor-ticket-008: Custom Domain & Cloudflare Tunnel

**Status:** âœ… Completed  
**Priority:** Low  
**Phase:** 8 â€” Deployment  

## Description
Set up a permanent custom domain with Cloudflare Tunnel. Create configuration templates, update startup scripts, and provide step-by-step setup documentation.

## Tasks
### Infrastructure
- [x] Create `cloudflared/config.yml` â€” tunnel configuration template
- [x] Create `cloudflared/` directory with config

### Scripts
- [x] Update `start.bat` â€” multi-mode (dev/prod/tunnel/setup/help)
- [x] Add `SITE_URL` env var to `.env`

### Documentation
- [x] Create `docs/SETUP.md` â€” complete step-by-step guide
- [x] Includes: domain purchase, Cloudflare nameservers, tunnel setup, DNS records

## Acceptance Criteria
- [x] cloudflared config.yml template ready for custom domain
- [x] start.bat supports dev mode, production mode, tunnel mode (5 modes total)
- [x] docs/SETUP.md has complete step-by-step domain setup guide (12 steps)
- [x] All existing endpoints continue to work (49/49 tests pass)

## Files Changed
- **New:** `cloudflared/config.yml` â€” tunnel ingress configuration template
- **New:** `docs/SETUP.md` â€” complete deployment guide (12 steps + troubleshooting)
- **Modified:** `start.bat` â€” completely rewritten with 5 operation modes
- **Modified:** `server/.env` â€” added `SITE_URL` commented section

## Verification
- 49/49 tests pass (28 unit + 21 integration)
- Frontend builds cleanly
- 0 vulnerabilities
