import { useState, useRef, useEffect, useMemo, useDeferredValue } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getProducts } from '../api/products';
import { useCurrency } from '../context/CurrencyContext';
import Price from './Price';
import { useLanguage, localized } from '../i18n';

const MAX_RESULTS = 8;

// Module-level cache: the catalog is fetched ONCE and shared between the
// desktop and mobile search instances (and across page navigations).
// This removes the "laggy" feeling from repeated full-catalog fetches.
let allProductsCache = null;
let productsFetchPromise = null;

function loadAllProducts() {
  if (!productsFetchPromise) {
    productsFetchPromise = getProducts()
      .then(res => {
        allProductsCache = res.data || [];
        return allProductsCache;
      })
      .catch(err => {
        productsFetchPromise = null; // allow retry on next load
        throw err;
      });
  }
  return productsFetchPromise;
}

export default function SmartSearch() {
  const { lang, t } = useLanguage();
  const { format } = useCurrency();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(!allProductsCache);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [allProducts, setAllProducts] = useState(allProductsCache || []);
  const deferredQuery = useDeferredValue(query);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  // Load the catalog once (lazily, shared cache)
  useEffect(() => {
    loadAllProducts()
      .then(data => {
        setAllProducts(data);
        setCatalogLoading(false);
      })
      .catch(() => setCatalogLoading(false));
  }, []);

  // Close on click outside
  useEffect(() => {
    function handleClick(e) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target) &&
        inputRef.current &&
        !inputRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('touchstart', handleClick, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('touchstart', handleClick, { passive: true });
    };
  }, []);

  // Close on Escape
  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  // Instant client-side search — deferred value keeps typing responsive
  const searchLower = deferredQuery.toLowerCase().trim();
  const filtered = useMemo(() => {
    if (!searchLower) return [];
    return allProducts
      .filter(p => {
        // Bilingual: Arabic query matches name_ar/description_ar/category_ar,
        // English query matches the English fields — both always searched.
        const q = searchLower;
        const hit = (en, ar) =>
          (en || '').toLowerCase().includes(q) || (ar || '').includes(searchLower);
        return (
          hit(p.name, p.name_ar) ||
          hit(p.description, p.description_ar) ||
          hit(p.category_name, p.category_name_ar) ||
          hit(p.brand_name, p.brand_name_ar)
        );
      })
      .slice(0, MAX_RESULTS);
  }, [allProducts, searchLower]);

  useEffect(() => {
    if (!searchLower) {
      setResults([]);
      setOpen(false);
      return;
    }
    setResults(filtered);
    setOpen(true);
    setActiveIdx(-1);
  }, [searchLower, filtered]);

  const handleChange = (e) => {
    setQuery(e.target.value);
  };

  const handleFocus = () => {
    if (results.length > 0) setOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (activeIdx >= 0 && results[activeIdx]) {
      navigate(`/products/${results[activeIdx].id}`);
      closeSearch();
    } else if (query.trim()) {
      navigate(`/products?search=${encodeURIComponent(query.trim())}`);
      closeSearch();
    }
  };

  const handleKeyDown = (e) => {
    if (!open || results.length === 0) {
      if (e.key === 'Enter' && query.trim()) {
        e.preventDefault();
        navigate(`/products?search=${encodeURIComponent(query.trim())}`);
        closeSearch();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIdx(prev => (prev < results.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIdx(prev => (prev > 0 ? prev - 1 : results.length - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (activeIdx >= 0 && results[activeIdx]) {
          navigate(`/products/${results[activeIdx].id}`);
          closeSearch();
        }
        break;
      case 'Escape':
        setOpen(false);
        inputRef.current?.blur();
        break;
    }
  };

  const closeSearch = () => {
    setOpen(false);
    setQuery('');
    setResults([]);
    setActiveIdx(-1);
    inputRef.current?.blur();
  };

  const fmtPrice = (cents) => format(cents);

  return (
    <div className="relative w-full max-w-md" ref={dropdownRef}>
      <form onSubmit={handleSubmit} className="relative">
        {/* Search icon */}
        <svg
          className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>

        <input
          ref={inputRef}
          type="text"
          placeholder={t('Search products...')}
          value={query}
          onChange={handleChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          className="w-full pl-10 pr-10 py-2.5 text-sm sm:text-base bg-gray-100 dark:bg-dark-800 border border-transparent rounded-xl focus:outline-none focus:bg-white dark:focus:bg-dark-700 focus:border-primary-300 dark:focus:border-primary-600 focus:ring-2 focus:ring-primary-100 dark:focus:ring-primary-900 transition-all placeholder:text-gray-400 dark:placeholder:text-gray-500 text-gray-900 dark:text-white"
          aria-label={t('Search products')}
          autoComplete="off"
        />

        {/* Loading spinner (catalog still loading) */}
        {catalogLoading && !query && (
          <svg className="absolute end-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin"
            fill="none" viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        )}

        {/* Clear button */}
        {query && (
          <button
            type="button"
            onClick={() => { setQuery(''); setResults([]); setOpen(false); inputRef.current?.focus(); }}
            className="absolute end-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            aria-label={t('Clear search')}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </form>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full start-0 end-0 mt-2 bg-white dark:bg-dark-800 rounded-xl shadow-lg dark:shadow-dark-900/50 border border-gray-200 dark:border-dark-700 overflow-hidden z-50">
          {catalogLoading && (
            <div className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
              <svg className="w-5 h-5 mx-auto mb-2 text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {t('Loading products...')}
            </div>
          )}

          {!catalogLoading && results.length === 0 && query.trim() && (
            <div className="px-4 py-8 text-center">
              <svg className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('No products found')}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{t('Try a different search term')}</p>
            </div>
          )}

          {!catalogLoading && results.length > 0 && (
            <>
              {/* Results list */}
              <div className="max-h-96 overflow-y-auto divide-y divide-gray-100 dark:divide-dark-700">
                {results.map((product, i) => {
                  const hasImage = product.image_url && product.image_url.length > 0;
                  return (
                    <Link
                      key={product.id}
                      to={`/products/${product.id}`}
                      onClick={closeSearch}
                      onMouseEnter={() => setActiveIdx(i)}
                      className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                        i === activeIdx
                          ? 'bg-primary-50 dark:bg-primary-900/20'
                          : 'hover:bg-gray-50 dark:hover:bg-dark-700/50'
                      }`}
                    >
                      {/* Thumbnail */}
                      <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-dark-700 overflow-hidden shrink-0">
                        {hasImage ? (
                          <img
                            src={product.image_url}
                            alt={localized(lang, product, 'name')}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.parentElement.classList.add('flex', 'items-center', 'justify-center');
                              e.target.parentElement.innerHTML = `<span class="text-base text-gray-400 dark:text-gray-500">${(localized(lang, product, 'name') || product.name || '?').charAt(0)}</span>`;
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="text-base font-semibold text-gray-400 dark:text-gray-500">
                              {(localized(lang, product, 'name') || product.name || '?').charAt(0)}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {localized(lang, product, 'name')}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {product.category_name && (
                            <span className="text-xs text-gray-400 dark:text-gray-500">{product.category_name}</span>
                          )}
                          {product.brand_name && (
                            <>
                              <span className="text-gray-300 dark:text-gray-600 text-xs">·</span>
                              <span className="text-xs text-gray-400 dark:text-gray-500">{product.brand_name}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Price */}
                      <span className="text-sm font-semibold text-primary-600 dark:text-primary-400 shrink-0">
                        <Price cents={product.price} />
                      </span>
                    </Link>
                  );
                })}
              </div>

              {/* Footer — view all results */}
              {query.trim() && (
                <Link
                  to={`/products?search=${encodeURIComponent(query.trim())}`}
                  onClick={closeSearch}
                  className="block px-4 py-2.5 text-center text-xs font-medium text-primary-600 dark:text-primary-400 bg-gray-50 dark:bg-dark-700/50 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors border-t border-gray-100 dark:border-dark-700"
                >
                  {t('View all results for')} "{query.trim()}"
                </Link>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
