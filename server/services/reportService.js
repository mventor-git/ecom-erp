const db = require('../db');

const REPORT_TYPES = {
  inventory_value: { label: 'Inventory Value', description: 'qty_on_hand x cost_price per product/category' },
  stock_aging: { label: 'Stock Aging', description: 'How long items have been sitting based on movement dates' },
  dead_stock: { label: 'Dead Stock', description: 'Products with zero sales in 90 days' },
  low_stock: { label: 'Low Stock', description: 'Products below reorder point' },
  out_of_stock: { label: 'Out of Stock', description: 'Products with zero availability' },
  abc_analysis: { label: 'ABC Analysis', description: '80/20: which products drive revenue' },
  turnover_rate: { label: 'Turnover Rate', description: 'COGS / avg_inventory' },
  sales_report: { label: 'Sales Report', description: 'Revenue by product/category/time' },
  supplier_performance: { label: 'Supplier Performance', description: 'On-time delivery % and lead time' },
  stockout_frequency: { label: 'Stockout Frequency', description: 'How often products hit zero' },
  // mventor-ticket-051: profit analytics (negative profit is a valid business result)
  profit_report: { label: 'Profit Report', description: 'Revenue, cost and gross profit per product (negative = sold below cost)' },
  offer_losses: { label: 'Offer Losses', description: 'Products sold below cost (offer/price below purchase cost)' },
  net_profit: { label: 'Net Profit', description: 'Revenue - cost with offer losses breakdown' },
};

function _buildFilterWhere(filters) {
  let where = '';
  const params = [];

  if (filters.date_from) {
    where += ' AND created_at >= ?';
    params.push(filters.date_from);
  }
  if (filters.date_to) {
    where += ' AND created_at <= ?';
    params.push(filters.date_to);
  }
  if (filters.warehouse_id) {
    where += ' AND warehouse_id = ?';
    params.push(parseInt(filters.warehouse_id));
  }
  if (filters.product_id) {
    where += ' AND product_id = ?';
    params.push(parseInt(filters.product_id));
  }

  return { where, params };
}

function _buildProductFilterWhere(filters) {
  // Exclude trashed products from all operational/stock reports (mventor-ticket-045)
  let where = ' AND p.deleted_at IS NULL';
  const params = [];

  if (filters.category_id) {
    where += ' AND p.category_id = ?';
    params.push(parseInt(filters.category_id));
  }
  if (filters.product_id) {
    where += ' AND p.id = ?';
    params.push(parseInt(filters.product_id));
  }
  if (filters.warehouse_id) {
    where += ' AND i.warehouse_id = ?';
    params.push(parseInt(filters.warehouse_id));
  }

  return { where, params };
}

function generateInventoryValue(filters = {}) {
  const { where, params } = _buildProductFilterWhere(filters);

  return db.prepare(`
    SELECT
      p.id AS product_id,
      p.name AS product_name,
      p.sku,
      p.cost_price,
      c.name AS category_name,
      COALESCE(SUM(i.qty_on_hand), 0) AS total_qty,
      COALESCE(SUM(i.qty_on_hand), 0) * COALESCE(p.cost_price, 0) AS total_value
    FROM products p
    LEFT JOIN inventory i ON i.product_id = p.id
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE 1=1 ${where}
    GROUP BY p.id
    ORDER BY total_value DESC
  `).all(...params);
}

function generateStockAging(filters = {}) {
  const { where, params } = _buildProductFilterWhere(filters);

  const dateFrom = filters.date_from || '1970-01-01';
  const dateTo = filters.date_to || '9999-12-31';

  return db.prepare(`
    SELECT
      p.id AS product_id,
      p.name AS product_name,
      p.sku,
      i.warehouse_id,
      w.name AS warehouse_name,
      i.qty_on_hand,
      MAX(m.created_at) AS last_movement_date,
      CAST(julianday('now') - julianday(MAX(m.created_at)) AS INTEGER) AS days_since_movement
    FROM products p
    JOIN inventory i ON i.product_id = p.id
    JOIN warehouses w ON w.id = i.warehouse_id
    LEFT JOIN inventory_movements m ON m.product_id = p.id AND m.warehouse_id = i.warehouse_id
    WHERE 1=1 ${where}
      AND i.qty_on_hand > 0
    GROUP BY p.id, i.warehouse_id
    ORDER BY days_since_movement DESC
  `).all(...params);
}

