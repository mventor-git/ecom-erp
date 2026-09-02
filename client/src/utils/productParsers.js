/**
 * Shared parsers for product variant fields stored in the DB.
 *
 * `product.colors` and `product.sizes` are stored as JSON-encoded text in
 * SQLite, so they arrive at the client as either:
 *   - already-parsed arrays (when the server pre-parsed them), or
 *   - JSON strings (when the column was read raw), or
 *   - null / undefined.
 *
 * These helpers return a safe array in all three cases so consumers never
 * need to repeat the JSON.parse guard.
 */

export function parseColors(raw) {
  if (!raw) return [];
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function parseSizes(raw) {
  if (!raw) return [];
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Pick the variant image that best matches a selected color+size from
 * a product's images array. Falls back to the product's primary image.
 *
 * @param {Array<{url?: string, color?: string, size?: string}>} images
 * @param {{color?: {name?: string}|string, size?: {name?: string}|string}} selection
 * @param {string} fallback
 * @returns {string}
 */
export function matchVariantImage(images, selection, fallback) {
  if (!Array.isArray(images) || images.length === 0) return fallback;
  const colorName = typeof selection?.color === 'string'
    ? selection.color
    : selection?.color?.name;
  const sizeName = typeof selection?.size === 'string'
    ? selection.size
    : selection?.size?.name;

  // First try direct url/color/size match (fast path for pre-parsed gallery)
  if (colorName) {
    const direct = images.find(img =>
      img.color && String(img.color).toLowerCase() === colorName.toLowerCase() &&
      (!sizeName || !img.size || String(img.size).toLowerCase() === sizeName.toLowerCase())
    );
    if (direct?.url) return direct.url;
  }
  if (sizeName) {
    const direct = images.find(img =>
      img.size && String(img.size).toLowerCase() === sizeName.toLowerCase() &&
      (!colorName || !img.color || String(img.color).toLowerCase() === colorName.toLowerCase())
    );
    if (direct?.url) return direct.url;
  }

  // Second: check variant_attributes (JSON with color[] / size[] filters)
  const baseColorName = colorName ? colorName.split(' - ')[0] || colorName : null;
  const selectedSizeName = sizeName || null;
  for (const img of images) {
    if (!img.url) continue;
    let attrs = {};
    try {
      attrs = typeof img.variant_attributes === 'string'
        ? JSON.parse(img.variant_attributes || '{}')
        : (img.variant_attributes || {});
    } catch { continue; }
    const hasColorFilter = Array.isArray(attrs.color) && attrs.color.length > 0;
    const hasSizeFilter = Array.isArray(attrs.size) && attrs.size.length > 0;
    if (!hasColorFilter && !hasSizeFilter) continue;
    let colorMatch = true;
    if (hasColorFilter && baseColorName) {
      colorMatch = attrs.color.some(c => String(c).toLowerCase().includes(baseColorName.toLowerCase()));
    }
    let sizeMatch = true;
    if (hasSizeFilter && selectedSizeName) {
      sizeMatch = attrs.size.some(s => String(s).toLowerCase() === selectedSizeName.toLowerCase());
    }
    if (colorMatch && sizeMatch) return img.url;
  }
  return fallback;
}
