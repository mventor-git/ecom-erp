const db = require('../db');
const eventService = require('./eventService');

const MOVEMENT_TYPES = {
  OPENING_BALANCE: 'opening_balance',
  RECEIPT: 'receipt',
  ISSUE: 'issue',
  ADJUSTMENT: 'adjustment',
  TRANSFER: 'transfer',
  RETURN: 'return',
  DAMAGE: 'damage',
  RESERVATION: 'reservation',
  RELEASE: 'release',
  CORRECTION: 'correction',
  COUNT: 'count',
};

const STOCK_INCREASING = [
  MOVEMENT_TYPES.OPENING_BALANCE,
  MOVEMENT_TYPES.RECEIPT,
  MOVEMENT_TYPES.RETURN,
  MOVEMENT_TYPES.CORRECTION,
  MOVEMENT_TYPES.COUNT,
];

const STOCK_DECREASING = [
  MOVEMENT_TYPES.ISSUE,
  MOVEMENT_TYPES.DAMAGE,
  MOVEMENT_TYPES.RESERVATION,
];

function getStock(productId, warehouseId, locationId) {
  let sql = 'SELECT * FROM inventory WHERE product_id = ? AND warehouse_id = ?';
  const params = [productId, warehouseId];

  if (locationId !== undefined && locationId !== null) {
    sql += ' AND location_id = ?';
    params.push(locationId);
  } else {
    sql += ' AND location_id IS NULL';
  }

  return db.prepare(sql).get(...params);
}

