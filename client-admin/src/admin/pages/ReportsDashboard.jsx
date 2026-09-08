import { useState, useEffect, useMemo } from 'react';
import DataTable from '../components/DataTable';
import StatCard from '../components/StatCard';
import AdminIcon from '../components/AdminIcon';
import {
  getReport, exportReport, getAdminCategories, getWarehouses,
  exportReportPdf, exportReportMd, getReportFiles, getReportFileUrl,
  getSettings, updateSettingsBatch,
} from '../../api/adminApi';
import { useAdminCurrency } from '../../utils/currency';

const REPORT_CARDS = [
  { type: 'inventory_value', label: 'Inventory Value', icon: 'box', category: 'inventory', description: 'Stock value per product/category', color: 'border-blue-200 bg-blue-50 dark:border-blue-800/60 dark:bg-blue-950/40' },
  { type: 'low_stock', label: 'Low Stock', icon: 'gauge', category: 'inventory', description: 'Products below reorder point', color: 'border-yellow-200 bg-yellow-50 dark:border-yellow-800/60 dark:bg-yellow-950/40' },
  { type: 'out_of_stock', label: 'Out of Stock', icon: 'trash', category: 'inventory', description: 'Products with zero availability', color: 'border-red-200 bg-red-50 dark:border-red-800/60 dark:bg-red-950/40' },
  { type: 'dead_stock', label: 'Dead Stock', icon: 'box', category: 'inventory', description: 'No sales in 90 days', color: 'border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/60' },
  { type: 'stock_aging', label: 'Stock Aging', icon: 'calendar', category: 'inventory', description: 'How long items have been sitting', color: 'border-purple-200 bg-purple-50 dark:border-purple-800/60 dark:bg-purple-950/40' },
  { type: 'abc_analysis', label: 'ABC Analysis', icon: 'bars', category: 'inventory', description: '80/20 revenue drivers', color: 'border-indigo-200 bg-indigo-50 dark:border-indigo-800/60 dark:bg-indigo-950/40' },
  { type: 'turnover_rate', label: 'Turnover Rate', icon: 'chart', category: 'inventory', description: 'COGS / avg inventory', color: 'border-teal-200 bg-teal-50 dark:border-teal-800/60 dark:bg-teal-950/40' },
  { type: 'stockout_frequency', label: 'Stockout Frequency', icon: 'tag', category: 'inventory', description: 'How often products hit zero', color: 'border-pink-200 bg-pink-50 dark:border-pink-800/60 dark:bg-pink-950/40' },
  { type: 'sales_report', label: 'Sales Report', icon: 'banknote', category: 'sales', description: 'Revenue by product/category', color: 'border-green-200 bg-green-50 dark:border-green-800/60 dark:bg-green-950/40' },
  { type: 'profit_report', label: 'Profit Report', icon: 'trending', category: 'sales', description: 'Revenue, cost & gross profit (negative = below cost)', color: 'border-emerald-200 bg-emerald-50 dark:border-emerald-800/60 dark:bg-emerald-950/40' },
  { type: 'offer_losses', label: 'Offer Losses', icon: 'tag', category: 'sales', description: 'Products sold below cost', color: 'border-red-200 bg-red-50 dark:border-red-800/60 dark:bg-red-950/40' },
  { type: 'net_profit', label: 'Net Profit', icon: 'chart', category: 'sales', description: 'Revenue - cost, offer losses & margin %', color: 'border-blue-200 bg-blue-50 dark:border-blue-800/60 dark:bg-blue-950/40' },
  { type: 'supplier_performance', label: 'Supplier Performance', icon: 'building', category: 'purchasing', description: 'Delivery performance metrics', color: 'border-orange-200 bg-orange-50 dark:border-orange-800/60 dark:bg-orange-950/40' },
];

const CATEGORIES = [
  { key: 'all', label: 'All Reports', icon: 'bars' },
  { key: 'inventory', label: 'Inventory', icon: 'box' },
  { key: 'sales', label: 'Sales & Profit', icon: 'banknote' },
  { key: 'purchasing', label: 'Purchasing', icon: 'building' },
];

