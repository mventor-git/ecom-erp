const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

// DB location. ECOM_DB_PATH lets CI / isolated test runs work on a COPY of
// the data file instead of mutating the live store.db (stabilization #12).
// Default behavior is unchanged: server/data/store.db.
const DB_PATH = process.env.ECOM_DB_PATH
  ? path.resolve(process.env.ECOM_DB_PATH)
  : path.join(__dirname, 'data', 'store.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let db = null;

// Initialize database
async function initDb() {
  const SQL = await initSqlJs();

  // Load existing database or create new one
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA foreign_keys = ON');

  // Migrations: add columns that might not exist yet (no UNIQUE — ALTER TABLE doesn't support it)
  try { db.run("ALTER TABLE customers ADD COLUMN google_id TEXT DEFAULT ''"); } catch {}
  try { db.run("ALTER TABLE customers ADD COLUMN avatar_url TEXT DEFAULT ''"); } catch {}
  try { db.run("ALTER TABLE customers ADD COLUMN phone TEXT DEFAULT ''"); } catch {}
  try { db.run("ALTER TABLE customers ADD COLUMN google_profile TEXT DEFAULT '{}'"); } catch {}
  try { db.run("ALTER TABLE customers ADD COLUMN address TEXT DEFAULT ''"); } catch {}
  try { db.run("ALTER TABLE customers ADD COLUMN city TEXT DEFAULT ''"); } catch {}
  try { db.run("ALTER TABLE customers ADD COLUMN governorate TEXT DEFAULT ''"); } catch {}
  try { db.run("ALTER TABLE customers ADD COLUMN latitude REAL DEFAULT 0"); } catch {}
  try { db.run("ALTER TABLE customers ADD COLUMN longitude REAL DEFAULT 0"); } catch {}
  try { db.run("ALTER TABLE customers ADD COLUMN is_verified INTEGER DEFAULT 0"); } catch {}
  try { db.run("ALTER TABLE categories ADD COLUMN icon TEXT DEFAULT ''"); } catch {}
  // colors column is now in CREATE TABLE above — this is for legacy databases
  try { db.run("ALTER TABLE products ADD COLUMN colors TEXT DEFAULT '[]'"); } catch {}
  // sizes column — JSON array of {name} objects for product size variants
  try { db.run("ALTER TABLE products ADD COLUMN sizes TEXT DEFAULT '[]'"); } catch {}
  // featured flag + sort order for admin-curated featured products
  try { db.run("ALTER TABLE products ADD COLUMN featured INTEGER DEFAULT 0"); } catch {}
  try { db.run("ALTER TABLE products ADD COLUMN featured_order INTEGER DEFAULT 0"); } catch {}
  // hero text colors for featured products in hero slider (separate for each element)
  try { db.run("ALTER TABLE products ADD COLUMN hero_title_color TEXT DEFAULT '#ffffff'"); } catch {}
  try { db.run("ALTER TABLE products ADD COLUMN hero_desc_color TEXT DEFAULT '#ffffff'"); } catch {}
  try { db.run("ALTER TABLE products ADD COLUMN hero_price_color TEXT DEFAULT '#ffffff'"); } catch {}
  try { db.run("ALTER TABLE products ADD COLUMN hero_badge_color TEXT DEFAULT '#ffffff'"); } catch {}
  // Product trash system (mventor-ticket-044): soft delete with restore.
  // deleted_at set = product is in trash; restore_active snapshots the pre-trash active state.
  try { db.run("ALTER TABLE products ADD COLUMN deleted_at DATETIME DEFAULT NULL"); } catch {}
  try { db.run("ALTER TABLE products ADD COLUMN restore_active INTEGER DEFAULT NULL"); } catch {}
  // Storefront selling mode (mventor-ticket-054): per-product price list
  // override + TWO diagonal ribbons � LEFT: offer (% off, auto), RIGHT:
  // custom text. Admin controls visibility + colors.
  try { db.run("ALTER TABLE products ADD COLUMN sale_price_list TEXT DEFAULT ''"); } catch {}
  try { db.run("ALTER TABLE products ADD COLUMN offer_badge INTEGER DEFAULT 0"); } catch {}
  try { db.run("ALTER TABLE products ADD COLUMN offer_color TEXT DEFAULT '#ef4444'"); } catch {}
  try { db.run("ALTER TABLE products ADD COLUMN text_badge INTEGER DEFAULT 0"); } catch {}
  try { db.run("ALTER TABLE products ADD COLUMN text_badge_text TEXT DEFAULT ''"); } catch {}
  try { db.run("ALTER TABLE products ADD COLUMN text_badge_color TEXT DEFAULT '#1f857a'"); } catch {}
  // Bilingual content (Arabic variants) — admin-configurable elements carry an
  // `_ar` twin column; public APIs return both and the frontend picks by locale.
  try { db.run("ALTER TABLE products ADD COLUMN name_ar TEXT DEFAULT ''"); } catch {}
  try { db.run("ALTER TABLE products ADD COLUMN description_ar TEXT DEFAULT ''"); } catch {}
  try { db.run("ALTER TABLE categories ADD COLUMN name_ar TEXT DEFAULT ''"); } catch {}
  try { db.run("ALTER TABLE brands ADD COLUMN name_ar TEXT DEFAULT ''"); } catch {}
  try { db.run("ALTER TABLE announcements ADD COLUMN text_ar TEXT DEFAULT ''"); } catch {}
  try { db.run("ALTER TABLE hero_slides ADD COLUMN title_ar TEXT DEFAULT ''"); } catch {}
  try { db.run("ALTER TABLE hero_slides ADD COLUMN description_ar TEXT DEFAULT ''"); } catch {}
  try { db.run("ALTER TABLE welcome_slides ADD COLUMN title_ar TEXT DEFAULT ''"); } catch {}
  try { db.run("ALTER TABLE welcome_slides ADD COLUMN subtitle_ar TEXT DEFAULT ''"); } catch {}
  // Packaging materials (mventor-ticket-055): internal consumables � tracked in
  // the warehouse (opening balance / supply / transfer / damage) and expensed
  // in the P&L, but NEVER exposed to the customer site.
  try { db.run("ALTER TABLE categories ADD COLUMN icon_url TEXT DEFAULT ''"); } catch {}
  try { db.run("ALTER TABLE products ADD COLUMN is_packaging INTEGER DEFAULT 0"); } catch {}
  // Fulfillment pipeline on issue orders (mventor-ticket-057):
  // issued ? packed ? (claimed by driver | driver assigned) ? sent ? delivering ? delivered
  try { db.run("ALTER TABLE issue_orders ADD COLUMN order_id INTEGER REFERENCES orders(id)"); } catch {}
  try { db.run("ALTER TABLE issue_orders ADD COLUMN packed_at DATETIME"); } catch {}
  try { db.run("ALTER TABLE issue_orders ADD COLUMN claim_status TEXT DEFAULT 'none'"); } catch {}
  try { db.run("ALTER TABLE issue_orders ADD COLUMN claimed_by INTEGER REFERENCES users(id)"); } catch {}
  try { db.run("ALTER TABLE issue_orders ADD COLUMN claimed_at DATETIME"); } catch {}
  try { db.run("ALTER TABLE issue_orders ADD COLUMN assigned_driver_id INTEGER REFERENCES users(id)"); } catch {}
  try { db.run("ALTER TABLE issue_orders ADD COLUMN sent_at DATETIME"); } catch {}
  try { db.run("ALTER TABLE issue_orders ADD COLUMN delivering_at DATETIME"); } catch {}
  try { db.run("ALTER TABLE issue_orders ADD COLUMN delivered_at DATETIME"); } catch {}
  // Handoff mode: 'driver' (internal, maps module) | 'external' (delivery
  // company from shipment_providers � maps hidden, provider shown instead)
  try { db.run("ALTER TABLE issue_orders ADD COLUMN sent_via TEXT DEFAULT 'driver'"); } catch {}
  try { db.run("ALTER TABLE issue_orders ADD COLUMN external_provider_id INTEGER REFERENCES shipment_providers(id)"); } catch {}
  // ── VIP program (mventor-ticket-060) ──
  // Invitations: admin prints a QR card; scanning leads to Google sign-in
  // which claims the invite and flags the customer as VIP.
  try { db.run("CREATE TABLE IF NOT EXISTS vip_invites (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL UNIQUE, invite_name TEXT NOT NULL, created_by TEXT DEFAULT '', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, used_by INTEGER REFERENCES customers(id), used_at DATETIME)"); } catch {}
  try { db.run("ALTER TABLE customers ADD COLUMN vip INTEGER DEFAULT 0"); } catch {}
  try { db.run("ALTER TABLE customers ADD COLUMN invite_name TEXT DEFAULT ''"); } catch {}
  // Staff-managed VIP cart: items added FOR the customer by admins/sales.
  try { db.run("CREATE TABLE IF NOT EXISTS vip_cart (id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER NOT NULL REFERENCES customers(id), product_id INTEGER NOT NULL REFERENCES products(id), qty INTEGER NOT NULL DEFAULT 1, added_by TEXT DEFAULT '', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(customer_id, product_id))"); } catch {}
  // Temp issue: VIP orders reserve nothing until an admin approves; approval
  // converts it into a real stocked issue.
  try { db.run("ALTER TABLE orders ADD COLUMN temp_issue INTEGER DEFAULT 0"); } catch {}
  try { db.run("ALTER TABLE issue_orders ADD COLUMN is_temp INTEGER DEFAULT 0"); } catch {}
  // ── Two-Factor Authentication (mventor 2026-08-24) ──
  // TOTP-based 2FA for admin/staff accounts using authenticator apps
  try { db.run("ALTER TABLE users ADD COLUMN two_factor_secret TEXT DEFAULT NULL"); } catch {}
  try { db.run("ALTER TABLE users ADD COLUMN two_factor_enabled INTEGER DEFAULT 0"); } catch {}
  try { db.run("ALTER TABLE users ADD COLUMN two_factor_backup_codes TEXT DEFAULT NULL"); } catch {}
  // Personal employee signatures (REQUIREMENT: every employee has their OWN
  // signature — users ARE the staff identity; no second employee table). The
  // image itself is stored on the filesystem (public/images/signatures) via the
  // existing multer upload abstraction; the DB keeps a relational reference.
  try { db.run("ALTER TABLE users ADD COLUMN signature_path TEXT DEFAULT ''"); } catch {}
  try { db.run("ALTER TABLE users ADD COLUMN signature_mime TEXT DEFAULT ''"); } catch {}
  try { db.run("ALTER TABLE users ADD COLUMN signature_updated_at DATETIME"); } catch {}

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      icon TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  // F11-class fix (N validation): the early ALTER at the top of initDb ran
  // BEFORE this table existed and its catch swallowed the error — fresh DBs
  // had NO categories.icon and the icon seed below crashed them. Re-run the
  // add here (idempotent probe) so every boot state ends up with the column.
  let catIconMissing = false;
  try { db.prepare("SELECT icon FROM categories LIMIT 1").get(); } catch { catIconMissing = true; }
  if (catIconMissing) db.run("ALTER TABLE categories ADD COLUMN icon TEXT DEFAULT ''");
  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      price INTEGER NOT NULL,
      category_id INTEGER REFERENCES categories(id),
      image_url TEXT DEFAULT '',
      colors TEXT DEFAULT '[]',
      stock INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      has_variants INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      name TEXT DEFAULT '',
      google_id TEXT UNIQUE DEFAULT '',
      avatar_url TEXT DEFAULT '',
      stripe_customer_id TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER REFERENCES customers(id),
      stripe_session_id TEXT UNIQUE,
      total INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      items TEXT DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  // mventor-ticket-041: Wishlist (per customer account)
  db.run(`
    CREATE TABLE IF NOT EXISTS wishlist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL REFERENCES customers(id),
      product_id INTEGER NOT NULL REFERENCES products(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(customer_id, product_id)
    )
  `);
  // mventor-ticket-041: Product reviews (stars + comments, one per customer per product)
  // rating is REAL to support half stars (e.g. 4.5)
  const reviewCols = db.exec('PRAGMA table_info(reviews)');
  if (reviewCols && reviewCols[0] && reviewCols[0].values) {
    const ratingCol = reviewCols[0].values.find(v => v[1] === 'rating');
    if (ratingCol && String(ratingCol[2]).toUpperCase() !== 'REAL') {
      db.run('DROP TABLE IF EXISTS reviews'); // legacy INTEGER schema — recreate below with REAL
    }
  }
  db.run(`
    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id),
      customer_id INTEGER NOT NULL REFERENCES customers(id),
      rating REAL NOT NULL DEFAULT 5,
      comment TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(product_id, customer_id)
    )
  `);
  // mventor-ticket-043: Financial periods (opening balance per period)
  db.run(`
    CREATE TABLE IF NOT EXISTS financial_periods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      months INTEGER NOT NULL DEFAULT 12,
      status TEXT NOT NULL DEFAULT 'OPEN',
      opening_balance_set INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      closed_at DATETIME
    )
  `);
  // mventor-ticket-043: Supply orders (اذن توريد) — multi-product, distinct from receipts
  db.run(`
    CREATE TABLE IF NOT EXISTS supply_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT NOT NULL UNIQUE,
      supplier_name TEXT DEFAULT '',
      supplier_id INTEGER REFERENCES suppliers(id),
      warehouse_id INTEGER DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'draft',
      issued_at DATETIME,
      issued_by TEXT DEFAULT '',
      note TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  // mventor-supplier-fk: relational link so supply receipts are queryable by
  // supplier_id in the supplier-history view. Nullable + additive (no backfill;
  // supplier_name stays as the denormalized display value / free-text fallback).
  try { db.run("ALTER TABLE supply_orders ADD COLUMN supplier_id INTEGER REFERENCES suppliers(id)"); } catch {}
  db.run(`
    CREATE TABLE IF NOT EXISTS supply_order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supply_order_id INTEGER NOT NULL REFERENCES supply_orders(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      qty INTEGER NOT NULL DEFAULT 0,
      unit_cost INTEGER DEFAULT 0
    )
  `);
  // mventor-ticket-043: Issue orders (اذن صرف) — multi-product stock out
  db.run(`
    CREATE TABLE IF NOT EXISTS issue_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT NOT NULL UNIQUE,
      customer_name TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft',
      issued_at DATETIME,
      issued_by TEXT DEFAULT '',
      note TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS issue_order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      issue_order_id INTEGER NOT NULL REFERENCES issue_orders(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      qty INTEGER NOT NULL DEFAULT 0,
      unit_cost INTEGER DEFAULT 0
    )
  `);
  // mventor-ticket-046: Price lists (retail / wholesale / semi-wholesale / offer)
  db.run(`
    CREATE TABLE IF NOT EXISTS price_lists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      code TEXT NOT NULL UNIQUE,
      discount_percent REAL,            -- null = base price unless overridden per product
      is_default INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS product_prices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id),
      price_list_id INTEGER NOT NULL REFERENCES price_lists(id),
      price INTEGER NOT NULL,           -- cents, per-product override for this list
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(product_id, price_list_id)
    )
  `);
  // mventor-ticket-075: Chart of Accounts (neutral skeleton — no business seeds)
  // Survives system reset (not in WIPE_TABLES — like settings/price_lists).
  // Journals arrive in later tickets; delete-if-referenced activates then.
  db.run(`
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,          -- admin-assigned, verbatim (e.g. 1000)
      name TEXT NOT NULL,
      type TEXT NOT NULL,                 -- asset | liability | equity | revenue | expense | other
      description TEXT DEFAULT '',
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  // mventor-ticket-077: Journals (double-entry foundation — no postings yet)
  // Financial history: NOT in WIPE_TABLES (survives reset like events audit).
  // Money INTEGER cents (ADR-014). Status transitions arrive in Ticket D.
  db.run(`
    CREATE TABLE IF NOT EXISTS journal_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_no TEXT NOT NULL UNIQUE,          -- JE-YYYY-NNNN via document_sequences
      entry_date TEXT NOT NULL,               -- YYYY-MM-DD
      description TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft',   -- draft | posted (posting in D)
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS journal_lines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_id INTEGER NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
      account_id INTEGER NOT NULL REFERENCES accounts(id),
      debit INTEGER NOT NULL DEFAULT 0,       -- cents, never negative
      credit INTEGER NOT NULL DEFAULT 0,      -- cents, never negative; never both > 0
      description TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  // mventor-ticket-079: posting audit columns (idempotent probe — the catch
  // performs the migration, so only a failed ALTER can throw, never silence)
  for (const col of ['posted_by TEXT', 'posted_at DATETIME']) {
    const name = col.split(' ')[0];
    let missing = false;
    try {
      db.prepare(`SELECT ${name} FROM journal_entries LIMIT 1`).get();
    } catch {
      missing = true;
    }
    if (missing) db.run(`ALTER TABLE journal_entries ADD COLUMN ${col}`);
  }
  // mventor-ticket-086: posting source columns (nullable = non-sourced rows
  // never collide; UNIQUE enforces one posting per operational event).
  // Same idempotent-probe idiom as 079 (catch performs, never silences).
  for (const col of ['source_type TEXT', 'source_id INTEGER', 'source_event TEXT']) {
    const name = col.split(' ')[0];
    let missing = false;
    try {
      db.prepare(`SELECT ${name} FROM journal_entries LIMIT 1`).get();
    } catch {
      missing = true;
    }
    if (missing) db.run(`ALTER TABLE journal_entries ADD COLUMN ${col}`);
  }
  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS ux_journal_source
    ON journal_entries(source_type, source_id, source_event)`);
  db.run(`
    CREATE TABLE IF NOT EXISTS paymob_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      paymob_token TEXT NOT NULL,
      link_url TEXT NOT NULL,
      reference_id TEXT DEFAULT '',
      order_id INTEGER,
      amount_cents INTEGER NOT NULL DEFAULT 0,
      currency TEXT DEFAULT 'EGP',
      description TEXT DEFAULT '',
      client_name TEXT DEFAULT '',
      email TEXT DEFAULT '',
      phone_number TEXT DEFAULT '',
      status TEXT DEFAULT 'created',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  // mventor-ticket-048: Picking + Packing workflow (post-confirmation)
  db.run(`
    CREATE TABLE IF NOT EXISTS picking_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id),
      assignee_id INTEGER REFERENCES users(id),
      status TEXT NOT NULL DEFAULT 'pending',   -- pending | in_progress | picked
      items TEXT DEFAULT '[]',
      notes TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      started_at DATETIME,
      picked_at DATETIME,
      picked_by TEXT DEFAULT ''
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS packing_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id),
      assignee_id INTEGER REFERENCES users(id),
      status TEXT NOT NULL DEFAULT 'pending',   -- pending | in_progress | packed | problem | completed
      notes TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      started_at DATETIME,
      packed_at DATETIME,
      packed_by TEXT DEFAULT '',
      completed_at DATETIME
    )
  `);
  // mventor-ticket-049: Shipping — delivery methods (employee / contractor / company) + shipments
  db.run(`
    CREATE TABLE IF NOT EXISTS shipment_providers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'company',     -- employee | contractor | company
      contact_phone TEXT DEFAULT '',
      website TEXT DEFAULT '',
      tracking_url_template TEXT DEFAULT '',    -- e.g. https://www.fedex.com/fedextrack/?trknbr={TRACKING}
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS shipments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id),
      provider_id INTEGER REFERENCES shipment_providers(id),
      tracking_number TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',   -- pending | in_transit | out_for_delivery | delivered | failed | returned
      estimated_delivery DATETIME,
      shipped_at DATETIME,
      delivered_at DATETIME,
      notes TEXT DEFAULT '',
      created_by TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  // mventor-ticket-050: Multiple roles per user
  db.run(`
    CREATE TABLE IF NOT EXISTS user_roles (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, role_id)
    )
  `);
  // mventor-ticket-053: Customer phone verification (OTP onboarding)
  db.run(`
    CREATE TABLE IF NOT EXISTS customer_verifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL REFERENCES customers(id),
      phone TEXT NOT NULL,
      code TEXT NOT NULL,
      method TEXT NOT NULL DEFAULT 'email',   -- email | sms
      status TEXT NOT NULL DEFAULT 'pending', -- pending | verified | expired
      attempts INTEGER DEFAULT 0,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      verified_at DATETIME
    )
  `);
  // mventor-ticket-050: backfill user_roles from the legacy single role_id (works on existing DBs).
  // Stabilization check: the users table doesn't exist yet on a FRESH database
  // at this point — the backfill is a no-op anyway (no legacy rows), so wrap
  // this to unblock the first-ever fresh-start boot (no existing users/rows).
  try { db.run(`
    INSERT OR IGNORE INTO user_roles (user_id, role_id)
    SELECT id, role_id FROM users WHERE role_id IS NOT NULL
  `); } catch { /* fresh database — nothing to backfill yet */ }

  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      sid TEXT PRIMARY KEY,
      sess TEXT NOT NULL,
      expired DATETIME NOT NULL
    )
  `);
  // mventor-ticket-037: Mobile app tables
  db.run(`
    CREATE TABLE IF NOT EXISTS cart_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL REFERENCES products(id),
      quantity INTEGER NOT NULL DEFAULT 1,
      variant_color TEXT,
      variant_size TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id),
      product_id INTEGER NOT NULL REFERENCES products(id),
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      price INTEGER NOT NULL,
      variant_color TEXT,
      variant_size TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  // Stabilization #11 — ONE canonical schema. The single-row builder
  // (services/orderLines + adminSale + mobile checkout) and the backfill read
  // the normalized mirror family (qty/base_price/final_price/cost_snapshot/
  // price_list_code…); migrations/004+005 defined it but nothing executes SQL
  // files, so fresh DBs crashed on first checkout. Mirror the full 005 shape
  // through the house idempotent probe idiom (catch performs migration; only
  // a failed ALTER can throw, never silence).
  for (const col of [
    'variant_id INTEGER REFERENCES product_variants(id)',
    "sku TEXT DEFAULT ''",
    'qty INTEGER DEFAULT 0',
    'base_price INTEGER DEFAULT 0',
    "discount_type TEXT DEFAULT 'none'",
    'discount_value INTEGER DEFAULT 0',
    'discount_amount INTEGER DEFAULT 0',
    'final_price INTEGER DEFAULT 0',
    "price_list_code TEXT DEFAULT 'retail'",
    'tax_rate REAL DEFAULT 0',
    'tax_amount INTEGER DEFAULT 0',
    'cost_snapshot INTEGER DEFAULT 0',
  ]) {
    const name = col.split(' ')[0];
    let missing = false;
    try { db.prepare(`SELECT ${name} FROM order_items LIMIT 1`).get(); } catch { missing = true; }
    if (missing) db.run(`ALTER TABLE order_items ADD COLUMN ${col}`);
  }
  db.run('CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id)');

  db.run(`
    CREATE TABLE IF NOT EXISTS user_addresses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      address TEXT NOT NULL,
      city TEXT NOT NULL,
      governorate TEXT,
      postal_code TEXT,
      is_default INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS product_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      image_url TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      variant_attributes TEXT DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS brands (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      icon_url TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Migration: add has_variants column to products if not present
  try { db.run("ALTER TABLE products ADD COLUMN has_variants INTEGER DEFAULT 1"); } catch {}

  // Migration: add variant_attributes column to product_images if not present
  try { db.run("ALTER TABLE product_images ADD COLUMN variant_attributes TEXT DEFAULT '{}'"); } catch {}

  // Migration: add brand_id to products if not present
  try { db.run("ALTER TABLE products ADD COLUMN brand_id INTEGER DEFAULT NULL REFERENCES brands(id)"); } catch {}
  try { db.run("ALTER TABLE products ADD COLUMN is_new INTEGER DEFAULT 0"); } catch {}
  try { db.run("ALTER TABLE products ADD COLUMN old_price INTEGER DEFAULT 0"); } catch {}
  try { db.run("ALTER TABLE supply_orders ADD COLUMN warehouse_id INTEGER DEFAULT 1"); } catch {}
  // SQLite: ALTER ADD COLUMN cannot use non-constant defaults (CURRENT_TIMESTAMP) — nullable column for existing DBs
  try { db.run("ALTER TABLE price_lists ADD COLUMN updated_at DATETIME"); } catch {}

  // Migration: add featured columns to products if not present
  try { db.run("ALTER TABLE products ADD COLUMN featured INTEGER DEFAULT 0"); } catch {}
  try { db.run("ALTER TABLE products ADD COLUMN featured_order INTEGER DEFAULT 0"); } catch {}

  // Migration: add hero_image columns to products if not present
  try { db.run("ALTER TABLE products ADD COLUMN hero_image INTEGER DEFAULT 0"); } catch {}
  try { db.run("ALTER TABLE products ADD COLUMN hero_order INTEGER DEFAULT 0"); } catch {}

  // Migration: add password_hash and phone to customers for mobile auth
  try { db.run("ALTER TABLE customers ADD COLUMN password_hash TEXT DEFAULT ''"); } catch {}
  try { db.run("ALTER TABLE customers ADD COLUMN phone TEXT DEFAULT ''"); } catch {}

  // mventor-ticket-037: Add missing columns to orders table for mobile orders
  try { db.run("ALTER TABLE orders ADD COLUMN user_id INTEGER"); } catch {}
  try { db.run("ALTER TABLE orders ADD COLUMN order_number TEXT"); } catch {}
  try { db.run("ALTER TABLE orders ADD COLUMN shipping_name TEXT"); } catch {}
  try { db.run("ALTER TABLE orders ADD COLUMN shipping_phone TEXT"); } catch {}
  try { db.run("ALTER TABLE orders ADD COLUMN shipping_address TEXT"); } catch {}
  try { db.run("ALTER TABLE orders ADD COLUMN shipping_city TEXT"); } catch {}
  try { db.run("ALTER TABLE orders ADD COLUMN shipping_governorate TEXT"); } catch {}
  try { db.run("ALTER TABLE orders ADD COLUMN shipping_postal_code TEXT"); } catch {}
  try { db.run("ALTER TABLE orders ADD COLUMN payment_method TEXT DEFAULT 'cod'"); } catch {}
  try { db.run("ALTER TABLE orders ADD COLUMN payment_status TEXT DEFAULT 'pending'"); } catch {}
  try { db.run("ALTER TABLE orders ADD COLUMN notes TEXT"); } catch {}
  try { db.run("ALTER TABLE orders ADD COLUMN delivered_at DATETIME"); } catch {}
  try { db.run("ALTER TABLE orders ADD COLUMN subtotal INTEGER DEFAULT 0"); } catch {}
  try { db.run("ALTER TABLE orders ADD COLUMN shipping INTEGER DEFAULT 0"); } catch {}
  try { db.run("ALTER TABLE orders ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP"); } catch {}
  try { db.run("ALTER TABLE orders ADD COLUMN admin_review_at DATETIME"); } catch {}
  try { db.run("ALTER TABLE orders ADD COLUMN confirmed_at DATETIME"); } catch {}
  try { db.run("ALTER TABLE orders ADD COLUMN status_reason TEXT DEFAULT ''"); } catch {}
  try { db.run("ALTER TABLE orders ADD COLUMN price_list_code TEXT DEFAULT 'retail'"); } catch {}
  try { db.run("ALTER TABLE orders ADD COLUMN refund_amount INTEGER DEFAULT 0"); } catch {}
  try { db.run("ALTER TABLE orders ADD COLUMN refunded_at DATETIME"); } catch {}
  try { db.run("ALTER TABLE orders ADD COLUMN idempotency_key TEXT"); } catch {}
  // N2 remediation: orders carry the canonical request fingerprint (owner-
  // scoped idempotency identity) + the DB-level invariant: a key can never
  // collide within the SAME customer (concurrent duplicate protection).
  // Cross-customer same-key stays independent by design (guest checkout has
  // no global identity to share).
  try { db.run("ALTER TABLE orders ADD COLUMN idem_fp TEXT"); } catch {}
  try {
    db.run(`CREATE UNIQUE INDEX IF NOT EXISTS ux_orders_idem_owner
      ON orders(customer_id, idempotency_key) WHERE idempotency_key IS NOT NULL`);
  } catch (err) {
    // Legacy duplicate (customer_id + key) rows would block the index — that
    // is a data problem to surface, never to swallow quietly.
    console.error(`[db] ux_orders_idem_owner NOT created (${err.message}) — duplicate owner+key order rows exist and must be reconciled manually`);
  }

  // mventor-ticket-037: Add phone column to users table
  try { db.run("ALTER TABLE users ADD COLUMN phone TEXT DEFAULT ''"); } catch {}

  // AI Configuration tables
  db.run(`
    CREATE TABLE IF NOT EXISTS ai_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS ai_conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      user_message TEXT NOT NULL,
      ai_response TEXT NOT NULL,
      model_used TEXT,
      response_time_ms INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Announcements table
  db.run(`
    CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL,
      icon TEXT DEFAULT '📢',
      is_active INTEGER DEFAULT 1,
      start_date DATETIME,
      end_date DATETIME,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Hero slides table
  db.run(`
    CREATE TABLE IF NOT EXISTS hero_slides (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      cta_text TEXT DEFAULT 'Shop Now',
      cta_link TEXT DEFAULT '/products',
      product_id INTEGER,
      image_url TEXT,
      is_active INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
    )
  `);

  // Welcome slides table - full-page slider for welcome/landing page
  db.run(`
    CREATE TABLE IF NOT EXISTS welcome_slides (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      subtitle TEXT DEFAULT '',
      description TEXT DEFAULT '',
      image_url TEXT NOT NULL,
      product_id INTEGER,
      cta_text TEXT DEFAULT 'View Product',
      cta_link TEXT DEFAULT '',
      title_color TEXT DEFAULT '#ffffff',
      subtitle_color TEXT DEFAULT '#ffffff',
      desc_color TEXT DEFAULT '#ffffff',
      overlay_opacity REAL DEFAULT 0.4,
      is_active INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
    )
  `);

  // mventor-ticket-019: Link gallery images to specific size/color variants
  try { db.run("ALTER TABLE product_images ADD COLUMN variant_attributes TEXT DEFAULT '{}'"); } catch {}

  // ═══════════════════════════════════════════════════════════════
  // ERP INVENTORY SCHEMA (mventor-ticket-021)
  // ═══════════════════════════════════════════════════════════════

  // Warehouses — physical storage locations
  db.run(`
    CREATE TABLE IF NOT EXISTS warehouses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      address TEXT DEFAULT '',
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Locations — bins/shelves within warehouses
  db.run(`
    CREATE TABLE IF NOT EXISTS locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
      name TEXT NOT NULL,
      barcode TEXT DEFAULT '',
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Inventory Movements — the source of truth for stock
  db.run(`
    CREATE TABLE IF NOT EXISTS inventory_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id),
      warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
      location_id INTEGER REFERENCES locations(id),
      type TEXT NOT NULL,
      reason TEXT DEFAULT '',
      reference_type TEXT DEFAULT '',
      reference_id INTEGER,
      qty_change INTEGER NOT NULL,
      qty_before INTEGER NOT NULL,
      qty_after INTEGER NOT NULL,
      unit_cost INTEGER DEFAULT 0,
      note TEXT DEFAULT '',
      created_by TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Product Variants — for SKU/barcode/serial tracking
  db.run(`
    CREATE TABLE IF NOT EXISTS product_variants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id),
      sku TEXT DEFAULT '',
      barcode TEXT DEFAULT '',
      qr_code TEXT DEFAULT '',
      serial_number TEXT DEFAULT '',
      lot_number TEXT DEFAULT '',
      batch_number TEXT DEFAULT '',
      expiry_date DATE,
      attributes TEXT DEFAULT '{}',
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Inventory — current stock per product per warehouse per location
  db.run(`
    CREATE TABLE IF NOT EXISTS inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id),
      variant_id INTEGER REFERENCES product_variants(id),
      warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
      location_id INTEGER REFERENCES locations(id),
      qty_on_hand INTEGER DEFAULT 0,
      qty_reserved INTEGER DEFAULT 0,
      min_stock INTEGER DEFAULT 0,
      max_stock INTEGER DEFAULT 0,
      reorder_point INTEGER DEFAULT 0,
      last_counted_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(product_id, variant_id, warehouse_id, location_id)
    )
  `);

  // ═══════════════════════════════════════════════════════════════
  // EVENT SYSTEM (mventor-ticket-022)
  // ═══════════════════════════════════════════════════════════════

  // Events — immutable audit trail for all significant actions
  db.run(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      user_id TEXT DEFAULT '',
      user_role TEXT DEFAULT '',
      payload TEXT DEFAULT '{}',
      metadata TEXT DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Indexes for fast timeline queries
  try { db.run('CREATE INDEX IF NOT EXISTS idx_events_entity ON events(entity_type, entity_id, created_at DESC)'); } catch {}
  try { db.run('CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type, created_at DESC)'); } catch {}

  // ═══════════════════════════════════════════════════════════════
  // ROLE-BASED ACCESS CONTROL (mventor-ticket-023)
  // ═══════════════════════════════════════════════════════════════

  // Roles — define user roles with different permission levels
  db.run(`
    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Permissions — define granular permissions
  db.run(`
    CREATE TABLE IF NOT EXISTS permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Role-Permission mappings — many-to-many relationship
  db.run(`
    CREATE TABLE IF NOT EXISTS role_permissions (
      role_id INTEGER NOT NULL,
      permission_id INTEGER NOT NULL,
      PRIMARY KEY (role_id, permission_id),
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
      FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
    )
  `);

  // Users — system users with roles
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role_id INTEGER NOT NULL,
      is_active INTEGER DEFAULT 1,
      last_login_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (role_id) REFERENCES roles(id)
    )
  `);

  // ═══════════════════════════════════════════════════════════════
  // SUPPLIER MANAGEMENT (mventor-ticket-026)
  // ═══════════════════════════════════════════════════════════════

  // Suppliers — vendor/supplier information
  db.run(`
    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      contact_name TEXT DEFAULT '',
      email TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      address TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      lead_time_days INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Product-Supplier relationships
  db.run(`
    CREATE TABLE IF NOT EXISTS product_suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      supplier_id INTEGER NOT NULL,
      supplier_sku TEXT DEFAULT '',
      unit_cost INTEGER DEFAULT 0,
      is_preferred INTEGER DEFAULT 0,
      lead_time_days INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id),
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
      UNIQUE(product_id, supplier_id)
    )
  `);

  // ═══════════════════════════════════════════════════════════════
  // DOCUMENT NUMBERING SYSTEM (mventor-ticket-028)
  // ═══════════════════════════════════════════════════════════════

  // Document sequences — auto-increment counters for document numbers
  db.run(`
    CREATE TABLE IF NOT EXISTS document_sequences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      doc_type TEXT NOT NULL UNIQUE,
      prefix TEXT NOT NULL,
      separator TEXT DEFAULT '-',
      year_format TEXT DEFAULT 'YYYY',
      current_number INTEGER DEFAULT 0,
      padding INTEGER DEFAULT 4,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ═══════════════════════════════════════════════════════════════
  // NOTIFICATION ENGINE (mventor-ticket-029)
  // ═══════════════════════════════════════════════════════════════

  // Notification rules — define when and how to send notifications
  db.run(`
    CREATE TABLE IF NOT EXISTS notification_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      event_type TEXT NOT NULL,
      channel TEXT NOT NULL,
      recipient_type TEXT NOT NULL,
      recipient_value TEXT,
      template TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Notifications log — track sent notifications
  db.run(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rule_id INTEGER,
      channel TEXT NOT NULL,
      recipient TEXT NOT NULL,
      subject TEXT,
      body TEXT,
      status TEXT DEFAULT 'pending',
      sent_at DATETIME,
      error TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (rule_id) REFERENCES notification_rules(id)
    )
  `);

  // In-app notifications — user-specific notifications
  db.run(`
    CREATE TABLE IF NOT EXISTS in_app_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      link TEXT,
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // ═══════════════════════════════════════════════════════════════
  // SETTINGS & CONFIGURATION (mventor-ticket-031)
  // ═══════════════════════════════════════════════════════════════

  // Settings — centralized configuration
  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      value TEXT,
      type TEXT DEFAULT 'string',
      category TEXT DEFAULT 'general',
      description TEXT,
      is_public INTEGER DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_by TEXT
    )
  `);

  // ═══════════════════════════════════════════════════════════════
  // PURCHASE ORDERS (mventor-ticket-027)
  // ═══════════════════════════════════════════════════════════════

  db.run(`
    CREATE TABLE IF NOT EXISTS purchase_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      po_number TEXT NOT NULL UNIQUE,
      supplier_id INTEGER NOT NULL,
      status TEXT DEFAULT 'draft',
      total_cost INTEGER DEFAULT 0,
      notes TEXT DEFAULT '',
      ordered_at DATETIME,
      expected_at DATETIME,
      received_at DATETIME,
      created_by TEXT DEFAULT '',
      approved_by TEXT DEFAULT '',
      approved_at DATETIME,
      reject_reason TEXT DEFAULT '',
      rejected_by TEXT DEFAULT '',
      rejected_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
    )
  `);
  // mventor-procurement: audit fields for the approve/reject workflow (idempotent).
  try { db.run("ALTER TABLE purchase_orders ADD COLUMN approved_at DATETIME"); } catch {}
  try { db.run("ALTER TABLE purchase_orders ADD COLUMN reject_reason TEXT DEFAULT ''"); } catch {}
  try { db.run("ALTER TABLE purchase_orders ADD COLUMN rejected_by TEXT DEFAULT ''"); } catch {}
  try { db.run("ALTER TABLE purchase_orders ADD COLUMN rejected_at DATETIME"); } catch {}

  db.run(`
    CREATE TABLE IF NOT EXISTS purchase_order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      po_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      qty_ordered INTEGER NOT NULL,
      qty_received INTEGER DEFAULT 0,
      unit_cost INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (po_id) REFERENCES purchase_orders(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    )
  `);

  // ═══════════════════════════════════════════════════════════════
  // SUPPLIER PAYMENTS (mventor-ticket-088)
  // ═══════════════════════════════════════════════════════════════
  // Owner: a payment is its own persisted transaction (full/partial), applied
  // explicitly to purchase orders (payables). Posting Dr AP / Cr Cash lives in
  // supplierPaymentService, never here. status: recorded | reversed (immutable —
  // corrections are reversals, never edits). idempotency_key UNIQUE = retry-safe.
  db.run(`
    CREATE TABLE IF NOT EXISTS supplier_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_no TEXT NOT NULL UNIQUE,        -- PAY-YYYY-NNNN via document_sequences
      supplier_id INTEGER NOT NULL,
      method TEXT DEFAULT 'cash',              -- cash today; bank/transfer later
      amount INTEGER NOT NULL,                 -- cents, > 0
      status TEXT NOT NULL DEFAULT 'recorded', -- recorded | reversed
      paid_at TEXT NOT NULL,                   -- YYYY-MM-DD
      notes TEXT DEFAULT '',
      idempotency_key TEXT,
      reversed_by TEXT DEFAULT '',
      reversed_at DATETIME,
      reversal_reason TEXT DEFAULT '',
      created_by TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
    )
  `);
  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS ux_supplier_payment_idem
    ON supplier_payments(idempotency_key) WHERE idempotency_key IS NOT NULL`);

  // ==============================================
  // IDEMPOTENCY CLAIM RECORDS — N1 remediation
  // ==============================================
  // Durable claim/commit store for the idempotency middleware:
  //   PRIMARY KEY (actor, endpoint, idem_key) — the cross-user safety the
  //   old in-memory Map never had, and correctness that survives restart
  //   because claims commit in the SAME db snapshot as the mutations they
  //   protect (saveDb covers the whole file).
  //   state: in_flight -> committed (response cached) or deleted on failure.
  // NOT a second inventory/order truth — pure request bookkeeping.
  db.run(`
    CREATE TABLE IF NOT EXISTS idempotency_records (
      actor TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      idem_key TEXT NOT NULL,
      request_fp TEXT NOT NULL,
      state TEXT NOT NULL DEFAULT 'in_flight',
      response_status INTEGER,
      response_body TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (actor, endpoint, idem_key)
    )
  `);

  // Stabilization #5: canonical REQUEST FINGERPRINT (sha256 of normalized
  // request: supplier/amount/method/date/sorted-applications). Replay is only
  // honored when the key AND the fingerprint match; same key + different
  // request must conflict, never silently replay. Idempotent probe: the catch
  // performs the migration for existing DBs.
  let idemFpMissing = false;
  try { db.prepare('SELECT idem_fp FROM supplier_payments LIMIT 1').get(); } catch { idemFpMissing = true; }
  if (idemFpMissing) db.run('ALTER TABLE supplier_payments ADD COLUMN idem_fp TEXT');

  db.run(`
    CREATE TABLE IF NOT EXISTS supplier_payment_applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_id INTEGER NOT NULL REFERENCES supplier_payments(id) ON DELETE CASCADE,
      purchase_order_id INTEGER NOT NULL REFERENCES purchase_orders(id),
      amount INTEGER NOT NULL,                 -- cents, > 0
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(payment_id, purchase_order_id)
    )
  `);

  // ═══════════════════════════════════════════════════════════════
  // MOBILE APP TABLES (mventor-ticket-035)
  // ═══════════════════════════════════════════════════════════════

  // Device tokens for push notifications
  db.run(`
    CREATE TABLE IF NOT EXISTS device_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      device_token TEXT NOT NULL,
      platform TEXT NOT NULL,
      app_version TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, device_token)
    )
  `);

  // Notification preferences per user
  db.run(`
    CREATE TABLE IF NOT EXISTS notification_preferences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) UNIQUE,
      order_updates INTEGER DEFAULT 1,
      promotions INTEGER DEFAULT 1,
      new_arrivals INTEGER DEFAULT 0,
      price_alerts INTEGER DEFAULT 1,
      low_stock_alerts INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Webhooks for external integrations
  db.run(`
    CREATE TABLE IF NOT EXISTS webhooks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL,
      secret TEXT NOT NULL,
      events TEXT NOT NULL DEFAULT '[]',
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Webhook delivery log
  db.run(`
    CREATE TABLE IF NOT EXISTS webhook_deliveries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      webhook_id INTEGER NOT NULL REFERENCES webhooks(id),
      event_type TEXT NOT NULL,
      payload TEXT NOT NULL,
      response_status INTEGER,
      response_body TEXT,
      delivered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      success INTEGER DEFAULT 0
    )
  `);

  // ═══════════════════════════════════════════════════════════════
  // INDEXES (mventor-ticket-051) — hot query paths
  // Must run AFTER all CREATE TABLE statements above (indexes on
  // inventory_movements/inventory/events/... would fail otherwise).
  // ═══════════════════════════════════════════════════════════════
  db.run('CREATE INDEX IF NOT EXISTS idx_movements_product_wh ON inventory_movements (product_id, warehouse_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_movements_type ON inventory_movements (type)');
  db.run('CREATE INDEX IF NOT EXISTS idx_movements_reference ON inventory_movements (reference_type, reference_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_inventory_product_wh ON inventory (product_id, warehouse_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status)');
  db.run('CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders (customer_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_orders_number ON orders (order_number)');
  db.run('CREATE INDEX IF NOT EXISTS idx_orders_created ON orders (created_at)');
  db.run('CREATE INDEX IF NOT EXISTS idx_events_entity ON events (entity_type, entity_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_events_type ON events (event_type)');
  db.run('CREATE INDEX IF NOT EXISTS idx_shipments_order ON shipments (order_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments (status)');
  db.run('CREATE INDEX IF NOT EXISTS idx_packing_status ON packing_tasks (status)');
  db.run('CREATE INDEX IF NOT EXISTS idx_picking_status ON picking_tasks (status)');
  db.run('CREATE INDEX IF NOT EXISTS idx_paymob_ref ON paymob_links (reference_id)');

  // Migration: add ERP columns to products
  try { db.run("ALTER TABLE products ADD COLUMN cost_price INTEGER DEFAULT 0"); } catch {}
  try { db.run("ALTER TABLE products ADD COLUMN weight_kg REAL DEFAULT 0"); } catch {}
  try { db.run("ALTER TABLE products ADD COLUMN is_trackable INTEGER DEFAULT 1"); } catch {}
  try { db.run("ALTER TABLE products ADD COLUMN default_warehouse_id INTEGER DEFAULT NULL REFERENCES warehouses(id)"); } catch {}
  try { db.run("ALTER TABLE products ADD COLUMN barcode TEXT DEFAULT ''"); } catch {}
  try { db.run("ALTER TABLE products ADD COLUMN sku TEXT DEFAULT ''"); } catch {}
  try { db.run("ALTER TABLE products ADD COLUMN min_stock INTEGER DEFAULT 0"); } catch {}
  try { db.run("ALTER TABLE products ADD COLUMN max_stock INTEGER DEFAULT 0"); } catch {}
  try { db.run("ALTER TABLE products ADD COLUMN reorder_point INTEGER DEFAULT 0"); } catch {}

  // Migration: customers table needs updated_at (mobileUser.js updates it)
  // Note: SQLite ALTER ADD COLUMN requires a CONSTANT default — no CURRENT_TIMESTAMP.
  try { db.run("ALTER TABLE customers ADD COLUMN updated_at DATETIME"); } catch {}
  // mventor-ticket-036: Worker app proof-of-delivery columns
  try { db.run("ALTER TABLE orders ADD COLUMN proof_image TEXT DEFAULT ''"); } catch {}
  try { db.run("ALTER TABLE orders ADD COLUMN proof_note TEXT DEFAULT ''"); } catch {}
  try { db.run("ALTER TABLE orders ADD COLUMN paid_at DATETIME"); } catch {}

  // Seed default categories if empty
  const catCount = db.exec('SELECT COUNT(*) as cnt FROM categories');
  if (!catCount || !catCount[0] || !catCount[0].values || catCount[0].values[0][0] === 0) {
    db.run("INSERT OR IGNORE INTO categories (name, slug) VALUES ('General', 'general')");
    db.run("INSERT OR IGNORE INTO categories (name, slug) VALUES ('Electronics', 'electronics')");
    db.run("INSERT OR IGNORE INTO categories (name, slug) VALUES ('Clothing', 'clothing')");
    db.run("INSERT OR IGNORE INTO categories (name, slug) VALUES ('Home & Garden', 'home-garden')");
  }

  // Seed default brands if empty
  const brandCount = db.exec('SELECT COUNT(*) as cnt FROM brands');
  if (!brandCount || !brandCount[0] || !brandCount[0].values || brandCount[0].values[0][0] === 0) {
    db.run("INSERT OR IGNORE INTO brands (name, slug, icon_url) VALUES ('Generic', 'generic', '/images/brand-generic.svg')");
    db.run("INSERT OR IGNORE INTO brands (name, slug, icon_url) VALUES ('TechPro', 'techpro', '/images/brand-techpro.svg')");
    db.run("INSERT OR IGNORE INTO brands (name, slug, icon_url) VALUES ('StyleCraft', 'stylecraft', '/images/brand-stylecraft.svg')");
    db.run("INSERT OR IGNORE INTO brands (name, slug, icon_url) VALUES ('HomeEase', 'homeease', '/images/brand-homeease.svg')");
    db.run("INSERT OR IGNORE INTO brands (name, slug, icon_url) VALUES ('EcoLife', 'ecolife', '/images/brand-ecolife.svg')");
  }

  // Assign brands to products that don't have one yet (only if brands exist and products have no brand_id)
  const unassigned = db.exec('SELECT COUNT(*) as cnt FROM products WHERE brand_id IS NULL');
  if (unassigned && unassigned[0] && unassigned[0].values && unassigned[0].values[0][0] > 0) {
    // Get brand IDs
    const brandsData = prepare('SELECT id, slug FROM brands').all();
    const brandMap = {
      'electronics': brandsData.find(b => b.slug === 'techpro')?.id,
      'clothing': brandsData.find(b => b.slug === 'stylecraft')?.id,
      'home-garden': brandsData.find(b => b.slug === 'homeease')?.id,
      'general': brandsData.find(b => b.slug === 'generic')?.id,
    };
    // Assign based on category
    const productRows = prepare('SELECT p.id, c.slug as cat_slug FROM products p JOIN categories c ON p.category_id = c.id WHERE p.brand_id IS NULL').all();
    productRows.forEach(p => {
      const brandId = brandMap[p.cat_slug] || brandMap['general'];
      if (brandId) {
        prepare('UPDATE products SET brand_id = ? WHERE id = ?').run(brandId, p.id);
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // ERP INVENTORY MIGRATION (mventor-ticket-021)
  // ═══════════════════════════════════════════════════════════════

  // Seed default warehouse if not exists
  const warehouseCount = db.exec('SELECT COUNT(*) as cnt FROM warehouses');
  if (!warehouseCount || !warehouseCount[0] || !warehouseCount[0].values || warehouseCount[0].values[0][0] === 0) {
    db.run("INSERT INTO warehouses (name, code, address) VALUES ('Main Warehouse', 'WH-MAIN', '')");
  }

  // Get default warehouse ID
  const defaultWarehouse = db.exec('SELECT id FROM warehouses WHERE code = \'WH-MAIN\'');
  const defaultWarehouseId = defaultWarehouse && defaultWarehouse[0] && defaultWarehouse[0].values && defaultWarehouse[0].values[0] 
    ? defaultWarehouse[0].values[0][0] 
    : 1;

  // Set default warehouse for all products that don't have one
  try { 
    db.run('UPDATE products SET default_warehouse_id = ? WHERE default_warehouse_id IS NULL', [defaultWarehouseId]); 
  } catch {}

  // Migrate existing product stock to inventory table
  const inventoryCount = db.exec('SELECT COUNT(*) as cnt FROM inventory');
  if (!inventoryCount || !inventoryCount[0] || !inventoryCount[0].values || inventoryCount[0].values[0][0] === 0) {
    // Get all products with stock > 0
    const productsWithStock = db.exec('SELECT id, stock FROM products WHERE stock > 0');
    if (productsWithStock && productsWithStock[0] && productsWithStock[0].values) {
      productsWithStock[0].values.forEach(row => {
        const productId = row[0];
        const stock = row[1];
        
        // Insert inventory record
        db.run(`
          INSERT INTO inventory (product_id, warehouse_id, qty_on_hand, qty_reserved, min_stock, max_stock, reorder_point)
          VALUES (?, ?, ?, 0, 0, 0, 0)
        `, [productId, defaultWarehouseId, stock]);
        
        // Create opening_balance movement
        db.run(`
          INSERT INTO inventory_movements (product_id, warehouse_id, type, reason, qty_change, qty_before, qty_after, note, created_by)
          VALUES (?, ?, 'opening_balance', 'Initial stock migration', ?, 0, ?, 'Migrated from products.stock', 'system')
        `, [productId, defaultWarehouseId, stock, stock]);
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // SEED RBAC DATA (mventor-ticket-023)
  // ═══════════════════════════════════════════════════════════════

  // Seed default roles
  const rolesCount = db.exec('SELECT COUNT(*) as cnt FROM roles');
  if (!rolesCount || !rolesCount[0] || !rolesCount[0].values || rolesCount[0].values[0][0] === 0) {
    db.run("INSERT INTO roles (name, description) VALUES ('super_admin', 'Full system access')");
    db.run("INSERT INTO roles (name, description) VALUES ('site_manager', 'Multi-warehouse oversight')");
    db.run("INSERT INTO roles (name, description) VALUES ('warehouse_manager', 'Single warehouse operations')");
    db.run("INSERT INTO roles (name, description) VALUES ('delivery_partner', 'Shipments and deliveries')");
    db.run("INSERT INTO roles (name, description) VALUES ('support', 'Customer-facing operations')");
    db.run("INSERT INTO roles (name, description) VALUES ('viewer', 'Read-only access')");
    // Sales Manager (mventor-ticket-059): owns pricing, customer acquisition
    // (VIP invites) and sales reporting. Role assignment UI held for now.
    db.run("INSERT INTO roles (name, description) VALUES ('sales_manager', 'Pricing control, VIP invites and sales reports')");
  }

  // Seed default permissions
  const permissionsCount = db.exec('SELECT COUNT(*) as cnt FROM permissions');
  if (!permissionsCount || !permissionsCount[0] || !permissionsCount[0].values || permissionsCount[0].values[0][0] === 0) {
    // Product permissions
    db.run("INSERT INTO permissions (name, description) VALUES ('products.create', 'Create new products')");
    db.run("INSERT INTO permissions (name, description) VALUES ('products.read', 'View products')");
    db.run("INSERT INTO permissions (name, description) VALUES ('products.update', 'Update products')");
    db.run("INSERT INTO permissions (name, description) VALUES ('products.delete', 'Delete products')");

    // Order permissions
    db.run("INSERT INTO permissions (name, description) VALUES ('orders.create', 'Create orders')");
    db.run("INSERT INTO permissions (name, description) VALUES ('orders.read', 'View orders')");
    db.run("INSERT INTO permissions (name, description) VALUES ('orders.update', 'Update orders')");
    db.run("INSERT INTO permissions (name, description) VALUES ('orders.delete', 'Delete orders')");
    db.run("INSERT INTO permissions (name, description) VALUES ('customers.view', 'View customers')");

    // Inventory permissions
    db.run("INSERT INTO permissions (name, description) VALUES ('inventory.read', 'View inventory')");
    db.run("INSERT INTO permissions (name, description) VALUES ('inventory.adjust', 'Adjust inventory')");
    db.run("INSERT INTO permissions (name, description) VALUES ('inventory.transfer', 'Transfer inventory')");

    // Warehouse permissions
    db.run("INSERT INTO permissions (name, description) VALUES ('warehouses.read', 'View warehouses')");
    db.run("INSERT INTO permissions (name, description) VALUES ('warehouses.manage', 'Manage warehouses')");

    // Supplier permissions
    db.run("INSERT INTO permissions (name, description) VALUES ('suppliers.read', 'View suppliers')");
    db.run("INSERT INTO permissions (name, description) VALUES ('suppliers.manage', 'Manage suppliers')");

    // Purchase order permissions
    db.run("INSERT INTO permissions (name, description) VALUES ('purchase_orders.create', 'Create purchase orders')");
    db.run("INSERT INTO permissions (name, description) VALUES ('purchase_orders.read', 'View purchase orders')");
    db.run("INSERT INTO permissions (name, description) VALUES ('purchase_orders.update', 'Update purchase orders')");
    db.run("INSERT INTO permissions (name, description) VALUES ('purchase_orders.approve', 'Approve purchase orders')");

    // Supplier payment permissions (mventor-ticket-088)
    db.run("INSERT INTO permissions (name, description) VALUES ('supplier_payments.read', 'View supplier payments')");
    db.run("INSERT INTO permissions (name, description) VALUES ('supplier_payments.manage', 'Record and reverse supplier payments')");

    // User management permissions
    db.run("INSERT INTO permissions (name, description) VALUES ('users.create', 'Create users')");
    db.run("INSERT INTO permissions (name, description) VALUES ('users.read', 'View users')");
    db.run("INSERT INTO permissions (name, description) VALUES ('users.update', 'Update users')");
    db.run("INSERT INTO permissions (name, description) VALUES ('users.delete', 'Delete users')");

    // Settings permissions
    db.run("INSERT INTO permissions (name, description) VALUES ('settings.read', 'View settings')");
    db.run("INSERT INTO permissions (name, description) VALUES ('settings.manage', 'Manage settings')");

    // Reports permissions
    db.run("INSERT INTO permissions (name, description) VALUES ('reports.read', 'View reports')");
  }

  // Assign all permissions to Super Admin role
  const rolePermissionsCount = db.exec('SELECT COUNT(*) as cnt FROM role_permissions');
  if (!rolePermissionsCount || !rolePermissionsCount[0] || !rolePermissionsCount[0].values || rolePermissionsCount[0].values[0][0] === 0) {
    const superAdminRole = db.exec("SELECT id FROM roles WHERE name = 'super_admin'");
    if (superAdminRole && superAdminRole[0] && superAdminRole[0].values && superAdminRole[0].values[0]) {
      const superAdminRoleId = superAdminRole[0].values[0][0];
      const allPermissions = db.exec('SELECT id FROM permissions');
      if (allPermissions && allPermissions[0] && allPermissions[0].values) {
        allPermissions[0].values.forEach(row => {
          const permissionId = row[0];
          db.run('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)', [superAdminRoleId, permissionId]);
        });
      }
    }
  }

  // mventor-ticket-043: New permissions (insert-if-missing, works on existing DBs)
  const ticket43Permissions = [
    ['inventory.manage', 'Manage inventory (movements, orders, periods)'],
    ['inventory.packing', 'Packing — issue orders and dispatch'],
    ['inventory.view', 'View inventory data'],
    ['documents.manage', 'Generate and download warehouse documents'],
    ['reports.view', 'View and export reports'],
    ['orders.manage', 'Manage sales orders'],
    ['users.manage', 'Manage users and roles'],
    ['supplier_payments.read', 'View supplier payments'],
    ['supplier_payments.manage', 'Record and reverse supplier payments'],
  ];
  ticket43Permissions.forEach(([name, description]) => {
    db.run(`
      INSERT INTO permissions (name, description)
      SELECT ?, ? WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = ?)
    `, [name, description, name]);
  });
  // Ensure super_admin always has every permission (existing DBs too)
  const saRoleAll = db.exec("SELECT id FROM roles WHERE name = 'super_admin'");
  if (saRoleAll && saRoleAll[0] && saRoleAll[0].values && saRoleAll[0].values[0]) {
    const saRoleId = saRoleAll[0].values[0][0];
    const allPerms2 = db.exec('SELECT id FROM permissions');
    if (allPerms2 && allPerms2[0] && allPerms2[0].values) {
      allPerms2[0].values.forEach(row => {
        db.run('INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)', [saRoleId, row[0]]);
      });
    }
  }

  // mventor-ticket-043: Document sequences for supply/issue orders (insert-if-missing)
  db.run(`
    INSERT INTO document_sequences (doc_type, prefix, separator, year_format, current_number, padding)
    SELECT 'SUP', 'SUP', '-', 'YYYY', 0, 4 WHERE NOT EXISTS (SELECT 1 FROM document_sequences WHERE doc_type = 'SUP')
  `);
  db.run(`
    INSERT INTO document_sequences (doc_type, prefix, separator, year_format, current_number, padding)
    SELECT 'ISS', 'ISS', '-', 'YYYY', 0, 4 WHERE NOT EXISTS (SELECT 1 FROM document_sequences WHERE doc_type = 'ISS')
  `);

  // Create initial Super Admin user from .env credentials
  const usersCount = db.exec('SELECT COUNT(*) as cnt FROM users');
  if (!usersCount || !usersCount[0] || !usersCount[0].values || usersCount[0].values[0][0] === 0) {
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword || adminPassword.length < 8) {
      throw new Error('ADMIN_PASSWORD env var is required and must be at least 8 characters. Set it in your .env file.');
    }
    const bcrypt = require('bcryptjs');
    const passwordHash = bcrypt.hashSync(adminPassword, 10);
    
    const superAdminRole = db.exec("SELECT id FROM roles WHERE name = 'super_admin'");
    if (superAdminRole && superAdminRole[0] && superAdminRole[0].values && superAdminRole[0].values[0]) {
      const superAdminRoleId = superAdminRole[0].values[0][0];
      db.run(
        'INSERT INTO users (email, password_hash, name, role_id, is_active) VALUES (?, ?, ?, ?, 1)',
        [adminEmail, passwordHash, 'Super Admin', superAdminRoleId]
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // SEED DOCUMENT SEQUENCES (mventor-ticket-028)
  // ═══════════════════════════════════════════════════════════════

  // Idempotent per-doc-type seeding. The previous count-gate skipped ALL seeds
  // once SUP/ISS existed, so PO/SO/GR/GI/TO/RT/CM/ADJ were never created → PO
  // creation threw "No sequence configured for document type: PO". Add each
  // missing type with WHERE NOT EXISTS (existing numbers are preserved).
  for (const dt of ['PO', 'SO', 'GR', 'GI', 'TO', 'RT', 'CM', 'ADJ', 'JE', 'PAY']) {
    try {
      db.run(`INSERT INTO document_sequences (doc_type, prefix, separator, year_format, current_number, padding)
        SELECT '${dt}', '${dt}', '-', 'YYYY', 0, 4
        WHERE NOT EXISTS (SELECT 1 FROM document_sequences WHERE doc_type = '${dt}')`);
    } catch { /* already present or non-critical */ }
  }

  // ═══════════════════════════════════════════════════════════════
  // SEED SETTINGS (mventor-ticket-031)
  // ═══════════════════════════════════════════════════════════════

  const settingsCount = db.exec('SELECT COUNT(*) as cnt FROM settings');
  if (!settingsCount || !settingsCount[0] || !settingsCount[0].values || settingsCount[0].values[0][0] === 0) {
    // General settings
    db.run("INSERT INTO settings (key, value, type, category, description, is_public) VALUES ('store_name', 'E-Commerce', 'string', 'general', 'Site name shown everywhere (Site Identity)', 1)");
    db.run("INSERT INTO settings (key, value, type, category, description, is_public) VALUES ('site_logo_url', '', 'string', 'general', 'Site logo image URL (Site Identity)', 1)");
    db.run("INSERT INTO settings (key, value, type, category, description, is_public) VALUES ('site_tagline', '', 'string', 'general', 'Short tagline under the site name (Site Identity)', 1)");
    // Backfill for databases created before Site Identity existed
    try { db.run("INSERT INTO settings (key, value, type, category, description, is_public) SELECT 'site_logo_url', '', 'string', 'general', 'Site logo image URL (Site Identity)', 1 WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key='site_logo_url')"); } catch {}
    try { db.run("INSERT INTO settings (key, value, type, category, description, is_public) SELECT 'site_tagline', '', 'string', 'general', 'Short tagline under the site name (Site Identity)', 1 WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key='site_tagline')"); } catch {}
    // Packaging auto-consumption (mventor-ticket-057): admin sets WHICH
    // packaging product is consumed (1 per sold item). Never hardcoded.
        try { db.run("INSERT INTO settings (key, value, type, category, description, is_public) SELECT 'store_description', '', 'string', 'general', 'What the store sells � used by AI assistant & SEO', 1 WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key='store_description')"); } catch {}
    try { db.run("INSERT INTO settings (key, value, type, category, description, is_public) SELECT 'packaging_product_id', '0', 'number', 'inventory', 'Packaging product consumed automatically per sold item (0 = off)', 0 WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key='packaging_product_id')"); } catch {}
    // Domain configuration (mventor-ticket-059): QR codes & links point here
    try { db.run("INSERT INTO settings (key, value, type, category, description, is_public) SELECT 'admin_site_url', 'http://localhost:5174', 'string', 'general', 'Admin panel public URL', 1 WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key='admin_site_url')"); } catch {}
    // ── Welcome page 3D showcase (admin-configurable) ──
    try { db.run("INSERT INTO settings (key, value, type, category, description, is_public) SELECT 'welcome_3d_enabled', '0', 'bool', 'general', 'Show a 3D model on the welcome/landing page', 1 WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key='welcome_3d_enabled')"); } catch {}
    try { db.run("INSERT INTO settings (key, value, type, category, description, is_public) SELECT 'welcome_3d_model_url', '', 'string', 'general', '3D model file URL (.glb/.gltf) for the welcome page showcase', 1 WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key='welcome_3d_model_url')"); } catch {}
    try { db.run("INSERT INTO settings (key, value, type, category, description, is_public) SELECT 'welcome_3d_motion', 'float', 'string', 'general', 'Welcome 3D motion preset: float | spin | none', 1 WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key='welcome_3d_motion')"); } catch {}
    try { db.run("INSERT INTO settings (key, value, type, category, description, is_public) SELECT 'welcome_3d_scale', '1', 'number', 'general', 'Welcome 3D model scale multiplier', 1 WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key='welcome_3d_scale')"); } catch {}
    try { db.run("INSERT INTO settings (key, value, type, category, description, is_public) SELECT 'welcome_3d_speed', '1', 'number', 'general', 'Welcome 3D animation speed multiplier', 1 WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key='welcome_3d_speed')"); } catch {}
    try { db.run("INSERT INTO settings (key, value, type, category, description, is_public) SELECT 'welcome_3d_clip', '', 'string', 'general', 'Which animation clip inside the .glb plays (empty = first clip / motion preset only)', 1 WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key='welcome_3d_clip')"); } catch {}
    // ── Kashier gateway (mventor-ticket-059) ──
    try { db.run("INSERT INTO settings (key, value, type, category, description, is_public) SELECT 'kashier_merchant_id', '', 'string', 'integrations', 'Kashier Merchant ID (mid)', 0 WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key='kashier_merchant_id')"); } catch {}
    try { db.run("INSERT INTO settings (key, value, type, category, description, is_public) SELECT 'kashier_api_key', '', 'string', 'integrations', 'Kashier API secret key', 0 WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key='kashier_api_key')"); } catch {}
    try { db.run("INSERT INTO settings (key, value, type, category, description, is_public) SELECT 'kashier_base_url', 'https://payat.kashier.io', 'string', 'integrations', 'Kashier API base URL', 0 WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key='kashier_base_url')"); } catch {}
    try { db.run("CREATE TABLE IF NOT EXISTS kashier_webhook_events (id INTEGER PRIMARY KEY AUTOINCREMENT, event_key TEXT UNIQUE, event_type TEXT, status TEXT, payload TEXT, received_at DATETIME DEFAULT CURRENT_TIMESTAMP)"); } catch {}
  try { db.run("CREATE TABLE IF NOT EXISTS kashier_orders (id INTEGER PRIMARY KEY AUTOINCREMENT, merchant_order_id TEXT UNIQUE, kashier_order_key TEXT, amount_cents INTEGER, currency TEXT DEFAULT 'EGP', status TEXT DEFAULT 'created', order_id INTEGER, raw_response TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME)"); } catch {}
    // Paymob integration IDs (mventor-ticket-059): one per method activated
    // in the Paymob dashboard — all share the same callback URLs.
    db.run("INSERT INTO settings (key, value, type, category, description, is_public) VALUES ('currency', 'EGP', 'string', 'general', 'Default currency', 1)");
    db.run("INSERT INTO settings (key, value, type, category, description, is_public) VALUES ('timezone', 'Africa/Cairo', 'string', 'general', 'Default timezone', 0)");
    db.run("INSERT INTO settings (key, value, type, category, description, is_public) VALUES ('language', 'en', 'string', 'general', 'Default language', 1)");
    
    // Inventory settings
    db.run("INSERT INTO settings (key, value, type, category, description, is_public) VALUES ('default_warehouse_id', '1', 'number', 'inventory', 'Default warehouse ID', 0)");
    db.run("INSERT INTO settings (key, value, type, category, description, is_public) VALUES ('low_stock_threshold', '10', 'number', 'inventory', 'Low stock alert threshold', 0)");
    db.run("INSERT INTO settings (key, value, type, category, description, is_public) VALUES ('reservation_timeout', '15', 'number', 'inventory', 'Stock reservation timeout (minutes)', 0)");
    
    // Order settings
    db.run("INSERT INTO settings (key, value, type, category, description, is_public) VALUES ('auto_confirm_orders', '0', 'boolean', 'orders', 'Auto-confirm orders', 0)");
    db.run("INSERT INTO settings (key, value, type, category, description, is_public) VALUES ('cancellation_window', '24', 'number', 'orders', 'Order cancellation window (hours)', 0)");
    
    // Delivery settings
    db.run("INSERT INTO settings (key, value, type, category, description, is_public) VALUES ('auto_confirmation_days', '7', 'number', 'delivery', 'Auto-confirm delivery after days', 0)");
    
    // Security settings
    db.run("INSERT INTO settings (key, value, type, category, description, is_public) VALUES ('session_timeout', '1440', 'number', 'security', 'Session timeout (minutes)', 0)");
  }

  // ═══════════════════════════════════════════════════════════════
  // SEED API INTEGRATION SETTINGS (mventor-ticket-038)
  // Per-key inserts so they work on existing databases too.
  // ═══════════════════════════════════════════════════════════════

  const integrationSettings = [
    // Mail (SMTP)
    ['mail_provider', 'smtp', 'string', 'integrations', 'Mail provider (smtp | sendgrid)', 0],
    ['mail_smtp_host', '', 'string', 'integrations', 'SMTP host (e.g. smtp.gmail.com)', 0],
    ['mail_smtp_port', '587', 'number', 'integrations', 'SMTP port (465 for SSL)', 0],
    ['mail_smtp_user', '', 'string', 'integrations', 'SMTP username', 0],
    ['mail_smtp_pass', '', 'string', 'integrations', 'SMTP password / app password', 0],
    ['mail_from', 'noreply@comfortsign.com', 'string', 'integrations', 'Sender email address', 0],
    ['mail_admin_email', 'mventor2010@gmail.com', 'string', 'integrations', 'Admin notification email', 0],
    // SendGrid
    ['sendgrid_api_key', '', 'string', 'integrations', 'SendGrid API key', 0],
    ['sendgrid_from_email', '', 'string', 'integrations', 'SendGrid sender email', 0],
    // Paymob
    // Stripe
    // Google Maps
    ['google_maps_api_key', '', 'string', 'integrations', 'Google Maps Platform API key', 0],
    // AI
    ['ai_provider', 'ollama', 'string', 'integrations', 'AI provider (ollama | openai)', 0],
    ['ai_base_url', '', 'string', 'integrations', 'AI base URL (e.g. http://localhost:11434)', 0],
    ['ai_model', '', 'string', 'integrations', 'AI model name', 0],
    ['ai_api_key', '', 'string', 'integrations', 'AI API key (for cloud providers)', 0],
    ['ai_timeout', '15000', 'number', 'integrations', 'AI request timeout (ms)', 0],
    // Custom API keys (JSON object — admin-defined key/value pairs)
    ['custom_api_keys', '{}', 'json', 'integrations', 'Custom API keys (free-form)', 0],
  ];

  for (const [key, value, type, category, description, isPublic] of integrationSettings) {
    db.run(`
      INSERT INTO settings (key, value, type, category, description, is_public)
      SELECT ?, ?, ?, ?, ?, ?
      WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = ?)
    `, [key, String(value), type, category, description, isPublic, key]);
  }

  // ═══════════════════════════════════════════════════════════════
  // SEED HOME PAGE / FRONTEND SETTINGS (mventor-ticket-039)
  // Logo click destination + "Shop by Category" showcase configuration
  // ═══════════════════════════════════════════════════════════════

  const frontendSettings = [
    ['logo_link', '/', 'string', 'frontend', 'Where the site logo navigates to', 1],
    ['home_categories_enabled', '1', 'boolean', 'frontend', 'Show "Shop by Category" section on the home page', 1],
    ['home_categories', '[]', 'json', 'frontend', 'Category showcase: ordered array of category slugs shown on home (empty = all)', 1],
    ['home_trust_badges', '[{"icon":"truck","title":"Free Shipping","title_ar":"شحن مجاني","description":"On orders over 500","description_ar":"على الطلبات فوق 500","link":""},{"icon":"shield","title":"Secure Payment","title_ar":"دفع آمن","description":"100% protected payments","description_ar":"حماية كاملة لمدفوعاتك","link":""},{"icon":"return","title":"Easy Returns","title_ar":"إرجاع سهل","description":"30-day return policy","description_ar":"سياسة استبدال وإرجاع 30 يوم","link":""},{"icon":"chat","title":"24/7 Support","title_ar":"دعم على مدار الساعة","description":"Real people, around the clock.","description_ar":"فريق حقيقي في أي وقت.","link":""}]', 'json', 'frontend', 'Trust badges (icon name, bilingual title/description, link)', 1],
    ['home_features', '[{"icon":"cross","title":"Medical Grade","title_ar":"جودة طبية","description":"All products meet strict medical standards and certifications for safe, effective use.","description_ar":"جميع المنتجات مطابقة لمعايير طبية صارمة وشهادات معتمدة للاستخدام الآمن والفعال.","link":""},{"icon":"bolt","title":"Fast Delivery","title_ar":"توصيل سريع","description":"Quick and reliable delivery across Egypt. Get your health products when you need them.","description_ar":"توصيل سريع وموثوق في كل مصر — منتجاتك الصحية تصلك وقت ما تحتاجها.","link":""},{"icon":"stetho","title":"Expert Support","title_ar":"دعم من متخصصين","description":"Questions about a product? Our team of specialists is here to help you choose.","description_ar":"عندك سؤال عن منتج؟ فريق المتخصصين هيساعدك تختار الأنسب.","link":""}]', 'json', 'frontend', 'Why Choose Us section (icon name, bilingual title/description, link)', 1],
    ['home_section_headers', '{"categories":{"title_en":"Shop by Category","title_ar":"تسوّق حسب القسم","sub_en":"Find exactly what you need","sub_ar":"هتلاقي بالظبط اللي محتاجه"},"featured":{"title_en":"Featured Products","title_ar":"منتجات مختارة","sub_en":"Handpicked just for you","sub_ar":"مختارة بعناية خصيصاً لك"},"why_us":{"title_en":"Why Shop With Us","title_ar":"ليه تتسوق معانا","sub_en":"Trusted by healthcare professionals","sub_ar":"محط ثقة لأخصائيي الرعاية الصحية"}}', 'json', 'frontend', 'Homepage section headings (title/subtitle, English + Arabic) — editable from Site Config', 1],
    ['reviews_enabled', '1', 'boolean', 'frontend', 'Show product ratings and customer comments site-wide', 1],
  ];

  for (const [key, value, type, category, description, isPublic] of frontendSettings) {
    db.run(`
      INSERT INTO settings (key, value, type, category, description, is_public)
      SELECT ?, ?, ?, ?, ?, ?
      WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = ?)
    `, [key, String(value), type, category, description, isPublic, key]);
  }

  // ═══════════════════════════════════════════════════════════════
  // SEED PLATFORM SETTINGS (mventor-ticket-040)
  // Notifications / Documents / Security / Appearance categories
  // ═══════════════════════════════════════════════════════════════

  const platformSettings = [
    // Notifications
    ['notify_order_received', '1', 'boolean', 'notifications', 'Send notification when a new order is placed', 0],
    ['notify_order_status_changes', '1', 'boolean', 'notifications', 'Send notification on order status changes', 0],
    ['notify_low_stock', '1', 'boolean', 'notifications', 'Send notification when stock falls below threshold', 0],
    ['notify_admin_email', '', 'string', 'notifications', 'Email address for admin notifications (empty = use mail admin email)', 0],
    // Documents
    ['doc_company_name', 'Ecom-ERP', 'string', 'documents', 'Company name shown on invoices and documents', 0],
    ['doc_invoice_prefix', 'INV', 'string', 'documents', 'Invoice number prefix', 0],
    ['doc_tax_rate', '14', 'number', 'documents', 'Tax rate percentage applied on documents', 0],
    ['doc_show_tax', '1', 'boolean', 'documents', 'Show tax line on invoices', 0],
    ['doc_invoice_footer', '', 'string', 'documents', 'Footer note printed on invoices', 0],
    // Security
    ['security_2fa_required', '0', 'boolean', 'security', 'Require two-factor authentication for admin login', 0],
    ['security_password_min_length', '8', 'number', 'security', 'Minimum admin password length', 0],
    ['security_login_attempts', '5', 'number', 'security', 'Max failed login attempts before lockout', 0],
    ['security_lockout_minutes', '15', 'number', 'security', 'Account lockout duration (minutes)', 0],
    ['security_password_expiry_days', '90', 'number', 'security', 'Force password change after this many days (0 = never)', 0],
    // Appearance
    ['appearance_theme', 'light', 'string', 'appearance', 'Default storefront theme (light | dark | system)', 1],
    ['appearance_primary_color', '#2563eb', 'string', 'appearance', 'Primary brand color (hex)', 1],
    ['appearance_font_family', 'Inter', 'string', 'appearance', 'Storefront font family', 1],
    ['appearance_rounded_corners', '1', 'boolean', 'appearance', 'Use rounded corners across the storefront', 1],
  ];

  for (const [key, value, type, category, description, isPublic] of platformSettings) {
    db.run(`
      INSERT INTO settings (key, value, type, category, description, is_public)
      SELECT ?, ?, ?, ?, ?, ?
      WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = ?)
    `, [key, String(value), type, category, description, isPublic, key]);
  }

  // ═══════════════════════════════════════════════════════════════
  // SEED REPORT + FINANCIAL PERIOD SETTINGS (mventor-ticket-043/044)
  // ═══════════════════════════════════════════════════════════════

  const reportSettings = [
    ['financial_period_months', '12', 'number', 'inventory', 'Financial period length in months (1-60)', 0],
    ['allow_negative_stock', '0', 'boolean', 'inventory', 'Allow stock to go negative on issues/damages (OFF = block insufficient stock)', 0],
    ['report_frequency', 'off', 'string', 'reports', 'Scheduled report frequency (off | daily | weekly | monthly)', 0],
    ['report_types', '["inventory_value","low_stock","out_of_stock"]', 'json', 'reports', 'Report types included in scheduled exports', 0],
    ['report_last_run', '', 'string', 'reports', 'Last scheduled report run (ISO timestamp)', 0],
    ['courier_name', '', 'string', 'shipping', 'Shipping courier name (e.g. FedEx, DHL)', 0],
    ['courier_website', '', 'string', 'shipping', 'Courier website for tracking', 0],
    ['courier_tracking_prefix', 'CS', 'string', 'shipping', 'Tracking number prefix (e.g. CS-000123)', 0],
    ['courier_phone', '', 'string', 'shipping', 'Courier contact phone', 0],
    ['shipping_from_address', '', 'string', 'shipping', 'Return/sender address on shipping labels', 0],
    ['shipping_policy', '', 'string', 'shipping', 'Shipping policy text (printed on the policy document)', 0],
    // ── mventor-ticket-052: notification channel toggles (STEP 9) ──
    ['notify_channel_dashboard', '1', 'boolean', 'notifications', 'In-app dashboard notifications', 0],
    ['notify_channel_email', '1', 'boolean', 'notifications', 'Email notifications', 0],
    ['notify_channel_webhook', '1', 'boolean', 'notifications', 'Webhook notifications', 0],
    ['notify_channel_push', '0', 'boolean', 'notifications', 'Mobile push notifications (future)', 0],
    ['notify_channel_sms', '0', 'boolean', 'notifications', 'SMS notifications (future)', 0],
    ['notify_channel_whatsapp', '0', 'boolean', 'notifications', 'WhatsApp notifications (future)', 0],
    // ── mventor-ticket-045: Order workflow + quadruple confirmation engine ──
    ['order_flow_enabled', '0', 'boolean', 'orders', 'Enable the full order lifecycle (draft→…→completed). Off = legacy pending/paid/shipped flow', 0],
    ['order_statuses', '["draft","payment_pending","payment_verified","admin_review","confirmed","picking","packing","ready_for_shipping","shipped","delivered","completed","cancelled"]', 'json', 'orders', 'Order lifecycle statuses (configurable)', 0],
    ['confirm_payment_verified', '1', 'boolean', 'orders', 'Confirmation requires payment verification', 0],
    ['confirm_stock_available', '1', 'boolean', 'orders', 'Confirmation requires stock availability', 0],
    ['confirm_manual_approval', '1', 'boolean', 'orders', 'Confirmation requires manual admin approval', 0],
    ['confirm_auto_timeout_hours', '24', 'number', 'orders', 'Auto-approval timeout in hours (0 = disabled)', 0],
    ['estimated_delivery_hours', '48', 'number', 'orders', 'Estimated delivery time in hours (customer notifications)', 0],
    // ── mventor-ticket-046: Price lists ──
    ['storefront_price_list', 'retail', 'string', 'pricing', 'Price list used on the storefront (retail | wholesale | semi_wholesale | offer)', 1],
    // ── Pricing engine: default retail derivation from wholesale cost ──
    ['default_markup_percent', '20', 'number', 'pricing', 'Default retail markup over wholesale cost (%) — used on product create/import and as the Pricing Engine starting value', 0],
    // ── mventor-ticket-047: Paymob gateway ──
    ['customer_verification_required', '1', 'boolean', 'customers', 'Require phone verification before a customer is "authorized"', 0],
  ];

  for (const [key, value, type, category, description, isPublic] of reportSettings) {
    db.run(`
      INSERT INTO settings (key, value, type, category, description, is_public)
      SELECT ?, ?, ?, ?, ?, ?
      WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = ?)
    `, [key, String(value), type, category, description, isPublic, key]);
  }

  // ═══════════════════════════════════════════════════════════════
  // SEED DEFAULT PRICE LISTS (mventor-ticket-046; 065: wholesale/semi legacy-inactive)
  // insert-if-missing by code — never flips existing rows (live DB handled separately)
  // ═══════════════════════════════════════════════════════════════

  const defaultPriceLists = [
    ['Retail', 'retail', 0, 1, 1],
    ['Wholesale', 'wholesale', 15, 0, 0],
    ['Semi Wholesale', 'semi_wholesale', 7, 0, 0],
    ['Offer', 'offer', 20, 0, 1],
  ];
  defaultPriceLists.forEach(([name, code, discount, isDefault, isActive]) => {
    db.run(`
      INSERT INTO price_lists (name, code, discount_percent, is_default, is_active)
      SELECT ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM price_lists WHERE code = ?)
    `, [name, code, discount, isDefault, isActive, code]);
  });

  // ═══════════════════════════════════════════════════════════════
  // SEED SHIPMENT PROVIDERS (mventor-ticket-049) — insert-if-missing
  // Delivery methods: employee / local contractor / shipping company
  // ═══════════════════════════════════════════════════════════════

  const defaultProviders = [
    ['In-House Employee', 'employee', '', '', ''],
    ['Local Contractor', 'contractor', '', '', ''],
    ['FedEx', 'company', '', 'https://www.fedex.com', 'https://www.fedex.com/fedextrack/?trknbr={TRACKING}'],
    ['DHL', 'company', '', 'https://www.dhl.com', 'https://www.dhl.com/en/express/tracking.html?AWB={TRACKING}'],
    ['Aramex', 'company', '', 'https://www.aramex.com', 'https://www.aramex.com/aramex-tracking?shipmentNumber={TRACKING}'],
  ];
  defaultProviders.forEach(([name, type, phone, website, tpl]) => {
    db.run(`
      INSERT INTO shipment_providers (name, type, contact_phone, website, tracking_url_template, is_active)
      SELECT ?, ?, ?, ?, ?, 1 WHERE NOT EXISTS (SELECT 1 FROM shipment_providers WHERE name = ?)
    `, [name, type, phone, website, tpl, name]);
  });

  // ═══════════════════════════════════════════════════════════════
  // SEED DEMO REVIEWS (mventor-ticket-041) — only when no reviews exist yet
  // Mix of good and bad comments so the review UI can be tested.
  // ═══════════════════════════════════════════════════════════════

  const reviewCount = db.exec('SELECT COUNT(*) as cnt FROM reviews');
  // Only seed demo reviews when a catalog actually exists � on a fresh/empty
  // store these FK-reference products that are not there yet (fresh reset).
  const productCountForReviews = db.exec('SELECT COUNT(*) as cnt FROM products');
  const hasProducts = productCountForReviews && productCountForReviews[0] &&
    productCountForReviews[0].values && productCountForReviews[0].values[0][0] > 0;
  if ((!reviewCount || !reviewCount[0] || !reviewCount[0].values || reviewCount[0].values[0][0] === 0) && hasProducts) {
    const demoCustomers = [
      ['demo1@mventor.test', 'Ahmed Hassan'],
      ['demo2@mventor.test', 'Mona Ali'],
      ['demo3@mventor.test', 'Omar Khaled'],
      ['demo4@mventor.test', 'Sarah Nabil'],
      ['demo5@mventor.test', 'Karim Mostafa'],
      ['demo6@mventor.test', 'Dina Samir'],
    ];
    const customerIds = [];
    demoCustomers.forEach(([email, name]) => {
      // Match on the stable google_id (emails may have been rebranded over time)
      const gid = `demo-${email.split('@')[0]}`;
      let found = null;
      try {
        const r = db.prepare('SELECT id FROM customers WHERE google_id = ? OR email = ?').get(gid, email);
        found = r ? [r.id] : null;
      } catch { found = null; }
      if (found && found.length > 0) {
        customerIds.push(found[0]);
      } else {
        try {
          db.run('INSERT INTO customers (email, name, google_id) VALUES (?, ?, ?)', [email, name, gid]);
          const idRes = db.exec('SELECT last_insert_rowid() AS id');
          customerIds.push(idRes[0].values[0][0]);
        } catch (e) {
          console.error('Demo customer seed skipped:', e.message);
          customerIds.push(null);
        }
      }
    });

    const demoReviews = [
      // Good reviews
      [1, 0, 5, 'Excellent quality, exactly as described! Very satisfied with the purchase.'],
      [1, 1, 4, 'Good product overall, comfortable and well made.'],
      [2, 2, 5, 'Fast delivery and great product. Highly recommend!'],
      [2, 3, 4, 'Solid set, works as expected. Great value for money.'],
      [3, 4, 5, 'Better than expected for the price. Very happy!'],
      [6, 5, 5, 'Amazing support, my knee feels much better after using it.'],
      [6, 0, 4, 'Good quality brace, fits well.'],
      [5, 1, 4, 'Great jump rope, smooth rotation and durable.'],
      // Bad reviews
      [3, 2, 2, 'Product feels cheap, not worth the price. Disappointed.'],
      [5, 3, 3, 'Took long to arrive and the quality is average at best.'],
      [7, 4, 2, "Sizing runs small, doesn't fit as expected. Returned it."],
      [7, 5, 3, 'Average quality. The belt works but is not very comfortable.'],
    ];

    demoReviews.forEach(([productId, custIdx, rating, comment]) => {
      // Skip gracefully if this specific product no longer exists
      const pExists = db.exec(`SELECT id FROM products WHERE id = ${parseInt(productId)}`);
      if (!pExists || !pExists[0] || !pExists[0].values || pExists[0].values.length === 0) return;
      // Skip if the demo customer is gone too (fresh-start wipes customers)
      const customerId = customerIds[custIdx];
      if (!customerId) return;
      db.run(`
        INSERT INTO reviews (product_id, customer_id, rating, comment)
        VALUES (?, ?, ?, ?)
      `, [productId, customerId, rating, comment]);
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // SEED INVENTORY LEDGER (mventor-ticket-042) — when inventory is empty,
  // create opening_balance movements from the legacy products.stock so
  // the ERP inventory and the storefront agree from the start.
  // ═══════════════════════════════════════════════════════════════

  const invCount = db.exec('SELECT COUNT(*) as cnt FROM inventory');
  if (invCount && invCount[0] && invCount[0].values && invCount[0].values[0][0] === 0) {
    const wh = db.exec('SELECT id FROM warehouses WHERE is_active = 1 ORDER BY id LIMIT 1');
    if (wh && wh[0] && wh[0].values && wh[0].values.length > 0) {
      const whId = wh[0].values[0][0];
      const products = db.exec('SELECT id, stock FROM products WHERE stock > 0 ORDER BY id');
      if (products && products[0] && products[0].values) {
        products[0].values.forEach(([pid, stock]) => {
          db.run(`
            INSERT INTO inventory_movements (product_id, warehouse_id, location_id, type, reason, reference_type, qty_change, qty_before, qty_after, unit_cost, note, created_by)
            VALUES (?, ?, NULL, 'opening_balance', 'seeded from product stock', 'seed', ?, 0, ?, 0, 'initial stock from products.stock', 'system')
          `, [pid, whId, stock, stock]);
          db.run(`
            INSERT INTO inventory (product_id, warehouse_id, location_id, qty_on_hand, qty_reserved, min_stock, max_stock, reorder_point)
            VALUES (?, ?, NULL, ?, 0, 0, 0, 0)
          `, [pid, whId, stock]);
        });
        // Library must not console.log: startup/operator banners live at the
        // entry point (index.js). This fired after Jest teardown before.
      }
    }
  }

  // Ensure foreign-key enforcement is ON AFTER the full schema/seed build.
  // The early PRAGMA (line ~27) does not reliably stick at runtime in sql.js,
  // which previously left declared FOREIGN KEYs unenforced (orphan risk).
  db.run('PRAGMA foreign_keys = ON');
  saveDb();
  return db;
}

// Save database to disk
function saveDb() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

// -- Debounced persistence (mventor-ticket-050) --
// Writing the whole DB file on EVERY statement is O(db-size) per write and
// blocks the event loop. Writes now mark the DB dirty and coalesce into a
// single flush ~400ms later. Call flushSave() (or saveDb()) for an
// immediate durable write � tests and shutdown hooks do this.
let _saveTimer = null;
function scheduleSave() {
  if (_saveTimer) return;
  _saveTimer = setTimeout(() => {
    _saveTimer = null;
    try { saveDb(); } catch (err) { console.error('Deferred DB save failed:', err.message); }
  }, 400);
  if (_saveTimer.unref) _saveTimer.unref();
}
function flushSave() {
  if (_saveTimer) { clearTimeout(_saveTimer); _saveTimer = null; }
  saveDb();
}
process.on('exit', () => { try { flushSave(); } catch { /* best effort */ } });

// -- Transactions (mventor-ticket-050) --
// Runs fn atomically: all statements commit together, or none do.
let _txnDepth = 0;
function transaction(fn) {
  if (!db) throw new Error('Database not initialized');
  // NESTING-AWARE: SQLite forbids a second BEGIN inside an open transaction, but
  // several flows legitimately nest (payment success → issueForOrder →
  // createIssueForOrder each wrap their own transaction). We use a SAVEPOINT for
  // nested calls so the inner work rolls back on its own failure while still
  // participating atomically in the outer transaction. The outermost call does
  // BEGIN IMMEDIATE / COMMIT / ROLLBACK; inner calls use SAVEPOINT / RELEASE.
  const isNested = _txnDepth > 0;
  const spName = 'txn_sp_' + (_txnDepth + 1);
  _txnDepth++;
  try {
    if (isNested) {
      db.run('SAVEPOINT ' + spName);
    } else {
      db.run('BEGIN IMMEDIATE');
    }
    const result = fn();
    if (isNested) {
      db.run('RELEASE ' + spName);
    } else {
      db.run('COMMIT');
      scheduleSave();
    }
    return result;
  } catch (err) {
    try {
      if (isNested) {
        db.run('ROLLBACK TO ' + spName);
        db.run('RELEASE ' + spName);
      } else {
        db.run('ROLLBACK');
      }
    } catch { /* already rolled back */ }
    throw err;
  } finally {
    _txnDepth--;
  }
}

// Improved run function with error handling
function runSql(sql, params = []) {
  if (!db) throw new Error('Database not initialized');
  
  try {
    db.run(sql, params);
    
    // IMPORTANT: Capture these BEFORE saveDb() because db.export() resets them!
    const changes = db.getRowsModified();
    let lastId = 0;
    try {
      const r = db.exec('SELECT last_insert_rowid() as id');
      if (r && r[0] && r[0].values && r[0].values[0]) {
        lastId = r[0].values[0][0];
      }
    } catch (e) {
      // last_insert_rowid might return empty for non-INSERT statements
    }

  // ═══════════════════════════════════════════════════════════════
  // SEED CATEGORY ICONS (fake defaults for categories missing one)
  // ═══════════════════════════════════════════════════════════════
  const categoryIconDefaults = {
    'Electronics': '🔌',
    'Home & Kitchen': '🏠',
    'Fashion': '👕',
    'Grocery': '🛒',
    'Beauty & Care': '🧴',
    'General': '📦',
  };
  const cats = db.exec('SELECT id, name, icon FROM categories');
  if (cats && cats[0] && cats[0].values) {
    cats[0].values.forEach(([id, name, icon]) => {
      if (!icon && categoryIconDefaults[name]) {
        db.run('UPDATE categories SET icon = ? WHERE id = ?', [categoryIconDefaults[name], id]);
      } else if (!icon) {
        db.run('UPDATE categories SET icon = ? WHERE id = ?', ['📦', id]);
      }
    });
  }

  scheduleSave();

    return { changes, lastInsertRowid: lastId };
  } catch (err) {
    console.error('SQL Error:', err.message, 'for SQL:', sql, 'params:', JSON.stringify(params));
    throw err;
  }
}

// Query all rows
function queryAll(sql, params = []) {
  if (!db) throw new Error('Database not initialized');
  
  try {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
  } catch (err) {
    console.error('SQL Query Error:', err.message, 'for SQL:', sql, 'params:', JSON.stringify(params));
    throw err;
  }
}

// Query first row
function queryOne(sql, params = []) {
  const rows = queryAll(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

// Prepare helper
function prepare(sql) {
  return {
    run: (...params) => runSql(sql, params),
    get: (...params) => queryOne(sql, params),
    all: (...params) => queryAll(sql, params),
  };
}

// Initialize on module load
const initPromise = initDb();

// sql.js quirk: `PRAGMA foreign_keys = ON` executed DURING initDb does not
// reliably stick on the connection (empirically reads 0 afterwards). Re-applying
// it once init resolves DOES take effect, so enforce it here — closing the
// relational-integrity gap where declared FOREIGN KEYs were previously unenforced.
if (initPromise && typeof initPromise.then === 'function') {
  initPromise.then(() => { try { db.run('PRAGMA foreign_keys = ON'); } catch {} }).catch(() => {});
}

module.exports = {
  initPromise,
  queryAll,
  queryOne,
  run: runSql,
  prepare,
  saveDb,
  scheduleSave,
  flushSave,
  transaction,
  getDb: () => db,
};
