/**
 * Sanitize Products Middleware
 *
 * Removes sensitive wholesale/internal data from product objects
 * before sending to customer-facing APIs.
 *
 * SECURITY: cost_price (wholesale) must NEVER be exposed to customers.
 */

/**
 * Remove sensitive fields from a single product object
 */
function sanitizeProduct(product) {
  if (!product) return product;

  const {
    cost_price,           // NEVER expose wholesale cost to customers
    min_stock,            // Internal inventory threshold
    reorder_point,        // Internal inventory management
    deleted_at,           // Soft delete timestamp
    ...safeProduct
  } = product;

  return safeProduct;
}

/**
 * Remove sensitive fields from an array of products
 */
function sanitizeProducts(products) {
  if (!Array.isArray(products)) return products;
  return products.map(sanitizeProduct);
}

/**
 * Express middleware to automatically sanitize product responses
 * Use this on customer-facing product routes (not admin routes)
 */
function sanitizeProductsMiddleware(req, res, next) {
  const originalJson = res.json.bind(res);

  res.json = function(data) {
    // If response is a single product
    if (data && typeof data === 'object' && data.id && data.name) {
      return originalJson(sanitizeProduct(data));
    }

    // If response is an array of products
    if (Array.isArray(data)) {
      return originalJson(sanitizeProducts(data));
    }

    // If response has a data property containing products
    if (data && data.data && Array.isArray(data.data)) {
      return originalJson({
        ...data,
        data: sanitizeProducts(data.data)
      });
    }

    // Pass through unchanged
    return originalJson(data);
  };

  next();
}

module.exports = {
  sanitizeProduct,
  sanitizeProducts,
  sanitizeProductsMiddleware
};
