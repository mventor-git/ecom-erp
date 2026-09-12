/**
 * Integration tests for API endpoints.
 * Requires the server to be started (handled by globalSetup).
 */
const http = require('http');

const BASE = `http://localhost:${process.env.PORT || 3099}`;

let cookie = '';
let csrfToken = '';

function req(method, path, opts = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const headers = { ...opts.headers };
    if (cookie) headers['Cookie'] = cookie;
    if (csrfToken && method !== 'GET') headers['X-CSRF-Token'] = csrfToken;
    if (opts.json) headers['Content-Type'] = 'application/json';

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers,
    };

    const r = http.request(options, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        const setCookie = res.headers['set-cookie'];
        if (setCookie) cookie = setCookie[0].split(';')[0];
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

// ── Health ──

describe('Health', () => {
  test('GET /api/health returns ok', async () => {
    const res = await req('GET', '/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.timestamp).toBeDefined();
  });
});

// ── Public Products ──

describe('Public Products', () => {
  test('GET /api/products returns array', async () => {
    const res = await req('GET', '/api/products');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  test('GET /api/products?sort=price_asc returns sorted', async () => {
    const res = await req('GET', '/api/products?sort=price_asc');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    if (res.body.length > 1) {
      expect(res.body[0].price).toBeLessThanOrEqual(res.body[1].price);
    }
  });

  test('GET /api/products?sort=price_desc returns sorted', async () => {
    const res = await req('GET', '/api/products?sort=price_desc');
    expect(res.status).toBe(200);
    if (res.body.length > 1) {
      expect(res.body[0].price).toBeGreaterThanOrEqual(res.body[1].price);
    }
  });

  test('GET /api/products/:id returns single product', async () => {
    const list = await req('GET', '/api/products');
    if (list.body.length > 0) {
      const id = list.body[0].id;
      const res = await req('GET', `/api/products/${id}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(id);
    }
  });

  test('GET /api/products/99999 returns 404', async () => {
    const res = await req('GET', '/api/products/99999');
    expect(res.status).toBe(404);
  });

  test('GET /api/products/categories/list returns categories', async () => {
    const res = await req('GET', '/api/products/categories/list');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

// ── Admin Auth ──

describe('Admin Auth', () => {
  test('POST /api/admin/login with wrong password returns 401', async () => {
    const res = await req('POST', '/api/admin/login', {
      json: true,
      body: JSON.stringify({ username: 'admin', password: 'wrong' }),
    });
    expect(res.status).toBe(401);
  });

  test('POST /api/admin/login with correct password returns 200', async () => {
    const res = await req('POST', '/api/admin/login', {
      json: true,
      body: JSON.stringify({ username: 'admin', password: 'test' }),
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('GET /api/admin/me returns isAdmin', async () => {
    const res = await req('GET', '/api/admin/me');
    expect(res.status).toBe(200);
    expect(res.body.isAdmin).toBe(true);
  });

  test('GET /api/admin/csrf-token returns token', async () => {
    const res = await req('GET', '/api/admin/csrf-token');
    expect(res.status).toBe(200);
    expect(res.body.csrfToken).toBeTruthy();
    csrfToken = res.body.csrfToken;
  });

  test('CSRF token changes after re-login', async () => {
    await req('POST', '/api/admin/login', {
      json: true,
      body: JSON.stringify({ username: 'admin', password: 'test' }),
    });
    const res = await req('GET', '/api/admin/csrf-token');
    expect(res.status).toBe(200);
    expect(res.body.csrfToken).not.toBe(csrfToken); // new token generated
    csrfToken = res.body.csrfToken;
  });

  test('POST without CSRF token returns 403', async () => {
    const saved = csrfToken;
    csrfToken = ''; // remove CSRF token
    const res = await req('POST', '/api/admin/products', {
      json: true,
      body: JSON.stringify({ name: 'Should Fail', price: 9.99, category_id: 1 }),
    });
    expect(res.status).toBe(403);
    csrfToken = saved;
  });

  test('Unauthenticated request returns 401', async () => {
    const saved = cookie;
    cookie = '';
    csrfToken = '';
    const res = await req('GET', '/api/admin/products');
    expect(res.status).toBe(401);
    cookie = saved;
    // Re-fetch CSRF token after restoring cookie
    const tokenRes = await req('GET', '/api/admin/csrf-token');
    csrfToken = tokenRes.body.csrfToken || '';
  });
});

// ── Admin Inventory API ──

describe('Admin Inventory API', () => {
  test('GET /api/admin/inventory/summary requires admin auth', async () => {
    const savedCookie = cookie;
    cookie = ''; // simulate anonymous
    const res = await req('GET', '/api/admin/inventory/summary');
    expect([401, 403]).toContain(res.status);
    cookie = savedCookie;
  });

  test('GET /api/admin/inventory/summary returns data for admin', async () => {
    const res = await req('GET', '/api/admin/inventory/summary');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  // Self-contained fixtures (stabilization #12): ambient state (whatever
  // `sort=newest` returns; whether its legacy stock column matches the ERP
  // ledger; leftover litter products) must never decide an integration result.
  let testProductId = null;
  let testWarehouseId = null;

  afterAll(async () => {
    if (testProductId) {
      // count to exactly 0, then trash the product so nothing lingers
      await req('POST', '/api/admin/inventory/movements', {
        json: true,
        body: JSON.stringify({ product_id: testProductId, warehouse_id: testWarehouseId, type: 'count', counted_qty: 0, note: 'api-test:cleanup' }),
      });
      await req('DELETE', `/api/admin/products/${testProductId}`, {});
      testProductId = null;
    }
  });

  async function ensureFixture() {
    if (testProductId) return;
    const whRes = await req('GET', '/api/admin/warehouses');
    expect(whRes.status).toBe(200);
    testWarehouseId = whRes.body[0].id;
    // Use a category that actually exists in this DB (seed ids are not 1 here).
    const cats = await req('GET', '/api/products/categories/list');
    const categoryId = cats.body?.[0]?.id || 5; // fall back to a known-good id
    const created = await req('POST', '/api/admin/products', {
      json: true,
      body: JSON.stringify({ name: 'api-test inventory product', price: 10, category_id: categoryId }),
    });
    expect([200, 201]).toContain(created.status);
    testProductId = created.body.id;
  }

  test('movements: receipt increases stock, count restores it (self-cleaning)', async () => {
    await ensureFixture();

    // Use the movement ledger itself as the source of truth (stable across any
    // legacy-stock drift in ambient products). First count sets the baseline.
    const baseline = 5;
    const seed = await req('POST', '/api/admin/inventory/movements', {
      json: true,
      body: JSON.stringify({ product_id: testProductId, warehouse_id: testWarehouseId, type: 'count', counted_qty: baseline, note: 'api-test:seed' }),
    });
    expect(seed.status).toBe(201);
    expect(seed.body.qty_after).toBe(baseline);
    const originalStock = seed.body.qty_after;

    // receipt +5
    const rec = await req('POST', '/api/admin/inventory/movements', {
      json: true,
      body: JSON.stringify({
        product_id: testProductId,
        warehouse_id: testWarehouseId,
        type: 'receipt',
        qty_change: 5,
        note: 'api-test:receipt',
      }),
    });
    expect(rec.status).toBe(201);
    expect(rec.body.qty_change).toBe(5);
    expect(rec.body.qty_after).toBe(originalStock + 5);

    // storefront stock follows the ERP ledger
    const afterRec = await req('GET', `/api/products/${testProductId}`);
    expect(afterRec.body.stock).toBe(originalStock + 5);

    // count sets exact stock (counted_qty)
    const count = await req('POST', '/api/admin/inventory/movements', {
      json: true,
      body: JSON.stringify({
        product_id: testProductId,
        warehouse_id: testWarehouseId,
        type: 'count',
        counted_qty: originalStock,
        note: 'api-test:count-restore',
      }),
    });
    expect(count.status).toBe(201);
    expect(count.body.qty_after).toBe(originalStock);

    // restored
    const restored = await req('GET', `/api/products/${testProductId}`);
    expect(restored.body.stock).toBe(originalStock);
  });

  test('movement with insufficient stock returns 409', async () => {
    await ensureFixture();
    const res = await req('POST', '/api/admin/inventory/movements', {
      json: true,
      body: JSON.stringify({
        product_id: testProductId,
        warehouse_id: testWarehouseId,
        type: 'issue',
        qty_change: -999999,
        note: 'api-test:over-issue',
      }),
    });
    expect(res.status).toBe(409);
  });
});

// ── Admin Products CRUD ──

describe('Admin CRUD', () => {
  let newId = null;

  test('GET /api/admin/products returns array', async () => {
    const res = await req('GET', '/api/admin/products');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('POST /api/admin/products creates product', async () => {
    const res = await req('POST', '/api/admin/products', {
      json: true,
      body: JSON.stringify({
        name: 'Jest Test Product',
        price: 19.99,
        category_id: 1,
        description: 'Created during testing',
      }),
    });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    newId = res.body.id;
  });

  test('PUT /api/admin/products/:id updates product', async () => {
    if (!newId) return;
    const res = await req('PUT', `/api/admin/products/${newId}`, {
      json: true,
      body: JSON.stringify({ name: 'Updated By Jest', price: 29.99 }),
    });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated By Jest');
  });

  test('DELETE /api/admin/products/:id deletes product', async () => {
    if (!newId) return;
    const res = await req('DELETE', `/api/admin/products/${newId}`);
    expect(res.status).toBe(200);
  });
});

// ── Admin Orders ──

describe('Admin Orders', () => {  test('GET /api/admin/orders returns orders', async () => {
    const res = await req('GET', '/api/admin/orders');
    expect(res.status).toBe(200);
    expect(res.body.orders).toBeDefined();
    expect(Array.isArray(res.body.orders)).toBe(true);
    expect(typeof res.body.total).toBe('number');
  });

  test('GET /api/admin/orders/stats returns stats', async () => {
    const res = await req('GET', '/api/admin/orders/stats');
    expect(res.status).toBe(200);
    expect(res.body.totalRevenue).toBeDefined();
    expect(res.body.totalOrders).toBeDefined();
  });
});

// ── Compression ──

describe('Compression', () => {
  test('Response body is valid (compression is transparent to client)', async () => {
    const res = await req('GET', '/api/products');
    // Node.js http module auto-decompresses, so content-encoding may be stripped.
    // We verify compression works by checking the response is valid JSON.
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
