import { useState, useEffect } from 'react';
import DataTable from '../components/DataTable';
import {
  getFinancialPeriods, createFinancialPeriod, closeFinancialPeriod,
  setOpeningBalance, getWarehouses, getAdminProducts,
} from '../../api/adminApi';

const inputClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500';
const labelClass = 'block text-xs font-medium text-gray-600 mb-1';

export default function FinancialPeriods() {
  const [periods, setPeriods] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
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

  useEffect(() => { loadAll(); }, []);

  function loadAll() {
    setLoading(true);
    Promise.all([
      getFinancialPeriods(),
      getWarehouses().catch(() => ({ data: [] })),
      getAdminProducts().catch(() => ({ data: [] })),
    ])
      .then(([pRes, whRes, prodRes]) => {
        setPeriods(pRes.data || []);
        setWarehouses(whRes.data || []);
        setProducts(prodRes.data || []);
        if (!obWarehouse && whRes.data[0]) setObWarehouse(String(whRes.data[0].id));
      })
      .catch(err => console.error('Error loading periods:', err))
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

  const handleClose = async (id) => {
    if (!window.confirm('Close this financial period? It can no longer receive an opening balance.')) return;
    try {
      await closeFinancialPeriod(id);
      await loadAll();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to close period');
    }
  };

  const handleSetOpeningBalance = async () => {
    if (!obPeriod || !obWarehouse) return setError('Select a period and warehouse');
    const valid = obItems.filter(i => i.product_id && i.qty !== '' && i.qty !== null);
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

  const fillFromStock = () => {
    const items = products
      .filter(p => p.stock > 0)
      .map(p => ({ product_id: p.id, qty: p.stock }));
    setObItems(items);
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
        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${r.status === 'OPEN' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
          {r.status}
        </span>
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
              <button onClick={() => handleClose(r.id)} className="px-2.5 py-1 text-xs bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100">Close</button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Financial Periods</h1>
          <p className="text-sm text-gray-500 mt-1">Opening balance per period — 1 to 60 months (configurable)</p>
        </div>
        <button onClick={() => { setShowCreate(true); setError(''); }} className="btn-primary">+ New Period</button>
      </div>

      {savedMsg && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">{savedMsg}</div>}
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

      <DataTable columns={columns} data={periods} loading={loading} emptyMessage="No financial periods yet" />

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowCreate(false)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">New Financial Period</h2>
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
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-gray-200 max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Opening Balance — {obPeriod.name}</h2>
                <p className="text-xs text-gray-500">{obPeriod.start_date} → {obPeriod.end_date}</p>
              </div>
              <button onClick={() => setObPeriod(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <div className="flex items-end gap-2 mb-4 flex-wrap">
              <div className="w-56">
                <label className={labelClass}>Warehouse</label>
                <select className={inputClass} value={obWarehouse} onChange={e => setObWarehouse(e.target.value)}>
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <button onClick={fillFromStock} className="px-3 py-2 text-xs border border-primary-200 text-primary-600 rounded-lg hover:bg-primary-50">
                Fill from current stock
              </button>
            </div>

            <div className="border border-gray-200 rounded-xl divide-y divide-gray-100 mb-4 max-h-72 overflow-y-auto">
              {obItems.length === 0 && <div className="p-6 text-center text-sm text-gray-400">No items — click "Fill from current stock" or add manually below.</div>}
              {obItems.map((item, idx) => (
                <div key={idx} className="flex items-center gap-3 px-4 py-2 text-sm">
                  <select className={inputClass + ' flex-1'} value={item.product_id} onChange={e => {
                    const next = [...obItems];
                    next[idx] = { ...next[idx], product_id: parseInt(e.target.value) };
                    setObItems(next);
                  }}>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <input type="number" min="0" className={inputClass + ' !w-24'} value={item.qty} onChange={e => {
                    const next = [...obItems];
                    next[idx] = { ...next[idx], qty: e.target.value };
                    setObItems(next);
                  }} />
                  <button onClick={() => setObItems(obItems.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600">✕</button>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between">
              <button onClick={() => setObItems([...obItems, { product_id: products[0]?.id || '', qty: '' }])} className="px-3 py-2 text-xs border border-gray-300 rounded-lg hover:bg-gray-50">
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
    </div>
  );
}