function generateDeadStock(filters = {}) {
  const cutoff = filters.date_from || new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0];

  let productWhere = '';
  const productParams = [];

  if (filters.category_id) {
    productWhere += ' AND p.category_id = ?';
    productParams.push(parseInt(filters.category_id));
  }
  if (filters.product_id) {
    productWhere += ' AND p.id = ?';
    productParams.push(parseInt(filters.product_id));
  }

  let invWhere = '';
  const invParams = [];
  if (filters.warehouse_id) {
    invWhere = 'AND warehouse_id = ?';
    invParams.push(parseInt(filters.warehouse_id));
  }

  return db.prepare(`
    SELECT
      p.id AS product_id,
      p.name AS product_name,
      p.sku,
      c.name AS category_name,
      COALESCE(inv.total_qty, 0) AS qty_on_hand,
      p.cost_price,
      COALESCE(inv.total_qty, 0) * COALESCE(p.cost_price, 0) AS tied_up_value
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    LEFT JOIN (
      SELECT product_id, SUM(qty_on_hand) AS total_qty
      FROM inventory
      WHERE 1=1 ${invWhere}
      GROUP BY product_id
    ) inv ON inv.product_id = p.id
    WHERE p.id NOT IN (
      SELECT DISTINCT product_id
      FROM inventory_movements
      WHERE type = 'issue'
        AND created_at >= ?
    )
    ${productWhere}
    ORDER BY tied_up_value DESC
  `).all(...invParams, cutoff, ...productParams);
}

function generateLowStock(filters = {}) {
  const { where, params } = _buildProductFilterWhere(filters);

  return db.prepare(`
    SELECT
      p.id AS product_id,
      p.name AS product_name,
      p.sku,
      c.name AS category_name,
      i.warehouse_id,
      w.name AS warehouse_name,
      i.qty_on_hand,
      p.reorder_point,
      p.min_stock,
      (p.reorder_point - i.qty_on_hand) AS deficit
    FROM products p
    JOIN inventory i ON i.product_id = p.id
    JOIN warehouses w ON w.id = i.warehouse_id
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE i.qty_on_hand <= p.reorder_point
      AND p.reorder_point > 0
      ${where}
    ORDER BY deficit DESC
  `).all(...params);
}

function generateOutOfStock(filters = {}) {
  const { where, params } = _buildProductFilterWhere(filters);

  return db.prepare(`
    SELECT
      p.id AS product_id,
      p.name AS product_name,
      p.sku,
      c.name AS category_name,
      i.warehouse_id,
      w.name AS warehouse_name,
      i.qty_on_hand,
      i.qty_reserved
    FROM products p
    JOIN inventory i ON i.product_id = p.id
    JOIN warehouses w ON w.id = i.warehouse_id
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE i.qty_on_hand <= 0
      ${where}
    ORDER BY p.name ASC
  `).all(...params);
}

function generateAbcAnalysis(filters = {}) {
  const { where: orderWhere, params: orderParams } = _buildFilterWhere(filters);

  const productRevenue = db.prepare(`
    SELECT
      product_id,
      SUM(unit_cost) AS total_revenue
    FROM inventory_movements
    WHERE type = 'issue' ${orderWhere}
    GROUP BY product_id
    ORDER BY total_revenue DESC
  `).all(...orderParams);

  const grandTotal = productRevenue.reduce((sum, r) => sum + r.total_revenue, 0);

  let cumulative = 0;
  const classified = productRevenue.map((row, idx) => {
    cumulative += row.total_revenue;
    const pct = grandTotal > 0 ? (row.total_revenue / grandTotal) * 100 : 0;
    const cumPct = grandTotal > 0 ? (cumulative / grandTotal) * 100 : 0;

    let classification;
    if (cumPct <= 80) classification = 'A';
    else if (cumPct <= 95) classification = 'B';
    else classification = 'C';

    const product = db.prepare('SELECT name, sku, category_id FROM products WHERE id = ?').get(row.product_id);

    return {
      rank: idx + 1,
      product_id: row.product_id,
      product_name: product ? product.name : '',
      sku: product ? product.sku : '',
      total_revenue: row.total_revenue,
      revenue_pct: Math.round(pct * 100) / 100,
      cumulative_pct: Math.round(cumPct * 100) / 100,
      classification,
    };
  });

  return { grand_total: grandTotal, items: classified };
}

