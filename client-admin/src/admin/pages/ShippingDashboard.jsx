import { useState, useEffect } from 'react';
import { Check } from 'lucide-react';
import {
  getShipmentProviders, createShipmentProvider, updateShipmentProvider, deleteShipmentProvider,
  getShipments, createShipment, updateShipmentStatus, getAdminOrders, viewShippingUrl,
} from '../../api/adminApi';
import DocumentViewer from '../components/DocumentViewer';
import { useAdminCurrency } from '../../utils/currency';

const SHIPMENT_STATUSES = ['pending', 'in_transit', 'out_for_delivery', 'delivered', 'failed', 'returned'];

const STATUS_STYLE = {
  pending: 'bg-yellow-100 text-yellow-700',
  in_transit: 'bg-blue-100 text-blue-700',
  out_for_delivery: 'bg-indigo-100 text-indigo-700',
  delivered: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  returned: 'bg-gray-200 text-gray-600',
};

const inputClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500';
const labelClass = 'block text-xs font-medium text-gray-600 mb-1';

export default function ShippingDashboard() {
  const { format } = useAdminCurrency();
  const [providers, setProviders] = useState([]);
  const [shipments, setShipments] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [viewDoc, setViewDoc] = useState(null);

  // create shipment modal
  const [showCreate, setShowCreate] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [providerId, setProviderId] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [estimatedDelivery, setEstimatedDelivery] = useState('');
  const [notes, setNotes] = useState('');
  const [creating, setCreating] = useState(false);

  // provider modal
  const [showProvider, setShowProvider] = useState(false);
  const [provForm, setProvForm] = useState({ name: '', type: 'company', contact_phone: '', website: '', tracking_url_template: '' });
  const [provSaving, setProvSaving] = useState(false);

  useEffect(() => { loadAll(); }, []);

  function loadAll() {
    setLoading(true);
    Promise.all([
      getShipmentProviders(),
      getShipments(),
      getAdminOrders({ limit: 100 }).catch(() => ({ data: { orders: [] } })),
    ])
      .then(([provRes, shipRes, ordersRes]) => {
        setProviders(provRes.data || []);
        setShipments(shipRes.data || []);
        setOrders(ordersRes.data?.orders || []);
      })
      .catch(err => console.error('Error loading shipping:', err))
      .finally(() => setLoading(false));
  }

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 3000); };

  const handleCreateShipment = async () => {
    if (!orderId) return setError('Select an order');
    setCreating(true);
    setError('');
    try {
      const res = await createShipment({
        order_id: parseInt(orderId),
        provider_id: providerId ? parseInt(providerId) : null,
        tracking_number: trackingNumber,
        estimated_delivery: estimatedDelivery || null,
        notes,
      });
      flash(`Shipment created — tracking ${res.data.tracking_number}`);
      setShowCreate(false);
      setOrderId(''); setTrackingNumber(''); setEstimatedDelivery(''); setNotes('');
      await loadAll();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create shipment');
    } finally {
      setCreating(false);
    }
  };

  const handleStatus = async (shipment, status) => {
    try {
      await updateShipmentStatus(shipment.id, status);
      flash(`Shipment #${shipment.id} → ${status}`);
      await loadAll();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update');
    }
  };

  const handleSaveProvider = async () => {
    if (!provForm.name.trim()) return setError('Provider name is required');
    setProvSaving(true);
    setError('');
    try {
      if (provForm.id) {
        await updateShipmentProvider(provForm.id, provForm);
      } else {
        await createShipmentProvider(provForm);
      }
      setShowProvider(false);
      setProvForm({ name: '', type: 'company', contact_phone: '', website: '', tracking_url_template: '' });
      await loadAll();
      flash('Provider saved');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save provider');
    } finally {
      setProvSaving(false);
    }
  };

  const handleDeleteProvider = async (p) => {
    if (!window.confirm(`Delete provider "${p.name}"? Its shipments will be removed too.`)) return;
    try {
      await deleteShipmentProvider(p.id);
      await loadAll();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete');
    }
  };

  const shippedOrderIds = new Set(shipments.map(s => s.order_id));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Shipping</h1>
          <p className="text-sm text-gray-500 mt-1">Employee / Local Contractor / Shipping Company — tracking, ETA, delivery</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setShowProvider(true); setError(''); }} className="px-4 py-2 text-sm bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium">
            + Provider
          </button>
          <button onClick={() => { setShowCreate(true); setError(''); }} className="btn-primary">+ New Shipment</button>
        </div>
      </div>

      {msg && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">{msg}</div>}
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

      {/* Providers */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Delivery Providers</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {providers.map(p => (
            <div key={p.id} className="border border-gray-200 rounded-xl p-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900 text-sm">{p.name}</p>
                  <p className="text-xs text-gray-400">{p.type} {p.contact_phone && `· ${p.contact_phone}`}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => { setProvForm({ id: p.id, name: p.name, type: p.type, contact_phone: p.contact_phone || '', website: p.website || '', tracking_url_template: p.tracking_url_template || '' }); setShowProvider(true); }}
                    className="px-2 py-1 text-xs bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Edit
                  </button>
                  <button onClick={() => handleDeleteProvider(p)} className="px-2 py-1 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100">✕</button>
                </div>
              </div>
              {p.tracking_url_template && <p className="text-[10px] text-gray-400 mt-1 truncate font-mono">{p.tracking_url_template}</p>}
            </div>
          ))}
        </div>
      </div>

      {/* Shipments */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">Shipments ({shipments.length})</h2>
        </div>
        {shipments.length === 0 ? (
          <div className="p-12 text-center text-sm text-gray-400">No shipments yet — create one from a ready order.</div>
        ) : (
          <div className="divide-y divide-gray-100 max-h-[34rem] overflow-y-auto">
            {shipments.map(s => (
              <div key={s.id} className="px-5 py-3.5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">Shipment #{s.id} · Order #{s.order_id}</span>
                      <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_STYLE[s.status] || 'bg-gray-100 text-gray-600'}`}>{s.status.replace(/_/g, ' ')}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {s.provider_name || '—'} · Tracking: <span className="font-mono">{s.tracking_number}</span> · {format(s.total || 0)}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {s.customer_name || '—'} · {s.shipping_city || ''} · ETA: {s.estimated_delivery ? new Date(s.estimated_delivery).toLocaleDateString('en-GB') : '—'}
                      {s.delivered_at && ` · Delivered: ${new Date(s.delivered_at).toLocaleString('en-GB')}`}
                    </p>
                    {s.notes && <p className="text-xs text-gray-500 italic mt-0.5">{s.notes}</p>}
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    <button onClick={() => setViewDoc({ url: viewShippingUrl(s.order_id), title: `Shipping Label #${s.order_id}` })} className="px-2.5 py-1 text-xs bg-white border border-gray-300 rounded-lg hover:bg-gray-50">🖨 Label</button>
                    {!['delivered', 'failed', 'returned'].includes(s.status) && (
                      <>
                        {s.status === 'pending' && <button onClick={() => handleStatus(s, 'in_transit')} className="px-2.5 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700">In Transit</button>}
                        {s.status === 'in_transit' && <button onClick={() => handleStatus(s, 'out_for_delivery')} className="px-2.5 py-1 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Out for Delivery</button>}
                        {['in_transit', 'out_for_delivery', 'pending'].includes(s.status) && (
                          <>
                            <button onClick={() => handleStatus(s, 'delivered')} className="px-2.5 py-1 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700">Delivered <Check className="w-3 h-3 inline" /></button>
                            <button onClick={() => handleStatus(s, 'failed')} className="px-2.5 py-1 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700">Failed</button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create shipment modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowCreate(false)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">New Shipment</h2>
            <div className="space-y-3">
              <div>
                <label className={labelClass}>Order *</label>
                <select className={inputClass} value={orderId} onChange={e => setOrderId(e.target.value)}>
                  <option value="">— Select ready order —</option>
                  {orders.filter(o => ['ready_for_shipping', 'shipped', 'confirmed', 'packing'].includes(o.status) && !shippedOrderIds.has(o.id)).map(o => (
                    <option key={o.id} value={o.id}>#{o.id} · {o.customer_name || '—'} · {(o.total / 100).toFixed(2)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Delivery Provider</label>
                <select className={inputClass} value={providerId} onChange={e => setProviderId(e.target.value)}>
                  <option value="">— Auto (default courier) —</option>
                  {providers.map(p => <option key={p.id} value={p.id}>{p.name} ({p.type})</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Tracking number (optional — auto-generated)</label>
                <input className={inputClass} value={trackingNumber} onChange={e => setTrackingNumber(e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Estimated delivery</label>
                <input type="date" className={inputClass} value={estimatedDelivery} onChange={e => setEstimatedDelivery(e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Notes</label>
                <input className={inputClass} value={notes} onChange={e => setNotes(e.target.value)} />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg">Cancel</button>
                <button onClick={handleCreateShipment} disabled={creating} className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">
                  {creating ? 'Creating...' : 'Create Shipment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Provider modal */}
      {showProvider && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowProvider(false)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">{provForm.id ? 'Edit Provider' : 'New Provider'}</h2>
            <div className="space-y-3">
              <div>
                <label className={labelClass}>Name *</label>
                <input className={inputClass} value={provForm.name} onChange={e => setProvForm({ ...provForm, name: e.target.value })} placeholder="e.g. In-House, FedEx, Local Guy" />
              </div>
              <div>
                <label className={labelClass}>Type</label>
                <select className={inputClass} value={provForm.type} onChange={e => setProvForm({ ...provForm, type: e.target.value })}>
                  <option value="employee">Employee (in-house)</option>
                  <option value="contractor">Local Contractor</option>
                  <option value="company">Shipping Company</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Contact phone</label>
                <input className={inputClass} value={provForm.contact_phone} onChange={e => setProvForm({ ...provForm, contact_phone: e.target.value })} />
              </div>
              <div>
                <label className={labelClass}>Website</label>
                <input className={inputClass} value={provForm.website} onChange={e => setProvForm({ ...provForm, website: e.target.value })} />
              </div>
              <div>
                <label className={labelClass}>Tracking URL template</label>
                <input className={inputClass} value={provForm.tracking_url_template} onChange={e => setProvForm({ ...provForm, tracking_url_template: e.target.value })} placeholder="https://.../?trknbr={TRACKING}" />
                <p className="text-[11px] text-gray-400 mt-1">Use {'{TRACKING}'} as the tracking-number placeholder.</p>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setShowProvider(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg">Cancel</button>
                <button onClick={handleSaveProvider} disabled={provSaving} className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">
                  {provSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {viewDoc && <DocumentViewer url={viewDoc.url} title={viewDoc.title} onClose={() => setViewDoc(null)} />}
    </div>
  );
}
