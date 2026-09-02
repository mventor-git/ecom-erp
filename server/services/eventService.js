/**
 * Event Service â€” Immutable audit trail for all significant actions.
 * 
 * Events are the foundation for:
 * - Audit trails
 * - Timelines
 * - Notifications (mventor-ticket-029)
 * - Analytics (mventor-ticket-032)
 * 
 * Events are IMMUTABLE â€” never UPDATE or DELETE.
 */

const db = require('../db');

// Event types by category
const EVENT_TYPES = {
  // Order events
  ORDER_CREATED: 'order_created',
  ORDER_PAID: 'order_paid',
  ORDER_SHIPPED: 'order_shipped',
  ORDER_DELIVERED: 'order_delivered',
  ORDER_CANCELLED: 'order_cancelled',
  ORDER_REFUNDED: 'order_refunded',
  ORDER_CONFIRMED: 'order_confirmed',
  ORDER_PACKING: 'order_packing',
  ORDER_READY: 'order_ready_for_shipping',
  ORDER_COMPLETED: 'order_completed',
  ORDER_STATUS_CHANGED: 'order_status_changed',
  ORDER_AUTO_APPROVED: 'order_auto_approved',

  // Inventory events
  INVENTORY_ADJUSTED: 'inventory_adjusted',
  INVENTORY_TRANSFERRED: 'inventory_transferred',
  INVENTORY_COUNTED: 'inventory_counted',
  LOW_STOCK_ALERT: 'low_stock_alert',
  OUT_OF_STOCK: 'out_of_stock',

  // Product events
  PRODUCT_CREATED: 'product_created',
  PRODUCT_UPDATED: 'product_updated',
  PRODUCT_DEACTIVATED: 'product_deactivated',
  PRODUCT_DELETED: 'product_deleted',
  PRODUCT_TRASHED: 'product_trashed',
  PRODUCTS_TRASHED_ALL: 'products_trashed_all',
  PRODUCT_RESTORED: 'product_restored',
  PRODUCTS_RESTORED_ALL: 'products_restored_all',

  // User events
  USER_LOGIN: 'user_login',
  USER_LOGOUT: 'user_logout',
  USER_CREATED: 'user_created',
  USER_UPDATED: 'user_updated',

  // Warehouse events
  WAREHOUSE_CREATED: 'warehouse_created',
  WAREHOUSE_UPDATED: 'warehouse_updated',
  WAREHOUSE_DEACTIVATED: 'warehouse_deactivated',

  // Supplier events
  SUPPLIER_CREATED: 'supplier_created',
  SUPPLIER_UPDATED: 'supplier_updated',
  SUPPLIER_DEACTIVATED: 'supplier_deactivated',
  SUPPLIER_PRODUCT_LINKED: 'supplier_product_linked',
  SUPPLIER_PRODUCT_UNLINKED: 'supplier_product_unlinked',

  // Purchase order events
  PO_CREATED: 'purchase_order_created',
  PO_SENT: 'purchase_order_sent',
  PO_CONFIRMED: 'purchase_order_confirmed',
  PO_RECEIVED: 'purchase_order_received',
  PO_CANCELLED: 'purchase_order_cancelled',

  // Pricing & system
  PRICING_APPLIED: 'pricing_applied',
  PRICING_REVERTED: 'pricing_reverted',
  SYSTEM_RESET: 'system_reset',
};

// Entity types
const ENTITY_TYPES = {
  ORDER: 'order',
  PRODUCT: 'product',
  INVENTORY: 'inventory',
  WAREHOUSE: 'warehouse',
  LOCATION: 'location',
  PURCHASE_ORDER: 'purchase_order',
  SUPPLIER: 'supplier',
  USER: 'user',
  SYSTEM: 'system',
};

/**
 * Emit an immutable event.
 * 
 * @param {string} eventType - The type of event (e.g., 'order_created')
 * @param {string} entityType - The type of entity (e.g., 'order')
 * @param {number} entityId - The ID of the entity
 * @param {object} options - Additional options
 * @param {string} options.userId - Who performed the action
 * @param {string} options.userRole - Role of the user
 * @param {object} options.payload - Additional data (JSON)
 * @param {object} options.metadata - Metadata (IP, user agent, etc.)
 * @returns {object} The created event record
 */
