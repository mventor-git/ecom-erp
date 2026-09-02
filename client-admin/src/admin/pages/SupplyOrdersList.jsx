import { useState, useEffect } from 'react';
import DataTable from '../components/DataTable';
import DocumentViewer from '../components/DocumentViewer';
import ConfirmDialog from '../components/ConfirmDialog';
import { egpToCents, centsToEGPInput } from '../../utils/money';
import { useLanguage } from '../../i18n';
import { useAdminCurrency } from '../../utils/currency';
import {
  getSupplyOrders, createSupplyOrder, addSupplyItem, removeSupplyItem,
  issueSupplyOrder, cancelSupplyOrder, getAdminProducts, getWarehouses,
  getAdminCategories, createProduct, getSuppliers, viewSupplyOrderUrl,
} from '../../api/adminApi';

const inputClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500';
const labelClass = 'block text-xs font-medium text-gray-600 mb-1';

export default function SupplyOrdersList() {
  const { t } = useLanguage();
  const { format } = useAdminCurrency();
  const formatMoney = (cents) => format(cents);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savedMsg, setSavedMsg] = useState('');
  const [viewDoc, setViewDoc] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null); // {type:'issue'|'cancel', order}

  // create modal
  const [showCreate, setShowCreate] = useState(false);
  const [supplier, setSupplier] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [note, setNote] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  // items modal
  const [editing, setEditing] = useState(null); // order being edited
  const totalCents = (editing?.items || []).reduce((s, i) => s + (i.qty || 0) * (i.unit_cost || 0), 0);
  const [newProduct, setNewProduct] = useState('');
  const [newQty, setNewQty] = useState('');
  const [newCost, setNewCost] = useState('');
  const [busyId, setBusyId] = useState(null);
  // add-items mode: pick an EXISTING product or register a NEW one inline
  const [itemMode, setItemMode] = useState('existing');
  const [categories, setCategories] = useState([]);
  const [newProd, setNewProd] = useState({ name: '', name_ar: '', category_id: '' });

  useEffect(() => { loadAll(); }, []);

  function loadAll() {
    setLoading(true);
    Promise.all([
      getSupplyOrders(),
      getAdminProducts().catch(() => ({ data: [] })),
      getWarehouses().catch(() => ({ data: [] })),
      getAdminCategories().catch(() => ({ data: [] })),
      getSuppliers().catch(() => ({ data: [] })),
    ])
      .then(([ordersRes, prodRes, whRes, catRes, supRes]) => {
        setOrders(ordersRes.data || []);
        setProducts(prodRes.data || []);
        setWarehouses(whRes.data || []);
        setCategories(catRes.data || []);
        setSuppliers(supRes.data || []);
      })
      .catch(err => console.error('Error loading supply orders:', err))
      .finally(() => setLoading(false));
  }

  const handleCreate = async () => {
    if (!supplier.trim()) return setError(t('Supplier name is required'));
    setCreating(true);
    setError('');
    try {
      const res = await createSupplyOrder({
        supplierName: supplier.trim(),
        supplierId: supplierId ? parseInt(supplierId) : null,
        warehouseId: parseInt(warehouseId) || 1,
        note,
      });
      setShowCreate(false);
      setSupplier(''); setSupplierId(''); setNote(''); setWarehouseId('');
      setEditing(res.data); // go straight to adding items
      await loadAll();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create');
    } finally {
      setCreating(false);
    }
  };

  const refreshEditing = async () => {
    const fresh = await import('../../api/adminApi');
    const detail = await fresh.getSupplyOrder(editing.id);
    setEditing(detail.data);
  };

  const handleAddItem = async () => {
    if (!editing) return;
    const qty = parseInt(newQty, 10);
    if (!newProduct) return setError(t('Select a product'));
    if (!qty || qty <= 0) return setError(t('Enter a quantity greater than zero'));
    const cost = egpToCents(newCost);
    if (!cost.ok) return setError(cost.reason === 'negative' ? t('Cost cannot be negative') : t('Enter a valid unit cost'));
    try {
      await addSupplyItem(editing.id, { product_id: parseInt(newProduct), qty, unit_cost: cost.cents });
      const res = await getSupplyOrders();
      setOrders(res.data || []);
      setEditing({ ...editing, items: [...(editing.items || []), {}] });
      setNewProduct(''); setNewQty(''); setNewCost('');
      setError('');
      // refresh editing order items
      await refreshEditing();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add item');
    }
  };

  // NEW-product path: create the catalog entry (wholesale-only — retail is
  // derived server-side from the default markup), then add it as an item.
  const handleAddNewItem = async () => {
    if (!editing) return;
    if (!newProd.name.trim()) return setError(t('New product needs a name'));
    const qty = parseInt(newQty, 10);
    if (!qty || qty <= 0) return setError(t('Enter a quantity greater than zero'));
    const wholesale = newProd.wholesale != null && String(newProd.wholesale).trim() !== '' ? newProd.wholesale : newCost;
    const cost = egpToCents(wholesale);
    if (!cost.ok) return setError(cost.reason === 'negative' ? t('Cost cannot be negative') : t('Enter a valid wholesale cost'));
    try {
      const created = await createProduct({
        name: newProd.name.trim(),
        name_ar: newProd.name_ar || '',
        category_id: parseInt(newProd.category_id) || 1,
        cost_price: cost.cents,
      });
      const productId = created.data.id;
      await addSupplyItem(editing.id, {
        product_id: productId,
        qty: parseInt(newQty),
        unit_cost: Math.round((parseFloat(newProd.wholesale ?? newCost) || 0) * 100),
      });
      const res = await getSupplyOrders();
      setOrders(res.data || []);
      setNewProd({ name: '', name_ar: '', category_id: '', wholesale: '' });
      setNewQty(''); setNewCost('');
      setError('');
      await refreshEditing();
      await loadAll();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create product / add item');
    }
  };

  const handleRemoveItem = async (itemId) => {
    try {
      await removeSupplyItem(itemId);
      const fresh = await import('../../api/adminApi');
      const detail = await fresh.getSupplyOrder(editing.id);
      setEditing(detail.data);
      await loadAll();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to remove item');
    }
  };

  const doIssue = async (id) => {
    setBusyId(id);
    setError('');
    try {
      await issueSupplyOrder(id);
      setSavedMsg(t('Supply order issued — stock added, document + notification sent'));
      setTimeout(() => setSavedMsg(''), 3500);
      await loadAll();
    } catch (err) {
      setError(err.response?.data?.error || t('Failed to issue'));
    } finally {
      setBusyId(null);
    }
  };

  const doCancel = async (id) => {
    try {
      await cancelSupplyOrder(id);
      await loadAll();
    } catch (err) {
      setError(err.response?.data?.error || t('Failed to cancel'));
    }
  };

  const confirmIssue = () => { const o = confirmAction?.order; setConfirmAction(null); o && doIssue(o.id); };
  const confirmCancel = () => { const o = confirmAction?.order; setConfirmAction(null); o && doCancel(o.id); };

  const columns = [
    { key: 'order_number', label: 'Number', render: (r) => <span className="font-semibold">{r.order_number}</span> },
    { key: 'supplier_name', label: 'Supplier', render: (r) => r.supplier_name || '—' },
    { key: 'item_count', label: 'Items', align: 'center' },
    { key: 'total_qty', label: 'Total Qty', align: 'center' },
    {
      key: 'status', label: 'Status', render: (r) => (
        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${r.status === 'issued' ? 'bg-green-100 text-green-700' : r.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
          {r.status}
        </span>
      ),
    },
    {
      key: 'actions', label: '', render: (r) => (
        <div className="flex items-center gap-1.5 justify-end">
          <button onClick={() => setViewDoc({ url: viewSupplyOrderUrl(r.id), title: `Supply Order ${r.order_number}` })} className="px-2.5 py-1 text-xs bg-white border border-gray-300 rounded-lg hover:bg-gray-50">View</button>
          {r.status === 'draft' && (
            <>
              <button onClick={() => setEditing(r)} className="px-2.5 py-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100">Items</button>
              <button onClick={() => setConfirmAction({ type: 'issue', order: r })} disabled={busyId === r.id} className="px-2.5 py-1 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-40">Issue</button>
              <button onClick={() => setConfirmAction({ type: 'cancel', order: r })} className="px-2.5 py-1 text-xs bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100">Cancel</button>
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
          <h1 className="text-2xl font-bold text-gray-900">Supply Orders</h1>
          <p className="text-sm text-gray-500 mt-1">Stock IN from suppliers — add goods to existing products or register brand-new ones; every receipt lands as inventory at wholesale cost.</p>
        </div>
        <button onClick={() => { setShowCreate(true); setError(''); }} className="btn-primary">+ New Supply Order</button>
      </div>

      {savedMsg && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">{savedMsg}</div>}
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

      <DataTable columns={columns} data={orders} loading={loading} emptyMessage="No supply orders yet" />

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowCreate(false)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">New Supply Order</h2>
            <div className="space-y-3">
              <div>
                <label className={labelClass}>{t('Supplier')} *</label>
                <select
                  className={inputClass}
                  value={supplierId}
                  onChange={e => {
                    const id = e.target.value;
                    setSupplierId(id);
                    const s = suppliers.find(x => String(x.id) === String(id));
                    setSupplier(s ? s.name : '');
                  }}
                >
                  <option value="">{t('— Select supplier —')}</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>{t('Supplier name (free text)')}</label>
                <input
                  className={inputClass}
                  value={supplier}
                  onChange={e => {
                    setSupplier(e.target.value);
                    // Editing the name manually breaks the FK link — clear it.
                    const match = suppliers.find(s => s.name === e.target.value);
                    setSupplierId(match ? match.id : '');
                  }}
                  placeholder={t('e.g. Supplier name')}
                />
              </div>
              <div>
                <label className={labelClass}>{t('Warehouse')}</label>
                <select className={inputClass} value={warehouseId} onChange={e => setWarehouseId(e.target.value)}>
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Note</label>
                <input className={inputClass} value={note} onChange={e => setNote(e.target.value)} />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg">Cancel</button>
                <button onClick={handleCreate} disabled={creating} className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">
                  {creating ? 'Creating...' : 'Create Draft'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Items modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setEditing(null)} />
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-gray-200 max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Supply Order {editing.order_number}</h2>
                <p className="text-xs text-gray-500">Supplier: {editing.supplier_name || '—'} · Status: {editing.status}</p>
              </div>
              <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <div className="flex items-end gap-2 mb-4 flex-wrap">
              {/* Mode: add stock to an EXISTING product, or register a NEW one */}
              <div className="flex rounded-lg border border-gray-200 overflow-hidden mb-0.5">
                <button
                  onClick={() => setItemMode('existing')}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${itemMode === 'existing' ? 'bg-primary-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                >Existing product</button>
                <button
                  onClick={() => setItemMode('new')}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${itemMode === 'new' ? 'bg-primary-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                >+ New product</button>
              </div>
            </div>

            {itemMode === 'existing' ? (
              <div className="flex items-end gap-2 mb-4 flex-wrap">
                <div className="min-w-44 flex-1">
                  <label className={labelClass}>Product</label>
                  <select className={inputClass} value={newProduct} onChange={e => setNewProduct(e.target.value)}>
                    <option value="">— Select —</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="w-24">
                  <label className={labelClass}>Qty</label>
                  <input type="number" min="1" className={inputClass} value={newQty} onChange={e => setNewQty(e.target.value)} />
                </div>
                <div className="w-28">
                  <label className={labelClass}>Unit Cost (EGP)</label>
                  <input type="number" min="0" step="0.01" className={inputClass} value={newCost} onChange={e => setNewCost(e.target.value)} />
                </div>
                <button onClick={handleAddItem} className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700">+ Add</button>
              </div>
            ) : (
              <div className="border border-dashed border-gray-300 rounded-xl p-3 mb-4 bg-gray-50/60">
                <p className="text-[11px] text-gray-500 mb-2">
                  Registers the product in the catalog at wholesale cost (retail is derived by the Pricing Engine), then adds it to this supply order.
                </p>
                <div className="flex items-end gap-2 flex-wrap">
                  <div className="min-w-40 flex-1">
                    <label className={labelClass}>Product Name *</label>
                    <input className={inputClass} value={newProd.name}
                      onChange={e => setNewProd(s => ({ ...s, name: e.target.value }))}
                      placeholder="English name" />
                  </div>
                  <div className="w-36">
                    <label className={labelClass}>الاسم بالعربي</label>
                    <input dir="rtl" className={inputClass} value={newProd.name_ar}
                      onChange={e => setNewProd(s => ({ ...s, name_ar: e.target.value }))} />
                  </div>
                  <div className="w-40">
                    <label className={labelClass}>Category</label>
                    <select className={inputClass} value={newProd.category_id}
                      onChange={e => setNewProd(s => ({ ...s, category_id: e.target.value }))}>
                      <option value="">— Select —</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="w-28">
                    <label className={labelClass}>Wholesale (EGP)</label>
                    <input type="number" min="0" step="0.01" className={inputClass} value={newProd.wholesale ?? ''}
                      onChange={e => setNewProd(s => ({ ...s, wholesale: e.target.value }))} />
                  </div>
                  <div className="w-20">
                    <label className={labelClass}>Qty</label>
                    <input type="number" min="1" className={inputClass} value={newQty} onChange={e => setNewQty(e.target.value)} />
                  </div>
                  <button onClick={handleAddNewItem} className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700">Create & Add</button>
                </div>
              </div>
            )}

            <div className="border border-gray-200 rounded-xl divide-y divide-gray-100">
              {(editing.items || []).map(item => {
                const lineCents = (item.qty || 0) * (item.unit_cost || 0); // both are INTEGER units
                return (
                  <div key={item.id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
                    <span className="font-medium truncate">{item.product_name || `Product #${item.product_id}`}</span>
                    <span className="text-xs text-gray-500 shrink-0">{t('Qty')}: <b>{item.qty}</b></span>
                    <span className="text-xs text-gray-500 shrink-0 hidden sm:inline">{t('Unit Cost')}: {formatMoney(item.unit_cost)}</span>
                    <span className="font-semibold shrink-0">{formatMoney(lineCents)}</span>
                    <button onClick={() => handleRemoveItem(item.id)} aria-label={t('Remove item')} className="text-red-400 hover:text-red-600 shrink-0">✕</button>
                  </div>
                );
              })}
              {(editing.items || []).length === 0 && <div className="p-6 text-center text-sm text-gray-400">{t('No items yet')}</div>}
            </div>

            {totalCents > 0 && (
              <div className="mt-3 flex justify-end">
                <div className="w-full sm:w-56 text-sm space-y-1">
                  <div className="flex justify-between text-gray-600">
                    <span>{t('Subtotal')}</span><span>{formatMoney(totalCents)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-gray-900 border-t border-gray-200 pt-1">
                    <span>{t('Grand Total')}</span><span>{formatMoney(totalCents)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmAction?.type === 'issue'}
        title={t('Issue this supply order?')}
        message={t('Stock will be added for every line and the receipt document generated. This cannot be undone.')}
        confirmLabel={t('Issue')}
        tone="primary"
        onConfirm={confirmIssue}
        onCancel={() => setConfirmAction(null)}
      />
      <ConfirmDialog
        open={confirmAction?.type === 'cancel'}
        title={t('Cancel this draft supply order?')}
        message={t('The draft will be cancelled and cannot be issued.')}
        confirmLabel={t('Cancel')}
        tone="danger"
        onConfirm={confirmCancel}
        onCancel={() => setConfirmAction(null)}
      />

      {viewDoc && <DocumentViewer url={viewDoc.url} title={viewDoc.title} onClose={() => setViewDoc(null)} />}
    </div>
  );
}
