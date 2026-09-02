import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import { useWishlist } from '../context/WishlistContext';
import { useLanguage } from '../i18n';

/**
 * WishlistButton — heart button for any product.
 * - Outline heart -> filled heart when the product is on the wishlist
 * - Signed-out users get a "Sign in first" prompt (returns to the same page)
 * - Adding opens the wishlist drawer (like the cart drawer opens on add)
 * - variant: 'pink' (default accents) or 'red' (out-of-stock products)
 */
export default function WishlistButton({ product, showLabel = false, label = 'Wishlist', className = '', variant = 'pink' }) {
  const { user, login } = useAuth();
  const { addItem, removeItem, isWishlisted } = useWishlist();
  const { t } = useLanguage();
  const [showPrompt, setShowPrompt] = useState(false);

  const active = isWishlisted(product.id);

  const isRed = variant === 'red';
  const toneClasses = active
    ? isRed
      ? 'bg-red-400/25 text-red-600 dark:bg-red-500/15 dark:text-red-400'
      : 'bg-pink-400/25 text-pink-600 dark:bg-pink-500/15 dark:text-pink-400'
    : isRed
      ? 'text-red-500 hover:text-red-600 hover:bg-red-400/15 dark:text-red-400 dark:hover:bg-red-500/15'
      : 'text-gray-500 hover:text-pink-500 hover:bg-pink-400/15 dark:hover:bg-pink-500/15 dark:text-gray-300';

  const handleClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      setShowPrompt(true); // ask for signing in first
      return;
    }
    if (active) {
      await removeItem(product.id);
    } else {
      await addItem(product);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        aria-label={active ? t('Remove from wishlist') : t('Add to wishlist')}
        aria-pressed={active}
        className={`inline-flex items-center justify-center gap-1.5 transition-all duration-200 ${toneClasses} ${className}`}
      >
        <svg
          className="w-5 h-5 shrink-0"
          viewBox="0 0 24 24"
          fill={active ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
        {showLabel && <span className="hidden sm:inline">{t(label)}</span>}
      </button>

      {/* Sign-in prompt — portaled to <body> so it escapes card transforms */}
      {showPrompt && createPortal(
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowPrompt(false)} />
          <div className="relative w-full max-w-sm drawer-glass rounded-2xl shadow-glass-lg border border-gray-200/50 dark:border-white/10 p-6 text-center animate-scale-in">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-pink-100 dark:bg-red-500/10 flex items-center justify-center">
              <svg className="w-7 h-7 text-pink-600 dark:text-red-400" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t('Sign in first')}</h3>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              {t('Your wishlist is saved to your account. Sign in to save this product — you’ll come right back here.')}
            </p>
            <div className="mt-6 flex flex-col gap-2.5">
              <button onClick={login} className="btn-primary w-full">
                {t('Sign In')}
              </button>
              <button
                onClick={() => setShowPrompt(false)}
                className="w-full py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-white/10 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
              >
                {t('Maybe Later')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
