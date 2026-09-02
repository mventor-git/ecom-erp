import { useState, useEffect } from 'react';
import { getAdminBrands, createBrand, updateBrand, deleteBrand } from '../../api/adminApi';
import ImageUploader from '../../components/ImageUploader';

export default function BrandsList() {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | 'new' | brand id
  const [form, setForm] = useState({ name: '', icon_url: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { loadBrands(); }, []);

  const loadBrands = async () => {
    try {
      const res = await getAdminBrands();
      setBrands(res.data);
    } catch (err) {
      console.error('Error loading brands:', err);
    } finally {
      setLoading(false);
    }
  };

  const startNew = () => {
    setEditing('new');
    setForm({ name: '', icon_url: '' });
    setError('');
  };

  const startEdit = (brand) => {
    setEditing(brand.id);
    setForm({ name: brand.name, icon_url: brand.icon_url || '' });
    setError('');
  };

  const cancelEdit = () => {
    setEditing(null);
    setForm({ name: '', icon_url: '' });
    setError('');
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError('Brand name is required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (editing === 'new') {
        await createBrand(form.name.trim(), form.icon_url);
      } else {
        await updateBrand(editing, { name: form.name.trim(), icon_url: form.icon_url });
      }
      await loadBrands();
      cancelEdit();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save brand');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (brand) => {
    if (!window.confirm(`Delete brand "${brand.name}"? Products linked to this brand will lose their brand association.`)) return;
    try {
      await deleteBrand(brand.id);
      await loadBrands();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete brand');
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-1/4" />
        <div className="h-64 bg-gray-200 rounded-xl" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Brands</h1>
          <p className="text-sm text-gray-500 mt-1">{brands.length} brand{brands.length !== 1 ? 's' : ''}</p>
        </div>
        {editing === null && (
          <button onClick={startNew} className="btn-primary">
            + Add Brand
          </button>
        )}
      </div>

      {/* Edit/Create Form */}
      {editing !== null && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6 max-w-lg">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
            {editing === 'new' ? 'New Brand' : 'Edit Brand'}
          </h2>

          {error && (
            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm border border-red-200 mb-4">{error}</div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Brand Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                className="input-field"
                placeholder="e.g. Nike, Apple, ..."
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Brand Icon</label>
              <ImageUploader
                value={form.icon_url}
                onChange={(url) => setForm(prev => ({ ...prev, icon_url: url }))}
              />
              <p className="text-xs text-gray-400 mt-1">Upload a small icon/logo for this brand.</p>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-6 pt-4 border-t border-gray-100">
            <button onClick={handleSave} disabled={saving} className="btn-primary">
              {saving ? 'Saving...' : editing === 'new' ? 'Create Brand' : 'Save Changes'}
            </button>
            <button onClick={cancelEdit} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {/* Brands Grid */}
      {brands.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900">No brands yet</h3>
          <p className="text-sm text-gray-500 mt-1">Create your first brand to organize products.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {brands.map(brand => (
            <div key={brand.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  {brand.icon_url ? (
                    <img
                      src={brand.icon_url}
                      alt={brand.name}
                      className="w-10 h-10 rounded-lg object-cover shrink-0"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center shrink-0">
                      <span className="text-lg font-bold text-gray-400">{brand.name.charAt(0)}</span>
                    </div>
                  )}
                  <div className="min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">{brand.name}</h3>
                    <p className="text-xs text-gray-400">{brand.product_count || 0} product{(brand.product_count || 0) !== 1 ? 's' : ''}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-2">
                  <button
                    onClick={() => startEdit(brand)}
                    className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(brand)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
