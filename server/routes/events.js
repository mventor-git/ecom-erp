const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const { requirePermission } = require('../middleware/rbac');
const eventService = require('../services/eventService');

// GET /api/admin/events - List all events (with filters)
router.get('/', adminAuth, requirePermission('reports.read'), (req, res) => {
  try {
    const {
      entity_type,
      entity_id,
      event_type,
      user_id,
      date_from,
      date_to,
      limit = 50,
      offset = 0,
    } = req.query;

    const events = eventService.getAll({
      entityType: entity_type,
      entityId: entity_id ? parseInt(entity_id) : undefined,
      eventType: event_type,
      userId: user_id,
      dateFrom: date_from,
      dateTo: date_to,
      limit: Math.min(parseInt(limit) || 50, 200),
      offset: parseInt(offset) || 0,
    });

    // Parse JSON fields
    events.forEach(event => {
      try { event.payload = JSON.parse(event.payload || '{}'); } catch { event.payload = {}; }
      try { event.metadata = JSON.parse(event.metadata || '{}'); } catch { event.metadata = {}; }
    });

    res.json(events);
  } catch (err) {
    console.error('Error fetching events:', err);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// GET /api/admin/events/timeline/:entityType/:entityId - Get timeline for entity
router.get('/timeline/:entityType/:entityId', adminAuth, requirePermission('reports.read'), (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const events = eventService.getTimeline(entityType, parseInt(entityId), {
      limit: Math.min(parseInt(limit) || 50, 200),
      offset: parseInt(offset) || 0,
    });

    // Parse JSON fields
    events.forEach(event => {
      try { event.payload = JSON.parse(event.payload || '{}'); } catch { event.payload = {}; }
      try { event.metadata = JSON.parse(event.metadata || '{}'); } catch { event.metadata = {}; }
    });

    res.json(events);
  } catch (err) {
    console.error('Error fetching timeline:', err);
    res.status(500).json({ error: 'Failed to fetch timeline' });
  }
});

// GET /api/admin/events/type/:eventType - Get events by type
router.get('/type/:eventType', adminAuth, requirePermission('reports.read'), (req, res) => {
  try {
    const { eventType } = req.params;
    const {
      entity_type,
      user_id,
      date_from,
      date_to,
      limit = 50,
      offset = 0,
    } = req.query;

    const events = eventService.getByType(eventType, {
      entityType: entity_type,
      userId: user_id,
      dateFrom: date_from,
      dateTo: date_to,
      limit: Math.min(parseInt(limit) || 50, 200),
      offset: parseInt(offset) || 0,
    });

    // Parse JSON fields
    events.forEach(event => {
      try { event.payload = JSON.parse(event.payload || '{}'); } catch { event.payload = {}; }
      try { event.metadata = JSON.parse(event.metadata || '{}'); } catch { event.metadata = {}; }
    });

    res.json(events);
  } catch (err) {
    console.error('Error fetching events by type:', err);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// GET /api/admin/events/counts - Get event counts by type
router.get('/counts', adminAuth, requirePermission('reports.read'), (req, res) => {
  try {
    const counts = eventService.getCounts();
    res.json(counts);
  } catch (err) {
    console.error('Error fetching event counts:', err);
    res.status(500).json({ error: 'Failed to fetch event counts' });
  }
});

// GET /api/admin/events/types - List all available event types
router.get('/types', adminAuth, requirePermission('reports.read'), (req, res) => {
  res.json(eventService.EVENT_TYPES);
});

module.exports = router;
