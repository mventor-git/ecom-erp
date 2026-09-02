/**
 * Webhook Management Routes (mventor-ticket-035a)
 * Mounted at /api/v1/webhooks â€” JWT-authenticated, staff-only.
 *
 * Endpoints:
 *   POST   /                 â€” Register a new webhook
 *   GET    /                 â€” List all webhooks
 *   GET    /:id              â€” Get webhook details
 *   PUT    /:id              â€” Update webhook
 *   DELETE /:id              â€” Deactivate webhook (soft delete)
 *   GET    /:id/deliveries   â€” Delivery history + stats
 *   POST   /:id/test         â€” Send a test event
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { authenticateToken } = require('../middleware/jwtAuth');
const webhookService = require('../services/webhookService');
const eventService = require('../services/eventService');

// Staff-only: webhook management is restricted to authenticated staff accounts
function requireStaff(req, res, next) {
  if (!req.user || req.user.role === 'customer') {
    return res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Staff access required' },
    });
  }
  next();
}

router.use(authenticateToken, requireStaff);

function isValidUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * POST /api/v1/webhooks â€” Register a new webhook
 * Body: { url, secret?, events?, is_active? }
 */
router.post('/', (req, res) => {
  try {
    const { url, secret, events, is_active } = req.body || {};

    if (!url || !isValidUrl(url)) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'A valid http(s) url is required' },
      });
    }

    // Auto-generate a secret if not provided
    const webhookSecret = secret || crypto.randomBytes(32).toString('hex');

    // Validate events: '*' or an array of strings
    let eventList = events;
    if (events === undefined || events === null) {
      eventList = ['*'];
    } else if (typeof events === 'string') {
      eventList = [events];
    } else if (!Array.isArray(events) || events.some(e => typeof e !== 'string')) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'events must be an array of strings or "*"' },
      });
    }

    const webhook = webhookService.createWebhook({
      url,
      secret: webhookSecret,
      events: eventList,
      is_active: is_active !== undefined ? is_active : 1,
    });

    eventService.emit(eventService.EVENT_TYPES.USER_UPDATED, 'webhook', webhook.id, {
      userId: req.user.id,
      userRole: req.user.role,
      payload: { action: 'webhook_created', url: webhook.url },
    });

    res.status(201).json({ success: true, data: webhook });
  } catch (err) {
    console.error('Create webhook error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create webhook' },
    });
  }
});

/**
 * GET /api/v1/webhooks â€” List all webhooks
 */
router.get('/', (req, res) => {
  try {
    const webhooks = webhookService.getWebhooks();
    res.json({ success: true, data: webhooks });
  } catch (err) {
    console.error('List webhooks error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to list webhooks' },
    });
  }
});

/**
 * GET /api/v1/webhooks/:id â€” Get webhook details
 */
router.get('/:id', (req, res) => {
  try {
    const webhook = webhookService.getWebhook(parseInt(req.params.id));
    if (!webhook) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Webhook not found' },
      });
    }
    res.json({ success: true, data: webhook });
  } catch (err) {
    console.error('Get webhook error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get webhook' },
    });
  }
});

/**
 * PUT /api/v1/webhooks/:id â€” Update webhook
 * Body: { url?, secret?, events?, is_active? }
 */
router.put('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updates = req.body || {};

    if (updates.url !== undefined && !isValidUrl(updates.url)) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'url must be a valid http(s) URL' },
      });
    }

    if (updates.events !== undefined) {
      if (typeof updates.events === 'string') {
        updates.events = [updates.events];
      } else if (!Array.isArray(updates.events) || updates.events.some(e => typeof e !== 'string')) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'events must be an array of strings or "*"' },
        });
      }
    }

    const webhook = webhookService.updateWebhook(id, updates);
    if (!webhook) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Webhook not found' },
      });
    }

    res.json({ success: true, data: webhook });
  } catch (err) {
    console.error('Update webhook error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update webhook' },
    });
  }
});

/**
 * DELETE /api/v1/webhooks/:id â€” Deactivate webhook (soft delete)
 */
router.delete('/:id', (req, res) => {
  try {
    const webhook = webhookService.deactivateWebhook(parseInt(req.params.id));
    if (!webhook) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Webhook not found' },
      });
    }
    res.json({ success: true, data: webhook });
  } catch (err) {
    console.error('Deactivate webhook error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to deactivate webhook' },
    });
  }
});

/**
 * GET /api/v1/webhooks/:id/deliveries â€” Delivery history + stats
 * Query: limit, offset, success_only
 */
router.get('/:id/deliveries', (req, res) => {
  try {
    const webhookId = parseInt(req.params.id);
    const webhook = webhookService.getWebhook(webhookId);
    if (!webhook) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Webhook not found' },
      });
    }

    const { limit = 50, offset = 0, success_only } = req.query;
    const deliveries = webhookService.getDeliveries(webhookId, {
      limit: Math.min(parseInt(limit) || 50, 200),
      offset: parseInt(offset) || 0,
      successOnly: success_only === '1' || success_only === 'true',
    });
    const stats = webhookService.getDeliveryStats(webhookId);

    res.json({ success: true, data: deliveries, stats });
  } catch (err) {
    console.error('Webhook deliveries error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get deliveries' },
    });
  }
});

/**
 * POST /api/v1/webhooks/:id/test â€” Send a test event
 */
router.post('/:id/test', (req, res) => {
  try {
    const webhook = webhookService.sendTestEvent(parseInt(req.params.id));
    if (!webhook) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Webhook not found' },
      });
    }

    res.json({
      success: true,
      message: 'Test event dispatched (async) â€” check deliveries for the result',
      data: { webhook_id: webhook.id },
    });
  } catch (err) {
    console.error('Webhook test error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to send test event' },
    });
  }
});

module.exports = router;
