import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getAdminCategories, createCategory, updateCategory, deleteCategory } from '../../api/adminApi';

export default function CategoriesList() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | 'new' | category id
  const [form, setForm] = useState({ name: '', icon: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { loadCategories(); }, []);

  const loadCategories = async () => {
    try {
      const res = await getAdminCategories();
      setCategories(res.data);
    } catch (err) {
      console.error('Error loading categories:', err);
    } finally {
      setLoading(false);
    }
  };

  const startNew = () => {
    setEditing('new');
    setForm({ name: '', icon: '' });
    setError('');
  };

  const startEdit = (cat) => {
    setEditing(cat.id);
    setForm({ name: cat.name, icon: cat.icon || '' });
    setError('');
  };

  const cancelEdit = () => {
    setEditing(null);
    setForm({ name: '', icon: '' });
    setError('');
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError('Category name is required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (editing === 'new') {
        await createCategory(form.name.trim(), form.icon.trim());
      } else {
        await updateCategory(editing, { name: form.name.trim(), icon: form.icon.trim() });
      }
      await loadCategories();
      cancelEdit();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save category');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cat) => {
    if (cat.id === 1) {
      alert('Cannot delete the default category.');
      return;
    }
    if (!window.confirm(`Delete category "${cat.name}"?\n\nProducts in this category will be moved to the default category.`)) return;
    try {
      await deleteCategory(cat.id);
      await loadCategories();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete category');
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
          <h1 className="text-2xl font-bold text-gray-900">Categories</h1>
          <p className="text-sm text-gray-500 mt-1">{categories.length} categor{categories.length !== 1 ? 'ies' : 'y'} · icons shown on the storefront</p>
        </div>
        {editing === null && (
          <button onClick={startNew} className="btn-primary">
            + Add Category
          </button>
        )}
      </div>

      {/* Edit/Create Form */}
      {editing !== null && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6 max-w-lg">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
            {editing === 'new' ? 'New Category' : 'Edit Category'}
          </h2>

          {error && (
            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm border border-red-200 mb-4">{error}</div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                className="input-field"
                placeholder="e.g. Electronics, Clothing, ..."
                onKeyDown={e => e.key === 'Enter' && handleSave()}
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Icon (emoji)</label>
              <input
                type="text"
                value={form.icon}
                onChange={e => setForm(prev => ({ ...prev, icon: e.target.value }))}
                className="input-field"
                placeholder="e.g. user-interface"
                maxLength={8}
              />
              {form.icon && (
                <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
                  Preview: <span className="text-2xl">{form.icon}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 mt-6 pt-4 border-t border-gray-100">
            <button onClick={handleSave} disabled={saving} className="btn-primary">
              {saving ? 'Saving...' : editing === 'new' ? 'Create Category' : 'Save Changes'}
            </button>
            <button onClick={cancelEdit} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {/* Categories List */}
      {categories.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900">No categories yet</h3>
          <p className="text-sm text-gray-500 mt-1">Create your first category to organize products.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {categories.map(cat => (
            <div key={cat.id} className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center shrink-0">
                  <span className="text-lg">{cat.icon || '📦'}</span>
                </div>
                <div className="min-w-0">
                  <h3 className="font-medium text-gray-900 truncate">{cat.name}</h3>
                  <p className="text-xs text-gray-400">
                    {cat.product_count || 0} product{(cat.product_count || 0) !== 1 ? 's' : ''}
                    {cat.id === 1 && <span className="ml-2 text-primary-500 font-medium">Default</span>}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-2">
                <Link
                  to={`/categories/${cat.id}`}
                  className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                  title="View category"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </Link>
                <button
                  onClick={() => startEdit(cat)}
                  className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                  title="Edit"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                {cat.id !== 1 && (
                  <button
                    onClick={() => handleDelete(cat)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
