import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { RotateCcw } from 'lucide-react';
import DataTable from '../components/DataTable';
import { getTrashedProducts, restoreAllProducts, restoreProduct } from '../../api/adminApi';
import { useAdminCurrency } from '../../utils/currency';

export default function ProductsTrash() {
  const { format } = useAdminCurrency();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadTrash();
  }, []);

  function loadTrash() {
    setLoading(true);
    getTrashedProducts()
      .then(res => setItems(res.data))
      .catch(e => console.error('Error loading trash:', e))
      .finally(() => setLoading(false));
  }

  async function handleRestoreAll() {
    if (!window.confirm(`Restore all ${items.length} product(s) with their original stock?`)) return;
    setBusy(true);
    setErr('');
    try {
      const res = await restoreAllProducts();
      setMsg(res.data?.message || 'Products restored.');
      loadTrash();
    } catch (e) {
      setErr(e.response?.data?.error || 'Failed to restore products');
    } finally {
      setBusy(false);
    }
  }

  async function handleRestore(item) {
    setBusy(true);
    setErr('');
    try {
      await restoreProduct(item.id);
      setMsg(`"${item.name}" restored.`);
      setItems(prev => prev.filter(p => p.id !== item.id));
    } catch (e) {
      setErr(e.response?.data?.error || 'Failed to restore product');
    } finally {
      setBusy(false);
    }
  }

  const columns = [
    {
      key: 'name',
      label: 'Product',
      render: (row) => (
        <div className="flex items-center gap-3">
          {row.image_url ? (
            <img src={row.image_url} alt="" className="w-9 h-9 rounded-lg object-cover bg-gray-100 shrink-0"
              onError={e => { e.target.style.display = 'none'; }} />
          ) : (
            <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-sm shrink-0">📦</div>
          )}
          <div className="min-w-0">
            <span className="font-medium text-gray-900 block truncate">{row.name}</span>
            <span className="text-xs text-gray-400">ID: {row.id}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'category_name',
      label: 'Category',
      render: (row) => <span className="text-gray-500 text-sm">{row.category_name || '-'}</span>,
    },
    {
      key: 'price',
      label: 'Price',
      align: 'right',
      render: (row) => <span className="font-medium">{format(row.price)}</span>,
    },
    {
      key: 'deleted_at',
      label: 'Deleted At',
      render: (row) => (
        <span className="text-gray-500 text-sm">
          {row.deleted_at ? String(row.deleted_at).replace('T', ' ').slice(0, 16) : '-'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      className: 'w-28',
      render: (row) => (
        <button
          onClick={() => handleRestore(row)}
          disabled={busy}
          className="px-3 py-1.5 text-xs font-medium text-primary-600 hover:bg-primary-50 rounded-lg transition-colors disabled:opacity-50"
        >
          Restore
        </button>
      ),
    },
  ];

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <p className="text-sm text-gray-500">
          Deleted products live here. Restoring brings them back <b>with their original stock</b> —
          products added after the deletion are never affected.
        </p>
        <div className="flex items-center gap-2">
          <Link to="/products" className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
            ← Back to Products
          </Link>
          <button
            onClick={handleRestoreAll}
            disabled={loading || busy || items.length === 0}
            className="px-3 py-2 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RotateCcw className="w-4 h-4 inline" /> Restore All ({items.length})
          </button>
        </div>
      </div>

      {msg && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">{msg}</div>}
      {err && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{err}</div>}

      <DataTable
        columns={columns}
        data={items}
        loading={loading}
        emptyMessage="Trash is empty — nothing to restore."
        emptyAction={
          <Link to="/products" className="btn-primary text-sm inline-block">
            Back to Products
          </Link>
        }
      />
    </div>
  );
}
