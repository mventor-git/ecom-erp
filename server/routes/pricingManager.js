/**
 * Pricing Manager Routes (mventor-ticket-054)
 * Mounted at /api/admin/pricing — Warehouse → Pricing page.
 *
 * Wholesale (cost, the price bought at) vs Selling price:
 *   - GET /preview  — per-product impact of a markup % over cost
 *   - POST /apply   — commit the new selling prices (transactional)
 *   - GET /report   — full detailed profit breakdown (per product)
 *
 * Profit logic: margin_egp = selling − cost. Green when positive.
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const adminAuth = require('../middleware/adminAuth');
const { requirePermission } = require('../middleware/rbac');
const cache = require('../cache');
const eventService = require('../services/eventService');

function buildScope(req) {
  const { scope, category_id, product_id } = req.query;
  const where = ['p.deleted_at IS NULL', 'p.cost_price > 0'];
  const params = [];

  if (scope === 'category' && category_id) {
    where.push('p.category_id = ?');
    params.push(parseInt(category_id));
  } else if (scope === 'product' && product_id) {
    where.push('p.id = ?');
    params.push(parseInt(product_id));
  }
  return { whereSql: where.join(' AND '), params };
}

/** Round a price (in cents) to the chosen commercial ending. */
function roundPrice(centsValue, style) {
  if (!style || style === 'none') return centsValue;
  const whole = Math.floor(centsValue / 100);
  if (style === '99') return whole * 100 + 99;            // x.99 charm
  if (style === '95') return whole * 100 + 95;            // x.95 charm
  if (style === '5')  return Math.max(Math.round(centsValue / 500) * 500, 500);   // nearest 5 EGP
  if (style === '10') return Math.max(Math.round(centsValue / 1000) * 1000, 1000); // nearest 10 EGP
  return centsValue;
}

/**
 * Pricing Engine core.
 * modes:
 *   markup — value% on top of cost          price = cost × (1 + v)
 *   margin — value% target margin on retail price = cost ÷ (1 − v)
 *   match  — keep current prices, re-round endings only
 */
function computeRows(req, { mode = 'markup', value = 0, rounding = 'none' }) {
  const { whereSql, params } = buildScope(req);
  const products = db.prepare(`
    SELECT p.id, p.name, p.name_ar, p.cost_price, p.price AS current_price,
           p.old_price, p.offer_badge, c.name AS category_name
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE ${whereSql}
    ORDER BY p.name ASC
  `).all(...params);

  const v = Number(value || 0);
  const rows = products.map(p => {
    let raw;
    if (mode === 'margin') {
      const m = Math.min(Math.max(v, -90), 95) / 100;
      raw = m < 0.95 ? p.cost_price / (1 - m) : p.cost_price * 20;
    } else if (mode === 'match') {
      raw = p.current_price;
    } else if (mode === 'offer') {
      // Offer mode: value% OFF the CURRENT retail price
      raw = p.current_price * (1 - Math.min(Math.max(v, 0), 90) / 100);
    } else {
      raw = p.cost_price * (1 + v / 100);
    }
    const proposed = Math.max(roundPrice(Math.round(raw), rounding), 5);

    const currentMargin = p.current_price - p.cost_price;
    const newMargin = proposed - p.cost_price;
    const isOfferNow = p.offer_badge === 1 || (p.old_price > p.current_price);

    return {
      id: p.id,
      name: p.name,
      name_ar: p.name_ar,
      category_name: p.category_name,
      cost_price: p.cost_price,
      current_price: p.current_price,
      old_price: p.old_price,
      has_offer: !!isOfferNow,
      will_offer: proposed < p.current_price ? 1 : 0,
      discount_pct: proposed < p.current_price
        ? Math.round(((p.current_price - proposed) / p.current_price) * 100)
        : 0,
      proposed_price: proposed,
      current_margin: currentMargin,
      new_margin: newMargin,
      delta_margin: newMargin - currentMargin,
      margin_pct: p.cost_price > 0 ? Math.round(((proposed - p.cost_price) / p.cost_price) * 100) : 0,
      current_margin_pct: p.cost_price > 0 ? Math.round((currentMargin / p.cost_price) * 100) : 0,
    };
  });

  const totals = rows.reduce((acc, r) => ({
    total_cost: acc.total_cost + r.cost_price,
    total_current_revenue: acc.total_current_revenue + r.current_price,
    total_proposed_revenue: acc.total_proposed_revenue + r.proposed_price,
    total_current_profit: acc.total_current_profit + r.current_margin,
    total_new_profit: acc.total_new_profit + r.new_margin,
    offers_created: acc.offers_created + (r.will_offer ? 1 : 0),
  }), { total_cost: 0, total_current_revenue: 0, total_proposed_revenue: 0,
        total_current_profit: 0, total_new_profit: 0, offers_created: 0 });

  totals.profit_delta = totals.total_new_profit - totals.total_current_profit;
  totals.avg_margin_pct = rows.length
    ? Math.round(rows.reduce((s, r) => s + r.margin_pct, 0) / rows.length)
    : 0;
  totals.below_cost = rows.filter(r => r.new_margin <= 0).length;
  return { rows, totals };
}

