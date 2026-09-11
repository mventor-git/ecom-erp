const express = require('express');
const router = express.Router();
const db = require('../db');
const adminAuth = require('../middleware/adminAuth');
const { requirePermission } = require('../middleware/rbac');
const eventService = require('../services/eventService');
const documentNumberService = require('../services/documentNumberService');
const inventoryService = require('../services/inventoryService');
const notificationService = require('../services/notificationService');
const permissionService = require('../services/permissionService');

/** Notify every user holding a permission (reuses the existing in-app channel). */
function notifyPermission(permission, title, message, link) {
  permissionService.usersWithPermission(permission).forEach(uid =>
    notificationService.sendInApp(uid, title, message, link).catch(() => {}));
}

function reasonTrunc(r) { return r ? String(r).slice(0, 300) : ''; }

const VALID_STATUSES = ['draft', 'sent', 'confirmed', 'received_partial', 'received', 'cancelled'];
const STATUS_TRANSITIONS = {
  draft: ['sent', 'cancelled'],
  sent: ['confirmed', 'cancelled'],
  confirmed: ['received_partial', 'received', 'cancelled'],
  received_partial: ['received', 'cancelled'],
};

router.get('/', adminAuth, requirePermission('purchase_orders.read'), (req, res) => {
  try {
    const pos = db.prepare(`
      SELECT po.*, s.name as supplier_name
      FROM purchase_orders po
      JOIN suppliers s ON s.id = po.supplier_id
      ORDER BY po.created_at DESC
    `).all();
    res.json(pos);
  } catch (err) {
    console.error('Error fetching purchase orders:', err);
    res.status(500).json({ error: 'Failed to fetch purchase orders' });
  }
});

router.post('/', adminAuth, requirePermission('purchase_orders.create'), (req, res) => {
  try {
    const { supplier_id, items, notes, expected_at } = req.body;

    if (!supplier_id) {
      return res.status(400).json({ error: 'Supplier is required' });
    }

    const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(supplier_id);
    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'At least one item is required' });
    }

    const poDoc = documentNumberService.generate('PO');

    let totalCost = 0;
    for (const item of items) {
      if (!item.product_id || !item.qty_ordered || !item.unit_cost) {
        return res.status(400).json({ error: 'Each item requires product_id, qty_ordered, and unit_cost' });
      }
      totalCost += item.qty_ordered * item.unit_cost;
    }

    const result = db.prepare(`
      INSERT INTO purchase_orders (po_number, supplier_id, status, total_cost, notes, expected_at, created_by)
      VALUES (?, ?, 'draft', ?, ?, ?, ?)
    `).run(
      poDoc.document_number,
      supplier_id,
      totalCost,
      notes || '',
      expected_at || null,
      req.session.username || 'admin'
    );

    const poId = result.lastInsertRowid;

    for (const item of items) {
      db.prepare(`
        INSERT INTO purchase_order_items (po_id, product_id, qty_ordered, unit_cost)
        VALUES (?, ?, ?, ?)
      `).run(poId, item.product_id, item.qty_ordered, item.unit_cost);
    }

    const po = db.prepare(`
      SELECT po.*, s.name as supplier_name
      FROM purchase_orders po
      JOIN suppliers s ON s.id = po.supplier_id
      WHERE po.id = ?
    `).get(poId);

    const poItems = db.prepare(`
      SELECT poi.*, p.name as product_name
      FROM purchase_order_items poi
      JOIN products p ON p.id = poi.product_id
      WHERE poi.po_id = ?
    `).all(poId);

    eventService.emit(eventService.EVENT_TYPES.PO_CREATED, eventService.ENTITY_TYPES.PURCHASE_ORDER, poId, {
      userId: req.session.username || 'admin',
      userRole: 'admin',
      payload: { po_number: po.po_number, supplier_id, total_cost: totalCost, item_count: items.length },
    });

    res.status(201).json({ ...po, items: poItems });
  } catch (err) {
    console.error('Error creating purchase order:', err);
    res.status(500).json({ error: 'Failed to create purchase order' });
  }
});

