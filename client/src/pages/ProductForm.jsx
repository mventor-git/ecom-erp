import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { checkAdmin, getAdminProducts, getProduct, createProduct, updateProduct, getAdminCategories, createCategory } from '../api/products';
import ImageUploader from '../components/ImageUploader';

export default function ProductForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const [form, setForm] = useState({
    name: '',
    description: '',
    price: '',
    category_id: 1,
    image_url: '',
    stock: 0,
    active: true,
  });
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [newCategory, setNewCategory] = useState('');

  useEffect(() => {
    checkAdmin()
      .then(res => {
        if (!res.data.isAdmin) {
          navigate('/admin');
          return;
        }
        loadData();
      })
      .catch(() => navigate('/admin'));
  }, [navigate, id]);

  const loadData = async () => {
    try {
      const catRes = await getAdminCategories();
      setCategories(catRes.data);

      if (isEditing) {
        const prodRes = await getAdminProducts();
        const product = prodRes.data.find(p => p.id === Number(id));
        if (product) {
          setForm({
            name: product.name,
            description: product.description || '',
            price: (product.price / 100).toFixed(2),
            category_id: product.category_id,
            image_url: product.image_url || '',
            stock: product.stock,
            active: Boolean(product.active),
          });
        } else {
          setError('Product not found');
        }
      }
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleAddCategory = async () => {
    if (!newCategory.trim()) return;
    try {
      const res = await createCategory(newCategory.trim());
      setCategories(prev => [...prev, res.data]);
      setForm(prev => ({ ...prev, category_id: res.data.id }));
      setNewCategory('');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create category');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      const data = {
        name: form.name,
        description: form.description,
        price: parseFloat(form.price),
        category_id: parseInt(form.category_id),
        image_url: form.image_url,
        stock: parseInt(form.stock) || 0,
        active: form.active,
      };

      if (isEditing) {
        await updateProduct(id, data);
      } else {
        await createProduct(data);
      }

      navigate('/admin/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-64 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <Link to="/admin/dashboard" className="text-sm text-primary-600 hover:text-primary-700 mb-2 inline-block">
          &larr; Back to Dashboard
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">
          {isEditing ? 'Edit Product' : 'Add New Product'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-8 space-y-6">
        {error && (
          <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">{error}</div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Product Name *</label>
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              className="input-field"
              required
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={4}
              className="input-field"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Price (EGP) *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">EGP</span>
              <input
                type="number"
                name="price"
                value={form.price}
                onChange={handleChange}
                step="0.01"
                min="0"
                className="input-field pl-8"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Stock</label>
            <input
              type="number"
              name="stock"
              value={form.stock}
              onChange={handleChange}
              min="0"
              className="input-field"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <div className="flex gap-2">
              <select
                name="category_id"
                value={form.category_id}
                onChange={handleChange}
                className="input-field"
              >
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 mt-2">
              <input
                type="text"
                value={newCategory}
                onChange={e => setNewCategory(e.target.value)}
                placeholder="New category name"
                className="input-field text-sm"
              />
              <button
                type="button"
                onClick={handleAddCategory}
                className="btn-secondary text-sm whitespace-nowrap"
              >
                Add
              </button>
            </div>
          </div>

          <div className="sm:col-span-2">
            <ImageUploader
              value={form.image_url}
              onChange={(url) => setForm(prev => ({ ...prev, image_url: url }))}
            />
          </div>
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            name="active"
            checked={form.active}
            onChange={handleChange}
            id="active"
            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
          />
          <label htmlFor="active" className="ml-2 text-sm text-gray-700">Active (visible to customers)</label>
        </div>

        <div className="flex items-center justify-end space-x-4 pt-4 border-t border-gray-200">
          <Link to="/admin/dashboard" className="btn-secondary">Cancel</Link>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Saving...' : isEditing ? 'Update Product' : 'Create Product'}
          </button>
        </div>
      </form>
    </div>
  );
}
