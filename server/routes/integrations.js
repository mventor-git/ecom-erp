/**
 * API Integrations Management Routes (mventor-ticket-038)
 *
 * Admin panel management of external API integrations:
 * Mail (SMTP), SendGrid, Kashier, AI, Google Maps + custom keys.
 *
 * - GET  /api/admin/integrations   → grouped settings, secrets MASKED
 * - PUT  /api/admin/integrations   → batch save (blank secret = keep existing)
 * - POST /api/admin/integrations/test → live connectivity test
 */

const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const { requirePermission } = require('../middleware/rbac');
const settingsService = require('../services/settingsService');
const email = require('../email');
const nodemailer = require('nodemailer');

// Keys whose values are secrets — never returned in full, always masked.
const SECRET_KEYS = [
  'mail_smtp_user',
  'mail_smtp_pass',
  'sendgrid_api_key',
  'ai_api_key',
  'google_maps_api_key',
];

// Group definition: [groupName, [keys...]]
const GROUPS = {
  mail: ['mail_provider', 'mail_smtp_host', 'mail_smtp_port', 'mail_smtp_user', 'mail_smtp_pass', 'mail_from', 'mail_admin_email'],
  sendgrid: ['sendgrid_api_key', 'sendgrid_from_email'],
  ai: ['ai_provider', 'ai_base_url', 'ai_model', 'ai_api_key', 'ai_timeout'],
  google_maps: ['google_maps_api_key'],
};

function isSecret(key) {
  return SECRET_KEYS.includes(key);
}

function maskSecret(value) {
  if (!value) return '';
  const v = String(value);
  if (v.length <= 4) return '••••';
  return `${v.substring(0, 4)}••••${v.substring(v.length - 4)}`;
}

/**
 * GET /api/admin/integrations
 * Returns all integration settings grouped, with secrets masked.
 */
router.get('/', adminAuth, requirePermission('settings.read'), (req, res) => {
  try {
    const all = settingsService.getAll();
    const byKey = {};
    all.forEach(s => { byKey[s.key] = s; });

    const data = {};
    for (const [group, keys] of Object.entries(GROUPS)) {
      const fields = {};
      keys.forEach(key => {
        const row = byKey[key];
        if (!row) return;
        const raw = row.value;
        if (isSecret(key)) {
          fields[key] = {
            is_set: !!raw,
            masked: maskSecret(raw),
          };
        } else {
          fields[key] = settingsService.get(key);
        }
      });
      data[group] = fields;
    }

    // Custom API keys (JSON object)
    data.custom = settingsService.get('custom_api_keys') || {};

    res.json({ success: true, data });
  } catch (err) {
    console.error('Error fetching integrations:', err);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch integrations' } });
  }
});

/**
 * PUT /api/admin/integrations
 * Batch save. Body: { settings: [{ key, value }] }
 * - Secret key + empty string ''  → keep existing value (prevents accidental wipe)
 * - Secret key + null             → clear the value
 * - Non-secret key                → set as provided
 */
router.put('/', adminAuth, requirePermission('settings.manage'), (req, res) => {
  try {
    const { settings } = req.body;
    if (!Array.isArray(settings)) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'settings array is required' } });
    }

    const userId = req.session.userId || req.session.username || 'admin';
    const results = [];
    const errors = [];

    for (const { key, value } of settings) {
      try {
        if (isSecret(key)) {
          if (value === '' || value === undefined) continue; // keep existing
          if (value === null) {
            settingsService.set(key, '', userId); // clear
          } else {
            settingsService.set(key, String(value).trim(), userId);
          }
        } else {
          settingsService.set(key, value, userId);
        }
        results.push({ key, updated: true });
      } catch (err) {
        errors.push({ key, error: err.message });
      }
    }

    res.json({ success: true, updated: results, errors });
  } catch (err) {
    console.error('Error saving integrations:', err);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to save integrations' } });
  }
});

/**
 * POST /api/admin/integrations/test
 * Live connectivity test for a provider. Body: { provider, to? }
 * Providers: mail | sendgrid | kashier | ai | google_maps
 */
router.post('/test', adminAuth, requirePermission('settings.manage'), async (req, res) => {
  const { provider, to } = req.body || {};
  if (!provider) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'provider is required' } });
  }

  try {
    switch (provider) {
      case 'mail':
      case 'smtp':
        return res.json(await testSmtp(to));
      case 'sendgrid':
        return res.json(await testSendgrid(to));
      case 'ai':
        return res.json(await testAI());
      case 'google_maps':
        return res.json(await testGoogleMaps());
      default:
        return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: `Unknown provider: ${provider}` } });
    }
  } catch (err) {
    console.error(`Integration test (${provider}) error:`, err);
    res.json({ success: false, provider, message: 'Test failed with an unexpected error', detail: err.message });
  }
});

