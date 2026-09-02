/**
 * Mobile API v1 - User Profile
 * Mobile-optimized user profile endpoints
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { authenticateToken } = require('../middleware/jwtAuth');
const eventService = require('../services/eventService');

/**
 * GET /api/v1/user/profile
 * Get user profile
 */
router.get('/profile', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    // Check if this is a customer or admin user
    let user;
    if (userRole === 'customer') {
      // Query customers table for mobile customers
      user = db.prepare(`
        SELECT 
          id,
          email,
          name,
          phone,
          created_at
        FROM customers
        WHERE id = ?
      `).get(userId);
    } else {
      // Query users table for admin users
      user = db.prepare(`
        SELECT 
          u.id,
          u.email,
          u.name,
          u.phone,
          u.created_at,
          r.name as role_name
        FROM users u
        LEFT JOIN roles r ON u.role_id = r.id
        WHERE u.id = ?
      `).get(userId);
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'User not found',
        },
      });
    }

    // Get user addresses
    const addresses = db.prepare(`
      SELECT * FROM user_addresses
      WHERE user_id = ?
      ORDER BY is_default DESC, created_at DESC
    `).all(userId);

    res.json({
      success: true,
      data: {
        ...user,
        addresses: addresses.map(addr => ({
          id: addr.id,
          name: addr.name,
          phone: addr.phone,
          address: addr.address,
          city: addr.city,
          governorate: addr.governorate,
          postal_code: addr.postal_code,
          is_default: addr.is_default === 1,
        })),
      },
    });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch profile',
      },
    });
  }
});

/**
 * PUT /api/v1/user/profile
 * Update user profile
 */
router.put('/profile', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const { name, phone, email } = req.body;

    // Determine which table to update
    const tableName = userRole === 'customer' ? 'customers' : 'users';

    // Build update query dynamically
    const updates = [];
    const params = [];

    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }

    if (phone !== undefined) {
      updates.push('phone = ?');
      params.push(phone);
    }

    if (email !== undefined && userRole !== 'customer') {
      // Only admin users can update email
      const existing = db.prepare(`
        SELECT id FROM users WHERE email = ? AND id != ?
      `).get(email, userId);

      if (existing) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'EMAIL_EXISTS',
            message: 'Email already in use',
          },
        });
      }

      updates.push('email = ?');
      params.push(email);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_CHANGES',
          message: 'No fields to update',
        },
      });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(userId);

    db.prepare(`
      UPDATE ${tableName} SET ${updates.join(', ')} WHERE id = ?
    `).run(...params);

    // Emit event
    eventService.emit(
      eventService.EVENT_TYPES.USER_UPDATED,
      eventService.ENTITY_TYPES.USER,
      userId,
      {
        userId,
        userRole: req.user.role,
        payload: { fields: Object.keys(req.body) },
      }
    );

    res.json({
      success: true,
      message: 'Profile updated successfully',
    });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update profile',
      },
    });
  }
});

/**
 * PUT /api/v1/user/password
 * Change password
 */
router.put('/password', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Current password and new password are required',
        },
      });
    }

    if (new_password.length < 6) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'New password must be at least 6 characters',
        },
      });
    }

    // Determine which table to query
    const tableName = userRole === 'customer' ? 'customers' : 'users';

    // Get current user
    const user = db.prepare(`SELECT password_hash FROM ${tableName} WHERE id = ?`).get(userId);

    // Verify current password
    const validPassword = bcrypt.compareSync(current_password, user.password_hash);
    if (!validPassword) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PASSWORD',
          message: 'Current password is incorrect',
        },
      });
    }

    // Hash new password
    const newPasswordHash = bcrypt.hashSync(new_password, 10);

    // Update password
    db.prepare(`
      UPDATE ${tableName} SET password_hash = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newPasswordHash, userId);

    // Emit event
    eventService.emit(
      eventService.EVENT_TYPES.USER_UPDATED,
      eventService.ENTITY_TYPES.USER,
      userId,
      {
        userId,
        userRole: req.user.role,
        payload: { action: 'password_changed' },
      }
    );

    res.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to change password',
      },
    });
  }
});

/**
 * POST /api/v1/user/addresses
 * Add new address
 */
router.post('/addresses', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const { name, phone, address, city, governorate, postal_code, is_default = false } = req.body;

    // Validate required fields
    if (!name || !phone || !address || !city) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Name, phone, address, and city are required',
        },
      });
    }

    // If this is the default address, unset other defaults
    if (is_default) {
      db.prepare(`
        UPDATE user_addresses SET is_default = 0 WHERE user_id = ?
      `).run(userId);
    }

    // Insert new address
    const result = db.prepare(`
      INSERT INTO user_addresses (
        user_id, name, phone, address, city, governorate, postal_code, is_default
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      name,
      phone,
      address,
      city,
      governorate || null,
      postal_code || null,
      is_default ? 1 : 0
    );

    res.status(201).json({
      success: true,
      message: 'Address added successfully',
      data: {
        address_id: result.lastInsertRowid,
      },
    });
  } catch (err) {
    console.error('Add address error:', err);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to add address',
      },
    });
  }
});

/**
 * PUT /api/v1/user/addresses/:id
 * Update address
 */
router.put('/addresses/:id', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const addressId = req.params.id;
    const { name, phone, address, city, governorate, postal_code, is_default } = req.body;

    // Check if address exists and belongs to user
    const existing = db.prepare(`
      SELECT id FROM user_addresses WHERE id = ? AND user_id = ?
    `).get(addressId, userId);

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Address not found',
        },
      });
    }

    // If setting as default, unset other defaults
    if (is_default) {
      db.prepare(`
        UPDATE user_addresses SET is_default = 0 WHERE user_id = ?
      `).run(userId);
    }

    // Build update query
    const updates = [];
    const params = [];

    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (phone !== undefined) { updates.push('phone = ?'); params.push(phone); }
    if (address !== undefined) { updates.push('address = ?'); params.push(address); }
    if (city !== undefined) { updates.push('city = ?'); params.push(city); }
    if (governorate !== undefined) { updates.push('governorate = ?'); params.push(governorate); }
    if (postal_code !== undefined) { updates.push('postal_code = ?'); params.push(postal_code); }
    if (is_default !== undefined) { updates.push('is_default = ?'); params.push(is_default ? 1 : 0); }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_CHANGES',
          message: 'No fields to update',
        },
      });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(addressId);

    db.prepare(`
      UPDATE user_addresses SET ${updates.join(', ')} WHERE id = ?
    `).run(...params);

    res.json({
      success: true,
      message: 'Address updated successfully',
    });
  } catch (err) {
    console.error('Update address error:', err);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update address',
      },
    });
  }
});

/**
 * DELETE /api/v1/user/addresses/:id
 * Delete address
 */
router.delete('/addresses/:id', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const addressId = req.params.id;

    const result = db.prepare(`
      DELETE FROM user_addresses WHERE id = ? AND user_id = ?
    `).run(addressId, userId);

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Address not found',
        },
      });
    }

    res.json({
      success: true,
      message: 'Address deleted successfully',
    });
  } catch (err) {
    console.error('Delete address error:', err);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to delete address',
      },
    });
  }
});

module.exports = router;
