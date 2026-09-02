const express = require('express');
const router = express.Router();
const db = require('../db');
const cache = require('../cache');
const settingsService = require('../services/settingsService');
const priceListService = require('../services/priceListService');
const { isAuthenticated } = require('./auth');
const { sanitizeProducts, sanitizeProduct } = require('../middleware/sanitizeProducts');

// GET /api/products - List all active products (with optional filters & sorting)
router.get('/', (req, res) => {
  try {
    const { category, sort, brand, min_price, max_price, search } = req.query;

    // Determine sort order
    let orderClause;
    switch (sort) {
      case 'price_asc':
        orderClause = 'ORDER BY p.price ASC';
        break;
      case 'price_desc':
        orderClause = 'ORDER BY p.price DESC';
        break;
      case 'newest':
      default:
        orderClause = 'ORDER BY p.created_at DESC';
        break;
    }

    // Cache key varies by filter params (exclude search — always fresh for search)
    const cacheKey = search ? null : `products:${category || 'all'}:${sort || 'newest'}:${brand || 'all'}:${min_price || ''}:${max_price || ''}`;

    const products = cacheKey
      ? cache.getOrSet(cacheKey, fetchProducts, 30)
      : fetchProducts();

    function fetchProducts() {
      const baseQuery = `
        SELECT p.*, c.name as category_name, c.slug as category_slug,
               b.id as brand_id, b.name as brand_name, b.slug as brand_slug, b.icon_url as brand_icon_url,
               COALESCE((SELECT AVG(rating) FROM reviews r WHERE r.product_id = p.id), 0) as rating,
               (SELECT COUNT(*) FROM reviews r WHERE r.product_id = p.id) as rating_count
        FROM products p
        JOIN categories c ON p.category_id = c.id
        LEFT JOIN brands b ON p.brand_id = b.id
        WHERE p.active = 1 AND p.is_packaging = 0
      `;
      const conditions = [];
      const params = [];

      if (category) {
        conditions.push('c.slug = ?');
        params.push(category);
      }
      if (brand) {
        conditions.push('b.slug = ?');
        params.push(brand);
      }
      if (min_price) {
        conditions.push('p.price >= ?');
        params.push(parseInt(min_price, 10));
      }
      if (max_price) {
        conditions.push('p.price <= ?');
        params.push(parseInt(max_price, 10));
      }
      if (search && search.trim()) {
        conditions.push('p.name LIKE ?');
        params.push(`%${search.trim()}%`);
      }

      const whereClause = conditions.length > 0 ? ' AND ' + conditions.join(' AND ') : '';
      return db.prepare(`${baseQuery}${whereClause} ${orderClause}`).all(...params);
    }

    // Apply the configured storefront price list (retail / wholesale / semi_wholesale / offer)
    const listCode = priceListService.storefrontListCode();
    const withPricing = priceListService.applyPriceList(products, listCode);

    // SECURITY: Remove sensitive wholesale/internal fields before sending to customer
    res.json(sanitizeProducts(withPricing));
  } catch (err) {
    console.error('Error fetching products:', err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// GET /api/products/featured - Admin-curated featured products
router.get('/featured', (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 20);
    const products = db.prepare(`
      SELECT p.*, c.name as category_name, c.slug as category_slug,
             b.id as brand_id, b.name as brand_name, b.slug as brand_slug, b.icon_url as brand_icon_url
      FROM products p
      JOIN categories c ON p.category_id = c.id
      LEFT JOIN brands b ON p.brand_id = b.id
      WHERE p.active = 1 AND p.is_packaging = 0 AND p.featured = 1
      ORDER BY p.featured_order ASC, p.created_at DESC
      LIMIT ?
    `).all(limit);
    const withPricing = priceListService.applyPriceList(products, priceListService.storefrontListCode());
    res.json(sanitizeProducts(withPricing));
  } catch (err) {
    console.error('Error fetching featured products:', err);
    res.status(500).json({ error: 'Failed to fetch featured products' });
  }
});

// GET /api/products/top-selling - Top-selling products by order quantity
router.get('/top-selling', (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 4, 10);

    // Get all paid orders and tally product sales from their items JSON
    const orders = db.prepare("SELECT items FROM orders WHERE status = 'paid'").all();
    const salesCount = {};

    orders.forEach(order => {
      try {
        const items = JSON.parse(order.items || '[]');
        items.forEach(item => {
          const pid = item.id || item.product_id;
          const qty = item.qty || item.quantity || 1;
          if (pid) {
            salesCount[pid] = (salesCount[pid] || 0) + qty;
          }
        });
      } catch { /* skip malformed items */ }
    });

    // Sort product IDs by sales count descending
    const sortedIds = Object.entries(salesCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id]) => parseInt(id));

    if (sortedIds.length === 0) {
      // Fallback: return newest products if no sales yet
      const fallback = db.prepare(`
        SELECT p.*, c.name as category_name, c.slug as category_slug,
               b.id as brand_id, b.name as brand_name, b.slug as brand_slug, b.icon_url as brand_icon_url
        FROM products p
        JOIN categories c ON p.category_id = c.id
        LEFT JOIN brands b ON p.brand_id = b.id
        WHERE p.active = 1 AND p.is_packaging = 0
        ORDER BY p.created_at DESC LIMIT ?
      `).all(limit);
      const withPricing = priceListService.applyPriceList(fallback, priceListService.storefrontListCode());
      return res.json(sanitizeProducts(withPricing));
    }

    // Fetch the actual product data for the top sellers
    const placeholders = sortedIds.map(() => '?').join(',');
    const products = db.prepare(`
      SELECT p.*, c.name as category_name, c.slug as category_slug,
             b.id as brand_id, b.name as brand_name, b.slug as brand_slug, b.icon_url as brand_icon_url
      FROM products p
      JOIN categories c ON p.category_id = c.id
      LEFT JOIN brands b ON p.brand_id = b.id
      WHERE p.id IN (${placeholders}) AND p.active = 1 AND p.is_packaging = 0
    `).all(...sortedIds);

    // Preserve the sales-sorted order (SQL IN doesn't guarantee order)
    const productMap = {};
    products.forEach(p => { productMap[p.id] = p; });
    const ordered = sortedIds.map(id => productMap[id]).filter(Boolean);

    res.json(priceListService.applyPriceList(ordered, priceListService.storefrontListCode()));
  } catch (err) {
    console.error('Error fetching top-selling products:', err);
    res.status(500).json({ error: 'Failed to fetch top-selling products' });
  }
});

