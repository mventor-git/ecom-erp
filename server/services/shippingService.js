/**
 * Shipping Service â€” delivery methods (employee / contractor / company),
 * shipments with tracking, and a carrier integration abstraction.
 * mventor-ticket-049
 *
 * The provider registry is the abstraction interface for future external
 * carrier APIs: each carrier can expose { createShipment, trackingUrl }.
 * Local providers (employee/contractor) and template-based tracking work
 * today without any external integration.
 */

const crypto = require('crypto');
const db = require('../db');
const settingsService = require('./settingsService');
const orderWorkflowService = require('./orderWorkflowService');

// â”€â”€ Carrier integration registry (abstraction interface) â”€â”€
// Future: implement { createShipment, trackingUrl, webhookHandler } per carrier
// (e.g. fedex, dhl, aramex REST APIs) and register them here.
const carrierIntegrations = {
  // Local / manual carriers resolve tracking URLs from the provider template
  local: {
    createShipment: null, // handled locally (manual tracking number entry)
    trackingUrl: (provider, trackingNumber) => buildTrackingUrl(provider, trackingNumber),
  },
};

function registerCarrier(name, integration) {
  carrierIntegrations[name] = integration;
}

function getCarrier(name) {
  return carrierIntegrations[name] || carrierIntegrations.local;
}

function buildTrackingUrl(provider, trackingNumber) {
  if (!trackingNumber) return '';
  const tpl = (provider && provider.tracking_url_template) || '';
  if (tpl) return tpl.replace('{TRACKING}', encodeURIComponent(trackingNumber));
  return '';
}

// â”€â”€ Providers CRUD â”€â”€

function listProviders(includeInactive = false) {
  return db.prepare(`
    SELECT * FROM shipment_providers
    WHERE (is_active = 1 OR ? = 1)
    ORDER BY type, name
  `).all(includeInactive ? 1 : 0);
}

function createProvider({ name, type = 'company', contactPhone = '', website = '', trackingUrlTemplate = '' }) {
  if (!name || !name.trim()) throw new Error('Provider name is required');
  if (!['employee', 'contractor', 'company'].includes(type)) throw new Error('Type must be employee, contractor or company');
  const result = db.prepare(`
    INSERT INTO shipment_providers (name, type, contact_phone, website, tracking_url_template, is_active)
    VALUES (?, ?, ?, ?, ?, 1)
  `).run(name.trim(), type, contactPhone || '', website || '', trackingUrlTemplate || '');
  return db.prepare('SELECT * FROM shipment_providers WHERE id = ?').get(result.lastInsertRowid);
}

function updateProvider(id, updates = {}) {
  const existing = db.prepare('SELECT * FROM shipment_providers WHERE id = ?').get(id);
  if (!existing) throw new Error('Provider not found');
  // accept both camelCase and snake_case payloads
  const get = (snake, camel, fallback) => updates[snake] !== undefined ? updates[snake] : (updates[camel] !== undefined ? updates[camel] : fallback);
  const name = get('name', 'name', existing.name);
  const type = get('type', 'type', existing.type);
  const phone = get('contact_phone', 'contactPhone', existing.contact_phone);
  const website = get('website', 'website', existing.website);
  const tpl = get('tracking_url_template', 'trackingUrlTemplate', existing.tracking_url_template);
  const active = get('is_active', 'isActive', existing.is_active);
  if (!['employee', 'contractor', 'company'].includes(type)) throw new Error('Type must be employee, contractor or company');

  db.prepare(`
    UPDATE shipment_providers
    SET name = ?, type = ?, contact_phone = ?, website = ?, tracking_url_template = ?, is_active = ?
    WHERE id = ?
  `).run(name, type, phone, website, tpl, active ? 1 : 0, id);
  return db.prepare('SELECT * FROM shipment_providers WHERE id = ?').get(id);
}

function deleteProvider(id) {
  const existing = db.prepare('SELECT * FROM shipment_providers WHERE id = ?').get(id);
  if (!existing) throw new Error('Provider not found');
  db.prepare('DELETE FROM shipments WHERE provider_id = ?').run(id);
  db.prepare('DELETE FROM shipment_providers WHERE id = ?').run(id);
  return { success: true };
}

// â”€â”€ Tracking number generation â”€â”€

