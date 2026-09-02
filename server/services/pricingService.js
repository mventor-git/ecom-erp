/**
 * Pricing Service — the wholesale→retail baseline (mventor-ticket-061).
 *
 * Business model:
 *   · Products enter through Warehouse → Catalog with a WHOLESALE price
 *     (products.cost_price) — that cost is the untouchable baseline.
 *   · RETAIL defaults to cost + `default_markup_percent` (setting, default 20%),
 *     rounded to a commercial .99 ending. That retail is what the customer
 *     website / mobile app / checkout all read from products.price.
 *   · OFFERS deduct an optional % FROM the current retail (retail stays the
 *     offer's baseline); old_price preserves the original so ribbons render.
 */

const db = require('../db');
const settingsService = require('./settingsService');

const SETTING_KEY = 'default_markup_percent';
const DEFAULT_MARKUP = 20;

/** Configurable markup over wholesale (Site Config → Storefront Pricing). */
function getDefaultMarkupPercent() {
  const v = Number(settingsService.get(SETTING_KEY, DEFAULT_MARKUP));
  return Number.isFinite(v) ? v : DEFAULT_MARKUP;
}

function setDefaultMarkupPercent(pct) {
  const n = Number(pct);
  if (!Number.isFinite(n) || n < -90 || n > 500) {
    throw new Error('Markup percent must be between -90 and 500');
  }
  settingsService.set(SETTING_KEY, n, 'pricing-engine');
  return n;
}

/**
 * Commercial .99 ending snapped to the NEAREST one:
 *   1 234 → 1 199 · 1 250 → 1 299 · 1 099 → 1 099 (already an ending)
 */
function charmEnding(cents) {
  if (cents < 100) return cents; // keep tiny prices exact
  const whole = Math.round((cents - 99) / 100);
  return Math.max(whole, 0) * 100 + 99;
}

/**
 * Derive retail (cents) from wholesale cost (cents) at the configured markup.
 * Guarded: result never drops below cost.
 */
function retailFromCost(costCents, pct = getDefaultMarkupPercent()) {
  const cost = Math.max(Number(costCents) || 0, 0);
  if (cost <= 0) return 0;
  const raw = cost * (1 + Number(pct || 0) / 100);
  const proposed = charmEnding(Math.round(raw));
  return Math.max(proposed, cost);
}

/**
 * Resolve the retail price for a new/updated product row:
 * explicit retail wins; otherwise derive from wholesale × default markup.
 * Returns { price, derived } in cents.
 */
function resolveRetail({ priceCents = 0, costCents = 0 }) {
  const price = Math.max(Math.round(Number(priceCents) || 0), 0);
  if (price > 0) return { price, derived: false };
  const derivedPrice = retailFromCost(costCents);
  return { price: derivedPrice, derived: derivedPrice > 0 };
}

module.exports = {
  SETTING_KEY,
  DEFAULT_MARKUP,
  getDefaultMarkupPercent,
  setDefaultMarkupPercent,
  charmEnding,
  retailFromCost,
  resolveRetail,
};
function tierDiscount(priceCents, tiers = []) { const best = tiers.filter(t => qty >= t.minQty).sort((a,b)=>b.pct - a.pct)[0]; return best ? Math.round(priceCents * (1 - best.pct/100)) : priceCents; }
