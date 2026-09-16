import { useState, useEffect } from 'react';
import StatCard from '../components/StatCard';
import DataTable from '../components/DataTable';
import { getRevenueReconciliation } from '../../api/adminApi';
import { useAdminCurrency } from '../../utils/currency';

// mventor-ticket-091 — revenue settlement reconciliation. Compares what the
// operating business calls settled against what the LEDGER actually posts.
// It never forces equality: the difference classes are the control.
const CLASSES = [
  { key: 'settled_unbooked', label: 'Settled, not booked', hint: 'Collected per operational state, no posted journal — settle (book-only) or investigate' },
  { key: 'booked_unsettled', label: 'Booked, not settled', hint: 'Posted revenue whose order is not settled — investigate the source' },
  { key: 'amount_mismatch', label: 'Amount mismatch', hint: 'Both views exist but nets differ' },
  { key: 'refunded_unreversed', label: 'Refunded, not reversed', hint: 'Refunded order still carrying posted revenue net' },
  { key: 'reversed_not_refunded', label: 'Reversed, not refunded', hint: 'Reversal journal exists but order is not refunded' },
];

export default function RevenueReconciliation() {
  const { format } = useAdminCurrency();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState('settled_unbooked');

  function load() {
    setLoading(true);
    setError('');
    getRevenueReconciliation()
      // route wraps {success, data} — unwrap one level (tolerate bare payload too)
      .then(res => setData(res.data?.data ?? res.data))
      .catch(err => { setError(err.response?.data?.error || 'Failed to load reconciliation'); setData(null); })
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  const cols = [
    { key: 'order_id', label: 'Order', render: r => <span className="font-mono text-xs">#{r.order_id}{r.order_number ? ` · ${r.order_number}` : ''}</span> },
    { key: 'order_status', label: 'Status', render: r => <span className="text-xs">{r.order_status}/{r.payment_status || '—'}{r.payment_method ? ` · ${r.payment_method}` : ''}</span> },
    { key: 'order_total_cents', label: 'Operational', align: 'right', render: r => format(r.order_total_cents ?? 0) },
    { key: 'net_posted_revenue_cents', label: 'Ledger net', align: 'right', render: r => <span className="font-semibold">{format(r.net_posted_revenue_cents ?? 0)}</span> },
    { key: 'source_events', label: 'Journal source', render: r => <span className="font-mono text-xs text-gray-500">{(r.source_events || []).join(', ') || '—'}{r.has_reversal ? ' +reversal' : ''}</span> },
  ];

  const diff = data?.totals?.difference_cents ?? 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Revenue Reconciliation</h1>
          <p className="text-xs text-gray-500 mt-1 max-w-3xl">{data?.basis || ''}</p>
        </div>
        <button onClick={load} disabled={loading} className="text-sm px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">
          {loading ? '…' : 'Refresh'}
        </button>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

      {data && (
        <div className="flex gap-3 flex-wrap mb-5">
          <StatCard label="Operationally settled" value={format(data.totals?.operational_settled_cents ?? 0)} sub="collected + not refunded" tone="primary" icon="chart" />
          <StatCard label="Posted revenue (net)" value={format(data.totals?.posted_revenue_net_cents ?? 0)} sub="sale journals − reversals" tone="neutral" icon="chart" />
          <StatCard label="Difference" value={format(diff)}
            sub={diff === 0 ? 'views agree ✓' : 'investigate the classes below'}
            tone={diff === 0 ? 'success' : 'warning'} icon="alert" />
        </div>
      )}

      {data && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 divide-y divide-gray-100">
          {CLASSES.map(c => {
            const cls = data.difference_classes?.[c.key];
            const n = cls?.count || 0;
            return (
              <div key={c.key}>
                <button onClick={() => setOpen(open === c.key ? null : c.key)}
                  className={`w-full flex items-center justify-between px-5 py-3 text-sm font-medium ${n ? 'text-gray-900' : 'text-gray-400'}`}>
                  <span>{n ? (open === c.key ? '▾ ' : '▸ ') : '· '}{c.label} <span className="text-xs font-normal text-gray-500">({n})</span></span>
                  <span className="text-xs text-gray-400">{c.hint}</span>
                </button>
                {open === c.key && n > 0 && (
                  <div className="px-5 pb-4">
                    <DataTable columns={cols} data={cls.orders} keyField="order_id" emptyMessage="—" />
                    {cls.truncated && <p className="mt-2 text-xs text-red-600">List truncated at 200 — more flagged orders exist.</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-4 text-xs text-gray-400 max-w-3xl">order.status is NOT accounting truth — a difference is either a settlement awaiting its journal (settle dialog, book-only) or a forged state; every row traces to its journal source above.</p>
    </div>
  );
}

