# mventor-ticket-039 â€” Customer Android App (Expo)

**Status:** Completed
**Created:** 2026-08-02
**Priority:** High

## Goal
Provide customers with a native Android app that uses the existing `/api/v1` mobile API.

## Scope
- `mobile-app/` â€” Expo (React Native + TypeScript) app, runnable via Expo Go
- JWT auth (register/login/logout, auto token refresh, session restore)
- Product browse: featured, categories, search, pagination, product detail with variants
- Server-side cart (add, update qty, remove, clear)
- Checkout (COD + shipping form) and order history / detail / cancel
- Account profile screen

## Acceptance Criteria
- [x] `npx tsc --noEmit` passes
- [x] `npx expo export --platform android` produces a valid bundle
- [x] All screens wired to `/api/v1` mobile endpoints (auth, products, cart, orders)
- [x] API base URL configurable in one place (`src/config.ts`)

## Implementation Notes
- Tokens stored in `expo-secure-store`; 401 triggers one silent refresh attempt
- Images resolved via `imageUrl()` helper (absolute URLs pass through, relative paths prefixed with `API_BASE_URL`)
- Cart is server-side (`/api/v1/cart`) â€” requires login
- Navigation: native stack (ProductDetail, Checkout, OrderDetail) over bottom tabs (Home, Cart, Orders, Account)

## Validation
- TypeScript: clean
- Expo Android bundle: exported successfully

## Known Risks / Follow-ups
- `API_BASE_URL` must point at the reachable server (LAN IP or ngrok) â€” placeholder is `http://192.168.1.50:5172/api/v1`
- Push notifications, Google sign-in, EAS native build, wishlist â†’ mventor-ticket-040
