import { useState, useEffect } from 'react';
import DataTable from '../components/DataTable';
import AdminIcon from '../components/AdminIcon';
import {
  getReport, exportReport, getAdminCategories, getWarehouses,
  exportReportPdf, exportReportMd, getReportFiles, getReportFileUrl,
  getSettings, updateSettingsBatch,
} from '../../api/adminApi';
import { useAdminCurrency } from '../../utils/currency';

const REPORT_CARDS = [
  { type: 'inventory_value', label: 'Inventory Value', icon: 'box', description: 'Stock value per product/category', color: 'border-blue-200 bg-blue-50 dark:border-blue-800/60 dark:bg-blue-950/40' },
  { type: 'low_stock', label: 'Low Stock', icon: 'gauge', description: 'Products below reorder point', color: 'border-yellow-200 bg-yellow-50 dark:border-yellow-800/60 dark:bg-yellow-950/40' },
  { type: 'out_of_stock', label: 'Out of Stock', icon: 'trash', description: 'Products with zero availability', color: 'border-red-200 bg-red-50 dark:border-red-800/60 dark:bg-red-950/40' },
  { type: 'dead_stock', label: 'Dead Stock', icon: 'box', description: 'No sales in 90 days', color: 'border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/60' },
  { type: 'stock_aging', label: 'Stock Aging', icon: 'calendar', description: 'How long items have been sitting', color: 'border-purple-200 bg-purple-50 dark:border-purple-800/60 dark:bg-purple-950/40' },
  { type: 'abc_analysis', label: 'ABC Analysis', icon: 'bars', description: '80/20 revenue drivers', color: 'border-indigo-200 bg-indigo-50 dark:border-indigo-800/60 dark:bg-indigo-950/40' },
  { type: 'turnover_rate', label: 'Turnover Rate', icon: 'chart', description: 'COGS / avg inventory', color: 'border-teal-200 bg-teal-50 dark:border-teal-800/60 dark:bg-teal-950/40' },
  { type: 'sales_report', label: 'Sales Report', icon: 'banknote', description: 'Revenue by product/category', color: 'border-green-200 bg-green-50 dark:border-green-800/60 dark:bg-green-950/40' },
  { type: 'supplier_performance', label: 'Supplier Performance', icon: 'building', description: 'Delivery performance metrics', color: 'border-orange-200 bg-orange-50 dark:border-orange-800/60 dark:bg-orange-950/40' },
  { type: 'stockout_frequency', label: 'Stockout Frequency', icon: 'tag', description: 'How often products hit zero', color: 'border-pink-200 bg-pink-50 dark:border-pink-800/60 dark:bg-pink-950/40' },
  { type: 'profit_report', label: 'Profit Report', icon: 'trending', description: 'Revenue, cost & gross profit per product (negative = below cost)', color: 'border-emerald-200 bg-emerald-50 dark:border-emerald-800/60 dark:bg-emerald-950/40' },
  { type: 'offer_losses', label: 'Offer Losses', icon: 'tag', description: 'Products sold below cost — offer losses', color: 'border-red-200 bg-red-50 dark:border-red-800/60 dark:bg-red-950/40' },
  { type: 'net_profit', label: 'Net Profit', icon: 'chart', description: 'Revenue − cost, offer losses & margin %', color: 'border-blue-200 bg-blue-50 dark:border-blue-800/60 dark:bg-blue-950/40' },
];

