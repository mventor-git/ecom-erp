const express = require('express');
const router = express.Router();
const db = require('../db');
const adminAuth = require('../middleware/adminAuth');
const { requirePermission } = require('../middleware/rbac');
const eventService = require('../services/eventService');
const inventoryService = require('../services/inventoryService');

router.get('/warehouses', adminAuth, requirePermission('warehouses.read'), (req, res) => {
  try {
    const warehouses = db.prepare(`
      SELECT w.*,
        COALESCE(SUM(i.qty_on_hand), 0) as total_stock,
        COUNT(DISTINCT i.product_id) as product_count,
        (SELECT COUNT(*) FROM locations l WHERE l.warehouse_id = w.id AND l.is_active = 1) as location_count
      FROM warehouses w
      LEFT JOIN inventory i ON i.warehouse_id = w.id
      WHERE w.is_active = 1
      GROUP BY w.id
      ORDER BY w.name
    `).all();
    res.json(warehouses);
  } catch (err) {
    console.error('Error fetching warehouses:', err);
    res.status(500).json({ error: 'Failed to fetch warehouses' });
  }
});

router.post('/warehouses', adminAuth, requirePermission('warehouses.manage'), (req, res) => {
  try {
    const { name, code, address } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Warehouse name is required' });
    }
    if (!code || !code.trim()) {
      return res.status(400).json({ error: 'Warehouse code is required' });
    }

    const existing = db.prepare('SELECT id FROM warehouses WHERE code = ?').get(code.trim());
    if (existing) {
      return res.status(409).json({ error: 'Warehouse code already exists' });
    }

    const result = db.prepare(`
      INSERT INTO warehouses (name, code, address)
      VALUES (?, ?, ?)
    `).run(name.trim(), code.trim(), address || '');

    const warehouse = db.prepare('SELECT * FROM warehouses WHERE id = ?').get(result.lastInsertRowid);

    eventService.emit(eventService.EVENT_TYPES.WAREHOUSE_CREATED, eventService.ENTITY_TYPES.WAREHOUSE, result.lastInsertRowid, {
      userId: req.session.username || 'admin',
      userRole: 'admin',
      payload: { name: warehouse.name, code: warehouse.code },
    });

    res.status(201).json(warehouse);
  } catch (err) {
    console.error('Error creating warehouse:', err);
    res.status(500).json({ error: 'Failed to create warehouse' });
  }
});

router.get('/warehouses/:id', adminAuth, requirePermission('warehouses.read'), (req, res) => {
  try {
    const warehouse = db.prepare(`
      SELECT w.*,
        COALESCE(SUM(i.qty_on_hand), 0) as total_stock,
        COUNT(DISTINCT i.product_id) as product_count,
        (SELECT COUNT(*) FROM locations l WHERE l.warehouse_id = w.id AND l.is_active = 1) as location_count
      FROM warehouses w
      LEFT JOIN inventory i ON i.warehouse_id = w.id
      WHERE w.id = ?
      GROUP BY w.id
    `).get(req.params.id);

    if (!warehouse) {
      return res.status(404).json({ error: 'Warehouse not found' });
    }

    res.json(warehouse);
  } catch (err) {
    console.error('Error fetching warehouse:', err);
    res.status(500).json({ error: 'Failed to fetch warehouse' });
  }
});

