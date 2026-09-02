/**
 * Print Service — print-ready HTML pages for every business document.
 * All pages include:
 *   - A4 print-optimized CSS (print from the browser → paper or PDF)
 *   - QR code + barcode (embedded as data URIs)
 *   - Company branding from settings
 *
 * Document types: invoice, customer receipt, inventory receipt (movement),
 * issue order, supply order, shipping label, shipping policy.
 */

const QRCode = require('qrcode');
const settingsService = require('./settingsService');
const { barcodeDataUri } = require('./code39Service');

const CURRENCY_SYMBOLS = {
  EGP: 'ج.م', 'EGP-TXT': 'EGP', USD: '$', EUR: '€', GBP: '£', SAR: 'ر.س', AED: 'د.إ', KWD: 'د.ك',
  QAR: 'ر.ق', BHD: 'د.ب', OMR: 'ر.ع', JOD: 'د.أ', LBP: 'ل.ل', TRY: '₺', ILS: '₪', INR: '₹',
  CNY: '¥', JPY: '¥', SAR2: '', AUD: 'A$', CAD: 'C$', CHF: 'CHF', SEK: 'kr', NOK: 'kr',
  DKK: 'kr', PLN: 'zł', CZK: 'Kč', HUF: 'Ft', RON: 'lei', UAH: '₴', RUB: '₽', BRL: 'R$',
};

function currencySymbol() {
  const code = String(settingsService.get('currency', 'EGP') || 'EGP');
  return CURRENCY_SYMBOLS[code] || code;
}

function money(cents) {
  return `${((cents || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EGP`;
}

function companyName() {
  return String(settingsService.get('doc_company_name', '') || settingsService.siteIdentity().name);
}

function siteLogoUrl() {
  return String(settingsService.get('site_logo_url', '') || '');
}