function emit(eventType, entityType, entityId, options = {}) {
  const {
    userId = '',
    userRole = '',
    payload = {},
    metadata = {},
  } = options;

  const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const metadataStr = typeof metadata === 'string' ? metadata : JSON.stringify(metadata);

  const result = db.prepare(`
    INSERT INTO events (event_type, entity_type, entity_id, user_id, user_role, payload, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(eventType, entityType, entityId, userId, userRole, payloadStr, metadataStr);

  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(result.lastInsertRowid);

  const notificationService = require('./notificationService');
  notificationService.process(eventType, { ...payload, entity_type: entityType, entity_id: entityId, user_id: userId }).catch(err => {
    console.error('[eventService] Notification processing failed:', err.message);
  });

  // Dispatch to registered webhooks (fire-and-forget, self-catches)
  const webhookService = require('./webhookService');
  webhookService.dispatch(eventType, { ...payload, entity_type: entityType, entity_id: entityId, user_id: userId });

  // Future: Update analytics (mventor-ticket-032)

  return event;
}

/**
 * Convenience alias used by backupService / twoFactorService: the data object
 * becomes the event payload. Never throws — audit logging must not take down
 * the operation it is trying to record.
 */
function logEvent(eventType, entityType, entityId, data = {}) {
  try {
    return emit(eventType, entityType || 'system', entityId ?? 0, { payload: data });
  } catch (err) {
    console.error('[eventService] logEvent failed:', err.message);
    return null;
  }
}

/**
 * Get timeline of events for a specific entity.
 * 
 * @param {string} entityType - The type of entity
 * @param {number} entityId - The ID of the entity
 * @param {object} options - Query options
 * @param {number} options.limit - Max number of events (default 50)
 * @param {number} options.offset - Offset for pagination (default 0)
 * @returns {Array} Array of events in chronological order
 */
function getTimeline(entityType, entityId, options = {}) {
  const { limit = 50, offset = 0 } = options;

  return db.prepare(`
    SELECT * FROM events
    WHERE entity_type = ? AND entity_id = ?
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(entityType, entityId, limit, offset);
}

/**
 * Get events by type with optional filters.
 * 
 * @param {string} eventType - The type of event
 * @param {object} filters - Query filters
 * @param {string} filters.entityType - Filter by entity type
 * @param {string} filters.userId - Filter by user
 * @param {string} filters.dateFrom - Filter from date (ISO string)
 * @param {string} filters.dateTo - Filter to date (ISO string)
 * @param {number} filters.limit - Max number of events (default 50)
 * @param {number} filters.offset - Offset for pagination (default 0)
 * @returns {Array} Array of events
 */
function getByType(eventType, filters = {}) {
  const {
    entityType,
    userId,
    dateFrom,
    dateTo,
    limit = 50,
    offset = 0,
  } = filters;

  let sql = 'SELECT * FROM events WHERE event_type = ?';
  const params = [eventType];

  if (entityType) {
    sql += ' AND entity_type = ?';
    params.push(entityType);
  }

  if (userId) {
    sql += ' AND user_id = ?';
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

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  return db.prepare(sql).all(...params);
}

/**
 * Get all events with optional filters (for admin dashboard).
 * 
 * @param {object} filters - Query filters
 * @returns {Array} Array of events
 */
function getAll(filters = {}) {
  const {
    entityType,
    entityId,
    eventType,
    userId,
    dateFrom,
    dateTo,
    limit = 50,
    offset = 0,
  } = filters;

  let sql = 'SELECT * FROM events WHERE 1=1';
  const params = [];

  if (entityType) {
    sql += ' AND entity_type = ?';
    params.push(entityType);
  }

  if (entityId) {
    sql += ' AND entity_id = ?';
    params.push(entityId);
  }

  if (eventType) {
    sql += ' AND event_type = ?';
    params.push(eventType);
  }

  if (userId) {
    sql += ' AND user_id = ?';
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

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  return db.prepare(sql).all(...params);
}

/**
 * Get event count by type (for analytics).
 * 
 * @returns {Array} Array of {event_type, count}
 */
function getCounts() {
  return db.prepare(`
    SELECT event_type, COUNT(*) as count
    FROM events
    GROUP BY event_type
    ORDER BY count DESC
  `).all();
}

module.exports = {
  emit,
  logEvent,
  getTimeline,
  getByType,
  getAll,
  getCounts,
  EVENT_TYPES,
  ENTITY_TYPES,
};
