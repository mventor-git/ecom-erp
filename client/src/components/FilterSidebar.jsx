import { useState, useEffect, useCallback, useRef } from 'react';
import { useLanguage } from '../i18n';
import { getCategories, getBrands } from '../api/products';
import { useCurrency } from '../context/CurrencyContext';

export default function FilterSidebar({
  activeCategory,
  activeBrand,
  minPrice,
  maxPrice,
  priceRange,
  onCategoryChange,
  onBrandChange,
  onPriceChange,
  onReset,
}) {
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const { lang, t } = useLanguage();

  // Slider state
  const rangeMin = priceRange?.min ?? 0;
  const rangeMax = priceRange?.max ?? 10000;
  const [sliderMin, setSliderMin] = useState(minPrice || rangeMin);
  const [sliderMax, setSliderMax] = useState(maxPrice || rangeMax);
  
  // Use ref for timer to avoid re-renders
  const timerRef = useRef(null);

  // Sync slider when external values change (e.g. clear filters)
  useEffect(() => {
    setSliderMin(minPrice || rangeMin);
    setSliderMax(maxPrice || rangeMax);
  }, [minPrice, maxPrice, rangeMin, rangeMax]);

  useEffect(() => {
    getCategories()
      .then(res => setCategories(res.data))
      .catch(() => {});
    getBrands()
      .then(res => setBrands(res.data))
      .catch(() => {});
  }, []);

  // Debounced price update (300ms after last slider change)
  const schedulePriceUpdate = useCallback((min, max) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onPriceChange(
        min > rangeMin ? min : null,
        max < rangeMax ? max : null
      );
    }, 300);
  }, [onPriceChange, rangeMin, rangeMax]);

  const handleMinChange = (e) => {
    const val = Number(e.target.value);
    const clamped = Math.min(val, sliderMax - 1);
    setSliderMin(clamped);
    schedulePriceUpdate(clamped, sliderMax);
  };

  const handleMaxChange = (e) => {
    const val = Number(e.target.value);
    const clamped = Math.max(val, sliderMin + 1);
    setSliderMax(clamped);
    schedulePriceUpdate(sliderMin, clamped);
  };

  const hasActiveFilters = activeCategory || activeBrand || minPrice || maxPrice;

  const { format } = useCurrency();
  const fmtPrice = (cents) => format(cents, 0);

  // Dual-thumb geometry (% positions along the track)
  const span = Math.max(rangeMax - rangeMin, 1);
  const pctMin = ((sliderMin - rangeMin) / span) * 100;
  const pctMax = ((sliderMax - rangeMin) / span) * 100;
  const narrowed = sliderMin > rangeMin || sliderMax < rangeMax;

  const resetRange = () => {
    setSliderMin(rangeMin);
    setSliderMax(rangeMax);
    schedulePriceUpdate(rangeMin, rangeMax);
  };

  return (
    <aside className="w-full lg:w-64 shrink-0">
      <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-white/10 p-5 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">{t('Filters')}</h3>
          {hasActiveFilters && (
            <button
              onClick={onReset}
              className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium"
            >
              {t('Clear all')}
            </button>
          )}
        </div>

        {/* ── Categories ── */}
        <div>
          <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">{t('Category')}</h4>
          <div className="space-y-1">
            <button
              onClick={() => onCategoryChange('')}
              className={`w-full text-start px-3 py-2 rounded-lg text-sm transition-colors ${
                !activeCategory
                  ? 'bg-primary-50 dark:bg-primary-500/20 text-primary-700 dark:text-primary-300 font-medium'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {t('All Categories')}
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => onCategoryChange(cat.slug)}
                className={`w-full text-start px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between ${
                  activeCategory === cat.slug
                    ? 'bg-primary-50 dark:bg-primary-500/20 text-primary-700 dark:text-primary-300 font-medium'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <span>{cat.name}</span>
                {cat.product_count > 0 && (
                  <span className={`text-xs ${activeCategory === cat.slug ? 'text-primary-400 dark:text-primary-300' : 'text-gray-400 dark:text-gray-500'}`}>
                    {cat.product_count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── Price Range (dual-thumb) ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('Price Range')}</h4>
            {narrowed && (
              <button onClick={resetRange}
                className="text-[11px] text-primary-600 dark:text-primary-400 hover:text-primary-700 font-medium">
                {t('Reset')}
              </button>
            )}
          </div>

          {/* Selected range readout */}
          <div className="flex items-center justify-center gap-2 mb-4 px-3 py-1.5 rounded-lg bg-primary-50/70 dark:bg-primary-500/10 w-fit mx-auto">
            <span className="text-sm font-bold text-primary-700 dark:text-primary-300">{fmtPrice(sliderMin)}</span>
            <span className="text-xs text-primary-400">—</span>
            <span className="text-sm font-bold text-primary-700 dark:text-primary-300">{fmtPrice(sliderMax)}</span>
          </div>

          {/* Overlaid dual-range track */}
          <div className="relative h-6 select-none" dir="ltr">
            <div className="absolute top-1/2 -translate-y-1/2 inset-x-0 h-1.5 rounded-full bg-gray-200 dark:bg-dark-700"></div>
            <div className="absolute top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-gradient-to-r from-primary-500 to-primary-600 transition-all duration-150"
                 style={{ left: `${pctMin}%`, width: `${Math.max(pctMax - pctMin, 0)}%` }}></div>
            <input
              type="range" aria-label={t('Minimum price')}
              min={rangeMin} max={rangeMax} step={100} value={sliderMin}
              onChange={handleMinChange}
              className="dual-range absolute inset-x-0 top-1/2 -translate-y-1/2 w-full"
              style={{ zIndex: sliderMin > rangeMax - 200 ? 5 : 3 }}
            />
            <input
              type="range" aria-label={t('Maximum price')}
              min={rangeMin} max={rangeMax} step={100} value={sliderMax}
              onChange={handleMaxChange}
              className="dual-range dual-range--max absolute inset-x-0 top-1/2 -translate-y-1/2 w-full"
            />
          </div>

          {/* Absolute bounds */}
          <div className="flex justify-between mt-1.5">
            <span className="text-[10px] text-gray-400 dark:text-gray-500">{fmtPrice(rangeMin)}</span>
            <span className="text-[10px] text-gray-400 dark:text-gray-500">{fmtPrice(rangeMax)}</span>
          </div>

          <style>{`
            .dual-range {
              -webkit-appearance: none; appearance: none;
              background: transparent; height: 24px; margin: 0;
              pointer-events: none;
            }
            .dual-range:focus { outline: none; }
            .dual-range::-webkit-slider-runnable-track { background: transparent; }
            .dual-range::-webkit-slider-thumb {
              -webkit-appearance: none; appearance: none;
              pointer-events: auto;
              width: 18px; height: 18px; border-radius: 9999px;
              background: #fff; border: 2.5px solid #1f857a;
              box-shadow: 0 1px 4px rgba(0,0,0,.25);
              cursor: grab; transition: transform .12s ease;
            }
            .dual-range::-webkit-slider-thumb:active { transform: scale(1.15); cursor: grabbing; }
            .dual-range::-moz-range-track { background: transparent; }
            .dual-range::-moz-range-thumb {
              pointer-events: auto;
              width: 14px; height: 14px; border-radius: 9999px;
              background: #fff; border: 2.5px solid #1f857a;
              box-shadow: 0 1px 4px rgba(0,0,0,.25); cursor: grab;
            }
            .dual-range--max::-webkit-slider-thumb { border-color: #16655d; }
            .dual-range--max::-moz-range-thumb { border-color: #16655d; }
          `}</style>
        </div>

        {/* ── Brands ── */}
        <div>
          <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Brand</h4>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            <button
              onClick={() => onBrandChange('')}
              className={`w-full text-start px-3 py-2 rounded-lg text-sm transition-colors ${
                !activeBrand
                  ? 'bg-primary-50 dark:bg-primary-500/20 text-primary-700 dark:text-primary-300 font-medium'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              All Brands
            </button>
            {brands.map(brand => (
              <button
                key={brand.id}
                onClick={() => onBrandChange(brand.slug)}
                className={`w-full text-start px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2.5 ${
                  activeBrand === brand.slug
                    ? 'bg-primary-50 dark:bg-primary-500/20 text-primary-700 dark:text-primary-300 font-medium'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {brand.icon_url ? (
                  <img
                    src={brand.icon_url}
                    alt={brand.name}
                    className="w-5 h-5 rounded-full object-cover shrink-0"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                ) : (
                  <span className="w-5 h-5 rounded-full bg-gray-200 dark:bg-dark-700 flex items-center justify-center text-[10px] font-bold text-gray-500 dark:text-gray-400 shrink-0">
                    {brand.name.charAt(0)}
                  </span>
                )}
                <span className="truncate">{brand.name}</span>
                {brand.product_count > 0 && (
                  <span className={`text-xs ms-auto ${activeBrand === brand.slug ? 'text-primary-400 dark:text-primary-300' : 'text-gray-400 dark:text-gray-500'}`}>
                    {brand.product_count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
