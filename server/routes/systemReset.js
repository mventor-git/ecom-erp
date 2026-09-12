/**
 * System Reset — "fresh start" (mventor-ticket-061)
 * Mounted at /api/admin/system.
 *
 * POST /fresh-start — TOTAL data wipe behind a super-admin gate:
 *   1. Takes a full database snapshot via the backup service (safety net).
 *   2. Transactionally clears ALL operational + catalog data:
 *      orders, customers (+ mobile artifacts), inventory movements & stock,
 *      warehouses/locations, purchasing, suppliers, products/categories/
 *      brands (+ images & variants), slides/announcements, notifications,
 *      the events audit log and document sequences.
 *   3. Recreates the single seed warehouse so the movement engine works.
 *
 * KEPT on purpose: settings (identity, pricing lists, integrations),
 * roles/permissions and staff accounts (admin login must survive).
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const adminAuth = require('../middleware/adminAuth');
const { requirePermission } = require('../middleware/rbac');
const cache = require('../cache');
const backupService = require('../services/backupService');

// Wipe order respects FK references (children before parents).
const WIPE_TABLES = [
  // Sales
  'order_items',
  'orders',
  'cart_items',
  'wishlist',
  'reviews',
  // Customers + their artifacts
  'vip_cart',
  'vip_invites',
  'customer_verifications',
  'user_addresses',
  'device_tokens',
  'customers',
  // Inventory (movements are immutable history — a reset is the only eraser)
  'inventory_movements',
  'inventory',
  // Warehouse topology
  'locations',
  'warehouses',
  // Purchasing
  'supplier_payment_applications',
  'supplier_payments',
  'purchase_order_items',
  'purchase_orders',
  'product_suppliers',
  'suppliers',
  // Catalog
  'product_images',
  'product_variants',
  'products',
  'categories',
  'brands',
  // Storefront content
  'welcome_slides',
  'hero_slides',
  'announcements',
  // Messaging + audit
  'notifications',
  'in_app_notifications',
  'events',
  // Numbering restarts from zero with everything else
  'document_sequences',
  // N1: request bookkeeping (not ledger truth) — stale claims are wiped too
  'idempotency_records',
];

router.post('/fresh-start', adminAuth, requirePermission('settings.manage'), async (req, res) => {
  try {
    // 1 ── Safety net: snapshot BEFORE anything is touched.
    const backupPath = await backupService.createBackup();
    const backupName = require('path').basename(backupPath);

    const counts = {};
    // 2 ── One atomic sweep; any failure rolls the whole wipe back.
    db.transaction(() => {
      for (const table of WIPE_TABLES) {
        try {
          const r = db.prepare(`DELETE FROM ${table}`).run();
          counts[table] = r.changes;
        } catch {
          counts[table] = 'skipped'; // table not present in older DBs
        }
      }

      // 3 ── The system needs one warehouse to operate; recreate the seed row.
      db.prepare("INSERT INTO warehouses (name, code, address) VALUES ('Main Warehouse', 'WH-MAIN', '')").run();
      counts.warehouses_recreated = 1;

      // Start IDs from 1 again — a true fresh start.
      for (const table of WIPE_TABLES) {
        try { db.prepare(`DELETE FROM sqlite_sequence WHERE name = ?`).run(table); } catch { /* no sequence */ }
      }
    });

    cache.invalidatePrefix('products:');

    const eventService = require('../services/eventService');
    eventService.emit(eventService.EVENT_TYPES.SYSTEM_RESET, eventService.ENTITY_TYPES.SYSTEM, 0, {
      userId: req.session.username || 'admin',
      payload: { backup: backupName, tables_wiped: counts },
    });

    res.json({ success: true, backup: backupName, wiped: counts });
  } catch (err) {
    console.error('Fresh start error:', err);
    res.status(500).json({ error: err.message || 'Fresh start failed' });
  }
});

module.exports = router;
