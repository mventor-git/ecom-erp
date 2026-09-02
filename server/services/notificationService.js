/**
 * Notification Service â€” Process rules, send via multiple channels, log results.
 *
 * Channels: email, in_app, webhook
 * Tables: notification_rules, notifications, in_app_notifications
 */

const db = require('../db');
const email = require('../email');
const channels = require('./notificationChannels');

// Register the concrete senders into the channel registry (mventor-ticket-052 / STEP 9)
channels.registerChannel('dashboard', async ({ userId, title, message, link }) => {
  await sendInApp(userId, title, message, link);
});
channels.registerChannel('email', async ({ to, subject, body }) => {
  const ok = await sendEmail(to, subject, body);
  if (!ok) throw new Error('Email send returned false');
});
channels.registerChannel('webhook', async ({ url, eventType, eventData }) => {
  await sendWebhook(url, { event_type: eventType, event_data: eventData });
});

// Push channel: sends to all registered device tokens of a customer via the Expo push service.
// `recipient` for a push rule is the customer/user id (the app registers tokens via /api/v1/notifications/register).
channels.registerChannel('push', async ({ to, subject, body }) => {
  await sendPush(to, subject, body);
});

// Map rule.channel values to payload shapes for the registry
function channelPayload(rule, recipient, subject, body, eventType, eventData) {
  switch (rule.channel) {
    case 'email':
      return { to: recipient, subject, body };
    case 'in_app':
      return { userId: parseInt(recipient), title: subject, message: body, link: (rule.template ? JSON.parse(rule.template).link : null) || null };
    case 'webhook':
      return { url: recipient, eventType, eventData };
    case 'push':
    case 'sms':
    case 'whatsapp':
      return { to: recipient, subject, body, userId: parseInt(recipient) };
    default:
      return null;
  }
}

async function process(eventType, eventData = {}) {
  const rules = db.prepare(`
    SELECT * FROM notification_rules
    WHERE event_type = ? AND is_active = 1
  `).all(eventType);

  if (!rules.length) return { sent: 0, rules: 0 };

  let sent = 0;

  for (const rule of rules) {
    try {
      const recipient = resolveRecipient(rule, eventData);
      if (!recipient) continue;

      const subject = interpolate(rule.template ? JSON.parse(rule.template).subject || '' : '', eventData);
      const body = interpolate(rule.template ? JSON.parse(rule.template).body || '' : '', eventData);

      let status = 'sent';
      let error = null;

      // Route through the channel registry (configurable, future-proof)
      const payload = channelPayload(rule, recipient, subject, body, eventType, eventData);
      if (!payload) {
        status = 'failed';
        error = `Unknown channel: ${rule.channel}`;
      } else {
        const result = await channels.dispatch(rule.channel, payload);
        if (!result.sent) {
          status = 'failed';
          error = result.reason || 'Channel failed';
        }
      }

      db.prepare(`
        INSERT INTO notifications (rule_id, channel, recipient, subject, body, status, sent_at, error)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(rule.id, rule.channel, recipient, subject, body, status, status === 'sent' ? new Date().toISOString() : null, error);

      if (status === 'sent') sent++;
    } catch (err) {
      console.error(`[notification] Rule ${rule.id} failed:`, err.message);
      db.prepare(`
        INSERT INTO notifications (rule_id, channel, recipient, subject, body, status, error)
        VALUES (?, ?, ?, ?, ?, 'failed', ?)
      `).run(rule.id, rule.channel, rule.recipient_value || '', '', '', err.message);
    }
  }

  return { sent, rules: rules.length };
}

function resolveRecipient(rule, eventData) {
  if (rule.recipient_type === 'static') return rule.recipient_value;
  if (rule.recipient_type === 'event_field') return eventData[rule.recipient_value] || null;
  if (rule.recipient_type === 'user_id') return eventData[rule.recipient_value] || rule.recipient_value;
  return rule.recipient_value;
}

function interpolate(template, data) {
  if (!template) return '';
  return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_, key) => {
    const keys = key.split('.');
    let val = data;
    for (const k of keys) {
      val = val?.[k];
      if (val === undefined) return '';
    }
    return val ?? '';
  });
}

async function sendEmail(to, subject, body) {
  return email.sendMail({ to, subject, html: body });
}

async function sendInApp(userId, title, message, link = null) {
  const result = db.prepare(`
    INSERT INTO in_app_notifications (user_id, title, message, link)
    VALUES (?, ?, ?, ?)
  `).run(userId, title, message, link);

  return db.prepare('SELECT * FROM in_app_notifications WHERE id = ?').get(result.lastInsertRowid);
}

async function sendWebhook(url, payload) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Webhook returned ${response.status}: ${response.statusText}`);
  }

  return { ok: true, status: response.status };
}

/**
 * Send a push notification to all device tokens registered for a customer.
 * Uses the Expo push service (works for both Expo Go and standalone builds).
 * Tokens that the service rejects are removed from device_tokens.
 */
async function sendPush(customerId, title, body) {
  const tokens = db.prepare(`
    SELECT id, device_token FROM device_tokens
    WHERE user_id = ? AND platform IN ('android', 'ios', 'expo')
  `).all(parseInt(customerId));

  if (!tokens.length) return { sent: 0 };

  const messages = tokens.map(t => ({
    to: t.device_token,
    title: title || '',
    body: body || '',
    sound: 'default',
    priority: 'high',
  }));

  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(messages),
  });

  if (!response.ok) {
    throw new Error(`Expo push service returned ${response.status}`);
  }

  const result = await response.json();

  // Remove tokens that the service rejects (invalid / unregistered)
  if (result.data) {
    result.data.forEach((entry, i) => {
      if (entry.status === 'error') {
        try {
          db.prepare('DELETE FROM device_tokens WHERE id = ?').run(tokens[i].id);
        } catch {}
      }
    });
  }

  return { sent: result.data ? result.data.filter(d => d.status === 'ok').length : 0 };
}