export default function ReportsDashboard() {
  const { format } = useAdminCurrency();
  const [activeReport, setActiveReport] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [filters, setFilters] = useState({ date_from: '', date_to: '', category_id: '', warehouse_id: '' });
  const [error, setError] = useState('');
  const [reportSearch, setReportSearch] = useState('');

  // scheduling
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
    const params = {};
    if (filters.date_from) params.date_from = filters.date_from;
    if (filters.date_to) params.date_to = filters.date_to;
    if (filters.category_id) params.category_id = parseInt(filters.category_id);
    if (filters.warehouse_id) params.warehouse_id = parseInt(filters.warehouse_id);

    getReport(type, params)
      .then(res => setReportData(res.data))
      .catch(err => setError(err.response?.data?.error || 'Failed to generate report'))
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
      if (key.includes('cost') || key.includes('value') || key.includes('revenue') || key.includes('price') || key.includes('cogs')) {
        return { key, label: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), render: (row) => format(row[key] || 0) };
      }
      return { key, label: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) };
    });
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-sm text-gray-500 mt-1">Business intelligence and analytics</p>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

      {/* Report Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
        {REPORT_CARDS.map(card => (
          <button
            key={card.type}
            onClick={() => generateReport(card.type)}
            className={`p-4 rounded-xl border-2 text-left transition-all hover:shadow-md ${
              activeReport === card.type ? 'border-primary-500 ring-2 ring-primary-200' : card.color
            }`}
          >
            <AdminIcon name={card.icon} className="w-6 h-6 text-gray-600" />
            <h3 className="text-sm font-semibold text-gray-900 mt-2">{card.label}</h3>
            <p className="text-xs text-gray-500 mt-1">{card.description}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      {activeReport && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
              <input type="date" value={filters.date_from} onChange={e => setFilters({...filters, date_from: e.target.value})}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
              <input type="date" value={filters.date_to} onChange={e => setFilters({...filters, date_to: e.target.value})}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
              <select value={filters.category_id} onChange={e => setFilters({...filters, category_id: e.target.value})}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
                <option value="">All</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Warehouse</label>
              <select value={filters.warehouse_id} onChange={e => setFilters({...filters, warehouse_id: e.target.value})}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
                <option value="">All</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <button onClick={() => generateReport(activeReport)} className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700">
              Refresh
            </button>
            <button onClick={handleExport} className="px-4 py-2 text-sm bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
              Export CSV
            </button>
            <a
              href={exportReportPdf(activeReport, filterParams())}
              target="_blank" rel="noopener noreferrer"
              className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Export PDF
            </a>
            <a
              href={exportReportMd(activeReport, filterParams())}
              target="_blank" rel="noopener noreferrer"
              className="px-4 py-2 text-sm bg-gray-700 text-white rounded-lg hover:bg-gray-800"
            >
              Export MD
            </a>
          </div>
        </div>
      )}

      {/* Report Results */}
      {loading && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" />
          <p className="text-sm text-gray-500 mt-3">Generating report...</p>
        </div>
      )}

      {!loading && reportData && activeReport && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">
              {REPORT_CARDS.find(c => c.type === activeReport)?.label} — {Array.isArray(reportData) ? reportData.length : 0} results
            </h2>
          </div>
          <DataTable
            columns={getColumnsForReport(activeReport, reportData)}
            data={Array.isArray(reportData) ? reportData : []}
            emptyMessage="No data for this report"
          />
        </div>
      )}

      {/* Scheduled reports + generated files */}
      <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scheduling config */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-1">Scheduled Reports</h2>
          <p className="text-xs text-gray-500 mb-4">The server generates configured reports automatically and notifies users with the reports.view permission.</p>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Frequency</label>
              <select
                value={schedFrequency}
                onChange={e => setSchedFrequency(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
              >
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
                    <input
                      type="checkbox"
                      checked={schedTypes.includes(card.type)}
                      onChange={e => {
                        const next = e.target.checked
                          ? [...schedTypes, card.type]
                          : schedTypes.filter(t => t !== card.type);
                        setSchedTypes(next);
                      }}
                      className="rounded border-gray-300"
                    />
                    {card.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={saveSchedule} className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700">Save Schedule</button>
              {schedSaved && <span className='text-xs text-green-600'>Saved ✓</span>}
            </div>
          </div>
        </div>

        {/* Generated files */}
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
                  <a
                    href={getReportFileUrl(f.filename)}
                    className="ml-3 px-3 py-1 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg shrink-0"
                  >
                    Download
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
