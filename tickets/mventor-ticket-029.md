# mventor-ticket-029: Notification Engine

**Status:** Planned
**Priority:** Medium
**Phase:** ERP Core
**Created:** 2026-07-28
**Author:** CODEX

---

## Objective

Implement a rule-driven notification engine that supports multiple channels (email, SMS, push, in-app, webhooks). Notifications are driven by rules, not hardcoded.

---

## Current State

- Basic email notifications via Nodemailer (order confirmation only)
- No notification rules
- No multi-channel support
- No in-app notifications

---

## Target State

### Notification Tables

```sql
CREATE TABLE notification_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  event_type TEXT NOT NULL, -- triggers on this event
  channel TEXT NOT NULL, -- email, sms, push, in_app, webhook
  recipient_type TEXT NOT NULL, -- user, role, specific_email, webhook_url
  recipient_value TEXT, -- email address, role name, webhook URL
  template TEXT, -- notification template
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_id INTEGER REFERENCES notification_rules(id),
  channel TEXT NOT NULL,
  recipient TEXT NOT NULL,
  subject TEXT,
  body TEXT,
  status TEXT DEFAULT 'pending', -- pending, sent, failed
  sent_at DATETIME,
  error TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE in_app_notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  is_read INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Notification Channels

| Channel | Implementation |
|---------|---------------|
| Email | Nodemailer (existing) |
| SMS | Twilio / configurable provider |
| Push | Web Push API |
| In-App | Database + WebSocket |
| Webhook | HTTP POST to URL |

### Rule-Driven

```javascript
// When event is emitted â†’ check notification rules â†’ send notifications
eventService.on('low_stock_alert', (event) => {
  notificationEngine.process('low_stock_alert', event);
});
```

---

## Acceptance Criteria

- [ ] Notification rules table created
- [ ] Notifications log table created
- [ ] In-app notifications table created
- [ ] Notification engine service implemented
- [ ] Email channel working (existing Nodemailer)
- [ ] In-app channel working
- [ ] Webhook channel working
- [ ] Rules linked to events (mventor-ticket-022)
- [ ] API: `GET /api/admin/notifications` (list)
- [ ] API: `GET /api/admin/notifications/rules` (list rules)
- [ ] API: `POST /api/admin/notifications/rules` (create rule)
- [ ] API: `PUT /api/admin/notifications/rules/:id` (update rule)
- [ ] API: `GET /api/admin/notifications/in-app` (in-app list)
- [ ] API: `PUT /api/admin/notifications/in-app/:id/read` (mark read)
- [ ] Admin UI: Notification rules page
- [ ] Admin UI: In-app notification bell
- [ ] Tests pass

---

## Dependencies

- mventor-ticket-022 (Event System)
- mventor-ticket-023 (RBAC â€” for user targeting)

---

## Notes

- Notifications are driven by rules, not hardcoded
- Everything can generate notifications
- In-app notifications need real-time delivery (WebSocket or polling)
- SMS and Push can be added later as channels
