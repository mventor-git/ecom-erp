/**
 * Kashier Webhook endpoint (mventor-ticket-061)
 *
 * POST /api/kashier/webhook
 *
 * Pipeline:
 *   raw body preserved → signature verified (HMAC-SHA512, timing-safe)
 *   → event type identified → idempotency check → handler dispatched
 *   → 200 {received:true}  |  401 bad signature  |  400 malformed
 *
 * Configure this exact URL in the Kashier portal (Webhooks → Add endpoint).
 * Subscribe: transaction-success, trans-capture, trans-authorize,
 *            transaction-refund, trans-void, transaction-failed.
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const webhookService = require('../services/kashierWebhookService');
const settingsService = require('../services/settingsService');

router.post('/webhook', express.json({ type: '*/*' }), (req, res) => {
  // Resolve the webhook secret the SAME way the gateway resolves it —
  // kashierService.cfg() correctly splits the portal's combined
  // "<api_key>$<secret_key>" format. (Previously read only the
  // 'kashier_secret_key' setting, which is NOT populated when the combined
  // key is configured → every webhook was rejected with an empty secret.)
  let secret = process.env.KASHIER_SECRET_KEY || '';
  try { secret = require('../services/kashierService').cfg().secretKey || secret; } catch {}

  const signature = req.headers['signature']
    || req.headers['x-signature']
    || req.headers['kashier-signature'] || '';

  // 1) Verify authenticity against the RAW body
  if (!webhookService.verifySignature(req.rawBody || JSON.stringify(req.body), signature, secret)) {
    console.warn('[kashier-webhook] signature verification FAILED');
    return res.status(401).json({ received: false, error: 'Invalid signature' });
  }

  const payload = req.body || {};
  const eventType = payload.eventType || payload.event_type || payload.type || 'unknown';

  // 2) Idempotency — same event never processed twice
  const eKey = webhookService.eventKey({ ...payload, eventType });
  if (webhookService.isDuplicate(eKey)) {
    return res.status(200).json({ received: true, duplicate: true });
  }
  webhookService.recordEvent(eKey, eventType, payload);

  // 3) Dispatch to the mapped handler
  try {
    const handled = webhookService.routeEvent(eventType, payload);
    console.log(`[kashier-webhook] ${eventType} processed (${handled})`);
    res.status(200).json({ received: true, event: eventType });
  } catch (err) {
    console.error('[kashier-webhook] handler error:', err.message);
    // Unknown event types are acknowledged so Kashier stops retrying,
    // real processing failures return 500 to trigger redelivery.
    if (String(err.message).startsWith('Unhandled')) {
      return res.status(200).json({ received: true, ignored: err.message });
    }
    res.status(500).json({ received: false, error: 'Processing failed' });
  }
});

module.exports = router;
