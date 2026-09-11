/**
 * Warehouse Order Service — Supply Orders (اذن توريد), Issue Orders (اذن صرف)
 * and Financial Periods (opening balances).
 *
 * - Supply order: multi-product stock IN (distinct from ad-hoc receipts)
 * - Issue order:  multi-product stock OUT, notifies packing/inventory users
 * - Financial period: configurable (1-60 months), opening balance per period
 * - Every issued operation produces a Markdown document with QR + barcode
 */

const db = require('../db');
const documentNumberService = require('./documentNumberService');
const inventoryService = require('./inventoryService');
const documentService = require('./documentService');
const notificationService = require('./notificationService');
const settingsService = require('./settingsService');

// ── Helpers ──

function usersWithPermission(permission) {
  return require('./permissionService').usersWithPermission(permission);
}

function notifyUsers(permissions, title, message, link = null) {
  const recipients = new Map();
  permissions.forEach(perm => {
    const ids = usersWithPermission(perm);
    // usersWithPermission returns Array<number>; resolve full user objects
    ids.forEach(id => {
      const userRow = db.prepare('SELECT id, email, name FROM users WHERE id = ?').get(id);
      if (userRow && userRow.id) recipients.set(userRow.id, userRow);
    });
  });
  recipients.forEach(user => {
    // Pass correct user id (number, not null/undefined)
    notificationService.sendInApp(user.id, title, message, link).catch(() => {});
  });
  return recipients.size;
}

function getOrderWithItems(table, itemsTable, id) {
  const order = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
  if (!order) return null;
  order.items = db.prepare(`
    SELECT i.*, p.name as product_name, p.sku
    FROM ${itemsTable} i
    JOIN products p ON p.id = i.product_id
    WHERE i.${table === 'supply_orders' ? 'supply_order_id' : 'issue_order_id'} = ?
    ORDER BY i.id
  `).all(id);
  return order;
}

// ═══════════════════════════════════════════════════════════════
// SUPPLY ORDERS (اذن توريد)
// ═══════════════════════════════════════════════════════════════

function createSupplyOrder({ supplierName = '', supplierId = null, warehouseId = 1, note = '', items = [] } = {}) {
  const seq = documentNumberService.generate('SUP');
  // Relational link (mventor-supplier-fk): a supply order may reference a real
  // supplier so it is queryable by supplier_id in the supplier-history view.
  // supplier_name is kept (denormalized + free-text fallback when no supplier_id
  // is chosen). supplier_id is validated — never trust an arbitrary FK.
  let resolvedSupplierId = null;
  if (supplierId) {
    const s = db.prepare('SELECT id, name FROM suppliers WHERE id = ?').get(parseInt(supplierId));
    if (!s) throw new Error('Supplier not found');
    resolvedSupplierId = s.id;
    if (!supplierName) supplierName = s.name;
  }
  const result = db.prepare(`
    INSERT INTO supply_orders (order_number, supplier_name, supplier_id, warehouse_id, status, note)
    VALUES (?, ?, ?, ?, 'draft', ?)
  `).run(seq.document_number, supplierName, resolvedSupplierId, parseInt(warehouseId) || 1, note || '');
  const orderId = result.lastInsertRowid;

  (Array.isArray(items) ? items : []).forEach(item => {
    if (item.product_id && item.qty > 0) {
      db.prepare(`
        INSERT INTO supply_order_items (supply_order_id, product_id, qty, unit_cost)
        VALUES (?, ?, ?, ?)
      `).run(orderId, item.product_id, Math.round(item.qty), Math.round(item.unit_cost || 0));
    }
  });

  return getOrderWithItems('supply_orders', 'supply_order_items', orderId);
}

function listSupplyOrders() {
  return db.prepare(`
    SELECT s.*,
           (SELECT COUNT(*) FROM supply_order_items i WHERE i.supply_order_id = s.id) as item_count,
           (SELECT COALESCE(SUM(i.qty), 0) FROM supply_order_items i WHERE i.supply_order_id = s.id) as total_qty
    FROM supply_orders s
    ORDER BY s.created_at DESC
  `).all();
}