// GET /api/admin/pricing/preview?scope=store|category|product&mode=markup|margin|match&value=&rounding=
router.get('/preview', adminAuth, requirePermission('products.update'), (req, res) => {
  try {
    const opts = {
      mode: req.query.mode || 'markup',
      value: parseFloat(req.query.value ?? req.query.margin) || 0,
      rounding: req.query.rounding || 'none',
    };
    const { rows, totals } = computeRows(req, opts);
    res.json({ ...opts, rows, totals });
  } catch (err) {
    console.error('Pricing preview error:', err);
    res.status(500).json({ error: 'Failed to build pricing preview' });
  }
});

// POST /api/admin/pricing/apply — commit proposed prices atomically.
// Price drops auto-create storefront OFFERS: current price is preserved as
// old_price so the customer site renders its offer ribbon automatically.
// When mode='offer', automatically enables offer_badge for affected products.
// Every applied change is recorded in the PRICING_APPLIED event payload so
// POST /revert can undo the last apply in one tap.
router.post('/apply', adminAuth, requirePermission('products.update'), (req, res) => {
  try {
    const { scope = 'store', category_id, product_id, mode = 'markup', value = 0, rounding = 'none' } = req.body || {};
    if (!['markup', 'margin', 'match', 'offer'].includes(mode)) {
      return res.status(400).json({ error: `Unknown mode: ${mode}` });
    }
    if (!Number.isFinite(Number(value))) {
      return res.status(400).json({ error: 'value must be a number' });
    }

    const fakeReq = { query: { scope, category_id, product_id } };
    const opts = { mode, value: Number(value), rounding };
    const { rows, totals } = computeRows(fakeReq, opts);
    if (!rows.length) {
      return res.status(400).json({ error: 'No products match this scope (products need a wholesale cost > 0)' });
    }

    db.transaction(() => {
      // When applying offers, enable the offer_badge and preserve old_price
      // For markup/margin modes, just update the price
      if (mode === 'offer') {
        const updOffer = db.prepare(`
          UPDATE products SET
            price = ?,
            old_price = CASE
              WHEN (? < price) AND (old_price IS NULL OR old_price <= price OR old_price = 0)
                THEN price ELSE old_price END,
            offer_badge = 1,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `);
        rows.forEach(r => updOffer.run(r.proposed_price, r.proposed_price, r.id));
      } else {
        const upd = db.prepare(`
          UPDATE products SET
            price = ?,
            old_price = CASE
              WHEN (? < price) AND (old_price IS NULL OR old_price <= price OR old_price = 0)
                THEN price ELSE old_price END,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `);
        rows.forEach(r => upd.run(r.proposed_price, r.proposed_price, r.id));
      }
    });
    cache.invalidatePrefix('products:');

    eventService.emit(eventService.EVENT_TYPES.PRICING_APPLIED, eventService.ENTITY_TYPES.PRODUCT, product_id ? parseInt(product_id) : 0, {
      userId: req.session.username || 'admin',
      payload: {
        scope, category_id, product_id, ...opts,
        products: rows.length,
        new_profit: totals.total_new_profit,
        // full before→after map — exactly what /revert restores
        changes: rows.map(r => ({ id: r.id, from_price: r.current_price, to_price: r.proposed_price })),
      },
    });

    res.json({ success: true, updated: rows.length, totals });
  } catch (err) {
    console.error('Pricing apply error:', err);
    res.status(500).json({ error: 'Failed to apply pricing' });
  }
});

