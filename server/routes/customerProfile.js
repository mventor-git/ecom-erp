/**
 * Customer Profile + Phone Verification (mventor-ticket-053).
 * Onboarding flow after Google sign-in:
 *   1. Customer fills phone + address (Google Maps pin)
 *   2. OTP is generated and delivered (email now; SMS when a provider is registered)
 *   3. Customer enters the code â†’ becomes an "authorized customer" + notified
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../db');
const settingsService = require('../services/settingsService');
const notificationChannels = require('../services/notificationChannels');

const CODE_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;

function parseCustomer(row) {
  let googleProfile = {};
  try { googleProfile = JSON.parse(row.google_profile || '{}'); } catch { googleProfile = {}; }
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    avatar_url: row.avatar_url,
    phone: row.phone || '',
    address: row.address || '',
    city: row.city || '',
    governorate: row.governorate || '',
    latitude: row.latitude || null,
    longitude: row.longitude || null,
    google_id: row.google_id || '',
    google_profile: googleProfile,
    created_at: row.created_at,
    needs_onboarding: !(row.phone && row.address && row.city),
    is_verified: row.is_verified === 1,
    vip: !!row.vip,
    invite_name: row.invite_name || '',
  };
}

// GET /api/customer/status - onboarding + verification status (auth)
router.get('/status', isAuth, (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.user.id);
    if (!row) return res.status(404).json({ error: 'Customer not found' });
    res.json(parseCustomer(row));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/customer/profile - save phone + address (Google Maps pin) and start verification
router.post('/profile', isAuth, async (req, res) => {
  try {
    const { phone, address, city, governorate, latitude, longitude } = req.body || {};
    const phoneClean = String(phone || '').trim();
    if (!phoneClean) return res.status(400).json({ error: 'Phone number is required' });

    db.prepare(`
      UPDATE customers SET phone = ?, address = ?, city = ?, governorate = ?, latitude = ?, longitude = ?
      WHERE id = ?
    `).run(
      phoneClean,
      String(address || '').trim(),
      String(city || '').trim(),
      String(governorate || '').trim(),
      latitude ? Number(latitude) : 0,
      longitude ? Number(longitude) : 0,
      req.user.id
    );

    // mark previous verifications expired, generate a fresh OTP
    db.prepare("UPDATE customer_verifications SET status = 'expired' WHERE customer_id = ? AND status = 'pending'").run(req.user.id);
    const code = crypto.randomInt(100000, 999999).toString();
    const expires = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000).toISOString();
    db.prepare(`
      INSERT INTO customer_verifications (customer_id, phone, code, method, status, expires_at)
      VALUES (?, ?, ?, 'email', 'pending', ?)
    `).run(req.user.id, phoneClean, code, expires);

    await deliverCode(req.user, code, phoneClean);

    res.json({ success: true, needs_verification: true, expires_in_minutes: CODE_TTL_MINUTES });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/customer/verify - submit the OTP
router.post('/verify', isAuth, (req, res) => {
  try {
    const { code } = req.body || {};
    const codeClean = String(code || '').trim();
    if (!codeClean) return res.status(400).json({ error: 'Verification code is required' });

    const row = db.prepare(`
      SELECT * FROM customers WHERE id = ?
    `).get(req.user.id);
    if (!row) return res.status(404).json({ error: 'Customer not found' });

    const verification = db.prepare(`
      SELECT * FROM customer_verifications
      WHERE customer_id = ? AND status = 'pending'
      ORDER BY id DESC LIMIT 1
    `).get(req.user.id);

    if (!verification) return res.status(400).json({ error: 'No pending verification â€” request a new code' });
    if (new Date(verification.expires_at) < new Date()) {
      db.prepare("UPDATE customer_verifications SET status = 'expired' WHERE id = ?").run(verification.id);
      return res.status(400).json({ error: 'Code expired â€” request a new one' });
    }
    if (verification.attempts >= MAX_ATTEMPTS) {
      db.prepare("UPDATE customer_verifications SET status = 'expired' WHERE id = ?").run(verification.id);
      return res.status(400).json({ error: 'Too many attempts â€” request a new code' });
    }

    if (verification.code !== codeClean) {
      db.prepare('UPDATE customer_verifications SET attempts = attempts + 1 WHERE id = ?').run(verification.id);
      return res.status(400).json({ error: 'Incorrect code â€” please try again' });
    }

    db.prepare("UPDATE customer_verifications SET status = 'verified', verified_at = CURRENT_TIMESTAMP WHERE id = ?").run(verification.id);
    db.prepare('UPDATE customers SET is_verified = 1 WHERE id = ?').run(req.user.id);

    // notify: authorized customer
    notificationChannels.dispatch('dashboard', {
      userId: req.user.id,
      title: 'You are an authorized customer ðŸŽ‰',
      message: 'Your phone number has been verified. Welcome aboard!',
      link: '/account',
    }).catch(() => {});
    const email = require('../email');
    email.sendMail({
      to: row.email,
      subject: 'You are now an authorized customer',
      html: `<div style="font-family:Arial;max-width:520px;margin:auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
        <div style="background:#2563eb;padding:20px;text-align:center;color:#fff;"><h2 style="margin:0;">You are an authorized customer!</h2></div>
        <div style="padding:24px;"><p>Hi <b>${row.name || 'there'}</b>, your phone <b>${verification.phone}</b> has been verified. You can now enjoy the full ${settingsService.siteIdentity().name} experience.</p></div>
      </div>`,
    }).catch(() => {});

    const updated = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.user.id);
    res.json({ success: true, is_verified: true, customer: parseCustomer(updated) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/customer/verify/resend - send a new code
router.post('/verify/resend', isAuth, async (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.user.id);
    if (!row || !row.phone) return res.status(400).json({ error: 'Save your phone number first' });

    db.prepare("UPDATE customer_verifications SET status = 'expired' WHERE customer_id = ? AND status = 'pending'").run(req.user.id);
    const code = crypto.randomInt(100000, 999999).toString();
    const expires = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000).toISOString();
    db.prepare(`
      INSERT INTO customer_verifications (customer_id, phone, code, method, status, expires_at)
      VALUES (?, ?, ?, 'email', 'pending', ?)
    `).run(req.user.id, row.phone, code, expires);

    await deliverCode(row, code, row.phone);
    res.json({ success: true, expires_in_minutes: CODE_TTL_MINUTES });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/customer/maps-key - public Google Maps JS key (for the pin picker)
router.get('/maps-key', (req, res) => {
  try {
    res.json({ key: settingsService.get('google_maps_api_key') || '' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function deliverCode(customer, code, phone) {
  const row = customer;
  const siteName = settingsService.siteIdentity().name;
  // Prefer SMS when a provider is registered and enabled (future: Twilio/Vonage)
  const smsResult = await notificationChannels.dispatch('sms', {
    to: phone, subject: `${siteName} verification code`, body: `Your ${siteName} verification code is ${code}`,
  }).catch(() => ({ sent: false }));
  if (smsResult.sent) return { via: 'sms' };

  // Fallback: email the code
  const email = require('../email');
  const html = `<div style="font-family:Arial;max-width:520px;margin:auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
    <div style="background:#2563eb;padding:20px;text-align:center;color:#fff;"><h2 style="margin:0;">Your verification code</h2></div>
    <div style="padding:24px;text-align:center;">
      <p style="color:#555;">Hi ${row.name || 'there'}, your ${siteName} phone verification code is:</p>
      <div style="font-size:32px;font-weight:800;letter-spacing:6px;color:#1d4ed8;background:#eff6ff;border-radius:12px;padding:16px;margin:16px 0;">${code}</div>
      <p style="color:#999;font-size:12px;">This code expires in 10 minutes.</p>
    </div>
  </div>`;
  await email.sendMail({ to: row.email, subject: `${siteName} — phone verification code`, html }).catch(() => {});
  return { via: 'email' };
}

function isAuth(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) return next();
  return res.status(401).json({ error: 'Not authenticated' });
}

// ── VIP (mventor-ticket-060) ──

// POST /api/customer/claim-invite { code } — called after Google sign-in
// when the customer arrived via a VIP invitation QR/link.
router.post('/claim-invite', isAuth, (req, res) => {
  try {
    const vipService = require('../services/vipService');
    const inv = vipService.claimInvite(String(req.body?.code || ''), req.user.id);
    res.json({ success: true, invite_name: inv.invite_name });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/customer/vip-cart — the staff-managed cart for this VIP
router.get('/vip-cart', isAuth, (req, res) => {
  try {
    const vipService = require('../services/vipService');
    res.json(vipService.getVipCart(req.user.id));
  } catch (err) {
    res.status(500).json({ error: 'Failed to load VIP cart' });
  }
});

module.exports = router;