function getSupplyOrder(id) {
  return getOrderWithItems('supply_orders', 'supply_order_items', id);
}

function addSupplyItem(orderId, productId, qty, unitCost = 0) {
  const order = db.prepare('SELECT * FROM supply_orders WHERE id = ?').get(orderId);
  if (!order) throw new Error('Supply order not found');
  if (order.status !== 'draft') throw new Error('Only draft supply orders can be edited');
  const product = db.prepare('SELECT id FROM products WHERE id = ?').get(productId);
  if (!product) throw new Error('Product not found');
  const result = db.prepare(`
    INSERT INTO supply_order_items (supply_order_id, product_id, qty, unit_cost)
    VALUES (?, ?, ?, ?)
  `).run(orderId, productId, Math.round(qty), Math.round(unitCost || 0));
  return db.prepare('SELECT * FROM supply_order_items WHERE id = ?').get(result.lastInsertRowid);
}

function removeSupplyItem(itemId) {
  const item = db.prepare('SELECT * FROM supply_order_items WHERE id = ?').get(itemId);
  if (!item) throw new Error('Item not found');
  const order = db.prepare('SELECT * FROM supply_orders WHERE id = ?').get(item.supply_order_id);
  if (!order || order.status !== 'draft') throw new Error('Only draft supply orders can be edited');
  db.prepare('DELETE FROM supply_order_items WHERE id = ?').run(itemId);
  return { success: true };
}

async function issueSupplyOrder(orderId, userId = '') {
  const order = getSupplyOrder(orderId);
  if (!order) throw new Error('Supply order not found');
  if (order.status !== 'draft') throw new Error('Only draft supply orders can be issued');

  // ATOMIC: all receipt movements + status commit together or not at all.
  // If any movement throws, the transaction rolls back the status update and
  // no partial stock changes are committed.
  db.transaction(() => {
    order.items.forEach(item => {
      inventoryService.createMovement({
        productId: item.product_id,
        warehouseId: order.warehouse_id || 1,
        type: 'receipt',
        reason: 'supply_order',
        referenceType: 'supply_order',
        referenceId: order.id,
        qtyChange: item.qty,
        unitCost: item.unit_cost,
        note: `Supply order ${order.order_number}: ${item.product_name}`,
        userId,
      });
    });

    db.prepare(`
      UPDATE supply_orders SET status = 'issued', issued_at = CURRENT_TIMESTAMP, issued_by = ? WHERE id = ?
    `).run(userId, orderId);
  });

  // Document (.md with QR + barcode)
  const doc = await documentService.buildMarkdownDocument({
    type: 'SUP',
    title: 'Supply Order',
    number: order.order_number,
    subtitle: `Supplier: ${order.supplier_name || '—'}`,
    meta: [
      ['Status', 'Issued'],
      ['Supplier', order.supplier_name || '—'],
      ['Issued by', userId || 'admin'],
    ],
    items: order.items.map(i => ({
      name: i.product_name,
      qty: i.qty,
      price: i.unit_cost,
      amount: i.unit_cost * i.qty,
    })),
    totals: [['Total Items', String(order.items.length)]],
    qrData: `SUP:${order.order_number}`,
    barcode: order.order_number,
  });

  notifyUsers(['inventory.manage'], 'Supply Order Issued', `Supply order ${order.order_number} stocked ${order.items.length} item(s)`, `/erp/supply-orders`);

  return { ...getSupplyOrder(orderId), document: doc };
}

function cancelSupplyOrder(orderId) {
  const order = db.prepare('SELECT * FROM supply_orders WHERE id = ?').get(orderId);
  if (!order) throw new Error('Supply order not found');
  if (order.status !== 'draft') throw new Error('Only draft supply orders can be cancelled');
  db.prepare("UPDATE supply_orders SET status = 'cancelled' WHERE id = ?").run(orderId);
  return getSupplyOrder(orderId);
}

