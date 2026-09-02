import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useCurrency } from '../context/CurrencyContext';
import Price from './Price';
import { useLanguage } from '../i18n';
import DrawerShell from './DrawerShell';

export default function CartDrawer() {
  const { cart, cartTotal, cartCount, isOpen, setIsOpen, removeFromCart, updateQuantity } = useCart();
  const { format } = useCurrency();
  const { t } = useLanguage();

  return (
    <DrawerShell
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      title={`${t('Cart')} (${cartCount})`}
      ariaLabel={t('Shopping Cart')}
      footer={
        cart.length > 0 ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-lg font-semibold">
              <span className="text-gray-900 dark:text-white">{t('Total')}</span>
              <span className="text-primary-600 dark:text-primary-400"><Price cents={cartTotal} variant="icon" /></span>
            </div>
            <Link
              to="/cart"
              onClick={() => setIsOpen(false)}
              className="btn-primary block text-center w-full"
            >
              {t('View Cart & Checkout')}
            </Link>
          </div>
        ) : null
      }
    >
      <div className="px-4 sm:px-6 py-4">
        {cart.length === 0 ? (
          <div className="text-center py-12">
            <svg className="mx-auto w-12 h-12 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z"
              />
            </svg>
            <p className="mt-4 text-gray-500 dark:text-gray-400">{t('Your cart is empty')}</p>
            <Link
              to="/products"
              onClick={() => setIsOpen(false)}
              className="mt-4 inline-block text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium"
            >
              {t('Start Shopping')}
            </Link>
          </div>
        ) : (
          <ul className="space-y-4">
            {cart.map(item => (
              <li key={`${item.id}-${item.color?.name || ''}-${item.size?.name || ''}`} className="flex items-center gap-4 py-4 border-b border-gray-100 dark:border-white/5">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white truncate">{item.name}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <p className="text-sm text-gray-500 dark:text-gray-400"><Price cents={item.price} /> {t('each')}</p>
                    {item.color && (
                      <span className="inline-flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                        <span className="w-3 h-3 rounded-full border border-gray-200 dark:border-white/10" style={{ backgroundColor: item.color.hex }} />
                        {item.color.name}
                      </span>
                    )}
                    {item.size && (
                      <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">{item.size.name}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => updateQuantity(item.id, item.quantity - 1, item.color?.name, item.size?.name)}
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-gray-300 dark:border-white/10 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                    aria-label={t('Decrease quantity')}
                  >
                    -
                  </button>
                  <span className="w-7 sm:w-8 text-center font-medium text-gray-900 dark:text-white">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.id, item.quantity + 1, item.color?.name, item.size?.name)}
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-gray-300 dark:border-white/10 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                    aria-label={t('Increase quantity')}
                  >
                    +
                  </button>
                </div>
                <p className="font-medium text-gray-900 dark:text-white w-16 sm:w-20 lg:w-24 text-right text-sm sm:text-base"><Price cents={item.price * item.quantity} /></p>
                <button
                  onClick={() => removeFromCart(item.id, item.color?.name, item.size?.name)}
                  className="text-red-400 hover:text-red-600 dark:hover:text-red-300 ms-1 sm:ms-2 transition-colors"
                  aria-label={t('Remove item')}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </DrawerShell>
  );
}
