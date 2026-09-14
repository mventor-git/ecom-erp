/**
 * Onboarding Import Service — master-data onboarding (mventor-ticket-095).
 *
 * The smallest coherent import system that makes a fresh ERP usable, per
 * dataset spec: PARSE (CSV/XLSX) -> PREVIEW (map, validate, duplicate
 * detection, exact counts) -> COMMIT (ONE transaction, all-or-nothing).
 * No half-imported masters, no hidden auto-writes: every change is either
 * an insert of a new row or a field update of the business-key-matched row,
 * with stock law preserved (updates NEVER alter inventory; new products'
 * opening stock posts real opening_balance movements through the engine).
 *
 * Business semantics live here — never in routes or React. Money columns
 * are major-unit text validated to INTEGER cents at parsing (<=2 decimals,
 * no silent truncation). Duplicate detection is per-dataset business key;
 * in-file duplicates are a VALIDATION ERROR (the operator fixes the sheet),
 * never a silent first-or-last wins.
 */

const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const db = require('../db');
const eventService = require('./eventService');
const inventoryService = require('./inventoryService');
const pricingService = require('./pricingService');

class RowError extends Error { constructor(m) { super(m); this.isRowError = true; } }

/* ── parsing ───────────────────────────────────────────────────────────── */

function parseTable(buffer, filename) {
  const ext = path.extname(String(filename || '')).toLowerCase();
  let rows;
  if (ext === '.xlsx' || ext === '.xls') {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    if (!wb.SheetNames.length) throw new RowError('Workbook has no sheets');
    rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
  } else {
    const text = Buffer.isBuffer(buffer) ? buffer.toString('utf8') : String(buffer);
    const ws = XLSX.read(text.replace(/^/, ''), { type: 'string' });
    rows = XLSX.utils.sheet_to_json(ws.Sheets[ws.SheetNames[0]], { defval: '' });
  }
  if (!Array.isArray(rows) || rows.length === 0) throw new RowError('File has no data rows');
  if (rows.length > 5000) throw new RowError(`Too many rows (${rows.length}; max 5000 per import)`);
  return rows;
}

/* ── cell validators (all return { value } or throw RowError) ──────────── */

function vRequiredText(label, max = 200) {
  return (raw) => {
    const s = String(raw == null ? '' : raw).trim();
    if (!s) throw new RowError(`${label} is required`);
    if (s.length > max) throw new RowError(`${label} exceeds ${max} characters`);
    return s;
  };
}
function vOptText(max = 500) {
  return (raw) => String(raw == null ? '' : raw).trim().slice(0, max);
}
const INT_RE = /^-?\d+$/;
function vInt(label, { min = null } = {}) {
  return (raw) => {
    const s = String(raw == null ? '' : raw).trim();
    if (!s) return 0;
    if (!INT_RE.test(s)) throw new RowError(`${label} must be a whole number (got "${s}")`);
    const n = Number(s);
    if (min != null && n < min) throw new RowError(`${label} must be >= ${min} (got ${n})`);
    return n;
  };
}
function vBool(label) {
  return (raw) => {
    const s = String(raw == null ? '' : raw).trim().toLowerCase();
    if (!s || s === '1' || s === 'true' || s === 'yes') return true;
    if (s === '0' || s === 'false' || no === 'no') return false;
    throw new RowError(`${label} must be 1/0, true/false or yes/no (got "${s}")`);
  };
}
// Major-unit money -> integer cents. <= 2 decimals REQUIRED (no silent
// truncation), > 0 when given. Empty -> null (caller decides requiredness).
const MONEY_RE = /^\d+(?:\.\d{1,2})?$/;
function vMoneyCents(label, { required = false } = {}) {
  return (raw) => {
    const s = String(raw == null ? '' : raw).trim().replace(/,/g, '');
    if (!s) {
      if (required) throw new RowError(`${label} is required`);
      return null;
    }
    if (!MONEY_RE.test(s)) throw new RowError(`${label} must be an amount in EGP with up to 2 decimals (got "${raw}")`);
    const cents = Math.round(Number(s) * 100);
    if (!(cents > 0)) {
      if (required) throw new RowError(`${label} must be greater than zero`);
      return null;
    }
    return cents;
  };
}
function vEmail(label, { required = false } = {}) {
  return (raw) => {
    const s = String(raw == null ? '' : raw).trim().toLowerCase();
    if (!s) {
      if (required) throw new RowError(`${label} is required`);
      return '';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) throw new RowError(`${label} is not a valid email (got "${raw}")`);
    if (s.length > 190) throw new RowError(`${label} too long`);
    return s;
  };
}
const PHONE_RE = /^\+?[\d][\d\s-]{6,19}$/;
function vPhone(label) {
  return (raw) => {
    const s = String(raw == null ? '' : raw).trim();
    if (!s) return '';
    if (!PHONE_RE.test(s)) throw new RowError(`${label} is not a valid phone (got "${raw}")`);
    return s.slice(0, 30);
  };
}
function vUrl(label) {
  return (raw) => {
    const s = String(raw == null ? '' : raw).trim();
    if (!s) return '';
    if (!/^(https?:\/\/|\/)/i.test(s)) throw new RowError(`${label} must be an http(s) URL or a local path (got "${s}")`);
    return s.slice(0, 500);
  };
}
function vCode(label) {
  return (raw) => {
    const s = String(raw == null ? '' : raw).trim();
    if (!s) return '';
    if (!/^[A-Za-z0-9][A-Za-z0-9._ -]{0,39}$/.test(s)) throw new RowError(`${label} may use letters, digits, dot, dash, underscore, space (max 40, got "${s}")`);
    return s;
  };
}

