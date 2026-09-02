# mventor-ticket-031: Settings & Configuration Engine

**Status:** Planned
**Priority:** Medium
**Phase:** ERP Core
**Created:** 2026-07-28
**Author:** CODEX

---

## Objective

Implement a centralized settings engine where every configurable value lives. Never hardcode settings.

---

## Current State

- Settings scattered across .env files
- Some hardcoded values in code
- No admin UI for configuration
- No way to change settings without code deployment

---

## Target State

### Settings Table

```sql
CREATE TABLE settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  value TEXT,
  type TEXT DEFAULT 'string', -- string, number, boolean, json
  category TEXT DEFAULT 'general',
  description TEXT,
  is_public INTEGER DEFAULT 0, -- visible to non-admin?
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_by TEXT
);
```

### Setting Categories

| Category | Settings |
|----------|----------|
| **General** | Store name, currency, timezone, language |
| **Inventory** | Default warehouse, low stock threshold, reservation timeout |
| **Orders** | Auto-confirm orders, order prefix, cancellation window |
| **Delivery** | Auto-confirmation days, default delivery partner |
| **Notifications** | Email enabled, SMS enabled, webhook URLs |
| **Documents** | Numbering format per document type |
| **Security** | Session timeout, password policy, 2FA enabled |
| **Appearance** | Theme, logo, favicon |

### Settings Service

```javascript
// server/services/settingsService.js
const settingsService = {
  get(key, defaultValue = null) {
    // Get setting value (with cache)
  },
  
  set(key, value, userId) {
    // Update setting value
    // Emit event
    // Invalidate cache
  },
  
  getByCategory(category) {
    // Get all settings in category
  },
  
  getAll() {
    // Get all settings (admin only)
  }
};
```

---

## Acceptance Criteria

- [ ] Settings table created
- [ ] Default settings seeded
- [ ] Settings service implemented (get, set, getByCategory)
- [ ] In-memory cache for settings
- [ ] API: `GET /api/admin/settings` (all settings)
- [ ] API: `GET /api/admin/settings/:category` (by category)
- [ ] API: `PUT /api/admin/settings` (bulk update)
- [ ] API: `GET /api/settings/public` (public settings only)
- [ ] Admin UI: Settings page with tabs per category
- [ ] Settings integrated throughout the app (replace hardcoded values)
- [ ] Tests pass

---

## Dependencies

- mventor-ticket-021 (Database Schema Redesign)
- mventor-ticket-023 (RBAC â€” for settings access control)

---

## Notes

- Every configurable value belongs in Settings
- Never hardcode settings
- Settings changes should emit events
- Public settings accessible without admin auth (e.g., store name, currency)
