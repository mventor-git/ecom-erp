/**
 * Mobile API integration tests (mventor-ticket-035a).
 * Requires the server to be started on PORT (handled by run-integration-tests.js).
 *
 * Covers: JWT staff auth, customer auth, products, cart, orders, user,
 * images, notifications, and webhooks (including live delivery + signature).
 */

const http = require('http');
const crypto = require('crypto');

const BASE = `http://localhost:${process.env.PORT || 3099}`;

const STAFF_EMAIL = 'integration.staff@ecom-erp.local';
const STAFF_PASSWORD = 'IntegrationTest123!';

let staffToken = '';
let customerToken = '';

function req(method, path, opts = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const headers = { ...opts.headers };
    if (opts.token) headers['Authorization'] = `Bearer ${opts.token}`;
    if (opts.json) headers['Content-Type'] = 'application/json';
    if (opts.body) headers['Content-Length'] = Buffer.byteLength(opts.body);

    const r = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers,
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(body); } catch { parsed = body; }
        resolve({ status: res.statusCode, body: parsed, headers: res.headers });
      });
    });
    r.on('error', reject);
    if (opts.body) r.write(opts.body);
    r.end();
  });
}

function post(path, body, token) {
  return req('POST', path, { json: true, body: JSON.stringify(body), token });
}

function put(path, body, token) {
  return req('PUT', path, { json: true, body: JSON.stringify(body), token });
}

function del(path, body, token) {
  return req('DELETE', path, body ? { json: true, body: JSON.stringify(body), token } : { token });
}

function waitFor(check, timeoutMs = 8000, interval = 300) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = async () => {
      try {
        const result = await check();
        if (result) return resolve(result);
      } catch { /* keep polling */ }
      if (Date.now() - start > timeoutMs) return reject(new Error('waitFor timed out'));
      setTimeout(tick, interval);
    };
    tick();
  });
}

// â”€â”€ Staff JWT Auth (mobileAuth) â”€â”€

