import { useEffect } from 'react';

/**
 * Shared drawer scaffold used by CartDrawer and WishlistDrawer.
 * Renders: backdrop overlay + right-anchored panel with header (title + close).
 * Locks body scroll while open and closes on Esc.
 *
 * Children render the body; the optional `footer` slot renders pinned bottom.
 */
export default function DrawerShell({
  isOpen,
  onClose,
  title,
  ariaLabel,
  children,
  footer,
}) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel || title}
        className="fixed end-0 top-0 h-full w-full max-w-md drawer-glass shadow-glass-lg z-50 flex flex-col border-s border-white/5 dark:border-white/10"
      >
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-200/50 dark:border-white/5">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {children}
        </div>

        {footer && (
          <div className="border-t border-gray-200/50 dark:border-white/5 px-4 sm:px-6 py-4">
            {footer}
          </div>
        )}
      </aside>
    </>
  );
}
