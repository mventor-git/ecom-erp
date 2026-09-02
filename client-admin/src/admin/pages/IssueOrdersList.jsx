import { useState, useEffect } from 'react';
import DataTable from '../components/DataTable';
import DocumentViewer from '../components/DocumentViewer';
import {
  getIssueOrders, addIssueItem, removeIssueItem,
  issueIssueOrder, cancelIssueOrder, getAdminProducts, getWarehouses,
  getIssueOrder, viewIssueOrderUrl,
} from '../../api/adminApi';
import AdminIcon from '../components/AdminIcon';
import { useLanguage } from '../../i18n';

const inputClass = 'w-full border border-gray-300 dark:border-white/10 rounded-lg px-3 py-2 text-sm bg-white dark:bg-dark-800 text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500';
const labelClass = 'block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1';

/**
 * Issue Orders — stock OUT to stores, branches and external recipients.
 * Every issue deducts inventory at cost and feeds COGS in profit reports;
 * each order prints as a branded document with signature lines.
 */
export default function IssueOrdersList() {
  const { t } = useLanguage();
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savedMsg, setSavedMsg] = useState('');
  const [error, setError] = useState('');
  const [viewDoc, setViewDoc] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const [editing, setEditing] = useState(null);
  const [newProduct, setNewProduct] = useState('');
  const [newQty, setNewQty] = useState('');
  const [newCost, setNewCost] = useState(''); // EGP
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [issueWarehouse, setIssueWarehouse] = useState('');

  useEffect(() => { loadAll(); }, []);

  function loadAll() {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (search.trim()) params.set('search', search.trim());
    if (dateFrom) params.set('from', dateFrom);
    if (dateTo) params.set('to', dateTo);
    params.set('page', String(currentPage));
    params.set('limit', '25');
    Promise.all([
      getIssueOrders(params.toString() ? '?' + params.toString() : ''),
      getAdminProducts().catch(() => ({ data: [] })),
      getWarehouses().catch(() => ({ data: [] })),
    ])
      .then(([ordersRes, prodRes, whRes]) => {
        const data = ordersRes.data || {};
        setOrders(Array.isArray(data.items) ? data.items : (Array.isArray(data) ? data : []));
        setProducts(prodRes.data || []);
        setWarehouses(whRes.data || []);
        if (!issueWarehouse && whRes.data[0]) setIssueWarehouse(String(whRes.data[0].id));
      })
      .catch(err => console.error('Error loading issue orders:', err))
      .finally(() => setLoading(false));
  }

  function applyFilters() {
    setCurrentPage(1);
    loadAll();
  }

  const handleAddItem = async () => {
    if (!editing) return;
    if (!newProduct || !newQty || parseInt(newQty) <= 0) return setError(t('Select product and quantity'));
    try {
      await addIssueItem(editing.id, {
        product_id: parseInt(newProduct),
        qty: parseInt(newQty),
        unit_cost: Math.round((parseFloat(newCost) || 0) * 100), // EGP → cents
      });
      const detail = await getIssueOrder(editing.id);
      setEditing(detail.data);
      setNewProduct(''); setNewQty(''); setNewCost('');
      setError('');
      await loadAll();
    } catch (err) {
      setError(err.response?.data?.error || t('Failed to add item'));
    }
  };

  const handleRemoveItem = async (itemId) => {
    try {
      await removeIssueItem(itemId);
      const detail = await getIssueOrder(editing.id);
      setEditing(detail.data);
      await loadAll();
    } catch (err) {
      setError(err.response?.data?.error || t('Failed to remove item'));
    }
  };

  const handleIssue = async (id) => {
    if (!issueWarehouse) return setError(t('Select the issuing warehouse first'));
    if (!window.confirm(t('Issue this order? Stock will be deducted and packing users notified.'))) return;
    setBusyId(id);
    setError('');
    try {
      await issueIssueOrder(id, parseInt(issueWarehouse));
      setSavedMsg(t('Issue order issued — stock deducted, packing notified, document generated'));
      setTimeout(() => setSavedMsg(''), 4000);
      await loadAll();
    } catch (err) {
      setError(err.response?.data?.error || t('Failed to issue'));
    } finally {
      setBusyId(null);
    }
  };

  const handleCancel = async (id) => {
    if (!window.confirm(t('Cancel this draft issue order?'))) return;
    try {
      await cancelIssueOrder(id);
      await loadAll();
    } catch (err) {
      setError(err.response?.data?.error || t('Failed to cancel'));
    }
  };

  // ── derived stats & filtering ──
  const q = search.toLowerCase().trim();
  const matches = (r) => !q
    || (r.order_number || '').toLowerCase().includes(q)
    || (r.customer_name || '').toLowerCase().includes(q);
  const byStatus = (s) => orders.filter(r => r.status === s && matches(r));
  const filtered = statusFilter ? byStatus(statusFilter) : orders.filter(matches);

  const STATUS_TABS = ['', 'draft', 'issued', 'cancelled'];
  const countFor = (s) => (s ? orders.filter(r => r.status === s).length : orders.length);

  const statusPill = (s) => (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
      s === 'issued'
        ? 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400'
        : s === 'cancelled'
          ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400'
          : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${
        s === 'issued' ? 'bg-green-500' : s === 'cancelled' ? 'bg-red-500' : 'bg-yellow-500'
      }`} />
      {t(s)}
    </span>
  );

  const columns = [
    { key: 'order_number', label: t('Number'), render: (r) => (
      <span className="font-semibold text-gray-900 dark:text-white">{r.order_number}</span>
    ) },
    { key: 'customer_name', label: t('Customer'), render: (r) => r.customer_name || '—' },
    { key: 'item_count', label: t('Lines'), align: 'center' },
    { key: 'total_qty', label: t('Total Qty'), align: 'center' },
    {
      key: 'created_at', label: t('Created'),
      render: (r) => r.created_at
        ? <span className="text-xs text-gray-500 dark:text-gray-400">{new Date(r.created_at).toLocaleDateString('en-GB')}</span>
        : '—',
    },
    { key: 'status', label: t('Status'), render: (r) => statusPill(r.status) },
    {
      key: 'actions', label: '', render: (r) => (
        <div className="flex items-center gap-1.5 justify-end">
          <button onClick={() => setViewDoc({ url: viewIssueOrderUrl(r.id), title: `${t('Issue Order')} ${r.order_number}` })}
            className="px-2.5 py-1 text-xs bg-white dark:bg-dark-700 border border-gray-200 dark:border-white/10 rounded-lg hover:border-primary-300 text-gray-700 dark:text-gray-200 transition-colors">
            {t('View')}
          </button>
          {r.status === 'draft' && (
            <>
              <button onClick={() => setEditing(r)}
                className="px-2.5 py-1 text-xs bg-primary-50 dark:bg-primary-500/15 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-500/30 rounded-lg hover:bg-primary-100 transition-colors">
                {t('Items')}
              </button>
              <button onClick={() => handleIssue(r.id)} disabled={busyId === r.id}
                className="px-2.5 py-1 text-xs bg-primary-600 text-white rounded-lg hover:bg-primary-500 disabled:opacity-40 font-semibold transition-colors">
                {busyId === r.id ? '…' : t('Issue')}
              </button>
              <button onClick={() => handleCancel(r.id)}
                className="px-2.5 py-1 text-xs bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/30 rounded-lg hover:bg-red-100 transition-colors">
                {t('Cancel')}
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <AdminIcon name="upload" className="w-6 h-6 text-primary-600" />
            {t('Issue Orders')}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {t('Stock OUT to stores, branches and external recipients — every issue deducts inventory at cost and feeds COGS in the profit reports.')}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {savedMsg && <span className="text-sm text-green-600 dark:text-green-400 font-medium">{savedMsg}</span>}
          <label className="text-xs text-gray-500 dark:text-gray-400">{t('Issuing warehouse')}</label>
          <select className={inputClass + ' !w-52'} value={issueWarehouse} onChange={e => setIssueWarehouse(e.target.value)}>
            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
      </div>

      {/* Status tabs + search */}
      <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-white/10 p-4 mb-6">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex flex-wrap gap-1.5 p-1 bg-gray-100 dark:bg-dark-900 rounded-xl">
            {STATUS_TABS.map(s => (
              <button key={s || 'all'} onClick={() => setStatusFilter(s)}
                className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  statusFilter === s
                    ? 'bg-white dark:bg-dark-700 text-primary-700 dark:text-primary-300 shadow-sm font-semibold'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-800'
                }`}>
                {s ? t(s) : t('All')} ({countFor(s)})
              </button>
            ))}
          </div>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('Search by number or customer...')}
            className="flex-1 min-w-48 border border-gray-300 dark:border-white/10 rounded-lg px-3 py-2 text-sm bg-white dark:bg-dark-800 text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg text-sm text-red-600 dark:text-red-400">{error}</div>}

      <DataTable columns={columns} data={filtered} loading={loading} emptyMessage={t('No issue orders yet')} />

      {/* Items modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setEditing(null)} />
          <div className="relative w-full max-w-2xl bg-white dark:bg-dark-800 rounded-2xl shadow-xl border border-gray-200 dark:border-white/10 max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  {t('Issue Order')} {editing.order_number}
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {t('Customer')}: {editing.customer_name || '—'} · {t('Status')}: {editing.status}
                </p>
              </div>
              <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <div className="flex items-end gap-2 mb-4 flex-wrap">
              <div className="min-w-44 flex-1">
                <label className={labelClass}>{t('Product')}</label>
                <select className={inputClass} value={newProduct} onChange={e => setNewProduct(e.target.value)}>
                  <option value="">— {t('Select')} —</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="w-24">
                <label className={labelClass}>{t('Qty')}</label>
                <input type="number" min="1" className={inputClass} value={newQty} onChange={e => setNewQty(e.target.value)} />
              </div>
              <div className="w-32">
                <label className={labelClass}>{t('Unit Cost (EGP)')}</label>
                <input type="number" min="0" step="0.01" className={inputClass} value={newCost} onChange={e => setNewCost(e.target.value)} />
              </div>
              <button onClick={handleAddItem} className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-500 font-semibold transition-colors">+ {t('Add')}</button>
            </div>
            <p className="text-[11px] text-gray-400 -mt-2 mb-4">
              {t('The unit cost here is what this issue books as COGS in the profit reports.')}
            </p>

            <div className="border border-gray-200 dark:border-white/10 rounded-xl divide-y divide-gray-100 dark:divide-white/5 overflow-hidden">
              {(editing.items || []).map(item => (
                <div key={item.id} className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                  <span className="font-medium text-gray-900 dark:text-white">{item.product_name || `${t('Product')} #${item.product_id}`}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-gray-500 dark:text-gray-400">{t('Qty')}: <b className="text-gray-900 dark:text-white">{item.qty}</b></span>
                    <span className="text-gray-500 dark:text-gray-400 tabular-nums">{((item.unit_cost || 0) / 100).toFixed(2)} EGP</span>
                    {editing.status === 'draft' && (
                      <button onClick={() => handleRemoveItem(item.id)} className="text-red-400 hover:text-red-600 transition-colors">✕</button>
                    )}
                  </div>
                </div>
              ))}
              {(editing.items || []).length === 0 && (
                <div className="p-6 text-center text-sm text-gray-400">{t('No items yet')}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {viewDoc && <DocumentViewer url={viewDoc.url} title={viewDoc.title} onClose={() => setViewDoc(null)} />}
    </div>
  );
}
