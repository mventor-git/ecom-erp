import { useState, useEffect } from 'react';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import DocumentViewer from '../components/DocumentViewer';
import { getAdminOrders, getAdminOrderStats, updateOrderStatus, getOrderStatuses, getOrderTimeline, viewInvoiceUrl, viewReceiptUrl, viewShippingUrl, viewPickingSheetUrl, emailReceipt } from '../../api/adminApi';
import { useAdminCurrency } from '../../utils/currency';
import { useLanguage } from '../../i18n';

const VALID_TRANSITIONS = {
  pending: ['paid', 'cancelled'],
  paid: ['shipped', 'cancelled'],
  shipped: ['cancelled'],
  cancelled: [],
};

function formatDate(dateStr) {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr + 'Z').toLocaleDateString('en-US', {      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

export default function OrdersList() {
  const { format } = useAdminCurrency();
  const { t } = useLanguage();
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [viewDoc, setViewDoc] = useState(null);
  const [emailMsg, setEmailMsg] = useState('');
  const [emailingId, setEmailingId] = useState(null);
  const [statusData, setStatusData] = useState(null); // {flowEnabled, statuses, transitions}
  const [timelines, setTimelines] = useState({});

  // Fetch the configured workflow statuses (dynamic when the full flow is enabled)
  useEffect(() => {
    getOrderStatuses().then(res => setStatusData(res.data)).catch(() => {});
  }, []);

  const transitions = statusData?.flowEnabled ? (statusData.transitions || {}) : VALID_TRANSITIONS;

  const loadTimeline = async (orderId) => {
    if (timelines[orderId]) return;
    try {
      const res = await getOrderTimeline(orderId);
      setTimelines(prev => ({ ...prev, [orderId]: res.data || [] }));
    } catch {
      setTimelines(prev => ({ ...prev, [orderId]: [] }));
    }
  };

  const toggleExpand = (orderId) => {
    const next = expandedId === orderId ? null : orderId;
    setExpandedId(next);
    if (next) loadTimeline(orderId);
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getAdminOrders(statusFilter ? { status: statusFilter, limit: 100 } : { limit: 100 }),
      getAdminOrderStats(),
    ])
      .then(([ordersRes, statsRes]) => {
        setOrders(ordersRes.data.orders || []);
        setStats(statsRes.data);
      })
      .catch(err => console.error('Error loading orders:', err))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  const handleStatusUpdate = async (orderId, newStatus) => {
    try {
      const res = await updateOrderStatus(orderId, newStatus);
      setOrders(prev => prev.map(o => o.id === orderId ? res.data : o));
      getAdminOrderStats().then(r => setStats(r.data)).catch(() => {});
    } catch {
      alert(t('Failed to update order status'));
    }
  };

  const statusCounts = stats?.ordersByStatus || [];
  const totalOrders = stats?.totalOrders || 0;

  const handleEmailReceipt = async (order) => {
    if (!order.customer_email) { setEmailMsg(`${t('Order')} #${order.id} ${t('has no customer email')}`); setTimeout(() => setEmailMsg(''), 3000); return; }
    setEmailingId(order.id);
    setEmailMsg('');
    try {
      const res = await emailReceipt(order.id);
      setEmailMsg(res.data.sent ? `${t('Receipt emailed to')} ${order.customer_email}` : t('Receipt email not sent (mail not configured)'));
    } catch {
      setEmailMsg(t('Failed to email receipt'));
    } finally {
      setEmailingId(null);
      setTimeout(() => setEmailMsg(''), 3500);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {emailMsg && <span className="text-sm text-green-600 font-medium mr-2">{emailMsg}</span>}
        <button
          onClick={() => setStatusFilter('')}
          className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            !statusFilter
              ? 'bg-primary-600 text-white shadow-sm'
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          {t('All')} ({totalOrders})
        </button>
        {statusCounts.map(s => (
          <button
            key={s.status}
            onClick={() => setStatusFilter(s.status)}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${
              statusFilter === s.status
                ? 'bg-primary-600 text-white shadow-sm'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {t(s.status)} ({s.count})
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-start px-4 sm:px-6 py-3 text-xs sm:text-sm font-semibold text-gray-600">{t('Order')}</th>
                <th className="text-start px-4 sm:px-6 py-3 text-xs sm:text-sm font-semibold text-gray-600">{t('Customer')}</th>
                <th className="text-start px-4 sm:px-6 py-3 text-xs sm:text-sm font-semibold text-gray-600">{t('Items')}</th>
                <th className="text-end px-4 sm:px-6 py-3 text-xs sm:text-sm font-semibold text-gray-600">{t('Total')}</th>
                <th className="text-start px-4 sm:px-6 py-3 text-xs sm:text-sm font-semibold text-gray-600">{t('Status')}</th>
                <th className="text-start px-4 sm:px-6 py-3 text-xs sm:text-sm font-semibold text-gray-600">{t('Date')}</th>
                <th className="text-end px-4 sm:px-6 py-3 text-xs sm:text-sm font-semibold text-gray-600">{t('Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={7} className="px-6 py-16 text-center text-gray-400">{t('Loading orders…')}</td></tr>
              ) : orders.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-16 text-center text-gray-400">{t('No orders found.')}</td></tr>
              ) : orders.map(order => (
                <>
                  <tr key={order.id}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => toggleExpand(order.id)}
                  >
                    <td className="px-4 sm:px-6 py-4 text-sm font-medium text-gray-900">#{order.id}</td>
                    <td className="px-4 sm:px-6 py-4">
                      <div className="font-medium text-gray-900 text-sm">{order.customer_name || t('Guest')}</div>
                      <div className="text-xs text-gray-400">{order.customer_email}</div>
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-sm text-gray-500">
                      {Array.isArray(order.items) ? order.items.length : 0}
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-sm font-medium text-end">{format(order.total)}</td>
                    <td className="px-4 sm:px-6 py-4"><StatusBadge status={order.status} /></td>
                    <td className="px-4 sm:px-6 py-4 text-sm text-gray-500">{formatDate(order.created_at)}</td>
                    <td className="px-4 sm:px-6 py-4 text-end" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setViewDoc({ url: viewInvoiceUrl(order.id), title: `Invoice #${order.id}` })}
                          className="px-2.5 py-1 text-xs bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                          title={t('View invoice')}
                        >
                          {t('Invoice')}
                        </button>
                        <button
                          onClick={() => setViewDoc({ url: viewReceiptUrl(order.id), title: `Receipt #${order.id}` })}
                          className="px-2.5 py-1 text-xs bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                          title={t('View customer receipt')}
                        >
                          {t('Receipt')}
                        </button>
                        <button
                          onClick={() => setViewDoc({ url: viewShippingUrl(order.id), title: `Shipping #${order.id}` })}
                          className="px-2.5 py-1 text-xs bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                          title={t('View shipping label')}
                        >
                          {t('Ship')}
                        </button>
                        {['confirmed', 'picking', 'packing'].includes(order.status) && (
                          <button
                            onClick={() => setViewDoc({ url: viewPickingSheetUrl(order.id), title: `Picking Sheet #${order.id}` })}
                            className="px-2.5 py-1 text-xs bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                            title={t('View picking sheet')}
                          >
                            {t('Sheet')}
                          </button>
                        )}
                        <button
                          onClick={() => handleEmailReceipt(order)}
                          disabled={emailingId === order.id}
                          className="px-2.5 py-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50"
                          title={t('Email receipt to customer (SendGrid/SMTP)')}
                        >
                          {emailingId === order.id ? '...' : t('Email')}
                        </button>
                        {(transitions[order.status] || []).length > 0 ? (
                          <select
                            value=""
                            onChange={e => {
                              if (e.target.value) handleStatusUpdate(order.id, e.target.value);
                              e.target.value = '';
                            }}
                            className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                          >
                            <option value="" disabled>{t('Update…')}</option>
                            {transitions[order.status].map(s => (
                              <option key={s} value={s} className="capitalize">{t(s.replace(/_/g, ' '))}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </div>
                    </td>
                  </tr>

                  {expandedId === order.id && (
                    <tr key={`${order.id}-items`} className="bg-gray-50/70">
                      <td colSpan={7} className="px-4 sm:px-6 py-4">
                        <div className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-3">{t('Order Items')}</div>
                        {Array.isArray(order.items) && order.items.length > 0 ? (
                          <div className="space-y-2">
                            {order.items.map((item, i) => (
                              <div key={i} className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-3">
                                  {item.image_url && (
                                    <img src={item.image_url} alt="" className="w-8 h-8 rounded object-cover bg-gray-200"
                                      onError={e => { e.target.style.display = 'none'; }} />
                                  )}
                                  <div>
                                    <span className="text-gray-900 font-medium">{item.name || `Product #${item.id || item.product_id}`}</span>
                                    {item.color && <span className="text-gray-400 ml-2 text-xs">({item.color})</span>}
                                  </div>
                                </div>
                                <span className="text-gray-500">
                                  {item.quantity || item.qty || 1} × ${(item.price || 0).toFixed(2)}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-400 italic">{t('No item details available')}</p>
                        )}
                        {/* Workflow timeline / confirmation log */}
                        {(timelines[order.id] || []).length > 0 && (
                          <div className="mt-4 pt-3 border-t border-gray-200">
                            <div className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">{t('Workflow Log')}</div>
                            <div className="space-y-1.5">
                              {timelines[order.id].slice().reverse().map(ev => (
                                <div key={ev.id} className="flex items-center gap-3 text-xs text-gray-600">
                                  <span className="inline-block px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 font-medium">
                                    {t(ev.event_type.replace(/_/g, ' '))}
                                  </span>
                                  <span className="text-gray-400">{new Date(ev.created_at).toLocaleString('en-GB')}</span>
                                  <span className="text-gray-400">{ev.user_id || ev.user_role || 'system'}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {viewDoc && <DocumentViewer url={viewDoc.url} title={viewDoc.title} onClose={() => setViewDoc(null)} />}
    </div>
  );
}
