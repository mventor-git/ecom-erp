import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useCart } from '../context/CartContext';
import { useCurrency } from '../context/CurrencyContext';
import { useLanguage } from '../i18n';
import Price from './Price';

/**
 * CartToast — shown after anything is added to the cart.
 * Displays the item count + cart total with a "View Cart" button
 * that opens the cart drawer.
 */
const TOAST_MS = 4000;

export default function CartToast() {
  const { toast, setIsOpen } = useCart();
  const { format } = useCurrency();
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!toast) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), TOAST_MS);
    return () => clearTimeout(t);
  }, [toast?.id]);

  if (!toast || !visible) return null;

  return createPortal(
    <div className="fixed bottom-24 sm:bottom-6 left-1/2 -translate-x-1/2 z-[70] w-[calc(100%-2rem)] max-w-sm animate-slide-up">
      <div className="drawer-glass rounded-2xl shadow-glass-lg border border-green-200/60 dark:border-green-500/20 p-3.5 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-green-100 dark:bg-green-500/15 flex items-center justify-center shrink-0">
          <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            {t('Added to cart')} · {toast.count} {toast.count === 1 ? t('item') : t('items')}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t('Cart total')}: <span className="font-semibold text-primary-600 dark:text-primary-400"><Price cents={toast.total} /></span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setVisible(false); setIsOpen(true); }}
          aria-label={t('View Cart')}
          className="shrink-0 px-3.5 py-2 text-xs font-semibold rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors"
        >
          {t('View Cart')}
        </button>
      </div>
    </div>,
    document.body
  );
}
