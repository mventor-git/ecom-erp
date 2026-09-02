/**
 * Webhook Service — Event-driven notifications for external systems.
 * 
 * Dispatches HTTP POST requests to registered webhook URLs when events occur.
 * Each payload is signed with HMAC-SHA256 for verification.
 * Failed deliveries are retried with exponential backoff (3 attempts).
 * 
 * mventor-ticket-035a
 */

const crypto = require('crypto');
const db = require('../db');

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 5000, 15000]; // 1s, 5s, 15s exponential backoff
const TIMEOUT_MS = 10000; // 10 second timeout per request

/**
 * Generate HMAC-SHA256 signature for a payload.
 * 
 * @param {string} payload - JSON string of the payload
 * @param {string} secret - Webhook secret key
 * @returns {string} Hex-encoded HMAC signature
 */
function generateSignature(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Verify a webhook signature (for recipients).
 * 
 * @param {string} payload - Raw JSON string
 * @param {string} signature - Signature from X-Webhook-Signature header
 * @param {string} secret - Webhook secret key
 * @returns {boolean} True if signature is valid
 */
function verifySignature(payload, signature, secret) {
  const expected = generateSignature(payload, secret);
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

/**
 * Get all active webhooks subscribed to a given event type.
 * 
 * @param {string} eventType - The event type to match
 * @returns {Array} Array of webhook records
 */
function getWebhooksForEvent(eventType) {
  const webhooks = db.prepare(`
    SELECT * FROM webhooks WHERE is_active = 1
  `).all();

  return webhooks.filter(wh => {
    try {
      const events = JSON.parse(wh.events);
      return events.includes(eventType) || events.includes('*');
    } catch {
      return false;
    }
  });
}

/**
 * Record a webhook delivery attempt.
 * 
 * @param {number} webhookId - Webhook ID
 * @param {string} eventType - Event type that triggered delivery
 * @param {string} payload - JSON payload string
 * @param {number|null} responseStatus - HTTP response status code
 * @param {string|null} responseBody - Response body (truncated)
 * @param {boolean} success - Whether delivery succeeded
 * @returns {object} The delivery record
 */
function recordDelivery(webhookId, eventType, payload, responseStatus, responseBody, success) {
  const result = db.prepare(`
    INSERT INTO webhook_deliveries (webhook_id, event_type, payload, response_status, response_body, success)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    webhookId,
    eventType,
    payload,
    responseStatus,
    responseBody ? responseBody.substring(0, 2000) : null,
    success ? 1 : 0
  );

  return db.prepare('SELECT * FROM webhook_deliveries WHERE id = ?').get(result.lastInsertRowid);
}

/**
 * Dispatch a webhook delivery with retry logic.
 * Uses native http/https modules to avoid external dependencies.
 * 
 * @param {object} webhook - Webhook record
 * @param {string} eventType - Event type
 * @param {object} payload - Event payload object
 */
async function dispatchWebhook(webhook, eventType, payload) {
  const payloadObj = {
    id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    event_type: eventType,
    created_at: new Date().toISOString(),
    data: payload,
  };

  const payloadStr = JSON.stringify(payloadObj);
  const signature = generateSignature(payloadStr, webhook.secret);

  let lastError = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const result = await makeRequest(webhook.url, payloadStr, signature, webhook.secret);
      
      recordDelivery(
        webhook.id,
        eventType,
        payloadStr,
        result.statusCode,
        result.body,
        result.statusCode >= 200 && result.statusCode < 300
      );

      if (result.statusCode >= 200 && result.statusCode < 300) {
        return; // Success — stop retrying
      }

      lastError = new Error(`HTTP ${result.statusCode}`);
    } catch (err) {
      lastError = err;

      recordDelivery(
        webhook.id,
        eventType,
        payloadStr,
        null,
        err.message,
        false
      );
    }

    // Wait before retry (except on last attempt)
    if (attempt < MAX_RETRIES - 1) {
      await sleep(RETRY_DELAYS[attempt]);
    }
  }

  console.error(`[webhookService] Failed to deliver to ${webhook.url} after ${MAX_RETRIES} attempts:`, lastError?.message);
}

/**
 * Make an HTTP/HTTPS POST request.
 * 
 * @param {string} url - Target URL
 * @param {string} body - JSON payload string
 * @param {string} signature - HMAC signature
 * @param {string} secret - Webhook secret (for headers)
 * @returns {Promise<{statusCode: number, body: string}>}
 */
function makeRequest(url, body, signature) {
  return new Promise((resolve, reject) => {
    try {
      const parsedUrl = new URL(url);
      const isHttps = parsedUrl.protocol === 'https:';
      const httpModule = isHttps ? require('https') : require('http');

      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': signature.substring(0, 16),
          'User-Agent': 'ComfortSign-Webhook/1.0',
        },
        timeout: TIMEOUT_MS,
      };

      const req = httpModule.request(options, (res) => {
        let responseBody = '';
        res.on('data', chunk => { responseBody += chunk; });
        res.on('end', () => {
          resolve({ statusCode: res.statusCode, body: responseBody });
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.write(body);
      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Dispatch an event to all matching webhooks.
 * Called by eventService after emitting an event.
 * 
 * @param {string} eventType - The event type
 * @param {object} payload - Event data
 */
async function dispatch(eventType, payload) {
  try {
    const webhooks = getWebhooksForEvent(eventType);
    
    if (webhooks.length === 0) return;

    // Dispatch all webhooks in parallel (fire-and-forget)
    const promises = webhooks.map(webhook =>
      dispatchWebhook(webhook, eventType, payload).catch(err => {
        console.error(`[webhookService] Dispatch error for webhook ${webhook.id}:`, err.message);
      })
    );

    // Don't await — fire and forget so event emission isn't blocked
    Promise.allSettled(promises);
  } catch (err) {
    console.error('[webhookService] Dispatch error:', err.message);
  }
}

/**
 * Get delivery history for a webhook.
 * 
 * @param {number} webhookId - Webhook ID
 * @param {object} options - Query options
 * @param {number} options.limit - Max records (default 50)
 * @param {number} options.offset - Offset (default 0)
 * @param {boolean} options.successOnly - Only successful deliveries
 * @returns {Array} Delivery records
 */
function getDeliveries(webhookId, options = {}) {
  const { limit = 50, offset = 0, successOnly = false } = options;

  let sql = 'SELECT * FROM webhook_deliveries WHERE webhook_id = ?';
  const params = [webhookId];

  if (successOnly) {
    sql += ' AND success = 1';
  }

  sql += ' ORDER BY delivered_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  return db.prepare(sql).all(...params);
}

/**
 * Get delivery stats for a webhook.
 * 
 * @param {number} webhookId - Webhook ID
 * @returns {object} Stats object
 */
function getDeliveryStats(webhookId) {
  const total = db.prepare(`
    SELECT COUNT(*) as count FROM webhook_deliveries WHERE webhook_id = ?
  `).get(webhookId);

  const success = db.prepare(`
    SELECT COUNT(*) as count FROM webhook_deliveries WHERE webhook_id = ? AND success = 1
  `).get(webhookId);

  const failed = db.prepare(`
    SELECT COUNT(*) as count FROM webhook_deliveries WHERE webhook_id = ? AND success = 0
  `).get(webhookId);

  return {
    total: total.count,
    successful: success.count,
    failed: failed.count,
    success_rate: total.count > 0 ? Math.round((success.count / total.count) * 100) : 0,
  };
}

/**
 * Sleep utility for retry delays.
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a new webhook registration.
 * 
 * @param {object} data - Webhook data
 * @param {string} data.url - Target URL (must be http/https, validated by routes)
 * @param {string} data.secret - HMAC-SHA256 signing secret
 * @param {string[]|string} data.events - Event types to subscribe to ('*' for all)
 * @param {number} data.is_active - 1 to activate immediately, 0 to create inactive
 * @returns {object} The created webhook record
 */
function createWebhook({ url, secret, events, is_active = 1 }) {
  const eventsJson = typeof events === 'string' ? events : JSON.stringify(events || ['*']);

  const result = db.prepare(`
    INSERT INTO webhooks (url, secret, events, is_active)
    VALUES (?, ?, ?, ?)
  `).run(url, secret, eventsJson, is_active ? 1 : 0);

  return db.prepare('SELECT * FROM webhooks WHERE id = ?').get(result.lastInsertRowid);
}

/**
 * List all webhooks (active and inactive).
 * 
 * @param {object} options - Query options
 * @param {boolean} options.onlyActive - Only return active webhooks
 * @returns {Array} Array of webhook records
 */
function getWebhooks(options = {}) {
  const { onlyActive = false } = options;

  let sql = 'SELECT * FROM webhooks';
  const params = [];

  if (onlyActive) {
    sql += ' WHERE is_active = 1';
  }

  sql += ' ORDER BY created_at DESC';
  return db.prepare(sql).all(...params);
}

/**
 * Get a single webhook by ID.
 * 
 * @param {number} id - Webhook ID
 * @returns {object|null} Webhook record or null
 */
function getWebhook(id) {
  return db.prepare('SELECT * FROM webhooks WHERE id = ?').get(id);
}

/**
 * Update a webhook (partial update of allowed fields).
 * 
 * @param {number} id - Webhook ID
 * @param {object} updates - Fields to update (url, secret, events, is_active)
 * @returns {object|null} Updated webhook record or null if not found
 */
function updateWebhook(id, updates) {
  const existing = getWebhook(id);
  if (!existing) return null;

  const allowed = ['url', 'secret', 'events', 'is_active'];
  const sets = [];
  const params = [];

  for (const key of allowed) {
    if (updates[key] !== undefined) {
      sets.push(`${key} = ?`);
      params.push(
        key === 'events'
          ? (typeof updates[key] === 'string' ? updates[key] : JSON.stringify(updates[key]))
          : updates[key]
      );
    }
  }

  if (sets.length > 0) {
    sets.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);
    db.prepare(`UPDATE webhooks SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  }

  return getWebhook(id);
}

/**
 * Deactivate a webhook (soft delete — ERP principle: never hard-delete documents).
 * 
 * @param {number} id - Webhook ID
 * @returns {object|null} Deactivated webhook record or null if not found
 */
function deactivateWebhook(id) {
  const existing = getWebhook(id);
  if (!existing) return null;

  db.prepare(`
    UPDATE webhooks SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(id);

  return getWebhook(id);
}

/**
 * Send a synthetic test event to a webhook.
 * Fire-and-forget: the delivery result is recorded in webhook_deliveries.
 * 
 * @param {number} webhookId - Webhook ID
 * @returns {object|null} The webhook record, or null if not found
 */
function sendTestEvent(webhookId) {
  const webhook = getWebhook(webhookId);
  if (!webhook) return null;

  const payload = {
    message: 'This is a test webhook event from ${require("./settingsService").siteIdentity().name}',
    webhook_id: webhookId,
    sent_at: new Date().toISOString(),
  };

  // Fire-and-forget — result is recorded in the deliveries log
  dispatchWebhook(webhook, 'test.event', payload).catch(err => {
    console.error(`[webhookService] Test event dispatch failed for webhook ${webhookId}:`, err.message);
  });

  return webhook;
}

module.exports = {
  dispatch,
  generateSignature,
  verifySignature,
  getWebhooksForEvent,
  getDeliveries,
  getDeliveryStats,
  recordDelivery,
  createWebhook,
  getWebhooks,
  getWebhook,
  updateWebhook,
  deactivateWebhook,
  sendTestEvent,
};
