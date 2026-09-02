/**
 * Tests for the shipping workflow (mventor-ticket-049).
 */
const db = require('../db');
const workflow = require('../services/orderWorkflowService');
const shipping = require('../services/shippingService');
const settingsService = require('../services/settingsService');

let orderId = null;
let custId = null;

beforeAll(async () => {
  await db.initPromise;
  settingsService.set('order_flow_enabled', true, 'jest');
  const testEmail = `jest.shipping-${Math.random().toString(36).slice(2, 10)}@test.com`;
  custId = db.prepare('INSERT INTO customers (email, name, google_id) VALUES (?, ?, ?)')
    .run(testEmail, 'Jest Shipping', 'jest_shipping_' + Math.random().toString(36).slice(2, 8)).lastInsertRowid;
  const res = db.prepare(`
    INSERT INTO orders (customer_id, total, status, items, payment_status, shipping_name, shipping_city)
    VALUES (?, 20000, 'ready_for_shipping', ?, 'paid', 'Jest Customer', 'Cairo')
  `).run(custId, JSON.stringify([{ id: 1, name: 'Test', price: 10000, qty: 2 }]));
  orderId = res.lastInsertRowid;
});

afterAll(() => {
  settingsService.set('order_flow_enabled', false, 'jest');
  // children-first (FK ON): shipments/order_items/issue_orders → orders → customers
  db.prepare('DELETE FROM shipments WHERE order_id = ?').run(orderId);
  db.prepare('DELETE FROM order_items WHERE order_id = ?').run(orderId);
  db.prepare('DELETE FROM issue_orders WHERE order_id = ?').run(orderId);
  db.prepare("DELETE FROM events WHERE entity_type = 'order' AND entity_id = ?").run(orderId);
  db.prepare('DELETE FROM orders WHERE id = ?').run(orderId);
  db.prepare('DELETE FROM customers WHERE id = ?').run(custId);
  db.saveDb();
});

describe('Shipment providers', () => {
  test('seeded providers include the three delivery methods', () => {
    const providers = shipping.listProviders();
    const types = providers.map(p => p.type);
    expect(types).toContain('employee');
    expect(types).toContain('contractor');
    expect(types).toContain('company');
    expect(providers.some(p => p.name === 'FedEx')).toBe(true);
  });

  test('provider CRUD works', () => {
    const created = shipping.createProvider({ name: 'Jest Courier', type: 'company', trackingUrlTemplate: 'https://track/{TRACKING}' });
    expect(created.type).toBe('company');

    const updated = shipping.updateProvider(created.id, { contactPhone: '12345' });
    expect(updated.contact_phone).toBe('12345');

    shipping.deleteProvider(created.id);
    expect(shipping.listProviders(true).some(p => p.id === created.id)).toBe(false);
  });

  test('invalid provider type rejected', () => {
    expect(() => shipping.createProvider({ name: 'Bad', type: 'spaceship' })).toThrow(/employee, contractor or company/);
  });
});

describe('Shipments', () => {
  test('creating a shipment advances the order to shipped', () => {
    const provider = shipping.listProviders().find(p => p.type === 'company');
    const shipment = shipping.createShipment({
      orderId,
      providerId: provider.id,
      notes: 'jest:shipment',
      userId: 'jest-shipper',
    });

    expect(shipment.tracking_number).toBeTruthy();
    expect(shipment.status).toBe('pending');
    expect(shipment.tracking_url).toContain('http'); // provider template used

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    expect(order.status).toBe('shipped');

    // duplicate shipment rejected
    expect(() => shipping.createShipment({ orderId, providerId: provider.id, userId: 'jest' })).toThrow(/already has a shipment/);
  });

  test('tracking URL built from provider template', () => {
    const provider = { type: 'company', tracking_url_template: 'https://track.example/{TRACKING}' };
    expect(shipping.trackingUrl(provider, 'CS-123')).toBe('https://track.example/CS-123');
  });

  test('shipment status flow: in_transit â†’ delivered moves the order', () => {
    const shipment = db.prepare('SELECT * FROM shipments WHERE order_id = ?').get(orderId);

    const transit = shipping.updateShipmentStatus(shipment.id, 'in_transit', { userId: 'jest' });
    expect(transit.status).toBe('in_transit');

    const delivered = shipping.updateShipmentStatus(shipment.id, 'delivered', { userId: 'jest' });
    expect(delivered.status).toBe('delivered');
    expect(delivered.delivered_at).toBeTruthy();

    // order â†’ delivered
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    expect(order.status).toBe('delivered');
  });

  test('failed status does not deliver the order', () => {
    // create a second order+shipment to test failure path
    const o2 = db.prepare(`
      INSERT INTO orders (customer_id, total, status, items, payment_status)
      VALUES (?, 5000, 'ready_for_shipping', ?, 'paid')
    `).run(custId, JSON.stringify([{ id: 1, name: 'Test', price: 5000, qty: 1 }])).lastInsertRowid;
    const shipment = shipping.createShipment({ orderId: o2, userId: 'jest' });

    shipping.updateShipmentStatus(shipment.id, 'failed', { userId: 'jest' });
    expect(db.prepare('SELECT status FROM orders WHERE id = ?').get(o2).status).toBe('shipped');

    db.prepare('DELETE FROM shipments WHERE order_id = ?').run(o2);
    db.prepare('DELETE FROM orders WHERE id = ?').run(o2);
    db.prepare("DELETE FROM events WHERE entity_type = 'order' AND entity_id = ?").run(o2);
  });

  test('invalid shipment status rejected', () => {
    const shipment = db.prepare('SELECT * FROM shipments WHERE order_id = ?').get(orderId);
    expect(() => shipping.updateShipmentStatus(shipment.id, 'teleported', { userId: 'jest' })).toThrow(/Invalid shipment status/);
  });

  test('carrier abstraction: registerCarrier + getCarrier', () => {
    shipping.registerCarrier('testcarrier', { trackingUrl: () => 'https://test-carrier/track' });
    expect(shipping.getCarrier('testcarrier').trackingUrl()).toBe('https://test-carrier/track');
    // unknown carriers fall back to local
    expect(shipping.getCarrier('nonexistent').trackingUrl).toBeDefined();
  });
});
