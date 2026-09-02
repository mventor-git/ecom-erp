import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import ProductGrid from '../components/ProductGrid';
import FilterSidebar from '../components/FilterSidebar';
import CartDrawer from '../components/CartDrawer';
import { getProducts } from '../api/products';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
];

export default function ProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('newest');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Read filters from URL search params
  const activeCategory = searchParams.get('category') || '';
  const activeBrand = searchParams.get('brand') || '';
  const minPrice = searchParams.get('min_price') || '';
  const maxPrice = searchParams.get('max_price') || '';

  // Build the setSearchParams update helper
  const updateFilters = (updates) => {
    const params = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });
    setSearchParams(params);
  };

  useEffect(() => {
    setLoading(true);
    getProducts({
      category: activeCategory || undefined,
      sort,
      brand: activeBrand || undefined,
      minPrice: minPrice || undefined,
      maxPrice: maxPrice || undefined,
    })
      .then(res => setProducts(res.data))
      .catch(err => console.error('Error loading products:', err))
      .finally(() => setLoading(false));
  }, [activeCategory, sort, activeBrand, minPrice, maxPrice]);

  // Calculate price range from all products (before search filtering)
  const priceRange = useMemo(() => {
    if (!products.length) return { min: 0, max: 10000 };
    const prices = products.map(p => p.price);
    return {
      min: Math.min(...prices),
      max: Math.max(...prices),
    };
  }, [products]);

  const displayedProducts = products.filter(p =>
    !search ||
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    (p.name_ar || '').includes(search) ||
    p.description?.toLowerCase().includes(search.toLowerCase()) ||
    (p.description_ar || '').includes(search)
  );

  const hasActiveFilters = activeCategory || activeBrand || minPrice || maxPrice;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Products</h1>
          <p className="mt-1 text-gray-500 dark:text-gray-400">
            {loading ? 'Loading...' : `${displayedProducts.length} product${displayedProducts.length !== 1 ? 's' : ''} found`}
            {hasActiveFilters && (
              <button
                onClick={() => setSearchParams({})}
                className="ml-2 text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium"
              >
                Clear filters
              </button>
            )}
          </p>
        </div>

        {/* Mobile filter toggle + Sort */}
        <div className="flex items-center gap-3">
          {/* Mobile sidebar toggle */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 bg-white/5 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl hover:bg-gray-50 dark:hover:bg-white/10 transition-colors backdrop-blur-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 010 2H4a1 1 0 01-1-1zm4 6a1 1 0 011-1h8a1 1 0 010 2H8a1 1 0 01-1-1zm2 6a1 1 0 011-1h4a1 1 0 010 2h-4a1 1 0 01-1-1z" />
            </svg>
            Filters
            {hasActiveFilters && (
              <span className="w-2 h-2 rounded-full bg-primary-500" />
            )}
          </button>

          {/* Sort */}
          <select
            value={sort}
            onChange={e => setSort(e.target.value)}
            className="px-3 py-2.5 border border-gray-300 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-transparent transition duration-200 text-sm bg-white/5 dark:bg-dark-800/50 backdrop-blur-sm text-gray-900 dark:text-white"
          >
            {SORT_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Search Bar */}
      <div className="glass-card p-4 mb-8">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 bg-transparent border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-transparent transition duration-200 text-sm text-gray-900 dark:text-white placeholder:text-gray-400"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Content Area: Sidebar + Grid */}
      <div className="flex gap-8">
        {/* ── Desktop Filter Sidebar ── */}
        <div className="hidden lg:block">
          <FilterSidebar
            activeCategory={activeCategory}
            activeBrand={activeBrand}
            minPrice={minPrice || null}
            maxPrice={maxPrice || null}
            priceRange={priceRange}
            onCategoryChange={(slug) => updateFilters({ category: slug })}
            onBrandChange={(slug) => updateFilters({ brand: slug })}
            onPriceChange={(min, max) => updateFilters({
              min_price: min ? String(min) : '',
              max_price: max ? String(max) : '',
            })}
            onReset={() => setSearchParams({})}
          />
        </div>

        {/* ── Products Grid ── */}
        <div className="flex-1 min-w-0">
          <ProductGrid products={displayedProducts} loading={loading} />
        </div>
      </div>

      {/* ── Mobile Filter Overlay ── */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          {/* Sidebar */}
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] drawer-glass shadow-glass-lg overflow-y-auto">
            <div className="sticky top-0 bg-white/80 dark:bg-dark-900/80 backdrop-blur-xl border-b border-gray-200/50 dark:border-white/5 px-4 py-3 flex items-center justify-between z-10">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">Filters</h2>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4">
              <FilterSidebar
                activeCategory={activeCategory}
                activeBrand={activeBrand}
                minPrice={minPrice || null}
                maxPrice={maxPrice || null}
                priceRange={priceRange}
                onCategoryChange={(slug) => { updateFilters({ category: slug }); setSidebarOpen(false); }}
                onBrandChange={(slug) => { updateFilters({ brand: slug }); setSidebarOpen(false); }}
                onPriceChange={(min, max) => { updateFilters({ min_price: min ? String(min) : '', max_price: max ? String(max) : '' }); setSidebarOpen(false); }}
                onReset={() => { setSearchParams({}); setSidebarOpen(false); }}
              />
            </div>
          </div>
        </div>
      )}

      <CartDrawer />
    </div>
  );
}