// ── Test implementations ───────────────────────────────────────

async function testSmtp(to) {
  const host = settingsService.get('mail_smtp_host');
  const user = settingsService.get('mail_smtp_user');
  const pass = settingsService.get('mail_smtp_pass');
  const port = parseInt(settingsService.get('mail_smtp_port') || '587', 10);

  if (!host || !user || !pass) {
    return { success: false, provider: 'mail', message: 'SMTP is not configured (host, user, pass required)' };
  }

  try {
    const transporter = nodemailer.createTransport({
      host, port, secure: port === 465,
      auth: { user, pass },
    });
    await transporter.verify();

    const recipient = to || settingsService.get('mail_admin_email') || user;
    const from = settingsService.get('mail_from') || 'noreply@comfortsign.com';
    await transporter.sendMail({
      from: `"${settingsService.siteIdentity().name}" <${from}>`,
      to: recipient,
      subject: `${settingsService.siteIdentity().name} — SMTP test`,
      html: '<p>If you received this email, your SMTP configuration works correctly.</p>',
    });

    return { success: true, provider: 'mail', message: `SMTP connection OK — test email sent to ${recipient}` };
  } catch (err) {
    return { success: false, provider: 'mail', message: `SMTP connection failed: ${err.message}` };
  }
}

async function testSendgrid(to) {
  const apiKey = settingsService.get('sendgrid_api_key');
  const from = settingsService.get('sendgrid_from_email') || settingsService.get('mail_from') || 'noreply@comfortsign.com';

  if (!apiKey) {
    return { success: false, provider: 'sendgrid', message: 'SendGrid API key is not configured' };
  }

  try {
    const recipient = to || settingsService.get('mail_admin_email') || 'admin@example.com';
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: recipient }], subject: 'Comfort Sign — SendGrid test' }],
        from: { email: from },
        content: [{ type: 'text/html', value: '<p>If you received this email, your SendGrid configuration works correctly.</p>' }],
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      return { success: false, provider: 'sendgrid', message: `SendGrid API error ${response.status}`, detail: body.slice(0, 300) };
    }

    return { success: true, provider: 'sendgrid', message: `SendGrid OK — test email sent to ${recipient}` };
  } catch (err) {
    return { success: false, provider: 'sendgrid', message: `SendGrid request failed: ${err.message}` };
  }
}



async function testAI() {
  const provider = settingsService.get('ai_provider') || 'ollama';
  const baseUrl = (settingsService.get('ai_base_url') || 'http://localhost:11434').replace(/\/$/, '');
  const apiKey = settingsService.get('ai_api_key') || '';

  try {
    if (provider === 'openai') {
      const response = await fetch(`${baseUrl}/v1/models`, {
        headers: { ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}) },
      });
      if (!response.ok) {
        const body = await response.text().catch(() => '');
        return { success: false, provider: 'ai', message: `AI API error ${response.status}`, detail: body.slice(0, 300) };
      }
      return { success: true, provider: 'ai', message: 'AI connection OK (OpenAI-compatible)' };
    }

    const response = await fetch(`${baseUrl}/api/tags`);
    if (!response.ok) {
      return { success: false, provider: 'ai', message: `Ollama error ${response.status} — is Ollama running at ${baseUrl}?` };
    }
    const data = await response.json().catch(() => ({}));
    const models = (data.models || []).map(m => m.name).slice(0, 5).join(', ');
    return { success: true, provider: 'ai', message: 'Ollama connection OK', detail: `Models: ${models || 'none listed'}` };
  } catch (err) {
    return { success: false, provider: 'ai', message: `AI connection failed: ${err.message}` };
  }
}

async function testGoogleMaps() {
  const apiKey = settingsService.get('google_maps_api_key');
  if (!apiKey) {
    return { success: false, provider: 'google_maps', message: 'Google Maps API key is not configured' };
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent('Cairo, Egypt')}&key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(url);
    const data = await response.json().catch(() => ({}));

    if (data.status === 'OK' || data.status === 'ZERO_RESULTS') {
      const result = data.results?.[0];
      return {
        success: true,
        provider: 'google_maps',
        message: 'Google Maps API key is valid',
        detail: result ? `Resolved: ${result.formatted_address}` : 'Geocoding API responded successfully',
      };
    }
    return { success: false, provider: 'google_maps', message: `Google Maps error: ${data.error_message || data.status}` };
  } catch (err) {
    return { success: false, provider: 'google_maps', message: `Google Maps request failed: ${err.message}` };
  }
}

module.exports = router;
