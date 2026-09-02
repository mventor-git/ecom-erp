/**
 * Role-Based Access Control (RBAC) Middleware
 * mventor-ticket-023 / mventor-ticket-050 (multi-role support)
 */

const db = require('../db');
const permissionService = require('../services/permissionService');

/**
 * Middleware to require specific permission (any of the user's roles)
 * @param {string} permission - Permission name (e.g., 'products.create')
 * @returns {Function} Express middleware
 */
function requirePermission(permission) {
  return (req, res, next) => {
    // Env-bootstrap admin (ADMIN_USERNAME/ADMIN_PASSWORD login has no users row):
    // treat as full super admin so the owner is never locked out.
    if (req.session && req.session.isAdmin && !req.session.userId) {
      req.user = {
        id: 0,
        email: 'env-admin',
        name: 'Administrator',
        role: 'super_admin',
        roleId: null,
        roles: ['super_admin'],
        permissions: ['*'],
        isSuperAdmin: true,
      };
      return next();
    }

    // Check if user is authenticated
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get user with primary role
    const user = db.prepare(`
      SELECT u.*, r.name as role_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = ? AND u.is_active = 1
    `).get(req.session.userId);

    if (!user) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    // Multi-role aware permission check (all roles + legacy role_id)
    const allRoles = permissionService.userRoleNames(user.id);
    const isSuperAdmin = allRoles.includes('super_admin');

    // super_admin (and '*' holders) bypass individual permission checks
    if (!isSuperAdmin && !permissionService.userPermissions(user.id).includes('*')) {
      if (!permissionService.hasPermission(user.id, permission)) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          required: permission,
          roles: allRoles,
        });
      }
    }

    // Attach user info to request
    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role_name,
      roleId: user.role_id,
      roles: allRoles,
      permissions: isSuperAdmin ? ['*'] : permissionService.userPermissions(user.id),
      isSuperAdmin,
    };

    next();
  };
}

/**
 * Middleware to require the super_admin role specifically.
 * Guards account-management escalation paths (staff panel).
 */
function requireSuperAdmin(req, res, next) {
  // Env-bootstrap admin (ADMIN_USERNAME/ADMIN_PASSWORD) is always super admin
  if (req.session && req.session.isAdmin && !req.session.userId) {
    req.user = {
      id: 0,
      email: 'env-admin',
      name: 'Administrator',
      role: 'super_admin',
      roleId: null,
      roles: ['super_admin'],
      permissions: ['*'],
      isSuperAdmin: true,
    };
    return next();
  }

  requireRole('super_admin')(req, res, (err) => {
    if (err) return next(err);
    req.user.isSuperAdmin = true;
    next();
  });
}

/**
 * Middleware to require a specific role (any of the user's roles)
 * @param {string} roleName - Role name (e.g., 'super_admin')
 * @returns {Function} Express middleware
 */
function requireRole(roleName) {
  return (req, res, next) => {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = db.prepare(`
      SELECT u.*, r.name as role_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = ? AND u.is_active = 1
    `).get(req.session.userId);

    if (!user) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    if (!permissionService.hasAnyRole(user.id, roleName)) {
      return res.status(403).json({
        error: 'Insufficient role',
        required: roleName,
        roles: permissionService.userRoleNames(user.id),
      });
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role_name,
      roleId: user.role_id,
      roles: permissionService.userRoleNames(user.id),
    };

    next();
  };
}

/**
 * Middleware to check if user is authenticated (any role)
 */
function isAuthenticated(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const user = db.prepare(`
    SELECT u.*, r.name as role_name
    FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE u.id = ? AND u.is_active = 1
  `).get(req.session.userId);

  if (!user) {
    return res.status(401).json({ error: 'User not found or inactive' });
  }

  req.user = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role_name,
    roleId: user.role_id,
    roles: permissionService.userRoleNames(user.id),
    permissions: permissionService.userPermissions(user.id),
  };

  next();
}

module.exports = {
  requirePermission,
  requireRole,
  requireSuperAdmin,
  isAuthenticated
};
