/**
 * Mobile Customer Authentication Routes
 * Registration and login for mobile app customers
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken, authenticateToken } = require('../middleware/jwtAuth');

/**
 * POST /api/v1/auth/customer/register
 * Register a new customer account
 */
router.post('/register', (req, res) => {
  try {
    const { email, password, name, phone } = req.body;

    // Validation
    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Email, password, and name are required',
        },
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Password must be at least 6 characters',
        },
      });
    }

    // Check if email already exists
    const existingCustomer = db.prepare('SELECT id FROM customers WHERE email = ?').get(email);
    if (existingCustomer) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'EMAIL_EXISTS',
          message: 'Email already registered',
        },
      });
    }

    // Hash password
    const passwordHash = bcrypt.hashSync(password, 10);

    // Insert customer (google_id NULL — the column is UNIQUE with DEFAULT '',
    // so inserting '' would collide after the first row)
    const result = db.prepare(`
      INSERT INTO customers (email, name, phone, password_hash, google_id)
      VALUES (?, ?, ?, ?, NULL)
    `).run(email, name, phone || null, passwordHash);

    const customerId = result.lastInsertRowid;

    // VIP invitation (mventor-ticket-060): a valid unused invite code handed
    // to signup flags the new account as VIP immediately.
    let vipClaimed = null;
    if (req.body?.invite_code) {
      try {
        const vipService = require('../services/vipService');
        vipClaimed = vipService.claimInvite(String(req.body.invite_code), customerId);
      } catch { /* invalid/used code — signup proceeds un-VIPed */ }
    }

    // Get the created customer
    const customer = db.prepare(`
      SELECT id, email, name, phone, created_at
      FROM customers WHERE id = ?
    `).get(customerId);

    // Generate tokens
    const accessToken = generateAccessToken({
      id: customer.id,
      email: customer.email,
      role: 'customer',
    });

    const refreshToken = generateRefreshToken({
      id: customer.id,
      email: customer.email,
    });

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      token: accessToken,
      refresh_token: refreshToken,
      expires_in: 86400, // 24 hours
      customer: {
        id: customer.id,
        email: customer.email,
        name: customer.name,
        phone: customer.phone,
        vip: !!vipClaimed,
        invite_name: vipClaimed?.invite_name || null,
      },
    });
  } catch (err) {
    console.error('Customer registration error:', err);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Registration failed',
      },
    });
  }
});

/**
 * POST /api/v1/auth/customer/login
 * Customer login with JWT
 */
router.post('/login', (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Email and password are required',
        },
      });
    }

    // Find customer by email
    const customer = db.prepare(`
      SELECT id, email, name, phone, password_hash
      FROM customers WHERE email = ?
    `).get(email);

    if (!customer) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid credentials',
        },
      });
    }

    // Verify password
    const validPassword = bcrypt.compareSync(password, customer.password_hash);
    if (!validPassword) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid credentials',
        },
      });
    }

    // Generate tokens
    const accessToken = generateAccessToken({
      id: customer.id,
      email: customer.email,
      role: 'customer',
    });

    const refreshToken = generateRefreshToken({
      id: customer.id,
      email: customer.email,
    });

    res.json({
      success: true,
      token: accessToken,
      refresh_token: refreshToken,
      expires_in: 86400, // 24 hours
      customer: {
        id: customer.id,
        email: customer.email,
        name: customer.name,
        phone: customer.phone,
      },
    });
  } catch (err) {
    console.error('Customer login error:', err);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Login failed',
      },
    });
  }
});

/**
 * POST /api/v1/auth/customer/refresh
 * Refresh JWT access token
 */
router.post('/refresh', (req, res) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Refresh token is required',
        },
      });
    }

    const decoded = verifyRefreshToken(refresh_token);
    if (!decoded) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid or expired refresh token',
        },
      });
    }

    // Get customer
    const customer = db.prepare(`
      SELECT id, email, name, phone
      FROM customers WHERE id = ?
    `).get(decoded.id);

    if (!customer) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Customer not found',
        },
      });
    }

    // Generate new access token
    const accessToken = generateAccessToken({
      id: customer.id,
      email: customer.email,
      role: 'customer',
    });

    res.json({
      success: true,
      token: accessToken,
      expires_in: 86400,
    });
  } catch (err) {
    console.error('Token refresh error:', err);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Token refresh failed',
      },
    });
  }
});

/**
 * POST /api/v1/auth/customer/google
 * Sign in with a Google ID token (from the mobile app)
 * Verifies the token with Google, then finds or creates the customer.
 */
router.post('/google', async (req, res) => {
  try {
    const { id_token, client_id } = req.body;

    if (!id_token) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'id_token is required',
        },
      });
    }

    // Verify the token with Google's tokeninfo endpoint
    const verifyRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(id_token)}`
    );
    if (!verifyRes.ok) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid Google token',
        },
      });
    }

    const profile = await verifyRes.json();

    if (profile.error) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: profile.error_description || 'Invalid Google token',
        },
      });
    }

    // Optionally enforce the expected audience (Google OAuth client id)
    if (client_id && profile.aud && profile.aud !== client_id) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Token audience mismatch',
        },
      });
    }

    const googleId = profile.sub;
    const email = profile.email;
    const name = profile.name || email || 'Google User';

    if (!googleId || !email) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Google token missing profile info',
        },
      });
    }

    // Find existing customer by google_id, then by email
    let customer = db.prepare(`
      SELECT id, email, name, phone
      FROM customers WHERE google_id = ?
    `).get(googleId);

    if (!customer) {
      customer = db.prepare(`
        SELECT id, email, name, phone, google_id
        FROM customers WHERE email = ?
      `).get(email);

      if (customer && !customer.google_id) {
        // Link the Google account to the existing email account
        db.prepare('UPDATE customers SET google_id = ? WHERE id = ?')
          .run(googleId, customer.id);
      }
    }

    if (!customer) {
      // Create a new customer
      const result = db.prepare(`
        INSERT INTO customers (email, name, google_id)
        VALUES (?, ?, ?)
      `).run(email, name, googleId);
      customer = {
        id: result.lastInsertRowid,
        email,
        name,
        phone: null,
      };
    }

    // Generate tokens
    const accessToken = generateAccessToken({
      id: customer.id,
      email: customer.email,
      role: 'customer',
    });

    const refreshToken = generateRefreshToken({
      id: customer.id,
      email: customer.email,
    });

    res.json({
      success: true,
      message: 'Google sign-in successful',
      token: accessToken,
      refresh_token: refreshToken,
      expires_in: 86400,
      customer: {
        id: customer.id,
        email: customer.email,
        name: customer.name,
        phone: customer.phone,
      },
    });
  } catch (err) {
    console.error('Google sign-in error:', err);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Google sign-in failed',
      },
    });
  }
});

/**
 * GET /api/v1/auth/customer/me
 * Get current customer profile
 */
router.get('/me', authenticateToken, (req, res) => {
  try {
    const customer = db.prepare(`
      SELECT id, email, name, phone, created_at
      FROM customers WHERE id = ?
    `).get(req.user.id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Customer not found',
        },
      });
    }

    res.json({
      success: true,
      data: customer,
    });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get profile',
      },
    });
  }
});

module.exports = router;
