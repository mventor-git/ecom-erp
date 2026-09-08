/**
 * User Management Routes
 * mventor-ticket-023: Role-Based Access Control
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcryptjs');
const { requirePermission, isAuthenticated } = require('../middleware/rbac');
const eventService = require('../services/eventService');
const permissionService = require('../services/permissionService');
const { validatePasswordStrength, getPasswordRequirements } = require('../utils/passwordValidator');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ── Personal employee signatures ──────────────────────────────────────────
// Every employee has their OWN signature. users ARE the staff identity, so we
// extend users (no second employee table). The image is stored on the
// filesystem via the existing upload abstraction (public/images/signatures,
// served at /images/signatures/…) and the DB keeps a relational reference.
const SIGNATURE_DIR = path.join(__dirname, '..', 'public', 'images', 'signatures');
if (!fs.existsSync(SIGNATURE_DIR)) fs.mkdirSync(SIGNATURE_DIR, { recursive: true });
const SIGNATURE_ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
const sigStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, SIGNATURE_DIR),
  filename: (req, file, cb) => {
    const ext = (path.extname(file.originalname) || '.png').toLowerCase();
    cb(null, `sig_${req.params.id}_${Date.now()}${ext}`);
  },
});
const signatureUpload = multer({
  storage: sigStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB — signatures are small
  fileFilter: (req, file, cb) => {
    if (!SIGNATURE_ALLOWED.includes(file.mimetype)) return cb(new Error('Signature must be PNG/JPEG/WebP/SVG'));
    cb(null, true);
  },
});

/** A user may edit their OWN signature; otherwise users.update is required. */
function canManageSignature(req, userId) {
  if (req.user && String(req.user.id) === String(userId)) return true;
  return !!(req.user && (req.user.permissions || []).some(p => ['users.update', 'users.manage'].includes(p)));
}

// --- Super-admin escalation guards ---------------------------------------
// Only super admins may create/edit/deactivate super-admin accounts or grant
// the super_admin role — otherwise any holder of users.* could escalate.

function superAdminRole() {
  return db.prepare(`SELECT id FROM roles WHERE name = 'super_admin'`).get();
}

function callerIsSuperAdmin(req) {
  return !!(req.user && (req.user.isSuperAdmin || (req.user.roles || []).includes('super_admin')));
}

function isUserSuperAdmin(userId) {
  return permissionService.hasAnyRole(userId, 'super_admin');
}

/** Ids of all ACTIVE users holding super_admin (multi-role + legacy role_id). */
function activeSuperAdminIds() {
  const s = superAdminRole();
  if (!s) return [];
  const ids = new Set();
  db.prepare('SELECT user_id FROM user_roles WHERE role_id = ?').all(s.id)
    .forEach(r => ids.add(r.user_id));
  db.prepare('SELECT id FROM users WHERE role_id = ?').all(s.id)
    .forEach(u => ids.add(u.id));
  return [...ids].filter(id => {
    const u = db.prepare('SELECT is_active FROM users WHERE id = ?').get(id);
    return u && u.is_active === 1;
  });
}

/** Reject if deactivating/stripping the LAST active super admin. */
function guardNotLastSuperAdmin(res, userId) {
  const supers = activeSuperAdminIds();
  if (supers.length <= 1 && supers.includes(userId)) {
    res.status(400).json({ error: 'Cannot modify the last active super admin account' });
    return false;
  }
  return true;
}

/** Reject non-super-admins touching super-admin accounts or granting the role. */
function guardSuperAdminScope(req, res, { targetUserId, targetRoleId }) {
  if (callerIsSuperAdmin(req)) return true;
  const s = superAdminRole();
  const touchesSuperAdmin =
    (targetUserId !== undefined && isUserSuperAdmin(targetUserId)) ||
    (targetRoleId !== undefined && s && Number(targetRoleId) === s.id);
  if (touchesSuperAdmin) {
    res.status(403).json({ error: 'Only a super admin can manage super admin accounts' });
    return false;
  }
  return true;
}

/**
 * GET /api/admin/users - List all users
 * Requires: users.read permission
 */
