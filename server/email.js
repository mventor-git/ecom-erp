/**
 * Email Module — Nodemailer SMTP + SendGrid HTTP API integration.
 *
 * Configuration is read LIVE from the settings table (mventor-ticket-038) so the admin
 * can change mail settings from the admin panel at any time without a restart.
 * Falls back to environment variables when settings are empty.
 *
 * .env fallback vars:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM, ADMIN_EMAIL, STORE_NAME
 */
const nodemailer = require('nodemailer');
const settingsService = require('./services/settingsService');

// ── Configuration (live from settings, env fallback) ───────────

function getConfig() {
  return {
    provider: settingsService.get('mail_provider') || 'smtp',
    host: settingsService.get('mail_smtp_host') || process.env.SMTP_HOST || '',
    port: parseInt(settingsService.get('mail_smtp_port') || process.env.SMTP_PORT || '587', 10),
    user: settingsService.get('mail_smtp_user') || process.env.SMTP_USER || '',
    pass: settingsService.get('mail_smtp_pass') || process.env.SMTP_PASS || '',
    from: settingsService.get('mail_from') || process.env.MAIL_FROM || 'noreply@comfortsign.com',
    adminEmail: settingsService.get('mail_admin_email') || process.env.ADMIN_EMAIL || '',
    storeName: process.env.STORE_NAME || '(settingsService.siteIdentity().name)',
    sendgridApiKey: settingsService.get('sendgrid_api_key') || '',
    sendgridFromEmail: settingsService.get('sendgrid_from_email') || '',
  };
}

function isConfigured() {
  const c = getConfig();
  if (c.provider === 'sendgrid') {
    return !!(c.sendgridApiKey && (c.sendgridFromEmail || c.from));
  }
  return !!(c.host && c.user && c.pass);
}

let transporter = null;
let transporterConfigKey = '';

function getTransporter() {
  const c = getConfig();
  const key = JSON.stringify({ host: c.host, port: c.port, user: c.user, pass: c.pass });
  if (key !== transporterConfigKey) {
    transporter = null;
    transporterConfigKey = key;
  }
  if (!transporter && c.host && c.user && c.pass) {
    transporter = nodemailer.createTransport({
      host: c.host,
      port: c.port,
      secure: c.port === 465,
      auth: { user: c.user, pass: c.pass },
    });
  }
  return transporter;
}

// ── HTML Templates ────────────────────────────────────────────

function orderConfirmationHtml({ order, customerName, storeName }) {
  const itemsHtml = (order.items || [])
    .map(
      (item) => `
        <tr>
          <td style="padding:10px;border-bottom:1px solid #eee;">${escapeHtml(item.name || 'Item')}</td>
          <td style="padding:10px;border-bottom:1px solid #eee;text-align:center;">${item.qty || item.quantity || 1}</td>
          <td style="padding:10px;border-bottom:1px solid #eee;text-align:right;">$${formatPrice(item.price)}</td>
        </tr>`
    )
    .join('');

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#f6f6f6;margin:0;padding:20px;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;">
    <div style="background:#4f46e5;padding:24px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:24px;">Order Confirmed!</h1>
    </div>
    <div style="padding:24px;">
      <p style="color:#333;font-size:16px;">Hi ${escapeHtml(customerName || 'there')},</p>
      <p style="color:#555;">Thank you for your order! Here are the details:</p>

      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:4px 0;color:#666;">Order #</td><td style="text-align:right;font-weight:bold;">${order.id}</td></tr>
        <tr><td style="padding:4px 0;color:#666;">Date</td><td style="text-align:right;">${new Date(order.created_at || Date.now()).toLocaleDateString()}</td></tr>
        <tr><td style="padding:4px 0;color:#666;">Status</td><td style="text-align:right;color:#059669;font-weight:bold;">Paid</td></tr>
      </table>

      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <thead>
          <tr style="background:#f9fafb;">
            <th style="padding:10px;text-align:left;font-size:14px;color:#666;">Item</th>
            <th style="padding:10px;text-align:center;font-size:14px;color:#666;">Qty</th>
            <th style="padding:10px;text-align:right;font-size:14px;color:#666;">Price</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <div style="border-top:2px solid #4f46e5;padding:12px 0;text-align:right;font-size:18px;font-weight:bold;">
        Total: $${formatPrice(order.total / 100)}
      </div>

      <p style="color:#555;margin-top:24px;">You'll receive another notification when your order ships.</p>
      <p style="color:#555;">Thanks for shopping with ${escapeHtml(storeName)}!</p>
    </div>
  </div>
</body>
</html>`;
}

function adminNotificationHtml({ order, customerName, customerEmail, storeName }) {
  const itemsHtml = (order.items || [])
    .map(
      (item) =>
        `<tr><td style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(item.name || 'Item')}</td>
         <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${item.qty || item.quantity || 1}</td>
         <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">$${formatPrice(item.price)}</td></tr>`
    )
    .join('');

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#f6f6f6;margin:0;padding:20px;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;">
    <div style="background:#059669;padding:24px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:24px;">New Order Received!</h1>
    </div>
    <div style="padding:24px;">
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:4px 0;color:#666;">Order #</td><td style="text-align:right;font-weight:bold;">${order.id}</td></tr>
        <tr><td style="padding:4px 0;color:#666;">Customer</td><td style="text-align:right;">${escapeHtml(customerName || 'N/A')}</td></tr>
        <tr><td style="padding:4px 0;color:#666;">Email</td><td style="text-align:right;">${escapeHtml(customerEmail || 'N/A')}</td></tr>
        <tr><td style="padding:4px 0;color:#666;">Date</td><td style="text-align:right;">${new Date(order.created_at || Date.now()).toLocaleDateString()}</td></tr>
        <tr><td style="padding:4px 0;color:#666;">Status</td><td style="text-align:right;color:#059669;font-weight:bold;">Paid</td></tr>
      </table>

      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <thead><tr style="background:#f9fafb;">
          <th style="padding:8px;text-align:left;font-size:14px;color:#666;">Item</th>
          <th style="padding:8px;text-align:center;font-size:14px;color:#666;">Qty</th>
          <th style="padding:8px;text-align:right;font-size:14px;color:#666;">Price</th>
        </tr></thead>
        <tbody>${itemsHtml}</tbody>
      </table>

      <div style="border-top:2px solid #059669;padding:12px 0;text-align:right;font-size:18px;font-weight:bold;">
        Total: $${formatPrice(order.total / 100)}
      </div>

      <p style="color:#555;margin-top:16px;">
        <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/admin/dashboard" style="color:#4f46e5;">View in Admin Dashboard →</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