function todayISO() { return new Date().toISOString().slice(0, 10); }
function daysAgoISO(n) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }
function monthStartISO() { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); }

export default function ReportsDashboard() {
  const { format } = useAdminCurrency();
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeReport, setActiveReport] = useState(null);
  const [reportData, setReportData] = useState([]);
  const [reportMeta, setReportMeta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [filters, setFilters] = useState({ date_from: '', date_to: '', category_id: '', warehouse_id: '' });
  const [error, setError] = useState('');
  const [reportSearch, setReportSearch] = useState('');
  const [datePreset, setDatePreset] = useState('all');

  const [reportFiles, setReportFiles] = useState([]);
  const [schedFrequency, setSchedFrequency] = useState('off');
  const [schedTypes, setSchedTypes] = useState([]);
  const [schedSaved, setSchedSaved] = useState(false);

  useEffect(() => {
    Promise.all([getAdminCategories(), getWarehouses(), getReportFiles().catch(() => ({ data: [] })), getSettings().catch(() => ({ data: [] }))])
      .then(([catRes, whRes, filesRes, settingsRes]) => {
        setCategories(catRes.data || []);
        setWarehouses(whRes.data || []);
        setReportFiles(filesRes.data || []);
        const all = settingsRes.data || [];
        const get = (k, d) => { const s = all.find(x => x.key === k); return s && s.parsed_value !== undefined && s.parsed_value !== null ? s.parsed_value : d; };
        setSchedFrequency(String(get('report_frequency', 'off') || 'off'));
        setSchedTypes(Array.isArray(get('report_types', [])) ? get('report_types', []) : []);
      });
  }, []);

  function filterParams() {
    const params = {};
    if (filters.date_from) params.date_from = filters.date_from;
    if (filters.date_to) params.date_to = filters.date_to;
    if (filters.category_id) params.category_id = filters.category_id;
    if (filters.warehouse_id) params.warehouse_id = filters.warehouse_id;
    return params;
  }

  function applyPreset(preset) {
    setDatePreset(preset);
    if (preset === 'all') setFilters(f => ({ ...f, date_from: '', date_to: '' }));
    else if (preset === 'today') setFilters(f => ({ ...f, date_from: todayISO(), date_to: todayISO() }));
    else if (preset === '7d') setFilters(f => ({ ...f, date_from: daysAgoISO(7), date_to: todayISO() }));
    else if (preset === '30d') setFilters(f => ({ ...f, date_from: daysAgoISO(30), date_to: todayISO() }));
    else if (preset === 'month') setFilters(f => ({ ...f, date_from: monthStartISO(), date_to: todayISO() }));
  }

  const saveSchedule = async () => {
    try {
      await updateSettingsBatch([
        { key: 'report_frequency', value: schedFrequency },
        { key: 'report_types', value: schedTypes },
      ]);
      setSchedSaved(true);
      setTimeout(() => setSchedSaved(false), 2500);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save scheduling');
    }
  };

  function generateReport(type) {
    setActiveReport(type);
    setLoading(true);
    setError('');
    setReportMeta(null);
    setReportData([]);
    const params = {};
    if (filters.date_from) params.date_from = filters.date_from;
    if (filters.date_to) params.date_to = filters.date_to;
    if (filters.category_id) params.category_id = parseInt(filters.category_id);
    if (filters.warehouse_id) params.warehouse_id = parseInt(filters.warehouse_id);

    getReport(type, params)
      .then(res => {
        const wrapper = res.data;
        // wrapper: { report_type, label, generated_at, filters, data }
        if (wrapper && Array.isArray(wrapper.data)) {
          setReportMeta(wrapper);
          setReportData(wrapper.data);
        } else if (Array.isArray(wrapper)) {
          setReportMeta({ report_type: type, label: REPORT_CARDS.find(c => c.type === type)?.label || type, generated_at: new Date().toISOString(), data: wrapper });
          setReportData(wrapper);
        } else {
          setReportMeta(wrapper);
          setReportData([]);
        }
      })
      .catch(err => setError(err.response?.data?.error || err.response?.status === 403 ? 'Forbidden — reports.read required' : 'Failed to generate report'))
      .finally(() => setLoading(false));
  }

  function handleExport() {
    if (!activeReport) return;
    const params = new URLSearchParams();
    if (filters.date_from) params.set('date_from', filters.date_from);
    if (filters.date_to) params.set('date_to', filters.date_to);
    if (filters.category_id) params.set('category_id', filters.category_id);
    if (filters.warehouse_id) params.set('warehouse_id', filters.warehouse_id);
    const url = `/api/admin/reports/${activeReport}/export?${params.toString()}`;
    window.open(url, '_blank');
  }

  function getColumnsForReport(type, data) {
    if (!data || !Array.isArray(data) || data.length === 0) return [];
    const first = data[0];
    return Object.keys(first).map(key => {
      if (key.includes('cost') || key.includes('value') || key.includes('revenue') || key.includes('price') || key.includes('cogs') || key === 'total_value' || key === 'loss_amount' || key === 'gross_profit' || key === 'cost_total') {
        return { key, label: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), align: 'right', sortable: true, render: (row) => format(row[key] || 0) };
      }
      if (key.includes('qty') || key.includes('count') || key.includes('orders') || key.includes('days_since')) {
        return { key, label: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), align: 'right', sortable: true };
      }
      return { key, label: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), sortable: true };
    });
  }

  const filteredCards = useMemo(() => {
    let cards = REPORT_CARDS;
    if (activeCategory !== 'all') cards = cards.filter(c => c.category === activeCategory);
    if (reportSearch.trim()) {
      const q = reportSearch.toLowerCase();
      cards = cards.filter(c => c.label.toLowerCase().includes(q) || c.description.toLowerCase().includes(q));
    }
    return cards;
  }, [activeCategory, reportSearch]);

  const summaryStats = useMemo(() => {
    if (!reportData || reportData.length === 0) return null;
    const count = reportData.length;
    // try to compute a monetary total for inventory_value / sales reports
    const first = reportData[0];
    let totalValue = null;
    if ('total_value' in first) totalValue = reportData.reduce((s, r) => s + (r.total_value || 0), 0);
    else if ('revenue' in first) totalValue = reportData.reduce((s, r) => s + (r.revenue || 0), 0);
    else if ('gross_profit' in first) totalValue = reportData.reduce((s, r) => s + (r.gross_profit || 0), 0);
    return { count, totalValue };
  }, [reportData]);

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Report Center</h1>
          <p className="text-sm text-gray-500 mt-1">Operational reports over the inventory & order ledger — trashed products excluded where stock-facing. No fake accounting.</p>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-xs text-gray-400">
          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Live ledger</span>
          <span>·</span>
          <span>{REPORT_CARDS.length} reports</span>
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700" role="alert">{error}</div>}

      <div className="grid grid-cols-12 gap-6">
        {/* Category sidebar */}
        <div className="col-span-12 lg:col-span-3">
          <div className="bg-white rounded-xl border border-gray-200 p-3">
            <div className="relative mb-3">
              <input value={reportSearch} onChange={e => setReportSearch(e.target.value)} placeholder="Search reports..."
                className="w-full border border-gray-300 rounded-lg ps-9 pe-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              <span className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400">
                <AdminIcon name="list" className="w-4 h-4" />
              </span>
            </div>
            <div className="space-y-1">
              {CATEGORIES.map(cat => (
                <button key={cat.key} onClick={() => setActiveCategory(cat.key)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeCategory === cat.key ? 'bg-primary-50 text-primary-700 border border-primary-200' : 'text-gray-700 hover:bg-gray-50 border border-transparent'}`}>
                  <AdminIcon name={cat.icon} className="w-4 h-4" />
                  <span className="flex-1 text-start">{cat.label}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${activeCategory === cat.key ? 'bg-primary-100' : 'bg-gray-100'}`}>
                    {cat.key === 'all' ? REPORT_CARDS.length : REPORT_CARDS.filter(c => c.category === cat.key).length}
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs font-medium text-gray-500 mb-2">Current report</p>
              {activeReport ? (
                <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                  <p className="text-sm font-semibold text-gray-900">{REPORT_CARDS.find(c => c.type === activeReport)?.label}</p>
                  <p className="text-xs text-gray-500 mt-1">{REPORT_CARDS.find(c => c.type === activeReport)?.description}</p>
                  {reportMeta?.generated_at && <p className="text-[11px] text-gray-400 mt-2">Generated {new Date(reportMeta.generated_at).toLocaleString()}</p>}
                </div>
              ) : (
                <p className="text-xs text-gray-400">No report selected — pick a card to view.</p>
              )}
            </div>
          </div>
        </div>

        {/* Main */}
        <div className="col-span-12 lg:col-span-9">
          {/* Report cards grid (filtered) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 mb-6">
            {filteredCards.map(card => (
              <button
                key={card.type}
                onClick={() => generateReport(card.type)}
                className={`p-4 rounded-xl border-2 text-start transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1 ${
                  activeReport === card.type ? 'border-primary-500 ring-2 ring-primary-200' : card.color
                }`}
                aria-pressed={activeReport === card.type}
              >
                <AdminIcon name={card.icon} className="w-6 h-6 text-gray-600" />
                <h3 className="text-sm font-semibold text-gray-900 mt-2">{card.label}</h3>
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{card.description}</p>
                <span className="inline-block mt-2 text-[11px] px-1.5 py-0.5 rounded bg-white/80 border border-gray-200 text-gray-500">{card.category}</span>
              </button>
            ))}
            {filteredCards.length === 0 && (
              <div className="col-span-full p-8 text-center border-2 border-dashed border-gray-200 rounded-xl">
                <p className="text-sm text-gray-500">No reports match “{reportSearch}”.</p>
                <button onClick={() => { setReportSearch(''); setActiveCategory('all'); }} className="mt-2 text-xs text-primary-600 hover:underline">Clear filters</button>
              </div>
            )}
          </div>

          {/* Unified filter bar */}
          {activeReport && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="text-xs font-medium text-gray-500">Preset:</span>
                {[
                  { key: 'all', label: 'All' },
                  { key: 'today', label: 'Today' },
                  { key: '7d', label: '7 days' },
                  { key: '30d', label: '30 days' },
                  { key: 'month', label: 'This month' },
                ].map(p => (
                  <button key={p.key} onClick={() => applyPreset(p.key)}
                    className={`text-xs px-2.5 py-1 rounded-full border ${datePreset === p.key ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
                    {p.label}
                  </button>
                ))}
                {reportMeta?.filters && (reportMeta.filters.date_from || reportMeta.filters.date_to) && (
                  <span className="text-xs text-gray-400 ms-2">Applied: {reportMeta.filters.date_from || '—'} → {reportMeta.filters.date_to || '—'}</span>
                )}
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
                  <input type="date" value={filters.date_from} onChange={e => { setFilters({ ...filters, date_from: e.target.value }); setDatePreset('custom'); }}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
                  <input type="date" value={filters.date_to} onChange={e => { setFilters({ ...filters, date_to: e.target.value }); setDatePreset('custom'); }}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
                  <select value={filters.category_id} onChange={e => setFilters({ ...filters, category_id: e.target.value })}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500">
                    <option value="">All</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Warehouse</label>
                  <select value={filters.warehouse_id} onChange={e => setFilters({ ...filters, warehouse_id: e.target.value })}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500">
                    <option value="">All</option>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-2 ms-auto">
                  <button onClick={() => generateReport(activeReport)} className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium focus:outline-none focus:ring-2 focus:ring-primary-500">
                    Refresh
                  </button>
                  <button onClick={handleExport} className="px-4 py-2 text-sm bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500">
                    Export CSV
                  </button>
                  <a href={exportReportPdf(activeReport, filterParams())} target="_blank" rel="noopener noreferrer"
                    className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500">
                    PDF
                  </a>
                  <a href={exportReportMd(activeReport, filterParams())} target="_blank" rel="noopener noreferrer"
                    className="px-4 py-2 text-sm bg-gray-700 text-white rounded-lg hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500">
                    MD
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Report results */}
          {loading && (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" />
              <p className="text-sm text-gray-500 mt-3">Generating report…</p>
            </div>
          )}

          {!loading && reportMeta && activeReport && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">{reportMeta.label || REPORT_CARDS.find(c => c.type === activeReport)?.label}</h2>
                  <p className="text-xs text-gray-500">{REPORT_CARDS.find(c => c.type === activeReport)?.description} · {reportData.length} rows · {reportMeta.generated_at ? new Date(reportMeta.generated_at).toLocaleString() : ''}</p>
                </div>
              </div>

              {summaryStats && (
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                  <StatCard label="Results" value={String(summaryStats.count)} icon="bars" tone="neutral" />
                  {summaryStats.totalValue !== null && (
                    <StatCard label="Total Value" value={format(summaryStats.totalValue)} icon="banknote" tone="info" />
                  )}
                  <StatCard label="Generated" value={reportMeta.generated_at ? new Date(reportMeta.generated_at).toLocaleTimeString() : '—'} icon="calendar" tone="neutral" />
                </div>
              )}

              <DataTable
                columns={getColumnsForReport(activeReport, reportData)}
                data={reportData}
                loading={false}
                error={error}
                emptyMessage="No data for this report — try a different preset or clear filters."
                stickyHeader
                maxHeight="520px"
                sortable
              />
              <p className="text-xs text-gray-400 mt-2">Trashed products are excluded where stock-facing (inventory_value, stock_aging, low/out_of_stock etc. via <code>p.deleted_at IS NULL</code>). Profit reports are operational (revenue vs cost_price); FIFO P&L is not yet fully cost-consumption based.</p>
            </div>
          )}

          {!loading && !reportMeta && activeReport === null && (
            <div className="bg-white rounded-xl border-2 border-dashed border-gray-200 p-10 text-center">
              <AdminIcon name="bars" className="w-8 h-8 text-gray-400 mx-auto" />
              <p className="text-sm font-medium text-gray-700 mt-3">Pick a report to begin</p>
              <p className="text-xs text-gray-500 mt-1">Choose a category on the left, then a card. Use presets or custom dates, then Refresh. Exports respect the same filters.</p>
            </div>
          )}
        </div>
      </div>

      {/* Scheduled reports + generated files */}
      <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-1">Scheduled Reports</h2>
          <p className="text-xs text-gray-500 mb-4">The server generates configured reports automatically and notifies users with the reports.read permission.</p>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Frequency</label>
              <select value={schedFrequency} onChange={e => setSchedFrequency(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
                <option value="off">Off</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Report types included</label>
              <div className="grid grid-cols-2 gap-1.5 max-h-44 overflow-y-auto border border-gray-200 rounded-lg p-2">
                {REPORT_CARDS.map(card => (
                  <label key={card.type} className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                    <input type="checkbox" checked={schedTypes.includes(card.type)} onChange={e => { const next = e.target.checked ? [...schedTypes, card.type] : schedTypes.filter(t => t !== card.type); setSchedTypes(next); }} className="rounded border-gray-300" />
                    {card.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={saveSchedule} className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700">Save Schedule</button>
              {schedSaved && <span className="text-xs text-green-600">Saved ✓</span>}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-1">Generated Files</h2>
          <p className="text-xs text-gray-500 mb-4">PDF and Markdown reports produced on demand or by the scheduler.</p>
          {reportFiles.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">No generated files yet.</p>
          ) : (
            <div className="border border-gray-200 rounded-xl divide-y divide-gray-100 max-h-72 overflow-y-auto">
              {reportFiles.slice(0, 30).map(f => (
                <div key={f.filename} className="flex items-center justify-between px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{f.filename}</p>
                    <p className="text-xs text-gray-400">{new Date(f.created).toLocaleString()}</p>
                  </div>
                  <a href={getReportFileUrl(f.filename)} className="ms-3 px-3 py-1 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg shrink-0">Download</a>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
