const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const notificationService = require('../services/notificationService');

router.get('/', adminAuth, (req, res) => {
  try {
    const {
      channel,
      status,
      rule_id,
      date_from,
      date_to,
      limit = 50,
      offset = 0,
    } = req.query;

    const notifications = notificationService.getNotifications({
      channel,
      status,
      ruleId: rule_id ? parseInt(rule_id) : undefined,
      dateFrom: date_from,
      dateTo: date_to,
      limit: Math.min(parseInt(limit) || 50, 200),
      offset: parseInt(offset) || 0,
    });

    res.json(notifications);
  } catch (err) {
    console.error('Error fetching notifications:', err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

router.get('/rules', adminAuth, (req, res) => {
  try {
    const { event_type, channel, is_active } = req.query;
    const rules = notificationService.getRules({
      eventType: event_type,
      channel,
      isActive: is_active !== undefined ? is_active === '1' || is_active === 'true' : undefined,
    });
    res.json(rules);
  } catch (err) {
    console.error('Error fetching notification rules:', err);
    res.status(500).json({ error: 'Failed to fetch notification rules' });
  }
});

router.post('/rules', adminAuth, (req, res) => {
  try {
    const { name, event_type, channel, recipient_type, recipient_value, template, is_active } = req.body;

    if (!name || !event_type || !channel || !recipient_type) {
      return res.status(400).json({ error: 'name, event_type, channel, and recipient_type are required' });
    }

    const rule = notificationService.createRule({
      name,
      event_type,
      channel,
      recipient_type,
      recipient_value,
      template,
      is_active: is_active !== undefined ? is_active : 1,
    });

    if (rule.template) {
      try { rule.template = JSON.parse(rule.template); } catch {}
    }

    res.status(201).json(rule);
  } catch (err) {
    console.error('Error creating notification rule:', err);
    res.status(500).json({ error: 'Failed to create notification rule' });
  }
});

router.put('/rules/:id', adminAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = notificationService.getRule(id);
    if (!existing) return res.status(404).json({ error: 'Rule not found' });

    const rule = notificationService.updateRule(id, req.body);

    if (rule && rule.template) {
      try { rule.template = JSON.parse(rule.template); } catch {}
    }

    res.json(rule);
  } catch (err) {
    console.error('Error updating notification rule:', err);
    res.status(500).json({ error: 'Failed to update notification rule' });
  }
});

router.delete('/rules/:id', adminAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    notificationService.deleteRule(id);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting notification rule:', err);
    res.status(500).json({ error: 'Failed to delete notification rule' });
  }
});

router.get('/in-app', adminAuth, (req, res) => {
  try {
    const userId = req.session.userId || req.session.user?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const notifications = notificationService.getInAppNotifications(userId);
    res.json(notifications);
  } catch (err) {
    console.error('Error fetching in-app notifications:', err);
    res.status(500).json({ error: 'Failed to fetch in-app notifications' });
  }
});

router.put('/in-app/:id/read', adminAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    notificationService.markAsRead(id);
    res.json({ success: true });
  } catch (err) {
    console.error('Error marking notification as read:', err);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

module.exports = router;
