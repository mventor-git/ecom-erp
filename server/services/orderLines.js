/**
 * Order line rows — the single builder for order_items (mventor-ticket-071).
 *
 * Direction rows-canonical: web checkout and the history backfill both write
 * through here, so JSON (`orders.items`) and rows never diverge again.
 * Mirrors legacy ↔ normalized cols (069 contract: qty/base_price/final_price
 * equal the legacy facts). Cost unknown at these paths → column default.
 * Pure mapping (no DB) — existence checks belong to callers with old data.
 */
function mapLineRow(orderId, it, priceListCode) {
  const productId = parseInt(it.product_id ?? it.id ?? 0, 10) || 0;
  const qty = parseInt(it.qty ?? it.quantity ?? 0, 10) || 0;
  const price = Math.max(Math.round(Number(it.price) || 0), 0);
  if (!productId) return { skipped: { reason: 'missing_product' } };
  if (!(qty > 0)) return { skipped: { product_id: productId, reason: 'invalid_qty' } };
  return {
    row: {
      order_id: orderId,
      product_id: productId,
      product_name: String(it.name || ''),
      quantity: qty,
      price,
      variant_color: it.color ?? it.variant_color ?? null,
      variant_size: it.size ?? it.variant_size ?? null,
      price_list_code: priceListCode || 'retail',
      qty,
      base_price: price,
      final_price: price,
    },
  };
}

/** Map a priced-items array; returns { rows, skipped } (never throws on data). */
function buildLineRows(orderId, pricedItems, priceListCode) {
  const rows = [];
  const skipped = [];
  for (const it of (pricedItems || [])) {
    const r = mapLineRow(orderId, it, priceListCode);
    if (r.row) rows.push(r.row);
    else skipped.push(r.skipped);
  }
  return { rows, skipped };
}

/** Insert built rows (legacy + mirror cols). Throws loudly on DB failure. */
function insertLineRows(rows) {
  if (!rows || rows.length === 0) return 0;
  const db = require('../db');
  const ins = db.prepare(`
    INSERT INTO order_items (
      order_id, product_id, product_name, quantity, price,
      variant_color, variant_size, price_list_code, qty, base_price, final_price
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  let n = 0;
  for (const r of rows) {
    ins.run(r.order_id, r.product_id, r.product_name, r.quantity, r.price,
      r.variant_color, r.variant_size, r.price_list_code, r.qty, r.base_price, r.final_price);
    n++;
  }
  return n;
}

module.exports = { mapLineRow, buildLineRows, insertLineRows, applyLineCosts };

/**
 * Thread bridge unit costs into line snapshots (072). Updates ONLY lines
 * whose snapshot is still unknown (NULL/0) and only with unitCost > 0 —
 * real snapshots (e.g. admin FIFO) are never clobbered, and empty costs
 * from idempotent repeat issues never overwrite. Returns rows updated.
 */
function applyLineCosts(orderId, costs) {
  if (!orderId || !Array.isArray(costs) || costs.length === 0) return 0;
  const db = require('../db');
  const upd = db.prepare(`
    UPDATE order_items SET cost_snapshot = ?
    WHERE order_id = ? AND product_id = ?
      AND (cost_snapshot IS NULL OR cost_snapshot = 0)
  `);
  let n = 0;
  for (const c of costs) {
    const unit = Math.round(Number(c.unitCost) || 0);
    if (unit <= 0) continue;
    const pid = parseInt(c.productId ?? c.product_id ?? 0, 10) || 0;
    if (!pid) continue;
    n += upd.run(unit, orderId, pid).changes;
  }
  return n;
}
