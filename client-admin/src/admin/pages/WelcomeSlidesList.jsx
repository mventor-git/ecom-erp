import { useState, useEffect } from 'react';
import { getWelcomeSlides, createWelcomeSlide, updateWelcomeSlide, deleteWelcomeSlide, reorderWelcomeSlides, getAdminProducts } from '../../api/adminApi';

export default function WelcomeSlidesList() {
  const [slides, setSlides] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [editingSlide, setEditingSlide] = useState(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [slidesRes, productsRes] = await Promise.all([
        getWelcomeSlides(),
        getAdminProducts(),
      ]);
      setSlides(slidesRes.data || []);
      setProducts(productsRes.data || []);
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleMoveUp = async (index) => {
    if (index === 0) return;
    const ids = slides.map(s => s.id);
    [ids[index], ids[index - 1]] = [ids[index - 1], ids[index]];
    try {
      await reorderWelcomeSlides(ids);
      await loadData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to reorder');
    }
  };

  const handleMoveDown = async (index) => {
    if (index === slides.length - 1) return;
    const ids = slides.map(s => s.id);
    [ids[index], ids[index + 1]] = [ids[index + 1], ids[index]];
    try {
      await reorderWelcomeSlides(ids);
      await loadData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to reorder');
    }
  };

  const handleToggleActive = async (slide) => {
    setSaving(slide.id);
    try {
      await updateWelcomeSlide(slide.id, { is_active: !slide.is_active });
      await loadData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update');
    } finally {
      setSaving(null);
    }
  };

  const handleDelete = async (slide) => {
    if (!confirm('Are you sure you want to delete this slide?')) return;
    setSaving(slide.id);
    try {
      await deleteWelcomeSlide(slide.id);
      await loadData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete');
    } finally {
      setSaving(null);
    }
  };

  const handleEdit = (slide) => {
    setEditingSlide(slide);
    setShowForm(true);
  };

  const handleCreate = () => {
    setEditingSlide(null);
    setShowForm(true);
  };

  const handleFormSubmit = async (formData) => {
    try {
      if (editingSlide) {
        await updateWelcomeSlide(editingSlide.id, formData);
      } else {
        await createWelcomeSlide(formData);
      }
      setShowForm(false);
      setEditingSlide(null);
      await loadData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to save');
    }
  };

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
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome Slides</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage the full-page slider on the welcome/landing page.
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
        >
          + Add Slide
        </button>
      </div>

      {/* Slides List */}
      {slides.length === 0 ? (
        <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl p-12 text-center">
          <p className="text-gray-400 text-sm">No welcome slides yet.</p>
          <p className="text-gray-400 text-xs mt-1">Click "Add Slide" to create your first slide.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {slides.map((slide, index) => (
            <div
              key={slide.id}
              className={`flex items-center gap-4 bg-white border rounded-xl px-4 py-3 hover:shadow-sm transition-shadow ${
                slide.is_active ? 'border-gray-200' : 'border-gray-100 opacity-60'
              }`}
            >
              {/* Order number */}
              <span className="text-sm font-bold text-gray-300 w-6 text-center shrink-0">
                {index + 1}
              </span>

              {/* Thumbnail */}
              <div className="w-20 h-14 rounded-lg overflow-hidden bg-gray-100 border border-gray-200 shrink-0">
                {slide.image_url ? (
                  <img src={slide.image_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300 text-lg">
                    🖼️
                  </div>
                )}
              </div>

              {/* Slide info */}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">{slide.title}</p>
                <p className="text-xs text-gray-400 truncate">
                  {slide.subtitle && <span className="mr-2">{slide.subtitle}</span>}
                  {slide.product_name && <span className="text-primary-500">→ {slide.product_name}</span>}
                </p>
              </div>

              {/* Status */}
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                slide.is_active 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-gray-100 text-gray-500'
              }`}>
                {slide.is_active ? 'Active' : 'Inactive'}
              </span>

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
                  disabled={index === slides.length - 1}
                  className="p-1.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg hover:bg-gray-100"
                  title="Move down"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleToggleActive(slide)}
                  disabled={saving === slide.id}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-40 ${
                    slide.is_active
                      ? 'text-yellow-600 bg-yellow-50 hover:bg-yellow-100'
                      : 'text-green-600 bg-green-50 hover:bg-green-100'
                  }`}
                >
                  {saving === slide.id ? '...' : slide.is_active ? 'Disable' : 'Enable'}
                </button>
                <button
                  onClick={() => handleEdit(slide)}
                  className="px-3 py-1.5 text-xs font-medium text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(slide)}
                  disabled={saving === slide.id}
                  className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-40"
                >
                  {saving === slide.id ? '...' : 'Delete'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <SlideForm
          slide={editingSlide}
          products={products}
          onSubmit={handleFormSubmit}
          onCancel={() => { setShowForm(false); setEditingSlide(null); }}
        />
      )}
    </div>
  );
}

function SlideForm({ slide, products, onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    title: slide?.title || '',
    subtitle: slide?.subtitle || '',
    description: slide?.description || '',
    image_url: slide?.image_url || '',
    product_id: slide?.product_id || '',
    cta_text: slide?.cta_text || 'View Product',
    cta_link: slide?.cta_link || '',
    title_color: slide?.title_color || '#ffffff',
    subtitle_color: slide?.subtitle_color || '#ffffff',
    desc_color: slide?.desc_color || '#ffffff',
    overlay_opacity: slide?.overlay_opacity ?? 0.4,
    is_active: slide?.is_active ?? true,
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      product_id: formData.product_id ? parseInt(formData.product_id) : null,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {slide ? 'Edit Slide' : 'Add New Slide'}
          </h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input
              type="text"
              value={formData.title}
              onChange={e => handleChange('title', e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Enter slide title"
            />
          </div>

          {/* Subtitle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subtitle</label>
            <input
              type="text"
              value={formData.subtitle}
              onChange={e => handleChange('subtitle', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Enter subtitle (optional)"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={e => handleChange('description', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Enter description (optional)"
            />
          </div>

          {/* Image URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Image URL *</label>
            <input
              type="url"
              value={formData.image_url}
              onChange={e => handleChange('image_url', e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="https://example.com/image.jpg"
            />
            {formData.image_url && (
              <img src={formData.image_url} alt="Preview" className="mt-2 h-32 w-full object-cover rounded-lg border" />
            )}
          </div>

          {/* Product Link */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Link to Product</label>
            <select
              value={formData.product_id}
              onChange={e => handleChange('product_id', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">-- No product link --</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* CTA Text */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Button Text</label>
            <input
              type="text"
              value={formData.cta_text}
              onChange={e => handleChange('cta_text', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="View Product"
            />
          </div>

          {/* Custom Link */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Custom Link (if no product)</label>
            <input
              type="text"
              value={formData.cta_link}
              onChange={e => handleChange('cta_link', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="/products or https://..."
            />
          </div>

          {/* Colors */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title Color</label>
              <input
                type="color"
                value={formData.title_color}
                onChange={e => handleChange('title_color', e.target.value)}
                className="w-full h-10 rounded-lg border border-gray-300 cursor-pointer"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subtitle Color</label>
              <input
                type="color"
                value={formData.subtitle_color}
                onChange={e => handleChange('subtitle_color', e.target.value)}
                className="w-full h-10 rounded-lg border border-gray-300 cursor-pointer"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description Color</label>
              <input
                type="color"
                value={formData.desc_color}
                onChange={e => handleChange('desc_color', e.target.value)}
                className="w-full h-10 rounded-lg border border-gray-300 cursor-pointer"
              />
            </div>
          </div>

          {/* Overlay Opacity */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Overlay Opacity: {formData.overlay_opacity}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={formData.overlay_opacity}
              onChange={e => handleChange('overlay_opacity', parseFloat(e.target.value))}
              className="w-full"
            />
          </div>

          {/* Active Toggle */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={e => handleChange('is_active', e.target.checked)}
              className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
            />
            <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
              Active (visible on welcome page)
            </label>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
            >
              {slide ? 'Update Slide' : 'Create Slide'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
