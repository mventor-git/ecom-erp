/**
 * Product Trash Service (mventor-ticket-044)
 *
 * Soft delete ("trash") with full reversibility:
 *   - Trash sets deleted_at, snapshots active into restore_active, flips active to 0
 *     (every customer-facing listing already filters active = 1).
 *   - Warehouse reset: the `inventory` snapshot rows for trashed products are wiped
 *     (snapshot table is a derived cache) and legacy products.stock syncs to 0.
 *   - `inventory_movements` rows are NEVER touched (immutable source of truth).
 *   - Restore rebuilds each product's inventory snapshot by replaying movement sums,
 *     restores the exact prior active state, and leaves post-trash products untouched.
 */

const db = require('../db');
const cache = require('../cache');
const eventService = require('./eventService');
const inventoryService = require('./inventoryService');

/** Rebuild the inventory snapshot for one product from its movement history. */
function rebuildInventoryFromMovements(productId) {
  const rows = db.prepare(`
    SELECT warehouse_id, location_id, SUM(qty_change) as net_qty
    FROM inventory_movements
    WHERE product_id = ?
    GROUP BY warehouse_id, location_id
  `).all(productId);

  for (const row of rows) {
    const locationId = row.location_id === undefined ? null : row.location_id;
    const existing = db.prepare(`
      SELECT id FROM inventory
      WHERE product_id = ? AND warehouse_id = ? AND location_id IS ?
    `).get(productId, row.warehouse_id, locationId);

    if (existing) {
      db.prepare(`
        UPDATE inventory
        SET qty_on_hand = ?, qty_reserved = 0, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(row.net_qty, existing.id);
    } else {
      db.prepare(`
        INSERT INTO inventory (product_id, warehouse_id, location_id, qty_on_hand, qty_reserved)
        VALUES (?, ?, ?, ?, 0)
      `).run(productId, row.warehouse_id, locationId, row.net_qty);
    }
  }

  inventoryService.syncProductStock(productId);
}

function emit(eventType, productId, userId, payload) {
  eventService.emit(eventType, eventService.ENTITY_TYPES.PRODUCT, productId, {
    userId: userId || 'admin',
    userRole: 'admin',
    payload,
  });
}

/**
 * Move every non-trashed product to trash and reset warehouse stock snapshots.
 * @returns {{count: number}}
 */
function trashAll(userId) {
  const trashed = db.prepare('SELECT id FROM products WHERE deleted_at IS NULL').all();
  const ids = trashed.map(p => p.id);
  if (ids.length === 0) return { count: 0 };

  const placeholders = ids.map(() => '?').join(',');
  db.prepare(`
    UPDATE products
    SET deleted_at = CURRENT_TIMESTAMP, restore_active = active, active = 0
    WHERE id IN (${placeholders})
  `).run(...ids);

  db.prepare(`DELETE FROM inventory WHERE product_id IN (${placeholders})`).run(...ids);
  ids.forEach(id => inventoryService.syncProductStock(id));
  cache.invalidatePrefix('products:');

  emit(eventService.EVENT_TYPES.PRODUCTS_TRASHED_ALL, 0, userId, { trashed: ids.length });
  return { count: ids.length };
}

/**
 * Move a single product to trash.
 * @returns {boolean} false when the product does not exist / is already trashed
 */
function trashOne(productId, userId) {
  const product = db.prepare(
    'SELECT id, name FROM products WHERE id = ? AND deleted_at IS NULL'
  ).get(productId);
  if (!product) return false;

  db.prepare(`
    UPDATE products
    SET deleted_at = CURRENT_TIMESTAMP, restore_active = active, active = 0
    WHERE id = ?
  `).run(product.id);

  db.prepare('DELETE FROM inventory WHERE product_id = ?').run(product.id);
  inventoryService.syncProductStock(product.id);
  cache.invalidatePrefix('products:');

  emit(eventService.EVENT_TYPES.PRODUCT_TRASHED, product.id, userId, { name: product.name });
  return true;
}

/** List all trashed products (newest first). */
function listTrashed() {
  return db.prepare(`
    SELECT p.id, p.name, p.price, p.image_url, p.active, p.restore_active,
           p.deleted_at, c.name as category_name
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.deleted_at IS NOT NULL
    ORDER BY p.deleted_at DESC, p.id DESC
  `).all();
}

function restoreRow(product, userId) {
  db.prepare(`
    UPDATE products
    SET deleted_at = NULL,
        active = COALESCE(restore_active, 1),
        restore_active = NULL
    WHERE id = ?
  `).run(product.id);

  rebuildInventoryFromMovements(product.id);
}

/**
 * Restore ALL trashed products (merge — products created after the trash
 * action are never touched because their deleted_at is already NULL).
 * @returns {{count: number}}
 */
function restoreAll(userId) {
  const trashed = db.prepare('SELECT id, name FROM products WHERE deleted_at IS NOT NULL').all();
  for (const p of trashed) {
    restoreRow(p, userId);
    emit(eventService.EVENT_TYPES.PRODUCT_RESTORED, p.id, userId, { name: p.name });
  }

  cache.invalidatePrefix('products:');
  if (trashed.length > 0) {
    emit(eventService.EVENT_TYPES.PRODUCTS_RESTORED_ALL, 0, userId, { restored: trashed.length });
  }
  return { count: trashed.length };
}

/**
 * Restore a single trashed product.
 * @returns {boolean} false when not found in trash
 */
function restoreOne(productId, userId) {
  const product = db.prepare(
    'SELECT id, name FROM products WHERE id = ? AND deleted_at IS NOT NULL'
  ).get(productId);
  if (!product) return false;

  restoreRow(product, userId);
  cache.invalidatePrefix('products:');
  emit(eventService.EVENT_TYPES.PRODUCT_RESTORED, product.id, userId, { name: product.name });
  return true;
}

module.exports = {
  trashAll,
  trashOne,
  listTrashed,
  restoreAll,
  restoreOne,
};
