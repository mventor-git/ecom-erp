import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { useLanguage } from '../i18n';
import { getMyOrders, getDeliveryStatus } from '../api/products';
import UserAvatar from '../components/UserAvatar';

export default function AccountPage() {
  const { user, loading, login, logout } = useAuth();
  const { format } = useCurrency();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState(null);
  const [delivery, setDelivery] = useState([]);
  const [deliveryLoading, setDeliveryLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('orders'); // 'orders' | 'delivery'

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login', { replace: true });
      return;
    }
    if (user) {
      setOrdersLoading(true);
      setOrdersError(null);
      getMyOrders()
        .then(res => setOrders(res.data || []))
        .catch(err => {
          console.error('Failed to load orders:', err);
          setOrdersError(t('Could not load your orders.'));
        })
        .finally(() => setOrdersLoading(false));
      getDeliveryStatus()
        .then(res => setDelivery(res.data || []))
        .catch(() => setDelivery([]))
        .finally(() => setDeliveryLoading(false));
    }
  }, [user, loading, navigate]);

  if (loading || ordersLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!user) return null; // Will redirect

  const formatDate = (dateStr) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
      });
    } catch { return dateStr; }
  };

  const formatPrice = (cents) => format(cents);

  const statusColors = {
    pending: 'bg-gold-pale dark:bg-gold/20 text-gold dark:text-gold-light',
    paid: 'bg-green-100 dark:bg-green-500/20 text-green-800 dark:text-green-300',
    shipped: 'bg-primary-100 dark:bg-primary-500/20 text-primary-800 dark:text-primary-300',
    cancelled: 'bg-red-100 dark:bg-red-500/20 text-red-800 dark:text-red-300',
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Onboarding / verification banner */}
      {user && user.needs_onboarding && (
        <div className="mb-6 p-4 rounded-2xl bg-primary-50 dark:bg-primary-500/10 border border-primary-200 dark:border-primary-500/30 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="font-semibold text-primary-800 dark:text-primary-300">{t('Complete your profile to become an authorized customer')}</p>
            <p className="text-sm text-primary-600 dark:text-primary-400 mt-0.5">{t('Add your phone + address and verify it.')}</p>
          </div>
          <Link to="/account/verify" className="btn-primary text-sm !px-4 !py-2 shrink-0">{t('Complete Now')}</Link>
        </div>
      )}

      {/* Profile Section */}
      <div className="glass-card p-6 mb-8">
        <div className="flex items-center gap-4">
          <UserAvatar user={user} size="lg" />
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">{user.name || t('Customer')}</h1>
              {user.is_verified && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300">
                  ✓ {t('Authorized')}
                </span>
              )}
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-sm">{user.email}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              {t('Member since')} {formatDate(user.created_at)}
              {user.phone && <span className="ml-2">· {user.phone}</span>}
            </p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="px-4 py-2 text-sm border border-gray-300 dark:border-white/10 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-gray-600 dark:text-gray-300 backdrop-blur-sm"
            aria-label={t('Sign Out')}
          >
            {t('Sign Out')}
          </button>
        </div>
        <Link to="/track-orders" className="mt-4 inline-block text-sm text-primary-600 dark:text-primary-400 font-medium hover:underline">
          {t('Track your orders →')}
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-5 border-b border-gray-200 dark:border-gray-700 pb-2">
        {[
          ['orders', t('Order History')],
          ['delivery', t('Delivery')],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            aria-label={label}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === key
                ? 'bg-primary-600 text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Delivery Tab ── */}
      {activeTab === 'delivery' && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('Delivery Status')}</h2>
          {deliveryLoading ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('Loading…')}</p>
          ) : delivery.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('No orders to deliver yet.')}</p>
          ) : (
            delivery.map(o => {
              const f = o.fulfillment;
              // Customer-facing labels (mventor-ticket-060):
              //   issued   → Package is on Review
              //   packed   → Package Ready to Shipment
              //   sent/delivering → ON THE WAY
              //   delivered → Delivered
              const reached = new Map([
                ['issued', 0], ['packed', 1], ['sent', 2], ['delivering', 3], ['delivered', 4],
              ]);
              const stageIdx = f ? (reached.get(f.fulfillment_status) ?? 0) : 0;
              const headline = !f
                ? t('Package is on Review')
                : f.fulfillment_status === 'packed'
                  ? t('Package Ready to Shipment')
                  : ['sent', 'delivering'].includes(f.fulfillment_status)
                    ? t('ON THE WAY')
                    : f.fulfillment_status === 'delivered'
                      ? t('Delivered')
                      : t('Package is on Review');
              const stages = [
                { key: 'issued', label: t('Review') },
                { key: 'packed', label: t('Ready') },
                { key: 'sent', label: t('Sent') },
                { key: 'delivering', label: t('On Way') },
                { key: 'delivered', label: t('Delivered') },
              ];
              return (
                <div key={o.id} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
                  <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                    <span className="font-semibold text-gray-900 dark:text-white">{t('Order #')}{o.id}</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">{new Date(o.created_at).toLocaleDateString()}</span>
                  </div>
                  {!f ? (
                    <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                      {t('Package is on Review')}
                    </p>
                  ) : (
                    <>
                      <p className="text-base font-bold text-primary-600 dark:text-primary-400 mb-2.5">
                        {headline}
                      </p>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {stages.map((s, i) => (
                          <div key={s.key} className="flex items-center gap-1.5">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                              i <= stageIdx
                                ? 'bg-primary-600 text-white'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500'
                            }`}>
                              {i < stageIdx && '✓'} {s.label}
                            </span>
                            {i < stages.length - 1 && <span className="w-4 h-px bg-gray-300 dark:bg-gray-600" />}
                          </div>
                        ))}
                      </div>
                      {f.sent_via === 'external' && f.external_provider_name && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2.5">
                          {t('Handed to delivery partner:')} <b>{f.external_provider_name}</b>
                        </p>
                      )}
                      {f.claim_status === 'claimed' && f.fulfillment_status === 'packed' && (
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2.5">{t('A driver is on the way to collect your parcel.')}</p>
                      )}
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Orders Section */}
      {activeTab === 'orders' && (
      <>
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('Order History')}</h2>

      {ordersError && (
        <div className="p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl text-red-700 dark:text-red-300 text-sm mb-4">
          {ordersError}
        </div>
      )}

      {!ordersError && orders.length === 0 && (
        <div className="glass-card p-12 text-center">
          <svg className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
          <h3 className="text-gray-500 dark:text-gray-400 font-medium mb-1">{t('No orders yet')}</h3>
          <p className="text-gray-400 dark:text-gray-500 text-sm">
            {t('When you place an order, it will show up here.')}
          </p>
        </div>
      )}

      {orders.length > 0 && (
        <div className="space-y-4">
          {orders.map(order => (
            <div
              key={order.id}
              className="glass-card p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t('Order #')}{order.id} — {formatDate(order.created_at)}
                  </p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white mt-1">
                    {formatPrice(order.total)}
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${
                  statusColors[order.status] || 'bg-gray-100 dark:bg-white/5 text-gray-800 dark:text-gray-300'
                }`}>
                  {order.status}
                </span>
              </div>

              {/* Order Items */}
              {Array.isArray(order.items) && order.items.length > 0 && (
                <div className="border-t border-gray-100 dark:border-white/5 pt-4 space-y-3">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-3">
                        {item.image_url && (
                          <img
                            src={item.image_url}
                            alt={item.name}
                            className="w-10 h-10 rounded-lg object-cover bg-gray-100 dark:bg-dark-700"
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                        )}
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{item.name}</p>
                          <p className="text-gray-400 dark:text-gray-500 text-xs">{t('Qty')}: {item.qty || item.quantity || 1}</p>
                        </div>
                      </div>
                      <p className="text-gray-600 dark:text-gray-400">{formatPrice(item.price || 0)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      </>
      )}
    </div>
  );
}
