/**
 * Order Pricing — the server-side authority for order totals.
 *
 * The web client sends cart items (product ids + quantities) and a total. That
 * total must NEVER be trusted as the amount charged. This module recomputes the
 * authoritative line prices from the database using the SAME resolution the
 * storefront product listing uses (priceListService.getEffectivePrice), so the
 * customer is charged exactly what the storefront displayed — and nothing else.
 *
 * Returns { items, total } where total is INTEGER cents, or { errors } when the
 * cart cannot be priced (unknown/inactive product, invalid quantity).
 */

const db = require('../db');
const priceListService = require('./priceListService');

function normalizeId(it) {
  return parseInt(it.id ?? it.product_id ?? it.productId ?? 0, 10) || 0;
}

function normalizeQty(it) {
  const q = parseInt(it.qty ?? it.quantity ?? 0, 10);
  return Number.isFinite(q) ? q : 0;
}

function resolveItem(raw) {
  const id = normalizeId(raw);
  if (!id) return { ok: false, reason: 'missing_product' };

  const product = db.prepare('SELECT id, name, price, active FROM products WHERE id = ?').get(id);
  if (!product) return { ok: false, reason: 'unknown_product' };
  if (product.active === 0) return { ok: false, reason: 'inactive_product' };

  const qty = normalizeQty(raw);
  if (!(qty > 0)) return { ok: false, reason: 'invalid_qty' };

  // Authoritative unit price (cents) — overrides, list discounts, sale price list.
  const effective = priceListService.getEffectivePrice(product, priceListService.storefrontListCode());
  const unitPrice = Number(effective.price) || 0;

  // Rebuild the item snapshot from server-known fields (id, name, qty, price).
  // Preserve only benign display fields from the client — never price/qty.
  const item = {
    id: product.id,
    product_id: product.id,
    name: product.name,
    qty,
    price: unitPrice,
  };
  if (raw.color != null) item.color = raw.color;
  if (raw.size != null) item.size = raw.size;
  if (raw.image != null) item.image = raw.image;

  return { ok: true, item, unitPrice };
}

/** Recompute authoritative items + total (cents) for a cart. */
function computeAuthoritativeOrder(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, errors: [{ reason: 'empty_cart' }], items: [], total: 0 };
  }
  const out = [];
  const errors = [];
  let total = 0;
  for (const raw of items) {
    const r = resolveItem(raw);
    if (!r.ok) { errors.push({ product_id: normalizeId(raw), reason: r.reason }); continue; }
    out.push(r.item);
    total += r.unitPrice * r.item.qty;
  }
  if (errors.length > 0) return { ok: false, errors, items: [], total: 0 };
  return { ok: true, errors: [], items: out, total };
}

module.exports = { computeAuthoritativeOrder, resolveItem };
