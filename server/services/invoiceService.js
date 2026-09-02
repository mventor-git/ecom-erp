const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const db = require('../db');
const settingsService = require('./settingsService');

const INVOICE_DIR = path.join(__dirname, '..', 'data', 'invoices');

const CURRENCY_SYMBOLS = {
  EGP: 'ج.م', 'EGP-TXT': 'EGP', USD: '$', EUR: '€', GBP: '£', SAR: 'ر.س', AED: 'د.إ', KWD: 'د.ك',
  QAR: 'ر.ق', BHD: 'د.ب', OMR: 'ر.ع', JOD: 'د.أ', LBP: 'ل.ل', MAD: 'د.م.', DZD: 'د.ج',
  TND: 'د.ت', LYD: 'ل.د', IQD: 'ع.د', TRY: '₺', ILS: '₪', INR: '₹', CNY: '¥', JPY: '¥',
  KRW: '₩', THB: '฿', VND: '₫', MYR: 'RM', IDR: 'Rp', PHP: '₱', SGD: 'S$', HKD: 'HK$',
  AUD: 'A$', CAD: 'C$', CHF: 'CHF', SEK: 'kr', NOK: 'kr', DKK: 'kr', PLN: 'zł', CZK: 'Kč',
  HUF: 'Ft', RON: 'lei', UAH: '₴', RUB: '₽', BRL: 'R$', MXN: '$', ZAR: 'R', NGN: '₦',
};

function currencySymbol(code) {
  return CURRENCY_SYMBOLS[code] || code || 'ج.م';
}

function ensureDir() {
  fs.mkdirSync(INVOICE_DIR, { recursive: true });
}

function money(cents, sym) {
  return `${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${sym}`;
}

// Border style used across the invoice table
const THIN_BORDER = {
  top: { style: 'thin', color: { rgb: 'CBD5E1' } },
  bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
  left: { style: 'thin', color: { rgb: 'CBD5E1' } },
  right: { style: 'thin', color: { rgb: 'CBD5E1' } },
};

/**
 * Generate an .xlsx invoice honoring the Documents + General settings:
 *  doc_company_name, doc_invoice_prefix, doc_tax_rate, doc_show_tax,
 *  doc_invoice_footer, store_name, currency
 *
 * @param {{orderId?: number}} opts - orderId optional; omit for a test invoice
 * @returns {{filename, path, invoiceNumber, invoiceDate, subtotal, tax, total, currency, fromOrder}}
 */
