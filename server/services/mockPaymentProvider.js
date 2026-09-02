/**
 * Mock Payment Provider Adapter (Phase 12 — BLOCKED until real Kashier verified)
 * Implements same interface as kashierService: createPayment, verifyPayment, handleWebhook, refundPayment.
 * This is a SAFETY/TEST adapter only — does NOT process real payments.
 * All responses are labeled MOCK; logging marks mock mode clearly.
 * Zero emoji; theme-consistent (AdminIcon icons, no external dependencies beyond existing server).
 */

function logMock(action, data) {
  console.log(`[MOCK-PAYMENT:${action}]`, JSON.stringify({ ...data, mock: true }));
}

exports.createPaymentSession = async ({ orderRef, amountCents, currency, customerEmail, redirectUrl, description }) => {
  logMock('create-session', { orderRef, amountCents, currency, redirectUrl });
  return {
    sessionId: `mock-${Date.now()}`,
    sessionUrl: redirectUrl || 'http://localhost:5174/checkout/success',
    status: 'mock_success',
    raw: { provider: 'mock', note: 'REAL KASHIER BLOCKED — USE ONLY FOR TESTING' },
  };
};

exports.verifyPayment = async (sessionId) => {
  logMock('verify', { sessionId });
  return { status: 'paid', sessionId, amount_cents: 100, currency: 'EGP', mock: true };
};

exports.handleWebhook = async (payload) => {
  logMock('webhook', payload);
  return { processed: true, idempotent: payload.id || payload.event_id || 'unknown', mock: true };
};

exports.refundPayment = async (sessionId, amount) => {
  logMock('refund', { sessionId, amount });
  return { refunded: true, sessionId, amount: amount || 100, mock: true };
};
