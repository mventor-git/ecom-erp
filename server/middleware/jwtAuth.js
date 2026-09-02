/**
 * JWT Authentication Middleware for Mobile Apps
 * Supports both session-based (web) and JWT-based (mobile) authentication
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key-change-in-production';

// Fail fast in production with insecure defaults (mventor-ticket-050)
if (process.env.NODE_ENV === 'production' &&
    (JWT_SECRET.startsWith('your-') || JWT_REFRESH_SECRET.startsWith('your-'))) {
  throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must be set to strong random values in production.');
}

/**
 * Generate JWT access token
 */
function generateAccessToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role || 'customer',
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

/**
 * Generate JWT refresh token
 */
function generateRefreshToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
    },
    JWT_REFRESH_SECRET,
    { expiresIn: '30d' }
  );
}

/**
 * Verify JWT token
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

/**
 * Verify refresh token
 */
function verifyRefreshToken(token) {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET);
  } catch (error) {
    return null;
  }
}

/**
 * Middleware: Authenticate JWT token for mobile apps
 * Falls back to session authentication for web
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    // Try session authentication (web)
    if (req.session && req.session.userId) {
      req.user = {
        id: req.session.userId,
        email: req.session.email,
        role: req.session.role || 'customer',
      };
      return next();
    }
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      },
    });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired token',
      },
    });
  }

  // Staff tokens: verify the account is still active (mventor-ticket-050).
  // Deactivated staff lose access immediately instead of at token expiry.
  if (decoded.role && decoded.role !== 'customer') {
    const db = require('../db');
    try {
      const user = db.prepare('SELECT is_active FROM users WHERE id = ?').get(decoded.id);
      if (!user || !user.is_active) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Account is deactivated' },
        });
      }
    } catch { /* DB not ready — fail closed below via default flow */ }
  }

  req.user = decoded;
  next();
}

/**
 * Middleware: Optional authentication
 * Sets req.user if token is valid, but doesn't require it
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    const decoded = verifyToken(token);
    if (decoded) {
      req.user = decoded;
    }
  } else if (req.session && req.session.userId) {
    req.user = {
      id: req.session.userId,
      email: req.session.email,
      role: req.session.role || 'customer',
    };
  }

  next();
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  verifyRefreshToken,
  authenticateToken,
  optionalAuth,
  JWT_SECRET,
  JWT_REFRESH_SECRET,
};
