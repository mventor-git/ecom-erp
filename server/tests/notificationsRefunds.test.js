/**
 * Tests for notification channels (STEP 9), refunds, and idempotency (STEP 15).
 */
const db = require('../db');
const channels = require('../services/notificationChannels');
const settingsService = require('../services/settingsService');
const workflow = require('../services/orderWorkflowService');
const idempotency = require('../services/idempotencyService');

let orderId = null;

beforeAll(async () => {
  await db.initPromise;
  // load notificationService so the built-in channel senders register themselves
  require('../services/notificationService');
  db.prepare("DELETE FROM customers WHERE email = 'jest.notif@test.com'").run();
  const custId = db.prepare('INSERT INTO customers (email, name, google_id) VALUES (?, ?, ?)')
    .run('jest.notif@test.com', 'Jest Notif', 'jest_notif').lastInsertRowid;
  const res = db.prepare(`
    INSERT INTO orders (customer_id, total, status, items, payment_status)
    VALUES (?, 15000, 'paid', ?, 'paid')
  `).run(custId, JSON.stringify([{ id: 1, name: 'Test', price: 5000, qty: 3 }]));
  orderId = res.lastInsertRowid;
});

afterAll(() => {
  db.prepare('DELETE FROM orders WHERE id = ?').run(orderId);
  db.prepare("DELETE FROM customers WHERE email = 'jest.notif@test.com'").run();
  db.prepare("DELETE FROM events WHERE entity_type = 'order' AND entity_id = ?").run(orderId);
  db.saveDb();
});

describe('Notification channels (STEP 9)', () => {
  test('defaults: dashboard/email/webhook on, push/sms/whatsapp off', () => {
    expect(channels.isChannelEnabled('dashboard')).toBe(true);
    expect(channels.isChannelEnabled('email')).toBe(true);
    expect(channels.isChannelEnabled('webhook')).toBe(true);
    expect(channels.isChannelEnabled('push')).toBe(false);
    expect(channels.isChannelEnabled('sms')).toBe(false);
    expect(channels.isChannelEnabled('whatsapp')).toBe(false);
  });

  test('channel toggles are configurable via settings', () => {
    settingsService.set('notify_channel_email', false, 'jest');
    expect(channels.isChannelEnabled('email')).toBe(false);
    settingsService.set('notify_channel_email', true, 'jest');
    expect(channels.isChannelEnabled('email')).toBe(true);
  });

  test('dispatch calls registered senders; skips unregistered/disabled channels', async () => {
    const calls = [];
    // register a sender under the SEEDED but unregistered 'push' channel
    channels.registerChannel('push', async (payload) => { calls.push(payload); });

    // disabled by default (notify_channel_push = 0)
    const r1 = await channels.dispatch('push', { a: 1 });
    expect(r1.sent).toBe(false);

    settingsService.set('notify_channel_push', true, 'jest');
    const r2 = await channels.dispatch('push', { a: 2 });
    expect(r2.sent).toBe(true);
    expect(calls.length).toBe(1);
    expect(calls[0].a).toBe(2);
    settingsService.set('notify_channel_push', false, 'jest'); // restore default

    // unregistered channel
    const r3 = await channels.dispatch('never_registered', {});
    expect(r3.sent).toBe(false);
    expect(r3.reason).toBe('not_registered');
  });

  test('listChannels reports enabled + registered status', () => {
    const list = channels.listChannels();
    expect(list.some(c => c.name === 'push' && c.future)).toBe(false); // push is now registered
    expect(list.some(c => c.name === 'sms' && c.future)).toBe(true);
    expect(list.some(c => c.name === 'dashboard' && c.enabled && c.registered)).toBe(true);
  });
});

describe('Refunds (STEP 4 completion)', () => {
  beforeAll(() => {
    settingsService.set('order_flow_enabled', true, 'jest'); // full transition map
  });

  afterAll(() => {
    settingsService.set('order_flow_enabled', false, 'jest');
  });

  test('refunded is a valid transition from payable lifecycle states', () => {
    // full flow states (orders use payment_verified, not legacy 'paid')
    expect(workflow.canTransition('confirmed', 'refunded')).toBe(true);
    expect(workflow.canTransition('shipped', 'refunded')).toBe(true);
    expect(workflow.canTransition('delivered', 'refunded')).toBe(true);
    expect(workflow.canTransition('completed', 'refunded')).toBe(true);
    // legacy mode still allows paid → refunded
    settingsService.set('order_flow_enabled', false, 'jest');
    expect(workflow.canTransition('paid', 'refunded')).toBe(true);
    settingsService.set('order_flow_enabled', true, 'jest');
    // not refundable from unpaid / terminal states
    expect(workflow.canTransition('draft', 'refunded')).toBe(false);
    expect(workflow.canTransition('payment_pending', 'refunded')).toBe(false);
    expect(workflow.canTransition('cancelled', 'refunded')).toBe(false);
  });

  test('transition to refunded emits order_refunded event', () => {
    // the fixture order is legacy status 'paid' → refund via legacy path
    settingsService.set('order_flow_enabled', false, 'jest');
    const updated = workflow.transitionOrder(orderId, 'refunded', { userId: 'jest-admin', reason: 'jest refund' });
    settingsService.set('order_flow_enabled', true, 'jest');
    expect(updated.status).toBe('refunded');

    const ev = db.prepare(`
      SELECT * FROM events WHERE entity_type = 'order' AND entity_id = ? AND event_type = 'order_refunded'
    `).all(orderId);
    expect(ev.length).toBeGreaterThanOrEqual(1);
  });
});

describe('Idempotency (STEP 15)', () => {
  test('same key returns cached response without re-running handler', () => {
    const store = idempotency;
    let runs = 0;

    const makeRes = () => {
      const res = {
        statusCode: 201,
        status: (c) => { res.statusCode = c; return res; },
        json: (body) => { res._body = body; return res; },
      };
      return res;
    };
    const makeReq = (key) => ({ method: 'POST', originalUrl: '/test', headers: { 'idempotency-key': key } });

    // simulate middleware flow
    const req1 = makeReq('key-1');
    const res1 = makeRes();
    const next1 = () => {
      runs++;
      res1.statusCode = 201;
      res1.json({ ok: true, n: runs });
    };
    idempotency.idempotency(req1, res1, next1);
    expect(runs).toBe(1);

    // second request with same key → cached response, handler NOT run
    const req2 = makeReq('key-1');
    const res2 = makeRes();
    const next2 = () => { runs++; };
    idempotency.idempotency(req2, res2, next2);
    expect(runs).toBe(1); // not re-run
    expect(res2._body).toEqual({ ok: true, n: 1 });

    // different key → handler runs
    const req3 = makeReq('key-2');
    const res3 = makeRes();
    const next3 = () => { runs++; res3.statusCode = 201; res3.json({ ok: true, n: runs }); };
    idempotency.idempotency(req3, res3, next3);
    expect(runs).toBe(2);
  });

  test('no key header → middleware passes through', () => {
    let nextCalled = false;
    const req = { method: 'GET', originalUrl: '/test', headers: {} };
    const res = { json: () => {} };
    idempotency.idempotency(req, res, () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
  });
});
