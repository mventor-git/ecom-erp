/**
 * Mobile API v1 - Products
 * Mobile-optimized product endpoints
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { optionalAuth } = require('../middleware/jwtAuth');

/**
 * GET /api/v1/products
 * Get all products with pagination and filters
 */
router.get('/', optionalAuth, (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      category,
      search,
      sort = 'created_at',
      order = 'desc',
      min_price,
      max_price,
      in_stock,
      fields,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    let where = 'WHERE p.active = 1 AND p.is_packaging = 0';
    const params = [];

    if (category) {
      where += ' AND p.category_id = ?';
      params.push(parseInt(category));
    }

    if (search) {
      where += ' AND (p.name LIKE ? OR p.description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    if (min_price) {
      where += ' AND p.price >= ?';
      params.push(parseInt(min_price));
    }

    if (max_price) {
      where += ' AND p.price <= ?';
      params.push(parseInt(max_price));
    }

    if (in_stock === 'true') {
      where += ' AND p.stock > 0';
    }

    // Validate sort field
    const validSortFields = ['price', 'name', 'created_at', 'stock'];
    const sortField = validSortFields.includes(sort) ? sort : 'created_at';
    const sortOrder = order === 'asc' ? 'ASC' : 'DESC';

    // Get total count
    const countResult = db.prepare(`
      SELECT COUNT(*) as total
      FROM products p
      ${where}
    `).get(...params);

    const total = countResult.total;
    const totalPages = Math.ceil(total / limitNum);

    // Get products
    const products = db.prepare(`
      SELECT 
        p.id,
        p.name,
        p.description,
        p.price,
        p.image_url,
        p.category_id,
        c.name as category_name,
        p.stock,
        p.featured,
        p.created_at,
        p.sizes,
        p.colors
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      ${where}
      ORDER BY p.${sortField} ${sortOrder}
      LIMIT ? OFFSET ?
    `).all(...params, limitNum, offset);

    // Format prices
    const formattedProducts = products.map(p => ({
      ...p,
      price_formatted: `\u062C.\u0645 ${(p.price / 100).toFixed(2)}`,
      sizes: p.sizes ? JSON.parse(p.sizes) : [],
      colors: p.colors ? JSON.parse(p.colors) : [],
    }));

    // Sparse fieldsets support
    let responseData = formattedProducts;
    if (fields) {
      const fieldList = fields.split(',').map(f => f.trim());
      responseData = formattedProducts.map(p => {
        const filtered = {};
        fieldList.forEach(field => {
          if (p[field] !== undefined) {
            filtered[field] = p[field];
          }
        });
        return filtered;
      });
    }

    res.json({
      success: true,
      data: responseData,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        total_pages: totalPages,
      },
    });
  } catch (err) {
    console.error('Get products error:', err);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch products',
      },
    });
  }
});

/**
 * GET /api/v1/products/featured
 * Get featured products
 */
router.get('/featured', optionalAuth, (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));

    const products = db.prepare(`
      SELECT 
        p.id,
        p.name,
        p.price,
        p.image_url,
        p.featured_order
      FROM products p
      WHERE p.active = 1 AND p.is_packaging = 0 AND p.featured = 1
      ORDER BY p.featured_order ASC
      LIMIT ?
    `).all(limitNum);

    const formattedProducts = products.map(p => ({
      ...p,
      price_formatted: `\u062C.\u0645 ${(p.price / 100).toFixed(2)}`,
    }));

    res.json({
      success: true,
      data: formattedProducts,
    });
  } catch (err) {
    console.error('Get featured products error:', err);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch featured products',
      },
    });
  }
});

/**
 * GET /api/v1/categories
 * Get all categories
 */
router.get('/categories', optionalAuth, (req, res) => {
  try {
    const categories = db.prepare(`
      SELECT 
        c.id,
        c.name,
        COUNT(p.id) as product_count
      FROM categories c
      LEFT JOIN products p ON c.id = p.category_id AND p.active = 1 AND p.is_packaging = 0
      GROUP BY c.id
      ORDER BY c.name
    `).all();

    const categoryIcons = {
      'Electronics': '🔌',
      'Home & Kitchen': '🏠',
      'Fashion': '👕',
      'Grocery': '🛒',
      'Beauty & Care': '🧴',
    };

    const formattedCategories = categories.map(c => ({
      ...c,
      icon: categoryIcons[c.name] || '📦',
    }));

    res.json({
      success: true,
      data: formattedCategories,
    });
  } catch (err) {
    console.error('Get categories error:', err);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch categories',
      },
    });
  }
});

/**
 * GET /api/v1/brands
 * Get all brands
 */
router.get('/brands', optionalAuth, (req, res) => {
  try {
    const brands = db.prepare(`
      SELECT 
        b.id,
        b.name,
        b.icon_url,
        COUNT(p.id) as product_count
      FROM brands b
      LEFT JOIN products p ON b.id = p.brand_id AND p.active = 1 AND p.is_packaging = 0
      GROUP BY b.id
      ORDER BY b.name
    `).all();

    res.json({
      success: true,
      data: brands,
    });
  } catch (err) {
    console.error('Get brands error:', err);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch brands',
      },
    });
  }
});

/**
 * GET /api/v1/products/:id
 * Get single product with full details
 */
router.get('/:id', optionalAuth, (req, res) => {
  try {
    const product = db.prepare(`
      SELECT 
        p.*,
        c.name as category_name,
        b.name as brand_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN brands b ON p.brand_id = b.id
      WHERE p.id = ? AND p.active = 1 AND p.is_packaging = 0
    `).get(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Product not found',
        },
      });
    }

    // Get product images
    const images = db.prepare(`
      SELECT image_url, variant_attributes, sort_order
      FROM product_images
      WHERE product_id = ?
      ORDER BY sort_order ASC
    `).all(product.id);

    // Get product variants
    const variants = db.prepare(`
      SELECT *
      FROM product_variants
      WHERE product_id = ?
    `).all(product.id);

    // Get related products (same category)
    const relatedProducts = db.prepare(`
      SELECT 
        p.id,
        p.name,
        p.price,
        p.image_url
      FROM products p
      WHERE p.category_id = ? AND p.id != ? AND p.active = 1 AND p.is_packaging = 0
      ORDER BY RANDOM()
      LIMIT 4
    `).all(product.category_id, product.id);

    const formattedRelated = relatedProducts.map(p => ({
      ...p,
      price_formatted: `\u062C.\u0645 ${(p.price / 100).toFixed(2)}`,
    }));

    res.json({
      success: true,
      data: {
        ...product,
        price_formatted: `\u062C.\u0645 ${(product.price / 100).toFixed(2)}`,
        compare_at_price_formatted: product.compare_at_price 
          ? `\u062C.\u0645 ${(product.compare_at_price / 100).toFixed(2)}`
          : null,
        sizes: product.sizes ? JSON.parse(product.sizes) : [],
        colors: product.colors ? JSON.parse(product.colors) : [],
        gallery: images.map(img => img.image_url),
        variants: variants.map(v => ({
          ...v,
          price_formatted: v.price ? `\u062C.\u0645 ${(v.price / 100).toFixed(2)}` : null,
        })),
        related_products: formattedRelated,
      },
    });
  } catch (err) {
    console.error('Get product error:', err);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch product',
      },
    });
  }
});

module.exports = router;
