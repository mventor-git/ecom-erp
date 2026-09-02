/**
 * Input validation and sanitization helpers.
 */

// ── Sanitization ──

function sanitizeString(str, maxLength = 500) {
  if (typeof str !== 'string') return '';
  return str.trim().slice(0, maxLength);
}

function sanitizeEmail(email) {
  if (typeof email !== 'string') return '';
  return email.trim().toLowerCase().slice(0, 254);
}

function sanitizePrice(price) {
  const n = parseFloat(price);
  if (isNaN(n) || n < 0) return null;
  return Math.round(n * 100) / 100; // round to 2 decimals
}

function sanitizeInt(val, min, max) {
  const n = parseInt(val, 10);
  if (isNaN(n)) return null;
  if (min !== undefined && n < min) return null;
  if (max !== undefined && n > max) return null;
  return n;
}

function sanitizeBoolean(val) {
  if (val === true || val === 'true' || val === 1 || val === '1') return true;
  if (val === false || val === 'false' || val === 0 || val === '0') return false;
  return null;
}

// ── Product Validation ──

function validateProduct(body) {
  const errors = [];

  const name = sanitizeString(body.name, 200);
  if (!name) errors.push('Product name is required (max 200 chars)');

  const description = sanitizeString(body.description, 5000);

  // Wholesale-first model: retail `price` may be omitted when a wholesale
  // `cost_price` is given — the Pricing Engine derives retail from cost.
  const cost_price = sanitizePrice(body.cost_price);
  const price = sanitizePrice(body.price);
  if (price === null && cost_price === null) {
    errors.push('Provide a retail price or a wholesale cost_price');
  }
  if (price !== null && price === 0) errors.push('Price must be greater than 0');

  const category_id = sanitizeInt(body.category_id, 1);
  if (category_id === null) errors.push('Valid category_id is required');

  const image_url = sanitizeString(body.image_url, 1000);
  const stock = sanitizeInt(body.stock, 0, 999999) || 0;
  const brand_id = sanitizeInt(body.brand_id, 1) || null;

  return {
    valid: errors.length === 0,
    errors,
    data: { name, description, price, cost_price, category_id, image_url, stock, brand_id },
  };
}

// ── Login Validation ──

function validateLogin(body) {
  const errors = [];
  const username = sanitizeString(body.username, 100);
  const password = sanitizeString(body.password, 200);

  if (!username) errors.push('Username is required');
  if (!password) errors.push('Password is required');

  return {
    valid: errors.length === 0,
    errors,
    data: { username, password },
  };
}

// ── Order Status Validation ──
// Statuses are configurable (settings `order_statuses`); legacy statuses remain
// valid when the full order flow is disabled — backward compatible.

const VALID_STATUSES = ['pending', 'paid', 'shipped', 'cancelled'];

function getValidOrderStatuses() {
  try {
    const settingsService = require('./services/settingsService');
    const flowEnabled = !!settingsService.get('order_flow_enabled', false);
    if (flowEnabled) {
      const configured = settingsService.get('order_statuses', null);
      if (Array.isArray(configured) && configured.length > 0) return configured;
    }
  } catch {
    // settings not ready — fall back to legacy
  }
  return VALID_STATUSES;
}

function validateOrderStatus(body) {
  const errors = [];
  const status = sanitizeString(body.status, 30).toLowerCase();

  if (!getValidOrderStatuses().includes(status)) {
    errors.push(`Invalid status. Must be one of: ${getValidOrderStatuses().join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    data: { status },
  };
}

module.exports = {
  sanitizeString,
  sanitizeEmail,
  sanitizePrice,
  sanitizeInt,
  sanitizeBoolean,
  validateProduct,
  validateLogin,
  validateOrderStatus,
  VALID_STATUSES,
};
