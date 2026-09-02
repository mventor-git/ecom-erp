/**
 * Price List Service â€” multi-list pricing (retail / wholesale / semi-wholesale / offer).
 * mventor-ticket-046
 *
 * Effective price resolution order:
 *   1. Per-product override (product_prices) if it exists
 *   2. List discount_percent applied to the base price
 *   3. Base price (products.price)
 *
 * The storefront price list is configurable via settings `storefront_price_list`.
 * Orders snapshot the price list code at checkout so reports always know which
 * list was used.
 */

const db = require('../db');
const settingsService = require('./settingsService');

const DEFAULT_LISTS = ['retail', 'wholesale', 'semi_wholesale', 'offer'];

// â”€â”€ CRUD â”€â”€

function listPriceLists(includeInactive = false) {
  return db.prepare(`
    SELECT * FROM price_lists
    WHERE (is_active = 1 OR ? = 1)
    ORDER BY is_default DESC, id ASC
  `).all(includeInactive ? 1 : 0);
}

function getPriceList(idOrCode) {
  return db.prepare('SELECT * FROM price_lists WHERE id = ? OR code = ?').get(idOrCode, idOrCode);
}

function createPriceList({ name, code, discountPercent = null, isDefault = 0 }) {
  const cleanCode = String(code || '').toLowerCase().replace(/[^a-z0-9_]/g, '_');
  if (!name || !name.trim()) throw new Error('Price list name is required');
  if (!cleanCode) throw new Error('Price list code is required');
  const existing = db.prepare('SELECT id FROM price_lists WHERE code = ?').get(cleanCode);
  if (existing) throw new Error(`Price list "${cleanCode}" already exists`);

  if (isDefault) {
    db.prepare('UPDATE price_lists SET is_default = 0').run();
  }
  const result = db.prepare(`
    INSERT INTO price_lists (name, code, discount_percent, is_default, is_active)
    VALUES (?, ?, ?, ?, 1)
  `).run(name.trim(), cleanCode, discountPercent === null || discountPercent === '' ? null : Number(discountPercent), isDefault ? 1 : 0);
  return db.prepare('SELECT * FROM price_lists WHERE id = ?').get(result.lastInsertRowid);
}

