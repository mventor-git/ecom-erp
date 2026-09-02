const express = require('express');
const router = express.Router();
const db = require('../db');
const adminAuth = require('../middleware/adminAuth');
const { requirePermission } = require('../middleware/rbac');
const eventService = require('../services/eventService');

// GET /api/admin/suppliers - List all suppliers
router.get('/', adminAuth, requirePermission('suppliers.read'), (req, res) => {
  try {
    const suppliers = db.prepare(`
      SELECT s.*, COUNT(ps.id) as product_count
      FROM suppliers s
      LEFT JOIN product_suppliers ps ON ps.supplier_id = s.id
      GROUP BY s.id
      ORDER BY s.name
    `).all();
    res.json(suppliers);
  } catch (err) {
    console.error('Error fetching suppliers:', err);
    res.status(500).json({ error: 'Failed to fetch suppliers' });
  }
});

// POST /api/admin/suppliers - Create supplier
router.post('/', adminAuth, requirePermission('suppliers.manage'), (req, res) => {
  try {
    const { name, contact_name, email, phone, address, notes, lead_time_days } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Supplier name is required' });
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const result = db.prepare(`
      INSERT INTO suppliers (name, contact_name, email, phone, address, notes, lead_time_days)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      name.trim(),
      contact_name || '',
      email || '',
      phone || '',
      address || '',
      notes || '',
      lead_time_days || 0
    );

    const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(result.lastInsertRowid);

    eventService.emit(eventService.EVENT_TYPES.SUPPLIER_CREATED, eventService.ENTITY_TYPES.SUPPLIER, result.lastInsertRowid, {
      userId: req.session.username || 'admin',
      userRole: 'admin',
      payload: { name: supplier.name, email: supplier.email },
    });

    res.status(201).json(supplier);
  } catch (err) {
    console.error('Error creating supplier:', err);
    res.status(500).json({ error: 'Failed to create supplier' });
  }
});

// GET /api/admin/suppliers/:id - Get supplier by ID
router.get('/:id', adminAuth, requirePermission('suppliers.read'), (req, res) => {
  try {
    const supplier = db.prepare(`
      SELECT s.*, COUNT(ps.id) as product_count
      FROM suppliers s
      LEFT JOIN product_suppliers ps ON ps.supplier_id = s.id
      WHERE s.id = ?
      GROUP BY s.id
    `).get(req.params.id);

    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    res.json(supplier);
  } catch (err) {
    console.error('Error fetching supplier:', err);
    res.status(500).json({ error: 'Failed to fetch supplier' });
  }
});

// PUT /api/admin/suppliers/:id - Update supplier
router.put('/:id', adminAuth, requirePermission('suppliers.manage'), (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    if (req.body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(req.body.email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const name = req.body.name !== undefined ? req.body.name.trim() : existing.name;
    const contact_name = req.body.contact_name !== undefined ? req.body.contact_name : existing.contact_name;
    const email = req.body.email !== undefined ? req.body.email : existing.email;
    const phone = req.body.phone !== undefined ? req.body.phone : existing.phone;
    const address = req.body.address !== undefined ? req.body.address : existing.address;
    const notes = req.body.notes !== undefined ? req.body.notes : existing.notes;
    const lead_time_days = req.body.lead_time_days !== undefined ? req.body.lead_time_days : existing.lead_time_days;
    const is_active = req.body.is_active !== undefined ? (req.body.is_active ? 1 : 0) : existing.is_active;

    if (!name) {
      return res.status(400).json({ error: 'Supplier name cannot be empty' });
    }

    db.prepare(`
      UPDATE suppliers
      SET name = ?, contact_name = ?, email = ?, phone = ?, address = ?, notes = ?, lead_time_days = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(name, contact_name, email, phone, address, notes, lead_time_days, is_active, req.params.id);

    const updated = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id);

    eventService.emit(eventService.EVENT_TYPES.SUPPLIER_UPDATED, eventService.ENTITY_TYPES.SUPPLIER, parseInt(req.params.id), {
      userId: req.session.username || 'admin',
      userRole: 'admin',
      payload: { name: updated.name, is_active: updated.is_active },
    });

    res.json(updated);
  } catch (err) {
    console.error('Error updating supplier:', err);
    res.status(500).json({ error: 'Failed to update supplier' });
  }
});