router.get('/:id', adminAuth, requirePermission('purchase_orders.read'), (req, res) => {
  try {
    const po = db.prepare(`
      SELECT po.*, s.name as supplier_name
      FROM purchase_orders po
      JOIN suppliers s ON s.id = po.supplier_id
      WHERE po.id = ?
    `).get(req.params.id);

    if (!po) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    const items = db.prepare(`
      SELECT poi.*, p.name as product_name, p.sku as product_sku
      FROM purchase_order_items poi
      JOIN products p ON p.id = poi.product_id
      WHERE poi.po_id = ?
      ORDER BY poi.id
    `).all(req.params.id);

    res.json({ ...po, items });
  } catch (err) {
    console.error('Error fetching purchase order:', err);
    res.status(500).json({ error: 'Failed to fetch purchase order' });
  }
});

router.put('/:id', adminAuth, requirePermission('purchase_orders.create'), (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    if (existing.status !== 'draft') {
      return res.status(400).json({ error: 'Can only edit purchase orders in draft status' });
    }

    const { supplier_id, notes, expected_at, items } = req.body;

    const newSupplierId = supplier_id !== undefined ? supplier_id : existing.supplier_id;
    const newNotes = notes !== undefined ? notes : existing.notes;
    const newExpectedAt = expected_at !== undefined ? expected_at : existing.expected_at;

    if (supplier_id !== undefined) {
      const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(supplier_id);
      if (!supplier) {
        return res.status(404).json({ error: 'Supplier not found' });
      }
    }

    let newTotalCost = existing.total_cost;

    if (items !== undefined) {
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'At least one item is required' });
      }

      newTotalCost = 0;
      for (const item of items) {
        if (!item.product_id || !item.qty_ordered || !item.unit_cost) {
          return res.status(400).json({ error: 'Each item requires product_id, qty_ordered, and unit_cost' });
        }
        newTotalCost += item.qty_ordered * item.unit_cost;
      }

      db.prepare('DELETE FROM purchase_order_items WHERE po_id = ?').run(req.params.id);

      for (const item of items) {
        db.prepare(`
          INSERT INTO purchase_order_items (po_id, product_id, qty_ordered, unit_cost)
          VALUES (?, ?, ?, ?)
        `).run(req.params.id, item.product_id, item.qty_ordered, item.unit_cost);
      }
    }

    db.prepare(`
      UPDATE purchase_orders
      SET supplier_id = ?, notes = ?, expected_at = ?, total_cost = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newSupplierId, newNotes, newExpectedAt, newTotalCost, req.params.id);

    const updated = db.prepare(`
      SELECT po.*, s.name as supplier_name
      FROM purchase_orders po
      JOIN suppliers s ON s.id = po.supplier_id
      WHERE po.id = ?
    `).get(req.params.id);

    const updatedItems = db.prepare(`
      SELECT poi.*, p.name as product_name
      FROM purchase_order_items poi
      JOIN products p ON p.id = poi.product_id
      WHERE poi.po_id = ?
    `).all(req.params.id);

    res.json({ ...updated, items: updatedItems });
  } catch (err) {
    console.error('Error updating purchase order:', err);
    res.status(500).json({ error: 'Failed to update purchase order' });
  }
});

router.put('/:id/status', adminAuth, requirePermission('purchase_orders.update'), (req, res) => {
  try {
    const { status, reject_reason } = req.body;
    const actor = req.session.username || req.user?.email || 'admin';

    if (!status || !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
    }

    const po = db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(req.params.id);
    if (!po) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    const allowedNext = STATUS_TRANSITIONS[po.status] || [];
    if (!allowedNext.includes(status)) {
      return res.status(400).json({ error: `Cannot transition from "${po.status}" to "${status}". Allowed: ${allowedNext.join(', ')}` });
    }

    // REJECTION (sent → cancelled) is a business decision: a meaningful reason and
    // the rejecting actor must be recorded. It never changes inventory.
    if (status === 'cancelled' && po.status === 'sent') {
      if (!reject_reason || !String(reject_reason).trim()) {
        return res.status(400).json({ error: 'A rejection reason is required' });
      }
    }

    const updateFields = ['status = ?', 'updated_at = CURRENT_TIMESTAMP'];
    const updateParams = [status];

    if (status === 'sent') updateFields.push('ordered_at = CURRENT_TIMESTAMP');
    if (status === 'received') updateFields.push('received_at = CURRENT_TIMESTAMP');
    if (status === 'confirmed') {
      updateFields.push('approved_by = ?', 'approved_at = CURRENT_TIMESTAMP');
      updateParams.push(actor);
    }
    if (status === 'cancelled' && po.status === 'sent') {
      updateFields.push('reject_reason = ?', 'rejected_by = ?', 'rejected_at = CURRENT_TIMESTAMP');
      updateParams.push(String(reject_reason).trim(), actor);
    }

    updateParams.push(req.params.id);
    db.prepare(`UPDATE purchase_orders SET ${updateFields.join(', ')} WHERE id = ?`).run(...updateParams);

    const eventMap = {
      sent: eventService.EVENT_TYPES.PO_SENT,
      confirmed: eventService.EVENT_TYPES.PO_CONFIRMED,
      received: eventService.EVENT_TYPES.PO_RECEIVED,
      cancelled: eventService.EVENT_TYPES.PO_CANCELLED,
    };

    if (eventMap[status]) {
      eventService.emit(eventMap[status], eventService.ENTITY_TYPES.PURCHASE_ORDER, parseInt(req.params.id), {
        userId: actor, userRole: 'admin',
        payload: { po_number: po.po_number, from_status: po.status, to_status: status, reject_reason: reasonTrunc(reject_reason) },
      });
    }

    // Notifications (reuse the in-app channel; each corresponds to a real event).
    const link = '/erp/purchase-orders';
    if (status === 'sent') {
      notifyPermission('purchase_orders.approve', 'Purchase order submitted', `PO ${po.po_number} submitted for approval`, link);
    } else if (status === 'confirmed') {
      notifyPermission('purchase_orders.update', 'Purchase order approved', `PO ${po.po_number} approved by ${actor}`, link);
    } else if (status === 'cancelled' && po.status === 'sent') {
      notifyPermission('purchase_orders.update', 'Purchase order rejected', `PO ${po.po_number} rejected: ${String(reject_reason).trim()}`, link);
    }

    const updated = db.prepare(`
      SELECT po.*, s.name as supplier_name
      FROM purchase_orders po
      JOIN suppliers s ON s.id = po.supplier_id
      WHERE po.id = ?
    `).get(req.params.id);

    res.json(updated);
  } catch (err) {
    console.error('Error updating purchase order status:', err);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

router.post('/:id/receive', adminAuth, requirePermission('purchase_orders.update'), (req, res) => {
  try {
    const po = db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(req.params.id);
    if (!po) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    if (!['confirmed', 'received_partial'].includes(po.status)) {
      return res.status(400).json({ error: 'Can only receive goods for confirmed or partially received orders' });
    }

    const { items: receivedItems, warehouse_id } = req.body;

    if (!receivedItems || !Array.isArray(receivedItems) || receivedItems.length === 0) {
      return res.status(400).json({ error: 'At least one received item is required' });
    }

    const poItems = db.prepare('SELECT * FROM purchase_order_items WHERE po_id = ?').all(req.params.id);
    const poItemMap = {};
    for (const pi of poItems) {
      poItemMap[pi.id] = pi;
    }

    const defaultWarehouse = db.prepare("SELECT id FROM warehouses WHERE code = 'WH-MAIN'").get();
    const whId = warehouse_id || (defaultWarehouse ? defaultWarehouse.id : 1);

    const movements = [];

    // Atomic receipt (mventor-ticket-050): all items + status commit together.
    db.transaction(() => {
      for (const ri of receivedItems) {
        if (!ri.item_id || !ri.qty_received || ri.qty_received <= 0) {
          throw new Error('Each received item requires item_id and qty_received > 0');
        }

        const poItem = poItemMap[ri.item_id];
        if (!poItem) {
          throw new Error(`Item ${ri.item_id} not found in this purchase order`);
        }

        const remaining = poItem.qty_ordered - poItem.qty_received;
        if (ri.qty_received > remaining) {
          throw new Error(`Cannot receive ${ri.qty_received} for item ${ri.item_id}. Only ${remaining} remaining.`);
        }

        db.prepare(`
          UPDATE purchase_order_items SET qty_received = qty_received + ? WHERE id = ?
        `).run(ri.qty_received, ri.item_id);

        const movement = inventoryService.createMovement({
          productId: poItem.product_id,
          warehouseId: whId,
          locationId: ri.location_id || null,
          type: inventoryService.MOVEMENT_TYPES.RECEIPT,
          reason: `Goods receipt for PO ${po.po_number}`,
          referenceType: 'purchase_order',
          referenceId: po.id,
          qtyChange: ri.qty_received,
          unitCost: poItem.unit_cost,
          note: `Received ${ri.qty_received} of ${poItem.qty_ordered} ordered`,
          userId: req.session.username || 'admin',
        });

        movements.push(movement);
      }

      const updatedItems = db.prepare('SELECT * FROM purchase_order_items WHERE po_id = ?').all(req.params.id);
      const allReceived = updatedItems.every(i => i.qty_received >= i.qty_ordered);
      const anyReceived = updatedItems.some(i => i.qty_received > 0);

      let newStatus = po.status;
      if (allReceived) {
        newStatus = 'received';
      } else if (anyReceived) {
        newStatus = 'received_partial';
      }

      const updateFields = ['status = ?', 'updated_at = CURRENT_TIMESTAMP'];
      const updateParams = [newStatus];
      if (newStatus === 'received') {
        updateFields.push('received_at = CURRENT_TIMESTAMP');
      }
      updateParams.push(req.params.id);
      db.prepare(`UPDATE purchase_orders SET ${updateFields.join(', ')} WHERE id = ?`).run(...updateParams);
    });

    // Purchase postings (087, owner: recognition at receipt): one balanced
    // entry per receipt movement, post-commit best-effort — a posting failure
    // must never roll back received goods (detectable + re-postable instead).
    try {
      const purchasePosting = require('../services/purchasePosting');
      for (const movement of movements) {
        purchasePosting.postReceiptMovement(movement.id, { userId: req.session.username || 'admin' });
      }
    } catch (postErr) {
      console.error('[purchase-receive] posting error:', postErr.message);
    }

    if (newStatus === 'received') {
      eventService.emit(eventService.EVENT_TYPES.PO_RECEIVED, eventService.ENTITY_TYPES.PURCHASE_ORDER, po.id, {
        userId: req.session.username || 'admin',
        userRole: 'admin',
        payload: { po_number: po.po_number, movements_count: movements.length },
      });
    }

    const updated = db.prepare(`
      SELECT po.*, s.name as supplier_name
      FROM purchase_orders po
      JOIN suppliers s ON s.id = po.supplier_id
      WHERE po.id = ?
    `).get(req.params.id);

    const updatedItemsWithNames = db.prepare(`
      SELECT poi.*, p.name as product_name
      FROM purchase_order_items poi
      JOIN products p ON p.id = poi.product_id
      WHERE poi.po_id = ?
    `).all(req.params.id);

    res.json({ ...updated, items: updatedItemsWithNames, movements });
  } catch (err) {
    console.error('Error receiving goods:', err);
    if (err.message.includes('requires item_id') || err.message.includes('not found in this purchase order')) {
      return res.status(400).json({ error: err.message });
    }
    if (err.message.includes('Cannot receive')) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Failed to receive goods' });
  }
});

router.delete('/:id', adminAuth, requirePermission('purchase_orders.update'), (req, res) => {
  try {
    const po = db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(req.params.id);
    if (!po) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    if (po.status === 'received') {
      return res.status(400).json({ error: 'Cannot cancel a fully received purchase order' });
    }

    db.prepare(`
      UPDATE purchase_orders SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(req.params.id);

    eventService.emit(eventService.EVENT_TYPES.PO_CANCELLED, eventService.ENTITY_TYPES.PURCHASE_ORDER, parseInt(req.params.id), {
      userId: req.session.username || 'admin',
      userRole: 'admin',
      payload: { po_number: po.po_number, previous_status: po.status },
    });

    res.json({ success: true, message: `PO ${po.po_number} cancelled` });
  } catch (err) {
    console.error('Error cancelling purchase order:', err);
    res.status(500).json({ error: 'Failed to cancel purchase order' });
  }
});

module.exports = router;
