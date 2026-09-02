/**
 * QR Code Service â€” Generate and resolve QR codes for resources.
 * mventor-ticket-030
 *
 * Supported entity types:
 *   PROD  â€” products
 *   VAR   â€” product variants
 *   SHIP  â€” shipments (orders with shipping status)
 *   ORD   â€” orders
 *   LOC   â€” warehouse locations
 *   PO    â€” purchase orders (document type)
 *
 * QR data format: "<PREFIX>:<ID>"  e.g. PROD:42, LOC:5, PO:2026-0001
 */

const QRCode = require('qrcode');
const db = require('../db');

const ENTITY_PREFIX = {
  PROD: 'PROD',
  VAR: 'VAR',
  SHIP: 'SHIP',
  ORD: 'ORD',
  LOC: 'LOC',
  PO: 'PO',
};

const PREFIX_TO_TABLE = {
  PROD: 'products',
  VAR: 'product_variants',
  SHIP: 'orders',
  ORD: 'orders',
  LOC: 'locations',
  PO: 'purchase_orders',
};

/**
 * Generate a QR code data URL for a given entity.
 *
 * @param {string} entityType - Entity prefix (e.g. 'PROD', 'LOC')
 * @param {string|number} entityId - Entity identifier
 * @returns {Promise<string>} QR code as data URL (PNG)
 */
async function generate(entityType, entityId) {
  const prefix = entityType.toUpperCase();
  if (!ENTITY_PREFIX[prefix]) {
    throw new Error(`Unknown entity type: ${entityType}`);
  }
  const data = `${prefix}:${entityId}`;
  return QRCode.toDataURL(data, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 256,
  });
}

/**
 * Resolve a QR code's raw data string to entity information.
 * Returns different fields depending on user permissions.
 *
 * @param {string} qrData - Raw QR data (e.g. "PROD:42")
 * @param {object} userPermissions - User context
 * @param {string} userPermissions.role - User role name
 * @param {string[]} userPermissions.permissions - User permission names
 * @returns {object|null} Resolved entity info or null if not found
 */
function resolve(qrData, userPermissions = {}) {
  if (!qrData || typeof qrData !== 'string') return null;

  const colonIdx = qrData.indexOf(':');
  if (colonIdx === -1) return null;

  const prefix = qrData.substring(0, colonIdx).toUpperCase();
  const entityId = qrData.substring(colonIdx + 1);

  if (!ENTITY_PREFIX[prefix]) return null;

  const entity = fetchEntity(prefix, entityId);
  if (!entity) return null;

  return filterByPermissions(prefix, entity, userPermissions);
}

function fetchEntity(prefix, entityId) {
  switch (prefix) {
    case ENTITY_PREFIX.PROD:
      return db.prepare(`
        SELECT p.id, p.name, p.sku, p.barcode, p.price, p.stock,
               p.deleted_at AS trashed,
               c.name AS category_name
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.id = ?
      `).get(entityId);

    case ENTITY_PREFIX.VAR:
      return db.prepare(`
        SELECT pv.id, pv.product_id, pv.sku, pv.barcode, pv.serial_number,
               pv.lot_number, pv.batch_number, pv.expiry_date,
               p.name AS product_name
        FROM product_variants pv
        JOIN products p ON pv.product_id = p.id
        WHERE pv.id = ?
      `).get(entityId);

    case ENTITY_PREFIX.ORD:
      return db.prepare(`
        SELECT o.id, o.customer_id, o.total, o.status, o.items, o.created_at,
               c.name AS customer_name, c.email AS customer_email
        FROM orders o
        LEFT JOIN customers c ON o.customer_id = c.id
        WHERE o.id = ?
      `).get(entityId);

    case ENTITY_PREFIX.SHIP:
      return db.prepare(`
        SELECT o.id, o.customer_id, o.total, o.status, o.items, o.created_at,
               c.name AS customer_name, c.email AS customer_email
        FROM orders o
        LEFT JOIN customers c ON o.customer_id = c.id
        WHERE o.id = ? AND o.status IN ('shipped', 'delivered')
      `).get(entityId);

    case ENTITY_PREFIX.LOC:
      return db.prepare(`
        SELECT l.id, l.name, l.barcode, l.warehouse_id, l.is_active,
               w.name AS warehouse_name, w.code AS warehouse_code
        FROM locations l
        JOIN warehouses w ON l.warehouse_id = w.id
        WHERE l.id = ?
      `).get(entityId);

    case ENTITY_PREFIX.PO:
      return db.prepare(`
        SELECT * FROM purchase_orders
        WHERE id = ? OR po_number = ?
      `).get(entityId, entityId);

    default:
      return null;
  }
}