// DELETE /api/admin/suppliers/:id - Deactivate supplier
router.delete('/:id', adminAuth, requirePermission('suppliers.manage'), (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    db.prepare('UPDATE suppliers SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(req.params.id);

    eventService.emit(eventService.EVENT_TYPES.SUPPLIER_DEACTIVATED, eventService.ENTITY_TYPES.SUPPLIER, parseInt(req.params.id), {
      userId: req.session.username || 'admin',
      userRole: 'admin',
      payload: { name: existing.name },
    });

    res.json({ success: true, message: `Supplier "${existing.name}" deactivated` });
  } catch (err) {
    console.error('Error deactivating supplier:', err);
    res.status(500).json({ error: 'Failed to deactivate supplier' });
  }
});

// GET /api/admin/suppliers/:id/products - Get products linked to supplier
router.get('/:id/products', adminAuth, requirePermission('suppliers.read'), (req, res) => {
  try {
    const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id);
    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    const products = db.prepare(`
      SELECT ps.*, p.name as product_name, p.image_url, p.price, p.active as product_active
      FROM product_suppliers ps
      JOIN products p ON p.id = ps.product_id
      WHERE ps.supplier_id = ?
      ORDER BY ps.is_preferred DESC, p.name
    `).all(req.params.id);

    res.json(products);
  } catch (err) {
    console.error('Error fetching supplier products:', err);
    res.status(500).json({ error: 'Failed to fetch supplier products' });
  }
});

// GET /api/admin/suppliers/:id/history — REAL purchase-cost history for a supplier
// (drives supplier/product cost views: LATEST, HIGHEST, FIFO, supplier reports).
// Server-authoritative: joins purchase_orders + items; never trusts the client.
router.get('/:id/history', adminAuth, requirePermission('suppliers.read'), (req, res) => {
  try {
    const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id);
    if (!supplier) return res.status(404).json({ error: 'Supplier not found' });

    // Real purchase-order history (source = 'purchase_order').
    const purchases = db.prepare(`
      SELECT poi.id, poi.product_id, p.name as product_name, poi.qty_ordered as qty, poi.unit_cost,
             po.po_number as reference, COALESCE(po.ordered_at, po.created_at) as date,
             'purchase_order' as source
      FROM purchase_order_items poi
      JOIN purchase_orders po ON po.id = poi.po_id
      JOIN products p ON p.id = poi.product_id
      WHERE po.supplier_id = ?
      ORDER BY date ASC, po.id ASC
    `).all(req.params.id);

    // Real supply-order receipts (source = 'supply_order'), queryable by the same
    // supplier_id FK. Distinct operational documents — surfaced together but
    // never silently merged (each row carries its `source`).
    const supplies = db.prepare(`
      SELECT soi.id, soi.product_id, p.name as product_name, soi.qty, soi.unit_cost,
             so.order_number as reference, COALESCE(so.issued_at, so.created_at) as date,
             'supply_order' as source
      FROM supply_order_items soi
      JOIN supply_orders so ON so.id = soi.supply_order_id
      JOIN products p ON p.id = soi.product_id
      WHERE so.supplier_id = ?
      ORDER BY date ASC, so.id ASC
    `).all(req.params.id);

    // Combined, date-ordered procurement timeline for the operator + cost summary.
    const entries = [...purchases, ...supplies]
      .map(e => ({ ...e, qty: e.qty | 0 }))
      .sort((a, b) => (a.date || '') < (b.date || '') ? -1 : (a.date || '') > (b.date || '') ? 1 : 0);

    // Per-product: distinct historical costs (in date order) + latest + highest
    // across BOTH sources — never overwritten, never inferred from current cost.
    const byProduct = {};
    for (const row of entries) {
      const key = row.product_id;
      if (!byProduct[key]) { byProduct[key] = { product_id: key, product_name: row.product_name, costs: [], units: 0 }; }
      if (!byProduct[key].costs.includes(row.unit_cost)) byProduct[key].costs.push(row.unit_cost);
      byProduct[key].units += row.qty;
    }
    const productCosts = Object.values(byProduct).map(pc => ({
      ...pc,
      latest: pc.costs[pc.costs.length - 1],
      highest: Math.max(...pc.costs),
    }));

    res.json({ supplier, purchases, supplies, entries, productCosts });
  } catch (err) {
    console.error('supplier history error:', err);
    res.status(500).json({ error: 'Failed to load supplier history' });
  }
});

module.exports = router;
