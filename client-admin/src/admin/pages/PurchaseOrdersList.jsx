import { useState, useEffect } from 'react';
import DataTable from '../components/DataTable';
import ConfirmDialog from '../components/ConfirmDialog';
import { getPurchaseOrders, getPurchaseOrder, createPurchaseOrder, updatePurchaseOrderStatus, receivePurchaseOrder, getSuppliers, getAdminProducts, getWarehouses } from '../../api/adminApi';
import { useAdminCurrency } from '../../utils/currency';

const STATUS_COLORS = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
  confirmed: 'bg-yellow-100 text-yellow-700',
  received_partial: 'bg-purple-100 text-purple-700',
  received: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

export default function PurchaseOrdersList() {
  const { format } = useAdminCurrency();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState(null);
  const [showReceive, setShowReceive] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [error, setError] = useState('');
  const [pendingCancel, setPendingCancel] = useState(null);

  // Create form state
  const [newPo, setNewPo] = useState({ supplier_id: '', notes: '', expected_at: '', items: [] });

  useEffect(() => { loadOrders(); }, []);

  function loadOrders() {
    setLoading(true);
    getPurchaseOrders()
      .then(res => setOrders(res.data || []))
      .catch(() => setError('Failed to load purchase orders'))
      .finally(() => setLoading(false));
  }

  function openCreate() {
    Promise.all([getSuppliers(), getAdminProducts(), getWarehouses()])
      .then(([supRes, prodRes, whRes]) => {
        setSuppliers((supRes.data || []).filter(s => s.is_active !== 0));
        setProducts(prodRes.data || []);
        setWarehouses(whRes.data || []);
        setNewPo({ supplier_id: '', notes: '', expected_at: '', items: [{ product_id: '', qty_ordered: 1, unit_cost: 0 }] });
        setShowCreate(true);
        setError('');
      });
  }

  function addItem() {
    setNewPo({ ...newPo, items: [...newPo.items, { product_id: '', qty_ordered: 1, unit_cost: 0 }] });
  }

  function updateItem(idx, field, value) {
    const items = [...newPo.items];
    items[idx] = { ...items[idx], [field]: field === 'product_id' ? value : (field === 'unit_cost' ? parseFloat(value) || 0 : parseInt(value) || 0) };
    setNewPo({ ...newPo, items });
  }

  function removeItem(idx) {
    setNewPo({ ...newPo, items: newPo.items.filter((_, i) => i !== idx) });
  }

  function handleCreate() {
    if (!newPo.supplier_id) { setError('Supplier is required'); return; }
    const validItems = newPo.items.filter(i => i.product_id && i.qty_ordered > 0 && i.unit_cost > 0);
    if (validItems.length === 0) { setError('At least one valid item is required'); return; }

    createPurchaseOrder({
      supplier_id: parseInt(newPo.supplier_id),
      notes: newPo.notes,
      expected_at: newPo.expected_at || null,
      items: validItems.map(i => ({ product_id: parseInt(i.product_id), qty_ordered: i.qty_ordered, unit_cost: Math.round(i.unit_cost * 100) })),
    })
      .then(() => { setShowCreate(false); loadOrders(); })
      .catch(err => setError(err.response?.data?.error || 'Failed to create'));
  }

  function handleStatusChange(po, newStatus) {
    updatePurchaseOrderStatus(po.id, newStatus)
      .then(() => { loadOrders(); if (showDetail?.id === po.id) setShowDetail(null); })
      .catch(err => setError(err.response?.data?.error || 'Failed to update status'));
  }

  function openDetail(po) {
    getPurchaseOrder(po.id)
      .then(res => setShowDetail(res.data))
      .catch(() => setError('Failed to load details'));
  }

  function openReceive(po) {
    getPurchaseOrder(po.id)
      .then(res => {
        setShowReceive({
          ...res.data,
          receiveItems: res.data.items.map(i => ({ item_id: i.id, qty_received: i.qty_ordered - i.qty_received, product_name: i.product_name })),
          warehouse_id: warehouses[0]?.id || '',
        });
      })
      .catch(() => setError('Failed to load PO'));
  }

  function handleReceive() {
    const validItems = showReceive.receiveItems.filter(i => i.qty_received > 0);
    if (validItems.length === 0) { setError('At least one item with qty > 0'); return; }

    receivePurchaseOrder(showReceive.id, validItems.map(i => ({ item_id: i.item_id, qty_received: i.qty_received })))
      .then(() => { setShowReceive(null); loadOrders(); })
      .catch(err => setError(err.response?.data?.error || 'Failed to receive'));
  }

  const getNextStatus = (status) => {
    const map = { draft: ['sent', 'cancelled'], sent: ['confirmed', 'cancelled'], confirmed: ['received_partial', 'received', 'cancelled'], received_partial: ['received', 'cancelled'] };
    return map[status] || [];
  };

  const columns = [
    { key: 'po_number', label: 'PO #', render: (row) => <span className="font-mono font-medium text-gray-900">{row.po_number}</span> },
    { key: 'supplier_name', label: 'Supplier' },
    { key: 'status', label: 'Status', render: (row) => (
      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[row.status] || 'bg-gray-100'}`}>{row.status}</span>
    )},
    { key: 'total_cost', label: 'Total', align: 'right', render: (row) => format(row.total_cost || 0) },
    { key: 'created_at', label: 'Created', render: (row) => new Date(row.created_at).toLocaleDateString() },
    { key: 'actions', label: '', render: (row) => (
      <div className="flex gap-2 justify-end">
        <button onClick={() => openDetail(row)} className="text-xs px-3 py-1 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">View</button>
        {['confirmed', 'received_partial'].includes(row.status) && (
          <button onClick={() => openReceive(row)} className="text-xs px-3 py-1 bg-green-50 text-green-700 rounded-lg hover:bg-green-100">Receive</button>
        )}
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Purchase Orders</h1>
          <p className="text-sm text-gray-500 mt-1">Manage purchase orders and goods receipt</p>
        </div>
        <button onClick={openCreate} className="text-sm px-4 py-2 bg-primary-600 rounded-lg text-white hover:bg-primary-700 font-medium">
          + New PO
        </button>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

      <DataTable columns={columns} data={orders} loading={loading} emptyMessage="No purchase orders yet" />

      {/* Create PO Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">New Purchase Order</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Supplier *</label>
                  <select value={newPo.supplier_id} onChange={e => setNewPo({...newPo, supplier_id: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    <option value="">Select supplier...</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Expected Date</label>
                  <input type="date" value={newPo.expected_at} onChange={e => setNewPo({...newPo, expected_at: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={newPo.notes} onChange={e => setNewPo({...newPo, notes: e.target.value})} rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">Items</label>
                  <button onClick={addItem} className="text-xs px-3 py-1 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">+ Add Item</button>
                </div>
                <div className="space-y-2">
                  {newPo.items.map((item, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <select value={item.product_id} onChange={e => updateItem(idx, 'product_id', e.target.value)}
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm">
                        <option value="">Select product...</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      <input type="number" placeholder="Qty" value={item.qty_ordered} onChange={e => updateItem(idx, 'qty_ordered', e.target.value)}
                        className="w-20 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                      <input type="number" placeholder="Cost" value={item.unit_cost} onChange={e => updateItem(idx, 'unit_cost', e.target.value)}
                        className="w-28 border border-gray-300 rounded-lg px-3 py-2 text-sm" step="0.01" />
                      {newPo.items.length > 1 && (
                        <button onClick={() => removeItem(idx)} className="text-red-500 hover:text-red-700 px-2">✕</button>
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-right text-sm text-gray-500">
                  Total: {format(newPo.items.reduce((sum, i) => sum + (i.qty_ordered * i.unit_cost * 100), 0))}
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
              <button onClick={handleCreate} className="px-4 py-2 text-sm text-white bg-primary-600 rounded-lg hover:bg-primary-700">Create PO</button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetail && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{showDetail.po_number}</h2>
                <p className="text-sm text-gray-500">{showDetail.supplier_name}</p>
              </div>
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[showDetail.status]}`}>{showDetail.status}</span>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-3 gap-4 mb-6 text-sm">
                <div><span className="text-gray-500">Total:</span> <span className="font-semibold">{format(showDetail.total_cost || 0)}</span></div>
                <div><span className="text-gray-500">Created:</span> {new Date(showDetail.created_at).toLocaleDateString()}</div>
                <div><span className="text-gray-500">Expected:</span> {showDetail.expected_at ? new Date(showDetail.expected_at).toLocaleDateString() : '—'}</div>
              </div>
              {showDetail.notes && <p className="text-sm text-gray-600 mb-4">{showDetail.notes}</p>}
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-200"><th className="text-left py-2">Product</th><th className="text-right py-2">Ordered</th><th className="text-right py-2">Received</th><th className="text-right py-2">Unit Cost</th><th className="text-right py-2">Total</th></tr></thead>
                <tbody>
                  {(showDetail.items || []).map(item => (
                    <tr key={item.id} className="border-b border-gray-100">
                      <td className="py-2">{item.product_name}</td>
                      <td className="text-right py-2">{item.qty_ordered}</td>
                      <td className="text-right py-2">{item.qty_received || 0}</td>
                      <td className="text-right py-2">{format(item.unit_cost || 0)}</td>
                      <td className="text-right py-2 font-medium">{format((item.qty_ordered || 0) * (item.unit_cost || 0))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-4 flex gap-2 justify-end">
                {getNextStatus(showDetail.status).map(s => (
                  <button key={s} onClick={() => s === 'cancelled' ? setPendingCancel(showDetail) : handleStatusChange(showDetail, s)}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium ${s === 'cancelled' ? 'bg-red-50 text-red-700 hover:bg-red-100' : 'bg-primary-50 text-primary-700 hover:bg-primary-100'}`}>
                    {s === 'sent' ? 'Mark Sent' : s === 'confirmed' ? 'Confirm' : s === 'received' ? 'Mark Received' : s === 'received_partial' ? 'Partial Receive' : 'Cancel'}
                  </button>
                ))}
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end">
              <button onClick={() => setShowDetail(null)} className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Destructive-action confirmation: cancelling a PO is irreversible */}
      <ConfirmDialog
        open={!!pendingCancel}
        title="Cancel purchase order?"
        message={`Cancel ${pendingCancel?.po_number || 'this purchase order'} (${pendingCancel?.supplier_name || ''})? This permanently cancels the order and cannot be undone.`}
        confirmLabel="Yes, cancel order"
        cancelLabel="Keep order"
        tone="danger"
        onConfirm={() => { if (pendingCancel) handleStatusChange(pendingCancel, 'cancelled'); setPendingCancel(null); }}
        onCancel={() => setPendingCancel(null)}
      />

      {/* Receive Modal */}
      {showReceive && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">Receive Goods — {showReceive.po_number}</h2>
              <p className="text-sm text-gray-500">{showReceive.supplier_name}</p>
            </div>
            <div className="p-6 space-y-3">
              {showReceive.receiveItems.map((item, idx) => (
                <div key={item.item_id} className="flex items-center gap-3">
                  <span className="flex-1 text-sm text-gray-700">{item.product_name}</span>
                  <input type="number" value={item.qty_received} onChange={e => {
                    const items = [...showReceive.receiveItems];
                    items[idx] = { ...items[idx], qty_received: parseInt(e.target.value) || 0 };
                    setShowReceive({ ...showReceive, receiveItems: items });
                  }} className="w-20 border border-gray-300 rounded-lg px-3 py-2 text-sm text-center" />
                  <span className="text-xs text-gray-400">/ {item.qty_ordered - (showReceive.items?.[idx]?.qty_received || 0)} remaining</span>
                </div>
              ))}
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button onClick={() => setShowReceive(null)} className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
              <button onClick={handleReceive} className="px-4 py-2 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700">Confirm Receipt</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
