import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import DataTable from '../components/DataTable';
import DocumentViewer from '../components/DocumentViewer';
import {
  getInventoryMovements, getWarehouses, getAdminProducts,
  getWarehouseLocations, transferInventory, viewMovementUrl, storeProductUrl,
} from '../../api/adminApi';

const MOVEMENT_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'opening_balance', label: 'Opening Balance' },
  { value: 'receipt', label: 'Receipt' },
  { value: 'issue', label: 'Issue' },
  { value: 'adjustment', label: 'Adjustment' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'return', label: 'Return' },
  { value: 'damage', label: 'Damage' },
  { value: 'reservation', label: 'Reservation' },
  { value: 'release', label: 'Release' },
  { value: 'correction', label: 'Correction' },
  { value: 'count', label: 'Inventory Count' },
];

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB') + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

const inputClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500';
const labelClass = 'block text-xs font-medium text-gray-600 mb-1';

export default function MovementsList() {
  const [movements, setMovements] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    type: '',
    warehouse_id: '',
    limit: 50,
    offset: 0,
  });
  const [total, setTotal] = useState(0);
  const [viewDoc, setViewDoc] = useState(null);
  const [products, setProducts] = useState([]);
  // New movement (transfer) modal - warehouse to warehouse, or shelf to shelf
  const [showNew, setShowNew] = useState(false);
  const [nmError, setNmError] = useState('');
  const [savingNew, setSavingNew] = useState(false);
  const emptyNm = { product_id: '', from_warehouse_id: '', from_location_id: '', to_warehouse_id: '', to_location_id: '', qty: '', note: '' };
  const [nm, setNm] = useState(emptyNm);
  const [locFrom, setLocFrom] = useState([]);
  const [locTo, setLocTo] = useState([]);

  useEffect(() => {
    getAdminProducts().then(r => setProducts(r.data || [])).catch(() => {});
  }, []);

  const loadLocs = async (side, warehouseId) => {
    const key = side === 'from' ? 'from_location_id' : 'to_location_id';
    setNm(prev => ({ ...prev, [key]: '' }));
    if (!warehouseId) {
      if (side === 'from') { setLocFrom([]); } else { setLocTo([]); }
      return;
    }
    try {
      const r = await getWarehouseLocations(warehouseId);
      if (side === 'from') { setLocFrom(r.data || []); } else { setLocTo(r.data || []); }
    } catch {
      if (side === 'from') { setLocFrom([]); } else { setLocTo([]); }
    }
  };

  const openNew = () => { setNm(emptyNm); setLocFrom([]); setLocTo([]); setNmError(''); setShowNew(true); };

  const submitTransfer = async () => {
    if (!nm.product_id) return setNmError('Select a product');
    if (!nm.from_warehouse_id || !nm.to_warehouse_id) return setNmError('Choose source and destination warehouses');
    if (!nm.qty || parseInt(nm.qty) <= 0) return setNmError('Quantity must be at least 1');
    setSavingNew(true);
    setNmError('');
    try {
      await transferInventory({
        product_id: parseInt(nm.product_id),
        from_warehouse_id: parseInt(nm.from_warehouse_id),
        from_location_id: nm.from_location_id ? parseInt(nm.from_location_id) : null,
        to_warehouse_id: parseInt(nm.to_warehouse_id),
        to_location_id: nm.to_location_id ? parseInt(nm.to_location_id) : null,
        quantity: parseInt(nm.qty),
        note: nm.note || undefined,
      });
      setShowNew(false);
      loadMovements();
    } catch (err) {
      setNmError(err.response?.data?.error || 'Transfer failed');
    } finally {
      setSavingNew(false);
    }
  };

  useEffect(() => {
    getWarehouses()
      .then(res => setWarehouses(res.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadMovements();
  }, [filters]);

  function loadMovements() {
    setLoading(true);
    const params = {};
    if (filters.type) params.type = filters.type;
    if (filters.warehouse_id) params.warehouse_id = filters.warehouse_id;
    params.limit = filters.limit;
    params.offset = filters.offset;

    getInventoryMovements(params)
      .then(res => {
        const data = res.data || [];
        setMovements(data);
        setTotal(data.length);
      })
      .catch(err => console.error('Error loading movements:', err))
      .finally(() => setLoading(false));
  }

  function updateFilter(key, value) {
    setFilters(prev => ({ ...prev, [key]: value, offset: 0 }));
  }

  const columns = [
    {
      key: 'created_at',
      label: 'Date',
      render: (row) => (
        <span className="text-xs text-gray-500">{formatDate(row.created_at)}</span>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      render: (row) => {
        const colors = {
          opening_balance: 'bg-blue-100 text-blue-700',
          receipt: 'bg-green-100 text-green-700',
          issue: 'bg-red-100 text-red-700',
          adjustment: 'bg-yellow-100 text-yellow-700',
          transfer: 'bg-purple-100 text-purple-700',
          return: 'bg-teal-100 text-teal-700',
          damage: 'bg-gray-100 text-gray-700',
          reservation: 'bg-orange-100 text-orange-700',
          release: 'bg-indigo-100 text-indigo-700',
          correction: 'bg-pink-100 text-pink-700',
          count: 'bg-cyan-100 text-cyan-700',
        };
        return (
          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${colors[row.type] || 'bg-gray-100 text-gray-700'}`}>
            {row.type?.replace(/_/g, ' ')}
          </span>
        );
      },
    },
    {
      key: 'product_name',
      label: 'Product',
      render: (row) => row.product_id ? (
        <a
          href={storeProductUrl(row.product_id)}
          target="_blank" rel="noopener noreferrer"
          className="text-primary-600 hover:underline font-medium"
          title="Open product page"
        >
          {row.product_name || `Product #${row.product_id}`}
        </a>
      ) : (row.product_name || '—'),
    },
    {
      key: 'warehouse_name',
      label: 'Warehouse',
      render: (row) => (
        <Link to="/inventory/warehouses" className="text-gray-700 hover:text-primary-600 hover:underline" title="Open warehouses page">
          {row.warehouse_name || `WH #${row.warehouse_id}`}
        </Link>
      ),
    },
    {
      key: 'qty_change',
      label: 'Change',
      align: 'right',
      render: (row) => (
        <span className={`font-semibold ${row.qty_change > 0 ? 'text-green-600' : 'text-red-600'}`}>
          {row.qty_change > 0 ? '+' : ''}{row.qty_change}
        </span>
      ),
    },
    {
      key: 'qty_before_after',
      label: 'Before → After',
      align: 'right',
      render: (row) => (
        <span className="text-xs text-gray-500">
          {row.qty_before} → {row.qty_after}
        </span>
      ),
    },
    {
      key: 'reason',
      label: 'Reason',
      render: (row) => row.reason || '—',
    },
    {
      key: 'reference',
      label: 'Reference',
      render: (row) => {
        if (row.reference_type && row.reference_id) {
          return `${row.reference_type} #${row.reference_id}`;
        }
        return row.note || '—';
      },
    },
    {
      key: 'created_by',
      label: 'User',
      render: (row) => row.created_by || '—',
    },
    {
      key: 'actions',
      label: '',
      render: (row) => (
        <button
          onClick={() => setViewDoc({ url: viewMovementUrl(row.id), title: `Movement #${row.id} — ${row.type || ''}` })}
          className="px-2.5 py-1 text-xs bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          View
        </button>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory Movements</h1>
          <p className="text-sm text-gray-500 mt-1">Complete audit trail of all inventory changes</p>
        </div>
        <div className="flex items-center gap-2">
          <a href="/inventory" className="text-sm px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium">
            ← Back to Inventory
          </a>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Movement Type</label>
            <select
              value={filters.type}
              onChange={(e) => updateFilter('type', e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              {MOVEMENT_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Warehouse</label>
            <select
              value={filters.warehouse_id}
              onChange={(e) => updateFilter('warehouse_id', e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">All Warehouses</option>
              {warehouses.map(wh => (
                <option key={wh.id} value={wh.id}>{wh.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Limit</label>
            <select
              value={filters.limit}
              onChange={(e) => updateFilter('limit', parseInt(e.target.value))}
              className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
          </div>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={movements}
        loading={loading}
        emptyMessage="No movements found"
      />

      {viewDoc && <DocumentViewer url={viewDoc.url} title={viewDoc.title} onClose={() => setViewDoc(null)} />}

      {/* New movement / transfer modal */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowNew(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl border border-gray-200 p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-gray-900 mb-1">New Inventory Movement</h2>
            <p className="text-xs text-gray-500 mb-4">Warehouse → warehouse, or shelf → shelf inside the same warehouse. Both legs commit atomically.</p>
            {nmError && <div className="mb-3 p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">{nmError}</div>}
            <div className="space-y-3">
              <div>
                <label className={labelClass}>Product *</label>
                <select className={inputClass} value={nm.product_id}
                  onChange={e => setNm(s => ({ ...s, product_id: e.target.value }))}>
                  <option value="">— Select —</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>From Warehouse *</label>
                  <select className={inputClass} value={nm.from_warehouse_id}
                    onChange={e => { setNm(s => ({ ...s, from_warehouse_id: e.target.value })); loadLocs('from', e.target.value); }}>
                    <option value="">— Select —</option>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                  <label className={labelClass + ' mt-2'}>From Shelf</label>
                  <select className={inputClass} value={nm.from_location_id} disabled={!locFrom.length}
                    onChange={e => setNm(s => ({ ...s, from_location_id: e.target.value }))}>
                    <option value="">{locFrom.length ? 'Whole warehouse' : '—'}</option>
                    {locFrom.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>To Warehouse * {nm.from_warehouse_id && nm.from_warehouse_id === nm.to_warehouse_id ? '(shelf move)' : ''}</label>
                  <select className={inputClass} value={nm.to_warehouse_id}
                    onChange={e => { setNm(s => ({ ...s, to_warehouse_id: e.target.value })); loadLocs('to', e.target.value); }}>
                    <option value="">— Select —</option>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                  <label className={labelClass + ' mt-2'}>To Shelf</label>
                  <select className={inputClass} value={nm.to_location_id} disabled={!locTo.length}
                    onChange={e => setNm(s => ({ ...s, to_location_id: e.target.value }))}>
                    <option value="">{locTo.length ? 'Whole warehouse' : '—'}</option>
                    {locTo.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Quantity *</label>
                  <input type="number" min="1" className={inputClass} value={nm.qty}
                    onChange={e => setNm(s => ({ ...s, qty: e.target.value }))} />
                </div>
                <div>
                  <label className={labelClass}>Note</label>
                  <input className={inputClass} value={nm.note}
                    onChange={e => setNm(s => ({ ...s, note: e.target.value }))} />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => setShowNew(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg">Cancel</button>
                <button onClick={submitTransfer} disabled={savingNew}
                  className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">
                  {savingNew ? 'Moving…' : 'Move stock'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {movements.length >= filters.limit && (
        <div className="flex justify-center mt-4">
          <button
            onClick={() => setFilters(prev => ({ ...prev, offset: prev.offset + prev.limit }))}
            className="text-sm px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
          >
            Load More
          </button>
        </div>
      )}
    </div>
  );
}
