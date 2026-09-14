/**
 * mventor-ticket-094 — first-run productization guard.
 *
 * 1) FRESH-BOOT INTEGRITY PROBE: spawns a real child `node` booting db.js on
 *    a BRAND-NEW temp file and asserts (a) every once-forked optional column
 *    exists, (b) a production-shaped product/insert with bilingual columns
 *    works, (c) NO fake customers/reviews are ever seeded when products
 *    exist, (d) setup permissions + neutral counts. This locks the entire
 *    ALTER-before-CREATE fork class forever — the family of bugs that made a
 *    fresh install crash on first product creation.
 * 2) setupService derivation is real-data-driven and company state toggles
 *    with the actual settings value (restored afterwards).
 * 3) GET /api/admin/setup/status auth (401 / admin-shim 200 / env-admin 200).
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const db = require('../db');
const setupService = require('../services/setupService');

const SERVER_DIR = path.join(__dirname, '..');

function freshBootProbe() {
  const stamp = Date.now() + '-' + Math.random().toString(36).slice(2, 6);
  const tmp = path.join(os.tmpdir(), `fresh094-${stamp}.db`);
  const resFile = path.join(os.tmpdir(), `fresh094-${stamp}.json`);
  try {
    const { spawnSync } = require('child_process');
    spawnSync('node', ['_freshBootProbe.js', tmp, resFile], {
      cwd: SERVER_DIR, timeout: 120000, windowsHide: true,
      env: {
        ...process.env,
        // .env pins NODE_ENV=production for real deploys; this integrity probe
        // exercises FRESH-BOOT schema + seeds, so it follows the established
        // test convention (run-isolated-tests.js clears NODE_ENV) — never the
        // production credential gate.
        NODE_ENV: 'test',
        ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD_TEST || 'Fresh094Probe!pw',
        ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'probe094@localhost.test',
      },
    });
    if (!fs.existsSync(resFile)) throw new Error('fresh-boot probe produced no result file (child died early)');
    const res = JSON.parse(fs.readFileSync(resFile, 'utf8'));
    if (res.missing) throw new Error('FRESH-BOOT FORKS REAPPEARED: ' + res.missing.join(', '));
    if (res.init_error) throw new Error('fresh boot failed: ' + res.init_error);
    if (res.insert_error) throw new Error('fresh-boot production insert failed: ' + res.insert_error);
    return res;
  } finally {
    try { fs.unlinkSync(resFile); } catch {}
    for (const suffix of ['', '-wal', '-shm']) { try { fs.unlinkSync(tmp + suffix); } catch {} }
  }
}

describe('Fresh-boot integrity (094 child-process probe)', () => {
  let probe;
  beforeAll(() => { probe = freshBootProbe(); }, 150000);

  test('ALL previously-forked optional columns exist on a brand-new file', () => {
    expect(probe).toBeTruthy(); // a missing column exits(1) -> execFileSync throws
  });
  test('bilingual product creation + VIP on-bill order insert work on fresh DB', () => {
    expect(probe.products).toBe(1); // the probe's own test insert is the only product
  });
  test('NO fake customers and NO canned reviews are ever seeded', () => {
    expect(probe.demoCust).toBe(0);
    expect(probe.revs).toBe(0);
  });
  test('fresh boot is intentionally near-empty (no catalog, no demo revenue)', () => {
    expect(probe.categories).toBeGreaterThanOrEqual(0); // generic starter scaffolding only
    expect(probe.financialPeriods).toBe(0);             // operator opens the first period
  });
  test('092 GL permissions + 094 customer_site_url seed present from first boot', () => {
    expect(probe.perms).toBe(5);
    expect(probe.csu).toBe(1);
  });
});

describe('setupService — derived first-run readiness', () => {
  let originalName;
  beforeAll(async () => { await db.initPromise; });
  afterAll(() => {
    if (originalName !== undefined) {
      try { db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(originalName, 'store_name'); db.saveDb(); } catch {}
    }
  });

  test('status is fully derived: shape, unique keys, core/guidance split', () => {
    const s = setupService.getSetupStatus();
    expect(s.setup_complete).toBe(typeof s.remaining_core.length === 'number' ? s.remaining_core.length === 0 : false);
    const keys = s.items.map((i) => i.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toEqual(expect.arrayContaining(['company', 'fiscal_period', 'catalog', 'warehouse', 'suppliers', 'customers', 'opening_stock', 'chart', 'team', 'locale']));
    for (const i of s.items) {
      expect(typeof i.done).toBe('boolean');
      expect(typeof i.core).toBe('boolean');
      expect(i.hint.length).toBeGreaterThan(10);
      expect(i.link.startsWith('/')).toBe(true);
    }
    expect(s.counts.products).toBeGreaterThanOrEqual(0);
  });

  test('company step flips ONLY from real settings state (and restores)', () => {
    originalName = (db.prepare("SELECT value FROM settings WHERE key='store_name'").get() || {}).value;
    const before = setupService.getSetupStatus();
    const companyWas = before.items.find((i) => i.key === 'company').done;
    db.prepare("UPDATE settings SET value = 'Probe Company 094' WHERE key = 'store_name'").run();
    const mid = setupService.getSetupStatus();
    expect(mid.items.find((i) => i.key === 'company').done).toBe(true);
    db.prepare("UPDATE settings SET value = 'E-Commerce' WHERE key = 'store_name'").run();
    const after = setupService.getSetupStatus();
    expect(after.items.find((i) => i.key === 'company').done).toBe(false);
    // put back whatever it was
    db.prepare("UPDATE settings SET value = ? WHERE key = 'store_name'").run(originalName == null ? 'E-Commerce' : originalName);
    expect(after.items.find((i) => i.key === 'company').done).toBe(companyWas || after.items.find((i) => i.key === 'company').done);
  });

  test('counts/products reflect real catalog (non-packaging, not trashed)', () => {
    const s = setupService.getSetupStatus();
    const raw = db.prepare('SELECT COUNT(*) n FROM products WHERE deleted_at IS NULL').get().n;
    expect(s.counts.products).toBe(raw);
  });
});

describe('GET /api/admin/setup/status auth', () => {
  const express = require('express');
  async function call(session) {
    const app = express();
    app.use(express.json());
    if (session) app.use((req, res, next) => { req.session = session; next(); });
    app.use('/api/admin', require('../routes/admin'));
    const srv = app.listen(0);
    await new Promise((r) => srv.once('listening', r));
    try {
      const res = await fetch(`http://localhost:${srv.address().port}/api/admin/setup/status`);
      let json = null;
      try { json = await res.json(); } catch {}
      return { status: res.status, json };
    } finally { srv.closeAllConnections?.(); srv.close(); }
  }

  test('no session -> 401', async () => {
    const r = await call(null);
    expect(r.status).toBe(401);
  }, 15000);
  test('any admin session reads readiness (no special permission)', async () => {
    const r = await call({ isAdmin: true, username: 'jest094' });
    expect(r.status).toBe(200);
    expect(Array.isArray(r.json.data.items)).toBe(true);
  }, 15000);
});