function esc(text) {
  return String(text === undefined || text === null ? '' : text)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function qrDataUri(data) {
  try {
    return await QRCode.toDataURL(String(data), { errorCorrectionLevel: 'M', margin: 2, width: 200 });
  } catch {
    return '';
  }
}

const PRINT_CSS = `
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; margin: 0; background: #f1f5f9; }
  .sheet { max-width: 820px; margin: 16px auto; background: #fff; padding: 40px 48px; box-shadow: 0 4px 20px rgba(0,0,0,.08); }
  .doc-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #1f857a; padding-bottom: 16px; margin-bottom: 20px; }
  .doc-header h1 { font-size: 26px; margin: 0; color: #16655d; }
  .doc-header .number { font-size: 14px; color: #64748b; }
  .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 24px; font-size: 13px; margin-bottom: 18px; }
  .meta b { color: #334155; }
  table.items { width: 100%; border-collapse: collapse; font-size: 13px; margin: 12px 0 18px; }
  table.items th { background: #1f857a; color: #fff; text-align: left; padding: 8px 10px; font-size: 12px; }
  table.items td { border-bottom: 1px solid #e2e8f0; padding: 8px 10px; }
  table.items tr:nth-child(even) td { background: #f8fafc; }
  .totals { margin-left: auto; width: 280px; font-size: 14px; }
  .totals .row { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px dashed #e2e8f0; }
  .totals .grand { font-weight: 700; font-size: 17px; color: #16655d; border-top: 2px solid #1f857a; border-bottom: none; padding-top: 8px; }
  .codes { display: flex; gap: 24px; margin: 24px 0; align-items: center; }
  .codes img { width: 110px; height: 110px; border: 1px solid #e2e8f0; padding: 4px; }
  .codes .cap { font-size: 11px; color: #64748b; text-align: center; margin-top: 4px; }
  .footer { border-top: 1px solid #e2e8f0; margin-top: 24px; padding-top: 12px; font-size: 12px; color: #64748b; text-align: center; }
  .shipping-box { border: 2px solid #1f857a; border-radius: 10px; padding: 16px; margin: 12px 0; }
  .shipping-box h3 { margin: 0 0 8px; color: #16655d; font-size: 14px; text-transform: uppercase; }
  .shipping-box p { margin: 3px 0; font-size: 14px; }
  .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; }
  .badge.green { background: #dcfce7; color: #15803d; }
  .badge.red { background: #fee2e2; color: #b91c1c; }
  .badge.blue { background: #dbeafe; color: #16655d; }
  .btn-print { position: fixed; top: 16px; right: 16px; background: #1f857a; color: #fff; border: none; padding: 10px 18px; border-radius: 8px; font-size: 14px; cursor: pointer; box-shadow: 0 4px 12px rgba(37,99,235,.4); }
  .btn-back { position: fixed; top: 16px; left: 16px; background: #fff; color: #334155; border: 1px solid #cbd5e1; padding: 10px 18px; border-radius: 8px; font-size: 14px; cursor: pointer; }
  .viewer-bar { position: fixed; top: 0; left: 0; right: 0; height: 56px; background: #0f172a; color: #fff; display: flex; align-items: center; justify-content: space-between; padding: 0 20px; z-index: 50; box-shadow: 0 2px 10px rgba(0,0,0,.2); }
  .viewer-bar .title { font-weight: 700; font-size: 14px; }
  .viewer-bar .actions { display: flex; gap: 10px; }
  .viewer-bar button { background: #1f857a; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; }
  .viewer-bar button.secondary { background: #334155; }
  .sheet { margin-top: 72px; }
  @media print {
    body { background: #fff; }
    .sheet { box-shadow: none; margin: 0; max-width: 100%; padding: 20px 28px; }
    .btn-print, .btn-back, .viewer-bar { display: none !important; }
    @page { size: A4; margin: 12mm; }
  }
`;

function layout({ title, number, subtitle = '', meta = [], items = [], totals = [], footer = '',
               qrUri = '', barUri = '', company = '', badges = '', logoUrl = '', signatures = [] }) {
  const metaHtml = meta.length
    ? `<div class="meta">${meta.map(([k, v]) => `<div><b>${esc(k)}:</b> ${esc(v)}</div>`).join('')}</div>`
    : '';
  const itemsHtml = items.length
    ? `<table class="items"><thead><tr><th>#</th><th>Item</th><th class="num">Qty</th><th class="num">Unit</th><th class="num">Amount</th></tr></thead>
       <tbody>${items.map((it, i) => `<tr><td>${i + 1}</td><td>${esc(it.name)}</td><td class="num">${it.qty}</td><td class="num">${it.unit || '—'}</td><td class="num">${it.amount || '—'}</td></tr>`).join('')}</tbody></table>`
    : '';
  const sigHtml = signatures.length
    ? `<div class="signatures">${signatures.map(cap => `<div class="sig"><div class="line"></div><div class="cap">${esc(cap)}</div></div>`).join('')}</div>`
    : '';
  const totalsHtml = totals.length
    ? `<div class="totals">${totals.map(([k, v], i) => `<div class="row ${i === totals.length - 1 ? 'grand' : ''}"><span>${esc(k)}</span><span>${esc(v)}</span></div>`).join('')}</div>`
    : '';
  const codesHtml = (qrUri || barUri)
    ? `<div class="codes">
        ${qrUri ? `<div><img src="${qrUri}" alt="QR" /><div class="cap">QR</div></div>` : ''}
        ${barUri ? `<div><img src="${barUri}" alt="Barcode" /><div class="cap">Barcode</div></div>` : ''}
       </div>`
    : '';

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${esc(title)} ${esc(number)}</title><style>${PRINT_CSS}</style></head>
<body>
  <div class="viewer-bar">
    <span class="title">${esc(title)} — ${esc(number)}</span>
    <span class="actions">
      <button class="secondary" onclick="window.history.length > 1 ? history.back() : window.close()">← Back</button>
      <button onclick="window.print()">🖨 Print / Save PDF</button>
    </span>
  </div>
  <div class="sheet">
    <div class="doc-header">
      <div class="brand">
        ${logoUrl ? `<img class="doc-logo" src="${esc(logoUrl)}" alt="" />` : ''}
        <h1>${esc(company)}</h1>
      </div>
        <div style="color:#64748b;font-size:13px;">${esc(subtitle)}</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:20px;font-weight:700;color:#16655d;">${esc(title)}</div>
        <div class="number">${esc(number)}</div>
        <div style="margin-top:6px;">${badges}</div>
      </div>
    </div>
    ${metaHtml}
    ${itemsHtml}
    ${totalsHtml}
    ${sigHtml}
    ${codesHtml}
    ${footer ? `<div class="footer">${esc(footer)}</div>` : `<div class="footer">${esc(company)} — Generated ${new Date().toLocaleString('en-GB')}</div>`}
  </div>
</body></html>`;
}

// ── Document builders ─────────────────────────────────────────

async function invoiceHtml(order) {
  const company = companyName();
  const items = (order.items && Array.isArray(order.items) ? order.items : []).map(it => ({
    name: it.name || 'Item',
    qty: it.qty || it.quantity || 1,
    unit: money(it.price || 0),
    amount: money((it.price || 0) * (it.qty || it.quantity || 1)),
  }));
  const number = `INV-${String(order.id).padStart(4, '0')}`;
  const qrUri = await qrDataUri(`INV:${order.id}`);
  const barUri = barcodeDataUri(number);
  return layout({
    title: 'Invoice',
    number,
    subtitle: company,
    logoUrl: siteLogoUrl(),
    meta: [
      ['Order', `#${order.id}`],
      ['Customer', order.customer_name || order.shipping_name || 'Customer'],
      ['Email', order.customer_email || ''],
      ['Date', order.created_at ? new Date(order.created_at).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB')],
      ['Status', order.status || 'paid'],
      ['Payment', order.payment_method || '—'],
    ],
    items,
    totals: [['Subtotal', money(order.subtotal || order.total || 0)], ['Total', money(order.total || 0)]],
    qrUri, barUri,
    company,
    badges: `<span class="badge green">Paid</span>`,
  });
}

