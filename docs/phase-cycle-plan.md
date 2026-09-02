PHASE CYCLE (designed from read code — no guess on unverified):
PHASE A — Design-system / Route tokens: shared CSS tokens + App.jsx route config + verify 3 URLs (/erp/customers/1, /vip-invitations, /dashboard)
TEST A: verify token CSS loads; verify routes render; verify zero emoji/icons correct; verify dark mode surfaces (#1c1917, #302b28)
PHASE B — Shared components / ProfileCard: create shared/ProfileCard.jsx; refactor CustomerProfile.jsx to use it; add aria-labels; keyboard nav
TEST B: render ProfileCard with props (name, avatar_url, vip_badge, tabs); verify theme colors; verify photo loads; verify export button; verify dark mode
PHASE C — VIP → Policy linkage + Recommendation advisory UI: link invite-to-policy; create /pricing/recommendations admin page (lazy route) with advisory forecast labels; verify recommendation endpoint returns advisory only
TEST C: create invite → verify DB row; verify policy updated; verify recommendation endpoint (advisory:true, forecast labels); verify no automatic mutation
PHASE D — Security / Performance: tighten CSP + headers; bundle split; Suspense group; session regenerate
TEST D: curl headers (CSP, X-Frame-Options, HSTS); verify session cookie httpOnly/secure; verify bundle split; verify rate limits active
PHASE E — Audit / Final verification: update docs (log, audit, todo); confirm zero destructive mutation (orders/inventory/cost unchanged); confirm all 3 URLs load; close
TEST E: run full regression (3 URLs + DB check + theme + icons + docs); confirm no emoji; confirm theme tokens used; confirm all routes safe

Note: No existing test framework found (no jest/vitest/mocha files, no test scripts in package.json). Must create vitest + directories.

