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

/**
 * Canonical PricingEngine math — mventor-ticket-057.
 * Single server-authoritative preview used by routes/pricingManager.js
 * (preview + apply). Modes mirror the former inline logic verbatim:
 *   markup — value% on top of cost | margin — target margin on retail
 *   match — keep current, re-round only | offer — value% OFF current retail
 * Cost basis unification (057 follow-up, owner-confirmed): caller resolves
 * cost via valuation layers where present, else cost_price fallback —
 * see pricingManager.computeRows `cost_basis`/`cost_source`.
 * VIP (owner-confirmed): pure % off retail preview, labeled, never stored,
 * never gateway-paid. See vipPriceFromRetail.
 */
function roundPrice(centsValue, style) {
  if (!style || style === 'none') return centsValue;
  const whole = Math.floor(centsValue / 100);
  if (style === '99') return whole * 100 + 99;
  if (style === '95') return whole * 100 + 95;
  if (style === '5') return Math.max(Math.round(centsValue / 500) * 500, 500);
  if (style === '10') return Math.max(Math.round(centsValue / 1000) * 1000, 1000);
  return centsValue;
}

function computeRetailPreview({ costCents = 0, currentCents = 0, mode = 'markup', value = 0, rounding = 'none' } = {}) {
  const cost = Math.max(Math.round(Number(costCents) || 0), 0);
  const current = Math.max(Math.round(Number(currentCents) || 0), 0);
  const v = Number(value || 0);
  let raw;
  if (mode === 'margin') {
    const m = Math.min(Math.max(v, -90), 95) / 100;
    raw = m < 0.95 ? cost / (1 - m) : cost * 20;
  } else if (mode === 'match') {
    raw = current;
  } else if (mode === 'offer') {
    raw = current * (1 - Math.min(Math.max(v, 0), 90) / 100);
  } else {
    raw = cost * (1 + v / 100);
  }
  return Math.max(roundPrice(Math.round(raw), rounding), 5);
}

/**
 * VIP preview (owner-confirmed 057): percent OFF retail.
 * Pure derivation for display only — never written to products.price,
 * never represented as gateway-paid. Clamped 0–90%.
 */
function vipPriceFromRetail(retailCents, vipPct = 0) {
  const retail = Math.max(Math.round(Number(retailCents) || 0), 0);
  const pct = Math.min(Math.max(Number(vipPct || 0), 0), 90);
  return Math.round(retail * (1 - pct / 100));
}

module.exports = {
  SETTING_KEY,
  DEFAULT_MARKUP,
  getDefaultMarkupPercent,
  setDefaultMarkupPercent,
  charmEnding,
  retailFromCost,
  resolveRetail,
  roundPrice,
  computeRetailPreview,
  vipPriceFromRetail,
};