// GET /api/products/:id - Get single product
router.get('/:id', (req, res) => {
  try {
    const product = db.prepare(`
      SELECT p.*, c.name as category_name, c.slug as category_slug,
             b.id as brand_id, b.name as brand_name, b.slug as brand_slug, b.icon_url as brand_icon_url,
             COALESCE((SELECT AVG(rating) FROM reviews r WHERE r.product_id = p.id), 0) as rating,
             (SELECT COUNT(*) FROM reviews r WHERE r.product_id = p.id) as rating_count
      FROM products p
      JOIN categories c ON p.category_id = c.id
      LEFT JOIN brands b ON p.brand_id = b.id
      WHERE p.id = ? AND p.active = 1 AND p.is_packaging = 0
    `).get(req.params.id);

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(priceListService.applyPriceList([product], priceListService.storefrontListCode())[0]);
  } catch (err) {
    console.error('Error fetching product:', err);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// GET /api/products/:id/reviews - List customer reviews for a product (public)
router.get('/:id/reviews', (req, res) => {
  try {
    const reviews = db.prepare(`
      SELECT r.id, r.product_id, r.customer_id, r.rating, r.comment, r.created_at,
             c.name as customer_name, c.avatar_url
      FROM reviews r
      JOIN customers c ON c.id = r.customer_id
      WHERE r.product_id = ?
      ORDER BY r.created_at DESC
    `).all(req.params.id);
    res.json(reviews);
  } catch (err) {
    console.error('Error fetching reviews:', err);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// POST /api/products/:id/reviews - Add/update the customer's review (auth required)
// Body: { rating: 1-5, comment: string } — one review per customer per product (upsert)
router.post('/:id/reviews', isAuthenticated, (req, res) => {
  try {
    const product = db.prepare('SELECT id FROM products WHERE id = ? AND active = 1').get(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    // Accept whole or half-star ratings (0.5 steps, clamped 1-5)
    const rawRating = parseFloat(req.body.rating);
    const rating = Math.min(5, Math.max(1, Math.round((isNaN(rawRating) ? 5 : rawRating) * 2) / 2));
    const comment = typeof req.body.comment === 'string' ? req.body.comment.trim().slice(0, 2000) : '';

    db.prepare(`
      INSERT INTO reviews (product_id, customer_id, rating, comment)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(product_id, customer_id)
      DO UPDATE SET rating = excluded.rating, comment = excluded.comment, created_at = CURRENT_TIMESTAMP
    `).run(req.params.id, req.user.id, rating, comment);

    cache.invalidatePrefix('products:');
    res.status(201).json({ success: true, rating, comment });
  } catch (err) {
    console.error('Error saving review:', err);
    res.status(500).json({ error: 'Failed to save review' });
  }
});

// GET /api/products/:id/images - Get gallery images for a product (public)
router.get('/:id/images', (req, res) => {
  try {
    const images = db.prepare(`
      SELECT * FROM product_images WHERE product_id = ? ORDER BY sort_order ASC, id ASC
    `).all(req.params.id);
    res.json(images);
  } catch (err) {
    console.error('Error fetching product images:', err);
    res.status(500).json({ error: 'Failed to fetch product images' });
  }
});

// GET /api/products/brands/list - List all brands (public)
router.get('/brands/list', (req, res) => {
  try {
    const brands = db.prepare(`
      SELECT b.*, COUNT(p.id) as product_count
      FROM brands b
      LEFT JOIN products p ON p.brand_id = b.id AND p.active = 1 AND p.is_packaging = 0
      GROUP BY b.id
      ORDER BY b.name
    `).all();
    res.json(brands);
  } catch (err) {
    console.error('Error fetching brands:', err);
    res.status(500).json({ error: 'Failed to fetch brands' });
  }
});

// GET /api/products/categories/list - List all categories
router.get('/categories/list', (req, res) => {
  try {
    const categories = db.prepare(`
      SELECT c.*, COUNT(p.id) as product_count
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id AND p.active = 1 AND p.is_packaging = 0
      GROUP BY c.id
      ORDER BY c.name
    `).all();
    res.json(categories);
  } catch (err) {
    console.error('Error fetching categories:', err);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// GET /api/products/categories/showcase - Admin-configured home page category showcase
// Returns { enabled, items } where items follow the admin-configured order.
// The config is a JSON array of category slugs (settings key `home_categories`);
// empty config = fall back to all categories ordered by name.
router.get('/categories/showcase', (req, res) => {
  try {
    const enabled = settingsService.get('home_categories_enabled', true);
    const config = settingsService.get('home_categories', []);

    const categories = db.prepare(`
      SELECT c.*, COUNT(p.id) as product_count
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id AND p.active = 1 AND p.is_packaging = 0
      GROUP BY c.id
      ORDER BY c.name
    `).all();

    let items = categories;
    if (Array.isArray(config) && config.length > 0) {
      const bySlug = new Map(categories.map(c => [c.slug, c]));
      const ordered = config.map(slug => bySlug.get(slug)).filter(Boolean);
      if (ordered.length > 0) items = ordered;
    }

    res.json({ enabled: !!enabled, items });
  } catch (err) {
    console.error('Error fetching category showcase:', err);
    res.status(500).json({ error: 'Failed to fetch category showcase' });
  }
});

module.exports = router;