function generateInvoice({ orderId } = {}) {
  ensureDir();

  const company = String(settingsService.get('doc_company_name', '') || settingsService.siteIdentity().name);
  const prefix = String(settingsService.get('doc_invoice_prefix', 'INV') || 'INV');
  const taxRate = Number(settingsService.get('doc_tax_rate', 14)) || 0;
  const showTax = !!settingsService.get('doc_show_tax', true);
  const footer = String(settingsService.get('doc_invoice_footer', '') || '');
  const currency = String(settingsService.get('currency', 'EGP') || 'EGP');
  const storeName = settingsService.siteIdentity().name;
  const sym = currencySymbol(currency);

  let order = null;
  if (orderId) {
    order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  }

  let items = [];
  let subtotal = 0;
  let invoiceNumber;
  let invoiceDate;
  let customerName = 'Walk-in Customer';
  let customerAddress = '';
  let customerPhone = '';

  if (order) {
    invoiceNumber = `${prefix}-${String(order.id).padStart(4, '0')}`;
    invoiceDate = order.created_at ? new Date(order.created_at) : new Date();
    try { items = JSON.parse(order.items || '[]'); } catch { items = []; }
    subtotal = order.subtotal || 0;
    if (!subtotal && items.length) {
      subtotal = items.reduce((s, i) => s + ((i.price || 0) * (i.qty || i.quantity || 1)), 0);
    }
    customerName = order.shipping_name || order.customer_name || 'Customer';
    customerAddress = order.shipping_address || '';
    customerPhone = order.shipping_phone || '';
  } else {
    // Test invoice — demonstrates the template
    invoiceNumber = `${prefix}-TEST-${Date.now().toString().slice(-6)}`;
    invoiceDate = new Date();
    items = [
      { name: 'Knee Support Brace', price: 12500, qty: 1 },
      { name: 'Orthopedic Insoles', price: 8500, qty: 2 },
      { name: 'Massage Roller', price: 23000, qty: 1 },
    ];
    subtotal = items.reduce((s, i) => s + (i.price * (i.qty || 1)), 0);
    customerName = 'Test Customer';
  }

  const tax = showTax ? Math.round(subtotal * taxRate / 100) : 0;
  const total = subtotal + tax;

  // ── Build the sheet ──
  const rows = [];
  rows.push([company, '', '', 'INVOICE']);
  rows.push([storeName, '', '', invoiceNumber]);
  rows.push(['', '', '', invoiceDate.toISOString().slice(0, 10)]);
  rows.push([]);
  rows.push(['BILL TO', '', '', '']);
  rows.push([customerName, '', '', '']);
  if (customerAddress) rows.push([customerAddress, '', '', '']);
  if (customerPhone) rows.push([`Phone: ${customerPhone}`, '', '', '']);
  rows.push([]);
  rows.push(['#', 'Item', 'Qty', 'Unit Price', 'Amount']);
  items.forEach((it, i) => {
    const qty = it.qty || it.quantity || 1;
    const unit = it.price || 0;
    rows.push([i + 1, it.name || it.product_name || 'Item', qty, money(unit, sym), money(unit * qty, sym)]);
  });
  rows.push([]);
  rows.push(['', '', '', 'Subtotal', money(subtotal, sym)]);
  if (showTax) rows.push(['', '', '', `Tax (${taxRate}%)`, money(tax, sym)]);
  rows.push(['', '', '', 'TOTAL', money(total, sym)]);
  rows.push([]);
  if (footer) rows.push([footer, '', '', '', '']);
  rows.push(['Thank you for your business!', '', '', '', '']);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 6 }, { wch: 42 }, { wch: 8 }, { wch: 16 }, { wch: 18 }];

  // ── Styles (SheetJS CE basic XLSX styling) ──
  const style = (r, c, s) => {
    const addr = XLSX.utils.encode_cell({ r, c });
    if (ws[addr]) ws[addr].s = s;
  };
  const BOLD = { font: { bold: true } };
  const TITLE = { font: { bold: true, sz: 16, color: { rgb: '1D4ED8' } } };
  const INVOICE_LABEL = { font: { bold: true, sz: 14, color: { rgb: '1D4ED8' } }, alignment: { horizontal: 'right' } };
  const HEADER_FILL = {
    font: { bold: true, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: '2563EB' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: THIN_BORDER,
  };
  const BODY = { alignment: { vertical: 'center' }, border: THIN_BORDER };
  const RIGHT = { alignment: { horizontal: 'right', vertical: 'center' }, border: THIN_BORDER };
  const TOTAL_STYLE = {
    font: { bold: true, sz: 12, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: '1D4ED8' } },
    alignment: { horizontal: 'right', vertical: 'center' },
    border: THIN_BORDER,
  };

  style(0, 0, TITLE);
  style(0, 3, INVOICE_LABEL);
  style(1, 3, { font: { bold: true } });
  style(2, 3, {});

  // Table header row index: 8 (after title, meta, blank, bill-to block)
  const headerRow = 8;
  for (let c = 0; c < 5; c++) style(headerRow, c, HEADER_FILL);

  const firstItemRow = headerRow + 1;
  const lastItemRow = firstItemRow + items.length - 1;
  for (let r = firstItemRow; r <= lastItemRow; r++) {
    for (let c = 0; c < 5; c++) {
      style(r, c, c === 0 || c === 2 ? { ...BODY, alignment: { horizontal: 'center', vertical: 'center' } } : (c === 3 || c === 4 ? RIGHT : BODY));
    }
  }

  const subtotalRow = lastItemRow + 2;
  style(subtotalRow, 3, { ...BODY, alignment: { horizontal: 'right' }, font: { bold: true } });
  style(subtotalRow, 4, { ...BODY, alignment: { horizontal: 'right' }, font: { bold: true } });
  if (showTax) {
    const taxRow = subtotalRow + 1;
    style(taxRow, 3, { ...BODY, alignment: { horizontal: 'right' } });
    style(taxRow, 4, { ...BODY, alignment: { horizontal: 'right' } });
  }
  const totalRow = showTax ? subtotalRow + 2 : subtotalRow + 1;
  style(totalRow, 3, TOTAL_STYLE);
  style(totalRow, 4, TOTAL_STYLE);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Invoice');

  const filename = `${invoiceNumber}.xlsx`;
  const filePath = path.join(INVOICE_DIR, filename);
  XLSX.writeFile(wb, filePath);

  return {
    filename,
    filePath,
    invoiceNumber,
    invoiceDate: invoiceDate.toISOString(),
    subtotal,
    tax,
    total,
    currency,
    fromOrder: !!order,
    orderId: order ? order.id : null,
  };
}

