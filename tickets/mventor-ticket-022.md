# mventor-ticket-022: Event System & Audit Trail

**Status:** Completed
**Priority:** Critical
**Phase:** ERP Core
**Created:** 2026-07-28
**Completed:** 2026-07-28
**Author:** CODEX

---

## Objective

Implement an immutable event system that captures every significant action in the platform. Events are the foundation for audit trails, timelines, notifications, and analytics.

---

## Current State

- No event tracking
- No audit trail for mutations
- Order status changes are silent
- No way to reconstruct "what happened and when"

---

## Target State

### New Table

```sql
CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL, -- order_created, order_approved, goods_issued, shipment_assigned, etc.
  entity_type TEXT NOT NULL, -- order, product, inventory, purchase_order, etc.
  entity_id INTEGER NOT NULL,
  user_id TEXT, -- who performed the action
  user_role TEXT,
  payload TEXT DEFAULT '{}', -- JSON: additional data
  metadata TEXT DEFAULT '{}', -- JSON: IP, user agent, timestamp, etc.
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast timeline queries
CREATE INDEX idx_events_entity ON events(entity_type, entity_id, created_at DESC);
CREATE INDEX idx_events_type ON events(event_type, created_at DESC);
```

### Event Types (Initial)

**Order Events:**
- `order_created`
- `order_paid`
- `order_shipped`
- `order_delivered`
- `order_cancelled`
- `order_refunded`

**Inventory Events:**
- `inventory_adjusted`
- `inventory_transferred`
- `inventory_counted`
- `low_stock_alert`
- `out_of_stock`

**Product Events:**
- `product_created`
- `product_updated`
- `product_deactivated`
- `product_deleted`

**User Events:**
- `user_login`
- `user_logout`
- `user_created`
- `user_updated`

---

## Implementation

### Event Service

```javascript
// server/services/eventService.js
const eventService = {
  emit(eventType, entityType, entityId, payload = {}, metadata = {}) {
    // Insert immutable event record
    // Trigger notification rules
    // Update analytics
  },
  
  getTimeline(entityType, entityId) {
    // Return chronological events for entity
  },
  
  getByType(eventType, filters = {}) {
    // Query events by type with filters
  }
};
```

### Integration Points

- Order creation â†’ emit `order_created`
- Stripe webhook â†’ emit `order_paid`
- Admin status update â†’ emit `order_shipped`, `order_delivered`, etc.
- Inventory movement â†’ emit `inventory_adjusted`
- Product CRUD â†’ emit `product_created`, `product_updated`, etc.
- Admin login â†’ emit `user_login`

---

## Acceptance Criteria

- [ ] Events table created with proper indexes
- [ ] Event service implemented (emit, getTimeline, getByType)
- [ ] All order mutations emit events
- [ ] All inventory mutations emit events
- [ ] All product mutations emit events
- [ ] Admin login/logout emits events
- [ ] Timeline API endpoint: `GET /api/admin/events/:entityType/:entityId`
- [ ] Events are immutable (no UPDATE/DELETE allowed)
- [ ] Tests pass

---

## Dependencies

- mventor-ticket-021 (Database Schema Redesign) â€” for inventory events

---

## Notes

- Events are immutable â€” never fake history
- The Timeline is generated from events
- Events drive notifications (mventor-ticket-029)
- Events drive analytics (mventor-ticket-032)
