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

// ── Force-print helper: send a finished PDF to the DEFAULT printer ────────
// Tries SumatraPDF (silent), then Ghostscript, then Shell Print verb.
// Never throws — printing must not break the import operation.
const { execFile, spawn } = require('child_process');
function forcePrintPdf(pdfPath) {
  return new Promise((resolve) => {
    const done = (status) => resolve(status);
    const sumatraCandidates = [
      'C:/Program Files/SumatraPDF/SumatraPDF.exe',
      'C:/Program Files (x86)/SumatraPDF/SumatraPDF.exe',
    ];
    const sumatra = sumatraCandidates.find(p => fs.existsSync(p));
    if (sumatra) {
      execFile(sumatra, ['-print-to-default', '-silent', pdfPath],
        (err) => done(err ? 'print-failed' : 'printed'));
      return;
    }
    execFile('gswin64c', ['-dNOPAUSE', '-dBATCH', '-sDEVICE=mswinpr2', `-sOutputFile=%printer%`, pdfPath],
      (err) => {
        if (!err) return done('printed');
        // Shell verb — opens the association's print handler on Windows
        try {
          const ps = spawn('powershell.exe',
            ['-NoProfile', '-Command',
             `Start-Process -FilePath '${pdfPath.replace(/'/g, "''")}' -Verb Print -PassThru | Out-Null`],
            { detached: true, stdio: 'ignore' });
          ps.on('error', () => done('no-printer'));
          ps.unref();
          done('print-queued');
        } catch {
          done('no-printer');
        }
      });
  });
}

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