// GET /api/admin/pricing/last-apply — what an Undo would restore.
router.get('/last-apply', adminAuth, requirePermission('products.update'), (req, res) => {
  try {
    res.json(lastApplyEvent() || { none: true });
  } catch (err) {
    console.error('Pricing last-apply error:', err);
    res.status(500).json({ error: 'Failed to read last apply' });
  }
});

/** Latest PRICING_APPLIED event with its parsed change list. */
function lastApplyEvent() {
  const ev = db.prepare(`
    SELECT id, created_at, user_id, payload FROM events
    WHERE event_type = ? ORDER BY id DESC LIMIT 1
  `).get(eventService.EVENT_TYPES.PRICING_APPLIED);
  if (!ev) return null;
  let payload = {};
  try { payload = JSON.parse(ev.payload || '{}'); } catch { /* keep {} */ }
  return {
    event_id: ev.id,
    at: ev.created_at,
    by: ev.user_id,
    scope: payload.scope || 'store',
    mode: payload.mode,
    value: payload.value,
    products: payload.products,
    changes: Array.isArray(payload.changes) ? payload.changes : [],
  };
}

// POST /api/admin/pricing/revert — undo the LAST apply: every product goes
// back to its exact previous retail price (transactional).
router.post('/revert', adminAuth, requirePermission('products.update'), (req, res) => {
  try {
    const last = lastApplyEvent();
    if (!last || !last.changes.length) {
      return res.status(404).json({ error: 'Nothing to revert' });
    }

    const restore = db.prepare(`
      UPDATE products SET price = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `);

    db.transaction(() => {
      last.changes.forEach(c => restore.run(c.from_price, c.id));
    });
    cache.invalidatePrefix('products:');

    eventService.emit(eventService.EVENT_TYPES.PRICING_REVERTED, eventService.ENTITY_TYPES.PRODUCT, 0, {
      userId: req.session.username || 'admin',
      payload: {
        reverted_event_id: last.event_id,
        products: last.changes.length,
        changes: last.changes.map(c => ({ id: c.id, from_price: c.to_price, to_price: c.from_price })),
      },
    });

    res.json({ success: true, reverted: last.changes.length });
  } catch (err) {
    console.error('Pricing revert error:', err);
    res.status(500).json({ error: 'Failed to revert pricing' });
  }
});