router.put('/warehouses/:id', adminAuth, requirePermission('warehouses.manage'), (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM warehouses WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Warehouse not found' });
    }

    const name = req.body.name !== undefined ? req.body.name.trim() : existing.name;
    const code = req.body.code !== undefined ? req.body.code.trim() : existing.code;
    const address = req.body.address !== undefined ? req.body.address : existing.address;
    const is_active = req.body.is_active !== undefined ? (req.body.is_active ? 1 : 0) : existing.is_active;

    if (!name) {
      return res.status(400).json({ error: 'Warehouse name cannot be empty' });
    }
    if (!code) {
      return res.status(400).json({ error: 'Warehouse code cannot be empty' });
    }

    if (code !== existing.code) {
      const dup = db.prepare('SELECT id FROM warehouses WHERE code = ? AND id != ?').get(code, req.params.id);
      if (dup) {
        return res.status(409).json({ error: 'Warehouse code already exists' });
      }
    }

    db.prepare(`
      UPDATE warehouses
      SET name = ?, code = ?, address = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(name, code, address, is_active, req.params.id);

    const updated = db.prepare('SELECT * FROM warehouses WHERE id = ?').get(req.params.id);

    eventService.emit(eventService.EVENT_TYPES.WAREHOUSE_UPDATED, eventService.ENTITY_TYPES.WAREHOUSE, parseInt(req.params.id), {
      userId: req.session.username || 'admin',
      userRole: 'admin',
      payload: { name: updated.name, code: updated.code, is_active: updated.is_active },
    });

    res.json(updated);
  } catch (err) {
    console.error('Error updating warehouse:', err);
    res.status(500).json({ error: 'Failed to update warehouse' });
  }
});

router.delete('/warehouses/:id', adminAuth, requirePermission('warehouses.manage'), (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM warehouses WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Warehouse not found' });
    }

    const stock = db.prepare('SELECT COUNT(*) as cnt FROM inventory WHERE warehouse_id = ? AND qty_on_hand > 0').get(req.params.id);
    if (stock && stock.cnt > 0) {
      return res.status(409).json({ error: 'Cannot deactivate warehouse with active stock. Transfer stock first.' });
    }

    db.prepare('UPDATE warehouses SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(req.params.id);

    eventService.emit(eventService.EVENT_TYPES.WAREHOUSE_DEACTIVATED, eventService.ENTITY_TYPES.WAREHOUSE, parseInt(req.params.id), {
      userId: req.session.username || 'admin',
      userRole: 'admin',
      payload: { name: existing.name, code: existing.code },
    });

    res.json({ success: true, message: `Warehouse "${existing.name}" deactivated` });
  } catch (err) {
    console.error('Error deactivating warehouse:', err);
    res.status(500).json({ error: 'Failed to deactivate warehouse' });
  }
});

router.get('/warehouses/:id/locations', adminAuth, requirePermission('warehouses.read'), (req, res) => {
  try {
    const warehouse = db.prepare('SELECT * FROM warehouses WHERE id = ?').get(req.params.id);
    if (!warehouse) {
      return res.status(404).json({ error: 'Warehouse not found' });
    }

    const locations = db.prepare(`
      SELECT l.*,
        COALESCE(SUM(i.qty_on_hand), 0) as total_stock,
        COUNT(DISTINCT i.product_id) as product_count
      FROM locations l
      LEFT JOIN inventory i ON i.location_id = l.id AND i.warehouse_id = l.warehouse_id
      WHERE l.warehouse_id = ?
      GROUP BY l.id
      ORDER BY l.name
    `).all(req.params.id);

    res.json(locations);
  } catch (err) {
    console.error('Error fetching locations:', err);
    res.status(500).json({ error: 'Failed to fetch locations' });
  }
});

router.post('/warehouses/:id/locations', adminAuth, requirePermission('warehouses.manage'), (req, res) => {
  try {
    const warehouse = db.prepare('SELECT * FROM warehouses WHERE id = ?').get(req.params.id);
    if (!warehouse) {
      return res.status(404).json({ error: 'Warehouse not found' });
    }
    if (!warehouse.is_active) {
      return res.status(400).json({ error: 'Cannot add location to inactive warehouse' });
    }

    const { name, barcode } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Location name is required' });
    }

    const result = db.prepare(`
      INSERT INTO locations (warehouse_id, name, barcode)
      VALUES (?, ?, ?)
    `).run(parseInt(req.params.id), name.trim(), barcode || '');

    const location = db.prepare('SELECT * FROM locations WHERE id = ?').get(result.lastInsertRowid);

    eventService.emit('location_created', eventService.ENTITY_TYPES.LOCATION, result.lastInsertRowid, {
      userId: req.session.username || 'admin',
      userRole: 'admin',
      payload: { name: location.name, warehouseId: location.warehouse_id, barcode: location.barcode },
    });

    res.status(201).json(location);
  } catch (err) {
    console.error('Error creating location:', err);
    res.status(500).json({ error: 'Failed to create location' });
  }
});

router.put('/locations/:id', adminAuth, requirePermission('warehouses.manage'), (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM locations WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Location not found' });
    }

    const name = req.body.name !== undefined ? req.body.name.trim() : existing.name;
    const barcode = req.body.barcode !== undefined ? req.body.barcode : existing.barcode;
    const is_active = req.body.is_active !== undefined ? (req.body.is_active ? 1 : 0) : existing.is_active;

    if (!name) {
      return res.status(400).json({ error: 'Location name cannot be empty' });
    }

    db.prepare(`
      UPDATE locations
      SET name = ?, barcode = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(name, barcode, is_active, req.params.id);

    const updated = db.prepare('SELECT * FROM locations WHERE id = ?').get(req.params.id);

    eventService.emit('location_updated', eventService.ENTITY_TYPES.LOCATION, parseInt(req.params.id), {
      userId: req.session.username || 'admin',
      userRole: 'admin',
      payload: { name: updated.name, warehouseId: updated.warehouse_id, is_active: updated.is_active },
    });

    res.json(updated);
  } catch (err) {
    console.error('Error updating location:', err);
    res.status(500).json({ error: 'Failed to update location' });
  }
});

router.delete('/locations/:id', adminAuth, requirePermission('warehouses.manage'), (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM locations WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Location not found' });
    }

    const stock = db.prepare('SELECT COUNT(*) as cnt FROM inventory WHERE location_id = ? AND qty_on_hand > 0').get(req.params.id);
    if (stock && stock.cnt > 0) {
      return res.status(409).json({ error: 'Cannot deactivate location with active stock. Transfer stock first.' });
    }

    db.prepare('UPDATE locations SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(req.params.id);

    eventService.emit('location_deactivated', eventService.ENTITY_TYPES.LOCATION, parseInt(req.params.id), {
      userId: req.session.username || 'admin',
      userRole: 'admin',
      payload: { name: existing.name, warehouseId: existing.warehouse_id },
    });

    res.json({ success: true, message: `Location "${existing.name}" deactivated` });
  } catch (err) {
    console.error('Error deactivating location:', err);
    res.status(500).json({ error: 'Failed to deactivate location' });
  }
});