function listInvoices() {
  ensureDir();
  return fs
    .readdirSync(INVOICE_DIR)
    .filter(f => f.endsWith('.xlsx'))
    .map(f => {
      const st = fs.statSync(path.join(INVOICE_DIR, f));
      return { filename: f, size: st.size, created: st.mtime.toISOString() };
    })
    .sort((a, b) => b.created.localeCompare(a.created));
}

function invoicePath(filename) {
  // Prevent path traversal — only serve files from the invoice directory
  const base = path.basename(filename);
  return path.join(INVOICE_DIR, base);
}

// ═══════════════════════════════════════════════════════════════
// MOVEMENT DOCUMENT TEMPLATES (xlsx)
// Not every movement type needs a paper document — the ones that do:
//   opening_balance, receipt, issue, adjustment, transfer,
//   return, damage, count
// (Reservation / Release / Correction are internal soft operations.)
// ═══════════════════════════════════════════════════════════════

const MOVEMENT_TEMPLATES = {
  opening_balance: { label: 'Opening Balance', prefix: 'OB', docTitle: 'OPENING BALANCE' },
  receipt:         { label: 'Goods Receipt', prefix: 'GR', docTitle: 'GOODS RECEIPT' },
  issue:           { label: 'Goods Issue', prefix: 'GI', docTitle: 'GOODS ISSUE' },
  adjustment:      { label: 'Stock Adjustment', prefix: 'ADJ', docTitle: 'STOCK ADJUSTMENT' },
  transfer:        { label: 'Stock Transfer', prefix: 'TR', docTitle: 'STOCK TRANSFER' },
  return:          { label: 'Stock Return', prefix: 'RT', docTitle: 'STOCK RETURN' },
  damage:          { label: 'Damage Write-off', prefix: 'DM', docTitle: 'DAMAGE WRITE-OFF' },
  count:           { label: 'Inventory Count', prefix: 'IC', docTitle: 'INVENTORY COUNT' },
};

function getSupportedMovementTypes() {
  return Object.entries(MOVEMENT_TEMPLATES).map(([type, t]) => ({ type, ...t }));
}

/**
 * Generate a movement document (.xlsx) for an inventory movement type.
 * @param {{type: string, movementId?: number}} opts
 */