function generateTurnoverRate(filters = {}) {
  const dateFrom = filters.date_from || '1970-01-01';
  const dateTo = filters.date_to || '9999-12-31';

  // Exclude trashed products from turnover analysis (mventor-ticket-045)
  let productWhere = ' AND p.deleted_at IS NULL';
  const productParams = [];

  if (filters.category_id) {
    productWhere += ' AND p.category_id = ?';
    productParams.push(parseInt(filters.category_id));
  }
  if (filters.product_id) {
    productWhere += ' AND p.id = ?';
    productParams.push(parseInt(filters.product_id));
  }

  let invWhere = '';
  const invParams = [];
  if (filters.warehouse_id) {
    invWhere = 'AND warehouse_id = ?';
    invParams.push(parseInt(filters.warehouse_id));
  }

  return db.prepare(`
    SELECT
      p.id AS product_id,
      p.name AS product_name,
      p.sku,
      c.name AS category_name,
      COALESCE(cogs.total_cogs, 0) AS total_cogs,
      COALESCE(avg_inv.avg_qty, 0) AS avg_inventory,
      CASE
        WHEN COALESCE(avg_inv.avg_qty, 0) > 0
        THEN ROUND(CAST(COALESCE(cogs.total_cogs, 0) AS REAL) / avg_inv.avg_qty, 2)
        ELSE 0
      END AS turnover_rate
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    LEFT JOIN (
      SELECT product_id, SUM(unit_cost) AS total_cogs
      FROM inventory_movements
      WHERE type = 'issue'
        AND created_at >= ?
        AND created_at <= ?
      GROUP BY product_id
    ) cogs ON cogs.product_id = p.id
    LEFT JOIN (
      SELECT product_id, AVG(qty_on_hand) AS avg_qty
      FROM inventory
      WHERE 1=1 ${invWhere}
      GROUP BY product_id
    ) avg_inv ON avg_inv.product_id = p.id
    WHERE 1=1 ${productWhere}
    ORDER BY turnover_rate DESC
  `).all(dateFrom, dateTo, ...invParams, ...productParams);
}

function generateSalesReport(filters = {}) {
  const { where, params } = _buildFilterWhere(filters);

  return db.prepare(`
    SELECT
      p.id AS product_id,
      p.name AS product_name,
      p.sku,
      c.name AS category_name,
      COUNT(m.id) AS total_units_sold,
      SUM(m.unit_cost) AS total_revenue,
      MIN(m.created_at) AS first_sale,
      MAX(m.created_at) AS last_sale
    FROM inventory_movements m
    JOIN products p ON p.id = m.product_id
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE m.type = 'issue' ${where}
    GROUP BY p.id
    ORDER BY total_revenue DESC
  `).all(...params);
}

function generateSupplierPerformance(filters = {}) {
  let where = '';
  const params = [];

  if (filters.date_from) {
    where += ' AND po.ordered_at >= ?';
    params.push(filters.date_from);
  }
  if (filters.date_to) {
    where += ' AND po.ordered_at <= ?';
    params.push(filters.date_to);
  }

  return db.prepare(`
    SELECT
      s.id AS supplier_id,
      s.name AS supplier_name,
      s.lead_time_days AS quoted_lead_time,
      COUNT(po.id) AS total_pos,
      SUM(CASE WHEN po.received_at IS NOT NULL AND po.received_at <= po.expected_at THEN 1 ELSE 0 END) AS on_time_count,
      CASE
        WHEN COUNT(po.id) > 0
        THEN ROUND(
          CAST(SUM(CASE WHEN po.received_at IS NOT NULL AND po.received_at <= po.expected_at THEN 1 ELSE 0 END) AS REAL)
          / COUNT(po.id) * 100, 1
        )
        ELSE 0
      END AS on_time_pct,
      AVG(CASE
        WHEN po.received_at IS NOT NULL AND po.ordered_at IS NOT NULL
        THEN CAST(julianday(po.received_at) - julianday(po.ordered_at) AS REAL)
        ELSE NULL
      END) AS avg_actual_lead_time
    FROM suppliers s
    LEFT JOIN purchase_orders po ON po.supplier_id = s.id
    WHERE 1=1 ${where}
    GROUP BY s.id
    ORDER BY on_time_pct DESC
  `).all(...params);
}

