/**
 * Permission Service â€” multi-role aware RBAC helpers (mventor-ticket-050).
 * Users can have MULTIPLE roles (user_roles table) plus the legacy role_id.
 * All role/permission lookups in the codebase should go through this service.
 */

const db = require('../db');

/** All role ids for a user (user_roles âˆª legacy role_id) */
function userRoles(userId) {
  const ids = db.prepare('SELECT role_id FROM user_roles WHERE user_id = ?').all(userId).map(r => r.role_id);
  const legacy = db.prepare('SELECT role_id FROM users WHERE id = ?').get(userId);
  if (legacy && legacy.role_id && !ids.includes(legacy.role_id)) ids.push(legacy.role_id);
  return ids;
}

/** All role names for a user */
function userRoleNames(userId) {
  const ids = userRoles(userId);
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => '?').join(',');
  return db.prepare(`SELECT name FROM roles WHERE id IN (${placeholders})`).all(...ids).map(r => r.name);
}

/** All permission names granted to a user across all roles */
function userPermissions(userId) {
  const ids = userRoles(userId);
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => '?').join(',');
  return db.prepare(`
    SELECT DISTINCT p.name FROM permissions p
    JOIN role_permissions rp ON rp.permission_id = p.id
    WHERE rp.role_id IN (${placeholders})
  `).all(...ids).map(r => r.name);
}

function hasPermission(userId, permission) {
  return userPermissions(userId).includes(permission);
}

function hasAnyRole(userId, roleNames) {
  const names = userRoleNames(userId);
  return (Array.isArray(roleNames) ? roleNames : [roleNames]).some(n => names.includes(n));
}

/** All active user ids holding a permission through ANY role */
function usersWithPermission(permission) {
  return db.prepare(`
    SELECT DISTINCT u.id FROM users u
    WHERE u.is_active = 1 AND (
      u.role_id IN (SELECT role_id FROM role_permissions WHERE permission_id = (SELECT id FROM permissions WHERE name = ?))
      OR u.id IN (
        SELECT ur.user_id FROM user_roles ur
        JOIN role_permissions rp ON rp.role_id = ur.role_id
        JOIN permissions p ON p.id = rp.permission_id
        WHERE p.name = ?
      )
    )
  `).all(permission, permission).map(u => u.id);
}

module.exports = {
  userRoles,
  userRoleNames,
  userPermissions,
  hasPermission,
  hasAnyRole,
  usersWithPermission,
};