// ── POST /api/admin/products/import - Import products from CSV/XLSX (upsert by SKU or name) ──
router.post('/import', adminAuth, requirePermission('products.create'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Upload a CSV or XLSX file' });

    const ext = path.extname(req.file.originalname).toLowerCase();
    let rows = [];
    if (['.xlsx', '.xls'].includes(ext)) {
      const wb = XLSX.readFile(req.file.path);
      rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
    } else {
      const csv = fs.readFileSync(req.file.path, 'utf8');
      const ws = XLSX.read(csv, { type: 'string' });
      rows = XLSX.utils.sheet_to_json(ws.Sheets[ws.SheetNames[0]], { defval: '' });
    }
    fs.unlinkSync(req.file.path);

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'File has no data rows' });
    }

    const created = [];
    const updated = [];
    const errors = [];
    const userId = req.session.username || 'admin';

    // ── Image & variant helpers (mventor-ticket-058) ──
    // Web images are DOWNLOADED into the server and stored locally;
    // local paths are kept as-is. Images persist until replaced.
    async function storeImage(key, url) {
      const u = String(url || '').trim();
      if (!u) return '';
      if (u.startsWith('/')) return u; // already local
      if (!/^https?:\/\//i.test(u)) return u;
      try {
        const res = await fetch(u);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        let ext = (res.headers.get('content-type') || 'image/jpeg').split('/')[1].split(';')[0];
        if (ext === 'jpeg') ext = 'jpg';
        const name = `${key}-${Date.now()}-${Math.floor(Math.random() * 999)}.${ext}`;
        fs.writeFileSync(path.join(IMPORTED_IMG_DIR, name), Buffer.from(await res.arrayBuffer()));
        return `/images/products/imported/${name}`;
      } catch {
        return u; // graceful: keep the remote URL if download fails
      }
    }

    function parseList(v) {
      return String(v || '').split(';').map(s => s.trim()).filter(Boolean);
    }

    const VARIANT_PALETTE = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

    /** Create product_variants rows for every size × color combination. */
    function createVariants(productId, sku, sizes, colors) {
      const combos = [];
      const sizeList = sizes.length ? sizes : [null];
      const colorList = colors.length ? colors : [null];
      for (const s of sizeList) {
        for (const c of colorList) {
          const parts = [sku || `P${productId}`, s, c].filter(Boolean);
          const vSku = parts.join('-').replace(/\s+/g, '').toUpperCase();
          const attrs = {};
          if (c) attrs.color = [c];
          if (s) attrs.size = [s];
          db.prepare(`
            INSERT INTO product_variants (product_id, sku, attributes)
            VALUES (?, ?, ?)
          `).run(productId, vSku, JSON.stringify(attrs));
          combos.push({ size: s, color: c });
        }
      }
      return combos;
    }

    for (let i = 0; i < rows.length; i++) {
      const raw = rows[i];
      const line = i + 2; // 1-based + header row
      try {
        const name = String(raw.name || raw.Name || '').trim();
        if (!name) { errors.push({ line, error: 'name is required' }); continue; }

        // Single-price import (mventor-ticket-058): price_wholesale is the
        // required purchase cost; retail `price` is optional (set later via
        // the Pricing Manager).
        const wholesaleRaw = raw.price_wholesale !== undefined ? raw.price_wholesale : raw.Price;
        const wholesale = parseFloat(wholesaleRaw);
        if (isNaN(wholesale) || wholesale <= 0) {
          errors.push({ line, error: `invalid price_wholesale "${wholesaleRaw}"` });
          continue;
        }
        const priceRaw = raw.price !== undefined && raw.price !== '' ? raw.price : undefined;
        const price = priceRaw === undefined ? 0 : parseFloat(priceRaw);
        const priceCents = isNaN(price) || price <= 0 ? 0 : Math.round(price * 100);

        const sku = String(raw.sku || '').trim();
        // upsert: match by sku first, then by name
        let product = sku ? db.prepare('SELECT id FROM products WHERE sku = ?').get(sku) : null;
        if (!product) product = db.prepare('SELECT id FROM products WHERE name = ?').get(name);

        const oldPrice = raw.old_price !== '' && raw.old_price !== undefined && raw.old_price !== null ? Math.round(parseFloat(raw.old_price) * 100) : 0;
        const costPrice = raw.cost_price !== '' && raw.cost_price !== undefined && raw.cost_price !== null ? Math.round(parseFloat(raw.cost_price) * 100) : 0;
        // Wholesale-first (mventor-ticket-061): an explicit retail `price`
        // column wins; otherwise retail is derived from the default markup
        // over wholesale. Never writes 0/NaN into products.price.
        const resolvedRetail = pricingService.resolveRetail({
          priceCents,
          costCents: costPrice || Math.round(wholesale * 100),
        });
        const categoryId = resolveCategory(raw.category) || 1;
        const brandId = resolveBrand(raw.brand);
        const stock = parseInt(raw.stock) || 0;
        const minStock = parseInt(raw.min_stock) || 0;
        const reorder = parseInt(raw.reorder_point) || 0;
        const isNew = String(raw.is_new) === '1' || String(raw.is_new).toLowerCase() === 'true' ? 1 : 0;
        const active = String(raw.active) === '0' || String(raw.active).toLowerCase() === 'false' ? 0 : 1;

        if (product) {
          // ERP LAW (mventor-ticket-053): imports NEVER modify stock —
          // existing-product updates exclude the stock column entirely.
          db.prepare(`
            UPDATE products SET
              name = ?, description = ?, price = ?, old_price = ?, category_id = ?,
              image_url = ?, active = ?, brand_id = ?, sku = ?, barcode = ?,
              cost_price = ?, min_stock = ?, reorder_point = ?, is_new = ?,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(
            name,
            String(raw.description || '').trim(),
            resolvedRetail.price,
            oldPrice,
            categoryId,
            String(raw.image_url || '').trim(),
            active,
            brandId,
            sku,
            String(raw.barcode || '').trim(),
            costPrice,
            minStock,
            reorder,
            isNew,
            product.id
          );
          setWholesaleCost(product.id, raw.price_wholesale ?? raw['price_wholesale']);
          updated.push({
            id: product.id, name, line,
            price: resolvedRetail.price, stock_requested: stock,
            image_url: String(raw.image_url || '').trim(), result: 'updated',
          });
        } else {
          // New product: created at zero stock; any CSV quantity becomes an
          // opening_balance movement through the engine.
          const result = db.prepare(`
            INSERT INTO products (name, name_ar, description, description_ar, price, old_price, category_id, image_url, stock, active, brand_id, sku, barcode, cost_price, min_stock, reorder_point, is_new)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            name,
            String(raw.name_ar || raw['name_ar'] || '').trim(),
            String(raw.description || '').trim(),
            String(raw.description_ar || '').trim(),
            resolvedRetail.price,
            oldPrice,
            categoryId,
            String(raw.image_url || '').trim(),
            active,
            brandId,
            sku,
            String(raw.barcode || '').trim(),
            costPrice,
            minStock,
            reorder,
            isNew
          );
          try {
            inventoryService.recordInitialStock(result.lastInsertRowid, stock, userId);
          } catch (moveErr) {
            errors.push({ line, error: `initial stock: ${moveErr.message}` });
          }

          // ── Variants + images (mventor-ticket-058) ──
          const sizes = parseList(raw.sizes);
          const colors = parseList(raw.colors);
          if (sizes.length || colors.length) {
            const colorObjs = colors.map((cName, idx) => ({ name: cName, hex: VARIANT_PALETTE[idx % VARIANT_PALETTE.length] }));
            db.prepare('UPDATE products SET colors = ?, sizes = ? WHERE id = ?')
              .run(JSON.stringify(colorObjs), JSON.stringify(sizes.map(s => ({ name: s }))), result.lastInsertRowid);
            createVariants(result.lastInsertRowid, sku, sizes, colors);
          }

          // Main photo: local paths are COPIED+renamed; web URLs downloaded
          const mainImg = await storeImage(`p${result.lastInsertRowid}`, raw.image_url);
          if (mainImg) {
            db.prepare('UPDATE products SET image_url = ? WHERE id = ?').run(mainImg, result.lastInsertRowid);
            db.prepare('INSERT INTO product_images (product_id, image_url, sort_order, variant_attributes) VALUES (?, ?, 0, ?)')
              .run(result.lastInsertRowid, mainImg, '{}');
          }
          // Variant photos: "Red=/images/x/red.jpg; Blue=https://…"
          let vSort = 1;
          for (const pair of parseList(raw.variant_images)) {
            const eq = pair.indexOf('=');
            if (eq < 1) continue;
            const vName = pair.slice(0, eq).trim();
            const stored = await storeImage(`p${result.lastInsertRowid}-${vName}`, pair.slice(eq + 1).trim());
            if (!stored) continue;
            db.prepare('INSERT INTO product_images (product_id, image_url, sort_order, variant_attributes) VALUES (?, ?, ?, ?)')
              .run(result.lastInsertRowid, stored, vSort++, JSON.stringify({ color: [vName] }));
          }

          created.push({
            id: result.lastInsertRowid, name, line,
            price: resolvedRetail.price, stock_requested: stock,
            image_url: String(raw.image_url || '').trim(), result: 'created',
          });
          eventService.emit(eventService.EVENT_TYPES.PRODUCT_CREATED, eventService.ENTITY_TYPES.PRODUCT, result.lastInsertRowid, {
            userId, payload: { name, imported: true },
          });
        }
      } catch (err) {
        errors.push({ line, error: err.message });
      }
    }

    cache.invalidatePrefix('products:');

    // ── Auto-generated operation document (PDF) ─────────────────────────
    // Every import produces an official Opening-Balance / Import Operation
    // report: header metadata, one line per product, and totals.
    let pdf_url = null;
    let print_status = 'skipped';
    try {
      const PDFDocument = require('pdfkit');
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const pdfPath = path.join(REPORTS_DIR, `import-operation-${stamp}.pdf`);
      const warehouse = db.prepare('SELECT id, name FROM warehouses WHERE is_active = 1 ORDER BY id LIMIT 1').get();

      const doc = new PDFDocument({ size: 'A4', margin: 48 });
      doc.pipe(fs.createWriteStream(pdfPath));

      doc.fontSize(20).fillColor('#1a2332').text('Import Operation Report', { align: 'left' });
      doc.moveDown(0.2);
      doc.fontSize(10).fillColor('#555');
      doc.text(`Date: ${new Date().toLocaleString('en-GB')}`);
      doc.text(`Operator: ${userId}`);
      doc.text(`Warehouse: ${warehouse ? warehouse.name : 'Default'}`);
      doc.text(`Source file: ${req.file ? req.file.originalname : 'n/a'}`);
      doc.text(`Created: ${created.length}   Updated: ${updated.length}   Errors: ${errors.length}`);
      doc.moveDown();
      doc.rect(doc.x, doc.y, 500, 1).fill('#c9a227');
      doc.moveDown();

      // Table header
      const colX = [48, 250, 360, 430, 505];
      const drawHeader = () => {
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#1a2332');
        doc.text('#', colX[0], doc.y); doc.text('Product', colX[0] + 22, doc.y);
        doc.text('Qty', colX[2], doc.y); doc.text('Cost', colX[3], doc.y); doc.text('Value', colX[4], doc.y);
        doc.moveDown(0.4);
        doc.font('Helvetica');
      };
      drawHeader();
      let totalValue = 0;
      created.slice(0, 400).forEach((row, idx) => {
        if (doc.y > 760) { doc.addPage(); drawHeader(); }
        const p = db.prepare('SELECT cost_price FROM products WHERE id = ?').get(row.id) || {};
        const cost = (p.cost_price || 0) / 100;
        const value = cost * (row.stock_requested || 0);
        totalValue += value;
        doc.fontSize(8.5).fillColor('#333');
        const y = doc.y;
        doc.text(String(idx + 1), colX[0], y);
        doc.text(row.name.slice(0, 38), colX[0] + 22, y);
        doc.text(String(row.stock_requested || 0), colX[2], y);
        doc.text(cost.toFixed(2), colX[3], y);
        doc.text(value.toFixed(2), colX[4], y);
        doc.moveDown(0.35);
      });

      doc.moveTo(48, doc.y + 4).lineTo(545, doc.y + 4).strokeColor('#999').stroke();
      doc.moveDown(0.3);
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#1a2332');
      doc.text(`Total opening-balance value: ${totalValue.toFixed(2)} EGP`, 300, doc.y);

      doc.end();
      pdf_url = `/reports/${path.basename(pdfPath)}`;
      // Force-print to the default printer (best effort, never blocks)
      print_status = await forcePrintPdf(pdfPath);
    } catch (pdfErr) {
      console.error('PDF generation failed:', pdfErr.message);
    }

    // Archive the imported file permanently inside the server
    let savedPath = null;
    if (req.file && fs.existsSync(req.file.path)) {
      const safeName = String(req.file.originalname || 'import.csv')
        .replace(/[^A-Za-z0-9._-]/g, '_');
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      savedPath = path.join('data', 'imports', `${stamp}-${safeName}`);
      try {
        fs.copyFileSync(req.file.path, path.join(__dirname, '..', savedPath));
      } catch (archErr) {
        console.error('Import archive failed:', archErr.message);
        savedPath = null;
      }
    }

    res.json({
      imported: rows.length,
      created: created.length,
      updated: updated.length,
      errors,
      imported_rows: [...created, ...updated],
      saved_path: savedPath,
      pdf_url,
      print_status,
    });
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    console.error('Error importing products:', err);
    res.status(500).json({ error: err.message || 'Failed to import products' });
  }
});

module.exports = router;
