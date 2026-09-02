import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { getOrderTracker, getOrderStatuses } from '../api/products';
import Price from '../components/Price';
import { useLanguage } from '../i18n';

const STATUS_LABELS = {
  draft: 'Draft',
  payment_pending: 'Payment Pending',
  payment_verified: 'Payment Verified',
  admin_review: 'Under Review',
  confirmed: 'Confirmed',
  picking: 'Warehouse Picking',
  packing: 'Packing',
  ready_for_shipping: 'Ready for Shipping',
  shipped: 'Shipped',
  delivered: 'Delivered',
  completed: 'Completed',
  cancelled: 'Cancelled',
  pending: 'Pending',
  paid: 'Paid',
};

function rawStatusLabel(status) {
  return STATUS_LABELS[status] || (status || '').replace(/_/g, ' ');
}

const STATUS_COLORS = {
  confirmed: 'bg-primary-100 text-primary-700',
  picking: 'bg-primary-100 text-primary-700',
  packing: 'bg-gold-pale text-gold',
  ready_for_shipping: 'bg-gold-pale text-gold',
  shipped: 'bg-green-100 text-green-700',
  delivered: 'bg-green-100 text-green-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

function statusColor(status) {
  return STATUS_COLORS[status] || 'bg-gray-100 text-gray-600';
}

export default function OrderTrackerPage() {
  const { user, loading } = useAuth();
  const { format } = useCurrency();
  const { t } = useLanguage();
  const statusLabel = (s) => t(rawStatusLabel(s));
  const [data, setData] = useState(null);
  const [statuses, setStatuses] = useState([]);
  const [error, setError] = useState('');
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    getOrderStatuses().then(res => setStatuses(res.data?.statuses || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user) return;
    setLoadingData(true);
    getOrderTracker()
      .then(res => setData(res.data))
      .catch(err => setError(err.response?.data?.error || t('Failed to load tracker')))
      .finally(() => setLoadingData(false));
  }, [user, loading]);

  if (loading || loadingData) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 flex justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('Order Tracker')}</h1>
        <p className="mt-3 text-gray-500 dark:text-gray-400">{t('Sign in to track your orders.')}</p>
        <Link to="/login" className="btn-primary inline-block mt-6">{t('Sign In')}</Link>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <p className="text-red-500">{error}</p>
        <button onClick={() => window.location.reload()} className="btn-primary mt-6">{t('Retry')}</button>
      </div>
    );
  }

  const orders = data?.orders || [];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">{t('Order Tracker')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {orders.length} {t('order')}{orders.length !== 1 ? t('s') : ''} · {data?.flowEnabled ? t('Full lifecycle tracking') : t('Standard tracking')}
          </p>
        </div>
        <Link to="/account" className="text-sm text-primary-600 dark:text-primary-400 font-medium">{t('← My Account')}</Link>
      </div>

      {orders.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <svg className="w-14 h-14 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">{t('No orders to track yet')}</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('When you place an order, it will appear here with live tracking.')}</p>
          <Link to="/products" className="btn-primary inline-block mt-6">{t('Start Shopping')}</Link>
        </div>
      ) : (
        <div className="space-y-6">
          {orders.map(order => (
            <OrderCard key={order.id} order={order} statuses={statuses} format={format} statusLabel={statusLabel} t={t} />
          ))}
        </div>
      )}
    </div>
  );
}

function OrderCard({ order, statuses, format, statusLabel, t }) {
  const activeIndex = statuses.indexOf(order.status);
  const currentStep = activeIndex >= 0 ? activeIndex : 0;
  const isCancelled = order.status === 'cancelled';

  return (
    <div className="glass-card p-5 sm:p-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">{t('Order #')}{order.id}</h2>
            <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${statusColor(order.status)}`}>
              {statusLabel(order.status)}
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {t('Placed')} {new Date(order.created_at).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' })}
          </p>
          {order.estimatedDelivery && !isCancelled && (
            <p className="text-xs text-green-600 dark:text-green-400 font-medium mt-1">
              {t('Estimated delivery:')} {new Date(order.estimatedDelivery).toLocaleDateString('en-GB', { weekday: 'short', month: 'short', day: 'numeric' })}
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="text-xl font-bold text-primary-600 dark:text-primary-400"><Price cents={order.total} /></p>
          <Link to={`/products/${order.items?.[0]?.id || ''}`} className="text-xs text-primary-600 dark:text-primary-400 hover:underline">
            {t('View products')}
          </Link>
        </div>
      </div>

      {/* Items preview */}
      {Array.isArray(order.items) && order.items.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-5">
          {order.items.slice(0, 4).map((item, i) => (
            <div key={i} className="flex items-center gap-2 bg-white/60 dark:bg-dark-800/60 border border-gray-100 dark:border-white/5 rounded-lg px-2.5 py-1.5 text-xs">
              {item.image_url && (
                <img src={item.image_url} alt="" className="w-6 h-6 rounded object-cover" onError={e => { e.target.style.display = 'none'; }} />
              )}
              <span className="text-gray-700 dark:text-gray-300 max-w-[140px] truncate">{item.name}</span>
              <span className="text-gray-400">× {item.qty || item.quantity || 1}</span>
            </div>
          ))}
          {order.items.length > 4 && (
            <span className="text-xs text-gray-400 self-center">+{order.items.length - 4} more</span>
          )}
        </div>
      )}

      {/* Lifecycle stepper */}
      {statuses.length > 0 && (
        <div className="mt-2">
          <div className="flex items-center overflow-x-auto pb-2 -mx-1 px-1">
            {statuses.map((status, i) => {
              const done = i < currentStep;
              const current = i === currentStep;
              const cancelled = isCancelled;
              return (
                <div key={status} className="flex items-center shrink-0">
                  <div className="flex flex-col items-center w-16 sm:w-20">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                      cancelled
                        ? 'border-red-300 text-red-400'
                        : done || current
                          ? 'bg-primary-600 border-primary-600 text-white'
                          : 'border-gray-300 dark:border-white/15 text-gray-400'
                    }`}>
                      {done ? '✓' : i + 1}
                    </div>
                    <span className={`mt-1.5 text-[10px] sm:text-[11px] text-center leading-tight ${
                      current ? 'text-primary-600 dark:text-primary-400 font-semibold' : 'text-gray-500 dark:text-gray-400'
                    }`}>
                      {statusLabel(status)}
                    </span>
                  </div>
                  {i < statuses.length - 1 && (
                    <div className={`w-4 sm:w-8 h-0.5 -mt-5 ${done ? 'bg-primary-500' : 'bg-gray-200 dark:bg-white/10'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Timeline events */}
      {order.timeline && order.timeline.length > 0 && (
        <details className="mt-4">
          <summary className="text-xs font-medium text-gray-500 dark:text-gray-400 cursor-pointer hover:text-primary-600">
            {t('Activity log')} ({order.timeline.length})
          </summary>
          <div className="mt-3 space-y-1.5 border-l-2 border-gray-100 dark:border-white/10 ml-2 pl-4">
            {order.timeline.slice().reverse().map((ev, i) => (
              <div key={i} className="text-xs text-gray-500 dark:text-gray-400">
                <span className="font-medium text-gray-700 dark:text-gray-300">{statusLabel(ev.event.replace('order_', ''))}</span>
                <span className="text-gray-400"> · {new Date(ev.at).toLocaleString('en-GB')}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