function generateMovementDocument({ type, movementId } = {}) {
  const template = MOVEMENT_TEMPLATES[type];
  if (!template) {
    throw new Error(`No template for movement type "${type}"`);
  }
  ensureDir();

  const company = String(settingsService.get('doc_company_name', '') || settingsService.siteIdentity().name);
  const footer = String(settingsService.get('doc_invoice_footer', '') || '');
  const currency = String(settingsService.get('currency', 'EGP') || 'EGP');
  const sym = currencySymbol(currency);
  const storeName = settingsService.siteIdentity().name;

  // Load real movement if provided and of the matching type
  let movement = null;
  if (movementId) {
    movement = db.prepare(`
      SELECT m.*, p.name as product_name, p.sku as product_sku,
             w.name as warehouse_name, l.name as location_name
      FROM inventory_movements m
      LEFT JOIN products p ON p.id = m.product_id
      LEFT JOIN warehouses w ON w.id = m.warehouse_id
      LEFT JOIN locations l ON l.id = m.location_id
      WHERE m.id = ?
    `).get(movementId);
    if (movement && movement.type !== type) movement = null; // type mismatch → test doc
  }

  const docNumber = movement
    ? `${template.prefix}-${String(movement.id).padStart(4, '0')}`
    : `${template.prefix}-TEST-${Date.now().toString().slice(-6)}`;
  const docDate = movement ? new Date(movement.created_at) : new Date();

  const rows = [];
  rows.push([company, '', '', template.docTitle]);
  rows.push([storeName, '', '', docNumber]);
  rows.push(['', '', '', docDate.toISOString().slice(0, 10)]);
  rows.push([]);
  rows.push(['REFERENCE', '', '', '']);
  rows.push([movement ? `Movement #${movement.id}` : 'Test document', '', '', '']);
  if (movement?.reference_type) rows.push([`Ref: ${movement.reference_type}${movement.reference_id ? ' #' + movement.reference_id : ''}`, '', '', '']);
  if (movement?.warehouse_name) rows.push([`Warehouse: ${movement.warehouse_name}${movement.location_name ? ' / ' + movement.location_name : ''}`, '', '', '']);
  if (movement?.reason) rows.push([`Reason: ${movement.reason}`, '', '', '']);
  if (movement?.note) rows.push([`Note: ${movement.note}`, '', '', '']);
  rows.push([]);
  rows.push(['#', 'Product', 'Qty', 'Unit Cost', 'Amount']);
  rows.push([]);

  let totalAmount = 0;
  const qty = movement ? movement.qty_change : 0;
  const unitCost = movement ? movement.unit_cost : 0;
  if (movement) {
    rows.push([1, movement.product_name || `Product #${movement.product_id}`, qty, money(unitCost, sym), money(Math.abs(unitCost * qty), sym)]);
    totalAmount = Math.abs(unitCost * qty);
  } else {
    // Test sample data
    const samples = [
      ['Knee Support Brace', qty || 12, 12500],
      ['Orthopedic Insoles', qty || 20, 8500],
      ['Massage Roller', qty || 8, 23000],
    ];
    samples.forEach((s, i) => {
      rows.push([i + 1, s[0], s[1], money(s[2], sym), money(s[2] * s[1], sym)]);
      totalAmount += s[2] * s[1];
    });
  }

  rows.push([]);
  rows.push(['', '', '', 'Total Amount', money(totalAmount, sym)]);
  if (movement) {
    rows.push([`Balance: ${movement.qty_before} → ${movement.qty_after}`, '', '', '']);
  }
  rows.push([]);
  if (footer) rows.push([footer, '', '', '', '']);
  rows.push([`Document: ${template.docTitle} — generated by ${settingsService.siteIdentity().name}`, '', '', '', '']);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 6 }, { wch: 42 }, { wch: 10 }, { wch: 16 }, { wch: 18 }];

  const style = (r, c, s) => {
    const addr = XLSX.utils.encode_cell({ r, c });
    if (ws[addr]) ws[addr].s = s;
  };
  const TITLE = { font: { bold: true, sz: 16, color: { rgb: '1D4ED8' } } };
  const DOC_LABEL = { font: { bold: true, sz: 14, color: { rgb: '1D4ED8' } }, alignment: { horizontal: 'right' } };
  const HEADER_FILL = {
    font: { bold: true, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: '2563EB' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: THIN_BORDER,
  };
  const BODY = { alignment: { vertical: 'center' }, border: THIN_BORDER };
  const RIGHT = { alignment: { horizontal: 'right', vertical: 'center' }, border: THIN_BORDER };
  const TOTAL_STYLE = {
    font: { bold: true, sz: 12, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: '1D4ED8' } },
    alignment: { horizontal: 'right', vertical: 'center' },
    border: THIN_BORDER,
  };

  style(0, 0, TITLE);
  style(0, 3, DOC_LABEL);
  style(1, 3, { font: { bold: true } });

  // Table header row: find the row starting with '#'
  const headerRow = rows.findIndex(r => r[0] === '#');
  for (let c = 0; c < 5; c++) style(headerRow, c, HEADER_FILL);

  // Body rows between header and first blank after it
  const firstBody = headerRow + 1;
  const lastBody = rows.length - 1;
  for (let r = firstBody; r < lastBody; r++) {
    if (!rows[r] || rows[r].length === 0 || rows[r][0] === undefined) continue;
    const isTotal = String(rows[r][3] || '').includes('Total');
    for (let c = 0; c < 5; c++) {
      if (isTotal) {
        style(r, c, TOTAL_STYLE);
      } else {
        style(r, c, c === 0 || c === 2 ? { ...BODY, alignment: { horizontal: 'center', vertical: 'center' } } : (c === 3 || c === 4 ? RIGHT : BODY));
      }
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, template.label.slice(0, 31));

  const filename = `${docNumber}.xlsx`;
  const filePath = path.join(INVOICE_DIR, filename);
  XLSX.writeFile(wb, filePath);

  return {
    filename,
    filePath,
    docNumber,
    type,
    docTitle: template.docTitle,
    docDate: docDate.toISOString(),
    total: totalAmount,
    currency,
    fromMovement: !!movement,
    movementId: movement ? movement.id : null,
  };
}

module.exports = {
  generateInvoice,
  generateMovementDocument,
  getSupportedMovementTypes,
  listInvoices,
  invoicePath,
  INVOICE_DIR,
};