function filterByPermissions(prefix, entity, userPermissions) {
  const { role, permissions = [] } = userPermissions;
  const isAdmin = role === 'super_admin' || role === 'admin';
  const hasInventory = permissions.includes('inventory.read') || isAdmin;
  const hasOrders = permissions.includes('orders.read') || isAdmin;
  const hasProducts = permissions.includes('products.read') || isAdmin;

  switch (prefix) {
    case ENTITY_PREFIX.PROD:
      if (!hasProducts) {
        return { id: entity.id, name: entity.name, type: 'product' };
      }
      return {
        id: entity.id,
        name: entity.name,
        sku: entity.sku,
        barcode: entity.barcode,
        price: hasOrders ? entity.price : undefined,
        stock: hasInventory ? entity.stock : undefined,
        category: entity.category_name,
        type: 'product',
      };

    case ENTITY_PREFIX.VAR:
      if (!hasProducts) {
        return { id: entity.id, product_name: entity.product_name, type: 'variant' };
      }
      return {
        id: entity.id,
        product_id: entity.product_id,
        product_name: entity.product_name,
        sku: entity.sku,
        barcode: entity.barcode,
        serial_number: hasInventory ? entity.serial_number : undefined,
        lot_number: hasInventory ? entity.lot_number : undefined,
        batch_number: hasInventory ? entity.batch_number : undefined,
        expiry_date: hasInventory ? entity.expiry_date : undefined,
        type: 'variant',
      };

    case ENTITY_PREFIX.ORD:
    case ENTITY_PREFIX.SHIP:
      if (!hasOrders) {
        return { id: entity.id, status: entity.status, type: prefix === ENTITY_PREFIX.SHIP ? 'shipment' : 'order' };
      }
      return {
        id: entity.id,
        status: entity.status,
        total: entity.total,
        items: entity.items,
        customer_name: entity.customer_name,
        customer_email: entity.customer_email,
        created_at: entity.created_at,
        type: prefix === ENTITY_PREFIX.SHIP ? 'shipment' : 'order',
      };

    case ENTITY_PREFIX.LOC:
      if (!hasInventory) {
        return { id: entity.id, name: entity.name, warehouse_name: entity.warehouse_name, type: 'location' };
      }
      return {
        id: entity.id,
        name: entity.name,
        barcode: entity.barcode,
        warehouse_id: entity.warehouse_id,
        warehouse_name: entity.warehouse_name,
        warehouse_code: entity.warehouse_code,
        is_active: entity.is_active,
        type: 'location',
      };

    case ENTITY_PREFIX.PO:
      if (!hasOrders) {
        return { id: entity.id, type: 'purchase_order' };
      }
      return { ...entity, type: 'purchase_order' };

    default:
      return entity;
  }
}

/**
 * Generate QR code for a product.
 * @param {number} productId
 * @returns {Promise<string>} QR code data URL
 */
async function generateForProduct(productId) {
  const product = db.prepare('SELECT id FROM products WHERE id = ?').get(productId);
  if (!product) throw new Error(`Product not found: ${productId}`);
  return generate(ENTITY_PREFIX.PROD, productId);
}

/**
 * Generate QR code for a warehouse location.
 * @param {number} locationId
 * @returns {Promise<string>} QR code data URL
 */
async function generateForLocation(locationId) {
  const location = db.prepare('SELECT id FROM locations WHERE id = ?').get(locationId);
  if (!location) throw new Error(`Location not found: ${locationId}`);
  return generate(ENTITY_PREFIX.LOC, locationId);
}

/**
 * Generate QR code for a document (purchase order, etc.).
 * @param {string} docType - Document type prefix (e.g. 'PO')
 * @param {string|number} docId - Document identifier
 * @returns {Promise<string>} QR code data URL
 */
async function generateForDocument(docType, docId) {
  const prefix = docType.toUpperCase();
  if (!ENTITY_PREFIX[prefix]) {
    throw new Error(`Unknown document type: ${docType}`);
  }
  return generate(prefix, docId);
}

module.exports = {
  generate,
  resolve,
  generateForProduct,
  generateForLocation,
  generateForDocument,
  ENTITY_PREFIX,
};
