import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';

/* ──────────────────────────────────────────
   PhotoStack — CSS Polaroid Stack
   
   Shows real product images as stacked
   polaroid cards with 3D hover effects.
   No placeholders — only shows actual products.
   Dynamically adapts to number of products.
   ────────────────────────────────────────── */

const SPRING = 'all 0.55s cubic-bezier(0.34, 1.56, 0.64, 1)';

/** Generate per-card visual config based on number of cards */
function generateCardConfig(count) {
  const configs = [];
  for (let i = 0; i < count; i++) {
    const t = count <= 1 ? 0 : (i / (count - 1)) * 2 - 1; // -1 to 1
    configs.push({
      rotate: Math.round(t * 8 + (Math.random() * 4 - 2)),
      offsetX: Math.round(t * 12 + 8),
      stackY: i * 14,
      shadow: `0 ${6 + t * 2}px ${20 + t * 10}px rgba(0,0,0,${0.18 - Math.abs(t) * 0.06})`,
      hoverRotate: Math.round(t * 16),
      hoverOffsetX: Math.round(t * 20 + (t > 0 ? 8 : -8)),
      hoverLift: -20 - Math.abs(i - (count - 1) / 2) * 4,
    });
  }
  return configs;
}

export default function PhotoStack({ products = [], className = '' }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const [failed, setFailed] = useState(new Set());

  // Limit to max 4 products for the visual stack
  const displayProducts = useMemo(() => products.slice(0, 4), [products]);
  const cardConfigs = useMemo(() => generateCardConfig(displayProducts.length), [displayProducts.length]);

  // Show nothing if no valid products (AFTER all hooks)
  if (displayProducts.length === 0) return null;

  return (
    <div className={`relative ${className}`}>
      <div
        className="relative w-64 h-72 sm:w-72 sm:h-80 md:w-80 md:h-96 mx-auto"
        style={{ perspective: '1000px' }}
      >
        {displayProducts.map((product, i) => {
          const cfg = cardConfigs[i];
          const isHovered = hoveredIdx === i;
          const imageFailed = failed.has(i);
          const price = product.price ? `${(product.price / 100).toFixed(0)} EGP` : '';

          return (
            <Link
              to={`/products/${product.id}`}
              key={product.id}
              className="absolute select-none cursor-pointer"
              style={{
                width: '82%',
                height: '82%',
                left: 0,
                top: `${cfg.stackY}px`,
                zIndex: isHovered ? 20 : i + 1,
                transform: `
                  rotate(${isHovered ? cfg.hoverRotate : cfg.rotate}deg)
                  translateX(${isHovered ? cfg.hoverOffsetX : cfg.offsetX}%)
                  translateY(${isHovered ? cfg.hoverLift : 0}px)
                  scale(${isHovered ? 1.08 : 1})
                `,
                transition: SPRING,
                transitionDelay: isHovered ? '0s' : `${i * 0.05}s`,
              }}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              {/* Polaroid card */}
              <div
                className="w-full h-full bg-white rounded-xl overflow-hidden flex flex-col"
                style={{
                  padding: '8px 8px 0 8px',
                  boxShadow: isHovered
                    ? '0 25px 50px -12px rgba(0,0,0,0.4), 0 0 0 2px rgba(255,255,255,0.7)'
                    : cfg.shadow,
                  transform: `translateZ(${isHovered ? 40 : 0}px)`,
                  transition: SPRING,
                }}
              >
                {imageFailed ? (
                  /* Fallback gradient on image failure */
                  <div className="flex-1 rounded-lg bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
                    <span className="text-gray-400 text-3xl">▣</span>
                  </div>
                ) : (
                  <div className="flex-1 rounded-lg overflow-hidden bg-gray-50">
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="w-full h-full object-cover"
                      onError={() => setFailed(prev => new Set([...prev, i]))}
                      loading="lazy"
                    />
                  </div>
                )}

                {/* Product label strip (polaroid bottom) */}
                <div className="py-2 px-1 text-center bg-white rounded-b-lg">
                  <p className="text-[10px] sm:text-xs font-medium text-gray-800 truncate leading-tight">
                    {product.name}
                  </p>
                  {price && (
                    <p className="text-[10px] text-primary-600 font-semibold">{price}</p>
                  )}
                </div>
              </div>

              {/* Hover glow shadow */}
              {isHovered && (
                <div
                  className="absolute -bottom-2 left-[15%] right-[15%] h-4 rounded-full"
                  style={{
                    background: 'rgba(0,0,0,0.15)',
                    filter: 'blur(10px)',
                    transition: SPRING,
                  }}
                />
              )}
            </Link>
          );
        })}
      </div>

      {/* Hint */}
      {displayProducts.length > 1 && (
        <p className="text-center text-white/50 text-xs mt-4 sm:mt-6 tracking-wider hidden sm:block">
          ⟡ hover the stack ⟡
        </p>
      )}
    </div>
  );
}