function generateTrackingNumber(provider, orderId) {
  const prefix = String(settingsService.get('courier_tracking_prefix', 'CS') || 'CS');
  const providerCode = (provider ? provider.name : '').slice(0, 2).toUpperCase() || 'SH';
  return `${prefix}-${providerCode}-${String(orderId).padStart(6, '0')}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
}

// â”€â”€ Shipments â”€â”€

function createShipment({ orderId, providerId, trackingNumber = '', estimatedDelivery = null, notes = '', userId = 'admin' }) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) throw new Error('Order not found');
  if (!['confirmed', 'picking', 'packing', 'ready_for_shipping', 'shipped'].includes(order.status)) {
    throw new Error(`Order cannot be shipped from status "${order.status}"`);
  }

  const provider = providerId ? db.prepare('SELECT * FROM shipment_providers WHERE id = ?').get(providerId) : null;
  const existing = db.prepare('SELECT * FROM shipments WHERE order_id = ?').get(orderId);
  if (existing) throw new Error(`Order #${orderId} already has a shipment`);

  const tracking = trackingNumber || generateTrackingNumber(provider, orderId);

  const result = db.prepare(`
    INSERT INTO shipments (order_id, provider_id, tracking_number, status, estimated_delivery, shipped_at, notes, created_by)
    VALUES (?, ?, ?, 'pending', ?, CURRENT_TIMESTAMP, ?, ?)
  `).run(orderId, providerId || null, tracking, estimatedDelivery || null, notes || '', userId);

  const shipment = db.prepare('SELECT * FROM shipments WHERE id = ?').get(result.lastInsertRowid);

  // advance the order to shipped
  if (order.status !== 'shipped') {
    try {
      orderWorkflowService.transitionOrder(orderId, 'shipped', { userId, reason: `shipment #${shipment.id}` });
    } catch (e) {
      // legacy flow: direct update
      db.prepare("UPDATE orders SET status = 'shipped', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(orderId);
    }
  }

  notifyCustomerShipment(order, shipment, provider);

  return { ...shipment, provider, tracking_url: trackingUrl(provider, tracking) };
}

function updateShipmentStatus(shipmentId, status, { deliveredAt = null, notes = '', userId = 'admin' } = {}) {
  const valid = ['pending', 'in_transit', 'out_for_delivery', 'delivered', 'failed', 'returned'];
  if (!valid.includes(status)) throw new Error(`Invalid shipment status: ${status}`);

  const shipment = db.prepare('SELECT * FROM shipments WHERE id = ?').get(shipmentId);
  if (!shipment) throw new Error('Shipment not found');

  const sets = ['status = ?', 'notes = ?', 'updated_at = CURRENT_TIMESTAMP'];
  const params = [status, notes || shipment.notes || ''];
  if (status === 'delivered') {
    sets.push('delivered_at = COALESCE(delivered_at, CURRENT_TIMESTAMP)');
  }
  params.push(shipmentId);
  db.prepare(`UPDATE shipments SET ${sets.join(', ')} WHERE id = ?`).run(...params);

  const updated = db.prepare('SELECT * FROM shipments WHERE id = ?').get(shipmentId);

  // delivered â†’ order delivered
  if (status === 'delivered') {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(shipment.order_id);
    if (order && order.status !== 'delivered') {
      try {
        orderWorkflowService.transitionOrder(shipment.order_id, 'delivered', { userId, reason: 'shipment delivered' });
      } catch (e) {
        db.prepare("UPDATE orders SET status = 'delivered', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(shipment.order_id);
      }
    }
  }

  return updated;
}

function listShipments(filters = {}) {
  const { status, providerId, limit = 100 } = filters;
  let sql = `
    SELECT s.*, sp.name as provider_name, sp.type as provider_type,
           o.total, o.created_at as order_created_at, o.status as order_status,
           c.name as customer_name, c.email as customer_email,
           o.shipping_name, o.shipping_address, o.shipping_city, o.shipping_phone
    FROM shipments s
    LEFT JOIN shipment_providers sp ON sp.id = s.provider_id
    JOIN orders o ON o.id = s.order_id
    LEFT JOIN customers c ON c.id = o.customer_id
    WHERE 1=1
  `;
  const params = [];
  if (status) { sql += ' AND s.status = ?'; params.push(status); }
  if (providerId) { sql += ' AND s.provider_id = ?'; params.push(providerId); }
  sql += ' ORDER BY s.created_at DESC LIMIT ?';
  params.push(limit);
  return db.prepare(sql).all(...params);
}

function getShipmentByOrder(orderId) {
  return db.prepare(`
    SELECT s.*, sp.name as provider_name, sp.type as provider_type, sp.tracking_url_template
    FROM shipments s
    LEFT JOIN shipment_providers sp ON sp.id = s.provider_id
    WHERE s.order_id = ?
  `).get(orderId);
}

// â”€â”€ Abstraction: tracking lookup â”€â”€

function trackingUrl(provider, trackingNumber) {
  if (!provider) return '';
  const carrier = getCarrier(provider.type);
  if (carrier && typeof carrier.trackingUrl === 'function') {
    return carrier.trackingUrl(provider, trackingNumber);
  }
  return buildTrackingUrl(provider, trackingNumber);
}

// â”€â”€ Customer notification â”€â”€

function notifyCustomerShipment(order, shipment, provider) {
  const email = require('../email');
  const customerEmail = (order.customer_email || '').trim();
  if (!customerEmail) return;
  const providerName = provider ? provider.name : 'Carrier';
  const eta = shipment.estimated_delivery
    ? new Date(shipment.estimated_delivery).toLocaleDateString('en-GB', { weekday: 'short', month: 'short', day: 'numeric' })
    : `${Number(settingsService.get('estimated_delivery_hours', 48)) || 48} hours`;
  const tracking = shipment.tracking_number;

  const html = `
  <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;background:#fff;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
    <div style="background:#2563eb;padding:20px;text-align:center;color:#fff;">
      <h2 style="margin:0;font-size:20px;">Your order has shipped!</h2>
    </div>
    <div style="padding:24px;">
      <p>Order <b>#${order.id}</b> is on its way via <b>${providerName}</b>.</p>
      <p><b>Tracking number:</b> ${tracking}</p>
      <p>Estimated delivery: <b>${eta}</b></p>
      <p style="color:#999;font-size:12px;">Track it anytime in your Order Tracker.</p>
    </div>
  </div>`;
  email.sendMail({ to: customerEmail, subject: `Your order #${order.id} has shipped`, html }).catch(() => {});
}

module.exports = {
  listProviders,
  createProvider,
  updateProvider,
  deleteProvider,
  createShipment,
  updateShipmentStatus,
  listShipments,
  getShipmentByOrder,
  trackingUrl,
  generateTrackingNumber,
  registerCarrier,
  getCarrier,
};
