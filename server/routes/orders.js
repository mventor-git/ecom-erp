const express = require('express');
const router = express.Router();
const db = require('../db');
const { isAuthenticated } = require('./auth');
const adminAuth = require('../middleware/adminAuth');
const eventService = require('../services/eventService');

// POST /api/orders - Create a new order record
router.post('/', (req, res) => {
  try {
    const { customer_email, customer_name, items: rawItems, stripe_session_id, payment_method, idempotency_key,
      shipping_name, shipping_phone, shipping_address, shipping_city, shipping_governorate, shipping_postal_code } = req.body;

    if (!customer_email || !Array.isArray(rawItems) || rawItems.length === 0) {
      return res.status(400).json({ error: 'Missing required fields: customer_email, items' });
    }

    // SECURITY (P0.4): the client-sent total is NEVER trusted as the amount
    // charged. Recompute authoritative line prices + total from the DB using
    // the same price resolution the storefront listing uses. Unknown/inactive
    // products and invalid quantities are rejected.
    const { computeAuthoritativeOrder } = require('../services/orderPricing');
    const priced = computeAuthoritativeOrder(rawItems);
    if (!priced.ok) {
      return res.status(400).json({ error: 'Invalid cart', details: priced.errors });
    }
    const items = priced.items;
    const total = priced.total; // authoritative INTEGER cents

    // Find or create customer — BEFORE the key lookup, because the order's
    // OWNER is what scopes an idempotency key (N2 fix: an unscoped lookup
    // returned any matching order to any caller — cross-customer PII leak).
    // Guest flow unchanged: no auth requirement is invented.
    let customer = db.prepare('SELECT id, vip, name, phone, address, city, governorate FROM customers WHERE email = ?').get(customer_email);
    if (!customer) {
      // google_id is UNIQUE — guests need a unique placeholder (empty string collides)
      const guestGoogleId = 'guest_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      const result = db.prepare('INSERT INTO customers (email, name, google_id) VALUES (?, ?, ?)')
        .run(customer_email, customer_name || '', guestGoogleId);
      customer = { id: result.lastInsertRowid, vip: 0 };
    }

    // ── Idempotent order creation (N2) ──
    // identity  : (customer_id, idempotency_key) — DB-enforced via UNIQUE
    //             partial index ux_orders_idem_owner (db.js). No global key
    //             rule: different customers own different orders with the
    //             same key, so legitimate guest use is never broken.
    // fingerprint: sha256 of canonical {email, payment_method, items:[p,q]}.
    //             same owner+key+fp  => replay the ORIGINAL order (identical
    //             response shape/200, no re-executed effects); same owner+key,
    //             different fp        => 409 conflict (never silently another
    //             order). Legacy rows carrying no fp replay (backward-compat).
    const idemKey = idempotency_key ? String(idempotency_key).trim() : null;
    const idemFp = idemKey
      ? require('../services/idempotencyService').requestFingerprint({
          email: customer_email,
          payment_method: payment_method || 'cod',
          items: items.map(i => ({ p: i.product_id ?? i.id ?? null, q: i.qty ?? i.quantity ?? 0 })),
        })
      : null;
    const existingOrder = idemKey
      ? db.prepare('SELECT * FROM orders WHERE idempotency_key = ? AND customer_id = ? LIMIT 1').get(idemKey, customer.id)
      : null;
    if (existingOrder) {
      if (!existingOrder.idem_fp || existingOrder.idem_fp === idemFp) {
        return res.status(200).json(existingOrder);
      }
      return res.status(409).json({ error: 'idempotency-conflict: this key already created a different order for this customer' });
    }

    // ── VIP On-Bill checkout (mventor-ticket-060) ──
    // VIP customers may order without paying now: the order lands in the
    // admin panel as pending_approval with a TEMP issue. Admin accepts or
    // declines. Paid VIP orders follow the normal gateway flow instead.
    const isVipCustomer = !!customer.vip;
    const onBill = payment_method === 'onbill';
    const vipOnBill = isVipCustomer && onBill;
    const initialStatus = vipOnBill ? 'pending_approval' : 'pending';

    // ORDER-TIME ADDRESS SNAPSHOT (Phase 11 integrity): the order preserves the
    // address used at checkout so a later change to the customer's profile
    // address never rewrites historical order documents. Client-provided
    // shipping wins; otherwise we snapshot the customer's profile address at
    // creation time (a deterministic, order-stable fallback).
    const snapName = (shipping_name || customer.name || '').trim();
    const snapPhone = shipping_phone || customer.phone || '';
    const snapAddr = shipping_address || customer.address || '';
    const snapCity = shipping_city || customer.city || '';
    const snapGov = shipping_governorate || customer.governorate || '';
    const snapPost = shipping_postal_code || '';

    // Create order (066: snapshot the validated storefront list code so
    // reports always know which list priced this order — equals DEFAULT
    // 'retail' while the storefront sells at retail, zero behavior change)
    //
    // TRANSACTION + ORDER OF OPERATIONS (N2): idempotency identity → ownership
    // (above) → ORDER + canonical order_items rows commit as ONE unit (071:
    // JSON and rows can no longer diverge, and a rolled-back insert consumes
    // no key). Inventory bridge effects + events run AFTER that unit commits.
    // The (customer_id, idempotency_key) UNIQUE index is the FINAL authority:
    // losing a same-key race resolves as replay or conflict, never a 500.
    const priceListCode = require('../services/priceListService').storefrontListCode();
    let order = null;
    try {
      db.transaction(() => {
        const result = db.prepare(`
          INSERT INTO orders (customer_id, stripe_session_id, total, status, items, temp_issue, payment_method, idempotency_key, idem_fp,
            shipping_name, shipping_phone, shipping_address, shipping_city, shipping_governorate, shipping_postal_code, price_list_code)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(customer.id, stripe_session_id || null, total, initialStatus, JSON.stringify(items), vipOnBill ? 1 : 0, payment_method || 'cod', idemKey, idemFp,
          snapName, snapPhone, snapAddr, snapCity, snapGov, snapPost, priceListCode);
        order = db.prepare('SELECT * FROM orders WHERE id = ?').get(result.lastInsertRowid);
        // Line-item truth (071, rows-canonical) in the SAME unit as the order.
        const { buildLineRows, insertLineRows } = require('../services/orderLines');
        insertLineRows(buildLineRows(order.id, items, priceListCode).rows);
      });
    } catch (conErr) {
      const dup = /UNIQUE constraint failed: orders\.customer_id, orders\.idempotency_key/i;
      if (!idemKey || !dup.test(String(conErr && conErr.message))) throw conErr;
      // concurrent same-key duplicate: the committed row decides — replay or conflict
      const race = db.prepare('SELECT * FROM orders WHERE idempotency_key = ? AND customer_id = ? LIMIT 1').get(idemKey, customer.id);
      if (!race) throw conErr;
      if (!race.idem_fp || race.idem_fp === idemFp) return res.status(200).json(race);
      return res.status(409).json({ error: 'idempotency-conflict: this key already created a different order for this customer' });
    }

    // Sales → Inventory bridge.
    // Online (card/Kashier) orders: RESERVE stock at creation so two customers
    // cannot both buy the last unit — the reservation is released+issued at the
    // paid webhook (P0.5). COD takes goods immediately. VIP on-bill waits for
    // admin approval via a TEMP issue.
    const isKashier = (payment_method || '').startsWith('kashier');
    const bridge = require('../services/salesInventoryBridge');
    if (isKashier || !!stripe_session_id) {
      try {
        bridge.reserveForOrder(order.id, items, 'web_checkout');
      } catch (reserveErr) {
        console.error('Stock reserve error:', reserveErr.message);
      }
    }
    if (!stripe_session_id && !vipOnBill && !isKashier) {
      try {
        const issued = bridge.issueForOrder(order.id, items, 'web_cod');
        try {
          require('../services/orderLines').applyLineCosts(order.id, (issued && issued.costs) || []);
        } catch (costErr) {
          console.error('Line cost snapshot error:', costErr.message);
        }
      } catch (bridgeErr) {
        console.error('Stock bridge error:', bridgeErr.message);
      }
    }
    if (vipOnBill) {
      try {
        const wos = require('../services/warehouseOrderService');
        wos.createIssueForOrder(order.id, items, 'vip_onbill', { temp: true });
      } catch (e) { console.error('Temp issue error:', e.message); }
      try {
        const ids = require('../services/permissionService').usersWithPermission('orders.manage');
        const ns = require('../services/notificationService');
        ids.forEach(uid => ns.sendInApp(uid,
          `VIP on-bill order #${order.id} awaiting review`,
          `${customer_email} ordered ${(total / 100).toFixed(2)} EGP on bill — accept or decline`,
          '/orders').catch(() => {}));
      } catch {}
    }

    // Emit order_created event
    eventService.emit(eventService.EVENT_TYPES.ORDER_CREATED, eventService.ENTITY_TYPES.ORDER, order.id, {
      payload: {
        customer_email: customer_email,
        total: total,
        items_count: items ? items.length : 0,
      },
      metadata: {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      },
    });

    res.status(201).json(order);
  } catch (err) {
    console.error('Error creating order:', err);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// GET /api/orders/mine - Get current user's orders (requires auth)
router.get('/mine', isAuthenticated, (req, res) => {
  try {
    const orders = db.prepare(`
      SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC
    `).all(req.user.id);

    // Parse items JSON
    orders.forEach(order => {
      try { order.items = JSON.parse(order.items || '[]'); } catch { order.items = []; }
    });

    res.json(orders);
  } catch (err) {
    console.error('Error fetching user orders:', err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// GET /api/orders/delivery — customer's fulfillment status per order
// (feeds the "Delivery" tab in the customer account area)
router.get('/delivery', isAuthenticated, (req, res) => {
  try {
    const orders = db.prepare(`
      SELECT id, total, status, created_at
      FROM orders WHERE customer_id = ?
      ORDER BY created_at DESC LIMIT 30
    `).all(req.user.id);

    const rows = orders.map(o => {
      const ful = db.prepare(`
        SELECT io.id, io.order_number, io.status AS fulfillment_status,
               io.packed_at, io.claim_status, io.sent_at,
               io.delivering_at, io.delivered_at, io.sent_via,
               sp.name AS external_provider_name
        FROM issue_orders io
        LEFT JOIN shipment_providers sp ON sp.id = io.external_provider_id
        WHERE io.order_id = ?
        ORDER BY io.id DESC LIMIT 1
      `).get(o.id);
      return { ...o, fulfillment: ful || null };
    });

    res.json(rows);
  } catch (err) {
    console.error('Error fetching delivery status:', err);
    res.status(500).json({ error: 'Failed to fetch delivery status' });
  }
});

// GET /api/orders/statuses - Configured lifecycle statuses (public, for the tracker UI)
router.get('/statuses', (req, res) => {
  try {
    const workflow = require('../services/orderWorkflowService');
    res.json({
      flowEnabled: workflow.flowEnabled(),
      statuses: workflow.validStatuses(),
      estimatedDeliveryHours: Number(require('../services/settingsService').get('estimated_delivery_hours', 48)) || 48,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch order statuses' });
  }
});

// GET /api/orders/tracker - Customer order tracker (multiple orders with timelines)
router.get('/tracker', isAuthenticated, (req, res) => {
  try {
    const settingsService = require('../services/settingsService');
    const workflow = require('../services/orderWorkflowService');
    const orders = db.prepare(`
      SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC LIMIT 50
    `).all(req.user.id);

    const etaHours = Number(settingsService.get('estimated_delivery_hours', 48)) || 48;

    const result = orders.map(order => {
      try { order.items = JSON.parse(order.items || '[]'); } catch { order.items = []; }
      // timeline from immutable events
      const events = eventService.getTimeline('order', order.id, { limit: 100 });
      const timeline = events.map(ev => ({
        event: ev.event_type,
        at: ev.created_at,
        by: ev.user_id || ev.user_role || 'system',
      }));
      // shipment info (mventor-ticket-049)
      const shipment = db.prepare(`
        SELECT s.id, s.tracking_number, s.status, s.estimated_delivery, s.delivered_at,
               sp.name as provider_name
        FROM shipments s
        LEFT JOIN shipment_providers sp ON sp.id = s.provider_id
        WHERE s.order_id = ?
      `).get(order.id);
      return {
        id: order.id,
        total: order.total,
        status: order.status,
        status_reason: order.status_reason || '',
        created_at: order.created_at,
        confirmed_at: order.confirmed_at,
        updated_at: order.updated_at,
        items: order.items,
        timeline,
        estimatedDelivery: order.confirmed_at
          ? new Date(new Date(order.confirmed_at).getTime() + etaHours * 3600 * 1000).toISOString()
          : null,
        // shipment info (STEP 8)
        shipment: shipment ? {
          id: shipment.id,
          tracking_number: shipment.tracking_number,
          carrier: shipment.provider_name || 'â€”',
          status: shipment.status,
          estimated_delivery: shipment.estimated_delivery,
          delivered_at: shipment.delivered_at,
        } : null,
        // lifecycle progress for the stepper
        lifecycle: workflow.validStatuses(),
      };
    });

    res.json({ flowEnabled: workflow.flowEnabled(), etaHours, orders: result });
  } catch (err) {
    console.error('Error fetching order tracker:', err);
    res.status(500).json({ error: 'Failed to fetch tracker' });
  }
});

// GET /api/orders/:sessionId - Lookup order by Stripe session ID
// ── VIP On-Bill review (admin) — mventor-ticket-060 ──

router.get('/admin/pending-onbill', adminAuth, (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT o.id, o.total, o.status, o.created_at, o.items,
             c.email AS customer_email, c.name AS customer_name
      FROM orders o JOIN customers c ON c.id = o.customer_id
      WHERE o.status = 'pending_approval' AND o.temp_issue = 1
      ORDER BY o.created_at DESC
    `).all();
    rows.forEach(r => { try { r.items = JSON.parse(r.items || '[]'); } catch { r.items = []; } });
    res.json(rows);
  } catch (err) {
    console.error('pending-onbill error:', err);
    res.status(500).json({ error: 'Failed to load pending on-bill orders' });
  }
});

router.post('/admin/:id/accept-onbill', adminAuth, (req, res) => {
  try {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order || order.temp_issue !== 1 || order.status !== 'pending_approval') {
      return res.status(400).json({ error: 'Order is not awaiting on-bill approval' });
    }
    const items = (() => { try { return JSON.parse(order.items || '[]'); } catch { return []; } })();

    // Release stock through the bridge (real movements now)
    const bridge = require('../services/salesInventoryBridge');
    const result = bridge.issueForOrder(order.id, items, req.session.username || 'admin');
    try {
      require('../services/orderLines').applyLineCosts(order.id, (result && result.costs) || []);
    } catch (costErr) {
      console.error('Line cost snapshot error:', costErr.message);
    }

    // Flip the temp issue into a real one
    db.prepare('UPDATE issue_orders SET is_temp = 0 WHERE order_id = ?').run(order.id);
    db.prepare("UPDATE orders SET status = 'confirmed', confirmed_at = CURRENT_TIMESTAMP, temp_issue = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(order.id);

    eventService.emit(eventService.EVENT_TYPES.ORDER_CONFIRMED, eventService.ENTITY_TYPES.ORDER, order.id, {
      userId: req.session.username || 'admin',
      payload: { accepted_onbill: true, issued: result.issued },
    });

    res.json({ success: true, status: 'confirmed', issued: result.issued, failed: result.failed });
  } catch (err) {
    console.error('accept-onbill error:', err);
    res.status(500).json({ error: 'Failed to accept on-bill order' });
  }
});

router.post('/admin/:id/decline-onbill', adminAuth, (req, res) => {
  try {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order || order.status !== 'pending_approval') {
      return res.status(400).json({ error: 'Order is not awaiting on-bill approval' });
    }
    db.prepare("UPDATE orders SET status = 'cancelled', temp_issue = 0, status_reason = 'On-bill order declined by admin', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(order.id);
    db.prepare("UPDATE issue_orders SET is_temp = 0, status = 'cancelled' WHERE order_id = ? AND is_temp = 1").run(order.id);

    eventService.emit(eventService.EVENT_TYPES.ORDER_CANCELLED, eventService.ENTITY_TYPES.ORDER, order.id, {
      userId: req.session.username || 'admin',
      payload: { declined_onbill: true },
    });
    res.json({ success: true, status: 'cancelled' });
  } catch (err) {
    console.error('decline-onbill error:', err);
    res.status(500).json({ error: 'Failed to decline on-bill order' });
  }
});

router.get('/session/:sessionId', (req, res) => {
  try {
    const order = db.prepare('SELECT * FROM orders WHERE stripe_session_id = ?').get(req.params.sessionId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json(order);
  } catch (err) {
    console.error('Error fetching order:', err);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

module.exports = router;
