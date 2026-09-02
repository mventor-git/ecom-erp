# mventor-ticket-040 â€” Mobile App Enhancements

**Status:** Completed
**Created:** 2026-08-02
**Priority:** High

## Goal
Add push notifications, Google sign-in, wishlist, and APK build preparation to the customer app.

## Scope

### Backend
- **`routes/mobileWishlist.js`** (new): `GET /api/v1/wishlist`, `GET /api/v1/wishlist/ids`, `POST /api/v1/wishlist/items` {product_id}, `DELETE /api/v1/wishlist/items/:productId` â€” uses the existing `wishlist` table; mounted in `index.js`
- **Google sign-in** `POST /api/v1/auth/customer/google`: verifies `id_token` via Google's tokeninfo endpoint, finds/creates customer by `google_id` (links to existing email account if present), returns JWT + customer
- **Push channel**: `notificationService.js` registers a `push` sender (Expo push API â†’ `device_tokens` of the customer; rejected tokens auto-removed); `notificationChannels.js` default `push: true`

### App (mobile-app)
- **Push notifications**: `expo-notifications` + `expo-device`; token registered after login/session-restore (`POST /api/v1/notifications/register`), unregistered on logout; Notifications screen (list, mark read, mark all read) reachable from Account
- **Wishlist**: `WishlistContext` (optimistic toggle, server-synced); heart on ProductDetail (floating badge + title row); Wishlist tab with remove
- **Google sign-in**: `expo-auth-session` flow (PKCE code exchange â†’ id_token â†’ backend); client ID configurable in `src/config.ts` (`GOOGLE_CLIENT_ID`); button hidden/disabled when unset
- **Fixed bug**: AuthContext read `/auth/customer/me` response as `res.customer` but the API returns `res.data` â€” session restore now works

### APK prep (feeds mventor-ticket-041)
- `app.json`: name "Comfort Sign", slug `comfort-sign-customer`, scheme `comfortsign`, android package `com.comfortsign.customer`, versionCode 1, POST_NOTIFICATIONS permission, expo-notifications plugin, teal splash
- `eas.json`: `preview` profile â†’ APK, `production` â†’ AAB
- Branded icons regenerated (`scripts/generate-icons.mjs` with sharp)
- `eas-cli` installed as devDependency

## Acceptance Criteria
- [x] `tsc --noEmit` clean
- [x] `expo export --platform android` bundles
- [x] Integration suite passes (95/95 â€” includes 9 new wishlist tests)
- [x] `expo config` resolves package/scheme correctly

## Validation
- TypeScript: clean
- Android bundle export: OK
- Integration tests: 95/95 (one pre-existing flaky stock race in api.test.js observed â€” passes on re-run; unrelated to this ticket)

## Known Risks / Follow-ups
- Google sign-in untestable until a real Android OAuth client ID is created (Google Cloud Console) and set in `src/config.ts`
- Push delivery requires the backend notification rules to use channel `push` with the customer user id as recipient
- Expo Go: push works in dev; full reliability needs the standalone APK (mventor-ticket-041)
