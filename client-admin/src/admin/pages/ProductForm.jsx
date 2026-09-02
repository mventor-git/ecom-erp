import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createProduct, updateProduct, getAdminProducts, getAdminCategories, getAdminBrands } from '../../api/adminApi';
import { useLanguage } from '../../i18n';
import { Save, ArrowLeft } from 'lucide-react';
import { centsToEGPInput, egpToCents, egpErrorText } from '../../utils/money';

export default function ProductForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const isEdit = !!id;
  const [form, setForm] = useState({ name: '', name_ar: '', description: '', price: '', cost_price: '', stock: '0', category_id: '', brand_id: '', active: '1' });
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getAdminCategories(), getAdminBrands()])
      .then(([catRes, brandRes]) => {
        setCategories(catRes.data || []);
        setBrands(brandRes.data || []);
      })
      .catch(() => {});
    if (isEdit) {
      getAdminProducts().then(r => {
        const products = r.data || [];
        const p = products.find(x => x.id === parseInt(id));
        if (p) setForm({ name: p.name || '', name_ar: p.name_ar || '', description: p.description || '', price: centsToEGPInput(p.price), cost_price: centsToEGPInput(p.cost_price), stock: '0', category_id: String(p.category_id || ''), brand_id: String(p.brand_id || ''), active: p.active ? '1' : '0' });
      }).catch(() => setError('Failed to load product')).finally(() => setLoading(false));
    } else setLoading(false);
  }, [id]);

  const handleChange = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError(t('Product name is required')); return; }
    // Money invariant: the DB stores INTEGER cents; the form inputs are human EGP.
    // Validate + convert explicitly — never silently coerce bad input to 0.
    const price = egpToCents(form.price);
    if (!price.ok) { setError(`${t('Retail Price (EGP)')}: ${egpErrorText(price.reason)}`); return; }
    const cost = egpToCents(form.cost_price);
    if (!cost.ok) { setError(`${t('Wholesale Cost (EGP)')}: ${egpErrorText(cost.reason)}`); return; }
    if (!form.category_id) { setError(t('Category is required')); return; }
    setSaving(true); setError('');
    const data = {
      name: form.name.trim(),
      name_ar: form.name_ar.trim(),
      description: form.description.trim(),
      price: price.cents,
      cost_price: cost.cents,
      stock: parseInt(form.stock) || 0,
      category_id: parseInt(form.category_id) || 0,
      brand_id: form.brand_id ? parseInt(form.brand_id) : null,
      active: form.active === '1' ? 1 : 0,
    };
    try {
      if (isEdit) { await updateProduct(parseInt(id), data); } else { await createProduct(data); }
      navigate('/products');
    } catch (err) { setError(err.response?.data?.error || 'Failed to save product'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="bg-white rounded-xl border border-gray-200 p-16 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" /></div>;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/products')} className="text-gray-500 hover:text-gray-700"><ArrowLeft className="w-5 h-5" /></button>
        <h1 className="text-2xl font-bold text-gray-900">{isEdit ? t('Edit Product') : t('New Product')}</h1>
      </div>
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('Name')} *</label>
            <input value={form.name} onChange={e => handleChange('name', e.target.value)} className="input-field w-full" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('Name (Arabic)')}</label>
            <input value={form.name_ar} onChange={e => handleChange('name_ar', e.target.value)} className="input-field w-full" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('Retail Price (EGP)')} *</label>
            <input type="number" step="0.01" min="0" value={form.price} onChange={e => handleChange('price', e.target.value)} className="input-field w-full" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('Wholesale Cost (EGP)')} *</label>
            <input type="number" step="0.01" min="0" value={form.cost_price} onChange={e => handleChange('cost_price', e.target.value)} className="input-field w-full" />
          </div>
          {!isEdit && <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('Initial Stock')}</label>
            <input type="number" min="0" value={form.stock} onChange={e => handleChange('stock', e.target.value)} className="input-field w-full" />
          </div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('Category')} *</label>
            <select value={form.category_id} onChange={e => handleChange('category_id', e.target.value)} className="input-field w-full">
              <option value="">{t('Select category')}</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('Brand')}</label>
            <select value={form.brand_id} onChange={e => handleChange('brand_id', e.target.value)} className="input-field w-full">
              <option value="">{t('Select brand')}</option>
              {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2 pt-6">
            <input type="checkbox" id="active" checked={form.active === '1'} onChange={e => handleChange('active', e.target.checked ? '1' : '0')} className="rounded border-gray-300" />
            <label htmlFor="active" className="text-sm font-medium text-gray-700">{t('Active')}</label>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('Description')}</label>
          <textarea value={form.description} onChange={e => handleChange('description', e.target.value)} rows={3} className="input-field w-full" />
        </div>
        <div className="flex items-center gap-3 pt-2">
          <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2"><Save className="w-4 h-4" /> {saving ? t('Saving...') : (isEdit ? t('Update Product') : t('Create Product'))}</button>
          <button type="button" onClick={() => navigate('/products')} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">{t('Cancel')}</button>
        </div>
      </form>
    </div>
  );
}