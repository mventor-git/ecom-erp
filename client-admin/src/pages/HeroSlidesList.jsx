import { useState, useEffect } from 'react';
import { getHeroSlides, createHeroSlide, updateHeroSlide, deleteHeroSlide, getAdminProducts } from '../api/adminApi';

export default function HeroSlidesList() {
  const [slides, setSlides] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    cta_text: 'Shop Now',
    cta_link: '/products',
    product_id: '',
    image_url: '',
    is_active: true,
    sort_order: 0
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [slidesRes, productsRes] = await Promise.all([
        getHeroSlides(),
        getAdminProducts()
      ]);
      setSlides(slidesRes.data || []);
      setProducts(productsRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (slide = null) => {
    if (slide) {
      setEditingId(slide.id);
      setFormData({
        title: slide.title,
        description: slide.description || '',
        cta_text: slide.cta_text || 'Shop Now',
        cta_link: slide.cta_link || '/products',
        product_id: slide.product_id || '',
        image_url: slide.image_url || '',
        is_active: slide.is_active === 1,
        sort_order: slide.sort_order || 0
      });
    } else {
      setEditingId(null);
      setFormData({
        title: '',
        description: '',
        cta_text: 'Shop Now',
        cta_link: '/products',
        product_id: '',
        image_url: '',
        is_active: true,
        sort_order: 0
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingId(null);
    setFormData({
      title: '',
      description: '',
      cta_text: 'Shop Now',
      cta_link: '/products',
      product_id: '',
      image_url: '',
      is_active: true,
      sort_order: 0
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const data = {
        ...formData,
        product_id: formData.product_id ? parseInt(formData.product_id) : null
      };
      
      if (editingId) {
        await updateHeroSlide(editingId, data);
      } else {
        await createHeroSlide(data);
      }
      await loadData();
      handleCloseModal();
    } catch (error) {
      console.error('Error saving hero slide:', error);
      alert('Failed to save hero slide');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this hero slide?')) return;
    
    try {
      await deleteHeroSlide(id);
      await loadData();
    } catch (error) {
      console.error('Error deleting hero slide:', error);
      alert('Failed to delete hero slide');
    }
  };

  const handleToggleActive = async (slide) => {
    try {
      await updateHeroSlide(slide.id, {
        ...slide,
        is_active: !slide.is_active
      });
      await loadData();
    } catch (error) {
      console.error('Error toggling hero slide:', error);
    }
  };

  const handleProductChange = (productId) => {
    const product = products.find(p => p.id === parseInt(productId));
    setFormData({
      ...formData,
      product_id: productId,
      image_url: product ? product.image_url : formData.image_url,
      title: product ? product.name : formData.title,
      description: product ? product.description : formData.description
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Hero Slider</h1>
          <p className="text-gray-600 mt-1">Manage the hero slider displayed on the homepage</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          + New Slide
        </button>
      </div>

      {slides.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <div className="text-6xl mb-4">🖼️</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Hero Slides Yet</h3>
          <p className="text-gray-600 mb-6">Create your first hero slide to display on the homepage</p>
          <button
            onClick={() => handleOpenModal()}
            className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Create Slide
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {slides.map((slide) => (
            <div key={slide.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="aspect-video bg-gray-100 relative">
                {slide.image_url ? (
                  <img src={slide.image_url} alt={slide.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <span className="text-4xl">🖼️</span>
                  </div>
                )}
                <div className="absolute top-2 right-2">
                  <button
                    onClick={() => handleToggleActive(slide)}
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      slide.is_active
                        ? 'bg-green-100 text-green-800 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                    }`}
                  >
                    {slide.is_active ? 'Active' : 'Inactive'}
                  </button>
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 mb-1">{slide.title}</h3>
                {slide.description && (
                  <p className="text-sm text-gray-600 mb-2 line-clamp-2">{slide.description}</p>
                )}
                <div className="flex items-center justify-between text-sm text-gray-500 mb-3">
                  <span>Order: {slide.sort_order}</span>
                  {slide.product_name && (
                    <span className="text-primary-600">{slide.product_name}</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleOpenModal(slide)}
                    className="flex-1 px-3 py-2 bg-primary-50 text-primary-600 rounded-lg hover:bg-primary-100 transition-colors text-sm font-medium"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(slide.id)}
                    className="px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleSubmit}>
              <div className="p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  {editingId ? 'Edit Hero Slide' : 'New Hero Slide'}
                </h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Product (Optional)
                    </label>
                    <select
                      value={formData.product_id}
                      onChange={(e) => handleProductChange(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                      <option value="">Select a product...</option>
                      {products.map(product => (
                        <option key={product.id} value={product.id}>
                          {product.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Title *
                    </label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      required
                      placeholder="Everything your store needs"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      rows={3}
                      placeholder="What makes this store special..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Image URL
                    </label>
                    <input
                      type="text"
                      value={formData.image_url}
                      onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="/images/products/product-name.jpg"
                    />
                    {formData.image_url && (
                      <div className="mt-2 aspect-video bg-gray-100 rounded-lg overflow-hidden">
                        <img src={formData.image_url} alt="Preview" className="w-full h-full object-cover" />
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        CTA Text
                      </label>
                      <input
                        type="text"
                        value={formData.cta_text}
                        onChange={(e) => setFormData({ ...formData, cta_text: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        placeholder="Shop Now"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        CTA Link
                      </label>
                      <input
                        type="text"
                        value={formData.cta_link}
                        onChange={(e) => setFormData({ ...formData, cta_link: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        placeholder="/products"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Sort Order
                    </label>
                    <input
                      type="number"
                      value={formData.sort_order}
                      onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">Lower numbers appear first</p>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="is_active"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <label htmlFor="is_active" className="ml-2 block text-sm text-gray-900">
                      Active
                    </label>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3 rounded-b-lg">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  {editingId ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