function generateStockoutFrequency(filters = {}) {
  const { where, params } = _buildProductFilterWhere(filters);

  const dateFrom = filters.date_from || '1970-01-01';
  const dateTo = filters.date_to || '9999-12-31';

  return db.prepare(`
    SELECT
      p.id AS product_id,
      p.name AS product_name,
      p.sku,
      c.name AS category_name,
      COUNT(m.id) AS stockout_count,
      MIN(m.created_at) AS first_stockout,
      MAX(m.created_at) AS last_stockout
    FROM products p
    JOIN inventory_movements m ON m.product_id = p.id
      AND m.qty_after <= 0
      AND m.type IN ('issue', 'damage', 'reservation')
      AND m.created_at >= ?
      AND m.created_at <= ?
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE 1=1 ${where}
    GROUP BY p.id
    ORDER BY stockout_count DESC
  `).all(dateFrom, dateTo, ...params);
}

const GENERATORS = {
  inventory_value: generateInventoryValue,
  stock_aging: generateStockAging,
  dead_stock: generateDeadStock,
  low_stock: generateLowStock,
  out_of_stock: generateOutOfStock,
  abc_analysis: generateAbcAnalysis,
  turnover_rate: generateTurnoverRate,
  sales_report: generateSalesReport,
  supplier_performance: generateSupplierPerformance,
  stockout_frequency: generateStockoutFrequency,
  profit_report: generateProfitReport,
  offer_losses: generateOfferLosses,
  net_profit: generateNetProfit,
};

// ═══════════════════════════════════════════════════════════════
// PROFIT ANALYTICS (mventor-ticket-051)
// Negative profit is a VALID business result (offer below purchase cost).
// ═══════════════════════════════════════════════════════════════

const PAID_STATUSES = "('paid', 'delivered', 'completed')";

function _profitFilters(filters = {}) {
  const where = [];
  const params = [];
  if (filters.date_from) { where.push('o.created_at >= ?'); params.push(filters.date_from); }
  if (filters.date_to) { where.push('o.created_at <= ?'); params.push(filters.date_to); }
  if (filters.price_list_code) { where.push('o.price_list_code = ?'); params.push(filters.price_list_code); }
  return { where, params };
}

/** Flatten paid order items into sale lines with cost + profit */
function _saleLines(filters = {}) {
  const { where, params } = _profitFilters(filters);
  const orders = db.prepare(`
    SELECT o.id, o.total, o.items, o.price_list_code, o.created_at
    FROM orders o
    WHERE o.status IN ${PAID_STATUSES}
    ${where.length ? 'AND ' + where.join(' AND ') : ''}
    ORDER BY o.created_at DESC
  `).all(...params);

  const lines = [];
  orders.forEach(order => {
    let items = [];
    try { items = JSON.parse(order.items || '[]'); } catch { items = []; }
    items.forEach(it => {
      const pid = it.id || it.product_id;
      const product = pid ? db.prepare('SELECT id, name, cost_price, old_price, price FROM products WHERE id = ?').get(pid) : null;
      const qty = it.qty || it.quantity || 1;
      const unitPrice = Number(it.price) || 0;             // price actually paid (snapshot)
      const unitCost = Number(product ? product.cost_price : 0);
      const revenue = unitPrice * qty;
      const costTotal = unitCost * qty;
      lines.push({
        order_id: order.id,
        order_date: order.created_at,
        product_id: pid || null,
        product_name: (product && product.name) || it.name || 'Unknown',
        qty_sold: qty,
        unit_price: unitPrice,
        unit_cost: unitCost,
        revenue: Math.round(revenue),
        cost_total: Math.round(costTotal),
        gross_profit: Math.round(revenue - costTotal),     // negative = sold below cost
        price_list_code: order.price_list_code || 'retail',
        was_discounted: !!(product && product.old_price && product.old_price > product.price),
      });
    });
  });
  return lines;
}

function generateProfitReport(filters = {}) {
  const lines = _saleLines(filters);
  const byProduct = {};
  lines.forEach(l => {
    const key = l.product_id || l.product_name;
    if (!byProduct[key]) {
      byProduct[key] = { product_id: l.product_id, product_name: l.product_name, qty_sold: 0, revenue: 0, cost_total: 0, gross_profit: 0, lines: 0 };
    }
    byProduct[key].qty_sold += l.qty_sold;
    byProduct[key].revenue += l.revenue;
    byProduct[key].cost_total += l.cost_total;
    byProduct[key].gross_profit += l.gross_profit;
    byProduct[key].lines += 1;
  });
  return Object.values(byProduct).sort((a, b) => b.gross_profit - a.gross_profit);
}

function generateOfferLosses(filters = {}) {
  const lines = _saleLines(filters);
  const losses = lines
    .filter(l => l.gross_profit < 0) // sold below cost — a real business scenario
    .map(l => ({ ...l, loss_amount: -l.gross_profit }));
  return losses.sort((a, b) => b.loss_amount - a.loss_amount);
}

