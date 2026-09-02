import { Link } from 'react-router-dom';
import { useWishlist } from '../context/WishlistContext';
import { useCart } from '../context/CartContext';
import { useCurrency } from '../context/CurrencyContext';
import Price from './Price';
import { useLanguage } from '../i18n';
import DrawerShell from './DrawerShell';

export default function WishlistDrawer() {
  const { items, count, isOpen, setIsOpen, removeItem } = useWishlist();
  const { addToCart } = useCart();
  const { format } = useCurrency();
  const { t } = useLanguage();

  return (
    <DrawerShell
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      title={`${t('Wishlist')} (${count})`}
      ariaLabel={t('Wishlist')}
    >
      <div className="px-4 sm:px-6 py-4">
        {items.length === 0 ? (
          <div className="text-center py-12">
            <svg className="mx-auto w-12 h-12 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            </svg>
            <p className="mt-4 text-gray-500 dark:text-gray-400">{t('Your wishlist is empty')}</p>
            <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">{t('Save out-of-stock or favorite items to find them later.')}</p>
            <Link
              to="/products"
              onClick={() => setIsOpen(false)}
              className="mt-4 inline-block text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium"
            >
              {t('Browse Products')}
            </Link>
          </div>
        ) : (
          <ul className="space-y-4">
            {items.map(product => (
              <li key={product.id} className="flex items-center space-x-4 py-4 border-b border-gray-100 dark:border-white/5">
                <Link
                  to={`/products/${product.id}`}
                  onClick={() => setIsOpen(false)}
                  className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 dark:bg-dark-700 shrink-0"
                >
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.name}
                      className="w-full h-full object-cover hover:scale-110 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-gray-50 to-gray-200 dark:from-dark-700 dark:to-dark-800 flex items-center justify-center">
                      <svg className="w-6 h-6 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16M4 16l2-2M16 16l-2-2m2 2l-6 6m6-6l6-6"/>
                      </svg>
                    </div>
                  )}
                </Link>
                <div className="flex-1 min-w-0">
                  <Link to={`/products/${product.id}`} onClick={() => setIsOpen(false)} className="block hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
                    <h3 className="font-medium text-gray-900 dark:text-white truncate">{product.name}</h3>
                  </Link>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1"><Price cents={product.price} /></p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => addToCart(product)}
                    className="btn-primary !px-3 !py-1.5 text-xs"
                    aria-label={t('Add to cart')}
                  >
                    {t('Add')}
                  </button>
                  <button
                    onClick={() => removeItem(product.id)}
                    className="text-red-400 hover:text-red-600 dark:hover:text-red-300 transition-colors"
                    aria-label={t('Remove item')}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </DrawerShell>
  );
}
