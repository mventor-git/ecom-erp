const dbModule = require('../db');

function getOverviewAggregation({ startDate, endDate, userRole }) {
  try {
    const db = dbModule.getDb ? dbModule.getDb() : null;
    const prepare = dbModule.prepare || (dbModule.getDb ? dbModule.getDb().prepare : null);
    if (!db) {
      return { status: 'unavailable', message: 'DB not ready', role: userRole || 'admin' };
    }
    // Real DB aggregation — no fake values
    const ordersCount = (prepare('SELECT COUNT(*) as c FROM orders WHERE created_at BETWEEN ? AND ?').get(startDate, endDate)?.c || 0);
    const revenue = (prepare('SELECT SUM(total) as s FROM orders WHERE created_at BETWEEN ? AND ?').get(startDate, endDate)?.s || 0);
    const customers = (prepare('SELECT COUNT(*) as c FROM customers').get()?.c || 0);
    const products = (prepare('SELECT COUNT(*) as c FROM products WHERE deleted_at IS NULL').get()?.c || 0);
    const inventory = (prepare('SELECT COUNT(*) as c FROM inventory').get()?.c || 0);
    const warehouses = (prepare('SELECT COUNT(*) as c FROM warehouses').get()?.c || 0);
    const costLayers = (prepare('SELECT COUNT(*) as c FROM inventory_cost_layers').get()?.c || 0);

    // Revenue chart data — real from orders
    const revenueDataRaw = prepare(`SELECT date(created_at) as d, SUM(total) as rev FROM orders WHERE created_at BETWEEN ? AND ? GROUP BY d ORDER BY d`).all(startDate, endDate);
    const revenueData = Array.isArray(revenueDataRaw) ? revenueDataRaw : (revenueDataRaw ? [revenueDataRaw] : []);
    let channels = [];
    try {
      const channelsRaw = prepare(`SELECT 'Unknown' as ch, COUNT(*) as c FROM orders WHERE created_at BETWEEN ? AND ? GROUP BY ch`).all(startDate, endDate);
      channels = Array.isArray(channelsRaw) ? channelsRaw : (channelsRaw ? [channelsRaw] : []);
    } catch { channels = []; }

    return {
      status: 'ok',
      role: userRole || 'admin',
      kpi: { ordersCount, revenue, customers, products, inventory, warehouses, costLayers },
      revenueData,
      channels,
      dateRange: { start: startDate, end: endDate },
    };
  } catch (e) {
    return { status: 'error', error: e.message, role: userRole || 'admin' };
  }
}

module.exports = { getOverviewAggregation };
