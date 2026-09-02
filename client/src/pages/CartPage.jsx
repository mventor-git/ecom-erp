import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { createOrder, createKashierSession, getKashierStatus } from '../api/products';
import { getPublicSetting } from '../api/settings';
import CartDrawer from '../components/CartDrawer';
import Price from '../components/Price';
import { useLanguage } from '../i18n';

export default function CartPage() {
  const { cart, cartTotal, cartCount, updateQuantity, removeFromCart, clearCart } = useCart();
  const { user } = useAuth();
  const { format } = useCurrency();
  const { t } = useLanguage();
  const [priceListCode, setPriceListCode] = useState('retail');
  const [kashierEnabled, setKashierEnabled] = useState(false);
  const [kashierMethods, setKashierMethods] = useState(['card', 'wallet']);
  const [paymentMethod, setPaymentMethod] = useState('kashier-card');

  useEffect(() => {
    getPublicSetting('storefront_price_list', 'retail').then(v => {
      if (typeof v === 'string' && v) setPriceListCode(v);
    }).catch(() => {});
    getKashierStatus().then(res => {
      const kashierActive = res.data?.kashierEnabled === true;
      setKashierEnabled(kashierActive);
      if (Array.isArray(res.data?.paymentMethods)) setKashierMethods(res.data.paymentMethods);
      // default: prefer the mobile wallet when available
      if (kashierActive && res.data.methods?.includes('wallet')) setPaymentMethod('kashier-wallet');
      else if (kashierActive) setPaymentMethod('kashier-card');
    }).catch(() => {});
  }, []);

  const kashierCardAvailable = kashierEnabled && kashierMethods.includes('card');
  const kashierWalletAvailable = kashierEnabled && kashierMethods.includes('wallet');
  const [email, setEmail] = useState(user?.email || '');
  const [checkingOut, setCheckingOut] = useState(false);
  const [error, setError] = useState('');

  const handleCheckout = async () => {
    if (!email) {
      setError(t('Please enter your email address'));
      return;
    }
    setError('');
    setCheckingOut(true);

    try {
      // ── Deterministic idempotency key: same cart + email + price list → same order ──
      // This prevents duplicate orders from double-click, refresh, or network retry.
      const idemSeed = JSON.stringify({
        items: cart.map(i => [i.id, i.quantity, i.color?.name]),
        email,
        priceListCode,
      });
      let idemHash = 0;
      for (let k = 0; k < idemSeed.length; k++) {
        idemHash = (idemHash * 31 + idemSeed.charCodeAt(k)) >>> 0;
      }
      const idempotencyKey = 'chk_' + idemHash.toString(36);

      // 1) Create the order first (authoritative source of truth).
      const isWallet = paymentMethod === 'kashier-wallet';
      const { data: order } = await createOrder({
        customer_email: email,
        items: cart,
        total: cartTotal,
        payment_method: isWallet ? 'kashier-wallet' : 'kashier-card',
        idempotency_key: idempotencyKey,
      });

      // 2) Open a Kashier hosted payment session for that order.
      const { data } = await createKashierSession({
        orderRef: order.id,
        total: order.total,
        customerEmail: email,
        items: cart,
        redirectPath: '/checkout/success',
        allowedMethods: isWallet ? 'wallet' : 'card',
      });

      window.location.href = data.pay_url;
    } catch (err) {
      setError(err.response?.data?.error || t('Failed to start checkout. Please try again.'));
      console.error('Checkout error:', err);
    } finally {
      setCheckingOut(false);
    }
  };

  if (cart.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <svg className="mx-auto w-20 h-20 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
            d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z"
          />
        </svg>
        <h1 className="mt-6 text-2xl font-bold text-gray-900 dark:text-white">{t('Your Cart is Empty')}</h1>
        <p className="mt-2 text-gray-500 dark:text-gray-400">{t("Looks like you haven't added anything yet.")}</p>
        <Link to="/products" className="btn-primary inline-block mt-6">{t('Start Shopping')}</Link>
        <CartDrawer />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('Shopping Cart')} ({cartCount})</h1>
        <button
          type="button"
          onClick={clearCart}
          aria-label={t('Clear Cart')}
          className="text-sm text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors"
        >
          {t('Clear Cart')}
        </button>
      </div>

      {/* Cart Items */}
      <div className="space-y-4 mb-8">
        {cart.map((item, idx) => (
          <div key={`${item.id}-${item.color?.name || 'default'}-${idx}`} className="glass-card p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 dark:text-white">{item.name}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-sm text-gray-500 dark:text-gray-400"><Price cents={item.price} /> {t('each')}</p>
                {item.color && (
                  <span className="inline-flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                    <span className="w-3 h-3 rounded-full border border-gray-200 dark:border-white/10" style={{ backgroundColor: item.color.hex }} />
                    {item.color.name}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={() => updateQuantity(item.id, item.quantity - 1, item.color?.name)}
                aria-label={t('Decrease quantity')}
                className="w-8 h-8 rounded-full border border-gray-300 dark:border-white/10 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
              >
                -
              </button>
              <span className="w-10 text-center font-medium text-gray-900 dark:text-white">{item.quantity}</span>
              <button
                type="button"
                onClick={() => updateQuantity(item.id, item.quantity + 1, item.color?.name)}
                aria-label={t('Increase quantity')}
                className="w-8 h-8 rounded-full border border-gray-300 dark:border-white/10 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
              >
                +
              </button>
            </div>
            <div className="text-right">
              <p className="font-semibold text-gray-900 dark:text-white"><Price cents={item.price * item.quantity} /></p>
              <button
                type="button"
                onClick={() => removeFromCart(item.id, item.color?.name)}
                aria-label={t('Remove item')}
                className="text-sm text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 mt-1 transition-colors"
              >
                {t('Remove')}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="glass-card p-6">
        {/* No gateway configured warning */}
        {!kashierEnabled && (
          <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl text-sm text-amber-800 dark:text-amber-300">
            {t('! No payment gateway is configured yet. The store admin must enable Kashier (Admin → Integrations) before checkout works.')}
          </div>
        )}

        <div className="flex items-center justify-between text-xl font-bold mb-4">
          <span className="text-gray-900 dark:text-white">{t('Total')}</span>
          <span className="text-primary-600 dark:text-primary-400"><Price cents={cartTotal} /></span>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
            {t('Email for receipt')}
          </label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="your@email.com"
            className="input-field"
            required
          />
        </div>

        {/* Payment method — Card & Mobile Wallet modules */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">{t('Payment method')}</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {kashierWalletAvailable && (
              <button
                type="button"
                onClick={() => setPaymentMethod('kashier-wallet')}
                className={`p-3 rounded-xl border-2 text-left transition-all ${
                  paymentMethod === 'kashier-wallet' ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-500/10' : 'border-gray-200 dark:border-white/10 hover:border-gray-300'
                }`}
              >
                <span className="block text-sm font-semibold text-gray-900 dark:text-white"> {t('Mobile Wallet')}</span>
                <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('Vodafone Cash · Instapay (Kashier)')}</span>
              </button>
            )}
            {kashierCardAvailable && (
              <button
                type="button"
                onClick={() => setPaymentMethod('kashier-card')}
                className={`p-3 rounded-xl border-2 text-left transition-all ${
                  paymentMethod === 'kashier-card' ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-500/10' : 'border-gray-200 dark:border-white/10 hover:border-gray-300'
                }`}
              >
                <span className="block text-sm font-semibold text-gray-900 dark:text-white"> {t('Card (Kashier)')}</span>
                <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('Credit / debit cards')}</span>
              </button>
            )}
          </div>
        </div>

        {error && (
          <p className="text-red-500 dark:text-red-400 text-sm mb-4">{error}</p>
        )}

        <button
          type="button"
          onClick={handleCheckout}
          disabled={checkingOut}
          aria-label={t('Proceed to Checkout')}
          className="btn-primary w-full text-center"
        >
          {checkingOut ? (
            <>
              <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {t('Processing...')}
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              {t('Proceed to Checkout')}
            </>
          )}
        </button>

        <p className="text-xs text-gray-400 dark:text-gray-500 mt-3 text-center">
          {t('Secure checkout — no card details are stored on our servers.')}
        </p>
      </div>

      <CartDrawer />
    </div>
  );
}