// ═══════════════════════════════════════════════════════════════
// ISSUE ORDERS (اذن صرف)
// ═══════════════════════════════════════════════════════════════

function createIssueOrder({ customerName = '', note = '', items = [] } = {}) {
  const seq = documentNumberService.generate('ISS');
  const result = db.prepare(`
    INSERT INTO issue_orders (order_number, customer_name, status, note)
    VALUES (?, ?, 'draft', ?)
  `).run(seq.document_number, customerName, note || '');
  const orderId = result.lastInsertRowid;

  (Array.isArray(items) ? items : []).forEach(item => {
    if (item.product_id && item.qty > 0) {
      db.prepare(`
        INSERT INTO issue_order_items (issue_order_id, product_id, qty, unit_cost)
        VALUES (?, ?, ?, ?)
      `).run(orderId, item.product_id, Math.round(item.qty), Math.round(item.unit_cost || 0));
    }
  });

  return getOrderWithItems('issue_orders', 'issue_order_items', orderId);
}

function listIssueOrders({ status = '', search = '', from = '', to = '', page = 1, limit = 25 } = {}) {
  let where = 'WHERE 1=1';
  const params = [];
  if (status) { where += ' AND s.status = ?'; params.push(status); }
  if (search) { where += ' AND (s.order_number LIKE ? OR s.customer_name LIKE ? OR s.note LIKE ?)'; params.push('%' + search + '%', '%' + search + '%', '%' + search + '%'); }
  if (from) { where += ' AND date(s.created_at) >= ?'; params.push(from); }
  if (to) { where += ' AND date(s.created_at) <= ?'; params.push(to); }
  const countSql = 'SELECT COUNT(*) as total FROM issue_orders s ' + where;
  const totalRow = db.prepare(countSql).get(...params);
  const total = totalRow ? totalRow.total : 0;
  const p = Math.max(1, parseInt(page || 1));
  const l = Math.min(100, Math.max(1, parseInt(limit || 25)));
  const offset = (p - 1) * l;
  params.push(l, offset);
  const sql = 'SELECT s.*, (SELECT COUNT(*) FROM issue_order_items i WHERE i.issue_order_id = s.id) as item_count, (SELECT COALESCE(SUM(i.qty), 0) FROM issue_order_items i WHERE i.issue_order_id = s.id) as total_qty FROM issue_orders s ' + where + ' ORDER BY s.created_at DESC LIMIT ? OFFSET ?';
  const items = db.prepare(sql).all(...params);
  return { items, pagination: { page: p, limit: l, total, totalPages: Math.ceil(total / l) || 1, status, search, from, to } };
}

function getIssueOrder(id) {
  return getOrderWithItems('issue_orders', 'issue_order_items', id);
}

function addIssueItem(orderId, productId, qty, unitCost = 0) {
  const order = db.prepare('SELECT * FROM issue_orders WHERE id = ?').get(orderId);
  if (!order) throw new Error('Issue order not found');
  if (order.status !== 'draft') throw new Error('Only draft issue orders can be edited');
  const product = db.prepare('SELECT id FROM products WHERE id = ?').get(productId);
  if (!product) throw new Error('Product not found');
  const result = db.prepare(`
    INSERT INTO issue_order_items (issue_order_id, product_id, qty, unit_cost)
    VALUES (?, ?, ?, ?)
  `).run(orderId, productId, Math.round(qty), Math.round(unitCost || 0));
  return db.prepare('SELECT * FROM issue_order_items WHERE id = ?').get(result.lastInsertRowid);
}