async function receiptHtml(order) {
  const company = companyName();
  const items = (order.items && Array.isArray(order.items) ? order.items : []).map(it => ({
    name: it.name || 'Item',
    qty: it.qty || it.quantity || 1,
    unit: money(it.price || 0),
    amount: money((it.price || 0) * (it.qty || it.quantity || 1)),
  }));
  const number = `RCT-${String(order.id).padStart(4, '0')}`;
  const qrUri = await qrDataUri(`RCT:${order.id}`);
  const barUri = barcodeDataUri(number);
  return layout({
    title: 'Customer Receipt',
    number,
    subtitle: company,
    logoUrl: siteLogoUrl(),
    meta: [
      ['Receipt for Order', `#${order.id}`],
      ['Customer', order.customer_name || order.shipping_name || 'Customer'],
      ['Email', order.customer_email || ''],
      ['Date', order.created_at ? new Date(order.created_at).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB')],
      ['Status', order.status || 'paid'],
    ],
    items,
    totals: [['Total Paid', money(order.total || 0)]],
    qrUri, barUri,
    company,
    footer: 'Thank you for your purchase!',
  });
}

async function movementReceiptHtml(movement) {
  const company = companyName();
  const number = `${String(movement.type || 'MOV').toUpperCase()}-${String(movement.id).padStart(4, '0')}`;
  const qrUri = await qrDataUri(`MOV:${movement.id}`);
  const barUri = barcodeDataUri(number);
  return layout({
    title: 'Inventory Receipt',
    number,
    subtitle: company,
    logoUrl: siteLogoUrl(),
    meta: [
      ['Movement #', String(movement.id)],
      ['Type', movement.type],
      ['Product', movement.product_name || `Product #${movement.product_id}`],
      ['Warehouse', movement.warehouse_name || `#${movement.warehouse_id}`],
      ['Location', movement.location_name || '—'],
      ['Reason', movement.reason || '—'],
      ['Reference', movement.reference_type ? `${movement.reference_type} ${movement.reference_id || ''}` : '—'],
      ['Date', movement.created_at ? new Date(movement.created_at).toLocaleString('en-GB') : ''],
      ['By', movement.created_by || '—'],
    ],
    items: [
      { name: movement.product_name || `Product #${movement.product_id}`, qty: movement.qty_change, unit: money(movement.unit_cost || 0), amount: money(Math.abs(movement.unit_cost || 0) * Math.abs(movement.qty_change || 0)) },
    ],
    totals: [
      ['Qty Before', String(movement.qty_before)],
      ['Qty Change', `${movement.qty_change > 0 ? '+' : ''}${movement.qty_change}`],
      ['Qty After', String(movement.qty_after)],
    ],
    qrUri, barUri,
    company,
    footer: movement.note || '',
  });
}

async function supplyOrderHtml(order) {
  const company = companyName();
  const items = (order.items || []).map(it => ({
    name: it.product_name || `Product #${it.product_id}`,
    qty: it.qty,
    unit: money(it.unit_cost || 0),
    amount: money((it.unit_cost || 0) * it.qty),
  }));
  const totalValue = (order.items || []).reduce((s, it) => s + (it.unit_cost || 0) * (it.qty || 0), 0);
  const qrUri = await qrDataUri(`SUP:${order.order_number}`);
  const barUri = barcodeDataUri(order.order_number);
  return layout({
    title: 'Supply Order',
    number: order.order_number,
    subtitle: company,
    logoUrl: siteLogoUrl(),
    meta: [
      ['Supplier', order.supplier_name || '—'],
      ['Status', order.status],
      ['Issued', order.issued_at ? new Date(order.issued_at).toLocaleString('en-GB') : '—'],
      ['Issued by', order.issued_by || '—'],
      ['Lines', String(items.length)],
    ],
    items,
    totals: [
      ['Total Lines', String(items.length)],
      ['Total Cost', money(totalValue)],
    ],
    signatures: ['Delivered by (name & signature)', 'Received by (name & signature)'],
    qrUri, barUri,
    company,
    badges: order.status === 'issued' ? '<span class="badge green">Issued</span>' : '<span class="badge blue">Draft</span>',
  });
}

async function issueOrderHtml(order) {
  const company = companyName();
  const items = (order.items || []).map(it => ({
    name: it.product_name || `Product #${it.product_id}`,
    qty: it.qty,
    unit: money(it.unit_cost || 0),
    amount: money((it.unit_cost || 0) * it.qty),
  }));
  const totalValue = (order.items || []).reduce((s, it) => s + (it.unit_cost || 0) * (it.qty || 0), 0);
  const qrUri = await qrDataUri(`ISS:${order.order_number}`);
  const barUri = barcodeDataUri(order.order_number);
  return layout({
    title: 'Issue Order',
    number: order.order_number,
    subtitle: company,
    logoUrl: siteLogoUrl(),
    meta: [
      ['Customer / Recipient', order.customer_name || '—'],
      ['Status', order.status],
      ['Issued', order.issued_at ? new Date(order.issued_at).toLocaleString('en-GB') : '—'],
      ['Issued by', order.issued_by || '—'],
      ['Lines', String(items.length)],
    ],
    items,
    totals: [
      ['Total Lines', String(items.length)],
      ['Total Value', money(totalValue)],
    ],
    signatures: ['Issued by (name & signature)', 'Received by (name & signature)'],
    qrUri, barUri,
    company,
    badges: order.status === 'issued' ? '<span class="badge green">Issued</span>' : '<span class="badge blue">Draft</span>',
  });
}

async function shippingLabelHtml(order, settings = {}) {
  const company = companyName();
  const courier = String(settings.courier_name || settingsService.get('courier_name', '') || 'Courier');
  const trackingPrefix = String(settings.courier_tracking_prefix || settingsService.get('courier_tracking_prefix', '') || 'CS');
  const tracking = String(settings.tracking_number || '') || `${trackingPrefix}-${String(order.id).padStart(6, '0')}`;
  const qrUri = await qrDataUri(`SHIP:${order.id}:${tracking}`);
  const barUri = barcodeDataUri(tracking);

  const fromHtml = `
    <div class="shipping-box">
      <h3>From</h3>
      <p>${esc(company)}</p>
      <p>${esc(settings.shipping_from_address || settingsService.get('shipping_from_address', '') || 'Store address')}</p>
      <p>${esc(settings.courier_phone || settingsService.get('courier_phone', '') || '')}</p>
    </div>`;
  const toHtml = `
    <div class="shipping-box">
      <h3>To</h3>
      <p><b>${esc(order.shipping_name || order.customer_name || 'Customer')}</b></p>
      <p>${esc(order.shipping_address || '')}</p>
      <p>${esc(order.shipping_city || '')} ${esc(order.shipping_governorate || '')} ${esc(order.shipping_postal_code || '')}</p>
      <p>Phone: ${esc(order.shipping_phone || '')}</p>
    </div>`;

  return layout({
    title: `Shipping Label — ${courier}`,
    number: tracking,
    subtitle: company,
    logoUrl: siteLogoUrl(),
    meta: [
      ['Order', `#${order.id}`],
      ['Tracking', tracking],
      ['Courier', courier],
      ['Payment', order.payment_method || '—'],
    ],
    items: (order.items && Array.isArray(order.items) ? order.items : []).map(it => ({
      name: it.name || 'Item', qty: it.qty || it.quantity || 1, unit: '—', amount: '—',
    })),
    totals: [],
    qrUri, barUri,
    company,
    footer: `${fromHtml}${toHtml}`,
  });
}

/** Picking sheet — printable checklist for the warehouse (mventor-ticket-048) */
async function pickingSheetHtml(order, task = {}) {
  const company = companyName();
  const items = (order.items && Array.isArray(order.items) ? order.items : []).map((it, i) => ({
    name: it.name || 'Item',
    qty: it.qty || it.quantity || 1,
    unit: '—',
    amount: '—',
  }));
  const number = `PICK-${String(order.id).padStart(4, '0')}`;
  const qrUri = await qrDataUri(`PICK:${order.id}`);
  const barUri = barcodeDataUri(number);
  return layout({
    title: 'Picking Sheet',
    number,
    subtitle: company,
    logoUrl: siteLogoUrl(),
    meta: [
      ['Order', `#${order.id}`],
      ['Customer', order.customer_name || order.shipping_name || 'Customer'],
      ['Task', task.id ? `#${task.id}` : '—'],
      ['Date', new Date().toLocaleDateString('en-GB')],
    ],
    items: items.map((it, i) => ({ ...it, name: `${it.name}`, qty: `${it.qty}` })),
    totals: [['Total Lines', String(items.length)]],
    qrUri, barUri,
    company,
    footer: 'Pick all lines, verify quantities, then mark the task as picked.',
  });
}

/** Printable packing sheet: order + customer + items to pack + packaging checklist. */
async function packingSheetHtml(order, task = {}) {
  const company = companyName();
  const items = (order.items && Array.isArray(order.items) ? order.items : []).map((it, i) => ({
    name: it.name || 'Item',
    qty: it.qty || it.quantity || 1,
    unit: '—',
    amount: '—',
  }));
  const number = `PACK-${String(order.id).padStart(4, '0')}`;
  const qrUri = await qrDataUri(`PACK:${order.id}`);
  const barUri = barcodeDataUri(number);
  return layout({
    title: 'Packing Sheet',
    number,
    subtitle: company,
    logoUrl: siteLogoUrl(),
    meta: [
      ['Order', `#${order.id}`],
      ['Customer', order.customer_name || order.shipping_name || 'Customer'],
      ['Ship To', [order.shipping_name, order.shipping_address, order.shipping_city, order.shipping_governorate].filter(Boolean).join(', ') || '—'],
      ['Phone', order.shipping_phone || '—'],
      ['Task', task.id ? `#${task.id}` : '—'],
      ['Date', new Date().toLocaleDateString('en-GB')],
    ],
    items: items.map((it, i) => ({ ...it, name: `${it.name}`, qty: `${it.qty}` })),
    totals: [['Total Lines', String(items.length)]],
    qrUri, barUri,
    company,
    footer: 'Verify every line is packed and undamaged, then mark the task as packed.',
  });
}

async function shippingPolicyHtml(settings = {}) {  const company = companyName();
  const policy = String(settings.shipping_policy || settingsService.get('shipping_policy', '') || 'Shipping policy not configured yet.');
  const courier = String(settings.courier_name || settingsService.get('courier_name', '') || 'Courier');
  const website = String(settings.courier_website || settingsService.get('courier_website', '') || '');
  const qrUri = await qrDataUri(`POLICY:${company}`);
  const barUri = barcodeDataUri(`POLICY-${String(company).slice(0, 8).toUpperCase()}`);

  return layout({
    title: 'Shipping Policy',
    number: `POL-${new Date().toISOString().slice(0, 10)}`,
    subtitle: company,
    logoUrl: siteLogoUrl(),
    meta: [
      ['Courier', courier],
      ['Website', website],
      ['Effective', new Date().toLocaleDateString('en-GB')],
    ],
    items: [],
    totals: [],
    qrUri, barUri,
    company,
    footer: policy,
  });
}

/** Email-ready receipt HTML (inline styles for clients) */
async function receiptEmailHtml(order, customerEmail) {
  const company = companyName();
  const qrUri = await qrDataUri(`RCT:${order.id}`);
  const barUri = barcodeDataUri(`RCT-${String(order.id).padStart(6, '0')}`);
  const items = (order.items && Array.isArray(order.items) ? order.items : []).map(it => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eee;">${esc(it.name || 'Item')}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${it.qty || it.quantity || 1}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${money(it.price || 0)}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#f6f6f6;margin:0;padding:20px;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;border:1px solid #e2e8f0;">
    <div style="background:#1f857a;padding:20px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:22px;">${esc(company)} — Receipt</h1>
      <div style="color:#bfdbfe;font-size:13px;margin-top:4px;">Receipt for Order #${order.id}</div>
    </div>
    <div style="padding:24px;">
      <p style="color:#333;">Hi ${esc(order.customer_name || order.shipping_name || 'there')},</p>
      <p style="color:#555;margin:0 0 16px;">Thank you for your purchase! Here is your receipt:</p>
      <table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:13px;">
        <tr><td style="padding:4px 0;color:#666;">Receipt No.</td><td style="text-align:right;font-weight:bold;">RCT-${String(order.id).padStart(4, '0')}</td></tr>
        <tr><td style="padding:4px 0;color:#666;">Date</td><td style="text-align:right;">${new Date(order.created_at || Date.now()).toLocaleDateString('en-GB')}</td></tr>
        <tr><td style="padding:4px 0;color:#666;">Status</td><td style="text-align:right;color:#15803d;font-weight:bold;">Paid</td></tr>
      </table>
      <table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:13px;">
        <thead><tr style="background:#f8fafc;">
          <th style="padding:8px;text-align:left;color:#666;">Item</th>
          <th style="padding:8px;text-align:center;color:#666;">Qty</th>
          <th style="padding:8px;text-align:right;color:#666;">Price</th>
        </tr></thead>
        <tbody>${items}</tbody>
      </table>
      <div style="border-top:2px solid #1f857a;padding:12px 0;text-align:right;font-size:18px;font-weight:bold;color:#16655d;">
        Total: ${money(order.total || 0)}
      </div>
      <div style="text-align:center;margin:20px 0;">
        ${qrUri ? `<img src="${qrUri}" alt="QR" style="width:96px;height:96px;border:1px solid #e2e8f0;padding:4px;" />` : ''}
        ${barUri ? `<img src="${barUri}" alt="Barcode" style="width:96px;height:56px;border:1px solid #e2e8f0;padding:4px;margin-left:12px;" />` : ''}
      </div>
      <p style="color:#555;text-align:center;font-size:12px;">Questions? Reply to this email — we're happy to help.</p>
    </div>
  </div>
</body></html>`;
}

/** Extract just the sheet markup (for embedding in the Drive-style viewer) */
function extractSheet(html) {
  const m = String(html || '').match(/<div class="sheet">([\s\S]*?)<\/div>\s*<\/body>/);
  return m ? m[1] : String(html || '');
}

/**
 * QR code as JPEG buffer (for PdfWriter DCTDecode embedding).
 * Uses sharp (already a dependency) to convert the PNG.
 */
async function qrJpegBuffer(text, width = 240) {
  const png = await QRCode.toBuffer(String(text), { margin: 2, width });
  const sharp = require('sharp');
  return sharp(png).jpeg({ quality: 92 }).toBuffer();
}

/**
 * VIP customer invitation PDF � printable card with a QR that opens the
 * registration page (customer_site_url + ?invite=CODE). The invite code is
 * pre-registered so scanning enrolls the customer.
 */
async function vipInvitationPdf({ code, link, siteName }) {
  const qrUri = await qrDataUri(link);
  const html = layout({
    title: 'VIP Invitation',
    number: `INV-${code}`,
    subtitle: `${siteName} � exclusive customer access`,
    meta: [
      ['Invite Code', code],
      ['Scan or visit', link],
    ],
    items: [],
    totals: [],
    footer: 'Show this card at checkout or scan to register your account.',
    qrUri,
    company: siteName,
  });

  // Render via headless print pipeline: reuse report PDF writer with QR image
  const { PdfWriter } = require('../utils/pdfWriter');
  const pdf = new PdfWriter();
  pdf.title(`${siteName}`);
  pdf.subtitle('VIP Customer Invitation');
  pdf.text(`Invite code: ${code}`, 12, true);
  pdf.blank(1);
  pdf.text(`Scan the QR or visit: ${link}`, 10);
  pdf.blank(1);
  pdf.text('This invitation adds you to our customers list with exclusive benefits.', 9);
  const jpeg = await qrJpegBuffer(link, 320);
  pdf.imageJPEG(jpeg, 48, 200, 180, 180);
  pdf.setFooter(`${siteName} � VIP invitation ${code}`);
  return pdf.render();
}
/**
 * Movement receipt as a real PDF (invoice-style, QR links to
 * {customer_site_url}/movement/{id}).
 */
async function movementReceiptPdf(movement, opts = {}) {
  const settingsService = require('./settingsService');
  const m = movement;
  const sign = m.qty_change > 0 ? '+' : '';
  const customerUrl = String(settingsService.get('customer_site_url', '') || '').replace(/\/+$/, '');
  const link = customerUrl ? `${customerUrl}/movement/${m.id}` : `MOV:${m.id}
  /* ── quality pass additions ── */
  .doc-header { display:flex; justify-content:space-between; align-items:center; gap:16px;
                border-bottom:3px solid #1f857a; padding-bottom:14px; margin-bottom:18px; }
  .brand { display:flex; align-items:center; gap:12px; }
  .brand img.doc-logo { max-height:56px; max-width:170px; object-fit:contain; }
  .brand h1 { margin:0; font-size:22px; letter-spacing:.3px; color:#0f172a; }
  table.items td.num, table.items th.num { text-align:right; font-variant-numeric: tabular-nums; }
  table.items tbody tr:hover td { background:#f0fdfa; }
  .signatures { display:flex; gap:48px; margin-top:36px; }
  .signatures .sig { flex:1; }
  .signatures .line { border-bottom:1.5px solid #334155; height:44px; }
  .signatures .cap { font-size:11px; color:#64748b; margin-top:5px; text-transform:uppercase; letter-spacing:.5px; }
`;

  const jpeg = await qrJpegBuffer(link, 300);

  const { PdfWriter } = require('../utils/pdfWriter');
  const pdf = new PdfWriter();
  pdf.title(companyName());
  pdf.subtitle(`Stock Movement Receipt � MOV-${m.id}`);
  pdf.text(`Type: ${String(m.type).toUpperCase()}`, 11, true);
  pdf.text(`Quantity: ${sign}${m.qty_change}`, 10);
  pdf.text(`Stock: ${m.qty_before} -> ${m.qty_after}`, 10);
  pdf.text(`Reason: ${m.reason || '-'}`, 10);
  pdf.text(`Date: ${m.created_at}`, 10);
  pdf.text(`By: ${m.created_by || 'system'}`, 10);
  pdf.blank(1);
  pdf.imageJPEG(jpeg, MARGIN, Math.max(pdf.y - 190, 60), 180, 180);
  pdf.setFooter(`${companyName()} � MOV-${m.id} � scan QR to verify`);
  return pdf.render();
}
module.exports = {
  invoiceHtml,
  receiptHtml,
  movementReceiptHtml,
  supplyOrderHtml,
  issueOrderHtml,
  shippingLabelHtml,
  shippingPolicyHtml,
  pickingSheetHtml,
  packingSheetHtml,
  receiptEmailHtml,
  extractSheet,
};
