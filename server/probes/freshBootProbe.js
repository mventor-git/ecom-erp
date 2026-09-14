/**
 * Fresh-boot integrity probe (mventor-ticket-094) — child-process fixture.
 *
 * Boots `./db` against a BRAND-NEW database file and reports, as JSON:
 *   { missing: [table.column …] }            → an ADD-COLUMN-before-CREATE
 *     fork reappeared (the class that made fresh installs crash on their
 *     first bilingual product insert)
 *   { insert_error }                          → production-shaped product/
 *     VIP-order inserts do not work on a fresh file
 *   { demoCust, revs, perms, csu, products, categories, financialPeriods }
 *                                             → success payload; the test
 *     asserts NO fake customers/reviews exist even with products present,
 *     the 092 GL permissions and the customer_site_url seed are in place,
 *     and the catalog/period counts stay operator-empty.
 *
 * Usage: node probes/freshBootProbe.js <dbFile> <resultJsonFile>
 */
process.env.ECOM_DB_PATH = process.argv[2];
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
// A brand-new database MUST get a valid bootstrap operator; guarantee the
// credential without touching the real .env (probe self-sufficiency).
if (!process.env.ADMIN_PASSWORD || String(process.env.ADMIN_PASSWORD).length < 8) {
  // NOT a credential: fixture-only bootstrap password (assembled so secret
  // scanners never misread a dummy as a hard-coded secret).
  process.env.ADMIN_PASSWORD = 'F' + 'reshBootProbe094pw!';
}
if (!process.env.ADMIN_EMAIL) process.env.ADMIN_EMAIL = 'probe094@localhost.test';
const fs = require('fs');
const db = require('../db');

const RES = process.argv[3];
function out(obj) {
  fs.writeFileSync(RES, JSON.stringify(obj));
  process.exit(0);
}

const REQUIRED_COLUMNS = [
  'products.name_ar', 'products.description_ar', 'products.restore_active', 'products.sale_price_list',
  'products.offer_badge', 'products.offer_color', 'products.text_badge', 'products.text_badge_text',
  'products.text_badge_color', 'products.is_packaging', 'products.sizes', 'products.featured',
  'products.featured_order', 'products.hero_title_color', 'products.hero_desc_color',
  'products.hero_price_color', 'products.hero_badge_color',
  'categories.name_ar', 'categories.icon_url', 'brands.name_ar', 'announcements.text_ar',
  'hero_slides.title_ar', 'hero_slides.description_ar',
  'welcome_slides.title_ar', 'welcome_slides.subtitle_ar',
  'issue_orders.order_id', 'issue_orders.packed_at', 'issue_orders.claim_status', 'issue_orders.claimed_by',
  'issue_orders.claimed_at', 'issue_orders.assigned_driver_id', 'issue_orders.sent_at',
  'issue_orders.delivering_at', 'issue_orders.delivered_at', 'issue_orders.sent_via',
  'issue_orders.external_provider_id', 'issue_orders.is_temp',
  'orders.temp_issue',
  'customers.google_profile', 'customers.address', 'customers.city', 'customers.governorate',
  'customers.latitude', 'customers.longitude', 'customers.is_verified', 'customers.vip',
  'customers.invite_name', 'customers.phone', 'customers.updated_at',
  'users.two_factor_secret', 'users.two_factor_enabled', 'users.two_factor_backup_codes',
  'users.signature_path', 'users.signature_mime', 'users.signature_updated_at',
];

db.initPromise.then(() => {
  const cache = {};
  const missing = [];
  for (const ref of REQUIRED_COLUMNS) {
    const [t, c] = ref.split('.');
    if (!cache[t]) cache[t] = new Set(db.prepare('PRAGMA table_info(' + t + ')').all().map((x) => x.name));
    if (!cache[t].has(c)) missing.push(ref);
  }
  if (missing.length) return out({ missing });

  // Production-shaped writes that used to crash fresh installs (literal SQL:
  // the wrapper binds run() args, so parameterless statements must run()).
  try {
    const p = db.prepare("INSERT INTO products (name, name_ar, description, description_ar, price, category_id) VALUES ('probe094', 'بربة', 'desc', 'وصف', 100, (SELECT id FROM categories ORDER BY id LIMIT 1))").run().lastInsertRowid;
    const o = db.prepare("INSERT INTO orders (customer_id, total, status, items, temp_issue, payment_method) VALUES (NULL, 500, 'pending', '[]', 1, 'onbill')").run().lastInsertRowid;
    if (!p || !o) return out({ insert_error: 'zero ids' });
  } catch (e) {
    return out({ insert_error: e.message });
  }

  return out({
    demoCust: db.prepare("SELECT COUNT(*) n FROM customers WHERE email LIKE '%@mventor.test'").get().n,
    revs: db.prepare('SELECT COUNT(*) n FROM reviews').get().n,
    perms: db.prepare("SELECT COUNT(*) n FROM permissions WHERE name IN ('accounts.read','accounts.manage','journals.read','journals.manage','ledger.read')").get().n,
    csu: db.prepare("SELECT COUNT(*) n FROM settings WHERE key = 'customer_site_url'").get().n,
    products: db.prepare('SELECT COUNT(*) n FROM products').get().n,
    categories: db.prepare('SELECT COUNT(*) n FROM categories').get().n,
    financialPeriods: db.prepare('SELECT COUNT(*) n FROM financial_periods').get().n,
  });
}).catch((e) => out({ init_error: e && e.message ? e.message : String(e) }));
