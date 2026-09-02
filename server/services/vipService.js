/**
 * VIP Program Service (mventor-ticket-060)
 *
 * - createInvite(name, by): unique code + printable invitation payload (RTL-ready)
 * - claimInvite(code, customer): on Google sign-in, flags the customer VIP and
 *   applies the invitation name; single-use.
 * - VIP cart: staff add products FOR the customer; customer checks out via the
 *   normal site flow. VIP orders skip gateway confirmation and create a
 *   TEMP issue that an admin approves to release stock.
 */

const crypto = require('crypto');
const db = require('../db');

function generateCode() {
  return 'VIP-' + crypto.randomBytes(4).toString('hex').toUpperCase();
}

/** Create a new VIP invitation for a named prospect. */
function createInvite(name, createdBy = '') {
  const clean = String(name || '').trim();
  if (!clean) throw new Error('Invitation name is required');
  let code = generateCode();
  // guarantee uniqueness
  while (db.prepare('SELECT id FROM vip_invites WHERE code = ?').get(code)) {
    code = generateCode();
  }
  db.prepare('INSERT INTO vip_invites (code, invite_name, created_by) VALUES (?, ?, ?)')
    .run(code, clean, createdBy);
  return getInvite(code);
}

function getInvite(code) {
  return db.prepare(`
    SELECT vi.*, c.id AS used_by_customer_id, c.email AS used_by_email
    FROM vip_invites vi
    LEFT JOIN customers c ON c.id = vi.used_by
    WHERE vi.code = ?
  `).get(code);
}

function listInvites(limit = 100) {
  return db.prepare(`
    SELECT vi.*, c.email AS used_by_email
    FROM vip_invites vi
    LEFT JOIN customers c ON c.id = vi.used_by
    ORDER BY vi.created_at DESC, vi.id DESC
    LIMIT ?
  `).all(limit);
}

/**
 * Claim an invite during Google sign-in. Idempotent per invite;
 * fails cleanly when the code is unknown or already used.
 */
function claimInvite(code, customerId) {
  const inv = db.prepare('SELECT * FROM vip_invites WHERE code = ?').get(code);
  if (!inv) throw new Error('Invalid invitation code');
  if (inv.used_by) {
    if (Number(inv.used_by) === Number(customerId)) return getInvite(code); // re-login ok
    throw new Error('This invitation has already been used');
  }
  db.prepare('UPDATE vip_invites SET used_by = ?, used_at = CURRENT_TIMESTAMP WHERE code = ?')
    .run(customerId, code);
  db.prepare('UPDATE customers SET vip = 1, invite_name = ? WHERE id = ?')
    .run(inv.invite_name, customerId);
  return getInvite(code);
}

function isVip(customerId) {
  const row = db.prepare('SELECT vip FROM customers WHERE id = ?').get(customerId);
  return !!(row && row.vip);
}

// ── VIP cart (staff-managed) ──

function addToVipCart(customerId, productId, qty = 1, addedBy = '') {
  const qtyN = Math.max(parseInt(qty) || 1, 1);
  if (!isVip(customerId)) throw new Error('Customer is not marked as VIP');
  const product = db.prepare('SELECT id FROM products WHERE id = ? AND deleted_at IS NULL').get(productId);
  if (!product) throw new Error('Product not found');
  db.prepare(`
    INSERT INTO vip_cart (customer_id, product_id, qty, added_by)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(customer_id, product_id) DO UPDATE SET qty = qty + excluded.qty
  `).run(customerId, productId, qtyN, addedBy);
  return getVipCart(customerId);
}

function getVipCart(customerId) {
  return db.prepare(`
    SELECT vc.id, vc.product_id, p.name AS product_name, p.price,
           p.image_url, vc.qty, vc.added_by, vc.created_at
    FROM vip_cart vc
    JOIN products p ON p.id = vc.product_id
    WHERE vc.customer_id = ?
    ORDER BY vc.created_at DESC
  `).all(customerId);
}

function removeVipCartItem(customerId, itemId) {
  db.prepare('DELETE FROM vip_cart WHERE id = ? AND customer_id = ?').run(itemId, customerId);
  return getVipCart(customerId);
}

function clearVipCart(customerId) {
  db.prepare('DELETE FROM vip_cart WHERE customer_id = ?').run(customerId);
}

module.exports = {
  createInvite,
  getInvite,
  listInvites,
  claimInvite,
  isVip,
  addToVipCart,
  getVipCart,
  removeVipCartItem,
  clearVipCart,
};