function generateNetProfit(filters = {}) {
  const lines = _saleLines(filters);
  const revenue = lines.reduce((s, l) => s + l.revenue, 0);
  const cost = lines.reduce((s, l) => s + l.cost_total, 0);
  const grossProfit = revenue - cost;
  const offerLosses = lines.filter(l => l.gross_profit < 0).reduce((s, l) => s + Math.abs(l.gross_profit), 0);
  const margin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
  return [{
    revenue: Math.round(revenue),
    cost_total: Math.round(cost),
    gross_profit: Math.round(grossProfit),          // negative = valid
    offer_losses: Math.round(offerLosses),
    net_profit: Math.round(grossProfit),            // net = revenue - cost in this model
    margin_percent: Math.round(margin * 100) / 100,
    orders_count: new Set(lines.map(l => l.order_id)).size,
    lines_sold: lines.length,
  }];
}

function generate(reportType, filters = {}) {
  const fn = GENERATORS[reportType];
  if (!fn) {
    throw new Error(`Unknown report type: ${reportType}`);
  }
  return fn(filters);
}

function _toCsv(rows) {
  if (!rows || rows.length === 0) return '';

  const data = Array.isArray(rows) && rows[0] && rows[0].items ? rows[0].items : rows;
  if (!data || data.length === 0) return '';

  const headers = Object.keys(data[0]);
  const lines = [headers.join(',')];

  data.forEach(row => {
    const values = headers.map(h => {
      const val = row[h];
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    });
    lines.push(values.join(','));
  });

  return lines.join('\n');
}

function exportCsv(reportType, filters = {}) {
  const data = generate(reportType, filters);
  const rows = data && data.items ? [data] : data;
  return _toCsv(Array.isArray(rows) ? rows : [rows]);
}

// ═══════════════════════════════════════════════════════════════
// PDF + Markdown export and scheduled report generation
// ═══════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const settingsService = require('./settingsService');
const { PdfWriter } = require('../utils/pdfWriter');

const REPORTS_DIR = path.join(__dirname, '..', 'data', 'reports');

function _rowsFor(reportType, filters) {
  const data = generate(reportType, filters);
  if (Array.isArray(data) && data[0] && data[0].items) {
    return { meta: data[0], rows: data[0].items };
  }
  return { meta: null, rows: Array.isArray(data) ? data : [] };
}

function _moneyLike(key) {
  return /(price|cost|value|revenue|amount|total|avg)/i.test(key) && key !== 'total_qty';
}

/** Export a report as a branded PDF file */
function exportPdf(reportType, filters = {}) {
  const meta = REPORT_TYPES[reportType];
  if (!meta) throw new Error(`Unknown report type: ${reportType}`);

  const { rows } = _rowsFor(reportType, filters);
  const company = String(settingsService.get('doc_company_name', '') || settingsService.siteIdentity().name);
  const currency = String(settingsService.get('currency', 'EGP') || 'EGP');

  const pdf = new PdfWriter();
  pdf.title(company);
  pdf.subtitle(`${meta.label} — ${new Date().toLocaleString('en-GB')}`);
  pdf.setFooter(`${company} · ${meta.label} · ${reportType}`);

  if (!rows || rows.length === 0) {
    pdf.text('No data for this report period.');
  } else {
    const headers = Object.keys(rows[0]);
    const tableRows = rows.map(row => headers.map(h => {
      let v = row[h];
      if (typeof v === 'number') {
        if (_moneyLike(h)) v = `${(v / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })} ${currency}`;
        else v = v.toLocaleString('en-US');
      }
      return v;
    }));
    pdf.table(headers.map(h => h.replace(/_/g, ' ')), tableRows, { fontSize: 7 });
  }

  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const filename = `${reportType}_${new Date().toISOString().slice(0, 10)}_${Date.now()}.pdf`;
  const filePath = path.join(REPORTS_DIR, filename);
  fs.writeFileSync(filePath, pdf.render());

  return { filename, path: filePath, type: reportType, label: meta.label };
}

