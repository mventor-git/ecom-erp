/**
 * Products Import/Export (CSV / XLSX) + smart search support.
 * Mounted at /api/admin/products/export + /api/admin/products/import
 * (registered AFTER routes/admin.js so no route conflicts).
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const db = require('../db');
const adminAuth = require('../middleware/adminAuth');
const { requirePermission } = require('../middleware/rbac');

// Operation-report printing REMOVED (095 productization): silently driving the
// machine's DEFAULT PRINTER on every import is not a product behavior — it
// wasted paper and surprised operators. The import result JSON + archived
// source file are the record; onboarding summaries render in the UI instead.

const cache = require('../cache');
const eventService = require('../services/eventService');
const inventoryService = require('../services/inventoryService');
const pricingService = require('../services/pricingService');

// Reports output dir — auto-generated import operation PDFs land here
const REPORTS_DIR = path.join(__dirname, '..', 'public', 'reports');
fs.mkdirSync(REPORTS_DIR, { recursive: true });

const UPLOAD_DIR = path.join(__dirname, '..', 'data', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const upload = multer({ dest: UPLOAD_DIR });

// Permanent archive of every import file (mventor-ticket-053):
// server/data/imports/<timestamp>-<original-name>
const IMPORT_ARCHIVE_DIR = path.join(__dirname, '..', 'data', 'imports');
fs.mkdirSync(IMPORT_ARCHIVE_DIR, { recursive: true });

// Managed store for imported product photos (mventor-ticket-058):
// web URLs are downloaded here; local paths are COPIED here with a
// generated name. Images persist until replaced by a newer import.
const IMPORTED_IMG_DIR = path.join(__dirname, '..', 'public', 'images', 'products', 'imported');
fs.mkdirSync(IMPORTED_IMG_DIR, { recursive: true });

// ── CSV helpers ──

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

function resolveCategory(nameOrSlug) {
  if (!nameOrSlug) return null;
  const slug = String(nameOrSlug).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  let cat = db.prepare('SELECT id FROM categories WHERE slug = ? OR name = ?').get(slug, String(nameOrSlug).trim());
  if (!cat && slug) {
    cat = { id: db.prepare('INSERT INTO categories (name, slug) VALUES (?, ?)').run(String(nameOrSlug).trim(), slug).lastInsertRowid };
  }
  return cat ? cat.id : null;
}

function resolveBrand(name) {
  if (!name) return null;
  const clean = String(name).trim();
  let brand = db.prepare('SELECT id FROM brands WHERE name = ?').get(clean);
  if (!brand) {
    const slug = clean.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    brand = { id: db.prepare('INSERT INTO brands (name, slug) VALUES (?, ?)').run(clean, slug).lastInsertRowid };
  }
  return brand ? brand.id : null;
}

// NOTE (mventor-ticket-054): imports carry the base retail `price` column
// plus an optional `price_wholesale` column. Semi-Wholesale / Offer are
// managed per-product in the admin panel and displayed on the storefront.

/**
 * Wholesale = the price YOU bought the item at (purchase cost).
 * The CSV's price_wholesale column feeds products.cost_price, which powers
 * COGS, profit reports and the Pricing Manager markup engine.
 */
function setWholesaleCost(productId, priceEgp) {
  const val = parseFloat(priceEgp);
  if (isNaN(val) || val <= 0) return false;
  db.prepare('UPDATE products SET cost_price = ? WHERE id = ?')
    .run(Math.round(val * 100), productId);
  return true;
}

// ── GET /api/admin/products/export - Export all products as CSV ──
router.get('/export', adminAuth, requirePermission('products.read'), (req, res) => {
  try {
    const products = db.prepare(`
      SELECT p.id, p.name, p.description, p.price, p.old_price,
             c.name as category, b.name as brand,
             p.stock, p.sku, p.barcode, p.cost_price, p.min_stock, p.reorder_point,
             p.is_new, p.active, p.image_url, p.created_at
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN brands b ON b.id = p.brand_id
      ORDER BY p.id
    `).all();

    // Single-price export: base retail price only. Other price lists are
    // managed per-product in the admin panel (mventor-ticket-054).
    const rows = products.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description || '',
      price: ((p.price || 0) / 100).toFixed(2),
      old_price: p.old_price ? ((p.old_price || 0) / 100).toFixed(2) : '',
      category: p.category || '',
      brand: p.brand || '',
      stock: p.stock || 0,
      sku: p.sku || '',
      barcode: p.barcode || '',
      cost_price: p.cost_price ? ((p.cost_price || 0) / 100).toFixed(2) : '',
      min_stock: p.min_stock || 0,
      reorder_point: p.reorder_point || 0,
      is_new: p.is_new || 0,
      active: p.active || 1,
      image_url: p.image_url || '',
    }));

    const csv = toCsv(rows);
    const filename = `products_${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) {
    console.error('Error exporting products:', err);
    res.status(500).json({ error: 'Failed to export products' });
  }
});

// ── POST /api/admin/products/import - LEGACY entry (InventoryDashboard modal).
// Behavior moved to the onboarding service (095): preview-validated, ALL-OR-
// NOTHING transactional, no printer side effects. Response keys stay the same
// for the existing modal: imported/created/updated/errors/imported_rows.
router.post('/import', adminAuth, requirePermission('products.create'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Upload a CSV or XLSX file' });
    const onboarding = require('../services/onboardingImport');
    const userId = req.session.username || 'admin';
    const allowNew = !['0', 'false', 'no'].includes(String(req.body.allow_new_categories ?? '1').toLowerCase());
    const outcome = onboarding.commit({ type: 'products', buffer: req.file.buffer, filename: req.file.originalname, opts: { allow_new_categories: allowNew }, userId });
    try { await onboarding.landImages(outcome); } catch { /* decorations never fail an import */ }
    cache.invalidatePrefix('products:');
    // Audit trail (parity with the pre-095 route): one PRODUCT_CREATED event per new row
    for (const r of (outcome.records || []).filter((x) => x.action === 'create')) {
      eventService.emit(eventService.EVENT_TYPES.PRODUCT_CREATED, eventService.ENTITY_TYPES.PRODUCT, r.id, {
        userId, payload: { name: r.name, imported: true },
      });
    }
    res.json({
      imported: outcome.rows,
      created: outcome.created,
      updated: outcome.updated,
      errors: [], // all-or-nothing: a commit either fully passes or never happens
      imported_rows: (outcome.records || []).map((r) => ({ id: r.id, name: r.name, line: r.line, result: r.action === 'create' ? 'created' : 'updated' })),
      aborted_note: null,
    });
  } catch (err) {
    const msg = String(err && err.message || err);
    if (/commit aborted|invalid row|row|File|no data|Too many|exceeds|must|required|valid|duplicate|does not exist/i.test(msg)) {
      return res.status(400).json({ error: msg });
    }
    console.error('Error importing products:', msg);
    res.status(500).json({ error: 'Failed to import products' });
  }
});
module.exports = router;
