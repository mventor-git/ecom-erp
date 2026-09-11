import { useState, useEffect } from 'react';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import ConfirmDialog from '../components/ConfirmDialog';
import { getPurchaseOrders, getPurchaseOrder, createPurchaseOrder, updatePurchaseOrderStatus, receivePurchaseOrder, getSuppliers, getAdminProducts, getWarehouses, getPoPayables, getPoPayments, recordSupplierPayment, reverseSupplierPayment } from '../../api/adminApi';
import { useAdminCurrency } from '../../utils/currency';
import { egpToCents, centsToEGPInput, egpErrorText } from '../../utils/money';

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
  const [successMsg, setSuccessMsg] = useState('');
  const [pendingCancel, setPendingCancel] = useState(null);
  const [pendingReject, setPendingReject] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState('');
  const [actionLoading, setActionLoading] = useState('');
  // Supplier payments (mventor-ticket-089): PO detail panel state
  const [payables, setPayables] = useState(null);   // { receivable_from_receipts, applied, outstanding }
  const [payments, setPayments] = useState([]);     // payments applied to the open PO
  const [payDialog, setPayDialog] = useState(null); // { amount, notes, key, error, busy }
  const [pendingPayReverse, setPendingPayReverse] = useState(null);
  const [revReason, setRevReason] = useState('');
  const [revError, setRevError] = useState('');
  const [revLoading, setRevLoading] = useState(false);

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

  function handleStatusChange(po, newStatus, opts = {}) {
    const key = `${po.id}:${newStatus}`;
    setActionLoading(key);
    setError('');
    setSuccessMsg('');
    updatePurchaseOrderStatus(po.id, newStatus, opts.reject_reason)
      .then(() => {
        const label = newStatus === 'sent' ? 'submitted' : newStatus === 'confirmed' ? 'approved' : newStatus === 'cancelled' ? 'cancelled' : newStatus;
        setSuccessMsg(`PO ${po.po_number} ${label}`);
        setTimeout(() => setSuccessMsg(''), 3000);
        loadOrders();
        if (showDetail?.id === po.id) {
          // reload detail to show audit fields (approved_by/reject_reason)
          getPurchaseOrder(po.id).then(res => setShowDetail(res.data)).catch(() => setShowDetail(null));
        }
      })
      .catch(err => {
        const msg = err.response?.data?.error || 'Failed to update status';
        // if this was a reject-reason validation, surface inline
        if (opts.reject_reason !== undefined && msg.toLowerCase().includes('rejection reason')) {
          setRejectError(msg);
        } else {
          setError(msg);
        }
      })
      .finally(() => setActionLoading(''));
  }

  function handleRejectConfirm() {
    const reason = String(rejectReason).trim();
    if (!reason) { setRejectError('A rejection reason is required'); return; }
    if (reason.length > 300) { setRejectError('Reason must be ≤ 300 characters'); return; }
    setRejectError('');
    const po = pendingReject;
    setPendingReject(null);
    setRejectReason('');
    handleStatusChange(po, 'cancelled', { reject_reason: reason });
  }

  function openDetail(po) {
    setPayables(null); setPayments([]);
    getPurchaseOrder(po.id)
      .then(res => { setShowDetail(res.data); loadPayables(res.data); })
      .catch(() => setError('Failed to load details'));
  }

  function closeDetail() {
    setShowDetail(null); setPayables(null); setPayments([]);
    setPayDialog(null); setPendingPayReverse(null); setRevReason(''); setRevError('');
  }

  // Read-only payable panel from the server (no local math). Auxiliary fetch:
  // on failure (e.g. missing supplier_payments.read) hide the panel quietly —
  // the record/reverse buttons still 403-surface if actually used.
  function loadPayables(po) {
    Promise.all([getPoPayables(po.id), getPoPayments(po.id)])
      .then(([outRes, payRes]) => { setPayables(outRes.data || null); setPayments(payRes.data || []); })
      .catch(err => {
        setPayables(null); setPayments([]);
        console.error('payables panel:', err?.response?.status || err?.message || err);
      });
  }

  function openPayDialog() {
    // ONE stable idempotency key per dialog session; regenerated on every edit,
    // so a failed submit retried unchanged replays safely, any edit = new txn.
    setPayDialog({ amount: centsToEGPInput(payables?.outstanding || 0), notes: '', key: crypto.randomUUID(), error: '', busy: false });
  }

  function confirmPay() {
    const cents = egpToCents(payDialog.amount);
    if (!cents.ok) { setPayDialog(p => ({ ...p, error: egpErrorText(cents.reason) })); return; }
    const po = showDetail;
    setPayDialog(p => ({ ...p, busy: true, error: '' }));
    recordSupplierPayment({
      supplier_id: po.supplier_id,
      amount: cents.cents,
      applications: [{ purchaseOrderId: po.id, amount: cents.cents }],
      method: 'cash',
      notes: payDialog.notes,
      idempotency_key: payDialog.key,
    })
      .then(() => {
        setPayDialog(null);
        setSuccessMsg(`Payment recorded for ${po.po_number}`);
        setTimeout(() => setSuccessMsg(''), 3000);
        loadPayables(po); // re-read server truth (outstanding, list)
        loadOrders();
      })
      .catch(err => setPayDialog(p => ({ ...p, busy: false, error: err.response?.data?.error || 'Failed to record payment' })));
  }

  function handlePayReverseConfirm() {
    const reason = String(revReason).trim();
    if (!reason) { setRevError('A reversal reason is required'); return; }
    if (reason.length > 300) { setRevError('Reason must be ≤ 300 characters'); return; }
    setRevError('');
    const payment = pendingPayReverse;
    const po = showDetail;
    setRevLoading(true);
    reverseSupplierPayment(payment.id, reason)
      .then(() => {
        setPendingPayReverse(null); setRevReason('');
        setSuccessMsg(`Payment ${payment.payment_no} reversed`);
        setTimeout(() => setSuccessMsg(''), 3000);
        loadPayables(po);
      })
      .catch(err => setRevError(err.response?.data?.error || 'Failed to reverse payment'))
      .finally(() => setRevLoading(false));
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

      {successMsg && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">{successMsg}</div>}
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
              {/* Audit trail — who did what, when */}
              {(showDetail.approved_by || showDetail.rejected_by || showDetail.ordered_at || showDetail.received_at || showDetail.created_by) && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg text-xs text-gray-600 space-y-1">
                  {showDetail.created_by && <div><span className="text-gray-500">Created by:</span> {showDetail.created_by} · {new Date(showDetail.created_at).toLocaleString()}</div>}
                  {showDetail.ordered_at && <div><span className="text-gray-500">Submitted:</span> {new Date(showDetail.ordered_at).toLocaleString()}</div>}
                  {showDetail.approved_by && <div><span className="text-gray-500">Approved by:</span> {showDetail.approved_by} · {showDetail.approved_at ? new Date(showDetail.approved_at).toLocaleString() : '—'}</div>}
                  {showDetail.received_at && <div><span className="text-gray-500">Received:</span> {new Date(showDetail.received_at).toLocaleString()}</div>}
                  {showDetail.reject_reason && (
                    <div className="p-2 bg-red-50 border border-red-200 rounded text-red-700">
                      <span className="font-medium">Rejected by {showDetail.rejected_by || '—'}</span>
                      {showDetail.rejected_at ? ` · ${new Date(showDetail.rejected_at).toLocaleString()}` : ''}: {showDetail.reject_reason}
                    </div>
                  )}
                </div>
              )}
              {/* Supplier payables — derived server-side from posted journals (088/089). Hidden until receipt posting creates a payable. */}
              {payables && (payables.receivable_from_receipts > 0 || payables.applied > 0) && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-900">Supplier Payments</h3>
                    {payables.outstanding > 0 && (
                      <button onClick={openPayDialog}
                        className="text-xs px-3 py-1.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700">
                        Record Payment
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-xs text-gray-600">
                    <div><span className="text-gray-500">Receipt value:</span> <span className="font-semibold text-gray-900">{format(payables.receivable_from_receipts || 0)}</span></div>
                    <div><span className="text-gray-500">Paid:</span> <span className="font-semibold text-gray-900">{format(payables.applied || 0)}</span></div>
                    <div><span className="text-gray-500">Outstanding:</span> <span className={`font-semibold ${payables.outstanding > 0 ? 'text-amber-600' : 'text-green-700'}`}>{format(payables.outstanding || 0)}</span></div>
                  </div>
                  {payments.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {payments.map(p => (
                        <div key={p.id} className="text-xs border border-gray-200 bg-white rounded-lg p-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-medium text-gray-900">{p.payment_no}</span>
                            <span>{format(p.applied_amount || 0)}</span>
                            <StatusBadge status={p.status} />
                            <span className="text-gray-500">{p.paid_at ? new Date(p.paid_at).toLocaleDateString() : '—'}</span>
                            <span className="text-gray-500">· by {p.created_by || '—'}</span>
                            {p.status === 'recorded' && (
                              <button onClick={() => setPendingPayReverse(p)}
                                className="ml-auto text-red-600 hover:text-red-800 font-medium">Reverse</button>
                            )}
                          </div>
                          {p.status === 'reversed' && (
                            <div className="mt-1 text-red-700">Reversed by {p.reversed_by || '—'}: {p.reversal_reason || '—'}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className="mt-4 flex gap-2 justify-end">
                {getNextStatus(showDetail.status).map(s => {
                  const loadingKey = `${showDetail.id}:${s}`;
                  const isLoading = actionLoading === loadingKey;
                  const isRejectFromSent = s === 'cancelled' && showDetail.status === 'sent';
                  return (
                    <button key={s}
                      disabled={!!actionLoading}
                      onClick={() => {
                        if (isRejectFromSent) { setPendingReject(showDetail); setRejectReason(''); setRejectError(''); }
                        else if (s === 'cancelled') setPendingCancel(showDetail);
                        else handleStatusChange(showDetail, s);
                      }}
                      className={`text-xs px-3 py-1.5 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed ${s === 'cancelled' ? 'bg-red-50 text-red-700 hover:bg-red-100' : 'bg-primary-50 text-primary-700 hover:bg-primary-100'}`}>
                      {isLoading ? '...' : s === 'sent' ? 'Mark Sent' : s === 'confirmed' ? 'Approve' : s === 'received' ? 'Mark Received' : s === 'received_partial' ? 'Partial Receive' : 'Cancel'}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end">
              <button onClick={closeDetail} className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Destructive-action confirmation: cancelling a PO is irreversible (non-sent → no reason needed) */}
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

      {/* Rejection with reason: sent → cancelled requires an audit reason */}
      {pendingReject && (
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4" role="presentation">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6" role="dialog" aria-modal="true" aria-labelledby="reject-dialog-title">
            <h3 id="reject-dialog-title" className="text-lg font-bold text-gray-900">Reject purchase order?</h3>
            <p className="mt-2 text-sm text-gray-600">Rejecting <span className="font-mono font-medium">{pendingReject.po_number}</span> ({pendingReject.supplier_name}) requires a reason. The reason and your identity will be recorded and a notification will be sent.</p>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Rejection reason *</label>
              <textarea value={rejectReason} onChange={e => { setRejectReason(e.target.value); if (rejectError) setRejectError(''); }}
                rows={3} maxLength={300} placeholder="e.g., Supplier no longer available, price expired..."
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${rejectError ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-primary-500'}`}
                autoFocus />
              <div className="mt-1 flex items-center justify-between">
                <span className="text-xs text-gray-400">{rejectReason.length}/300</span>
                {rejectError && <span className="text-xs text-red-600">{rejectError}</span>}
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => { setPendingReject(null); setRejectReason(''); setRejectError(''); }}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Keep order</button>
              <button type="button" disabled={!String(rejectReason).trim() || !!actionLoading}
                onClick={handleRejectConfirm}
                className="px-4 py-2 text-sm text-white bg-red-600 rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed">
                {actionLoading ? '...' : 'Reject order'}
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Record Payment (089): posts via 088 API — Dr AP / Cr Cash. Amount in EGP, validated + authority-checked server-side. */}
      {payDialog && (
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4" role="presentation">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6" role="dialog" aria-modal="true" aria-labelledby="pay-dialog-title">
            <h3 id="pay-dialog-title" className="text-lg font-bold text-gray-900">Record supplier payment — {showDetail?.po_number}</h3>
            <p className="mt-2 text-sm text-gray-600">
              Paying <span className="font-medium">{showDetail?.supplier_name}</span> against this order.
              Outstanding: <span className="font-semibold">{format(payables?.outstanding || 0)}</span>. Posts a balanced journal entry (Dr Accounts Payable / Cr Cash).
            </p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment method</label>
                <input value="Cash" readOnly className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-500 cursor-default" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (EGP) *</label>
                <input type="text" value={payDialog.amount} autoFocus maxLength={14}
                  onChange={e => { setPayDialog({ ...payDialog, amount: e.target.value, key: crypto.randomUUID(), error: '' }); }}
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${payDialog.error ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-primary-500'}`} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <input type="text" value={payDialog.notes} maxLength={500}
                  onChange={e => setPayDialog({ ...payDialog, notes: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div className="mt-1 min-h-[1rem]">
                {payDialog.error && <span className="text-xs text-red-600">{payDialog.error}</span>}
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setPayDialog(null)} disabled={payDialog.busy}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50">Cancel</button>
              <button type="button" disabled={payDialog.busy || !String(payDialog.amount).trim()}
                onClick={confirmPay}
                className="px-4 py-2 text-sm text-white bg-green-600 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed">
                {payDialog.busy ? '...' : 'Record payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reverse payment (089): mandatory reason, immutable reversal via 088 — mirrors PO reject UX. */}
      {pendingPayReverse && (
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4" role="presentation">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6" role="dialog" aria-modal="true" aria-labelledby="rev-dialog-title">
            <h3 id="rev-dialog-title" className="text-lg font-bold text-gray-900">Reverse payment {pendingPayReverse.payment_no}?</h3>
            <p className="mt-2 text-sm text-gray-600">Reversing <span className="font-mono font-medium">{pendingPayReverse.payment_no}</span> ({format(pendingPayReverse.applied_amount || 0)}) posts the opposite journal entry and restores the payable. The original payment stays in history. A reason is required and recorded.</p>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Reversal reason *</label>
              <textarea value={revReason} onChange={e => { setRevReason(e.target.value); if (revError) setRevError(''); }}
                rows={3} maxLength={300} placeholder="e.g., Wrong amount, duplicate payment..."
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${revError ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-primary-500'}`}
                autoFocus />
              <div className="mt-1 flex items-center justify-between">
                <span className="text-xs text-gray-400">{revReason.length}/300</span>
                {revError && <span className="text-xs text-red-600">{revError}</span>}
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => { setPendingPayReverse(null); setRevReason(''); setRevError(''); }}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Keep payment</button>
              <button type="button" disabled={!String(revReason).trim() || revLoading}
                onClick={handlePayReverseConfirm}
                className="px-4 py-2 text-sm text-white bg-red-600 rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed">
                {revLoading ? '...' : 'Reverse payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
