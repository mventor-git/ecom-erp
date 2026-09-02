/**
 * Customer Service â€” profiles, stats, recommendation + export rows.
 * mventor-ticket-053 (used by routes/customers.js)
 */

const db = require('../db');

const PAID = "('paid', 'delivered', 'completed', 'refunded')";

function parseItems(order) {
  try { return JSON.parse(order.items || '[]'); } catch { return []; }
}

function customersWithStats(q, status, page = 1, limit = 10) {
  const p = Math.max(1, parseInt(page) || 1);
  const l = Math.min(100, Math.max(1, parseInt(limit) || 10));
  const offset = (p - 1) * l;
  const hasQ = !!q;
  const hasStatus = !!status;
  let where = '';
  const params = [];
  if (hasQ) {
    where = 'WHERE (c.name LIKE ? OR c.email LIKE ? OR c.phone LIKE ?)';
    params.push('%' + q + '%', '%' + q + '%', '%' + q + '%');
  }
  if (hasStatus && hasQ) {
    where += ' AND c.is_verified = ?';
    params.push(status === 'verified' ? 1 : 0);
  } else if (hasStatus) {
    where = 'WHERE c.is_verified = ?';
    params.push(status === 'verified' ? 1 : 0);
  }
  const countSql = 'SELECT COUNT(*) as total FROM customers c ' + where;
  const total = db.prepare(countSql).get(...params).total;
  const sql = `SELECT c.id, c.email, c.name, c.avatar_url, c.phone, c.google_id, c.created_at, c.is_verified,
           c.vip, c.invite_name,
           (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id) as orders_count,
           (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id AND o.status IN ('paid','delivered','completed','refunded')) as paid_orders_count,
           (SELECT COALESCE(SUM(o.total), 0) FROM orders o WHERE o.customer_id = c.id AND o.status IN ('paid','delivered','completed','refunded')) as total_revenue,
           (SELECT MAX(o.created_at) FROM orders o WHERE o.customer_id = c.id) as last_order_at,
           (SELECT COUNT(*) FROM reviews r WHERE r.customer_id = c.id) as reviews_count,
           (SELECT COUNT(*) FROM wishlist w WHERE w.customer_id = c.id) as wishlist_count
    FROM customers c ` + where + ` ORDER BY c.created_at DESC LIMIT ? OFFSET ?`;
  params.push(l, offset);
  const items = db.prepare(sql).all(...params);
  return { items, pagination: { page: p, limit: l, total, totalPages: Math.ceil(total / l) || 1 } };
}


function getCustomerProfile(id) {
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
  if (!customer) return null;

  let googleProfile = {};
  try { googleProfile = JSON.parse(customer.google_profile || '{}'); } catch { googleProfile = {}; }

  const orders = db.prepare(`
    SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC LIMIT 100
  `).all(id).map(o => ({ ...o, items: parseItems(o) }));

  const paidOrders = orders.filter(o => ['paid', 'delivered', 'completed', 'refunded'].includes(o.status));
  const totalRevenue = paidOrders.reduce((s, o) => s + (o.total || 0), 0);
  const largestOrder = paidOrders.reduce((best, o) => (!best || o.total > best.total ? o : best), null);

  const reviews = db.prepare(`
    SELECT r.id, r.rating, r.comment, r.created_at, p.name as product_name
    FROM reviews r JOIN products p ON p.id = r.product_id
    WHERE r.customer_id = ? ORDER BY r.created_at DESC
  `).all(id);

  const wishlist = db.prepare(`
    SELECT w.id, w.created_at, p.id as product_id, p.name, p.price, p.image_url, p.stock
    FROM wishlist w JOIN products p ON p.id = w.product_id
    WHERE w.customer_id = ? ORDER BY w.created_at DESC
  `).all(id);

  return {
    id: customer.id,
    email: customer.email,
    name: customer.name,
    avatar_url: customer.avatar_url,
    phone: customer.phone || '',
    address: customer.address || '',
    city: customer.city || '',
    governorate: customer.governorate || '',
    latitude: customer.latitude || null,
    longitude: customer.longitude || null,
    google_id: customer.google_id || '',
    google_profile: googleProfile,
    is_verified: customer.is_verified === 1,
    created_at: customer.created_at,
    stats: {
      orders_count: orders.length,
      paid_orders_count: paidOrders.length,
      total_revenue: totalRevenue,
      avg_order: paidOrders.length ? Math.round(totalRevenue / paidOrders.length) : 0,
      largest_order: largestOrder ? { id: largestOrder.id, total: largestOrder.total, created_at: largestOrder.created_at, status: largestOrder.status } : null,
      largest_order_amount: largestOrder ? largestOrder.total : 0,
      reviews_count: reviews.length,
      wishlist_count: wishlist.length,
      last_order_at: orders[0]?.created_at || null,
    },
    orders,
    reviews,
    wishlist,
    recommendation: recommendForCustomer(id),
  };
}