// GET /api/admin/pricing/offers — every product currently running an offer
router.get('/offers', adminAuth, requirePermission('products.read'), (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT p.id, p.name, p.name_ar, p.price, p.old_price, p.stock,
             p.offer_badge, c.name AS category_name
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.deleted_at IS NULL
        AND p.is_packaging = 0
        AND (p.offer_badge = 1 OR (p.old_price > 0 AND p.old_price > p.price))
      ORDER BY (p.old_price - p.price) DESC
    `).all();
    res.json(rows);
  } catch (err) {
    console.error('Offers fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch offers' });
  }
});

// GET /api/admin/pricing/profit-report — full P&L anchored at opening balances.
// Financial model (perpetual inventory):
//   Net Revenue      = Gross Sales − Refunds
//   COGS             = sold goods × their cost at sale time (issue movements)
//   Gross Profit     = Net Revenue − COGS
//   Operating Costs  = packaging consumed + damage losses (at cost)
//   Operating Profit = Gross Profit − Operating Costs
//   Balance Sheet    = stock-on-hand value at cost & retail → potential profit
router.get('/profit-report', adminAuth, requirePermission('reports.read'), (req, res) => {
  try {
    // ── Periods anchored at every opening-balance movement date ──
    const anchors = db.prepare(`
      SELECT DISTINCT date(created_at) AS d
      FROM inventory_movements WHERE type = 'opening_balance'
      ORDER BY d ASC
    `).all().map(r => r.d);

    const firstEver = db.prepare(`
      SELECT date(MIN(created_at)) AS d FROM inventory_movements
    `).get().d;

    const starts = anchors.length > 0 ? anchors : [firstEver || new Date().toISOString().slice(0, 10)];
    if (!starts.includes(firstEver) && firstEver) starts.unshift(firstEver);
    const uniqueStarts = [...new Set(starts)].sort();

    const periods = [];
    for (let i = 0; i < uniqueStarts.length; i++) {
      const start = uniqueStarts[i];
      const end = i + 1 < uniqueStarts.length
        ? uniqueStarts[i + 1]
        : new Date().toISOString().slice(0, 10);

      const sales = db.prepare(`
        SELECT COALESCE(SUM(total),0) AS t FROM orders
        WHERE status NOT IN ('cancelled','refunded')
          AND date(created_at) >= ? AND date(created_at) < ?
      `).get(start, end).t;
      const refunds = db.prepare(`
        SELECT COALESCE(SUM(total),0) AS t FROM orders
        WHERE status = 'refunded' AND date(updated_at) >= ? AND date(updated_at) < ?
      `).get(start, end).t;
      const cogs = db.prepare(`
        SELECT COALESCE(SUM(-m.qty_change * m.unit_cost),0) AS t
        FROM inventory_movements m JOIN products p ON p.id = m.product_id
        WHERE m.type='issue' AND m.reference_type='order'
          AND p.is_packaging = 0
          AND date(m.created_at) >= ? AND date(m.created_at) < ?
      `).get(start, end).t;
      const packaging = db.prepare(`
        SELECT COALESCE(SUM(-m.qty_change * m.unit_cost),0) AS t
        FROM inventory_movements m JOIN products p ON p.id = m.product_id
        WHERE m.type='issue' AND p.is_packaging = 1
          AND date(m.created_at) >= ? AND date(m.created_at) < ?
      `).get(start, end).t;
      const damages = db.prepare(`
        SELECT COALESCE(SUM(-m.qty_change * m.unit_cost),0) AS t
        FROM inventory_movements m
        WHERE m.type='damage'
          AND date(m.created_at) >= ? AND date(m.created_at) < ?
      `).get(start, end).t;

      const net_revenue = sales - refunds;
      const gross_profit = net_revenue - cogs;
      periods.push({
        start, end,
        gross_sales: sales,
        refunds,
        net_revenue,
        cogs,
        gross_profit,
        packaging_expense: packaging,
        damage_loss: damages,
        operating_profit: gross_profit - packaging - damages,
        margin_pct: net_revenue > 0 ? Math.round((gross_profit / net_revenue) * 100) : 0,
      });
    }

    // ── Current balance-sheet position ──
    const stock = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN p.is_packaging = 0 THEN i.qty_on_hand * p.cost_price END), 0) AS stock_cost_value,
        COALESCE(SUM(CASE WHEN p.is_packaging = 0 THEN i.qty_on_hand * p.price END), 0)      AS stock_retail_value,
        COALESCE(SUM(CASE WHEN p.is_packaging = 1 THEN i.qty_on_hand * p.cost_price END), 0) AS packaging_stock_value
      FROM inventory i JOIN products p ON p.id = i.product_id
      WHERE p.deleted_at IS NULL
    `).get();
    stock.potential_profit = stock.stock_retail_value - stock.stock_cost_value;

    // ── Lifetime per-product profitability ──
    const perProduct = db.prepare(`
      SELECT p.id, p.name,
        COALESCE(sold.units, 0) AS units_sold,
        COALESCE(sold.cogs, 0) AS cogs,
        COALESCE(dmg.value, 0) AS damage_value,
        COALESCE(inv.on_hand, 0) AS on_hand,
        p.cost_price, p.price
      FROM products p
      LEFT JOIN (
        SELECT product_id, SUM(-qty_change) AS units,
               SUM(-qty_change * unit_cost) AS cogs
        FROM inventory_movements WHERE type='issue' GROUP BY product_id
      ) sold ON sold.product_id = p.id
      LEFT JOIN (
        SELECT product_id, SUM(-qty_change * unit_cost) AS value
        FROM inventory_movements WHERE type='damage' GROUP BY product_id
      ) dmg ON dmg.product_id = p.id
      LEFT JOIN (
        SELECT product_id, SUM(qty_on_hand) AS on_hand FROM inventory GROUP BY product_id
      ) inv ON inv.product_id = p.id
      WHERE p.deleted_at IS NULL
      ORDER BY cogs DESC
    `).all().map(r => ({
      ...r,
      est_revenue: r.units_sold * r.price,
      est_profit: (r.units_sold * r.price) - r.cogs,
      potential_profit: r.on_hand * (r.price - r.cost_price),
    }));

    res.json({ periods, position: stock, per_product: perProduct });
  } catch (err) {
    console.error('Profit report error:', err);
    res.status(500).json({ error: 'Failed to build profit report' });
  }
});

module.exports = router;
// Exposed for jest tests — the HTTP layer stays thin over these.
module.exports.computeRows = computeRows;
module.exports.roundPrice = roundPrice;
module.exports.lastApplyEvent = lastApplyEvent;
