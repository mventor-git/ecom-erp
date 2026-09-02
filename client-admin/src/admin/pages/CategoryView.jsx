import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getAdminProducts, getAdminCategories, storeProductUrl } from '../../api/adminApi';
import { useAdminCurrency } from '../../utils/currency';

export default function CategoryView() {
  const { id } = useParams();
  const { format } = useAdminCurrency();
  const [category, setCategory] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getAdminCategories(), getAdminProducts()])
      .then(([catsRes, prodsRes]) => {
        const cat = (catsRes.data || []).find(c => String(c.id) === String(id));
        setCategory(cat || null);
        setProducts((prodsRes.data || []).filter(p => String(p.category_id) === String(id)));
      })
      .catch(err => console.error('Error loading category:', err))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" />
      </div>
    );
  }

  if (!category) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <p className="text-gray-500">Category not found.</p>
        <Link to="/categories" className="text-primary-600 text-sm mt-2 inline-block">← Back to categories</Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link to="/categories" className="text-sm text-gray-500 hover:text-primary-600">← Categories</Link>
        <span className="text-3xl">{category.icon || '📦'}</span>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{category.name}</h1>
          <p className="text-sm text-gray-500">{products.length} product{products.length !== 1 ? 's' : ''} in this category</p>
        </div>
      </div>

      {products.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-sm text-gray-400">No products in this category yet.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {products.map(p => (
            <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
              {p.image_url ? (
                <img src={p.image_url} alt="" className="w-14 h-14 rounded-lg object-cover bg-gray-100 shrink-0" onError={e => { e.target.style.display = 'none'; }} />
              ) : (
                <div className="w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center text-xl shrink-0">📦</div>
              )}
              <div className="min-w-0 flex-1">
                <a
                  href={storeProductUrl(p.id)}
                  target="_blank" rel="noopener noreferrer"
                  className="font-medium text-gray-900 truncate block hover:text-primary-600 hover:underline"
                  title="Open store product page"
                >
                  {p.name}
                </a>
                <p className="text-sm font-semibold text-primary-600 mt-0.5">{format(p.price)}</p>
                <p className="text-xs text-gray-400">Stock: {p.stock} · {p.active ? 'Active' : 'Inactive'}</p>
              </div>
              <Link to={`/products/${p.id}/edit`} className="text-xs text-gray-400 hover:text-primary-600 shrink-0">Edit</Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