function removeIssueItem(itemId) {
  const item = db.prepare('SELECT * FROM issue_order_items WHERE id = ?').get(itemId);
  if (!item) throw new Error('Item not found');
  const order = db.prepare('SELECT * FROM issue_orders WHERE id = ?').get(item.issue_order_id);
  if (!order || order.status !== 'draft') throw new Error('Only draft issue orders can be edited');
  db.prepare('DELETE FROM issue_order_items WHERE id = ?').run(itemId);
  return { success: true };
}

async function issueIssueOrder(orderId, warehouseId, userId = '') {
  const order = getIssueOrder(orderId);
  if (!order) throw new Error('Issue order not found');
  if (order.status !== 'draft') throw new Error('Only draft issue orders can be issued');
  if (!warehouseId) throw new Error('warehouseId is required to issue');

  // ATOMIC: all issue movements + status commit together or not at all.
  // db.transaction() rolls back on any throw — no manual correction moves needed.
  db.transaction(() => {
    order.items.forEach(item => {
      inventoryService.createMovement({
        productId: item.product_id,
        warehouseId,
        type: 'issue',
        reason: 'issue_order',
        referenceType: 'issue_order',
        referenceId: order.id,
        qtyChange: -item.qty,
        unitCost: item.unit_cost,
        note: `Issue order ${order.order_number}: ${item.product_name}`,
        userId,
      });
    });

    db.prepare(`
      UPDATE issue_orders SET status = 'issued', issued_at = CURRENT_TIMESTAMP, issued_by = ? WHERE id = ?
    `).run(userId, orderId);
  });

  // Document (.md with QR + barcode)
  const doc = await documentService.buildMarkdownDocument({
    type: 'ISS',
    title: 'Issue Order',
    number: order.order_number,
    subtitle: `Customer: ${order.customer_name || '—'}`,
    meta: [
      ['Status', 'Issued'],
      ['Customer', order.customer_name || '—'],
      ['Warehouse', String(warehouseId)],
      ['Issued by', userId || 'admin'],
    ],
    items: order.items.map(i => ({
      name: i.product_name,
      qty: i.qty,
      price: i.unit_cost,
      amount: i.unit_cost * i.qty,
    })),
    totals: [['Total Items', String(order.items.length)]],
    qrData: `ISS:${order.order_number}`,
    barcode: order.order_number,
  });

  notifyUsers(
    ['inventory.packing', 'inventory.manage'],
    'Issue Order Issued',
    `Issue order ${order.order_number} dispatched ${order.items.length} item(s) — pack & deliver`,
    '/erp/issue-orders'
  );

  return { ...getIssueOrder(orderId), document: doc };
}

function cancelIssueOrder(orderId) {
  const order = db.prepare('SELECT * FROM issue_orders WHERE id = ?').get(orderId);
  if (!order) throw new Error('Issue order not found');
  if (order.status !== 'draft') throw new Error('Only draft issue orders can be cancelled');
  db.prepare("UPDATE issue_orders SET status = 'cancelled' WHERE id = ?").run(orderId);
  return getIssueOrder(orderId);
}

// ═══════════════════════════════════════════════════════════════
// FULFILLMENT PIPELINE (mventor-ticket-057)
// Paid order → auto Issue Order → packed → claimed/assigned →
// sent → delivering → delivered. Packaging consumed per item.
// ═══════════════════════════════════════════════════════════════

const FULFILL_TRANSITIONS = {
  issued: ['packed'],
  packed: ['sent'],          // claim/assign tracked separately via claim_status
  sent: ['delivering'],
  delivering: ['delivered'],
};

function usersWithRole(roleName) {
  return db.prepare(`
    SELECT DISTINCT u.id FROM users u
    WHERE u.is_active = 1 AND u.id IN (
      SELECT ur.user_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE r.name = ?
      UNION SELECT u2.id FROM users u2 JOIN roles r2 ON r2.id = u2.role_id WHERE r2.name = ? AND u2.role_id = r2.id
    )
  `).all(roleName, roleName).map(r => r.id);
}

