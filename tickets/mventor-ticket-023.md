# mventor-ticket-023: Role-Based Access Control (RBAC)

**Status:** Completed  
**Priority:** Critical  
**Phase:** ERP Core  
**Created:** 2026-07-28  
**Completed:** 2026-07-28  
**Author:** CODEX

---

## Objective

Implement a role-based access control system that governs who can do what in the platform. Every action requires permissions. Never trust the frontend. Always validate permissions on the backend.

---

## Current State

- Single admin user (hardcoded in .env)
- No role system
- No permission checks beyond "is admin"
- No multi-user support

---

## Target State

### New Tables

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role_id INTEGER NOT NULL REFERENCES roles(id),
  is_active INTEGER DEFAULT 1,
  last_login_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE, -- e.g., "products.create", "orders.delete"
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE role_permissions (
  role_id INTEGER NOT NULL REFERENCES roles(id),
  permission_id INTEGER NOT NULL REFERENCES permissions(id),
  PRIMARY KEY (role_id, permission_id)
);
```

### Roles

| Role | Scope |
|------|-------|
| Super Admin | Full system access |
| Site Manager | Multi-warehouse oversight |
| Warehouse Manager | Single warehouse operations |
| Delivery Partner | Shipments & deliveries |
| Support | Customer-facing operations |
| Viewer | Read-only access |

### Permission Format

`module.action` â€” e.g.:
- `products.create`
- `products.read`
- `products.update`
- `products.delete`
- `orders.create`
- `orders.read`
- `orders.update`
- `orders.delete`
- `inventory.adjust`
- `inventory.transfer`
- `warehouses.manage`
- `suppliers.manage`
- `purchase_orders.create`
- `purchase_orders.approve`
- `users.manage`
- `settings.manage`

---

## Implementation

### Auth Middleware

```javascript
// server/middleware/rbac.js
function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!req.user.permissions.includes(permission)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}
```

### Migration

1. Create users, roles, permissions, role_permissions tables
2. Seed default roles
3. Seed default permissions
4. Assign all permissions to Super Admin role
5. Create initial Super Admin user from existing .env credentials
6. Update adminAuth middleware to use RBAC
7. Add permission checks to all routes

---

## Acceptance Criteria

- [ ] All RBAC tables created
- [ ] Default roles seeded (6 roles)
- [ ] Default permissions seeded (~30 permissions)
- [ ] Role-permission mappings created
- [ ] Initial Super Admin user created from .env
- [ ] Auth middleware updated to use RBAC
- [ ] Permission checks added to all admin routes
- [ ] API: `GET /api/admin/users` (list users)
- [ ] API: `POST /api/admin/users` (create user)
- [ ] API: `PUT /api/admin/users/:id` (update user)
- [ ] API: `DELETE /api/admin/users/:id` (deactivate user)
- [ ] API: `GET /api/admin/roles` (list roles)
- [ ] API: `GET /api/admin/permissions` (list permissions)
- [ ] Tests pass

---

## Dependencies

- mventor-ticket-021 (Database Schema Redesign)

---

## Notes

- Every action requires permissions
- Never trust the frontend
- Always validate permissions on the backend
- Backward compatible: existing admin login still works during migration
