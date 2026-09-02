import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import { getAdminProducts, deleteProduct, trashAllProducts, getProductsExportUrl, storeProductUrl } from '../../api/adminApi';
import { useAdminCurrency } from '../../utils/currency';
import { useLanguage } from '../../i18n';

export default function ProductsList() {
  const { format } = useAdminCurrency();
  const { t } = useLanguage();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [importMsg, setImportMsg] = useState('');
  const [importErr, setImportErr] = useState('');
  const [showTrashAllModal, setShowTrashAllModal] = useState(false);
  const [trashingAll, setTrashingAll] = useState(false);

  useEffect(() => {
    loadProducts();
  }, []);

  function loadProducts() {
    setLoading(true);
    getAdminProducts()
      .then(res => setProducts(res.data))
      .catch(err => console.error('Error loading products:', err))
      .finally(() => setLoading(false));
  }

  // Smart instant search: name / sku / barcode / category
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return products;
    return products.filter(p =>
      (p.name || '').toLowerCase().includes(q) ||
      (p.name_ar || '').includes(q) ||
      (p.sku || '').toLowerCase().includes(q) ||
      (p.barcode || '').toLowerCase().includes(q) ||
      (p.category_name || '').toLowerCase().includes(q)
    );
  }, [products, search]);

  const handleDelete = async (product) => {
    if (!window.confirm(`${t('Move')} "${product.name}" ${t('to trash?')}\n\n${t('You can restore it anytime from the Trash page.')}`)) return;
    try {
      await deleteProduct(product.id);
      setProducts(prev => prev.filter(p => p.id !== product.id));
    } catch {
      alert(t('Failed to delete product'));
    }
  };

  const handleTrashAll = async () => {
    setTrashingAll(true);
    try {
      const res = await trashAllProducts();
      setShowTrashAllModal(false);
      setImportMsg(res.data?.message || t('All products moved to trash.'));
      setImportErr('');
      setProducts([]);
    } catch (err) {
      setImportErr(err.response?.data?.error || t('Failed to move products to trash'));
    } finally {
      setTrashingAll(false);
    }
  };

  const colors = (product) => {
    if (!product.colors) return null;
    try {
      const c = typeof product.colors === 'string' ? JSON.parse(product.colors) : product.colors;
      if (!Array.isArray(c) || c.length === 0) return null;
      return (
        <div className="flex items-center gap-1">
          {c.slice(0, 4).map((color, i) => (
            <span
              key={i}
              className="w-4 h-4 rounded-full border border-gray-200 shrink-0"
              style={{ backgroundColor: color.hex || '#ccc' }}
              title={color.name}
            />
          ))}
          {c.length > 4 && <span className="text-xs text-gray-400 ml-0.5">+{c.length - 4}</span>}
        </div>
      );
    } catch {
      return null;
    }
  };

  const columns = [
    {
      key: 'name',
      label: t('Product'),
      render: (row) => (
        <div className="flex items-center gap-3">
          {row.image_url ? (
            <img src={row.image_url} alt="" className="w-9 h-9 rounded-lg object-cover bg-gray-100 shrink-0"
              onError={e => { e.target.style.display = 'none'; }} />
          ) : (
            <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-sm shrink-0">📦</div>
          )}
          <div className="min-w-0">
            <a
              href={storeProductUrl(row.id)}
              target="_blank" rel="noopener noreferrer"
              className="font-medium text-gray-900 block truncate hover:text-primary-600 hover:underline"
              title={t('Open the store product page')}
            >
              {row.name}
              {row.name_ar ? <span className="block text-[11px] text-gray-400" dir="rtl">{row.name_ar}</span> : null}
            </a>
            <span className="text-xs text-gray-400">ID: {row.id}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'category_name',
      label: t('Category'),
      render: (row) => <span className="text-gray-500 text-sm">{row.category_name || '-'}</span>,
    },
    {
      key: 'price',
      label: t('Price'),
      align: 'right',
      render: (row) => {
        const cost = row.cost_price || 0;
        const marginPct = cost > 0 ? Math.round(((row.price - cost) / cost) * 100) : null;
        return (
          <div className="text-right">
            <span className="font-medium">{format(row.price)}</span>
            {cost > 0 && (
              <p className="text-[11px] text-gray-500 leading-tight" title={t('Wholesale (cost) → markup = selling price')}>
                {t('Wholesale')} {format(cost)} · {marginPct >= 0 ? '+' : ''}{marginPct}%
              </p>
            )}
          </div>
        );
      },
    },
    {
      key: 'stock',
      label: t('Stock'),
      align: 'right',
      render: (row) => (
        <span className={row.stock <= 5 && row.stock > 0 ? 'text-amber-600 font-medium' : 'text-gray-500'}>
          {row.stock}
        </span>
      ),
    },
    {
      key: 'colors',
      label: t('Colors'),
      render: (row) => colors(row) || <span className="text-gray-300 text-xs">—</span>,
    },
    {
      key: 'active',
      label: t('Status'),
      render: (row) => <StatusBadge status={row.active ? 'active' : 'inactive'} />,
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      className: 'w-24',
      render: (row) => (
        <div className="flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
          <Link
            to={`/products/${row.id}/edit`}
            className="px-3 py-1.5 text-xs font-medium text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
          >
            Edit
          </Link>
          <button
            onClick={() => handleDelete(row)}
            className="px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          >
            Delete
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      {/* Toolbar: search + import/export */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="relative w-full max-w-md">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('Smart search: name, SKU, barcode, category...')}
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <a href={getProductsExportUrl()} className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
            {t('⬇ Export CSV')}
          </a>
          <Link
            to="/products/trash"
            className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            title={t('Deleted products — restore anytime')}
          >
            {t('Trash')}
          </Link>
          {/* Mass-delete intentionally hidden — destructive & rarely needed.
              Reachable again by rendering the button below. */}
          {false && (
          <button
            onClick={() => setShowTrashAllModal(true)}
            disabled={loading || products.length === 0}
            className="px-3 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
            title={t('Move ALL products to trash (reversible)')}
          >
            {t('Delete All Products')}
          </button>
          )}
        </div>
      </div>

      {importMsg && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">{importMsg}</div>}
      {importErr && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{importErr}</div>}

      {/* Delete All confirmation modal */}
      {showTrashAllModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => !trashingAll && setShowTrashAllModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0"><AlertTriangle className="w-5 h-5 text-red-500" /></div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{t('Delete all products?')}</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {t('This will move')} <b>{t('all')} {products.length} {t('product(s)')}</b> {t('to the Trash and reset the warehouse stock.')}
                </p>
              </div>
            </div>
            <ul className="text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-3 mb-5 space-y-1.5">
              <li>• {t('Products are')} <b>{t('not permanently deleted')}</b> {t('— they go to Trash.')}</li>
              <li>• {t('You can restore them anytime from')} <Link to="/products/trash" className="text-primary-600 underline">{t('Products → Trash')}</Link>.</li>
              <li>• {t('Restoring brings back the products')} <b>{t('with their original stock')}</b>{t(', alongside any products you add in the meantime.')}</li>
            </ul>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowTrashAllModal(false)}
                disabled={trashingAll}
                className="px-4 py-2 text-sm bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {t('Cancel')}
              </button>
              <button
                onClick={handleTrashAll}
                disabled={trashingAll}
                className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {trashingAll ? t('Moving to trash...') : `${t('Yes, delete all')} ${products.length} ${t('product(s)')}`}
              </button>
            </div>
          </div>
        </div>
      )}

      <DataTable
        columns={columns}
        data={filtered}
        loading={loading}
        emptyMessage={t('No products yet. Add products through inventory movements or opening balance.')}
      />
    </div>
  );
}
