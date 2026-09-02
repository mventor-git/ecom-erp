import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useCurrency } from '../context/CurrencyContext';
import { getProductImages } from '../api/products';
import { getPublicSetting } from '../api/settings';
import WishlistButton from './WishlistButton';
import Stars from './Stars';
import Price from './Price';
import { useLanguage, localized } from '../i18n';
import { parseColors, parseSizes, matchVariantImage as matchVariantImageUtil } from '../utils/productParsers';

// "New" badge is admin-controlled (Featured page → NEW toggle, products.is_new)
function isNew(product) {
  return product.is_new === 1 || product.is_new === true;
}

function PlaceholderGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
         strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10" aria-hidden="true">
      <path d="M21 8l-9-5-9 5v8l9 5 9-5V8zM3 8l9 5m0 0l9-5M12 13v8" />
    </svg>
  );
}

export default function ProductCard({ product }) {
  const { addToCart, cartCountFor } = useCart();
  const { lang, t } = useLanguage();
  const { format } = useCurrency();
  const navigate = useNavigate();
  const price = format(product.price);
  const hasImage = product.image_url && product.image_url.length > 0;
  const showNewBadge = isNew(product);
  const inCartCount = product.stock > 0 ? cartCountFor(product.id) : 0;

  // ── Variants (colors/sizes) — visible right on the card ──
  const colorEntries = parseColors(product.colors);
  const sizeEntries = parseSizes(product.sizes);

  // Unique colors (grouped by base name, like the detail page)
  const uniqueColors = [];
  const seenColors = new Set();
  colorEntries.forEach(c => {
    const base = (c.name || '').split(' - ')[0];
    if (!seenColors.has(base)) {
      seenColors.add(base);
      uniqueColors.push({ ...c, baseName: base });
    }
  });

  // Unique sizes (from color variants + product.sizes)
  const sizeSet = new Set();
  colorEntries.forEach(c => { if (c.size) sizeSet.add(c.size); });
  sizeEntries.forEach(s => sizeSet.add(typeof s === 'string' ? s : (s.name || '')));
  const sizes = [...sizeSet].filter(Boolean);

  const [selectedColor, setSelectedColor] = useState(null);
  const [selectedSize, setSelectedSize] = useState(null);
  const [reviewsEnabled, setReviewsEnabled] = useState(true);
  const [galleryImages, setGalleryImages] = useState(null); // null = not loaded yet
  const [displayImage, setDisplayImage] = useState(product.image_url);

  useEffect(() => {
    getPublicSetting('reviews_enabled', true).then(v => setReviewsEnabled(v !== false)).catch(() => {});
  }, []);

  const hasDiscount = product.old_price > product.price;

  // Lazily load gallery images (only on first variant interaction — keeps the grid fast)
  const loadGalleryImages = async () => {
    if (galleryImages !== null) return galleryImages;
    try {
      const { data } = await getProductImages(product.id);
      // Keep original .image_url; also expose .url for util compatibility
      const withUrl = (data || []).map(img => ({ ...img, url: img.image_url || img.url }));
      setGalleryImages(withUrl);
      return withUrl;
    } catch {
      return [];
    }
  };

  // Picking a variant triggers showing the matching variant photo
  const applyVariantImage = async (color, size) => {
    const images = await loadGalleryImages();
    const selection = {
      color: color?.baseName || color?.name || null,
      size: size || null,
    };
    const matchedUrl = matchVariantImageUtil(images, selection, null);
    setDisplayImage(matchedUrl || product.image_url);
  };

  // Auto-select the first color so the image matches the selected variant
  useEffect(() => {
    if (!selectedColor && uniqueColors.length > 0) {
      const first = uniqueColors[0];
      setSelectedColor(first);
      const firstSize = colorEntries.find(c => c.name?.startsWith(first.baseName) && c.size);
      if (firstSize) setSelectedSize(firstSize.size);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAddToCart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const colorObj = selectedColor ? { name: selectedColor.baseName || selectedColor.name, hex: selectedColor.hex } : null;
    const sizeObj = selectedSize ? { name: selectedSize } : null;
    addToCart(product, 1, colorObj, sizeObj);
  };

  const handleColorSelect = (color) => {
    setSelectedColor(color);
    const sizeForColor = colorEntries.find(c => c.name?.startsWith(color.baseName) && c.size);
    const nextSize = sizeForColor?.size || null;
    setSelectedSize(nextSize);
    applyVariantImage(color, nextSize);
  };

  // Badges sit inside the product link — navigate explicitly without triggering it
  const goTo = (path) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    navigate(path);
  };

  return (
    <div className="card group relative flex flex-col overflow-hidden card-lift">
      <Link to={`/products/${product.id}`}>
        <div className="aspect-square bg-gradient-to-br from-gray-50 to-gray-100 dark:from-dark-700 dark:to-dark-800 relative overflow-hidden">
          {displayImage ? (
            <img
              src={displayImage}
              alt={product.name}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover img-zoom"
              onError={(e) => {
                e.target.onerror = null;
                e.target.style.display = 'none';
                e.target.parentElement.classList.add('flex', 'items-center', 'justify-center');
              }}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-gray-300 dark:text-gray-600">
              <PlaceholderGlyph />
              <span className="text-[10px] text-gray-200 dark:text-gray-700 font-medium">{product.category_name}</span>
            </div>
          )}

          {/* LEFT ribbon — Offer % (auto from pricing engine) */}
          {product.ribbon_left && (
            <div className="absolute top-0 start-0 z-20 w-20 h-20 overflow-hidden pointer-events-none">
              <div
                className="absolute -rotate-45 text-white text-[10px] font-bold text-center whitespace-nowrap shadow-md"
                style={{ backgroundColor: product.ribbon_left.color || '#ef4444', width: '120px', left: '-36px', top: '24px', padding: '3px 0' }}
              >
                {product.ribbon_left.text}
              </div>
            </div>
          )}

          {/* RIGHT ribbon — custom admin text */}
          {product.ribbon_right && (
            <div className="absolute top-0 end-0 z-20 w-20 h-20 overflow-hidden pointer-events-none">
              <div
                className="absolute rotate-45 text-white text-[10px] font-bold text-center whitespace-nowrap shadow-md"
                style={{ backgroundColor: product.ribbon_right.color || '#1f857a', width: '120px', right: '-36px', top: '24px', padding: '3px 0' }}
              >
                {product.ribbon_right.text}
              </div>
            </div>
          )}

          {/* Category badge — clickable, filters the products page */}
          {product.category_name && (
            <button
              type="button"
              onClick={goTo(`/products?category=${product.category_slug || ''}`)}
              onKeyDown={e => { if (e.key === 'Enter') goTo(`/products?category=${product.category_slug || ''}`)(e); }}
              className="absolute top-2 start-2 z-10 max-w-[70%] truncate bg-white/90 dark:bg-dark-800/90 backdrop-blur-sm text-[10px] sm:text-xs font-medium px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full shadow-sm text-primary-700 dark:text-primary-300 border border-primary-200/60 dark:border-white/5 hover:bg-primary-600 hover:text-white dark:hover:bg-primary-600 dark:hover:text-white transition-colors cursor-pointer"
              title={`Browse ${product.category_name}`}
            >
              {product.category_name}
            </button>
          )}

          {/* Brand badge — icon only, clickable, filters the products page */}
          {product.brand_name && (
            <button
              type="button"
              onClick={goTo(`/products?brand=${product.brand_slug || ''}`)}
              onKeyDown={e => { if (e.key === 'Enter') goTo(`/products?brand=${product.brand_slug || ''}`)(e); }}
              className={`absolute top-9 start-2 z-10 flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 rounded-full shadow-sm hover:ring-2 hover:ring-primary-400/60 hover:scale-110 transition-all cursor-pointer overflow-hidden transform-gpu ${
                product.brand_icon_url ? 'bg-transparent' : 'bg-white/90 dark:bg-dark-800/90 backdrop-blur-sm'
              }`}
              title={`Browse ${product.brand_name}`}
              aria-label={`Browse ${product.brand_name} products`}
            >
              {product.brand_icon_url ? (
                <img
                  src={product.brand_icon_url}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover rounded-full"
                  onError={(e) => { e.target.style.display = 'none'; e.target.parentElement.textContent = product.brand_name.charAt(0); e.target.parentElement.classList.add('bg-gray-200', 'dark:bg-dark-700', 'text-[10px]', 'font-bold', 'text-gray-600', 'dark:text-gray-300'); }}
                />
              ) : (
                <span className="w-full h-full flex items-center justify-center bg-gray-200 dark:bg-dark-700 text-[10px] font-bold text-gray-600 dark:text-gray-300">
                  {product.brand_name.charAt(0)}
                </span>
              )}
            </button>
          )}

          {/* New badge */}
          {showNewBadge && (
            <span className="absolute top-2 end-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-[10px] sm:text-xs font-bold px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full shadow-glow">
              {t('New')}
            </span>
          )}

          {/* Stock status pill */}
          <span className={`absolute bottom-2 start-2 text-[10px] sm:text-xs font-semibold px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full shadow-sm backdrop-blur-sm border ${
            product.stock > 0
              ? 'bg-green-500/90 text-white border-green-400/30'
              : 'bg-red-500/90 text-white border-red-400/30'
          }`}>
            {product.stock > 0 ? t('In Stock') : t('Out of Stock')}
          </span>
        </div>
      </Link>

      <div className="p-2.5 sm:p-4 flex flex-col gap-1.5 sm:gap-2 flex-1">
        <Link to={`/products/${product.id}`}>
          <h3 className="font-semibold text-[13px] sm:text-base text-gray-900 dark:text-white line-clamp-2 leading-snug group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
            {localized(lang, product, 'name')}
          </h3>
        </Link>

        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
            {hasDiscount && (
              <span className="text-[11px] sm:text-sm text-gray-400 dark:text-gray-500 line-through">{format(product.old_price)}</span>
            )}
            <Price cents={product.price} className="text-sm sm:text-lg font-bold text-gray-900 dark:text-white leading-tight" />
          </div>
          {product.stock > 0 && product.stock <= 5 && (
            <span className="text-[10px] sm:text-xs text-amber-600 dark:text-amber-400 font-medium shrink-0">{t('Only {n} left!').replace('{n}', product.stock)}</span>
          )}
        </div>

        {/* Rating */}
        {reviewsEnabled && product.rating_count > 0 && (
          <div className="flex items-center gap-1">
            <Stars rating={product.rating || 0} size="sm" />
            <span className="text-[10px] sm:text-xs text-gray-400 dark:text-gray-500">({product.rating_count})</span>
          </div>
        )}

        {/* Color swatches — pick a variant right on the card */}
        {uniqueColors.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            {uniqueColors.slice(0, 5).map(color => {
              const isSelected = selectedColor?.baseName === color.baseName;
              const isWhite = (color.hex || '').toLowerCase() === '#ffffff' || (color.hex || '').toLowerCase() === '#fff' || (color.hex || '').toLowerCase() === '#f8f8f8';
              return (
                <button
                  key={color.baseName}
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleColorSelect(color); }}
                  title={color.baseName}
                  aria-label={`Color ${color.baseName}`}
                  className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full transition-all duration-150 ${
                    isSelected ? 'ring-2 ring-primary-500 ring-offset-1 dark:ring-offset-dark-800 scale-110' : 'ring-1 ring-gray-300 dark:ring-white/20 hover:scale-110'
                  }`}
                  style={{
                    backgroundColor: color.hex || '#ccc',
                    border: isWhite ? '1px solid #e5e7eb' : 'none',
                  }}
                />
              );
            })}
            {uniqueColors.length > 5 && (
              <span className="text-[10px] text-gray-400 font-medium">+{uniqueColors.length - 5}</span>
            )}
          </div>
        )}

        {/* Size chips — pick a size right on the card */}
        {sizes.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            {sizes.slice(0, 4).map(size => {
              const isSelected = selectedSize === size;
              return (
                <button
                  key={size}
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedSize(prev => { const next = prev === size ? null : size; applyVariantImage(selectedColor, next); return next; }); }}
                  className={`px-1.5 py-0.5 sm:px-2 sm:py-0.5 rounded-md text-[10px] sm:text-xs font-medium border transition-colors ${
                    isSelected
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-white/40 dark:bg-dark-700/50 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-white/15 hover:border-primary-400'
                  }`}
                >
                  {size}
                </button>
              );
            })}
            {sizes.length > 4 && (
              <span className="text-[10px] text-gray-400 font-medium">+{sizes.length - 4}</span>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end mt-auto pt-1">
          {product.stock > 0 ? (
            <button
              onClick={handleAddToCart}
              aria-label={`${inCartCount > 0 ? t('Add more') : t('Add')} ${product.name} to cart`}
              className={`relative inline-flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-xl backdrop-blur-xl border transition-all duration-300 ease-out hover:-translate-y-0.5 active:translate-y-0 shadow-sm shrink-0 ${
                inCartCount > 0
                  ? 'bg-green-400/25 dark:bg-green-500/15 border-green-400/50 dark:border-green-500/30 text-green-700 dark:text-green-300 hover:bg-green-400/40 dark:hover:bg-green-500/25 hover:shadow-glow'
                  : 'bg-white/30 dark:bg-dark-800/40 border-white/50 dark:border-white/15 text-gray-800 dark:text-gray-100 hover:bg-white/60 dark:hover:bg-dark-800/60 hover:border-primary-400/70 dark:hover:border-primary-500/50 hover:text-primary-600 dark:hover:text-primary-300 hover:shadow-glow'
              }`}
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
              </svg>
              {inCartCount > 0 && (
                <span className="absolute -top-1.5 -end-1.5 bg-white text-green-600 text-[10px] font-bold rounded-full h-4.5 min-w-[18px] px-1 flex items-center justify-center shadow border border-green-200">
                  {inCartCount}
                </span>
              )}
            </button>
          ) : (
            <WishlistButton
              product={product}
              variant="red"
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl backdrop-blur-xl border-2 border-red-400/40 dark:border-red-500/25 shadow-sm shrink-0"
            />
          )}
        </div>
      </div>
    </div>
  );
}
