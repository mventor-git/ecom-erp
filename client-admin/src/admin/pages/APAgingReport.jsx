import { useState, useEffect } from 'react';
import StatCard from '../components/StatCard';
import DataTable from '../components/DataTable';
import { getApAging, getSuppliers } from '../../api/adminApi';
import { useAdminCurrency } from '../../utils/currency';

// mventor-ticket-090 — AP Aging report (recognition-date basis; 087/088/089
// model: posted AP credit journals minus payment applications ACTIVE as of the
// chosen date). Read-only report; all semantics live in apAgingService.
const BUCKET_COLS = [
  { key: 'current_zero', label: 'Current' },
  { key: 'days_1_30', label: '1–30' },
  { key: 'days_31_60', label: '31–60' },
  { key: 'days_61_90', label: '61–90' },
  { key: 'days_90_plus', label: '90+' },
];

function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

export default function APAgingReport() {
  const { format } = useAdminCurrency();
  const [asOf, setAsOf] = useState(todayUTC());
  const [supplierId, setSupplierId] = useState('');
  const [suppliers, setSuppliers] = useState([]);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(null); // supplier_id | null

  function load() {
    if (!asOf) { setError('As-of date is required'); setLoading(false); return; }
    setLoading(true);
    setError('');
    getApAging({ as_of: asOf, ...(supplierId ? { supplier_id: supplierId } : {}) })
      .then(res => setReport(res.data))
      .catch(err => { setError(err.response?.data?.error || 'Failed to load report'); setReport(null); })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    getSuppliers().then(r => setSuppliers((r.data || []).filter(s => s.is_active !== 0))).catch(() => {});
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const itemsOf = (sid) => (report?.items || []).filter(i => i.supplier_id === sid);

  const summaryColumns = [
    { key: 'supplier_name', label: 'Supplier', render: (row) => (
      <button onClick={() => setExpanded(expanded === row.supplier_id ? null : row.supplier_id)}
        className="text-left font-medium text-primary-700 hover:underline">
        {expanded === row.supplier_id ? '▾ ' : '▸ '}{row.supplier_name}
      </button>
    ) },
    { key: 'open_items', label: 'Open', align: 'right', render: (r) => r.open_items },
    ...BUCKET_COLS.map(b => ({ key: b.key, label: b.label, align: 'right', render: (r) => (r[b.key] ? format(r[b.key]) : (r[b.key] === 0 ? '—' : '—')) })),
    { key: 'total', label: 'Total', align: 'right', render: (r) => <span className="font-semibold">{format(r.total_outstanding_cents || 0)}</span> },
    { key: 'oldest', label: 'Oldest', render: (r) => <span className="text-xs text-gray-500">{r.oldest_recognized_at || '—'}</span> },
  ];

  const detailColumns = [
    { key: 'source_reference', label: 'PO / source', render: (i) => <span className="font-mono text-xs">{i.source_reference}</span> },
    { key: 'journal', label: 'Journal', render: (i) => <span className="font-mono text-xs text-gray-500">{i.journal_entry_no}</span> },
    { key: 'recognized_at', label: 'Recognized', render: (i) => i.recognized_at },
    { key: 'original', label: 'Original', align: 'right', render: (i) => format(i.original_recognized_cents) },
    { key: 'allocated_applied_cents', label: 'Paid', align: 'right', render: (i) => (i.allocated_applied_cents ? format(i.allocated_applied_cents) : '—') },
    { key: 'remaining_cents', label: 'Outstanding', align: 'right', render: (i) => <span className="font-semibold">{format(i.remaining_cents)}</span> },
    { key: 'days_aged', label: 'Days', align: 'right', render: (i) => i.days_aged },
    { key: 'bucket', label: 'Bucket', render: (i) => <span className="text-xs text-gray-600">{BUCKET_COLS.find(b => b.key === i.bucket)?.label || i.bucket}</span> },
    { key: 'payments_on_po', label: 'Pmts', align: 'right', render: (i) => (i.payments_on_po || '—') },
  ];

  const totals = report?.total_outstanding_cents || 0;
  const rec = report?.reconciliation;

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AP Aging</h1>
          <p className="text-xs text-gray-500 mt-1 max-w-2xl">{report?.aging_basis || ''}</p>
        </div>
        <div className="flex items-end gap-2">
          <label className="text-sm font-medium text-gray-700">
            <span className="block mb-1 text-xs text-gray-500">As of *</span>
            <input type="date" value={asOf} onChange={e => setAsOf(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </label>
          <label className="text-sm font-medium text-gray-700">
            <span className="block mb-1 text-xs text-gray-500">Supplier</span>
            <select value={supplierId} onChange={e => setSupplierId(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
              <option value="">All</option>
              {suppliers.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </label>
          <button onClick={load} disabled={loading || !asOf} className="text-sm px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">
            {loading ? '…' : 'Run'}
          </button>
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

      {report && (
        <div className="flex gap-3 flex-wrap mb-5">
          <StatCard label={`As of ${report.as_of}`} value={format(totals)} sub={`${report.open_items_count} open payable lines`} tone="primary" icon="chart" />
          {BUCKET_COLS.map(b => <StatCard key={b.key} label={b.label} value={format(report.buckets[b.key] || 0)} tone="neutral" />)}
        </div>
      )}

      {report && rec && (
        <div className={`mb-5 p-3 rounded-lg text-xs ${rec.reconciled ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
          Reconciliation: buckets Σ = {format(rec.buckets_sum_cents)} · summary Σ = {format(rec.summary_sum_cents)} · report total = {format(rec.report_total_cents)} ·
          {' '}{rec.reconciled ? ' reconciled ✓' : ` ✗ mismatch: buckets−total=${rec.buckets_minus_total}, summary−total=${rec.summary_minus_total}`}
        </div>
      )}

      <DataTable columns={summaryColumns} data={report?.summary || []} loading={loading} emptyMessage="No outstanding payables as of this date" keyField="supplier_id" />

      {expanded && (
        <div className="mt-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-2">Open payable lines — {suppliers.find(s => String(s.id) === String(expanded))?.name || report?.summary?.find(s0 => s0.supplier_id === expanded)?.supplier_name}</h2>
          <DataTable columns={detailColumns} data={itemsOf(expanded)} keyField="journal_entry_no" emptyMessage="No open lines for this supplier as of this date" />
        </div>
      )}

      {report && (report.items?.length || 0) > 0 && !expanded && (
        <p className="mt-3 text-xs text-gray-500">Expand a supplier row to see its open payable lines (PO/journal traceability). Totals above always cover the full result set, even when paginated.</p>
      )}
    </div>
  );
}