function updatePriceList(id, updates = {}) {
  const existing = db.prepare('SELECT * FROM price_lists WHERE id = ?').get(id);
  if (!existing) throw new Error('Price list not found');

  // accept both camelCase (frontend) and snake_case (API) payloads
  const discountInput = updates.discount_percent !== undefined ? updates.discount_percent : updates.discountPercent;
  const activeInput = updates.is_active !== undefined ? updates.is_active : updates.isActive;
  const defaultInput = updates.is_default !== undefined ? updates.is_default : updates.isDefault;

  if (updates.isDefault || updates.is_default) {
    db.prepare('UPDATE price_lists SET is_default = 0').run();
  }
  const name = updates.name !== undefined ? updates.name : existing.name;
  const discount = discountInput !== undefined
    ? (discountInput === '' || discountInput === null ? null : Number(discountInput))
    : existing.discount_percent;
  const isActive = activeInput !== undefined ? (activeInput ? 1 : 0) : existing.is_active;
  const isDefault = defaultInput !== undefined ? (defaultInput ? 1 : 0) : existing.is_default;

  db.prepare(`
    UPDATE price_lists SET name = ?, discount_percent = ?, is_default = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(name, discount, isDefault, isActive, id);
  return db.prepare('SELECT * FROM price_lists WHERE id = ?').get(id);
}

function deletePriceList(id) {
  const existing = db.prepare('SELECT * FROM price_lists WHERE id = ?').get(id);
  if (!existing) throw new Error('Price list not found');
  if (existing.is_default) throw new Error('Cannot delete the default price list');
  db.prepare('DELETE FROM product_prices WHERE price_list_id = ?').run(id);
  db.prepare('DELETE FROM price_lists WHERE id = ?').run(id);
  return { success: true, deleted: existing.code };
}

// â”€â”€ Per-product overrides â”€â”€

function getProductPrices(productId) {
  return db.prepare(`
    SELECT pp.price_list_id, pl.code, pl.name, pp.price
    FROM product_prices pp
    JOIN price_lists pl ON pl.id = pp.price_list_id
    WHERE pp.product_id = ?
  `).all(productId);
}

function setProductPrices(productId, overrides = []) {
  // overrides: [{ price_list_id, price }] â€” price in cents; null/'' removes the override
  db.prepare('DELETE FROM product_prices WHERE product_id = ?').run(productId);
  overrides.forEach(o => {
    if (o.price_list_id && o.price !== undefined && o.price !== null && o.price !== '') {
      db.prepare(`
        INSERT INTO product_prices (product_id, price_list_id, price)
        VALUES (?, ?, ?)
      `).run(productId, o.price_list_id, Math.round(Number(o.price)));
    }
  });
  return getProductPrices(productId);
}

// â”€â”€ Effective price resolution â”€â”€

function getEffectivePrice(product, listCode) {
  const base = Number(product.price) || 0;
  if (!listCode) listCode = settingsService.get('storefront_price_list', 'retail') || 'retail';

  const list = db.prepare('SELECT * FROM price_lists WHERE code = ? AND is_active = 1').get(listCode);
  if (!list) return { price: base, base_price: base, price_list_code: listCode, price_list_name: listCode };

  const override = db.prepare(`
    SELECT price FROM product_prices WHERE product_id = ? AND price_list_id = ?
  `).get(product.id || product.product_id, list.id);

  if (override) {
    return { price: override.price, base_price: base, price_list_code: list.code, price_list_name: list.name };
  }
  if (list.discount_percent && list.discount_percent > 0) {
    const discounted = Math.round(base * (1 - Number(list.discount_percent) / 100));
    return { price: discounted, base_price: base, price_list_code: list.code, price_list_name: list.name, discount_percent: list.discount_percent };
  }
  return { price: base, base_price: base, price_list_code: list.code, price_list_name: list.name };
}

/** Attach effective prices to an array of product rows */
function applyPriceList(products, listCode) {
  if (!Array.isArray(products)) return products;
  return products.map(p => {
    const effective = getEffectivePrice(p, listCode);

    // Per-product storefront selling override (mventor-ticket-054):
    // admin can sell an individual product under ANY active price list,
    // regardless of the site-wide default (retail).
    if (p.sale_price_list && p.sale_price_list !== effective.price_list_code) {
      const overridden = getEffectivePrice(p, p.sale_price_list);
      if (overridden.price_list_code === p.sale_price_list) {
        Object.assign(effective, overridden);
      }
    }

    // ── TWO diagonal ribbons (mventor-ticket-054) ──
    // LEFT  = OFFER ribbon: auto % off vs base retail, admin color/toggle.
    // RIGHT = TEXT ribbon: admin types anything, admin color/toggle.
    // Controlled CSS: colors come from the product record.

    if (p.offer_badge && effective.price < effective.base_price) {
      const percent = Math.round((1 - effective.price / effective.base_price) * 100);
      if (percent > 0) {
        effective.ribbon_left = {
          kind: 'offer',
          text: `Offer −${percent}%`,
          percent,
          color: p.offer_color || '#ef4444',
        };
      }
    }

    const customText = String(p.text_badge_text || '').trim();
    if (p.text_badge && customText) {
      effective.ribbon_right = {
        kind: 'text',
        text: customText,
        color: p.text_badge_color || '#1f857a',
      };
    }

    return { ...p, ...effective };
  });
}

/** Resolve the storefront list code (validated against active lists) */
function storefrontListCode() {
  const code = settingsService.get('storefront_price_list', 'retail') || 'retail';
  const list = db.prepare('SELECT id FROM price_lists WHERE code = ? AND is_active = 1').get(code);
  return list ? code : 'retail';
}

module.exports = {
  DEFAULT_LISTS,
  listPriceLists,
  getPriceList,
  createPriceList,
  updatePriceList,
  deletePriceList,
  getProductPrices,
  setProductPrices,
  getEffectivePrice,
  applyPriceList,
  storefrontListCode,
};
