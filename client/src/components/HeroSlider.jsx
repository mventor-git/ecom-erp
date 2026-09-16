import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useCurrency } from '../context/CurrencyContext';
import { useLanguage, localized } from '../i18n';
import Price from './Price';

/**
 * HeroSlider — Smooth sliding hero with Ken Burns effect
 * 
 * Features:
 * - Auto-fetches featured products
 * - Ken Burns effect (slow zoom/pan) for video-like motion
 * - Translucent gradient overlay
 * - Smooth CSS transitions
 * - Product info overlay with price and CTA
 */

const SLIDE_DURATION = 10000; // 10 seconds per slide
const TRANSITION_DURATION = 1500; // 1.5 second transition

export default function HeroSlider() {
  const { lang, t } = useLanguage();
  const [slides, setSlides] = useState([]);
  const [emptyStore, setEmptyStore] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    // Featured products curated by the admin. Fresh installs have none
    // flagged yet — fall back to newest products so /home always has
    // a hero instead of rendering nothing.
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    fetch('/api/products/featured?limit=5', { signal: ctrl.signal })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setSlides(data);
          return;
        }
        return fetch('/api/products?sort=newest', { signal: ctrl.signal })
          .then(r => r.json())
          .then(list => {
            const arr = Array.isArray(list) ? list : (list?.products || list?.items || []);
            if (arr.length > 0) setSlides(arr.slice(0, 5));
            else setEmptyStore(true);
          })
          .catch(() => {});
      })
      .catch(err => { if (err?.name !== 'AbortError') console.error('Error fetching featured products:', err); })
      .finally(() => clearTimeout(timer));
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, []);

  useEffect(() => {
    if (slides.length <= 1) return;

    const interval = setInterval(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentSlide((prev) => (prev + 1) % slides.length);
        setIsTransitioning(false);
      }, TRANSITION_DURATION);
    }, SLIDE_DURATION);

    return () => clearInterval(interval);
  }, [slides.length]);

  if (slides.length === 0) {
    if (!emptyStore) return null;
    // Brand-new store: zero products anywhere. A guided setup hero instead
    // of a missing section — fancy, honest, and actionable.
    const steps = [
      { n: '1', title: t('Add your products'), sub: t('Manually or by importing a sheet.') },
      { n: '2', title: t('Feature your best sellers'), sub: t('Flag products as featured in the admin app.') },
      { n: '3', title: t('Configure your storefront'), sub: t('Welcome slides, identity and homepage sections.') },
    ];
    return (
      <div className="relative w-full overflow-hidden bg-gradient-to-br from-primary-700 via-primary-600 to-primary-500">
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <p className="text-xs sm:text-sm font-medium uppercase tracking-widest text-white/70">{t('Welcome to our store')}</p>
          <h1 className="mt-2 text-3xl sm:text-5xl font-bold text-white leading-tight max-w-2xl">{t('Set up your storefront')}</h1>
          <p className="mt-3 text-sm sm:text-lg text-white/85 max-w-xl">{t('Update your product list, then use the admin app to set up your storefront.')}</p>
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-3xl">
            {steps.map(s => (
              <div key={s.n} className="rounded-xl bg-white/10 backdrop-blur-md border border-white/20 p-4">
                <div className="w-8 h-8 rounded-full bg-white text-primary-700 font-bold text-sm flex items-center justify-center">{s.n}</div>
                <p className="mt-2 text-sm font-semibold text-white">{s.title}</p>
                <p className="mt-0.5 text-xs text-white/70">{s.sub}</p>
              </div>
            ))}
          </div>
          <Link to="/products" className="mt-8 inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-white text-gray-900 font-semibold text-sm sm:text-base rounded-lg shadow-xl">
            {t('Browse products')}
          </Link>
        </div>
      </div>
    );
  }

  const currentProduct = slides[currentSlide];
  const titleColor = currentProduct.hero_title_color || '#ffffff';
  const descColor = currentProduct.hero_desc_color || '#ffffff';
  const priceColor = currentProduct.hero_price_color || '#ffffff';
  const badgeColor = currentProduct.hero_badge_color || '#ffffff';

  return (
    <div className="relative w-full h-[480px] sm:h-[560px] lg:h-[700px] overflow-hidden">
      {/* Background Images with Ken Burns Effect */}
      {slides.map((slide, index) => (
        <div
          key={slide.id}
          className="absolute inset-0 w-full h-full"
          style={{
            opacity: currentSlide === index ? 1 : 0,
            transition: `opacity ${TRANSITION_DURATION}ms ease-in-out`,
            zIndex: currentSlide === index ? 10 : 1,
          }}
        >
          {/* Image with smooth zoom (no pan) */}
          <div
            className="absolute inset-0 w-full h-full bg-cover bg-center"
            style={{
              backgroundImage: `url(${slide.image_url})`,
              transform: 'scale(1.1)',
              animation: currentSlide === index ? 'kenburns-zoom 18s ease-in-out infinite' : 'none',
            }}
          />
        </div>
      ))}

      {/* Translucent Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-transparent z-20" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent z-20" />

      {/* Content Overlay */}
      <div className="relative z-30 h-full flex items-center">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 w-full">
          <div className="max-w-2xl">
            {/* Product Info with fade transition */}
            <div
              key={currentSlide}
              className="space-y-4 sm:space-y-6"
              style={{
                animation: 'fadeInUp 0.8s ease-out',
              }}
            >
              {/* Badge */}
              <div className="inline-block">
                <span className="inline-block px-3 sm:px-4 py-1 sm:py-1.5 bg-white/20 backdrop-blur-md text-xs sm:text-sm font-medium rounded-full border border-white/30" style={{ color: badgeColor }}>
                  <span className="inline-flex items-center gap-1.5 align-middle">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3l1.8 4.9L19 9.7l-4.4 3 .6 5.3-3.2-2.6-3.2 2.6.6-5.3-4.4-3 5.2-1.8L12 3z"/></svg>
                    {t('Featured Product')}
                  </span>
                </span>
              </div>

              {/* Product Name */}
              <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-bold leading-tight drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)]" style={{ color: titleColor }}>
                {localized(lang, currentProduct, 'name')}
              </h1>

              {/* Description */}
              {currentProduct.description && (
                <p className="text-sm sm:text-base md:text-xl leading-relaxed line-clamp-3 drop-shadow-[0_1px_6px_rgba(0,0,0,0.55)]" style={{ color: descColor, opacity: 0.95 }}>
                  {localized(lang, currentProduct, 'description') || currentProduct.description}
                </p>
              )}

              {/* Price */}
              {currentProduct.price ? (
                <div className="flex items-center gap-3 sm:gap-4">
                  <Price cents={currentProduct.price} variant="word" className="text-2xl sm:text-3xl md:text-4xl font-bold [&_.price-egp-word]:!text-[#e9c46a] [&_.price-egp-word-en]:!text-[#e9c46a]" />
                  {currentProduct.stock > 0 && currentProduct.stock <= 10 && (
                    <span className="px-3 py-1 bg-red-500/90 backdrop-blur-sm text-white text-xs sm:text-sm font-semibold rounded-full">
                      {t('Only {n} left!').replace('{n}', currentProduct.stock)}
                    </span>
                  )}
                </div>
              ) : null}

              {/* CTA Labels */}
              <div className="flex flex-wrap gap-3 sm:gap-4 pt-2 sm:pt-4">
                <Link
                  to={`/products/${currentProduct.id}`}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 sm:px-8 sm:py-4 bg-white text-gray-900 font-semibold text-sm sm:text-base rounded-lg shadow-xl"
                >
                  {t('Shop Now')}
                  <svg
                    className="w-4 h-4 sm:w-5 sm:h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 7l5 5m0 0l-5 5m5-5H6"
                    />
                  </svg>
                </Link>
                <Link
                  to="/products"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 sm:px-8 sm:py-4 bg-white/10 backdrop-blur-md text-white font-semibold text-sm sm:text-base rounded-lg border border-white/30"
                >
                  {t('Browse All')}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>



      {/* CSS Animations */}
      <style>{`
        @keyframes kenburns-zoom {
          0%   { transform: scale(1.05); }
          50%  { transform: scale(1.14); }
          100% { transform: scale(1.05); }
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