describe('Mobile â€” Staff JWT Auth', () => {
  test('POST /api/v1/auth/mobile/login returns tokens', async () => {
    const res = await post('/api/v1/auth/mobile/login', { email: STAFF_EMAIL, password: STAFF_PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeTruthy();
    expect(res.body.refresh_token).toBeTruthy();
    expect(res.body.user.email).toBe(STAFF_EMAIL);
    staffToken = res.body.token;
  });

  test('POST /api/v1/auth/mobile/login with wrong password returns 401', async () => {
    const res = await post('/api/v1/auth/mobile/login', { email: STAFF_EMAIL, password: 'wrong' });
    expect(res.status).toBe(401);
  });

  test('POST /api/v1/auth/mobile/refresh returns new token', async () => {
    const login = await post('/api/v1/auth/mobile/login', { email: STAFF_EMAIL, password: STAFF_PASSWORD });
    const res = await post('/api/v1/auth/mobile/refresh', { refresh_token: login.body.refresh_token });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeTruthy();
  });

  test('POST /api/v1/auth/mobile/refresh with invalid token returns 401', async () => {
    const res = await post('/api/v1/auth/mobile/refresh', { refresh_token: 'not-a-real-token' });
    expect(res.status).toBe(401);
  });

  test('GET /api/v1/auth/mobile/me returns profile', async () => {
    const res = await req('GET', '/api/v1/auth/mobile/me', { token: staffToken });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe(STAFF_EMAIL);
  });

  test('GET /api/v1/auth/mobile/me without token returns 401', async () => {
    const res = await req('GET', '/api/v1/auth/mobile/me');
    expect(res.status).toBe(401);
  });

  test('POST /api/v1/auth/mobile/logout returns success', async () => {
    const res = await post('/api/v1/auth/mobile/logout', {}, staffToken);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// â”€â”€ Customer Auth (mobileCustomerAuth) â”€â”€

describe('Mobile â€” Customer Auth', () => {
  const email = `mobile.customer.${Date.now()}@test.com`;

  test('POST /api/v1/auth/customer/register creates account', async () => {
    const res = await post('/api/v1/auth/customer/register', {
      email, password: 'secret123', name: 'Mobile Test Customer', phone: '01000000000',
    });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeTruthy();
    customerToken = res.body.token;
  });

  test('POST /api/v1/auth/customer/register duplicate email returns 400', async () => {
    const res = await post('/api/v1/auth/customer/register', {
      email, password: 'secret123', name: 'Duplicate',
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('EMAIL_EXISTS');
  });

  test('POST /api/v1/auth/customer/login returns tokens', async () => {
    const res = await post('/api/v1/auth/customer/login', { email, password: 'secret123' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeTruthy();
  });

  test('POST /api/v1/auth/customer/login wrong password returns 401', async () => {
    const res = await post('/api/v1/auth/customer/login', { email, password: 'wrongpass' });
    expect(res.status).toBe(401);
  });

  test('GET /api/v1/auth/customer/me returns customer', async () => {
    const res = await req('GET', '/api/v1/auth/customer/me', { token: customerToken });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// â”€â”€ Products API â”€â”€

describe('Mobile â€” Products API', () => {
  let firstProductId = null;

  test('GET /api/v1/products returns paginated list', async () => {
    const res = await req('GET', '/api/v1/products?limit=5');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.pagination).toBeDefined();
    expect(res.body.pagination.total).toBeGreaterThan(0);
    firstProductId = res.body.data[0].id;
  });

  test('GET /api/v1/products?fields= sparse fieldsets', async () => {
    const res = await req('GET', '/api/v1/products?limit=3&fields=id,name,price');
    expect(res.status).toBe(200);
    expect(res.body.data.every(p => p.id !== undefined && p.name !== undefined)).toBe(true);
    expect(res.body.data.every(p => p.description === undefined)).toBe(true);
  });

  test('GET /api/v1/products/featured returns list', async () => {
    const res = await req('GET', '/api/v1/products/featured');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('GET /api/v1/products/:id returns product', async () => {
    if (!firstProductId) return;
    const res = await req('GET', `/api/v1/products/${firstProductId}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(firstProductId);
  });

  test('GET /api/v1/products/999999 returns 404', async () => {
    const res = await req('GET', '/api/v1/products/999999');
    expect(res.status).toBe(404);
  });

  test('GET /api/v1/products/categories returns list', async () => {
    const res = await req('GET', '/api/v1/products/categories');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// â”€â”€ Cart API â”€â”€

describe('Mobile â€” Cart API', () => {
  let productId = null;
  let cartItemId = null;

  beforeAll(async () => {
    const res = await req('GET', '/api/v1/products?limit=50');
    const inStock = (res.body.data || []).find(p => p.stock > 0);
    productId = inStock ? inStock.id : null;
    await req('DELETE', '/api/v1/cart', { token: customerToken });
  });

  test('GET /api/v1/cart without token returns 401', async () => {
    const res = await req('GET', '/api/v1/cart');
    expect(res.status).toBe(401);
  });

  test('GET /api/v1/cart returns empty cart', async () => {
    const res = await req('GET', '/api/v1/cart', { token: customerToken });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.items).toEqual([]);
    expect(res.body.data.total).toBe(0);
  });

  test('POST /api/v1/cart/items adds item', async () => {
    const res = await post('/api/v1/cart/items', { product_id: productId, quantity: 2 }, customerToken);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.cart_item_id).toBeTruthy();
    cartItemId = res.body.data.cart_item_id;
  });

  test('POST /api/v1/cart/items invalid product returns 404', async () => {
    const res = await post('/api/v1/cart/items', { product_id: 999999 }, customerToken);
    expect(res.status).toBe(404);
  });

  test('PUT /api/v1/cart/items/:id updates quantity', async () => {
    if (!cartItemId) return;
    const res = await put(`/api/v1/cart/items/${cartItemId}`, { quantity: 3 }, customerToken);
    expect(res.status).toBe(200);
    expect(res.body.data.quantity).toBe(3);
  });

  test('GET /api/v1/cart reflects totals', async () => {
    const res = await req('GET', '/api/v1/cart', { token: customerToken });
    expect(res.status).toBe(200);
    expect(res.body.data.total_items).toBe(3);
    expect(res.body.data.subtotal).toBeGreaterThan(0);
  });

  test('DELETE /api/v1/cart/items/:id removes item', async () => {
    if (!cartItemId) return;
    const res = await req('DELETE', `/api/v1/cart/items/${cartItemId}`, { token: customerToken });
    expect(res.status).toBe(200);
    const cart = await req('GET', '/api/v1/cart', { token: customerToken });
    expect(cart.body.data.items).toEqual([]);
  });

  test('DELETE /api/v1/cart clears cart', async () => {
    await post('/api/v1/cart/items', { product_id: productId, quantity: 1 }, customerToken);
    const res = await req('DELETE', '/api/v1/cart', { token: customerToken });
    expect(res.status).toBe(200);
    const cart = await req('GET', '/api/v1/cart', { token: customerToken });
    expect(cart.body.data.items).toEqual([]);
  });
});

// â”€â”€ Orders API â”€â”€

describe('Mobile â€” Orders API', () => {
  let productId = null;
  let orderId = null;
  let orderNumber = null;

  beforeAll(async () => {
    const res = await req('GET', '/api/v1/products?limit=50');
    const inStock = (res.body.data || []).find(p => p.stock > 0);
    productId = inStock ? inStock.id : null;
  });

  test('POST /api/v1/orders with empty cart returns 400', async () => {
    await req('DELETE', '/api/v1/cart', { token: customerToken });
    const res = await post('/api/v1/orders', {
      shipping_address: { name: 'T', phone: '0100', address: 'A', city: 'Cairo' },
    }, customerToken);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('EMPTY_CART');
  });

  test('POST /api/v1/orders missing address returns 400', async () => {
    await post('/api/v1/cart/items', { product_id: productId, quantity: 1 }, customerToken);
    const res = await post('/api/v1/orders', {}, customerToken);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('POST /api/v1/orders creates order', async () => {
    await post('/api/v1/cart/items', { product_id: productId, quantity: 2 }, customerToken);
    const res = await post('/api/v1/orders', {
      shipping_address: {
        name: 'Mobile Test', phone: '01000000000', address: '15 Street', city: 'Cairo',
        governorate: 'Cairo', postal_code: '11511',
      },
      payment_method: 'cod',
      notes: 'integration test',
    }, customerToken);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.order_id).toBeTruthy();
    expect(res.body.data.status).toBe('pending');
    orderId = res.body.data.order_id;
    orderNumber = res.body.data.order_number;
  });

  test('GET /api/v1/orders lists orders', async () => {
    const res = await req('GET', '/api/v1/orders', { token: customerToken });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.pagination.total).toBeGreaterThan(0);
    expect(res.body.data.some(o => o.id === orderId)).toBe(true);
  });

  test('GET /api/v1/orders/:id returns details', async () => {
    if (!orderId) return;
    const res = await req('GET', `/api/v1/orders/${orderId}`, { token: customerToken });
    expect(res.status).toBe(200);
    expect(res.body.data.order_number).toBe(orderNumber);
    expect(res.body.data.items.length).toBeGreaterThan(0);
  });

  test('POST /api/v1/orders/:id/cancel cancels pending order', async () => {
    if (!orderId) return;
    const res = await post(`/api/v1/orders/${orderId}/cancel`, {}, customerToken);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('POST /api/v1/orders/:id/cancel twice returns 400', async () => {
    if (!orderId) return;
    const res = await post(`/api/v1/orders/${orderId}/cancel`, {}, customerToken);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_STATUS');
  });

  test('GET /api/v1/orders/:id foreign order returns 404', async () => {
    const res = await req('GET', '/api/v1/orders/999999', { token: customerToken });
    expect(res.status).toBe(404);
  });
});

// â”€â”€ Worker API (staff app, mventor-ticket-036) â”€â”€

describe('Mobile â€” Worker API', () => {
  let workerOrderId = null;
  let workerProductId = null;

  beforeAll(async () => {
    const res = await req('GET', '/api/v1/products?limit=1');
    workerProductId = res.body.data[0].id;
  });

  test('GET /api/v1/worker/orders without token returns 401', async () => {
    const res = await req('GET', '/api/v1/worker/orders');
    expect(res.status).toBe(401);
  });

  test('GET /api/v1/worker/orders with customer token returns 403', async () => {
    const res = await req('GET', '/api/v1/worker/orders', { token: customerToken });
    expect(res.status).toBe(403);
  });

  test('GET /api/v1/worker/stats requires staff', async () => {
    const res = await req('GET', '/api/v1/worker/stats');
    expect(res.status).toBe(401);
    const res2 = await req('GET', '/api/v1/worker/stats', { token: customerToken });
    expect(res2.status).toBe(403);
  });

  test('worker can see a fresh customer order', async () => {
    // create a fresh COD order via the customer flow
    await post('/api/v1/cart/items', { product_id: workerProductId, quantity: 1 }, customerToken);
    const created = await post('/api/v1/orders', {
      shipping_address: { name: 'Worker Test', phone: '01000000000', address: '20 Street', city: 'Cairo' },
      payment_method: 'cod',
    }, customerToken);
    expect(created.status).toBe(201);
    workerOrderId = created.body.data.order_id;

    const res = await req('GET', '/api/v1/worker/orders', { token: staffToken });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.some(o => o.id === workerOrderId)).toBe(true);
    expect(typeof res.body.data[0].total_formatted).toBe('string');
  });

  test('GET /api/v1/worker/orders/:id returns detail with items and transitions', async () => {
    const res = await req('GET', `/api/v1/worker/orders/${workerOrderId}`, { token: staffToken });
    expect(res.status).toBe(200);
    expect(res.body.data.order_number).toBeTruthy();
    expect(res.body.data.items.length).toBeGreaterThan(0);
    expect(Array.isArray(res.body.data.allowed_transitions)).toBe(true);
    expect(res.body.data.shipping_name).toBe('Worker Test');
  });

  test('GET /api/v1/worker/orders/:id missing returns 404', async () => {
    const res = await req('GET', '/api/v1/worker/orders/999999', { token: staffToken });
    expect(res.status).toBe(404);
  });

  test('PUT status invalid transition returns 400', async () => {
    const res = await put(`/api/v1/worker/orders/${workerOrderId}/status`, { status: 'shipped', reason: 'test' }, staffToken);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_TRANSITION');
  });

  test('PUT status cancel works from pending (both flow modes)', async () => {
    const res = await put(`/api/v1/worker/orders/${workerOrderId}/status`, { status: 'cancelled', reason: 'worker test' }, staffToken);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('cancelled');
  });

  test('PUT status on cancelled order returns 400', async () => {
    const res = await put(`/api/v1/worker/orders/${workerOrderId}/status`, { status: 'shipped' }, staffToken);
    expect(res.status).toBe(400);
  });

  test('POST proof without file returns 400', async () => {
    const res = await post(`/api/v1/worker/orders/${workerOrderId}/proof`, {}, staffToken);
    expect(res.status).toBe(400);
  });

  test('POST proof on cancelled order returns 400', async () => {
    // multipart request with a small PNG (Buffer body to keep Content-Length exact)
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    const body = Buffer.concat([
      Buffer.from('------testboundary\r\nContent-Disposition: form-data; name="photo"; filename="p.png"\r\nContent-Type: image/png\r\n\r\n'),
      png,
      Buffer.from('\r\n------testboundary--\r\n'),
    ]);
    const res = await req('POST', `/api/v1/worker/orders/${workerOrderId}/proof`, {
      token: staffToken,
      headers: { 'Content-Type': 'multipart/form-data; boundary=----testboundary' },
      body,
    });
    expect(res.status).toBe(400);
  });

  test('GET /api/v1/worker/stats returns numbers', async () => {
    const res = await req('GET', '/api/v1/worker/stats', { token: staffToken });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.data.active_orders).toBe('number');
    expect(typeof res.body.data.cod_collected_formatted).toBe('string');
  });
});

// â”€â”€ User API â”€â”€

describe('Mobile â€” User API', () => {
  let addressId = null;

  test('GET /api/v1/user/profile returns profile', async () => {
    const res = await req('GET', '/api/v1/user/profile', { token: customerToken });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBeTruthy();
  });

  test('PUT /api/v1/user/profile updates name', async () => {
    const res = await put('/api/v1/user/profile', { name: 'Updated Mobile Customer' }, customerToken);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('PUT /api/v1/user/password changes password', async () => {
    const res = await put('/api/v1/user/password', { current_password: 'secret123', new_password: 'newsecret456' }, customerToken);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('PUT /api/v1/user/password wrong current password returns 400', async () => {
    const res = await put('/api/v1/user/password', { current_password: 'wrong', new_password: 'newsecret456' }, customerToken);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_PASSWORD');
  });

  test('POST /api/v1/user/addresses creates address', async () => {
    const res = await post('/api/v1/user/addresses', {
      name: 'Home', phone: '01000000000', address: '15 Street', city: 'Cairo',
      governorate: 'Cairo', postal_code: '11511', is_default: true,
    }, customerToken);
    expect(res.status).toBe(201);
    expect(res.body.data.address_id).toBeTruthy();
    addressId = res.body.data.address_id;
  });

  test('PUT /api/v1/user/addresses/:id updates address', async () => {
    if (!addressId) return;
    const res = await put(`/api/v1/user/addresses/${addressId}`, { city: 'Giza' }, customerToken);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('DELETE /api/v1/user/addresses/:id removes address', async () => {
    if (!addressId) return;
    const res = await req('DELETE', `/api/v1/user/addresses/${addressId}`, { token: customerToken });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  // restore password for later tests that need login
  test('restore customer password', async () => {
    const res = await put('/api/v1/user/password', { current_password: 'newsecret456', new_password: 'secret123' }, customerToken);
    expect(res.status).toBe(200);
  });
});

// â”€â”€ Images API â”€â”€

describe('Mobile â€” Images API', () => {
  const EXISTING_IMAGE = '01bbe340a4fd6903a861c60d5f5a03e8.jpg';

  test('GET /api/v1/images/:file?width= returns resized image', async () => {
    const res = await req('GET', `/api/v1/images/${EXISTING_IMAGE}?width=100&quality=70`);
    expect(res.status).toBe(200);
    expect((res.headers['content-type'] || '').startsWith('image/')).toBe(true);
  });

  test('GET /api/v1/images/:file?format=webp converts format', async () => {
    const res = await req('GET', `/api/v1/images/${EXISTING_IMAGE}?width=64&format=webp`);
    expect(res.status).toBe(200);
    expect((res.headers['content-type'] || '').includes('webp')).toBe(true);
  });

  test('GET /api/v1/images/missing.jpg returns 404', async () => {
    const res = await req('GET', '/api/v1/images/definitely-missing-12345.jpg');
    expect(res.status).toBe(404);
  });
});

// â”€â”€ Notifications API â”€â”€

describe('Mobile â€” Notifications API', () => {
  const deviceToken = `device_${Date.now()}`;

  test('POST /api/v1/notifications/register registers device', async () => {
    const res = await post('/api/v1/notifications/register', { device_token: deviceToken, platform: 'android', app_version: '1.0.0' }, customerToken);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('POST /api/v1/notifications/register without token returns 400', async () => {
    const res = await post('/api/v1/notifications/register', { platform: 'android' }, customerToken);
    expect(res.status).toBe(400);
  });

  test('GET /api/v1/notifications/preferences returns defaults', async () => {
    const res = await req('GET', '/api/v1/notifications/preferences', { token: customerToken });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.data.order_updates).toBe('boolean');
  });

  test('PUT /api/v1/notifications/preferences updates', async () => {
    const res = await put('/api/v1/notifications/preferences', { promotions: false, new_arrivals: true }, customerToken);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('GET /api/v1/notifications lists notifications', async () => {
    const res = await req('GET', '/api/v1/notifications', { token: customerToken });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('DELETE /api/v1/notifications/register unregisters device', async () => {
    const res = await del('/api/v1/notifications/register', { device_token: deviceToken }, customerToken);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// â”€â”€ Wishlist API â”€â”€

describe('Mobile â€” Wishlist API', () => {
  test('GET /api/v1/wishlist without token returns 401', async () => {
    const res = await req('GET', '/api/v1/wishlist');
    expect(res.status).toBe(401);
  });

  test('GET /api/v1/wishlist returns empty list', async () => {
    const res = await req('GET', '/api/v1/wishlist', { token: customerToken });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('GET /api/v1/wishlist/ids returns array', async () => {
    const res = await req('GET', '/api/v1/wishlist/ids', { token: customerToken });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('POST /api/v1/wishlist/items adds product', async () => {
    const product = await req('GET', '/api/v1/products?limit=1');
    const productId = product.body.data[0].id;
    const res = await post('/api/v1/wishlist/items', { product_id: productId }, customerToken);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  test('POST /api/v1/wishlist/items missing product returns 400', async () => {
    const res = await post('/api/v1/wishlist/items', {}, customerToken);
    expect(res.status).toBe(400);
  });

  test('POST /api/v1/wishlist/items invalid product returns 404', async () => {
    const res = await post('/api/v1/wishlist/items', { product_id: 999999 }, customerToken);
    expect(res.status).toBe(404);
  });

  test('GET /api/v1/wishlist reflects added item', async () => {
    const res = await req('GET', '/api/v1/wishlist', { token: customerToken });
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(typeof res.body.data[0].product_name).toBe('string');
    expect(typeof res.body.data[0].price_formatted).toBe('string');
  });

  test('DELETE /api/v1/wishlist/items/:productId removes item', async () => {
    const wishlist = await req('GET', '/api/v1/wishlist', { token: customerToken });
    const productId = wishlist.body.data[0].product_id;
    const res = await del(`/api/v1/wishlist/items/${productId}`, null, customerToken);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('DELETE /api/v1/wishlist/items/:productId twice returns 404', async () => {
    const wishlist = await req('GET', '/api/v1/wishlist', { token: customerToken });
    if (wishlist.body.data.length === 0) {
      const product = await req('GET', '/api/v1/products?limit=1');
      await post('/api/v1/wishlist/items', { product_id: product.body.data[0].id }, customerToken);
    }
    const wishlist2 = await req('GET', '/api/v1/wishlist', { token: customerToken });
    const productId = wishlist2.body.data[0].product_id;
    await del(`/api/v1/wishlist/items/${productId}`, null, customerToken);
    const res = await del(`/api/v1/wishlist/items/${productId}`, null, customerToken);
    expect(res.status).toBe(404);
  });
});

// â”€â”€ Webhooks API â”€â”€

describe('Mobile â€” Webhooks API', () => {
  let listener = null;
  let received = null;
  let webhookId = null;
  let webhookSecret = null;
  const receivedEvent = new Promise(resolve => {
    received = resolve;
  });

  beforeAll(async () => {
    // Local listener that receives webhook deliveries
    listener = http.createServer((req, res) => {
      let body = '';
      req.on('data', c => body += c);
      req.on('end', () => {
        received({
          url: req.url,
          body,
          signature: req.headers['x-webhook-signature'] || '',
          contentType: req.headers['content-type'] || '',
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      });
    });
    await new Promise(resolve => listener.listen(0, '127.0.0.1', resolve));
  });

  afterAll(() => {
    if (listener) listener.close();
  });

  test('POST /api/v1/webhooks with customer token returns 403', async () => {
    const res = await post('/api/v1/webhooks', { url: 'https://example.com/hook', events: ['*'] }, customerToken);
    expect(res.status).toBe(403);
  });

  test('POST /api/v1/webhooks invalid URL returns 400', async () => {
    const res = await post('/api/v1/webhooks', { url: 'not-a-url', events: ['*'] }, staffToken);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('POST /api/v1/webhooks registers webhook', async () => {
    const port = listener.address().port;
    // Subscribe to 'test.event' ONLY â€” avoids self-triggering on the
    // user_updated event emitted by this create route itself.
    const res = await post('/api/v1/webhooks', {
      url: `http://127.0.0.1:${port}/hook`,
      events: ['test.event'],
    }, staffToken);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeTruthy();
    expect(res.body.data.is_active).toBe(1);
    webhookId = res.body.data.id;
    webhookSecret = res.body.data.secret;
  });

  test('GET /api/v1/webhooks lists webhooks', async () => {
    const res = await req('GET', '/api/v1/webhooks', { token: staffToken });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.some(w => w.id === webhookId)).toBe(true);
  });

  test('GET /api/v1/webhooks/:id returns detail', async () => {
    if (!webhookId) return;
    const res = await req('GET', `/api/v1/webhooks/${webhookId}`, { token: staffToken });
    expect(res.status).toBe(200);
    expect(res.body.data.url).toContain('/hook');
  });

  test('GET /api/v1/webhooks/999999 returns 404', async () => {
    const res = await req('GET', '/api/v1/webhooks/999999', { token: staffToken });
    expect(res.status).toBe(404);
  });

  test('PUT /api/v1/webhooks/:id updates webhook', async () => {
    if (!webhookId) return;
    const res = await put(`/api/v1/webhooks/${webhookId}`, { events: ['order_created'] }, staffToken);
    expect(res.status).toBe(200);
    expect(res.body.data.events).toContain('order_created');
  });

  test('POST /api/v1/webhooks/:id/test delivers signed payload', async () => {
    if (!webhookId) return;
    const res = await post(`/api/v1/webhooks/${webhookId}/test`, {}, staffToken);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Wait for the local listener to receive the delivery
    const delivery = await Promise.race([
      receivedEvent,
      new Promise((_, rej) => setTimeout(() => rej(new Error('webhook delivery timeout')), 8000)),
    ]);

    expect(delivery.url).toBe('/hook');
    expect(delivery.contentType).toContain('application/json');

    const payload = JSON.parse(delivery.body);
    expect(payload.event_type).toBe('test.event');
    expect(payload.data.webhook_id).toBe(webhookId);
    expect(payload.id).toMatch(/^evt_/);

    // Verify HMAC-SHA256 signature
    const expected = crypto.createHmac('sha256', webhookSecret).update(delivery.body).digest('hex');
    expect(delivery.signature).toBe(expected);
  });

  test('GET /api/v1/webhooks/:id/deliveries logs delivery', async () => {
    if (!webhookId) return;
    // Poll until the test.event delivery record is written
    const deliveries = await waitFor(async () => {
      const res = await req('GET', `/api/v1/webhooks/${webhookId}/deliveries`, { token: staffToken });
      const match = (res.body.data || []).find(d => d.event_type === 'test.event');
      if (match) return { match, stats: res.body.stats };
      return null;
    });
    expect(deliveries.match.success).toBe(1);
    expect(deliveries.stats.total).toBeGreaterThan(0);
    expect(deliveries.stats.successful).toBeGreaterThan(0);
  });

  test('DELETE /api/v1/webhooks/:id deactivates webhook', async () => {
    if (!webhookId) return;
    const res = await req('DELETE', `/api/v1/webhooks/${webhookId}`, { token: staffToken });
    expect(res.status).toBe(200);
    expect(res.body.data.is_active).toBe(0);

    const detail = await req('GET', `/api/v1/webhooks/${webhookId}`, { token: staffToken });
    expect(detail.body.data.is_active).toBe(0);
  });
});
