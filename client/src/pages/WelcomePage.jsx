import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import WelcomeModel3D from '../components/WelcomeModel3D';
import { getPublicSetting } from '../api/settings';

/**
 * WelcomePage - Full-page vertical slider
 * 
 * - Background images slide up/down with fade transition
 * - Text content stays fixed in place, just swaps content (no flicker)
 * - Navigation: mouse wheel, touch swipe, mouse drag, keyboard
 */

const TRANSITION_MS = 700;
const SWIPE_THRESHOLD = 60;

export default function WelcomePage() {
  const [slides, setSlides] = useState([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  // Single source of truth for slide geometry. Using window.innerHeight for BOTH
  // slide heights AND the container translation avoids the mobile URL-bar mismatch
  // (CSS 100vh != window.innerHeight) that caused seams between photos mid-slide.
  const [vh, setVh] = useState(() => (typeof window !== 'undefined' ? window.innerHeight : 800));

  const currentSlideRef = useRef(0);
  const rafRef = useRef(null);

  useEffect(() => { currentSlideRef.current = currentSlide; }, [currentSlide]);

  // Keep geometry in sync on resize / orientation change / mobile URL bar changes
  useEffect(() => {
    const update = () => {
      const h = window.innerHeight;
      setVh(prev => (Math.abs(prev - h) < 2 ? prev : h));
    };
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    const vv = window.visualViewport;
    if (vv) vv.addEventListener('resize', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      if (vv) vv.removeEventListener('resize', update);
    };
  }, []);

  // Preload all slide images so transitions never reveal half-loaded photos
  useEffect(() => {
    slides.forEach(s => {
      if (s.image_url) {
        const img = new Image();
        img.src = s.image_url;
      }
    });
  }, [slides]);

  // Fetch welcome slides
  useEffect(() => {
    fetch('/api/welcome-slides')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) setSlides(data);
      })
      .catch(err => console.error('Error fetching welcome slides:', err));
  }, []);

  const goToSlide = useCallback((index) => {
    if (index < 0 || index >= slides.length || isTransitioning) return;
    setIsTransitioning(true);
    setCurrentSlide(index);
    setTimeout(() => setIsTransitioning(false), TRANSITION_MS + 100);
  }, [slides.length, isTransitioning]);

  const goNext = useCallback(() => goToSlide(currentSlideRef.current + 1), [goToSlide]);
  const goPrev = useCallback(() => goToSlide(currentSlideRef.current - 1), [goToSlide]);

  // Mouse wheel
  useEffect(() => {
    let lastTime = 0;
    const onWheel = (e) => {
      e.preventDefault();
      const now = Date.now();
      if (now - lastTime < 900) return;
      lastTime = now;
      if (e.deltaY > 30) goNext();
      else if (e.deltaY < -30) goPrev();
    };
    window.addEventListener('wheel', onWheel, { passive: false });
    return () => window.removeEventListener('wheel', onWheel);
  }, [goNext, goPrev]);

  // Keyboard
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowDown' || e.key === 'PageDown') { e.preventDefault(); goNext(); }
      if (e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); goPrev(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goNext, goPrev]);

  // Touch swipe (rAF-throttled so drag stays smooth on mobile)
  useEffect(() => {
    let startY = 0;
    let dragging = false;

    const onTouchStart = (e) => {
      if (isTransitioning) return;
      startY = e.touches[0].clientY;
      dragging = true;
      setIsDragging(true);
    };

    const onTouchMove = (e) => {
      if (!dragging || rafRef.current) return;
      const y = e.touches[0].clientY;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        setDragOffset(y - startY);
      });
    };

    const onTouchEnd = () => {
      if (!dragging) return;
      dragging = false;
      setIsDragging(false);
      setDragOffset((prev) => {
        if (prev < -SWIPE_THRESHOLD) goNext();
        else if (prev > SWIPE_THRESHOLD) goPrev();
        return 0;
      });
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [goNext, goPrev, isTransitioning]);

  // Mouse drag (rAF-throttled)
  useEffect(() => {
    let startY = 0;
    let dragging = false;
    let hasMoved = false;

    const onMouseDown = (e) => {
      if (e.target.closest('a, button')) return;
      if (isTransitioning) return;
      startY = e.clientY;
      dragging = true;
      hasMoved = false;
      setIsDragging(true);
    };

    const onMouseMove = (e) => {
      if (!dragging || rafRef.current) return;
      const diff = e.clientY - startY;
      if (Math.abs(diff) > 5) hasMoved = true;
      if (hasMoved) {
        const y = diff;
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null;
          setDragOffset(y);
        });
      }
    };

    const onMouseUp = () => {
      if (!dragging) return;
      dragging = false;
      setIsDragging(false);
      if (hasMoved) {
        setDragOffset((prev) => {
          if (prev < -SWIPE_THRESHOLD) goNext();
          else if (prev > SWIPE_THRESHOLD) goPrev();
          return 0;
        });
      }
    };

    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [goNext, goPrev, isTransitioning]);

  // Loading
  if (slides.length === 0) {
    return (
      <div className="fixed inset-0 bg-dark-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500" />
      </div>
    );
  }

  const currentSlideData = slides[currentSlide];
  const baseTranslate = -currentSlide * vh;

  const containerStyle = isDragging
    ? { transform: `translateY(${baseTranslate + dragOffset}px)`, transition: 'none' }
    : { transform: `translateY(${baseTranslate}px)`, transition: `transform ${TRANSITION_MS}ms cubic-bezier(0.4, 0, 0.2, 1)` };

  // ── 3D showcase settings (admin-controlled) ──
  const [model3d, setModel3d] = useState(null);
  useEffect(() => {
    Promise.all([
      getPublicSetting('welcome_3d_enabled', false),
      getPublicSetting('welcome_3d_model_url', ''),
      getPublicSetting('welcome_3d_motion', 'float'),
      getPublicSetting('welcome_3d_clip', ''),
      getPublicSetting('welcome_3d_scale', 1),
      getPublicSetting('welcome_3d_speed', 1),
    ]).then(([enabled, url, motion, clip, scale, speed]) => {
      setModel3d({
        enabled: enabled === true || enabled === 'true' || enabled === 1 || enabled === '1',
        modelUrl: url,
        motion: motion || 'float',
        clip: clip || '',
        scale: Number(scale) || 1,
        speed: Number(speed) || 1,
      });
    }).catch(() => {});
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden bg-dark-950 select-none touch-none">
      {/* Background images layer - slides vertically */}
      <div style={containerStyle} className="will-change-transform">
        {slides.map((slide, index) => (
          <div
            key={slide.id}
            className="absolute w-full will-change-transform"
            style={{
              top: `${index * vh}px`,
              height: `${vh}px`,
            }}
          >
            {/* Background Image — smooth zoom only (no pan = no jitter).
                Fades in after decode so refresh never flashes other photos. */}
            <div
              className="absolute inset-0 w-full h-full bg-cover bg-center transition-opacity duration-700"
              style={{
                backgroundImage: `url(${slide.image_url})`,
                transform: 'scale(1.05)',
                opacity: currentSlide === index ? 1 : 0,
                animation: currentSlide === index ? 'kenburns-zoom 18s ease-in-out infinite' : 'none',
              }}
            />

            {/* Overlay */}
            <div
              className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent"
              style={{ opacity: slide.overlay_opacity || 0.4 }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          </div>
        ))}
      </div>

      {/* 3D showcase layer (admin-configurable) */}
      {model3d && (
        <WelcomeModel3D
          enabled={model3d.enabled}
          modelUrl={model3d.modelUrl}
          motion={model3d.motion}
          clip={model3d.clip}
          scale={model3d.scale}
          speed={model3d.speed}
        />
      )}

      {/* Text content layer - stays fixed, just swaps content */}
      <div className="fixed inset-0 z-20 flex items-center pointer-events-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 w-full">
          <div className="max-w-2xl space-y-4 sm:space-y-5 md:space-y-6">
            {/* Subtitle */}
            {currentSlideData.subtitle && (
              <p
                className="text-sm sm:text-base md:text-lg lg:text-xl font-medium uppercase tracking-wider transition-opacity duration-300"
                style={{ color: currentSlideData.subtitle_color || '#ffffff' }}
              >
                {currentSlideData.subtitle}
              </p>
            )}

            {/* Title */}
            <h1
              className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl xl:text-8xl font-bold leading-tight transition-opacity duration-300"
              style={{ color: currentSlideData.title_color || '#ffffff' }}
            >
              {currentSlideData.title}
            </h1>

            {/* Description */}
            {currentSlideData.description && (
              <p
                className="text-sm sm:text-base md:text-lg lg:text-xl leading-relaxed max-w-lg transition-opacity duration-300"
                style={{ color: currentSlideData.desc_color || '#ffffff', opacity: 0.9 }}
              >
                {currentSlideData.description}
              </p>
            )}

            {/* Buttons */}
            <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 pt-4 pointer-events-auto">
              {currentSlideData.product_id && (
                <Link
                  to={`/products/${currentSlideData.product_id}`}
                  className="btn-primary text-base sm:text-lg px-6 sm:px-8 py-3 sm:py-4 w-full sm:w-auto text-center justify-center"
                >
                  {currentSlideData.cta_text || 'View Product'}
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
              )}

              {currentSlideData.cta_link && !currentSlideData.product_id && (
                <Link
                  to={currentSlideData.cta_link}
                  className="btn-primary text-base sm:text-lg px-6 sm:px-8 py-3 sm:py-4 w-full sm:w-auto text-center justify-center"
                >
                  {currentSlideData.cta_text || 'Learn More'}
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
              )}

              <Link to="/home" className="btn-secondary text-base sm:text-lg px-6 sm:px-8 py-3 sm:py-4 w-full sm:w-auto text-center justify-center">
                Skip to Shop
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Home button — only on the Welcome page, styled like the AI chat button */}
      <Link
        to="/home"
        className="fixed bottom-24 left-4 sm:bottom-6 sm:left-6 w-14 h-14 sm:w-16 sm:h-16 bg-primary-600/60 hover:bg-primary-600/90 focus:bg-primary-600/90 text-white rounded-full shadow-lg backdrop-blur-md border border-white/20 hover:shadow-glow transition-all hover:scale-110 active:scale-95 z-50 flex items-center justify-center"
        aria-label="Go to home page"
        title="Home"
      >
        <svg className="w-7 h-7 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1h3a1 1 0 001-1V10" />
        </svg>
      </Link>

      {/* CSS Animations */}
      <style>{`
        @keyframes kenburns-zoom {
          0%   { transform: scale(1.05); }
          50%  { transform: scale(1.14); }
          100% { transform: scale(1.05); }
        }
      `}</style>
    </div>
  );
}
