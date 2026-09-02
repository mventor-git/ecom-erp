# mventor-ticket-009 Plan â€” Google OAuth Customer Login (Planned)

**Status:** ðŸ“‹ Planned  
**Priority:** Medium  
**Estimated Size:** Medium (5-8 files changed)  

---

## 1. Overview

Add Google OAuth authentication so customers can **sign up / log in with their Google account**. Logged-in users get:
- Faster checkout (email pre-filled)
- Order history
- Saved addresses (future)

---

## 2. What Needs to Change

### Backend Changes

| File | What to Add |
|------|------------|
| `server/package.json` | Add `passport`, `passport-google-oauth20` |
| `server/db.js` | Add `google_id` column to `customers` table, add `address` column |
| `server/routes/auth.js` | NEW: Google OAuth routes (`/auth/google`, `/auth/google/callback`, `/auth/me`, `/auth/logout`) |
| `server/index.js` | Mount auth routes, initialize Passport session |

### Frontend Changes

| File | What to Add |
|------|------------|
| `client/src/pages/LoginPage.jsx` | NEW: Login page with "Sign in with Google" button |
| `client/src/pages/AccountPage.jsx` | NEW: Account page with order history |
| `client/src/components/Navbar.jsx` | Add user avatar / "Sign In" link |
| `client/src/App.jsx` | Add `/login`, `/account` routes |
| `client/src/api/products.js` | Add `getCurrentUser()`, `getMyOrders()` |
| `client/src/context/AuthContext.jsx` | NEW: Auth context for client-side user state |

---

## 3. Implementation Steps

### Step 1: Google Cloud Setup (manual, one-time)
1. Go to https://console.cloud.google.com
2. Create a new project
3. Enable "Google+ API" (or OAuth consent screen)
4. Create OAuth 2.0 credentials (Web application)
5. Add authorized redirect URI: `http://localhost:3000/auth/google/callback`
6. Copy Client ID and Client Secret

### Step 2: Backend â€” Database
```sql
ALTER TABLE customers ADD COLUMN google_id TEXT UNIQUE;
ALTER TABLE customers ADD COLUMN avatar_url TEXT DEFAULT '';
```

### Step 3: Backend â€” Passport Strategy

```javascript
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: '/auth/google/callback',
}, async (accessToken, refreshToken, profile, done) => {
  // Find or create customer by google_id
  let customer = db.prepare('SELECT * FROM customers WHERE google_id = ?').get(profile.id);
  
  if (!customer) {
    // Create new customer
    const result = db.prepare(
      'INSERT INTO customers (email, name, google_id, avatar_url) VALUES (?, ?, ?, ?)'
    ).run(profile.emails[0].value, profile.displayName, profile.id, profile.photos?.[0]?.value || '');
    
    customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(result.lastInsertRowid);
  }
  
  return done(null, customer);
}));

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => {
  const user = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
  done(null, user);
});
```

### Step 4: Backend â€” Auth Routes

```javascript
// GET /auth/google â€” Start Google OAuth
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// GET /auth/google/callback â€” Google OAuth callback
router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => res.redirect(process.env.CLIENT_URL)
);

// GET /auth/me â€” Get current logged-in user
router.get('/me', (req, res) => {
  res.json(req.isAuthenticated() ? req.user : null);
});

// POST /auth/logout â€” Log out
router.post('/logout', (req, res) => {
  req.logout(() => res.json({ success: true }));
});
```

### Step 5: Frontend â€” AuthContext

```jsx
const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in on mount
    axios.get('/auth/me')
      .then(res => setUser(res.data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = () => { window.location.href = '/auth/google'; };
  const logout = async () => {
    await axios.post('/auth/logout');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
```

### Step 6: Frontend â€” LoginPage

A simple page with:
- "Sign in with Google" button
- Explanation of benefits (faster checkout, order history)
- Redirect to previous page after login

### Step 7: Frontend â€” AccountPage

Shows:
- User name, email, avatar
- Order history table (fetch from `GET /api/orders/mine`)
- Logout button

### Step 8: Navbar Update

- If logged in: show user avatar + dropdown (Account, Orders, Logout)
- If not logged in: show "Sign In" button

---

## 4. New API Endpoints

| Method | Route | Purpose | Auth |
|--------|-------|---------|------|
| GET | `/auth/google` | Start OAuth flow | None |
| GET | `/auth/google/callback` | OAuth callback | None |
| GET | `/auth/me` | Get current user | Session |
| POST | `/auth/logout` | Log out | Session |
| GET | `/api/orders/mine` | Get user's orders | Session |

---

## 5. Environment Variables to Add

```
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
```

---

## 6. Security Considerations

- âœ… Google handles password storage â€” we never see passwords
- âœ… Session-based auth (same pattern as admin)
- âœ… Google_id is unique â€” no account duplication
- âœ… OAuth state parameter prevents CSRF (Passport handles this)
- âš ï¸ Need HTTPS in production (Cloudflare Tunnel provides this)

---

## 7. Files Changed

```
Modified:
  server/package.json          (+2 deps)
  server/index.js              (+passport init)
  server/db.js                 (+columns)
  client/src/App.jsx           (+routes)
  client/src/components/Navbar.jsx  (+auth UI)

New:
  server/routes/auth.js        (Google OAuth routes)
  client/src/pages/LoginPage.jsx
  client/src/pages/AccountPage.jsx
  client/src/context/AuthContext.jsx

Total: ~8 files, ~300 lines of code
```

---

## 8. Estimated Effort

| Part | Time |
|------|------|
| Google Cloud setup | 10 min (manual) |
| Backend: DB + Passport | 30 min |
| Backend: Auth routes | 20 min |
| Frontend: AuthContext | 20 min |
| Frontend: LoginPage | 15 min |
| Frontend: AccountPage | 20 min |
| Frontend: Navbar update | 15 min |
| Testing | 20 min |
| **Total** | **~2.5 hours** |

---

*Ready to implement when you give the go-ahead.*
