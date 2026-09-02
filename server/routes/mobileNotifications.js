/**
 * Mobile API v1 - Push Notifications
 * Device registration and notification preferences for mobile apps
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/jwtAuth');

/**
 * POST /api/v1/notifications/register
 * Register device for push notifications
 */
router.post('/register', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const { device_token, platform, app_version } = req.body;

    if (!device_token || !platform) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'device_token and platform are required',
        },
      });
    }

    // Check if device already registered
    const existing = db.prepare(`
      SELECT id FROM device_tokens
      WHERE user_id = ? AND device_token = ?
    `).get(userId, device_token);

    if (existing) {
      // Update existing device
      db.prepare(`
        UPDATE device_tokens
        SET platform = ?, app_version = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(platform, app_version || null, existing.id);
    } else {
      // Insert new device
      db.prepare(`
        INSERT INTO device_tokens (user_id, device_token, platform, app_version)
        VALUES (?, ?, ?, ?)
      `).run(userId, device_token, platform, app_version || null);
    }

    res.json({
      success: true,
      message: 'Device registered successfully',
    });
  } catch (err) {
    console.error('Device registration error:', err);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to register device',
      },
    });
  }
});

/**
 * DELETE /api/v1/notifications/register
 * Unregister device from push notifications
 */
router.delete('/register', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const { device_token } = req.body;

    if (!device_token) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'device_token is required',
        },
      });
    }

    db.prepare(`
      DELETE FROM device_tokens
      WHERE user_id = ? AND device_token = ?
    `).run(userId, device_token);

    res.json({
      success: true,
      message: 'Device unregistered successfully',
    });
  } catch (err) {
    console.error('Device unregistration error:', err);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to unregister device',
      },
    });
  }
});

/**
 * GET /api/v1/notifications/preferences
 * Get user's notification preferences
 */
router.get('/preferences', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;

    // Get preferences from database (or use defaults)
    const prefs = db.prepare(`
      SELECT * FROM notification_preferences WHERE user_id = ?
    `).get(userId);

    // Default preferences if not set
    const defaults = {
      order_updates: 1,
      promotions: 1,
      new_arrivals: 0,
      price_alerts: 1,
      low_stock_alerts: 1,
    };

    const preferences = prefs || { user_id: userId, ...defaults };

    res.json({
      success: true,
      data: {
        order_updates: preferences.order_updates === 1,
        promotions: preferences.promotions === 1,
        new_arrivals: preferences.new_arrivals === 1,
        price_alerts: preferences.price_alerts === 1,
        low_stock_alerts: preferences.low_stock_alerts === 1,
      },
    });
  } catch (err) {
    console.error('Get preferences error:', err);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get preferences',
      },
    });
  }
});

/**
 * PUT /api/v1/notifications/preferences
 * Update user's notification preferences
 */
router.put('/preferences', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const { order_updates, promotions, new_arrivals, price_alerts, low_stock_alerts } = req.body;

    // Check if preferences exist
    const existing = db.prepare(`
      SELECT id FROM notification_preferences WHERE user_id = ?
    `).get(userId);

    if (existing) {
      // Update existing preferences
      db.prepare(`
        UPDATE notification_preferences
        SET order_updates = ?, promotions = ?, new_arrivals = ?, price_alerts = ?, low_stock_alerts = ?, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `).run(
        order_updates !== undefined ? (order_updates ? 1 : 0) : undefined,
        promotions !== undefined ? (promotions ? 1 : 0) : undefined,
        new_arrivals !== undefined ? (new_arrivals ? 1 : 0) : undefined,
        price_alerts !== undefined ? (price_alerts ? 1 : 0) : undefined,
        low_stock_alerts !== undefined ? (low_stock_alerts ? 1 : 0) : undefined,
        userId
      );
    } else {
      // Insert new preferences
      db.prepare(`
        INSERT INTO notification_preferences (user_id, order_updates, promotions, new_arrivals, price_alerts, low_stock_alerts)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        userId,
        order_updates !== undefined ? (order_updates ? 1 : 0) : 1,
        promotions !== undefined ? (promotions ? 1 : 0) : 1,
        new_arrivals !== undefined ? (new_arrivals ? 1 : 0) : 0,
        price_alerts !== undefined ? (price_alerts ? 1 : 0) : 1,
        low_stock_alerts !== undefined ? (low_stock_alerts ? 1 : 0) : 1
      );
    }

    res.json({
      success: true,
      message: 'Preferences updated successfully',
    });
  } catch (err) {
    console.error('Update preferences error:', err);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update preferences',
      },
    });
  }
});

/**
 * GET /api/v1/notifications
 * Get user's in-app notifications
 */
router.get('/', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20, unread_only } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    let where = 'WHERE user_id = ?';
    const params = [userId];

    if (unread_only === 'true') {
      where += ' AND is_read = 0';
    }

    // Get total count
    const countResult = db.prepare(`
      SELECT COUNT(*) as total FROM in_app_notifications ${where}
    `).get(...params);

    const total = countResult.total;
    const totalPages = Math.ceil(total / limitNum);

    // Get notifications
    const notifications = db.prepare(`
      SELECT * FROM in_app_notifications
      ${where}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limitNum, offset);

    res.json({
      success: true,
      data: notifications.map(n => ({
        ...n,
        is_read: n.is_read === 1,
      })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        total_pages: totalPages,
      },
    });
  } catch (err) {
    console.error('Get notifications error:', err);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get notifications',
      },
    });
  }
});

/**
 * PUT /api/v1/notifications/:id/read
 * Mark notification as read
 */
router.put('/:id/read', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const notificationId = req.params.id;

    const result = db.prepare(`
      UPDATE in_app_notifications
      SET is_read = 1, read_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).run(notificationId, userId);

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Notification not found',
        },
      });
    }

    res.json({
      success: true,
      message: 'Notification marked as read',
    });
  } catch (err) {
    console.error('Mark as read error:', err);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to mark notification as read',
      },
    });
  }
});

/**
 * PUT /api/v1/notifications/read-all
 * Mark all notifications as read
 */
router.put('/read-all', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;

    db.prepare(`
      UPDATE in_app_notifications
      SET is_read = 1, read_at = CURRENT_TIMESTAMP
      WHERE user_id = ? AND is_read = 0
    `).run(userId);

    res.json({
      success: true,
      message: 'All notifications marked as read',
    });
  } catch (err) {
    console.error('Mark all as read error:', err);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to mark all notifications as read',
      },
    });
  }
});

module.exports = router;
