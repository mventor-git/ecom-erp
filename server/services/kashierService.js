/**
 * Kashier Gateway Service (mventor-ticket-061)
 * Payment Sessions API — https://developers.kashier.io/payment/payment-sessions
 *
 * Hosts:
 *   live: https://api.kashier.io      test: https://test-api.kashier.io
 *   hosted checkout page lives on https://payments.kashier.io/session/{id}
 *
 * Auth uses BOTH keys:  Authorization: <secret_key>   api-key: <api_key>
 * Kashier portal exposes them as one string: "<api_key>$<secret_key>".
 */

const db = require('../db');

function cfg() {
  const g = k => {
    try { return require('./settingsService').get(k, '') || ''; } catch { return ''; }
  };
  let apiKey = g('kashier_api_key');
  let secretKey = g('kashier_secret_key');
  // Accept the combined portal format "<api_key>$<secret_key>"
  if ((!apiKey || !secretKey) && apiKey.includes('$')) {
    const [a, ...rest] = apiKey.split('$');
    if (!apiKey.startsWith('$')) { apiKey = a; secretKey = rest.join('$'); }
  }
  const mode = g('kashier_mode') || 'test';
  return {
    merchantId: g('kashier_merchant_id'),
    apiKey,
    secretKey,
    mode,
    baseUrl: g('kashier_base_url') || (mode === 'test' ? 'https://test-api.kashier.io' : 'https://api.kashier.io'),
    paymentsHost: 'https://payments.kashier.io',
  };
}

function isConfigured() {
  const c = cfg();
  return !!(c.merchantId && c.apiKey && c.secretKey);
}

function headers() {
  const c = cfg();
  return {
    'Content-Type': 'application/json',
    Authorization: c.secretKey,
    'api-key': c.apiKey,
  };
}

/**
 * Create a hosted payment session.
 * @returns {{sessionId, sessionUrl, status, raw}}
 */
async function createPaymentSession({ orderRef, amountCents, currency = 'EGP', customerEmail = '', redirectUrl = '', webhookUrl = '', allowedMethods = 'card,wallet', description = '' }) {
  const c = cfg();
  if (!isConfigured()) throw new Error('Kashier is not configured (merchant id / api key / secret missing)');
  const amount = (amountCents / 100).toFixed(2);

  const body = {
    expireAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    maxFailureAttempts: 3,
    paymentType: 'credit',
    amount,
    currency,
    order: String(orderRef),
    merchantRedirect: redirectUrl || undefined,
    display: 'en',
    type: 'one-time',
    allowedMethods,
    defaultMethod: 'card',
    description: description || `Order ${orderRef}`,
    merchantId: c.merchantId,
    interactionSource: 'ECOMMERCE',
    enable3DS: true,
    customer: customerEmail ? { email: customerEmail, reference: String(orderRef) } : undefined,
  };
  if (webhookUrl) body.serverWebhook = webhookUrl;

  const res = await fetch(`${c.baseUrl}/v3/payment/sessions`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Kashier session failed (${res.status}): ${JSON.stringify(data).slice(0, 300)}`);
  }
  return {
    sessionId: data._id,
    sessionUrl: data.sessionUrl,
    status: data.status,
    raw: data,
  };
}

/** Fetch the latest payment result for a session. */
async function getSessionPayment(sessionId) {
  const c = cfg();
  const res = await fetch(`${c.baseUrl}/v3/payment/sessions/${sessionId}/payment`, {
    headers: { Authorization: c.secretKey },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Kashier session lookup failed (${res.status})`);
  return data;
}

module.exports = {
  cfg,
  isConfigured,
  createPaymentSession,
  getSessionPayment,
};
