/**
 * Setup Readiness Service — the first-run brain (mventor-ticket-094).
 *
 * Answers "what data does this system still need to become MY company?" by
 * DERIVING every answer from actual records — no state flags, no wizard
 * table, nothing that can fall out of sync. The wizard writes real domain
 * objects (settings rows, a financial period, imported masters); this service
 * merely observes them, so the checklist can never lie and completion
 * survives restarts, fresh-start resets and re-runs by construction.
 *
 * core    = must be done before ordinary business (identity, an open period,
 *           a warehouse, a catalog).
 * guidance= what a real company also needs next (suppliers, customers,
 *           opening stock) — surfaced as next actions, never blocking.
 */

const db = require('../db');

function setting(key, fallback = '') {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row && row.value != null ? String(row.value) : fallback;
}
function count(sql, ...params) {
  try { return Number(db.prepare(sql).get(...params)?.c || 0); } catch { return 0; }
}

const DEFAULT_STORE_NAME = 'E-Commerce';

function getSetupStatus() {
  const storeName = setting('store_name', DEFAULT_STORE_NAME);
  const companyNamed = !!storeName.trim() && storeName.trim() !== DEFAULT_STORE_NAME;
  const warehouseCount = count('SELECT COUNT(*) c FROM warehouses WHERE is_active = 1');
  const periodCount = count('SELECT COUNT(*) c FROM financial_periods');
  const openPeriods = count("SELECT COUNT(*) c FROM financial_periods WHERE status = 'OPEN'");
  const accountCount = count('SELECT COUNT(*) c FROM accounts');
  const productCount = count('SELECT COUNT(*) c FROM products WHERE deleted_at IS NULL');
  const categoryCount = count('SELECT COUNT(*) c FROM categories');
  const supplierCount = count('SELECT COUNT(*) c FROM suppliers');
  const customerCount = count('SELECT COUNT(*) c FROM customers');
  const openingStock = count("SELECT COUNT(*) c FROM inventory_movements WHERE type IN ('opening_balance', 'receipt')");
  const staffUsers = count("SELECT COUNT(*) c FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name != 'super_admin' AND u.is_active = 1");
  const currency = setting('currency', 'EGP');
  const timezone = setting('timezone', 'Africa/Cairo');

  const items = [
    {
      key: 'company',
      label: 'Company identity',
      core: true,
      done: companyNamed,
      hint: 'Set your company name — the storefront, documents, receipts and journals all inherit it. Everything customer-facing reads Settings.',
      link: '/erp/settings?focus=company',
    },
    {
      key: 'locale',
      label: `Currency & timezone (${currency}, ${timezone})`,
      core: true,
      done: !!currency && !!timezone, // seeded defaults are usable; the wizard shows them for confirmation
      hint: 'All money is stored as integer cents in this currency. Change it from Settings if your base differs.',
      link: '/erp/settings?focus=storefront',
    },
    {
      key: 'warehouse',
      label: 'Warehouse / branch',
      core: true,
      done: warehouseCount > 0,
      hint: 'Inventory lives in at least one warehouse. “Main Warehouse” exists by default — rename it and add shelf locations for your real sites.',
      link: '/inventory/warehouses',
    },
    {
      key: 'fiscal_period',
      label: openPeriods > 0 ? 'Open financial period' : 'First financial period',
      core: true,
      done: periodCount > 0,
      hint: 'Accounting and stock movements fail CLOSED outside an open period. Create the period covering today (opening balances are entered against it).',
      link: '/erp/financial-periods',
    },
    {
      key: 'catalog',
      label: 'Product catalog',
      core: true,
      done: productCount > 0,
      hint: productCount > 0
        ? `${productCount} product${productCount === 1 ? '' : 's'}${categoryCount ? ` across ${categoryCount} categories` : ''}.`
        : 'Add products manually or import a CSV/XLSX sheet — the importer previews, validates, dedupes by SKU/name and reports per-row.',
      link: '/setup/import',
    },
    {
      key: 'suppliers',
      label: 'Suppliers',
      core: false,
      done: supplierCount > 0,
      hint: 'Purchasing (PO → receiving → accounts payable) needs at least one supplier.',
      link: '/erp/suppliers',
    },
    {
      key: 'customers',
      label: 'Customers',
      core: false,
      done: customerCount > 0,
      hint: 'Walk-in and online customers accumulate naturally; import an existing book to start with real balances.',
      link: '/erp/customers',
    },
    {
      key: 'opening_stock',
      label: 'Opening inventory',
      core: false,
      done: openingStock > 0,
      hint: 'Count your shelves in: Financial Periods → “Set Opening Balance” posts real stock-in movements against the open period.',
      link: '/erp/financial-periods',
    },
    {
      key: 'chart',
      label: 'Chart of Accounts',
      core: false,
      done: accountCount > 0,
      hint: accountCount > 0
        ? `${accountCount} accounts. The six core accounts (Cash, Receivable, Inventory, Payable, Revenue, COGS) provision automatically on the first posting.`
        : 'Core accounts provision automatically with the first posting — review or extend them anytime.',
      link: '/erp/chart-of-accounts',
    },
    {
      key: 'team',
      label: 'Operators & staff accounts',
      core: false,
      done: staffUsers > 0,
      hint: 'Create per-person staff users (driver, picker, cashier) instead of sharing one login; actions stay auditable per user.',
      link: '/erp/users',
    },
  ];

  const remainingCore = items.filter((i) => i.core && !i.done).map((i) => i.key);
  return {
    setup_complete: remainingCore.length === 0,
    remaining_core: remainingCore,
    counts: {
      products: productCount, categories: categoryCount, suppliers: supplierCount,
      customers: customerCount, warehouses: warehouseCount, accounts: accountCount,
      financial_periods: periodCount, open_periods: openPeriods, staff_users: staffUsers,
    },
    currency,
    timezone,
    items,
  };
}

module.exports = { getSetupStatus, DEFAULT_STORE_NAME };
