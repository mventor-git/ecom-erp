import { useState, useEffect } from 'react';

/**
 * SizeSelector — Customer-facing size variant selector
 *
 * Shows size buttons for a product. When a size is selected:
 * - Calls onSizeChange with the selected size object
 *
 * Props:
 *   sizes: Array of { name } objects
 *   selectedSize: currently selected size name
 *   onSizeChange: (size) => void
 */
export default function SizeSelector({
  sizes = [],
  selectedSize,
  onSizeChange,
}) {
  const [parsedSizes, setParsedSizes] = useState([]);

  useEffect(() => {
    try {
      const s = typeof sizes === 'string' ? JSON.parse(sizes) : sizes;
      setParsedSizes(Array.isArray(s) ? s : []);
    } catch {
      setParsedSizes([]);
    }
  }, [sizes]);

  if (!parsedSizes || parsedSizes.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-medium text-gray-700">Size:</span>
        {selectedSize && (
          <span className="text-sm text-gray-500">{selectedSize}</span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {parsedSizes.map((size, i) => {
          const isSelected = selectedSize === size.name;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSizeChange?.(size)}
              className={`
                px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
                ${isSelected
                  ? 'bg-primary-600 text-white ring-2 ring-primary-300 ring-offset-1 shadow-md scale-105'
                  : 'bg-white text-gray-700 border border-gray-300 hover:border-primary-400 hover:text-primary-600 hover:shadow-sm'
                }
              `}
            >
              {size.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
