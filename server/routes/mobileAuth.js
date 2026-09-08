/**
 * Mobile Authentication Routes
 * JWT-based authentication for Android/iOS apps
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken, authenticateToken } = require('../middleware/jwtAuth');
const eventService = require('../services/eventService');

/**
 * POST /api/v1/auth/mobile/login
 * Mobile app login with JWT
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

    // Find user by email
    const user = db.prepare(`
      SELECT u.*, r.name as role_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.email = ? AND u.is_active = 1
    `).get(email);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid credentials',
        },
      });
    }

    // Verify password
    const validPassword = bcrypt.compareSync(password, user.password_hash);
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
      id: user.id,
      email: user.email,
      role: user.role_name,
    });

    const refreshToken = generateRefreshToken({
      id: user.id,
      email: user.email,
    });

    // Update last login
    db.prepare('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);

    // Emit event
    eventService.emit(
      eventService.EVENT_TYPES.USER_LOGIN,
      eventService.ENTITY_TYPES.USER,
      user.id,
      {
        userId: user.id,
        userRole: user.role_name,
        payload: { method: 'jwt', platform: 'mobile' },
        metadata: { ip: req.ip },
      }
    );

    res.json({
      success: true,
      token: accessToken,
      refresh_token: refreshToken,
      expires_in: 86400, // 24 hours
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role_name,
      },
    });
  } catch (err) {
    console.error('Mobile login error:', err);
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
 * POST /api/v1/auth/mobile/refresh
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

    // Get user
    const user = db.prepare(`
      SELECT u.*, r.name as role_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = ? AND u.is_active = 1
    `).get(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not found or inactive',
        },
      });
    }

    // Generate new access token
    const accessToken = generateAccessToken({
      id: user.id,
      email: user.email,
      role: user.role_name,
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
 * POST /api/v1/auth/mobile/logout
 * Mobile app logout (invalidate token on client side)
 */
router.post('/logout', authenticateToken, (req, res) => {
  try {
    // Emit event
    eventService.emit(
      eventService.EVENT_TYPES.USER_LOGOUT,
      eventService.ENTITY_TYPES.USER,
      req.user.id,
      {
        userId: req.user.id,
        userRole: req.user.role,
        payload: { method: 'jwt', platform: 'mobile' },
      }
    );

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (err) {
    console.error('Mobile logout error:', err);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Logout failed',
      },
    });
  }
});

/**
 * GET /api/v1/auth/mobile/me
 * Get current user profile
 */
router.get('/me', authenticateToken, (req, res) => {
  try {
    const user = db.prepare(`
      SELECT u.id, u.email, u.name, u.role_id, u.is_active, u.last_login_at, u.created_at,
             r.name as role_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = ?
    `).get(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'User not found',
        },
      });
    }

    res.json({
      success: true,
      data: user,
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
