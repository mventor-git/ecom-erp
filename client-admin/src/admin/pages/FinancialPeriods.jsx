import { useState, useEffect, useMemo } from 'react';
import DataTable from '../components/DataTable';
import StatCard from '../components/StatCard';
import ConfirmDialog from '../components/ConfirmDialog';
import AdminIcon from '../components/AdminIcon';
import {
  getFinancialPeriods, createFinancialPeriod, closeFinancialPeriod,
  setOpeningBalance, getWarehouses, getInventorySummary,
} from '../../api/adminApi';

const inputClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500';
const labelClass = 'block text-xs font-medium text-gray-600 mb-1';

export default function FinancialPeriods() {
  const [periods, setPeriods] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [onHandByKey, setOnHandByKey] = useState({}); // "<pid>:<whid>" -> qty_on_hand
  const [onHandProducts, setOnHandProducts] = useState({}); // "<pid>" -> { name, sku, qty_by_wh }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savedMsg, setSavedMsg] = useState('');

  // create
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [months, setMonths] = useState('12');
  const [creating, setCreating] = useState(false);

  // opening balance modal
  const [obPeriod, setObPeriod] = useState(null);
  const [obWarehouse, setObWarehouse] = useState('');
  const [obItems, setObItems] = useState([]); // [{product_id, qty}]
  const [obBusy, setObBusy] = useState(false);

  // close confirmation
  const [pendingClose, setPendingClose] = useState(null);

  useEffect(() => { loadAll(); }, []);

  function loadAll() {
    setLoading(true);
    setError('');
    Promise.all([
      getFinancialPeriods().catch(() => ({ data: [] })),
      getWarehouses().catch(() => ({ data: [] })),
      getInventorySummary().catch(() => ({ data: [] })),
    ])
      .then(([pRes, whRes, invRes]) => {
        setPeriods(pRes.data || []);
        setWarehouses(whRes.data || []);
        const map = {};
        const prods = {};
        (invRes.data || []).forEach(row => {
          if (row.product_id && row.warehouse_id) {
            map[`${row.product_id}:${row.warehouse_id}`] = row.qty_on_hand;
            prods[row.product_id] = prods[row.product_id] || { name: row.product_name || `#${row.product_id}`, sku: row.sku || '' };
          }
        });
        setOnHandByKey(map);
        setOnHandProducts(prods);
        if (!obWarehouse && whRes.data[0]) setObWarehouse(String(whRes.data[0].id));
      })
      .catch(err => setError(err.response?.data?.error || 'Failed to load financial periods'))
      .finally(() => setLoading(false));
  }

  const handleCreate = async () => {
    const m = parseInt(months, 10);
    if (!name.trim()) return setError('Period name is required');
    if (!m || m < 1 || m > 60) return setError('Months must be between 1 and 60');
    setCreating(true);
    setError('');
    try {
      await createFinancialPeriod({ name: name.trim(), months: m });
      setShowCreate(false);
      setName('');
      setSavedMsg(`Financial period created (${m} month${m !== 1 ? 's' : ''})`);
      setTimeout(() => setSavedMsg(''), 3500);
      await loadAll();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create period');
    } finally {
      setCreating(false);
    }
  };

  function handleCloseConfirm() {
    const id = pendingClose;
    setPendingClose(null);
    if (!id) return;
    closeFinancialPeriod(id)
      .then(() => {
        setSavedMsg('Financial period closed');
        setTimeout(() => setSavedMsg(''), 3500);
        loadAll();
      })
      .catch(err => setError(err.response?.data?.error || 'Failed to close period'));
  }

  const handleSetOpeningBalance = async () => {
    if (!obPeriod || !obWarehouse) return setError('Select a period and warehouse');
    const valid = obItems.filter(i => i.product_id && i.qty !== '' && i.qty !== null && i.qty !== undefined);
    if (valid.length === 0) return setError('Add at least one product quantity');

    setObBusy(true);
    setError('');
    try {
      await setOpeningBalance(obPeriod.id, parseInt(obWarehouse), valid.map(i => ({ product_id: parseInt(i.product_id), qty: parseInt(i.qty) })));
      setSavedMsg(`Opening balance set for ${obPeriod.name}`);
      setTimeout(() => setSavedMsg(''), 3500);
      setObPeriod(null);
      setObItems([]);
      await loadAll();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to set opening balance');
    } finally {
      setObBusy(false);
    }
  };

  function currentOnHand(productId) {
    return onHandByKey[`${productId}:${obWarehouse}`] ?? 0;
  }

  function productsInWarehouse(warehouseId) {
    return Object.keys(onHandByKey)
      .filter(key => key.endsWith(`:${warehouseId}`))
      .map(key => {
        const pid = parseInt(key.split(':')[0], 10);
        return { id: pid, name: onHandProducts[pid]?.name || `#${pid}` };
      });
  }

  // Honest canonical source: inventory ledger on-hand for the SELECTED warehouse.
  function fillFromStock() {
    const items = Object.entries(onHandByKey)
      .filter(([key]) => key.endsWith(`:${obWarehouse}`))
      .map(([key]) => {
        const productId = parseInt(key.split(':')[0], 10);
        return { product_id: productId, qty: onHandByKey[key] };
      });
    setObItems(items);
  }

  const stats = useMemo(() => {
    const open = periods.filter(p => p.status === 'OPEN').length;
    const closed = periods.filter(p => p.status === 'CLOSED').length;
    return { total: periods.length, open, closed };
  }, [periods]);

  const STATUS = {
    OPEN: 'bg-green-100 text-green-700',
    CLOSED: 'bg-gray-200 text-gray-600',
  };

  const columns = [
    { key: 'name', label: 'Period', render: (r) => <span className="font-semibold">{r.name}</span> },
    { key: 'start_date', label: 'Start' },
    { key: 'end_date', label: 'End' },
    { key: 'months', label: 'Months', align: 'center', render: (r) => `${r.months} mo` },
    {
      key: 'opening_balance_set', label: 'Opening Balance', align: 'center', render: (r) => (
        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${r.opening_balance_set ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
          {r.opening_balance_set ? 'Set' : 'Not set'}
        </span>
      ),
    },
    {
      key: 'status', label: 'Status', align: 'center', render: (r) => (
        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${STATUS[r.status] || 'bg-gray-100 text-gray-500'}`}>{r.status}</span>
      ),
    },
    {
      key: 'closed_at', label: 'Closed', render: (r) => (
        <span className="text-xs text-gray-500">{r.closed_at ? new Date(r.closed_at).toLocaleString() : '—'}</span>
      ),
    },
    {
      key: 'actions', label: '', render: (r) => (
        <div className="flex items-center gap-1.5 justify-end">
          {r.status === 'OPEN' && (
            <>
              <button onClick={() => { setObPeriod(r); setObItems([]); setError(''); }} className="px-2.5 py-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100">
                Set Opening Balance
              </button>
              <button onClick={() => setPendingClose(r.id)} className="px-2.5 py-1 text-xs bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100">Close</button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Financial Periods</h1>
          <p className="text-sm text-gray-500 mt-1">Period management — opening balance posts a real <code>opening_balance</code> ledger movement. Not accounting: no GL/journal/lock.</p>
        </div>
        <button onClick={() => { setShowCreate(true); setError(''); }} className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium">+ New Period</button>
      </div>

      {savedMsg && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700" role="status">{savedMsg}</div>}
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700" role="alert">{error}</div>}

      {!loading && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <StatCard label="Total Periods" value={String(stats.total)} icon="calendar" tone="neutral" />
          <StatCard label="Open" value={String(stats.open)} icon="gauge" tone="success" />
          <StatCard label="Closed" value={String(stats.closed)} icon="folder" tone="neutral" />
        </div>
      )}

      <DataTable columns={columns} data={periods} loading={loading} emptyMessage="No financial periods yet" />

      {/* Honest boundary note */}
      <p className="text-xs text-gray-400 mt-3">
        Opening balance reconciles the inventory ledger to the counted quantity via an <code>opening_balance</code> movement
        (<code>financial_period</code> reference). Closing a period is a status flip that blocks further opening balances. There is no
        journal, no chart of accounts, no AR/AP, and no accounting lock — those are out of scope by design.
      </p>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowCreate(false)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-200 p-6" role="dialog" aria-modal="true" aria-labelledby="fp-create-title">
            <h2 id="fp-create-title" className="text-lg font-bold text-gray-900 mb-4">New Financial Period</h2>
            <div className="space-y-3">
              <div>
                <label className={labelClass}>Period Name *</label>
                <input className={inputClass} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. FY 2026, H1 2026, Q1..." />
              </div>
              <div>
                <label className={labelClass}>Length (months, 1-60) *</label>
                <input type="number" min="1" max="60" className={inputClass} value={months} onChange={e => setMonths(e.target.value)} />
                <p className="text-[11px] text-gray-400 mt-1">Starts today. e.g. 6 = half-year, 12 = year, up to 60 (5 years).</p>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg">Cancel</button>
                <button onClick={handleCreate} disabled={creating} className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">
                  {creating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Opening balance modal */}
      {obPeriod && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setObPeriod(null)} />
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-gray-200 max-h-[90vh] overflow-y-auto p-6" role="dialog" aria-modal="true" aria-labelledby="fp-ob-title">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 id="fp-ob-title" className="text-lg font-bold text-gray-900">Opening Balance — {obPeriod.name}</h2>
                <p className="text-xs text-gray-500">{obPeriod.start_date} → {obPeriod.end_date}</p>
              </div>
              <button onClick={() => setObPeriod(null)} className="text-gray-400 hover:text-gray-600" aria-label="Close">✕</button>
            </div>

            <div className="flex items-end gap-2 mb-4 flex-wrap">
              <div className="w-56">
                <label className={labelClass}>Warehouse</label>
                <select className={inputClass} value={obWarehouse} onChange={e => { setObWarehouse(e.target.value); setObItems([]); }}>
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <button onClick={fillFromStock} className="px-3 py-2 text-xs border border-primary-200 text-primary-600 rounded-lg hover:bg-primary-50">
                Fill from ledger stock
              </button>
            </div>

            <div className="border border-gray-200 rounded-xl divide-y divide-gray-100 mb-4 max-h-72 overflow-y-auto">
              {obItems.length === 0 && <div className="p-6 text-center text-sm text-gray-400">No items — click "Fill from ledger stock" or add manually below.</div>}
              {obItems.map((item, idx) => (
                <div key={idx} className="flex items-center gap-3 px-4 py-2 text-sm">
                  <select className={inputClass + ' flex-1'} value={item.product_id} onChange={e => {
                    const next = [...obItems];
                    next[idx] = { ...next[idx], product_id: parseInt(e.target.value) };
                    setObItems(next);
                  }}>
                    <option value="">Select product...</option>
                    {productsInWarehouse(obWarehouse).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <span className="text-xs text-gray-500 w-24 text-end">on-hand {currentOnHand(item.product_id)}</span>
                  <input type="number" min="0" className={inputClass + ' !w-24'} value={item.qty} onChange={e => {
                    const next = [...obItems];
                    next[idx] = { ...next[idx], qty: e.target.value };
                    setObItems(next);
                  }} />
                  <button onClick={() => setObItems(obItems.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600" aria-label="Remove row">✕</button>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between">
              <button onClick={() => setObItems([...obItems, { product_id: '', qty: '' }])} className="px-3 py-2 text-xs border border-gray-300 rounded-lg hover:bg-gray-50">
                + Add Row
              </button>
              <div className="flex gap-2">
                <button onClick={() => setObPeriod(null)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg">Cancel</button>
                <button onClick={handleSetOpeningBalance} disabled={obBusy} className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">
                  {obBusy ? 'Saving...' : 'Save Opening Balance'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Close confirmation — replaces native confirm for intentional, auditable action */}
      <ConfirmDialog
        open={!!pendingClose}
        title="Close financial period?"
        message="Closing this period blocks further opening balances for it. It can no longer receive an opening balance. (This is a status flip, not an accounting close — no journal/lock.)"
        confirmLabel="Yes, close period"
        cancelLabel="Keep open"
        tone="danger"
        onConfirm={handleCloseConfirm}
        onCancel={() => setPendingClose(null)}
      />
    </div>
  );
}
