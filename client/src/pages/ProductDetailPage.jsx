import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useCurrency } from '../context/CurrencyContext';
import { useAuth } from '../context/AuthContext';
import CartDrawer from '../components/CartDrawer';
import WishlistButton from '../components/WishlistButton';
import Stars from '../components/Stars';
import ProductColorSwatches from '../components/ProductColorSwatches';
import SizeSelector from '../components/SizeSelector';
import { getProduct, getProductImages, getProductReviews, addProductReview } from '../api/products';
import { getPublicSetting } from '../api/settings';
import Price from '../components/Price';
import { useLanguage, localized } from '../i18n';
import { parseColors, parseSizes, matchVariantImage } from '../utils/productParsers';

export default function ProductDetailPage() {
  const { lang } = useLanguage();
  const { id } = useParams();
  const { addToCart, cartCountFor } = useCart();
  const { format } = useCurrency();
  const { user, login } = useAuth();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [selectedColor, setSelectedColor] = useState(null);
  const [selectedSize, setSelectedSize] = useState(null);
  const [imgFailed, setImgFailed] = useState(false);
  const [galleryImages, setGalleryImages] = useState([]);
  const [selectedGalleryIndex, setSelectedGalleryIndex] = useState(null);

  // ── Reviews ──
  const [reviews, setReviews] = useState([]);
  const [reviewsEnabled, setReviewsEnabled] = useState(true);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewMsg, setReviewMsg] = useState('');
  const reviewsRef = useRef(null);

  useEffect(() => {
    getPublicSetting('reviews_enabled', true).then(v => setReviewsEnabled(v !== false)).catch(() => {});
  }, []);

  // Load reviews when reviews are enabled
  useEffect(() => {
    if (!reviewsEnabled || !id) return;
    getProductReviews(id).then(res => setReviews(res.data || [])).catch(() => {});
  }, [id, reviewsEnabled]);

  // The user's own review (if any) — their rating takes the highlight
  const myReview = (user && reviews.find(r => r.customer_id === user.id)) || null;

  useEffect(() => {
    if (myReview) {
      setReviewRating(myReview.rating);
      setReviewComment(myReview.comment || '');
    }
  }, [myReview?.id]);

  const scrollToReviews = () => {
    reviewsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Tap the stars to set/change YOUR rating (keeps any existing comment)
  const handleMyRatingChange = async (rating) => {
    if (!user) { login(); return; }
    setReviewRating(rating);
    try {
      await addProductReview(id, rating, reviewComment);
      const [revRes, prodRes] = await Promise.all([getProductReviews(id), getProduct(id)]);
      setReviews(revRes.data || []);
      if (prodRes.data) setProduct(prodRes.data);
    } catch (err) {
      console.error('Failed to save rating:', err);
    }
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!user) { login(); return; }
    if (reviewRating < 1) { setReviewMsg('Please select a star rating'); return; }
    setSubmittingReview(true);
    setReviewMsg('');
    try {
      await addProductReview(id, reviewRating, reviewComment);
      setReviewMsg('Thanks for your review!');
      setReviewComment('');
      const [revRes, prodRes] = await Promise.all([getProductReviews(id), getProduct(id)]);
      setReviews(revRes.data || []);
      if (prodRes.data) setProduct(prodRes.data);
    } catch (err) {
      setReviewMsg(err.response?.data?.error || 'Failed to submit review');
    } finally {
      setSubmittingReview(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    setImgFailed(false);
    setSelectedGalleryIndex(null);
    Promise.all([
      getProduct(id),
      getProductImages(id).catch(() => ({ data: [] })),
    ])
      .then(([prodRes, imgRes]) => {
        setProduct(prodRes.data);
        setGalleryImages(imgRes.data || []);
        const colors = parseColors(prodRes.data.colors);
        if (colors.length > 0) {
          setSelectedColor(colors[0]);
        } else {
          setSelectedColor(null);
        }
        const sizes = parseSizes(prodRes.data.sizes);
        if (Array.isArray(sizes) && sizes.length > 0) {
          setSelectedSize(sizes[0]);
        } else {
          setSelectedSize(null);
        }
      })
      .catch(err => console.error('Error loading product:', err))
      .finally(() => setLoading(false));
  }, [id]);
  // Find variant-specific image for the main display
  const variantImage = useMemo(() => {
    if (!selectedColor && !selectedSize) return null;
    return matchVariantImage(galleryImages, { color: selectedColor, size: selectedSize }, null);
  }, [galleryImages, selectedColor, selectedSize]);
  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="aspect-square bg-gray-200 dark:bg-dark-700 rounded-2xl" />
          <div className="space-y-4">
            <div className="h-8 bg-gray-200 dark:bg-dark-700 rounded w-3/4" />
            <div className="h-6 bg-gray-200 dark:bg-dark-700 rounded w-1/4" />
            <div className="h-24 bg-gray-200 dark:bg-dark-700 rounded" />
            <div className="h-12 bg-gray-200 dark:bg-dark-700 rounded w-1/3" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Product Not Found</h2>
        <p className="mt-2 text-gray-500 dark:text-gray-400">The product you're looking for doesn't exist.</p>
        <Link to="/products" className="btn-primary inline-block mt-6">Back to Products</Link>
      </div>
    );
  }

  // Parse colors
  let productColors = [];
  try {
    const raw = product.colors;
    productColors = typeof raw === 'string' ? JSON.parse(raw) : (Array.isArray(raw) ? raw : []);
  } catch { productColors = []; }

  // Parse sizes
  let productSizes = [];
  try {
    const raw = product.sizes;
    productSizes = typeof raw === 'string' ? JSON.parse(raw) : (Array.isArray(raw) ? raw : []);
  } catch { productSizes = []; }

  // Gallery always shows all images
  const hasGallery = galleryImages.length > 0;
  
  // Main image priority: selected gallery thumbnail > variant image > product default
  // Note: We don't use selectedColor.image_url as fallback because it may point to wrong size variant
  const galleryImage = selectedGalleryIndex !== null && selectedGalleryIndex < galleryImages.length ? galleryImages[selectedGalleryIndex]?.image_url : null;
  const displayImage = galleryImage || variantImage?.image_url || (product.image_url || null);

  const price = format(product.price);
  const inCartCount = product.stock > 0 ? cartCountFor(product.id) : 0;

  const handleAddToCart = () => {
    addToCart(product, quantity, selectedColor, selectedSize);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const handleColorChange = (color) => {
    setSelectedColor(color);
    setSelectedGalleryIndex(null); // Reset to show variant image
    setImgFailed(false);
  };

  const handleSizeChange = (size) => {
    setSelectedSize(size);
    setSelectedGalleryIndex(null); // Reset to show variant image
    setImgFailed(false);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 pb-32 lg:pb-8">
      {/* Breadcrumb — glass pills (wraps & truncates on mobile) */}
      <nav className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-6">
        <Link
          to="/home"
          className="inline-flex items-center bg-white/60 dark:bg-dark-800/60 backdrop-blur-md border border-gray-200/70 dark:border-white/10 rounded-lg px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 hover:border-primary-300 dark:hover:border-primary-500/40 hover:bg-white/90 dark:hover:bg-dark-800/90 transition-all"
        >
          Home
        </Link>
        <span className="text-gray-400 dark:text-gray-500 text-xs sm:text-sm select-none">/</span>
        <Link
          to="/products"
          className="inline-flex items-center bg-white/60 dark:bg-dark-800/60 backdrop-blur-md border border-gray-200/70 dark:border-white/10 rounded-lg px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 hover:border-primary-300 dark:hover:border-primary-500/40 hover:bg-white/90 dark:hover:bg-dark-800/90 transition-all"
        >
          Products
        </Link>
        <span className="text-gray-400 dark:text-gray-500 text-xs sm:text-sm select-none">/</span>
        <span className="inline-flex items-center min-w-0 bg-primary-500/10 dark:bg-primary-500/15 backdrop-blur-md border border-primary-200/60 dark:border-primary-500/20 rounded-lg px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-semibold text-primary-700 dark:text-primary-300 truncate max-w-[140px] sm:max-w-xs">
          {product.name}
        </span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
        {/* Image */}
        <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="relative mx-auto w-full max-w-[420px] lg:max-w-none">
            <div className="aspect-square rounded-2xl overflow-hidden bg-gradient-to-br from-gray-50 to-gray-200 dark:from-dark-800 dark:to-dark-900 border border-gray-100 dark:border-white/5 relative">
              {displayImage ? (
                <img
                  key={displayImage}
                  src={displayImage}
                  alt={localized(lang, product, 'name')}
                  className="w-full h-full object-contain p-3 sm:p-6 transition-opacity duration-300"
                  decoding="async"
                  onError={() => setImgFailed(true)}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-gray-600">
                  <svg className="w-24 h-24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
              )}
            </div>
          </div>

          {/* Gallery thumbnails */}
          {hasGallery && (
            <div className="flex items-center gap-2 flex-wrap justify-center lg:justify-start">
              {galleryImages.map((img, i) => {
                const isActive = selectedGalleryIndex === i;
                return (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => {
                      setSelectedGalleryIndex(i);
                      setImgFailed(false);
                    }}
                    className={`
                      w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden border-2 transition-all duration-200 bg-gray-50 dark:bg-dark-800
                      ${isActive 
                        ? 'border-primary-500 ring-2 ring-primary-500/30 scale-105' 
                        : 'border-gray-200 dark:border-white/10 hover:border-gray-400 dark:hover:border-white/20'}
                    `}
                  >
                    <img
                      src={img.image_url}
                      alt={`${localized(lang, product, 'name')} ${i + 1}`}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover"
                      onError={e => { e.target.style.display = 'none'; e.target.parentElement.classList.add('flex', 'items-center', 'justify-center', 'text-gray-300', 'text-xs'); e.target.parentElement.textContent = '?'; }}
                    />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Info */}
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {product.category_name && (
              <Link
                to={`/products?category=${product.category_slug || ''}`}
                className="inline-block bg-primary-100 dark:bg-primary-500/20 text-primary-700 dark:text-primary-300 text-xs sm:text-sm font-medium px-3 py-1 rounded-full hover:bg-primary-600 hover:text-white dark:hover:bg-primary-600 dark:hover:text-white transition-colors"
              >
                {product.category_name}
              </Link>
            )}
            {product.brand_name && (
              <Link
                to={`/products?brand=${product.brand_slug || ''}`}
                className="inline-flex items-center gap-1.5 bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 text-xs sm:text-sm font-medium px-3 py-1 rounded-full hover:bg-gray-800 hover:text-white dark:hover:bg-white dark:hover:text-gray-900 transition-colors"
              >
                {product.brand_icon_url && (
                  <img src={product.brand_icon_url} alt="" className="w-4 h-4 rounded-full object-cover"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                )}
                {product.brand_name}
              </Link>
            )}
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white leading-tight">{localized(lang, product, 'name')}</h1>

          {/* Price + stock */}
          <div className="mt-4 flex items-center gap-3 flex-wrap">
            {product.old_price > product.price && (
              <span className="text-xl sm:text-2xl font-semibold text-gray-400 dark:text-gray-500 line-through">
                {format(product.old_price)}
              </span>
            )}
            <Price cents={product.price} className="text-3xl sm:text-4xl font-extrabold text-primary-600 dark:text-primary-400" />
            {product.stock !== undefined && (
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full backdrop-blur-sm ${
                product.stock > 0
                  ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300'
                  : 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  product.stock > 0 ? 'bg-green-500' : 'bg-red-500'
                }`} />
                {product.stock > 0 ? 'In Stock' : 'Out of Stock'}
              </span>
            )}
          </div>
          {product.stock > 0 && product.stock <= 10 && (
            <p className="mt-2 text-sm text-amber-600 dark:text-amber-400 font-medium">Only {product.stock} left — order soon!</p>
          )}

          {/* Rating — overall from all customers + your rating (tap stars to set/change) */}
          {reviewsEnabled && (
            <div className="mt-3 flex flex-col gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Stars rating={product.rating || 0} size="md" />
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  {product.rating_count > 0
                    ? `${Number(product.rating).toFixed(1)} (${product.rating_count} review${product.rating_count !== 1 ? 's' : ''})`
                    : 'No reviews yet'}
                  <button type="button" onClick={scrollToReviews} className="text-primary-600 dark:text-primary-400 font-medium ml-1.5 hover:underline">
                    · Write a review
                  </button>
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-gray-600 dark:text-gray-300">{user ? 'Your rating:' : 'Rate this product:'}</span>
                <Stars rating={reviewRating} size="md" interactive onChange={handleMyRatingChange} />
                {reviewRating > 0 && (
                  <span className="text-sm font-semibold text-amber-500">{reviewRating}/5</span>
                )}
                {!user && (
                  <span className="text-xs text-gray-400 dark:text-gray-500">(sign in to rate)</span>
                )}
              </div>
            </div>
          )}

          {/* Color and Size Selector - Combined */}
          {productColors.length > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-white/10">
              <div className="mb-4">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Select Color & Size:</span>
              </div>
              <div className="space-y-4">
                {(() => {
                  // Group colors by base color name
                  const colorGroups = {};
                  productColors.forEach(color => {
                    const baseName = color.name.split(' - ')[0];
                    if (!colorGroups[baseName]) {
                      colorGroups[baseName] = {
                        color: color,
                        sizes: []
                      };
                    }
                    if (color.size) {
                      colorGroups[baseName].sizes.push({
                        name: color.size,
                        stock: color.stock || 0,
                        fullVariant: color
                      });
                    }
                  });

                  return Object.entries(colorGroups).map(([baseName, group], colorIndex) => {
                    const isColorSelected = selectedColor?.name?.startsWith(baseName);
                    const isWhite = group.color.hex?.toLowerCase() === '#ffffff' || group.color.hex?.toLowerCase() === '#f8f8f8' || group.color.hex?.toLowerCase() === '#f0f0f0' || group.color.hex?.toLowerCase() === '#fff';
                    
                    // Remove duplicate sizes
                    const uniqueSizes = group.sizes.filter((size, index, self) =>
                      index === self.findIndex(s => s.name === size.name)
                    );

                    return (
                      <div key={colorIndex} className="border border-gray-200 dark:border-white/10 rounded-xl p-4 bg-white/5 dark:bg-white/[0.02]">
                        {/* Color Header */}
                        <div className="flex items-center gap-3 mb-3">
                          <button
                            type="button"
                            onClick={() => {
                              handleColorChange(group.color);
                              // Auto-select first available size for this color
                              if (uniqueSizes.length > 0 && !selectedSize) {
                                handleSizeChange(uniqueSizes[0]);
                              }
                            }}
                            className={`
                              relative w-10 h-10 rounded-full transition-all duration-200 shrink-0
                              ${isColorSelected
                                ? 'ring-2 ring-primary-500 ring-offset-2 dark:ring-offset-dark-800 scale-110'
                                : 'ring-1 ring-gray-300 dark:ring-white/20 hover:ring-gray-400 dark:hover:ring-white/30 hover:scale-105'
                              }
                            `}
                            style={{
                              backgroundColor: group.color.hex || '#ccc',
                              border: isWhite ? '1px solid #e5e7eb' : 'none',
                            }}
                            title={baseName}
                          >
                            {isColorSelected && (
                              <span className="absolute inset-0 flex items-center justify-center">
                                <svg className={`w-4 h-4 ${isWhite ? 'text-gray-700' : 'text-white'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                </svg>
                              </span>
                            )}
                          </button>
                          <div className="min-w-0">
                            <div className="font-medium text-gray-900 dark:text-white">{baseName}</div>
                            {isColorSelected && selectedSize && (
                              <div className="text-xs text-gray-500 dark:text-gray-400">Selected: {selectedSize.name}</div>
                            )}
                          </div>
                        </div>
                        
                        {/* Size Buttons for this Color */}
                        {uniqueSizes.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {uniqueSizes.map((size, sizeIndex) => {
                              const isSizeSelected = isColorSelected && selectedSize?.name === size.name;
                              const isOutOfStock = size.stock === 0;
                              
                              return (
                                <button
                                  key={sizeIndex}
                                  type="button"
                                  onClick={() => {
                                    handleColorChange(group.color);
                                    handleSizeChange(size);
                                  }}
                                  disabled={isOutOfStock}
                                  className={`
                                    min-h-11 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200
                                    ${isSizeSelected
                                      ? 'bg-gradient-to-r from-primary-600 to-primary-700 text-white ring-2 ring-primary-500/30 shadow-glow scale-105'
                                      : isOutOfStock
                                        ? 'bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-gray-600 border border-gray-200 dark:border-white/5 cursor-not-allowed opacity-50'
                                        : 'bg-white/5 dark:bg-white/5 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-white/10 hover:border-primary-400 dark:hover:border-primary-500/50 hover:text-primary-600 dark:hover:text-primary-400 hover:shadow-sm'
                                    }
                                  `}
                                >
                                  {size.name}
                                  {isOutOfStock && <span className="ml-1 text-xs">(Out)</span>}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}

          {/* Description */}
          <div className="mt-6 rounded-2xl bg-white dark:bg-dark-800/60 border border-gray-100 dark:border-white/5 p-5">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Description</h3>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 leading-relaxed">
              {localized(lang, product, 'description') || product.description || 'No description available.'}
            </p>
          </div>

          {/* Quantity + Add to Cart (desktop/tablet) */}
          <div className="hidden lg:flex items-center gap-4 mt-6">
            <div className="flex items-center border border-gray-300 dark:border-white/10 rounded-xl bg-white/5 dark:bg-white/5 backdrop-blur-sm shrink-0">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-11 h-11 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 rounded-l-xl transition-colors"
                aria-label="Decrease quantity"
              >
                -
              </button>
              <span className="w-12 text-center font-medium border-x border-gray-300 dark:border-white/10 text-gray-900 dark:text-white">{quantity}</span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="w-11 h-11 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 rounded-r-xl transition-colors"
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>

            {product.stock > 0 ? (
              <>
                <button
                  onClick={handleAddToCart}
                  className={`btn-primary flex-1 px-12 ${
                    added ? 'from-green-600 to-green-700 hover:from-green-500 hover:to-green-600' : ''
                  } ${inCartCount > 0 && !added ? 'from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500' : ''}`}
                >
                  {added ? (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Added to Cart!
                    </>
                  ) : inCartCount > 0 ? (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
                      </svg>
                      Add More · Count: {inCartCount}
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
                      </svg>
                      Add to Cart
                    </>
                  )}
                </button>

                {/* Wishlist heart — always available */}
                <WishlistButton
                  product={product}
                  className="w-12 h-12 rounded-xl border border-gray-300 dark:border-white/10 hover:border-pink-400 dark:hover:border-pink-500/50 shrink-0"
                />
              </>
            ) : (
              <WishlistButton
                product={product}
                showLabel
                label="Add to Wishlist"
                variant="red"
                className="flex-1 px-8 py-3 font-semibold rounded-xl border-2 border-red-300/70 dark:border-red-500/40"
              />
            )}
          </div>
        </div>
      </div>

      {/* ── Customer Reviews (comments at the end of the page) ── */}
      {reviewsEnabled && (
        <section ref={reviewsRef} className="mt-14 scroll-mt-24">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Customer Reviews</h2>
              <div className="mt-2 flex items-center gap-3">
                <Stars rating={product.rating || 0} size="md" />
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  {product.rating_count > 0
                    ? `${Number(product.rating).toFixed(1)} average from ${product.rating_count} review${product.rating_count !== 1 ? 's' : ''}`
                    : 'No reviews yet'}
                </span>
              </div>
            </div>
          </div>

          {/* Review form */}
          <div className="rounded-2xl bg-white dark:bg-dark-800/60 border border-gray-100 dark:border-white/5 p-5 mb-8">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Write a review</h3>
            {user ? (
              <form onSubmit={handleSubmitReview} className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-600 dark:text-gray-300">Your rating:</span>
                  <Stars rating={reviewRating} size="lg" interactive onChange={setReviewRating} />
                  {reviewRating > 0 && (
                    <span className="text-sm font-medium text-amber-500">{reviewRating}/5</span>
                  )}
                </div>
                <textarea
                  value={reviewComment}
                  onChange={e => setReviewComment(e.target.value)}
                  rows={3}
                  placeholder="Share your experience with this product..."
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-white/10 bg-white dark:bg-dark-800 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                />
                {reviewMsg && (
                  <p className={`text-sm ${reviewMsg.includes('Thanks') ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>{reviewMsg}</p>
                )}
                <button type="submit" disabled={submittingReview} className="btn-primary !font-sans !text-sm !font-semibold tracking-tight">
                  {submittingReview ? 'Submitting...' : 'Submit Review'}
                </button>
              </form>
            ) : (
              <button onClick={login}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold tracking-tight bg-primary-600 text-white hover:bg-primary-500 active:bg-primary-700 transition-colors shadow-md">
                Sign in to write a review
              </button>
            )}
          </div>

          {/* Reviews list */}
          {reviews.length === 0 ? (
            <div className="rounded-2xl bg-gray-50 dark:bg-dark-800/40 border border-gray-100 dark:border-white/5 p-10 text-center">
              <p className="text-gray-500 dark:text-gray-400">No comments yet — be the first to review this product.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map(review => (
                <div key={review.id} className="rounded-2xl bg-white dark:bg-dark-800/60 border border-gray-100 dark:border-white/5 p-5">
                  <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                    <div className="flex items-center gap-3">
                      {review.avatar_url ? (
                        <img src={review.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-primary-100 dark:bg-primary-500/20 flex items-center justify-center text-primary-600 dark:text-primary-300 text-sm font-bold">
                          {(review.customer_name || '?').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{review.customer_name || 'Customer'}</p>
                        <p className="text-xs text-gray-400">{new Date(review.created_at).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
                      </div>
                    </div>
                    <Stars rating={review.rating} size="sm" />
                  </div>
                  {review.comment && (
                    <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{review.comment}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Mobile sticky Add-to-Cart bar */}
      <div className="fixed bottom-0 inset-x-0 z-40 lg:hidden">
        <div className="drawer-glass border-t border-gray-200/50 dark:border-white/10 px-4 pt-3"
          style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{localized(lang, product, 'name')}</p>
              <Price cents={product.price} className="text-xl font-bold text-primary-600 dark:text-primary-400" />
            </div>

            {/* Wishlist heart (mobile) */}
            {product.stock > 0 && (
              <WishlistButton
                product={product}
                className="w-10 h-10 rounded-xl border border-gray-300 dark:border-white/10 hover:border-pink-400 dark:hover:border-pink-500/50 shrink-0"
              />
            )}

            {product.stock > 0 ? (
              <>
                <div className="flex items-center border border-gray-300 dark:border-white/10 rounded-xl bg-white/5 dark:bg-white/5 backdrop-blur-sm shrink-0">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-10 h-10 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 rounded-l-xl transition-colors text-lg"
                    aria-label="Decrease quantity"
                  >
                    -
                  </button>
                  <span className="w-9 text-center font-medium border-x border-gray-300 dark:border-white/10 text-gray-900 dark:text-white">{quantity}</span>
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    className="w-10 h-10 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 rounded-r-xl transition-colors text-lg"
                    aria-label="Increase quantity"
                  >
                    +
                  </button>
                </div>
                <button
                  onClick={handleAddToCart}
                  className={`btn-primary flex-1 max-w-[190px] !px-4 ${
                    added ? 'from-green-600 to-green-700 hover:from-green-500 hover:to-green-600' : ''
                  } ${inCartCount > 0 && !added ? 'from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500' : ''}`}
                >
                  {added ? (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Added!
                    </>
                  ) : inCartCount > 0 ? (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
                      </svg>
                      Add More · {inCartCount}
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
                      </svg>
                      Add to Cart
                    </>
                  )}
                </button>
              </>
            ) : (
              <WishlistButton
                product={product}
                showLabel
                label="Wishlist"
                variant="red"
                className="flex-1 max-w-[190px] min-h-12 font-semibold rounded-xl border-2 border-red-300/70 dark:border-red-500/40"
              />
            )}
          </div>
        </div>
      </div>

      <CartDrawer />
    </div>
  );
}