function createMovement({ productId, warehouseId, locationId, type, reason, referenceType, referenceId,
                         qtyChange, countedQty, unitCost, note, userId, setProductCost = true, deriveRetail = false }) {
  if (!productId || !warehouseId || !type) {
    throw new Error('productId, warehouseId, and type are required');
  }

  const validTypes = Object.values(MOVEMENT_TYPES);
  if (!validTypes.includes(type)) {
    throw new Error(`Invalid movement type: ${type}. Must be one of: ${validTypes.join(', ')}`);
  }

  // Period gate (mventor-ticket-084): no new stock truth inside a CLOSED
  // financial period — every type, no side doors. Twin of the journal post
  // gate (kept local: no cross-domain import in either direction).
  // Movements timestamp at creation, so "today" always governs.
  // Stabilization P0#7: accounting controls FAIL CLOSED — a failed lookup is
  // NOT "no closed period"; it means the control is unavailable → refuse.
  const closedPeriod = (() => {
    try {
      return db.prepare(`
        SELECT id, name FROM financial_periods
        WHERE status = 'CLOSED' AND date('now') BETWEEN date(start_date) AND date(end_date)
        ORDER BY id DESC LIMIT 1
      `).get() || null;
    } catch (err) {
      throw new Error(`Movement blocked: financial period control unavailable — refusing to record: ${err.message}`);
    }
  })();
  if (closedPeriod) {
    throw new Error(`Movement blocked: today falls in closed financial period "${closedPeriod.name}" (reopen required)`);
  }

  // Trash guard (mventor-ticket-044/045): trashed products must not receive
  // inventory movements until restored.
  const prod = db.prepare('SELECT deleted_at FROM products WHERE id = ?').get(productId);
  if (!prod) {
    throw new Error(`Product ${productId} not found`);
  }
  if (prod.deleted_at) {
    throw new Error(`Product ${productId} is in the trash. Restore it before performing inventory operations.`);
  }

  const inv = getStock(productId, warehouseId, locationId);
  const qtyBefore = inv ? inv.qty_on_hand : 0;

  // Reservation/Release move the qty_reserved bucket only — physical on-hand
  // is untouched (mventor-ticket-048 fix: previously both changed, double-counting).
  const touchesReservedOnly = type === MOVEMENT_TYPES.RESERVATION || type === MOVEMENT_TYPES.RELEASE;

  // Inventory count: admin enters the COUNTED quantity, we compute the delta
  if (type === MOVEMENT_TYPES.COUNT) {
    if (countedQty === undefined || countedQty === null) {
      throw new Error('countedQty is required for inventory counts');
    }
    qtyChange = Math.round(countedQty) - qtyBefore;
  }

  if (qtyChange === undefined || qtyChange === null) {
    throw new Error('qtyChange is required');
  }

  const qtyAfter = touchesReservedOnly ? qtyBefore : qtyBefore + qtyChange;

  // Financial correctness: stock-OUT always carries a cost. If the caller
  // omitted one (manual issue/damage), book the product's CURRENT wholesale
  // — exactly what website orders do — so COGS is never silently zero.
  {
    const OUT_TYPES = [MOVEMENT_TYPES.ISSUE, MOVEMENT_TYPES.DAMAGE];
    if (OUT_TYPES.includes(type) && !unitCost) {
      const pRow = db.prepare('SELECT cost_price FROM products WHERE id = ?').get(productId);
      unitCost = pRow ? pRow.cost_price || 0 : 0;
    }
  }

  // Negative stock is configurable (settings `allow_negative_stock`, mventor-ticket-051)
  const allowNegative = !!require('./settingsService').get('allow_negative_stock', false);
  if (qtyAfter < 0 && !allowNegative) {
    if (type !== MOVEMENT_TYPES.ADJUSTMENT && type !== MOVEMENT_TYPES.CORRECTION && type !== MOVEMENT_TYPES.COUNT) {
      throw new Error(`Insufficient stock. Current: ${qtyBefore}, requested change: ${qtyChange}`);
    }
  }

  // Reservations must not exceed AVAILABLE stock (on hand - reserved)
  if (type === MOVEMENT_TYPES.RESERVATION && qtyChange < 0) {
    const reserved = inv ? inv.qty_reserved || 0 : 0;
    const available = qtyBefore - reserved;
    if (available + qtyChange < 0) {
      throw new Error(`Insufficient available stock. Available: ${available}, requested reservation: ${Math.abs(qtyChange)}`);
    }
  }

  const result = db.prepare(`
    INSERT INTO inventory_movements (product_id, warehouse_id, location_id, type, reason, reference_type, reference_id, qty_change, qty_before, qty_after, unit_cost, note, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    productId, warehouseId, locationId || null, type, reason || '', referenceType || '',
    referenceId || null, qtyChange, qtyBefore, qtyAfter, unitCost || 0, note || '', userId || ''
  );

  _updateInventory(productId, warehouseId, locationId, qtyAfter, type, qtyChange);

  // Keep the storefront's products.stock in sync (total across all warehouses)
  syncProductStock(productId);

  // Smart movement costing (wholesale-baseline model): ANY stock-in that
  // carries what was actually paid sets the product's default wholesale —
  // the Pricing Engine baseline. Opt out with setProductCost=false; pair
  // with deriveRetail to also refresh retail from the default markup.
  const STOCK_IN_TYPES = [MOVEMENT_TYPES.RECEIPT, MOVEMENT_TYPES.OPENING_BALANCE, MOVEMENT_TYPES.RETURN];
  if (STOCK_IN_TYPES.includes(type) && unitCost > 0 && setProductCost) {
    db.prepare('UPDATE products SET cost_price = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(unitCost, productId);
    // PRESERVE the received cost as a reusable layer so the configurable
    // inventory-costing + retail-pricing engines (valuationService) have real
    // history. Overlapping/multiple costs are NEVER overwritten — each receipt
    // is its own layer. Non-fatal if layer writing is unavailable.
    try {
      require('./valuationService').addLayer({
        productId, warehouseId, qty: qtyChange, unitCost,
        sourceMovementId: result.lastInsertRowid,
      });
    } catch (layerErr) { /* layer recording is best-effort */ }
    if (deriveRetail) {
      try {
        const valuationService = require('./valuationService');
        const retail = valuationService.retailPrice(productId, warehouseId);
        if (retail != null) {
          // Retail follows the configured cost basis (e.g. HIGHEST purchase cost)
          // — independent of which layer this receipt happens to be.
          db.prepare('UPDATE products SET price = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run(retail, productId);
        } else {
          const pricingService = require('./pricingService');
          db.prepare('UPDATE products SET price = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run(pricingService.retailFromCost(unitCost), productId);
        }
      } catch { /* pricing settings unavailable — wholesale still applied */ }
    }
  }

  _emitMovementEvent(result.lastInsertRowid, productId, warehouseId, type, qtyChange, qtyBefore, qtyAfter, userId);

  // Receipt + notification (mventor-ticket-055): every movement produces a
  // printable receipt (QR + barcode) and notifies inventory staff.
  _deliverReceipt(result.lastInsertRowid, userId);

  checkLowStock(productId, warehouseId);

  return db.prepare('SELECT * FROM inventory_movements WHERE id = ?').get(result.lastInsertRowid);
}

/**
 * Fire-and-forget: build the movement's Markdown receipt and notify
 * inventory staff. Never blocks or fails the movement itself.
 */
function _deliverReceipt(movementId, userId) {
  // Skip inside Jest — async receipts outlive the test environment
  if (process.env.JEST_WORKER_ID) return;
  Promise.resolve().then(async () => {
    const m = db.prepare('SELECT * FROM inventory_movements WHERE id = ?').get(movementId);
    if (!m) return;
    const product = db.prepare('SELECT name FROM products WHERE id = ?').get(m.product_id);
    const warehouse = db.prepare('SELECT name FROM warehouses WHERE id = ?').get(m.warehouse_id);
    const documentService = require('./documentService');

    await documentService.buildMarkdownDocument({
      type: 'MOV',
      title: 'Stock Movement Receipt',
      number: `MOV-${m.id}`,
      subtitle: `${String(m.type).toUpperCase()} · ${product ? product.name : `Product #${m.product_id}`}`,
      meta: [
        ['Movement ID', `MOV-${m.id}`],
        ['Type', m.type],
        ['Quantity', `${m.qty_change > 0 ? '+' : ''}${m.qty_change}`],
        ['Before → After', `${m.qty_before} → ${m.qty_after}`],
        ['Warehouse', warehouse ? warehouse.name : m.warehouse_id],
        ['Reason', m.reason || '—'],
        ['Recorded by', m.created_by || userId || 'system'],
      ],
      totals: [['Stock After', String(m.qty_after)]],
      qrData: `MOV:${m.id}`,
      barcode: String(m.id).padStart(8, '0'),
      footer: 'Automatically generated at movement time.',
    });

    try {
      const permissionService = require('./permissionService');
      const notificationService = require('./notificationService');
      const recipients = permissionService.usersWithPermission('inventory.manage');
      const sign = m.qty_change > 0 ? '+' : '';
      for (const uid of recipients) {
        notificationService.sendInApp(
          uid,
          `Stock movement MOV-${m.id}`,
          `${m.type}: ${sign}${m.qty_change} × ${product ? product.name : 'product'} (${warehouse ? warehouse.name : 'warehouse'}) — tap to open receipt`,
          `/inventory/movements?receipt=${m.id}`
        ).catch(() => {});
      }
    } catch { /* notifications are best-effort */ }
  }).catch(err => {
    console.error('Movement receipt failed:', err.message);
  });
}

/** Total qty_on_hand for a product across all warehouses/locations */
function getTotalStock(productId) {
  const row = db.prepare('SELECT COALESCE(SUM(qty_on_hand), 0) as total FROM inventory WHERE product_id = ?').get(productId);
  return row ? row.total : 0;
}

/**
 * Resolve the warehouse where a product's stock lives by default:
 * product.default_warehouse_id → WH-MAIN → first active warehouse.
 */
function resolveDefaultWarehouse(productId) {
  const p = db.prepare('SELECT default_warehouse_id FROM products WHERE id = ?').get(productId);
  if (p && p.default_warehouse_id) return p.default_warehouse_id;
  const main = db.prepare("SELECT id FROM warehouses WHERE code = 'WH-MAIN' AND is_active = 1").get();
  if (main) return main.id;
  const any = db.prepare('SELECT id FROM warehouses WHERE is_active = 1 ORDER BY id LIMIT 1').get();
  return any ? any.id : null;
}

/**
 * ERP LAW (mventor-ticket-053): the ONLY way stock enters the system is a
 * movement. Record a product's initial in-stock quantity as an
 * opening_balance movement through the engine.
 * @returns {object|null} the created movement (null when qty <= 0 / no warehouse)
 */
function recordInitialStock(productId, qty, userId = '') {
  const quantity = parseInt(qty) || 0;
  if (quantity <= 0) return null;
  const warehouseId = resolveDefaultWarehouse(productId);
  if (!warehouseId) throw new Error('No active warehouse available for initial stock');
  return createMovement({
    productId,
    warehouseId,
    type: MOVEMENT_TYPES.OPENING_BALANCE,
    reason: 'initial_stock',
    referenceType: 'product_creation',
    referenceId: productId,
    qtyChange: quantity,
    note: 'Initial in-stock recorded at product creation',
    userId,
  });
}

/** Mirror the ERP inventory into the legacy products.stock used by the storefront */
function syncProductStock(productId) {
  db.prepare('UPDATE products SET stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(getTotalStock(productId), productId);
}

function _updateInventory(productId, warehouseId, locationId, newQty, type, qtyChange) {
  const existing = getStock(productId, warehouseId, locationId);

  if (existing) {
    let setClause = 'qty_on_hand = ?, updated_at = CURRENT_TIMESTAMP';
    const params = [newQty];

    if (type === MOVEMENT_TYPES.RESERVATION || type === MOVEMENT_TYPES.RELEASE) {
      // Only the reserved bucket moves; on-hand stays untouched.
      // The delta is the movement's own qtyChange (newQty == current on-hand here).
      setClause = type === MOVEMENT_TYPES.RESERVATION
        ? 'qty_reserved = qty_reserved + ?, updated_at = CURRENT_TIMESTAMP'
        : 'qty_reserved = MAX(0, qty_reserved - ?), updated_at = CURRENT_TIMESTAMP';
      params.length = 0;
      params.push(Math.abs(qtyChange));
    } else if (type === MOVEMENT_TYPES.COUNT) {
      setClause = 'qty_on_hand = ?, last_counted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP';
    }

    let sql = `UPDATE inventory SET ${setClause} WHERE id = ?`;
    params.push(existing.id);
    db.prepare(sql).run(...params);
  } else if (type === MOVEMENT_TYPES.RESERVATION || type === MOVEMENT_TYPES.RELEASE) {
    // No snapshot row yet: reservations require existing stock, so this only
    // happens for no-op releases — record a zero row to stay consistent.
    db.prepare(`
      INSERT INTO inventory (product_id, warehouse_id, location_id, qty_on_hand, qty_reserved, min_stock, max_stock, reorder_point)
      VALUES (?, ?, ?, 0, 0, 0, 0, 0)
    `).run(productId, warehouseId, locationId || null);
  } else {
    db.prepare(`
      INSERT INTO inventory (product_id, warehouse_id, location_id, qty_on_hand, qty_reserved, min_stock, max_stock, reorder_point)
      VALUES (?, ?, ?, ?, 0, 0, 0, 0)
    `).run(productId, warehouseId, locationId || null, newQty);
  }
}

function _emitMovementEvent(movementId, productId, warehouseId, type, qtyChange, qtyBefore, qtyAfter, userId) {
  const eventMap = {
    [MOVEMENT_TYPES.ADJUSTMENT]: eventService.EVENT_TYPES.INVENTORY_ADJUSTED,
    [MOVEMENT_TYPES.TRANSFER]: eventService.EVENT_TYPES.INVENTORY_TRANSFERRED,
    [MOVEMENT_TYPES.COUNT]: eventService.EVENT_TYPES.INVENTORY_COUNTED,
  };

  const eventType = eventMap[type] || 'inventory_movement';

  eventService.emit(eventType, eventService.ENTITY_TYPES.INVENTORY, movementId, {
    userId: userId || '',
    payload: {
      productId,
      warehouseId,
      movementType: type,
      qtyChange,
      qtyBefore,
      qtyAfter,
    },
  });
}

function checkLowStock(productId, warehouseId) {
  const inv = getStock(productId, warehouseId);
  if (!inv) return null;

  const product = db.prepare('SELECT min_stock, reorder_point, name FROM products WHERE id = ?').get(productId);
  if (!product) return null;

  const threshold = product.reorder_point || product.min_stock || 0;
  if (threshold > 0 && inv.qty_on_hand <= threshold) {
    eventService.emit(eventService.EVENT_TYPES.LOW_STOCK_ALERT, eventService.ENTITY_TYPES.INVENTORY, inv.id, {
      payload: {
        productId,
        warehouseId,
        qtyOnHand: inv.qty_on_hand,
        threshold,
        productName: product.name,
      },
    });
    return { alert: true, qtyOnHand: inv.qty_on_hand, threshold, productName: product.name };
  }

  if (inv.qty_on_hand <= 0) {
    eventService.emit(eventService.EVENT_TYPES.OUT_OF_STOCK, eventService.ENTITY_TYPES.INVENTORY, inv.id, {
      payload: {
        productId,
        warehouseId,
        productName: product.name,
      },
    });
    return { alert: true, outOfStock: true, productName: product.name };
  }

  return { alert: false };
}

function replayMovements(productId, warehouseId) {
  const movements = db.prepare(`
    SELECT * FROM inventory_movements
    WHERE product_id = ? AND warehouse_id = ?
    ORDER BY created_at ASC, id ASC
  `).all(productId, warehouseId);

  // Reservation/release move the reserved bucket only — they never change
  // on-hand, so exclude them from the physical stock replay.
  const stockMovements = movements.filter(m => m.type !== 'reservation' && m.type !== 'release');

  let runningQty = 0;
  const replayed = movements.map(m => {
    if (m.type !== 'reservation' && m.type !== 'release') runningQty += m.qty_change;
    return {
      ...m,
      computed_qty_before: runningQty - (m.type !== 'reservation' && m.type !== 'release' ? m.qty_change : 0),
      computed_qty_after: runningQty,
    };
  });

  const inv = getStock(productId, warehouseId);
  const currentStock = inv ? inv.qty_on_hand : 0;

  return {
    productId,
    warehouseId,
    movements: replayed,
    totalMovements: replayed.length,
    computedStock: runningQty,
    currentStock,
    consistent: runningQty === currentStock,
  };
}

function getMovements(filters = {}) {
  const {
    productId,
    warehouseId,
    locationId,
    type,
    referenceType,
    referenceId,
    userId,
    dateFrom,
    dateTo,
    limit = 50,
    offset = 0,
  } = filters;

  let sql = 'SELECT * FROM inventory_movements WHERE 1=1';
  const params = [];

  if (productId) {
    sql += ' AND product_id = ?';
    params.push(productId);
  }
  if (warehouseId) {
    sql += ' AND warehouse_id = ?';
    params.push(warehouseId);
  }
  if (locationId) {
    sql += ' AND location_id = ?';
    params.push(locationId);
  }
  if (type) {
    sql += ' AND type = ?';
    params.push(type);
  }
  if (referenceType) {
    sql += ' AND reference_type = ?';
    params.push(referenceType);
  }
  if (referenceId) {
    sql += ' AND reference_id = ?';
    params.push(referenceId);
  }
  if (userId) {
    sql += ' AND created_by = ?';
    params.push(userId);
  }
  if (dateFrom) {
    sql += ' AND created_at >= ?';
    params.push(dateFrom);
  }
  if (dateTo) {
    sql += ' AND created_at <= ?';
    params.push(dateTo);
  }

  sql += ' ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  return db.prepare(sql).all(...params);
}

module.exports = {
  MOVEMENT_TYPES,
  createMovement,
  getStock,
  getTotalStock,
  resolveDefaultWarehouse,
  recordInitialStock,
  syncProductStock,
  replayMovements,
  getMovements,
  checkLowStock,
};
