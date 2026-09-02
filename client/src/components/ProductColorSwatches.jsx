import { useState, useEffect } from 'react';

/**
 * ProductColorSwatches — Customer-facing color selector
 *
 * Shows color swatches for a product. When a color is selected:
 * - Calls onColorChange with the selected color object
 * - If the color has an image_url, it can be used to switch the main image
 *
 * Props:
 *   colors: Array of { name, hex, image_url }
 *   selectedColor: currently selected color name
 *   onColorChange: (color) => void
 *   size: 'sm' | 'md' | 'lg'
 */
export default function ProductColorSwatches({
  colors = [],
  selectedColor,
  onColorChange,
  size = 'md',
}) {
  const [parsedColors, setParsedColors] = useState([]);

  useEffect(() => {
    try {
      const c = typeof colors === 'string' ? JSON.parse(colors) : colors;
      setParsedColors(Array.isArray(c) ? c : []);
    } catch {
      setParsedColors([]);
    }
  }, [colors]);

  if (!parsedColors || parsedColors.length === 0) return null;

  const sizeClasses = {
    sm: 'w-5 h-5',
    md: 'w-7 h-7',
    lg: 'w-9 h-9',
  };

  const dotSize = sizeClasses[size] || sizeClasses.md;

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm font-medium text-gray-700">Color:</span>
        {selectedColor && (
          <span className="text-sm text-gray-500 capitalize">{selectedColor}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {parsedColors.map((color, i) => {
          const isSelected = selectedColor === color.name;
          const isWhite = color.hex?.toLowerCase() === '#ffffff' || color.hex?.toLowerCase() === '#f8f8f8' || color.hex?.toLowerCase() === '#f0f0f0' || color.hex?.toLowerCase() === '#fff';

          return (
            <button
              key={i}
              type="button"
              onClick={() => onColorChange?.(color)}
              className={`
                relative ${dotSize} rounded-full transition-all duration-200
                ${isSelected
                  ? 'ring-2 ring-primary-500 ring-offset-2 scale-110'
                  : 'ring-1 ring-gray-300 hover:ring-gray-400 hover:scale-105'
                }
              `}
              style={{
                backgroundColor: color.hex || '#ccc',
                border: isWhite ? '1px solid #e5e7eb' : 'none',
              }}
              title={color.name}
            >
              {/* Selected checkmark */}
              {isSelected && (
                <span className="absolute inset-0 flex items-center justify-center">
                  <svg className={`w-3 h-3 ${isWhite ? 'text-gray-700' : 'text-white'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