function notifyRoles(roleNames, title, message, link) {
  const ids = new Set();
  roleNames.forEach(r => usersWithRole(r).forEach(id => ids.add(id)));
  ids.forEach(uid => notificationService.sendInApp(uid, title, message, link).catch(() => {}));
  return ids.size;
}

/**
 * Full-channel driver notification (mventor-ticket-057):
 * in-app + email + SMS (when a phone number exists on the account).
 */
function notifyDriver(driverId, title, message, link) {
  notificationService.sendInApp(driverId, title, message, link).catch(() => {});
  try {
    const u = db.prepare('SELECT email, phone FROM users WHERE id = ?').get(driverId);
    if (u && u.email) {
      const email = require('../email');
      const settingsService = require('./settingsService');
      const siteName = settingsService.siteIdentity().name;
      email.sendMail({
        to: u.email,
        subject: `${siteName} — ${title}`,
        html: `<div style="font-family:Arial;max-width:520px;margin:auto">
          <h3 style="color:#1f857a;">${title}</h3>
          <p style="color:#444;">${message}</p>
          ${link ? `<p><a href="${link}" style="background:#1f857a;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;">Open</a></p>` : ''}
        </div>`,
      }).catch(() => {});
    }
    if (u && u.phone) {
      const channels = require('./notificationChannels');
      channels.dispatch('sms', { to: u.phone, subject: title, body: `${title} — ${message}` }).catch(() => {});
    }
  } catch { /* best effort */ }
}

/**
 * Auto-create an Issue Order for a paid customer order.
 * Consumes packaging (1 × qty per item) using the configurable
 * `packaging_product_id` setting. Notifies packing staff.
 *
 * opts.temp: VIP on-bill flow — create the document but do NOT touch stock;
 * an admin approval later releases it (see vipService/approve flows).
 */
function createIssueForOrder(orderId, items, userId = '', opts = {}) {
  // Skip if an issue already exists for this order
  const existing = db.prepare('SELECT id FROM issue_orders WHERE order_id = ?').get(orderId);
  if (existing) return getIssueOrder(existing.id);

  // BUSINESS GUARD: an issue order must belong to a REAL order. FK is the final
  // database net, but we validate here so a bad orderId fails as a clean domain
  // error (zero partial writes) rather than a raw SQLite constraint error.
  const orderRow = db.prepare('SELECT id FROM orders WHERE id = ?').get(orderId);
  if (!orderRow) throw new Error(`Order #${orderId} not found — cannot create issue order`);

  // ATOMIC: issue_order + its line items + status commit together or not at all.
  let seq; let issueId; let totalQty = 0;
  db.transaction(() => {
    seq = documentNumberService.generate('ISS');
    const result = db.prepare(`
      INSERT INTO issue_orders (order_number, customer_name, status, note, order_id, is_temp)
      VALUES (?, ?, 'issued', ?, ?, ?)
    `).run(seq.document_number, `Order #${orderId}`, `Auto-created from paid order #${orderId}${opts.temp ? ' (TEMP — awaiting approval)' : ''}`, orderId, opts.temp ? 1 : 0);
    issueId = result.lastInsertRowid;

    (Array.isArray(items) ? items : []).forEach(it => {
      const pid = parseInt(it.id || it.product_id || 0);
      const qty = parseInt(it.qty || it.quantity || 1) || 1;
      if (!pid || qty <= 0) return;
      totalQty += qty;
      db.prepare(`
        INSERT INTO issue_order_items (issue_order_id, product_id, qty, unit_cost)
        VALUES (?, ?, ?, 0)
      `).run(issueId, pid, qty);
    });

    db.prepare(`
      UPDATE issue_orders SET status = 'issued', issued_at = CURRENT_TIMESTAMP, issued_by = ? WHERE id = ?
    `).run(userId || 'system', issueId);
  });

  if (!opts.temp) {
    // Packaging consumption: configurable product, 1 unit per item sold
    try {
      const packagingId = parseInt(settingsService.get('packaging_product_id', 0)) || 0;
      if (packagingId && totalQty > 0) {
        inventoryService.createMovement({
          productId: packagingId,
          warehouseId: inventoryService.resolveDefaultWarehouse(packagingId),
          type: 'issue',
          reason: 'packaging_consumption',
          referenceType: 'issue_order',
          referenceId: issueId,
          qtyChange: -totalQty,
          note: `Packaging for ${totalQty} item(s) — order #${orderId}`,
          userId: userId || 'system',
        });
      }
    } catch (err) {
      console.error('Packaging consumption failed:', err.message);
    }
  }

  notifyRoles(['super_admin', 'site_manager'],
    opts.temp ? `TEMP issue ${seq.document_number} (awaiting approval)` : `New issue ${seq.document_number}`,
    opts.temp
      ? `Order #${orderId} (VIP on-bill) — approve to release ${totalQty} item(s)`
      : `Order #${orderId} is ready to pick & pack (${totalQty} item(s))`,
    `/erp/issue-orders/${issueId}`);

  return getIssueOrder(issueId);
}