router.post('/inventory/transfer', adminAuth, requirePermission('inventory.transfer'), (req, res) => {
  try {
    const {
      product_id,
      from_warehouse_id,
      from_location_id,
      to_warehouse_id,
      to_location_id,
      quantity,
      reason,
      note,
    } = req.body;

    if (!product_id || !from_warehouse_id || !to_warehouse_id || !quantity) {
      return res.status(400).json({ error: 'product_id, from_warehouse_id, to_warehouse_id, and quantity are required' });
    }

    const qty = parseInt(quantity);
    if (qty <= 0) {
      return res.status(400).json({ error: 'Quantity must be greater than zero' });
    }

    if (from_warehouse_id === to_warehouse_id && from_location_id === to_location_id) {
      return res.status(400).json({ error: 'Source and destination cannot be the same' });
    }

    const product = db.prepare('SELECT id, name FROM products WHERE id = ?').get(parseInt(product_id));
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const srcWarehouse = db.prepare('SELECT * FROM warehouses WHERE id = ? AND is_active = 1').get(parseInt(from_warehouse_id));
    if (!srcWarehouse) {
      return res.status(404).json({ error: 'Source warehouse not found or inactive' });
    }

    const dstWarehouse = db.prepare('SELECT * FROM warehouses WHERE id = ? AND is_active = 1').get(parseInt(to_warehouse_id));
    if (!dstWarehouse) {
      return res.status(404).json({ error: 'Destination warehouse not found or inactive' });
    }

    if (from_location_id) {
      const srcLoc = db.prepare('SELECT * FROM locations WHERE id = ? AND is_active = 1').get(parseInt(from_location_id));
      if (!srcLoc) {
        return res.status(404).json({ error: 'Source location not found or inactive' });
      }
    }
    if (to_location_id) {
      const dstLoc = db.prepare('SELECT * FROM locations WHERE id = ? AND is_active = 1').get(parseInt(to_location_id));
      if (!dstLoc) {
        return res.status(404).json({ error: 'Destination location not found or inactive' });
      }
    }

    const userId = req.session.username || req.session.user?.email || 'admin';
    const referenceNote = note || `Transfer: ${srcWarehouse.name} -> ${dstWarehouse.name}`;
    const transferReason = reason || 'warehouse_transfer';

    // Atomic transfer (mventor-ticket-050): both legs commit together or not at all.
    let issueMovement = null;
    let receiptMovement = null;
    try {
      db.transaction(() => {
        issueMovement = inventoryService.createMovement({
          productId: parseInt(product_id),
          warehouseId: parseInt(from_warehouse_id),
          locationId: from_location_id ? parseInt(from_location_id) : null,
          type: inventoryService.MOVEMENT_TYPES.ISSUE,
          reason: transferReason,
          referenceType: 'transfer',
          qtyChange: -qty,
          note: referenceNote,
          userId,
        });

        receiptMovement = inventoryService.createMovement({
          productId: parseInt(product_id),
          warehouseId: parseInt(to_warehouse_id),
          locationId: to_location_id ? parseInt(to_location_id) : null,
          type: inventoryService.MOVEMENT_TYPES.RECEIPT,
          reason: transferReason,
          referenceType: 'transfer',
          qtyChange: qty,
          note: referenceNote,
          userId,
        });
      });
    } catch (err) {
      if (err.message.includes('Insufficient stock')) {
        return res.status(409).json({ error: err.message });
      }
      throw err;
    }

    eventService.emit(eventService.EVENT_TYPES.INVENTORY_TRANSFERRED, eventService.ENTITY_TYPES.INVENTORY, issueMovement.id, {
      userId,
      userRole: 'admin',
      payload: {
        productId: parseInt(product_id),
        productName: product.name,
        quantity: qty,
        fromWarehouse: srcWarehouse.name,
        toWarehouse: dstWarehouse.name,
        fromLocationId: from_location_id ? parseInt(from_location_id) : null,
        toLocationId: to_location_id ? parseInt(to_location_id) : null,
        issueMovementId: issueMovement.id,
        receiptMovementId: receiptMovement.id,
      },
    });

    res.status(201).json({
      success: true,
      product: { id: product.id, name: product.name },
      quantity: qty,
      from: { warehouse: srcWarehouse.name, location_id: from_location_id || null },
      to: { warehouse: dstWarehouse.name, location_id: to_location_id || null },
      issue_movement: issueMovement,
      receipt_movement: receiptMovement,
    });
  } catch (err) {
    console.error('Error transferring inventory:', err);
    res.status(500).json({ error: 'Failed to transfer inventory' });
  }
});

module.exports = router;