// case-insensitive column resolution
function pick(row, ...names) {
  const lower = {};
  for (const k of Object.keys(row)) lower[String(k).trim().toLowerCase()] = row[k];
  for (const n of names) {
    const v = lower[String(n).toLowerCase()];
    if (v !== undefined) return v;
  }
  return undefined;
}

/* ── dataset specs ─────────────────────────────────────────────────────── */

function slugOf(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function splitList(v) {
  return String(v || '').split(';').map((s) => s.trim()).filter(Boolean).slice(0, 20);
}

/** product_variants rows for every size × color combination (058 behavior). */
function createVariantCombos(productId, sku, sizes, colors) {
  const sizeList = sizes.length ? sizes : [null];
  const colorList = colors.length ? colors : [null];
  for (const s of sizeList) {
    for (const c of colorList) {
      const parts = [sku || `P${productId}`, s, c].filter(Boolean);
      const vSku = parts.join('-').replace(/\s+/g, '').toUpperCase();
      const attrs = {};
      if (c) attrs.color = [c];
      if (s) attrs.size = [s];
      try {
        db.prepare('INSERT INTO product_variants (product_id, sku, attributes) VALUES (?, ?, ?)').run(productId, vSku, JSON.stringify(attrs));
      } catch { /* duplicate vSKU within the sheet: variants are convenience, not ledger truth */ }
    }
  }
}

const SPECS = {
  products: {
    label: 'Products',
    permission: 'products.create',
    template: ['name', 'cost_price', 'price', 'old_price', 'category', 'brand', 'sku', 'barcode', 'stock', 'min_stock', 'reorder_point', 'description', 'image_url', 'sizes', 'colors', 'active'],
    businessKeyLabel: 'SKU then name',
    findExisting(ctx, plan) {
      if (plan.fields.sku) {
        const bySku = db.prepare('SELECT id FROM products WHERE sku = ? AND deleted_at IS NULL').get(plan.fields.sku);
        if (bySku) return bySku.id;
      }
      const byName = db.prepare('SELECT id FROM products WHERE LOWER(name) = ? AND deleted_at IS NULL').get(String(plan.fields.name).toLowerCase());
      return byName ? byName.id : null;
    },
    mapRow(ctx, raw, line) {
      const name = vRequiredText('name', 200)(pick(raw, 'name', 'Name'));
      const costCents = vMoneyCents('cost_price (purchase cost)', { required: true })(
        pick(raw, 'cost_price', 'cost price', 'price_wholesale', 'wholesale')
      );
      const priceCents = vMoneyCents('price (retail)')(pick(raw, 'price', 'retail_price'));
      const oldPrice = vMoneyCents('old_price')(pick(raw, 'old_price'));
      const sku = vCode('sku')(pick(raw, 'sku', 'SKU'));
      const barcodeRaw = String(pick(raw, 'barcode') || '').trim();
      const categoryId = ctx.resolveCategory(vOptText(80)(pick(raw, 'category')));
      const brandId = ctx.resolveBrand(vOptText(80)(pick(raw, 'brand')));
      const stock = vInt('stock', { min: 0 })(pick(raw, 'stock'));
      const resolved = pricingService.resolveRetail({ priceCents: priceCents || 0, costCents });
      return {
        fields: {
          name,
          name_ar: vOptText(200)(pick(raw, 'name_ar')),
          description: vOptText(4000)(pick(raw, 'description')),
          description_ar: vOptText(4000)(pick(raw, 'description_ar')),
          sku,
          barcode: barcodeRaw.slice(0, 60),
          cost_cents: costCents,
          price_cents: resolved.price, // explicit retail or markup-derived (never 0 silently: resolveRetail law)
          old_price_cents: oldPrice == null ? 0 : oldPrice,
          category_id: categoryId,
          brand_id: brandId,
          stock,
          min_stock: vInt('min_stock', { min: 0 })(pick(raw, 'min_stock')),
          reorder_point: vInt('reorder_point', { min: 0 })(pick(raw, 'reorder_point')),
          image_url: vUrl('image_url')(pick(raw, 'image_url')),
          sizes: vOptText(400)(pick(raw, 'sizes')),
          colors: vOptText(400)(pick(raw, 'colors')),
          active: vBool('active')(pick(raw, 'active')),
        },
        key: (sku || name), // in-file duplicate detection lane
      };
    },
    applyCreate(ctx, p, actor) {
      const f = p.fields;
      const res = db.prepare(`
        INSERT INTO products (name, name_ar, description, description_ar, price, old_price, category_id, brand_id,
          image_url, stock, active, cost_price, sku, barcode, min_stock, reorder_point, is_new)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, 0)
      `).run(f.name, f.name_ar, f.description, f.description_ar, f.price_cents, f.old_price_cents,
        f.category_id, f.brand_id, f.image_url, f.active ? 1 : 0, f.cost_cents, f.sku, f.barcode,
        f.min_stock, f.reorder_point);
      const id = res.lastInsertRowid;
      if (f.stock > 0) {
        inventoryService.recordInitialStock(id, f.stock, actor); // real opening_balance movement
      }
      const sizes = splitList(f.sizes);
      const colors = splitList(f.colors);
      if (sizes.length || colors.length) createVariantCombos(id, f.sku, sizes, colors);
      return { id };
    },
    applyUpdate(ctx, p, existingId) {
      const f = p.fields;
      // ERP LAW (053): updates NEVER touch stock — inventory moves via
      // receipt/adjustment/count, never an import cell.
      db.prepare(`
        UPDATE products SET name = ?, name_ar = ?, description = ?, description_ar = ?, price = ?, old_price = ?,
          category_id = ?, brand_id = ?, image_url = COALESCE(NULLIF(?, ''), image_url), active = ?, cost_price = ?, sku = ?, barcode = ?,
          min_stock = ?, reorder_point = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(f.name, f.name_ar, f.description, f.description_ar, f.price_cents, f.old_price_cents,
        f.category_id, f.brand_id, f.image_url, f.active ? 1 : 0, f.cost_cents, f.sku, f.barcode,
        f.min_stock, f.reorder_point, existingId);
      return { id: existingId };
    },
  },

  suppliers: {
    label: 'Suppliers',
    permission: 'suppliers.manage',
    template: ['name', 'contact_name', 'email', 'phone', 'address', 'lead_time_days', 'notes', 'active'],
    businessKeyLabel: 'name',
    findExisting(ctx, plan) {
      const r = db.prepare('SELECT id FROM suppliers WHERE LOWER(name) = ?').get(String(plan.fields.name).toLowerCase());
      return r ? r.id : null;
    },
    mapRow(ctx, raw) {
      const name = vRequiredText('name', 160)(pick(raw, 'name', 'Name'));
      return {
        fields: {
          name,
          contact_name: vOptText(120)(pick(raw, 'contact_name', 'contact')),
          email: vEmail('email')(pick(raw, 'email')),
          phone: vPhone('phone')(pick(raw, 'phone')),
          address: vOptText(300)(pick(raw, 'address')),
          lead_time_days: vInt('lead_time_days', { min: 0 })(pick(raw, 'lead_time_days', 'lead time')),
          notes: vOptText(1000)(pick(raw, 'notes')),
          active: vBool('active')(pick(raw, 'active', 'is_active')),
        },
        key: name.toLowerCase(),
      };
    },
    applyCreate(ctx, p) {
      const f = p.fields;
      const res = db.prepare('INSERT INTO suppliers (name, contact_name, email, phone, address, notes, lead_time_days, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(f.name, f.contact_name, f.email, f.phone, f.address, f.notes, f.lead_time_days, f.active ? 1 : 0);
      return { id: res.lastInsertRowid };
    },
    applyUpdate(ctx, p, id) {
      const f = p.fields;
      db.prepare('UPDATE suppliers SET name = ?, contact_name = ?, email = ?, phone = ?, address = ?, notes = ?, lead_time_days = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(f.name, f.contact_name, f.email, f.phone, f.address, f.notes, f.lead_time_days, f.active ? 1 : 0, id);
      return { id };
    },
  },

  customers: {
    label: 'Customers',
    permission: 'customers.manage',
    template: ['email', 'name', 'phone', 'address', 'city', 'governorate'],
    businessKeyLabel: 'email',
    findExisting(ctx, plan) {
      const r = db.prepare('SELECT id FROM customers WHERE LOWER(email) = ?').get(plan.fields.email);
      return r ? r.id : null;
    },
    mapRow(ctx, raw) {
      const email = vEmail('email', { required: true })(pick(raw, 'email', 'Email'));
      return {
        fields: {
          email,
          name: vOptText(120)(pick(raw, 'name', 'Name')) || email.split('@')[0],
          phone: vPhone('phone')(pick(raw, 'phone')),
          address: vOptText(300)(pick(raw, 'address')),
          city: vOptText(80)(pick(raw, 'city')),
          governorate: vOptText(80)(pick(raw, 'governorate')),
        },
        key: email,
      };
    },
    applyCreate(ctx, p) {
      const f = p.fields;
      const res = db.prepare('INSERT INTO customers (email, name, phone, address, city, governorate, is_verified) VALUES (?, ?, ?, ?, ?, ?, 1)')
        .run(f.email, f.name, f.phone, f.address, f.city, f.governorate);
      return { id: res.lastInsertRowid };
    },
    applyUpdate(ctx, p, id) {
      const f = p.fields;
      // Keep whatever account fields exist (google_id/password) — onboarding
      // enriches contact data only.
      db.prepare('UPDATE customers SET name = ?, phone = ?, address = ?, city = ?, governorate = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(f.name, f.phone, f.address, f.city, f.governorate, id);
      return { id };
    },
  },

  warehouses: {
    label: 'Warehouses',
    permission: 'warehouses.manage',
    template: ['code', 'name', 'address', 'active'],
    businessKeyLabel: 'code',
    findExisting(ctx, plan) {
      const r = db.prepare('SELECT id FROM warehouses WHERE LOWER(code) = ?').get(String(plan.fields.code).toLowerCase());
      return r ? r.id : null;
    },
    mapRow(ctx, raw) {
      const name = vRequiredText('name', 120)(pick(raw, 'name', 'Name'));
      const code = vRequiredText('code', 40)(pick(raw, 'code', 'Code'));
      return {
        fields: { name, code, address: vOptText(300)(pick(raw, 'address')), active: vBool('active')(pick(raw, 'active', 'is_active')) },
        key: String(code).toLowerCase(),
      };
    },
    applyCreate(ctx, p) {
      const f = p.fields;
      const res = db.prepare('INSERT INTO warehouses (name, code, address, is_active) VALUES (?, ?, ?, ?)')
        .run(f.name, f.code, f.address, f.active ? 1 : 0);
      return { id: res.lastInsertRowid };
    },
    applyUpdate(ctx, p, id) {
      const f = p.fields;
      db.prepare('UPDATE warehouses SET name = ?, address = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(f.name, f.address, f.active ? 1 : 0, id);
      return { id };
    },
  },
};

const IMPORT_PERMISSION = /^(products|suppliers|customers|warehouses)\.(create|manage)$/;
void IMPORT_PERMISSION; // documented shape: routes resolve spec.specFor(t).permission dynamically

/* ── context (category/brand resolution with EXPLICIT auto-create) ─────── */

function makeContext(type, rows, opts) {
  const spec = SPECS[type];
  if (!spec) throw new RowError(`Unknown import type "${type}" — supported: ${Object.keys(SPECS).join(', ')}`);
  const cats = new Map(db.prepare('SELECT id, LOWER(name) n FROM categories').all().map((r) => [String(r.n), r.id]));
  const slugs = new Map(db.prepare('SELECT id, slug FROM categories').all().map((r) => [String(r.slug), r.id]));
  const brands = new Map(db.prepare('SELECT id, LOWER(name) n FROM brands').all().map((r) => [String(r.n), r.id]));
  const created = { categories: new Set(), brands: new Set() };
  let createdCat = false, createdBrand = false;
  const allowNew = opts.allow_new_categories !== false;
  return {
    spec,
    get autoCreateDisabled() { return !allowNew; },
    get createdCategories() { return [...created.categories]; },
    get createdBrands() { return [...created.brands]; },
    get createdAny() { return createdCat || createdBrand; },
    resolveCategory(name) {
      const s = String(name || '').trim();
      if (!s) return null;
      const key = s.toLowerCase();
      const slug = slugOf(s);
      if (cats.has(key)) return cats.get(key);
      if (slugs.has(slug)) return slugs.get(slug);
      if (!allowNew) throw new RowError(`category "${s}" does not exist (new categories are disabled — create it first or allow auto-creation)`);
      const id = db.prepare('INSERT INTO categories (name, slug) VALUES (?, ?)').run(s, slug || key).lastInsertRowid;
      cats.set(key, id); slugs.set(slug || key, id); created.categories.add(s); createdCat = true;
      return id;
    },
    resolveBrand(name) {
      const s = String(name || '').trim();
      if (!s) return null;
      const key = s.toLowerCase();
      if (brands.has(key)) return brands.get(key);
      if (!allowNew) throw new RowError(`brand "${s}" does not exist (new brands are disabled — create it first or allow auto-creation)`);
      const id = db.prepare('INSERT INTO brands (name, slug) VALUES (?, ?)').run(s, slugOf(s) || key).lastInsertRowid;
      brands.set(key, id); created.brands.add(s); createdBrand = true;
      return id;
    },
    rows,
    lineOffset: 2,
  };
}

/* ── plan (pure: validation + duplicate detection, no writes except
        category/brand auto-creation, which only happens at COMMIT time —
        during preview resolution runs in a rolled-back SAVEPOINT) ───────── */

function planRows(ctx, rawRows) {
  const spec = ctx.spec;
  const plans = [];
  const byKey = new Map();
  for (let i = 0; i < rawRows.length; i++) {
    const line = i + 2; // data starts after the header row
    const raw = rawRows[i];
    let plan;
    try {
      plan = spec.mapRow(ctx, raw, line);
    } catch (e) {
      if (e.isRowError) { plans.push({ line, raw: sampleRaw(raw), action: 'error', error: e.message }); continue; }
      throw e;
    }
    const key = plan.key;
    if (key && byKey.has(key)) {
      plans.push({ line, raw: sampleRaw(raw), action: 'error', error: `duplicate of line ${byKey.get(key)} in the same file (business key "${key}")` });
      continue;
    }
    if (key) byKey.set(key, line);
    try {
      const existingId = spec.findExisting(ctx, plan);
      plans.push({ line, action: existingId ? 'update' : 'create', existing_id: existingId || null, fields: plan.fields, display: displayOf(plan.fields) });
    } catch (e) {
      plans.push({ line, action: 'error', error: e.message });
    }
  }
  return plans;
}

function sampleRaw(raw) {
  const out = {};
  for (const k of Object.keys(raw).slice(0, 8)) out[k] = String(raw[k] == null ? '' : raw[k]).slice(0, 40);
  return out;
}
function displayOf(f) {
  return f.name || f.email || f.code || '';
}

/* ── public API ────────────────────────────────────────────────────────── */

class Rollback extends Error { constructor() { super('__rollback__'); } }

function previewSafe({ type, buffer, filename, opts = {} }) {
  const spec = SPECS[type];
  if (!spec) throw new RowError(`Unknown import type "${type}" — supported: ${Object.keys(SPECS).join(', ')}`);
  const rows = parseTable(buffer, filename);
  let result;
  try {
    db.transaction(() => {
      const ctx = makeContext(type, rows, opts);
      const plans = planRows(ctx, rows);
      result = { plans, auto: { categories: [...ctx.createdCategories], brands: [...ctx.createdBrands] }, rows: rows.length };
      throw new Rollback();
    });
  } catch (e) {
    if (!(e instanceof Rollback)) throw e;
  }
  const errors = result.plans.filter((p) => p.action === 'error');
  return {
    type, dataset: spec.label, business_key: spec.businessKeyLabel,
    rows: result.rows,
    creates: result.plans.filter((p) => p.action === 'create').length,
    updates: result.plans.filter((p) => p.action === 'update').length,
    errors: errors.map((p) => ({ line: p.line, error: p.error, row: p.raw || null })),
    valid: errors.length === 0,
    will_create: result.plans.filter((p) => p.action === 'create').map((p) => ({ line: p.line, name: p.display })),
    will_update: result.plans.filter((p) => p.action === 'update').map((p) => ({ line: p.line, name: p.display, id: p.existing_id })),
    auto_categories: result.auto.categories,
    auto_brands: result.auto.brands,
    preview_rows: result.plans.slice(0, 60).map((p) => ({ line: p.line, action: p.action, name: p.display || (p.raw ? displayOf(p.raw) : ''), error: p.error || null })),
  };
}

function commit({ type, buffer, filename, opts = {}, userId = '' }) {
  const spec = SPECS[type];
  if (!spec) throw new RowError(`Unknown import type "${type}" — supported: ${Object.keys(SPECS).join(', ')}`);
  const rows = parseTable(buffer, filename);
  const actor = String(userId || 'admin');
  let outcome = null;
  db.transaction(() => {
    const ctx = makeContext(type, rows, opts);
    const plans = planRows(ctx, rows);
    const errors = plans.filter((p) => p.action === 'error');
    if (errors.length > 0) {
      // All-or-nothing: ONE bad row aborts the entire import with ZERO writes.
      throw new RowError(`commit aborted — ${errors.length} invalid row(s); fix and resubmit: ` +
        errors.slice(0, 8).map((e) => `L${e.line} ${e.error}`).join('; '));
    }
    let created = 0; let updated = 0;
    const done = [];
    const imageJobs = [];
    for (const p of plans) {
      const r = p.action === 'create' ? spec.applyCreate(ctx, p, actor) : spec.applyUpdate(ctx, p, p.existing_id);
      if (p.action === 'create') created += 1; else updated += 1;
      done.push({ line: p.line, action: p.action, id: r.id, name: p.display });
      const img = p.fields && p.fields.image_url;
      if (img && /^https?:\/\//i.test(img)) imageJobs.push({ id: r.id, url: img });
    }
    const auto = { categories: [...ctx.createdCategories], brands: [...ctx.createdBrands] };
    eventService.emit('master_data_imported', eventService.ENTITY_TYPES.SYSTEM, 0, {
      userId: actor,
      payload: { type, dataset: spec.label, created, updated, rows: rows.length, auto },
    });
    outcome = {
      committed: true, type, dataset: spec.label, created, updated, rows: rows.length,
      auto_categories: auto.categories, auto_brands: auto.brands,
      records: done.slice(0, 500),
      _image_jobs: imageJobs, // consumed by landImages() (post-commit, best effort)
    };
  });
  return outcome;
}

/**
 * Download remote product images into the managed store (058 behavior) so a
 * supplier's dead link never blanks a catalog. Best-effort AFTER commit:
 * failure keeps the remote URL, never fails the import.
 */
const IMPORTED_IMG_DIR = path.join(__dirname, '..', 'public', 'images', 'products', 'imported');
async function landImages(outcome) {
  const jobs = (outcome && outcome._image_jobs) || [];
  if (!jobs.length) return 0;
  fs.mkdirSync(IMPORTED_IMG_DIR, { recursive: true });
  let landed = 0;
  for (const job of jobs) {
    try {
      const res = await fetch(job.url);
      if (!res.ok) continue;
      let ext = (res.headers.get('content-type') || 'image/jpeg').split('/')[1].split(';')[0];
      if (ext === 'jpeg') ext = 'jpg';
      if (!/^[a-z0-9]{2,5}$/.test(ext)) ext = 'jpg';
      const name = `import-${job.id}-${Date.now()}-${Math.floor(Math.random() * 999)}.${ext}`;
      fs.writeFileSync(path.join(IMPORTED_IMG_DIR, name), Buffer.from(await res.arrayBuffer()));
      db.prepare('UPDATE products SET image_url = ? WHERE id = ?').run(`/images/products/imported/${name}`, job.id);
      landed += 1;
    } catch { /* keep remote URL */ }
  }
  if (outcome) delete outcome._image_jobs;
  return landed;
}

function template(type) {
  const spec = SPECS[type];
  if (!spec) throw new RowError(`Unknown import type "${type}"`);
  return spec.template.join(',');
}

module.exports = {
  TYPES: Object.keys(SPECS),
  specFor: (t) => (SPECS[t] ? { label: SPECS[t].label, permission: SPECS[t].permission, business_key: SPECS[t].businessKeyLabel } : null),
  preview: previewSafe,
  commit,
  landImages,
  template,
};