function getNotifications(filters = {}) {
  const {
    channel,
    status,
    ruleId,
    dateFrom,
    dateTo,
    limit = 50,
    offset = 0,
  } = filters;

  let sql = 'SELECT * FROM notifications WHERE 1=1';
  const params = [];

  if (channel) {
    sql += ' AND channel = ?';
    params.push(channel);
  }

  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }

  if (ruleId) {
    sql += ' AND rule_id = ?';
    params.push(ruleId);
  }

  if (dateFrom) {
    sql += ' AND created_at >= ?';
    params.push(dateFrom);
  }

  if (dateTo) {
    sql += ' AND created_at <= ?';
    params.push(dateTo);
  }

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  return db.prepare(sql).all(...params);
}

function getInAppNotifications(userId) {
  return db.prepare(`
    SELECT * FROM in_app_notifications
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 100
  `).all(userId);
}

function markAsRead(notificationId) {
  return db.prepare(`
    UPDATE in_app_notifications SET is_read = 1 WHERE id = ?
  `).run(notificationId);
}

function getRules(filters = {}) {
  const { eventType, channel, isActive } = filters;

  let sql = 'SELECT * FROM notification_rules WHERE 1=1';
  const params = [];

  if (eventType) {
    sql += ' AND event_type = ?';
    params.push(eventType);
  }

  if (channel) {
    sql += ' AND channel = ?';
    params.push(channel);
  }

  if (isActive !== undefined) {
    sql += ' AND is_active = ?';
    params.push(isActive ? 1 : 0);
  }

  sql += ' ORDER BY created_at DESC';

  return db.prepare(sql).all(...params);
}

function createRule(data) {
  const { name, event_type, channel, recipient_type, recipient_value, template, is_active = 1 } = data;
  const templateStr = typeof template === 'string' ? template : JSON.stringify(template || {});

  const result = db.prepare(`
    INSERT INTO notification_rules (name, event_type, channel, recipient_type, recipient_value, template, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(name, event_type, channel, recipient_type, recipient_value || null, templateStr, is_active);

  return db.prepare('SELECT * FROM notification_rules WHERE id = ?').get(result.lastInsertRowid);
}

function updateRule(id, data) {
  const fields = [];
  const params = [];

  if (data.name !== undefined) { fields.push('name = ?'); params.push(data.name); }
  if (data.event_type !== undefined) { fields.push('event_type = ?'); params.push(data.event_type); }
  if (data.channel !== undefined) { fields.push('channel = ?'); params.push(data.channel); }
  if (data.recipient_type !== undefined) { fields.push('recipient_type = ?'); params.push(data.recipient_type); }
  if (data.recipient_value !== undefined) { fields.push('recipient_value = ?'); params.push(data.recipient_value); }
  if (data.template !== undefined) {
    fields.push('template = ?');
    params.push(typeof data.template === 'string' ? data.template : JSON.stringify(data.template || {}));
  }
  if (data.is_active !== undefined) { fields.push('is_active = ?'); params.push(data.is_active ? 1 : 0); }

  if (!fields.length) return db.prepare('SELECT * FROM notification_rules WHERE id = ?').get(id);

  fields.push("updated_at = CURRENT_TIMESTAMP");
  params.push(id);

  db.prepare(`UPDATE notification_rules SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  return db.prepare('SELECT * FROM notification_rules WHERE id = ?').get(id);
}

function getRule(id) {
  return db.prepare('SELECT * FROM notification_rules WHERE id = ?').get(id);
}

function deleteRule(id) {
  return db.prepare('DELETE FROM notification_rules WHERE id = ?').run(id);
}

module.exports = {
  process,
  sendEmail,
  sendInApp,
  sendWebhook,
  sendPush,
  getNotifications,
  getInAppNotifications,
  markAsRead,
  getRules,
  getRule,
  createRule,
  updateRule,
  deleteRule,
};