/** Export a report as Markdown (embeds QR of the report run) */
async function exportMarkdown(reportType, filters = {}) {
  const meta = REPORT_TYPES[reportType];
  if (!meta) throw new Error(`Unknown report type: ${reportType}`);

  const { rows } = _rowsFor(reportType, filters);
  const company = String(settingsService.get('doc_company_name', '') || settingsService.siteIdentity().name);
  const currency = String(settingsService.get('currency', 'EGP') || 'EGP');
  const documentService = require('./documentService');

  const items = (rows || []).map((row, i) => {
    const first = Object.values(row)[0];
    return {
      name: String(first || `Row ${i + 1}`),
      qty: Object.entries(row).filter(([k]) => /qty|count|stock/i.test(k)).map(([, v]) => v).join(', ') || '—',
      price: 0,
      amount: 0,
      extra: '',
    };
  });

  const fsExtra = require('fs');
  fs.mkdirSync(REPORTS_DIR, { recursive: true });

  const doc = await documentService.buildMarkdownDocument({
    type: 'RPT',
    title: `${meta.label} — Report`,
    number: `${reportType.toUpperCase()}-${new Date().toISOString().slice(0, 10)}`,
    subtitle: `Generated ${new Date().toLocaleString('en-GB')}`,
    meta: [['Report', meta.label], ['Rows', String((rows || []).length)], ['Currency', currency]],
    items: [],
    totals: [['Rows', String((rows || []).length)]],
    qrData: `RPT:${reportType}:${Date.now()}`,
    barcode: `${reportType.toUpperCase()}-${Date.now().toString().slice(-8)}`,
  });

  // Append the full data table (raw markdown table with all columns)
  if (rows && rows.length > 0) {
    const headers = Object.keys(rows[0]);
    let md = '\n## Data\n\n| ' + headers.map(h => h.replace(/_/g, ' ')).join(' | ') + ' |\n';
    md += '|' + headers.map(() => '---').join('|') + '|\n';
    rows.slice(0, 200).forEach(row => {
      md += '| ' + headers.map(h => {
        let v = row[h];
        if (typeof v === 'number') {
          if (_moneyLike(h)) v = `${(v / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })} ${currency}`;
          else v = v.toLocaleString('en-US');
        }
        return String(v).replace(/\|/g, '\\|');
      }).join(' | ') + ' |\n';
    });
    fsExtra.appendFileSync(doc.path, md + '\n');
  }

  return { ...doc, type: reportType, label: meta.label };
}

function listReportFiles() {
  if (!fs.existsSync(REPORTS_DIR)) return [];
  return fs.readdirSync(REPORTS_DIR)
    .filter(f => f.endsWith('.pdf') || f.endsWith('.md'))
    .map(f => {
      const st = fs.statSync(path.join(REPORTS_DIR, f));
      return { filename: f, size: st.size, created: st.mtime.toISOString() };
    })
    .sort((a, b) => b.created.localeCompare(a.created));
}

/** Check if a scheduled run is due and generate the configured reports */
function generateScheduledReports() {
  const frequency = String(settingsService.get('report_frequency', 'off') || 'off');
  if (frequency === 'off') return { ran: false, reason: 'off' };

  const lastRun = String(settingsService.get('report_last_run', '') || '');
  const now = Date.now();
  const lastMs = lastRun ? new Date(lastRun).getTime() : 0;

  const dueMs = {
    daily: 24 * 60 * 60 * 1000,
    weekly: 7 * 24 * 60 * 60 * 1000,
    monthly: 30 * 24 * 60 * 60 * 1000,
  }[frequency];

  if (!dueMs || (lastMs && now - lastMs < dueMs)) {
    return { ran: false, reason: 'not_due' };
  }

  const types = settingsService.get('report_types', ['inventory_value', 'low_stock', 'out_of_stock']);
  const generated = (Array.isArray(types) ? types : []).map(type => {
    try { return exportPdf(type, {}); } catch (e) { return { error: type + ': ' + e.message }; }
  });

  settingsService.set('report_last_run', new Date().toISOString(), 'scheduler');

  // notify users with reports.view permission
  const recipients = new Set();
  require('./permissionService').usersWithPermission('reports.view').forEach(uid => recipients.add(uid));
  const notificationService = require('./notificationService');
  recipients.forEach(uid => {
    notificationService.sendInApp(uid, 'Scheduled Reports Ready', `${generated.length} report(s) generated (${frequency})`, '/erp/reports').catch(() => {});
  });

  return { ran: true, frequency, generated };
}

module.exports = {
  REPORT_TYPES,
  generate,
  export: exportCsv,
  exportPdf,
  exportMarkdown,
  listReportFiles,
  generateScheduledReports,
  generateProfitReport,
  generateOfferLosses,
  generateNetProfit,
  REPORTS_DIR,
};
