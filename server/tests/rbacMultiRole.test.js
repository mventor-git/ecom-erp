/**
 * Tests for multi-role support (mventor-ticket-050).
 */
const db = require('../db');
const permissionService = require('../services/permissionService');

let userId = null;
let packerRoleId = null;
let managerRoleId = null;
const SUFFIX = Math.random().toString(36).slice(2, 10);
const testEmail = `jest.multi-${SUFFIX}@test.com`;

beforeAll(async () => {
  await db.initPromise;
  // Clean children BEFORE the parent (FK ON). A leftover user from a prior run
  // has user_roles rows that block DELETE FROM users.
  db.prepare('SELECT id FROM users WHERE email = ?').get(testEmail) &&
    db.prepare('DELETE FROM users WHERE email = ?').run(testEmail);
  db.prepare("DELETE FROM roles WHERE name IN ('jest_packer', 'jest_manager')").run();

  // create two test roles with distinct permissions (roles table has NO `description` column)
  const r1 = db.prepare("INSERT INTO roles (name) VALUES ('jest_packer')").run();
  const r2 = db.prepare("INSERT INTO roles (name) VALUES ('jest_manager')").run();
  packerRoleId = r1.lastInsertRowid;
  managerRoleId = r2.lastInsertRowid;

  // permissions
  const permPacking = db.prepare("INSERT INTO permissions (name, description) VALUES ('jest.packing', 'test')").run();
  const permOrders = db.prepare("INSERT INTO permissions (name, description) VALUES ('jest.orders', 'test')").run();
  db.prepare('INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)').run(packerRoleId, permPacking.lastInsertRowid);
  db.prepare('INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)').run(managerRoleId, permOrders.lastInsertRowid);

  const bcrypt = require('bcryptjs');
  const hash = bcrypt.hashSync('Test123!', 10);
  const u = db.prepare('INSERT INTO users (email, password_hash, name, role_id, is_active) VALUES (?, ?, ?, ?, 1)')
    .run(testEmail, hash, 'Jest Multi', packerRoleId);
  userId = u.lastInsertRowid;
  db.prepare('INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)').run(userId, packerRoleId);
});

afterAll(() => {
  db.prepare('DELETE FROM user_roles WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  db.prepare('DELETE FROM role_permissions WHERE role_id IN (?, ?)').run(packerRoleId, managerRoleId);
  db.prepare("DELETE FROM permissions WHERE name IN ('jest.packing', 'jest.orders')").run();
  db.prepare('DELETE FROM roles WHERE id IN (?, ?)').run(packerRoleId, managerRoleId);
  db.saveDb();
});

describe('Multi-role permissions', () => {
  test('single role: permissions come from that role', () => {
    expect(permissionService.hasPermission(userId, 'jest.packing')).toBe(true);
    expect(permissionService.hasPermission(userId, 'jest.orders')).toBe(false);
  });

  test('adding a second role grants its permissions too', () => {
    db.prepare('INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)').run(userId, managerRoleId);

    expect(permissionService.userRoles(userId)).toEqual(expect.arrayContaining([packerRoleId, managerRoleId]));
    expect(permissionService.hasPermission(userId, 'jest.packing')).toBe(true);
    expect(permissionService.hasPermission(userId, 'jest.orders')).toBe(true); // from the second role
    expect(permissionService.hasAnyRole(userId, 'jest_manager')).toBe(true);
    expect(permissionService.hasAnyRole(userId, 'jest_packer')).toBe(true);
  });

  test('usersWithPermission finds users through any role', () => {
    const ids = permissionService.usersWithPermission('jest.packing');
    expect(ids).toContain(userId);
    const ids2 = permissionService.usersWithPermission('jest.orders');
    expect(ids2).toContain(userId); // via the second role
  });

  test('removing the second role revokes its permissions', () => {
    db.prepare('DELETE FROM user_roles WHERE user_id = ? AND role_id = ?').run(userId, managerRoleId);
    expect(permissionService.hasPermission(userId, 'jest.orders')).toBe(false);
    expect(permissionService.hasPermission(userId, 'jest.packing')).toBe(true);
  });
});
