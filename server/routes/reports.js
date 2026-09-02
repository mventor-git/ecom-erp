const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const db = require('../db');
const adminAuth = require('../middleware/adminAuth');
const { requirePermission } = require('../middleware/rbac');
const reportService = require('../services/reportService');

function parseFilters(req) {
  return {
    date_from: req.query.date_from,
    date_to: req.query.date_to,
    category_id: req.query.category_id ? parseInt(req.query.category_id) : undefined,
    warehouse_id: req.query.warehouse_id ? parseInt(req.query.warehouse_id) : undefined,
    product_id: req.query.product_id ? parseInt(req.query.product_id) : undefined,
  };
}

router.get('/', adminAuth, (req, res) => {
  try {
    const types = Object.entries(reportService.REPORT_TYPES).map(([key, meta]) => ({
      type: key,
      label: meta.label,
      description: meta.description,
    }));
    res.json(types);
  } catch (err) {
    console.error('Error listing report types:', err);
    res.status(500).json({ error: 'Failed to list report types' });
  }
});

// GET /api/admin/reports/sales-daily?days=14 — daily revenue/orders series
// for dashboard charts. Registered BEFORE /:reportType on purpose.
router.get('/sales-daily', adminAuth, requirePermission('reports.read'), (req, res) => {
  try {
    const days = Math.min(Math.max(parseInt(req.query.days) || 14, 1), 90);
    const rows = db.prepare(`
      SELECT date(created_at) as day,
             COALESCE(SUM(CASE WHEN status != 'cancelled' THEN total ELSE 0 END), 0) as revenue,
             COUNT(*) as orders
      FROM orders
      WHERE created_at >= date('now', ?)
      GROUP BY date(created_at)
      ORDER BY day ASC
    `).all(`-${days} days`);

    // Fill missing days with zeros so the chart shows a continuous timeline
    const map = new Map(rows.map(r => [r.day, r]));
    const series = [];
    const fmt = d => d.toISOString().slice(0, 10);
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = fmt(d);
      const r = map.get(key);
      series.push({ day: key, revenue: r ? r.revenue : 0, orders: r ? r.orders : 0 });
    }

    res.json({ days, series });
  } catch (err) {
    console.error('Error building sales-daily series:', err);
    res.status(500).json({ error: 'Failed to build sales series' });
  }
});

// GET /api/admin/reports/files — generated report files (PDF/MD)
// NOTE: registered BEFORE /:reportType so 'files' isn't treated as a report type
router.get('/files', adminAuth, requirePermission('reports.read'), (req, res) => {
  try {
    res.json(reportService.listReportFiles());
  } catch (err) {
    res.status(500).json({ error: 'Failed to list report files' });
  }
});

// GET /api/admin/reports/files/:filename — download a generated report file
router.get('/files/:filename', adminAuth, requirePermission('reports.read'), (req, res) => {
  try {
    const file = path.join(reportService.REPORTS_DIR, path.basename(req.params.filename));
    if (!fs.existsSync(file)) return res.status(404).json({ error: 'Report file not found' });
    res.download(file);
  } catch (err) {
    res.status(500).json({ error: 'Failed to download report file' });
  }
});

router.get('/:reportType', adminAuth, (req, res) => {
  try {
    const { reportType } = req.params;

    if (!reportService.REPORT_TYPES[reportType]) {
      return res.status(400).json({
        error: `Unknown report type: ${reportType}`,
        available: Object.keys(reportService.REPORT_TYPES),
      });
    }

    const filters = {
      date_from: req.query.date_from,
      date_to: req.query.date_to,
      category_id: req.query.category_id ? parseInt(req.query.category_id) : undefined,
      warehouse_id: req.query.warehouse_id ? parseInt(req.query.warehouse_id) : undefined,
      product_id: req.query.product_id ? parseInt(req.query.product_id) : undefined,
    };

    const data = reportService.generate(reportType, filters);
    res.json({
      report_type: reportType,
      label: reportService.REPORT_TYPES[reportType].label,
      generated_at: new Date().toISOString(),
      filters,
      data,
    });
  } catch (err) {
    console.error('Error generating report:', err);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

router.get('/:reportType/export', adminAuth, (req, res) => {
  try {
    const { reportType } = req.params;

    if (!reportService.REPORT_TYPES[reportType]) {
      return res.status(400).json({
        error: `Unknown report type: ${reportType}`,
        available: Object.keys(reportService.REPORT_TYPES),
      });
    }

    const filters = {
      date_from: req.query.date_from,
      date_to: req.query.date_to,
      category_id: req.query.category_id ? parseInt(req.query.category_id) : undefined,
      warehouse_id: req.query.warehouse_id ? parseInt(req.query.warehouse_id) : undefined,
      product_id: req.query.product_id ? parseInt(req.query.product_id) : undefined,
    };

    const csv = reportService.export(reportType, filters);
    const filename = `${reportType}_${new Date().toISOString().split('T')[0]}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) {
    console.error('Error exporting report:', err);
    res.status(500).json({ error: 'Failed to export report' });
  }
});

// GET /api/admin/reports/:reportType/export/pdf — branded PDF report
router.get('/:reportType/export/pdf', adminAuth, requirePermission('reports.read'), (req, res) => {
  try {
    const { reportType } = req.params;
    if (!reportService.REPORT_TYPES[reportType]) {
      return res.status(400).json({ error: `Unknown report type: ${reportType}` });
    }
    const result = reportService.exportPdf(reportType, parseFilters(req));
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.sendFile(result.path);
  } catch (err) {
    console.error('Error exporting PDF report:', err);
    res.status(500).json({ error: 'Failed to export PDF report' });
  }
});

// GET /api/admin/reports/:reportType/export/md — Markdown report with QR + barcode
router.get('/:reportType/export/md', adminAuth, requirePermission('reports.read'), async (req, res) => {
  try {
    const { reportType } = req.params;
    if (!reportService.REPORT_TYPES[reportType]) {
      return res.status(400).json({ error: `Unknown report type: ${reportType}` });
    }
    const result = await reportService.exportMarkdown(reportType, parseFilters(req));
    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.sendFile(result.path);
  } catch (err) {
    console.error('Error exporting MD report:', err);
    res.status(500).json({ error: 'Failed to export MD report' });
  }
});

module.exports = router;
