/**
 * CSRF protection middleware.
 * 
 * On login, a CSRF token is generated and stored in the session.
 * The frontend retrieves it via GET /api/admin/csrf-token and sends
 * it back in the X-CSRF-Token header on state-changing requests.
 */

const crypto = require('crypto');

// Generate a new CSRF token
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Middleware: ensure CSRF token is present on state-changing methods
function csrfProtection(req, res, next) {
  // Only protect state-changing methods
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return next();
  }

  // Public routes that don't need CSRF
  const publicPaths = [
    '/api/admin/login',
    '/api/health',
    '/create-checkout-session',
    '/webhook',
  ];
  if (publicPaths.some(p => req.path.startsWith(p))) {
    return next();
  }

  // Admin routes need CSRF
  if (req.path.startsWith('/api/admin/')) {
    const headerToken = req.headers['x-csrf-token'];
    const sessionToken = req.session?.csrfToken;

    if (!headerToken || !sessionToken || headerToken !== sessionToken) {
      return res.status(403).json({ error: 'Invalid or missing CSRF token' });
    }
  }

  next();
}

module.exports = { csrfProtection, generateToken };
