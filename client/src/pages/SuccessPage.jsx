import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useCurrency } from '../context/CurrencyContext';
import { getOrderBySession } from '../api/products';
import { useLanguage } from '../i18n';
import Price from '../components/Price';

export default function SuccessPage() {
  const [searchParams] = useSearchParams();
  const { clearCart } = useCart();
  const { format } = useCurrency();
  const { t } = useLanguage();
  const [order, setOrder] = useState(null);
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    clearCart();

    if (sessionId) {
      getOrderBySession(sessionId)
        .then(res => setOrder(res.data))
        .catch(() => {
          // Order may not be in DB yet (webhook race), that's okay
        });
    }
  }, [sessionId, clearCart]);

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
      <div className="glass-card p-8 sm:p-12">
        <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6 backdrop-blur-sm border border-green-500/20">
          <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">{t('Payment Successful!')}</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-2">{t('Thank you for your purchase.')}</p>
        <p className="text-gray-500 dark:text-gray-400 mb-8">{t("You'll receive a confirmation email shortly.")}</p>

        {order && (
          <div className="bg-white/5 dark:bg-white/5 rounded-xl p-4 mb-8 text-left border border-white/10">
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('Order #')}{order.id}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('Total')}: <Price cents={order.total} /></p>
          </div>
        )}

        <Link to="/products" className="btn-primary inline-block">
          {t('Continue Shopping')}
        </Link>
      </div>
    </div>
  );
}
