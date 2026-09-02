/**
 * Two-Factor Authentication (2FA) API Routes
 *
 * Endpoints for 2FA setup, verification, and recovery:
 * - POST /api/admin/2fa/setup    - Generate 2FA secret and QR code
 * - POST /api/admin/2fa/enable   - Verify setup token and enable 2FA
 * - POST /api/admin/2fa/disable  - Verify token/password and disable 2FA
 * - GET  /api/admin/2fa/status   - Check 2FA status
 *
 * Created: 2026-08-24 (mventor high-priority security enhancements)
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const adminAuth = require('../middleware/adminAuth');
const twoFactorService = require('../services/twoFactorService');
const eventService = require('../services/eventService');

/**
 * POST /api/admin/2fa/setup
 * Initiate 2FA setup (returns secret & QR code)
 */
router.post('/setup', adminAuth, async (req, res) => {
  try {
    const userId = req.session.adminUser?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const user = db.prepare('SELECT email, two_factor_enabled FROM users WHERE id = ?').get(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.two_factor_enabled === 1) {
      return res.status(400).json({ error: '2FA is already enabled' });
    }

    const { secret, otpauthUrl } = twoFactorService.generateSecret(user.email);
    const qrCode = await twoFactorService.generateQRCode(otpauthUrl);

    req.session.temp2faSecret = secret;

    res.json({
      secret,
      qrCode,
      message: 'Scan QR code with authenticator app and verify'
    });
  } catch (err) {
    console.error('[2fa] Setup failed:', err);
    res.status(500).json({ error: 'Failed to initiate 2FA setup' });
  }
});

/**
 * POST /api/admin/2fa/enable
 * Verify TOTP token and enable 2FA
 */
router.post('/enable', adminAuth, async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ error: 'Token required' });
  }

  try {
    const userId = req.session.adminUser?.id;
    const tempSecret = req.session.temp2faSecret;

    if (!userId) return res.status(401).json({ error: 'Not authenticated' });
    if (!tempSecret) {
      return res.status(400).json({ error: 'Call /setup first' });
    }

    const isValid = twoFactorService.verifyToken(tempSecret, token);
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid token' });
    }

    const backupCodes = twoFactorService.generateBackupCodes(10);
    const hashedCodes = twoFactorService.hashBackupCodes(backupCodes);

    db.prepare(`
      UPDATE users
      SET two_factor_secret = ?, two_factor_enabled = 1, two_factor_backup_codes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(tempSecret, hashedCodes, userId);

    delete req.session.temp2faSecret;

    eventService.logEvent('TWO_FACTOR_ENABLED', eventService.ENTITY_TYPES.USER, userId, {});

    res.json({
      success: true,
      message: '2FA enabled',
      backupCodes,
      warning: 'Store backup codes safely!'
    });
  } catch (err) {
    console.error('[2fa] Enable failed:', err);
    res.status(500).json({ error: 'Failed to enable 2FA' });
  }
});

/**
 * POST /api/admin/2fa/disable
 * Disable 2FA (requires password + token/backup code)
 */
router.post('/disable', adminAuth, async (req, res) => {
  const { token, password } = req.body;

  if (!password) {
    return res.status(400).json({ error: 'Password required' });
  }

  try {
    const userId = req.session.adminUser?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const user = db.prepare('SELECT password_hash, two_factor_secret, two_factor_enabled, two_factor_backup_codes FROM users WHERE id = ?').get(userId);
    if (!user || user.two_factor_enabled === 0) {
      return res.status(400).json({ error: '2FA not enabled' });
    }

    const isPasswordValid = bcrypt.compareSync(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Incorrect password' });
    }

    let is2faValid = false;
    if (token) {
      const isTokenValid = twoFactorService.verifyToken(user.two_factor_secret, token);
      if (isTokenValid) {
        is2faValid = true;
      } else {
        const backupResult = twoFactorService.verifyBackupCode(token, user.two_factor_backup_codes);
        if (backupResult.valid) {
          is2faValid = true;
          db.prepare('UPDATE users SET two_factor_backup_codes = ? WHERE id = ?').run(backupResult.remainingCodes, userId);
        }
      }
    } else {
      return res.status(400).json({ error: 'Token or backup code required' });
    }

    if (!is2faValid) {
      return res.status(400).json({ error: 'Invalid token/backup code' });
    }

    db.prepare(`
      UPDATE users
      SET two_factor_secret = NULL, two_factor_enabled = 0, two_factor_backup_codes = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(userId);

    eventService.logEvent('TWO_FACTOR_DISABLED', eventService.ENTITY_TYPES.USER, userId, {});

    res.json({
      success: true,
      message: '2FA disabled'
    });
  } catch (err) {
    console.error('[2fa] Disable failed:', err);
    res.status(500).json({ error: 'Failed to disable 2FA' });
  }
});

/**
 * GET /api/admin/2fa/status
 * Check current 2FA status
 */
router.get('/status', adminAuth, (req, res) => {
  try {
    const userId = req.session.adminUser?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const user = db.prepare('SELECT two_factor_enabled FROM users WHERE id = ?').get(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({
      enabled: user.two_factor_enabled === 1
    });
  } catch (err) {
    console.error('[2fa] Status check failed:', err);
    res.status(500).json({ error: 'Failed to check status' });
  }
});

module.exports = router;