function _getIssue(id) {
  return db.prepare('SELECT * FROM issue_orders WHERE id = ?').get(id);
}

function _transitionIssue(id, allowedFrom, toStatus, stampColumn, extra = {}) {
  const issue = _getIssue(id);
  if (!issue) throw new Error('Issue order not found');
  if (!allowedFrom.includes(issue.status)) {
    throw new Error(`Cannot move from "${issue.status}" to "${toStatus}"`);
  }
  const sets = ['status = ?', 'updated_at = CURRENT_TIMESTAMP'];
  const params = [toStatus];
  if (stampColumn) { sets.push(`${stampColumn} = CURRENT_TIMESTAMP`); }
  Object.entries(extra).forEach(([k, v]) => { sets.push(`${k} = ?`); params.push(v); });
  params.push(id);
  db.prepare(`UPDATE issue_orders SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  return _getIssue(id);
}

/** Warehouse keeper finished packing — broadcast claim invite to all drivers */
function packIssue(id, userId) {
  const updated = _transitionIssue(id, ['issued'], 'packed', 'packed_at');
  if (updated.assigned_driver_id) {
    notifyDriver(updated.assigned_driver_id, `Issue ${updated.order_number} is PACKED`,
      'Reserved for you — ready for pickup.', `/erp/issue-orders/${id}`);
  } else {
    notifyRoles(['delivery_partner'], `Issue ${updated.order_number} is PACKED`,
      'Ready for pickup — claim it ("On my way") or wait for assignment.',
      `/erp/issue-orders/${id}`);
  }
  return updated;
}

/** Admin manually assigns a driver to a packed issue */
function assignDriver(id, driverId, userId) {
  const issue = _getIssue(id);
  if (!issue) throw new Error('Issue order not found');
  if (!['packed'].includes(issue.status)) throw new Error('Driver can only be assigned to a packed issue');
  const driver = db.prepare('SELECT id, name FROM users WHERE id = ? AND is_active = 1').get(driverId);
  if (!driver) throw new Error('Driver not found');
  db.prepare(`
    UPDATE issue_orders SET assigned_driver_id = ?, claim_status = 'assigned', updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(driverId, id);
  notificationService.sendInApp(driverId, `You are assigned to ${issue.order_number}`,
    'The issue is packed and reserved for you — mark it Sent when handed over.',
    `/erp/issue-orders/${id}`);
  return _getIssue(id);
}

/** Driver claims ("On my way") — 5-minute revert buffer enforced client-side */
function claimIssue(id, driverId) {
  const issue = _getIssue(id);
  if (!issue) throw new Error('Issue order not found');
  if (issue.status !== 'packed') throw new Error('Only packed issues can be claimed');
  if (issue.claim_status === 'claimed' && issue.claimed_by !== driverId) {
    throw new Error('Already claimed by another driver');
  }
  db.prepare(`
    UPDATE issue_orders SET claim_status = 'claimed', claimed_by = ?, claimed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(driverId, id);
  notifyRoles(['super_admin', 'site_manager'],
    `Issue ${issue.order_number} claimed`,
    `Driver is on the way to collect it`,
    `/erp/issue-orders/${id}`);
  return _getIssue(id);
}

/** Driver reverts a claim within the buffer window */
function unclaimIssue(id, driverId) {
  const issue = _getIssue(id);
  if (!issue || issue.claim_status !== 'claimed') throw new Error('Nothing to revert');
  if (issue.claimed_by !== driverId) throw new Error('Only the claiming driver can revert');
  const mins = (Date.now() - new Date(String(issue.claimed_at).replace(' ', 'T')).getTime()) / 60000;
  if (mins > 5) throw new Error('Revert window (5 minutes) has passed');
  db.prepare(`
    UPDATE issue_orders SET claim_status = 'none', claimed_by = NULL, claimed_at = NULL, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(id);
  return _getIssue(id);
}

/** Warehouse hands the parcel over — to the internal driver OR an external delivery company */
function markSent(id, userId, { externalProviderId } = {}) {
  const issue = _getIssue(id);
  if (!issue) throw new Error('Issue order not found');
  if (issue.status !== 'packed') throw new Error('Only packed issues can be sent');

  if (externalProviderId) {
    const provider = db.prepare('SELECT id, name FROM shipment_providers WHERE id = ? AND is_active = 1').get(externalProviderId);
    if (!provider) throw new Error('Delivery provider not found');
    db.prepare(`
      UPDATE issue_orders SET status = 'sent', sent_at = CURRENT_TIMESTAMP,
        sent_via = 'external', external_provider_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(provider.id, id);
    notifyRoles(['super_admin', 'site_manager'],
      `${issue.order_number} sent via ${provider.name}`,
      'External delivery company — live tracking disabled',
      `/erp/issue-orders/${id}`);
    return _getIssue(id);
  }

  const updated = _transitionIssue(id, ['packed'], 'sent', 'sent_at');
  updated.sent_via = 'driver';
  const target = updated.assigned_driver_id || updated.claimed_by;
  if (target) {
    notifyDriver(target, `${updated.order_number} handed to you`,
      'Mark it as Delivering when you start the route.', `/erp/issue-orders/${id}`);
  }
  return updated;
}

function markDelivering(id, driverId) {
  const updated = _transitionIssue(id, ['sent'], 'delivering', 'delivering_at');
  if (updated.sent_via === 'driver') {
    notifyRoles(['super_admin', 'site_manager'],
      `${updated.order_number} is out for delivery`, '', `/erp/issue-orders/${id}`);
  }
  return updated;
}

function markDelivered(id, driverId) {
  const updated = _transitionIssue(id, ['delivering'], 'delivered', 'delivered_at');
  if (updated.sent_via === 'driver') {
    notifyRoles(['super_admin', 'site_manager'],
      `${updated.order_number} DELIVERED ✔`, '', `/erp/issue-orders/${id}`);
  } else {
    notifyRoles(['super_admin', 'site_manager'],
      `${updated.order_number} delivered (external)`, '', `/erp/issue-orders/${id}`);
  }
  return updated;
}

const MAX_PERIOD_MONTHS = 60;

function createFinancialPeriod({ name, months }) {
  const m = parseInt(months, 10);
  if (!name || !name.trim()) throw new Error('Period name is required');
  if (isNaN(m) || m < 1 || m > MAX_PERIOD_MONTHS) {
    throw new Error(`Period length must be between 1 and ${MAX_PERIOD_MONTHS} months`);
  }
  const start = new Date();
  const end = new Date(start);
  end.setMonth(end.getMonth() + m);
  end.setDate(end.getDate() - 1); // inclusive end

  const fmt = (d) => d.toISOString().slice(0, 10);
  const result = db.prepare(`
    INSERT INTO financial_periods (name, start_date, end_date, months, status)
    VALUES (?, ?, ?, ?, 'OPEN')
  `).run(name.trim(), fmt(start), fmt(end), m);
  return db.prepare('SELECT * FROM financial_periods WHERE id = ?').get(result.lastInsertRowid);
}

function listFinancialPeriods() {
  return db.prepare('SELECT * FROM financial_periods ORDER BY start_date DESC').all();
}

function closeFinancialPeriod(id) {
  const period = db.prepare('SELECT * FROM financial_periods WHERE id = ?').get(id);
  if (!period) throw new Error('Financial period not found');
  db.prepare("UPDATE financial_periods SET status = 'CLOSED', closed_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
  return db.prepare('SELECT * FROM financial_periods WHERE id = ?').get(id);
}

/**
 * Reopen a closed period (mventor-ticket-085 — the 084 gate's companion).
 * Without this, the closed-period lock is one-way and corrections in closed
 * periods have no path. Coarse by design (whole period); fine-grained
 * controlled-adjust stays a future ticket. closed_at cleared so an OPEN
 * period never carries a stale closed stamp.
 */
function reopenFinancialPeriod(id) {
  const period = db.prepare('SELECT * FROM financial_periods WHERE id = ?').get(id);
  if (!period) throw new Error('Financial period not found');
  if (period.status !== 'CLOSED') throw new Error('Only closed periods can be reopened');
  db.prepare("UPDATE financial_periods SET status = 'OPEN', closed_at = NULL WHERE id = ?").run(id);
  return db.prepare('SELECT * FROM financial_periods WHERE id = ?').get(id);
}

/**
 * Set the opening balance for a period.
 * @param {number} periodId
 * @param {number} warehouseId
 * @param {Array<{product_id:number, qty:number}>} items - counted quantities
 */
function setOpeningBalance(periodId, warehouseId, items, userId = '') {
  const period = db.prepare('SELECT * FROM financial_periods WHERE id = ?').get(periodId);
  if (!period) throw new Error('Financial period not found');
  if (period.status !== 'OPEN') throw new Error('Only open periods can receive an opening balance');

  if (!Array.isArray(items) || items.length === 0) throw new Error('No opening balance items provided');

  items.forEach(item => {
    if (!item.product_id || item.qty === undefined) throw new Error('Each item needs product_id and qty');
    const current = inventoryService.getStock(item.product_id, warehouseId);
    const currentQty = current ? current.qty_on_hand : 0;
    inventoryService.createMovement({
      productId: item.product_id,
      warehouseId,
      type: 'opening_balance',
      reason: `financial_period:${period.name}`,
      referenceType: 'financial_period',
      referenceId: period.id,
      qtyChange: Math.round(item.qty) - currentQty, // set to the counted opening value
      note: `Opening balance for ${period.name}`,
      userId,
    });
  });

  db.prepare('UPDATE financial_periods SET opening_balance_set = 1 WHERE id = ?').run(periodId);
  return db.prepare('SELECT * FROM financial_periods WHERE id = ?').get(periodId);
}

module.exports = {
  MAX_PERIOD_MONTHS,
  // supply
  createSupplyOrder,
  listSupplyOrders,
  getSupplyOrder,
  addSupplyItem,
  removeSupplyItem,
  issueSupplyOrder,
  cancelSupplyOrder,
  // issue
  createIssueOrder,
  listIssueOrders,
  getIssueOrder,
  addIssueItem,
  removeIssueItem,
  issueIssueOrder,
  cancelIssueOrder,
  // financial periods
  createFinancialPeriod,
  listFinancialPeriods,
  closeFinancialPeriod,
  reopenFinancialPeriod,
  setOpeningBalance,
  // fulfillment pipeline (mventor-ticket-057)
  createIssueForOrder,
  packIssue,
  assignDriver,
  claimIssue,
  unclaimIssue,
  markSent,
  markDelivering,
  markDelivered,
};
