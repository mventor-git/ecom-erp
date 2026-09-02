const express = require('express');
const router = express.Router();
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const db = require('../db');

// --------------- Passport Configuration ---------------

const isGoogleConfigured = () => {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
};

if (isGoogleConfigured()) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: '/auth/google/callback',
  }, (accessToken, refreshToken, profile, done) => {
    try {
      // Find or create customer by google_id
      let customer = db.prepare('SELECT * FROM customers WHERE google_id = ?').get(profile.id);

      if (!customer) {
        // Create new customer from Google profile
        const email = profile.emails?.[0]?.value || '';
        const name = profile.displayName || '';
        const avatar = profile.photos?.[0]?.value || '';
        // Keep ALL Google metadata for the admin customer profile
        const googleProfile = JSON.stringify(profile._json || { sub: profile.id, name, email, picture: avatar });

        const result = db.prepare(`
          INSERT INTO customers (email, name, google_id, avatar_url, google_profile)
          VALUES (?, ?, ?, ?, ?)
        `).run(email, name, profile.id, avatar, googleProfile);

        customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(result.lastInsertRowid);
      } else {
        // Update avatar/name/metadata on each login (in case they changed)
        const email = profile.emails?.[0]?.value || customer.email;
        const name = profile.displayName || customer.name;
        const avatar = profile.photos?.[0]?.value || customer.avatar_url;
        const googleProfile = JSON.stringify(profile._json || {});
        db.prepare('UPDATE customers SET email = ?, name = ?, avatar_url = ?, google_profile = ? WHERE id = ?')
          .run(email, name, avatar, googleProfile, customer.id);
        customer = { ...customer, email, name, avatar_url, google_profile: googleProfile };
      }

      return done(null, customer);
    } catch (err) {
      console.error('Google OAuth error:', err);
      return done(err, null);
    }
  }));

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser((id, done) => {
    try {
      const user = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
      done(null, user || null);
    } catch (err) {
      done(err, null);
    }
  });
} else {
  console.log('[auth] Google OAuth not configured — set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env');
}

// --------------- Middleware ---------------

// Check if user is authenticated
function isAuthenticated(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  return res.status(401).json({ error: 'Not authenticated' });
}

// --------------- Routes ---------------

/**
 * Resolve the PUBLIC origin the user actually sees (ngrok / custom domain).
 * Behind the Vite proxy the backend only sees localhost, so we prefer:
 *   1. SITE_URL env (explicit override)
 *   2. X-Forwarded-Host (set by ngrok / Cloudflare tunnels)
 *   3. CLIENT_URL host when the request comes from a loopback address
 *   4. The request's own host
 */
function publicOrigin(req) {
  if (process.env.SITE_URL) {
    return process.env.SITE_URL.replace(/\/+$/, '');
  }
  const fwdHost = req.headers['x-forwarded-host'];
  if (typeof fwdHost === 'string' && fwdHost.trim()) {
    const host = fwdHost.split(',')[0].trim();
    const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'http').toString().split(',')[0].trim();
    return `${proto}://${host}`;
  }
  const host = req.get('host') || '';
  if (/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) {
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    return clientUrl.replace(/\/+$/, '');
  }
  const proto = req.protocol || 'http';
  return `${proto}://${host}`;
}

// GET /auth/google — Start Google OAuth flow
router.get('/google', (req, res) => {
  if (!isGoogleConfigured()) {
    return res.status(503).json({
      error: 'Google OAuth is not configured',
      message: 'Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in server/.env',
    });
  }
  const redirect = String(req.query.redirect || '/account');
  // Only allow internal paths (prevents open redirects)
  const safeRedirect = redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : '/account';
  const authenticator = passport.authenticate('google', {
    scope: ['profile', 'email'],
    state: safeRedirect,
    // Build the callback URL from the PUBLIC origin so ngrok users stay on ngrok
    callbackURL: `${publicOrigin(req)}/auth/google/callback`,
  });
  authenticator(req, res);
});

// GET /auth/google/callback — Google OAuth callback
router.get('/google/callback',
  (req, res, next) => {
    if (!isGoogleConfigured()) {
      return res.redirect(`${publicOrigin(req)}/login?error=not_configured`);
    }
    next();
  },
  passport.authenticate('google', {
    failureRedirect: '/login?error=access_denied',
    failureMessage: true,
  }),
  (req, res) => {
    // Successful authentication — redirect to the page they came from,
    // on the PUBLIC origin they started from (works with ngrok + tunnels)
    const state = String(req.query.state || '/account');
    const redirectTo = state.startsWith('/') && !state.startsWith('//') ? state : '/account';
    const origin = publicOrigin(req);
    res.redirect(`${origin}${redirectTo}`);
  }
);

// GET /auth/me — Get current logged-in user
router.get('/me', (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    // Return user info (excluding sensitive fields)
    const user = req.user;
    let googleProfile = {};
    try { googleProfile = JSON.parse(user.google_profile || '{}'); } catch { googleProfile = {}; }
    return res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      avatar_url: user.avatar_url,
      phone: user.phone || '',
      address: user.address || '',
      city: user.city || '',
      governorate: user.governorate || '',
      latitude: user.latitude || null,
      longitude: user.longitude || null,
      google_profile: googleProfile,
      created_at: user.created_at,
      is_verified: user.is_verified === 1,
      needs_onboarding: !(user.phone && user.address && user.city),
    });
  }
  res.json(null);
});

// POST /auth/logout — Log out
router.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ success: true });
  });
});

module.exports = { router, isAuthenticated };
