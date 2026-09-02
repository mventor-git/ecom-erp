import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getAdminProducts, getAdminFeatured, toggleFeature, reorderFeatured, updateProduct } from '../../api/adminApi';
import { useAdminCurrency } from '../../utils/currency';

export default function FeaturedList() {
  const { format } = useAdminCurrency();
  const [allProducts, setAllProducts] = useState([]);
  const [featured, setFeatured] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null); // product id being saved
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [prodRes, featRes] = await Promise.all([
        getAdminProducts(),
        getAdminFeatured().catch(() => ({ data: [] })),
      ]);
      setAllProducts(prodRes.data || []);
      setFeatured(featRes.data || []);
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (product, makeFeatured) => {
    setSaving(product.id);
    try {
      await toggleFeature(product.id, makeFeatured);
      await loadData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update featured status');
    } finally {
      setSaving(null);
    }
  };

  const handleMoveUp = async (index) => {
    if (index === 0) return;
    const ids = featured.map(p => p.id);
    [ids[index], ids[index - 1]] = [ids[index - 1], ids[index]];
    try {
      await reorderFeatured(ids);
      await loadData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to reorder');
    }
  };

  const handleMoveDown = async (index) => {
    if (index === featured.length - 1) return;
    const ids = featured.map(p => p.id);
    [ids[index], ids[index + 1]] = [ids[index + 1], ids[index]];
    try {
      await reorderFeatured(ids);
      await loadData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to reorder');
    }
  };

  const handleColorChange = async (product, field, color) => {
    try {
      await updateProduct(product.id, { [field]: color });
      await loadData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update color');
    }
  };

  // Toggle the "New" badge (admin-controlled, shown on product cards)
  const handleNewToggle = async (product) => {
    setSaving(product.id);
    try {
      await updateProduct(product.id, { is_new: !product.is_new });
      await loadData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update NEW badge');
    } finally {
      setSaving(null);
    }
  };

  // Filter non-featured products for "available to add" list
  const featuredIds = new Set(featured.map(p => p.id));
  const availableProducts = allProducts.filter(p => !featuredIds.has(p.id));
  const filteredAvailable = availableProducts.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase())
  );
  // Smart search also filters the currently featured list
  const filteredFeatured = featured.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-1/3" />
        <div className="h-64 bg-gray-200 rounded-xl" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Featured Products</h1>
        <p className="text-sm text-gray-500 mt-1">
          Select products to feature on the homepage and photo stack. Drag or use arrows to reorder.
        </p>
      </div>

      {/* ── Currently Featured ── */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Currently Featured ({featured.length})
        </h2>

        {filteredFeatured.length === 0 ? (
          <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl p-12 text-center">
            <p className="text-gray-400 text-sm">
              {search ? 'No featured products match your search.' : 'No featured products yet.'}
            </p>
            <p className="text-gray-400 text-xs mt-1">Select products from the list below to feature them.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredFeatured.map((product, index) => (
              <div key={product.id}
                className="flex items-center gap-4 bg-white border border-gray-200 rounded-xl px-4 py-3 hover:shadow-sm transition-shadow">
                {/* Order number */}
                <span className="text-sm font-bold text-gray-300 w-6 text-center shrink-0">
                  {index + 1}
                </span>

                {/* Thumbnail */}
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 border border-gray-200 shrink-0">
                  {product.image_url ? (
                    <img src={product.image_url} alt="" className="w-full h-full object-cover"
                      onError={e => { e.target.style.display = 'none'; }} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300 text-lg">
                      📦
                    </div>
                  )}
                </div>

                {/* Product info */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{product.name}</p>
                  <p className="text-xs text-gray-400">
                    {product.category_name} — {format(product.price)}
                  </p>
                </div>

                {/* Hero text color pickers */}
                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex items-center gap-1">
                    <label className="text-xs text-gray-500">Title:</label>
                    <input
                      type="color"
                      value={product.hero_title_color || '#ffffff'}
                      onChange={(e) => handleColorChange(product, 'hero_title_color', e.target.value)}
                      className="w-7 h-7 rounded border border-gray-300 cursor-pointer"
                      title="Hero title color"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <label className="text-xs text-gray-500">Desc:</label>
                    <input
                      type="color"
                      value={product.hero_desc_color || '#ffffff'}
                      onChange={(e) => handleColorChange(product, 'hero_desc_color', e.target.value)}
                      className="w-7 h-7 rounded border border-gray-300 cursor-pointer"
                      title="Hero description color"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <label className="text-xs text-gray-500">Price:</label>
                    <input
                      type="color"
                      value={product.hero_price_color || '#ffffff'}
                      onChange={(e) => handleColorChange(product, 'hero_price_color', e.target.value)}
                      className="w-7 h-7 rounded border border-gray-300 cursor-pointer"
                      title="Hero price color"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <label className="text-xs text-gray-500">Badge:</label>
                    <input
                      type="color"
                      value={product.hero_badge_color || '#ffffff'}
                      onChange={(e) => handleColorChange(product, 'hero_badge_color', e.target.value)}
                      className="w-7 h-7 rounded border border-gray-300 cursor-pointer"
                      title="Hero badge color"
                    />
                  </div>
                </div>

                {/* NEW badge toggle */}
                <button
                  onClick={() => handleNewToggle(product)}
                  disabled={saving === product.id}
                  title={product.is_new ? 'Click to remove the NEW badge' : 'Click to mark as NEW'}
                  className={`px-2.5 py-1.5 text-[10px] font-bold rounded-lg transition-colors shrink-0 ${
                    product.is_new ? 'bg-green-500 text-white hover:bg-green-600' : 'bg-gray-100 text-gray-400 hover:bg-green-100 hover:text-green-600'
                  }`}
                >
                  NEW
                </button>

                {/* Reorder buttons */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleMoveUp(index)}
                    disabled={index === 0}
                    className="p-1.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg hover:bg-gray-100"
                    title="Move up"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleMoveDown(index)}
                    disabled={index === featured.length - 1}
                    className="p-1.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg hover:bg-gray-100"
                    title="Move down"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>

                {/* Unfeature button */}
                <button
                  onClick={() => handleToggle(product, false)}
                  disabled={saving === product.id}
                  className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-40 shrink-0"
                >
                  {saving === product.id ? '...' : 'Remove'}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Available Products ── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Add Featured Products</h2>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search products..."
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 w-64 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>

        {filteredAvailable.length === 0 ? (
          <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl p-12 text-center">
            <p className="text-gray-400 text-sm">
              {search ? 'No products match your search.' : 'All products are already featured.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredAvailable.map(product => (
              <div key={product.id}
                className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-3 hover:shadow-sm transition-shadow">
                {/* Thumbnail */}
                <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 border border-gray-200 shrink-0">
                  {product.image_url ? (
                    <img src={product.image_url} alt="" className="w-full h-full object-cover"
                      onError={e => { e.target.style.display = 'none'; }} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">📦</div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm truncate">{product.name}</p>
                  <p className="text-xs text-gray-400">{format(product.price)}</p>
                </div>

                {/* NEW badge toggle */}
                <button
                  onClick={() => handleNewToggle(product)}
                  disabled={saving === product.id}
                  title={product.is_new ? 'Click to remove the NEW badge' : 'Click to mark as NEW'}
                  className={`px-2.5 py-1.5 text-[10px] font-bold rounded-lg transition-colors shrink-0 ${
                    product.is_new ? 'bg-green-500 text-white hover:bg-green-600' : 'bg-gray-100 text-gray-400 hover:bg-green-100 hover:text-green-600'
                  }`}
                >
                  NEW
                </button>

                {/* Feature button */}
                <button
                  onClick={() => handleToggle(product, true)}
                  disabled={saving === product.id}
                  className="px-3 py-1.5 text-xs font-medium text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors disabled:opacity-40 shrink-0"
                >
                  {saving === product.id ? '...' : 'Feature'}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