/** Algorithmic recommendation: best-selling product in the customer's top category */
function recommendForCustomer(customerId) {
  const orders = db.prepare(`SELECT items, total, status FROM orders WHERE customer_id = ? AND status IN ${PAID}`).all(customerId);
  const categorySpend = {};
  const purchasedProductIds = new Set();

  orders.forEach(o => {
    parseItems(o).forEach(it => {
      const pid = it.id || it.product_id;
      if (!pid) return;
      purchasedProductIds.add(pid);
      const product = db.prepare('SELECT category_id FROM products WHERE id = ?').get(pid);
      if (!product || !product.category_id) return;
      const qty = it.qty || it.quantity || 1;
      categorySpend[product.category_id] = (categorySpend[product.category_id] || 0) + ((it.price || 0) * qty);
    });
  });

  if (Object.keys(categorySpend).length === 0) {
    return db.prepare(`
      SELECT p.id, p.name, p.price, p.image_url, c.name as category_name, c.icon as category_icon
      FROM products p LEFT JOIN categories c ON c.id = p.category_id
      ORDER BY p.id LIMIT 1
    `).get();
  }

  const topCategoryId = Object.keys(categorySpend).sort((a, b) => categorySpend[b] - categorySpend[a])[0];

  const sales = db.prepare(`SELECT items FROM orders WHERE status IN ${PAID}`).all();
  const salesCount = {};
  sales.forEach(o => {
    parseItems(o).forEach(it => {
      const pid = it.id || it.product_id;
      if (pid) salesCount[pid] = (salesCount[pid] || 0) + (it.qty || it.quantity || 1);
    });
  });

  const candidates = db.prepare(`
    SELECT p.id, p.name, p.price, p.image_url, c.name as category_name, c.icon as category_icon
    FROM products p LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.category_id = ? AND p.active = 1
  `).all(topCategoryId);

  const scored = candidates
    .map(p => ({ ...p, score: salesCount[p.id] || 0, bought: purchasedProductIds.has(p.id) }))
    .sort((a, b) => (b.score - a.score) || (a.bought - b.bought));

  return scored[0] || null;
}

/** CSV rows of a customer's actions (orders, reviews, wishlist) */
function customerActionRows(id) {
  const rows = [];
  db.prepare('SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC').all(id).forEach(o => {
    rows.push({ action: 'order', order_id: o.id, status: o.status, total: o.total, date: o.created_at });
  });
  db.prepare('SELECT * FROM reviews WHERE customer_id = ? ORDER BY created_at DESC').all(id).forEach(r => {
    rows.push({ action: 'review', rating: r.rating, comment: r.comment, date: r.created_at });
  });
  db.prepare('SELECT * FROM wishlist WHERE customer_id = ? ORDER BY created_at DESC').all(id).forEach(w => {
    rows.push({ action: 'wishlist_add', product_id: w.product_id, date: w.created_at });
  });
  return rows;
}

function toCsv(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];
  rows.forEach(row => {
    lines.push(headers.map(h => {
      const val = row[h];
      if (val === null || val === undefined) return '';
      const str = String(val);
      return /[",\n]/.test(str) ? '"' + str.replace(/"/g, '""') + '"' : str;
    }).join(','));
  });
  return lines.join('\n');
}

module.exports = {
  customersWithStats,
  getCustomerProfile,
  recommendForCustomer,
  customerActionRows,
  toCsv,
};