// ── Helper ────────────────────────────────────────────────────

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatPrice(price) {
  return Number(price || 0).toFixed(2);
}

// ── Send Functions ────────────────────────────────────────────

/**
 * Send an email using the configured provider (SendGrid HTTP API or SMTP).
 * Gracefully degrades (logs instead of sends) if no provider is configured.
 * @param {object} options - { to, subject, html }
 * @returns {Promise<boolean>} true if sent, false if logged/failed
 */
async function sendMail({ to, subject, html }) {
  if (!to) return false;

  const c = getConfig();

  // SendGrid HTTP API provider
  if (c.provider === 'sendgrid' && c.sendgridApiKey) {
    try {
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${c.sendgridApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }], subject }],
          from: { email: c.sendgridFromEmail || c.from },
          content: [{ type: 'text/html', value: html }],
        }),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        console.error(`[email] SENDGRID FAILED to=${to} subject="${subject}": ${response.status} ${errText.slice(0, 300)}`);
        return false;
      }

      console.log(`[email] SENDGRID SENT to=${to} subject="${subject}" status=${response.status}`);
      return true;
    } catch (err) {
      console.error(`[email] SENDGRID ERROR to=${to} subject="${subject}":`, err.message);
      return false;
    }
  }

  // SMTP provider
  if (!(c.host && c.user && c.pass)) {
    console.log(`[email] SKIPPED (no SMTP config): To=${to} Subject="${subject}"`);
    return false;
  }

  try {
    const t = getTransporter();
    const info = await t.sendMail({
      from: `"${c.storeName}" <${c.from}>`,
      to,
      subject,
      html,
    });
    console.log(`[email] SENT to=${to} subject="${subject}" msgId=${info.messageId}`);
    return true;
  } catch (err) {
    console.error(`[email] FAILED to=${to} subject="${subject}":`, err.message);
    return false;
  }
}

/**
 * Send order confirmation email to the customer.
 * @param {object} order - order object with id, total, items, etc.
 * @param {string} customerEmail
 * @param {string} customerName
 */
async function sendOrderConfirmation(order, customerEmail, customerName) {
  const c = getConfig();
  const html = orderConfirmationHtml({
    order,
    customerName,
    storeName: c.storeName,
  });
  return sendMail({
    to: customerEmail,
    subject: `Order Confirmed #${order.id} — ${c.storeName}`,
    html,
  });
}

/**
 * Send new-order notification to the store admin.
 * @param {object} order
 * @param {string} customerEmail
 * @param {string} customerName
 */
async function sendAdminNotification(order, customerEmail, customerName) {
  const c = getConfig();
  if (!c.adminEmail) {
    console.log('[email] SKIPPED admin notification: admin email not set (settings mail_admin_email or env ADMIN_EMAIL)');
    return false;
  }
  const html = adminNotificationHtml({
    order,
    customerName,
    customerEmail,
    storeName: c.storeName,
  });
  return sendMail({
    to: c.adminEmail,
    subject: `New Order #${order.id} — ${c.storeName}`,
    html,
  });
}

module.exports = {
  sendOrderConfirmation,
  sendAdminNotification,
  sendMail,
  isConfigured,
};