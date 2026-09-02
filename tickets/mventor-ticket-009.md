# mventor-ticket-009: Google OAuth Customer Login

**Status:** âœ… Completed  
**Priority:** Medium  
**Phase:** 9 â€” Customer Features  
**Implemented:** July 23, 2026  

## Description
Add Google OAuth authentication for customers. Logged-in users get faster checkout (pre-filled email) and order history.

## Tasks
### Backend
- [x] Add `google_id` and `avatar_url` columns to customers table
- [x] Create `server/routes/auth.js` â€” Passport strategy + OAuth routes
- [x] Mount auth routes in server/index.js
- [x] Add `GET /api/orders/mine` endpoint for customer order history
- [x] Add passport deps to package.json

### Frontend
- [x] Create `AuthContext.jsx` â€” auth state management
- [x] Create `LoginPage.jsx` â€” Google Sign In page
- [x] Create `AccountPage.jsx` â€” user profile + order history
- [x] Update `Navbar.jsx` â€” add sign in / user menu
- [x] Update `App.jsx` â€” add routes + AuthProvider
- [x] Update `api/products.js` â€” add auth API functions
- [x] Update `vite.config.js` â€” add /auth proxy

## Acceptance Criteria
- [x] Users can sign in with Google
- [x] Logged-in users see their name/avatar in navbar
- [x] Account page shows order history
- [x] Checkout pre-fills email for logged-in users
- [x] All existing tests pass