router.get('/', requirePermission('users.read'), (req, res) => {
  try {
    const users = db.prepare(`
      SELECT u.id, u.email, u.name, u.role_id, u.is_active, u.last_login_at, u.created_at,
             r.name as role_name,
             (SELECT GROUP_CONCAT(r2.name, ', ') FROM user_roles ur
              JOIN roles r2 ON r2.id = ur.role_id
              WHERE ur.user_id = u.id) AS all_roles
      FROM users u
      JOIN roles r ON u.role_id = r.id
      ORDER BY u.created_at DESC
    `).all();

    // expose multi-role names as an array (legacy role included client-side)
    users.forEach(u => {
      const names = new Set((u.all_roles || '').split(',').map(s => s.trim()).filter(Boolean));
      if (u.role_name) names.add(u.role_name);
      u.roles = [...names];
      delete u.all_roles;
    });

    res.json(users);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

/**
 * GET /api/admin/users/:id - Get user by ID
 * Requires: users.read permission
 */
router.get('/:id', requirePermission('users.read'), (req, res) => {
  try {
    const user = db.prepare(`
      SELECT u.id, u.email, u.name, u.role_id, u.is_active, u.last_login_at, u.created_at,
             r.name as role_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = ?
    `).get(req.params.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // multi-role support (mventor-ticket-050)
    user.roles = permissionService.userRoleNames(user.id);
    user.permissions = permissionService.userPermissions(user.id);

    res.json(user);
  } catch (err) {
    console.error('Error fetching user:', err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// GET /api/admin/users/:id/roles - user's roles (multi-role)
router.get('/:id/roles', requirePermission('users.read'), (req, res) => {
  try {
    res.json(permissionService.userRoles(parseInt(req.params.id)));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user roles' });
  }
});

// PUT /api/admin/users/:id/roles - set user's roles (multi-role)
// body: { role_ids: [1, 2, 3] } â€” replaces all roles; keeps role_id synced to the first
router.put('/:id/roles', requirePermission('users.update'), (req, res) => {
  try {
    const { role_ids } = req.body || {};
    if (!Array.isArray(role_ids) || role_ids.length === 0) {
      return res.status(400).json({ error: 'role_ids array is required' });
    }
    const userId = parseInt(req.params.id);
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // validate roles exist
    const valid = role_ids.map(id => db.prepare('SELECT id FROM roles WHERE id = ?').get(parseInt(id))).every(Boolean);
    if (!valid) return res.status(400).json({ error: 'One or more role_ids are invalid' });

    // Only super admins may grant the super_admin role or edit a super admin's roles
    if (!guardSuperAdminScope(req, res, { targetUserId: userId })) return;
    const s = superAdminRole();
    const grantsSuperAdmin = !!s && role_ids.some(id => Number(id) === s.id);
    if (grantsSuperAdmin && !callerIsSuperAdmin(req)) {
      return res.status(403).json({ error: 'Only a super admin can grant the super admin role' });
    }

    // Replacing a super admin's roles must not strip the last active super admin
    if (isUserSuperAdmin(userId) && !grantsSuperAdmin && !guardNotLastSuperAdmin(res, userId)) return;

    db.prepare('DELETE FROM user_roles WHERE user_id = ?').run(userId);
    role_ids.forEach(rid => db.prepare('INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)').run(userId, parseInt(rid)));

    // keep legacy role_id in sync with the primary (first) role
    const primary = parseInt(role_ids[0]);
    db.prepare('UPDATE users SET role_id = ? WHERE id = ?').run(primary, userId);

    res.json({ user_id: userId, role_ids: role_ids.map(Number) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/admin/users - Create new user
 * Requires: users.create permission
 */
router.post('/', requirePermission('users.create'), (req, res) => {
  try {
    const { email, password, name, role_id } = req.body;

    // Validation
    if (!email || !password || !name || !role_id) {
      return res.status(400).json({ error: 'Email, password, name, and role_id are required' });
    }

    // Validate password strength (mventor critical security improvements 2026-08-24)
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        error: 'Password does not meet strength requirements',
        errors: passwordValidation.errors,
        strength: passwordValidation.strength,
        requirements: getPasswordRequirements()
      });
    }

    // Check if email already exists
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existingUser) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    // Check if role exists
    const role = db.prepare('SELECT id FROM roles WHERE id = ?').get(role_id);
    if (!role) {
      return res.status(400).json({ error: 'Invalid role_id' });
    }

    // Only super admins may mint new super admin accounts
    if (!guardSuperAdminScope(req, res, { targetRoleId: role_id })) return;

    // Hash password
    const passwordHash = bcrypt.hashSync(password, 10);

    // Insert user
    const result = db.prepare(
      'INSERT INTO users (email, password_hash, name, role_id, is_active) VALUES (?, ?, ?, ?, 1)'
    ).run(email, passwordHash, name, role_id);

    // multi-role: register the primary role in user_roles too (mventor-ticket-050)
    db.prepare('INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)').run(result.lastInsertRowid, role_id);

    const newUser = db.prepare(`
      SELECT u.id, u.email, u.name, u.role_id, u.is_active, u.created_at,
             r.name as role_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = ?
    `).get(result.lastInsertRowid);

    // Emit event
    eventService.emit(
      eventService.EVENT_TYPES.USER_CREATED,
      eventService.ENTITY_TYPES.USER,
      result.lastInsertRowid,
      {
        userId: req.user.id,
        userRole: req.user.role,
        payload: { email, name, role_id },
        metadata: { ip: req.ip }
      }
    );

    res.status(201).json(newUser);
  } catch (err) {
    console.error('Error creating user:', err);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

/**
 * PUT /api/admin/users/:id - Update user
 * Requires: users.update permission
 */
router.put('/:id', requirePermission('users.update'), (req, res) => {
  try {
    const { email, name, role_id, is_active, password } = req.body;
    const userId = parseInt(req.params.id);

    // Check if user exists
    const existingUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent updating yourself
    if (userId === req.user.id) {
      return res.status(400).json({ error: 'Cannot update your own user account' });
    }

    // Super-admin scope guard: target account or new role is super admin?
    if (!guardSuperAdminScope(req, res, { targetUserId: userId, targetRoleId: role_id })) return;

    // Deactivating a super admin must not leave zero active super admins
    if (is_active === false && !guardNotLastSuperAdmin(res, userId)) return;

    // Build update query
    const updates = [];
    const values = [];

    if (email !== undefined) {
      // Check if email already exists (excluding current user)
      const emailExists = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, userId);
      if (emailExists) {
        return res.status(400).json({ error: 'Email already exists' });
      }
      updates.push('email = ?');
      values.push(email);
    }

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }

    if (role_id !== undefined) {
      const role = db.prepare('SELECT id FROM roles WHERE id = ?').get(role_id);
      if (!role) {
        return res.status(400).json({ error: 'Invalid role_id' });
      }
      updates.push('role_id = ?');
      values.push(role_id);
    }

    if (is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(is_active ? 1 : 0);
    }

    if (password !== undefined) {
      // Validate password strength (mventor critical security improvements 2026-08-24)
      const passwordValidation = validatePasswordStrength(password);
      if (!passwordValidation.valid) {
        return res.status(400).json({
          error: 'Password does not meet strength requirements',
          errors: passwordValidation.errors,
          strength: passwordValidation.strength,
          requirements: getPasswordRequirements()
        });
      }
      const passwordHash = bcrypt.hashSync(password, 10);
      updates.push('password_hash = ?');
      values.push(passwordHash);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(userId);

    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const updatedUser = db.prepare(`
      SELECT u.id, u.email, u.name, u.role_id, u.is_active, u.last_login_at, u.created_at, u.updated_at,
             r.name as role_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = ?
    `).get(userId);

    // Emit event
    eventService.emit(
      eventService.EVENT_TYPES.USER_UPDATED,
      eventService.ENTITY_TYPES.USER,
      userId,
      {
        userId: req.user.id,
        userRole: req.user.role,
        payload: { email, name, role_id, is_active },
        metadata: { ip: req.ip }
      }
    );

    res.json(updatedUser);
  } catch (err) {
    console.error('Error updating user:', err);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

/**
 * DELETE /api/admin/users/:id - Deactivate user (soft delete)
 * Requires: users.delete permission
 */
router.delete('/:id', requirePermission('users.delete'), (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    // Check if user exists
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent deleting yourself
    if (userId === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own user account' });
    }

    // Only super admins may deactivate a super admin, and never the last one
    if (!guardSuperAdminScope(req, res, { targetUserId: userId })) return;
    if (isUserSuperAdmin(userId) && !guardNotLastSuperAdmin(res, userId)) return;

    // Soft delete (set is_active = 0)
    db.prepare('UPDATE users SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(userId);

    // Emit event
    eventService.emit(
      eventService.EVENT_TYPES.USER_UPDATED,
      eventService.ENTITY_TYPES.USER,
      userId,
      {
        userId: req.user.id,
        userRole: req.user.role,
        payload: { action: 'deactivated' },
        metadata: { ip: req.ip }
      }
    );

    res.json({ message: 'User deactivated successfully' });
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

/**
 * GET /api/admin/roles - List all roles
 * Requires: users.read permission
 */
router.get('/roles/list', requirePermission('users.read'), (req, res) => {
  try {
    const roles = db.prepare(`
      SELECT r.*, COUNT(u.id) as user_count
      FROM roles r
      LEFT JOIN users u ON r.id = u.role_id AND u.is_active = 1
      GROUP BY r.id
      ORDER BY r.name
    `).all();

    res.json(roles);
  } catch (err) {
    console.error('Error fetching roles:', err);
    res.status(500).json({ error: 'Failed to fetch roles' });
  }
});

/**
 * GET /api/admin/permissions - List all permissions
 * Requires: users.read permission
 */
router.get('/permissions/list', requirePermission('users.read'), (req, res) => {
  try {
    const permissions = db.prepare(`
      SELECT p.*, GROUP_CONCAT(r.name) as roles
      FROM permissions p
      LEFT JOIN role_permissions rp ON p.id = rp.permission_id
      LEFT JOIN roles r ON rp.role_id = r.id
      GROUP BY p.id
      ORDER BY p.name
    `).all();

    res.json(permissions);
  } catch (err) {
    console.error('Error fetching permissions:', err);
    res.status(500).json({ error: 'Failed to fetch permissions' });
  }
});

/**
 * GET /api/admin/users/me - Get current user info
 * Requires: authentication
 */
router.get('/me/current', isAuthenticated, (req, res) => {
  try {
    const user = db.prepare(`
      SELECT u.id, u.email, u.name, u.role_id, u.is_active, u.last_login_at, u.created_at,
             r.name as role_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = ?
    `).get(req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // multi-role aware permissions (mventor-ticket-050)
    user.roles = permissionService.userRoleNames(user.id);
    user.permissions = permissionService.userPermissions(user.id);
    user.is_super_admin = user.roles.includes('super_admin');

    res.json(user);
  } catch (err) {
    console.error('Error fetching current user:', err);
    res.status(500).json({ error: 'Failed to fetch current user' });
  }
});

// ── Personal signature routes ──
// Self-service (/me) allows a signed-in user to manage THEIR OWN signature;
// admin routes require users.update. The authenticated actor is determined by
// the middleware — the frontend never supplies "signed by employee X".
function applySignature(req, res, userId) {
  if (!req.file) return res.status(400).json({ error: 'No signature file provided' });
  const rel = '/images/signatures/' + req.file.filename;
  const r = db.prepare(`
    UPDATE users SET signature_path = ?, signature_mime = ?, signature_updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(rel, req.file.mimetype, userId);
  if (!r.changes) return res.status(404).json({ error: 'User not found' });
  return res.json(db.prepare('SELECT id, name, signature_path, signature_updated_at FROM users WHERE id = ?').get(userId));
}

function clearSignature(userId) {
  const u = db.prepare('SELECT id, signature_path FROM users WHERE id = ?').get(userId);
  if (!u) return { error: 'User not found' };
  if (u.signature_path) {
    // signature_path is '/images/signatures/<file>' → strip only the leading '/'
    // so the file resolves under public/images/signatures/…
    const file = path.join(__dirname, '..', 'public', u.signature_path.replace(/^\//, ''));
    try { fs.unlinkSync(file); } catch { /* already gone */ }
  }
  db.prepare(`UPDATE users SET signature_path = '', signature_mime = '', signature_updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(userId);
  return db.prepare('SELECT id, name, signature_path FROM users WHERE id = ?').get(userId);
}

router.get('/:id/signature', requirePermission('users.read'), (req, res) => {
  const u = db.prepare('SELECT id, name, signature_path, signature_mime, signature_updated_at FROM users WHERE id = ?').get(req.params.id);
  if (!u) return res.status(404).json({ error: 'User not found' });
  res.json(u);
});

router.put('/me/signature', isAuthenticated, (req, res, next) => {
  signatureUpload.single('signature')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    applySignature(req, res, req.user.id);
  });
});

router.put('/:id/signature', requirePermission('users.update'), (req, res, next) => {
  signatureUpload.single('signature')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    applySignature(req, res, parseInt(req.params.id));
  });
});

router.delete('/me/signature', isAuthenticated, (req, res) => res.json(clearSignature(req.user.id)));

router.delete('/:id/signature', requirePermission('users.update'), (req, res) => res.json(clearSignature(parseInt(req.params.id))));

module.exports = router;
