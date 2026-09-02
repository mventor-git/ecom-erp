/**
 * Bulk Product Operations Routes
 *
 * Endpoints for bulk product management:
 * - POST /api/admin/products/bulk/delete       - Bulk delete products
 * - POST /api/admin/products/bulk/activate     - Bulk activate products
 * - POST /api/admin/products/bulk/deactivate   - Bulk deactivate products
 * - POST /api/admin/products/bulk/category     - Bulk change category
 * - POST /api/admin/products/bulk/discount     - Bulk apply discount
 *
 * Created: 2026-08-24 (mventor high-priority enhancements)
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const adminAuth = require('../middleware/adminAuth');
const { requirePermission } = require('../middleware/rbac');
const eventService = require('../services/eventService');
const cache = require('../cache');

/**
 * POST /api/admin/products/bulk/delete
 * Soft delete multiple products (moves to trash)
 * Body: { product_ids: [1, 2, 3] }
 */
router.post('/bulk/delete', adminAuth, requirePermission('products.delete'), (req, res) => {
  const { product_ids } = req.body;

  if (!Array.isArray(product_ids) || product_ids.length === 0) {
    return res.status(400).json({ error: 'product_ids array is required' });
  }

  if (product_ids.length > 100) {
    return res.status(400).json({ error: 'Cannot delete more than 100 products at once' });
  }

  try {
    const placeholders = product_ids.map(() => '?').join(',');

    // Move to trash (soft delete)
    const result = db.prepare(`
      UPDATE products
      SET deleted_at = CURRENT_TIMESTAMP
      WHERE id IN (${placeholders})
    `).run(...product_ids);

    // Clear cache
    cache.clearProductCache();

    // Log event
    eventService.emit(
      'PRODUCTS_BULK_DELETED',
      eventService.ENTITY_TYPES.PRODUCT,
      null,
      {
        userId: req.session.adminUser?.id,
        userRole: req.session.adminUser?.role,
        payload: { product_ids, count: result.changes },
        metadata: { ip: req.ip }
      }
    );

    res.json({
      success: true,
      message: `${result.changes} product(s) moved to trash`,
      count: result.changes
    });
  } catch (err) {
    console.error('Bulk delete failed:', err);
    res.status(500).json({ error: 'Failed to delete products' });
  }
});

/**
 * POST /api/admin/products/bulk/activate
 * Activate multiple products
 * Body: { product_ids: [1, 2, 3] }
 */
router.post('/bulk/activate', adminAuth, requirePermission('products.update'), (req, res) => {
  const { product_ids } = req.body;

  if (!Array.isArray(product_ids) || product_ids.length === 0) {
    return res.status(400).json({ error: 'product_ids array is required' });
  }

  if (product_ids.length > 100) {
    return res.status(400).json({ error: 'Cannot activate more than 100 products at once' });
  }

  try {
    const placeholders = product_ids.map(() => '?').join(',');

    const result = db.prepare(`
      UPDATE products
      SET active = 1, updated_at = CURRENT_TIMESTAMP
      WHERE id IN (${placeholders})
    `).run(...product_ids);

    cache.clearProductCache();

    eventService.emit(
      'PRODUCTS_BULK_ACTIVATED',
      eventService.ENTITY_TYPES.PRODUCT,
      null,
      {
        userId: req.session.adminUser?.id,
        userRole: req.session.adminUser?.role,
        payload: { product_ids, count: result.changes },
        metadata: { ip: req.ip }
      }
    );

    res.json({
      success: true,
      message: `${result.changes} product(s) activated`,
      count: result.changes
    });
  } catch (err) {
    console.error('Bulk activate failed:', err);
    res.status(500).json({ error: 'Failed to activate products' });
  }
});

/**
 * POST /api/admin/products/bulk/deactivate
 * Deactivate multiple products
 * Body: { product_ids: [1, 2, 3] }
 */
router.post('/bulk/deactivate', adminAuth, requirePermission('products.update'), (req, res) => {
  const { product_ids } = req.body;

  if (!Array.isArray(product_ids) || product_ids.length === 0) {
    return res.status(400).json({ error: 'product_ids array is required' });
  }

  if (product_ids.length > 100) {
    return res.status(400).json({ error: 'Cannot deactivate more than 100 products at once' });
  }

  try {
    const placeholders = product_ids.map(() => '?').join(',');

    const result = db.prepare(`
      UPDATE products
      SET active = 0, updated_at = CURRENT_TIMESTAMP
      WHERE id IN (${placeholders})
    `).run(...product_ids);

    cache.clearProductCache();

    eventService.emit(
      'PRODUCTS_BULK_DEACTIVATED',
      eventService.ENTITY_TYPES.PRODUCT,
      null,
      {
        userId: req.session.adminUser?.id,
        userRole: req.session.adminUser?.role,
        payload: { product_ids, count: result.changes },
        metadata: { ip: req.ip }
      }
    );

    res.json({
      success: true,
      message: `${result.changes} product(s) deactivated`,
      count: result.changes
    });
  } catch (err) {
    console.error('Bulk deactivate failed:', err);
    res.status(500).json({ error: 'Failed to deactivate products' });
  }
});

/**
 * POST /api/admin/products/bulk/category
 * Change category for multiple products
 * Body: { product_ids: [1, 2, 3], category_id: 5 }
 */
router.post('/bulk/category', adminAuth, requirePermission('products.update'), (req, res) => {
  const { product_ids, category_id } = req.body;

  if (!Array.isArray(product_ids) || product_ids.length === 0) {
    return res.status(400).json({ error: 'product_ids array is required' });
  }

  if (!category_id) {
    return res.status(400).json({ error: 'category_id is required' });
  }

  if (product_ids.length > 100) {
    return res.status(400).json({ error: 'Cannot update more than 100 products at once' });
  }

  try {
    // Verify category exists
    const category = db.prepare('SELECT id, name FROM categories WHERE id = ?').get(category_id);
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const placeholders = product_ids.map(() => '?').join(',');

    const result = db.prepare(`
      UPDATE products
      SET category_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id IN (${placeholders})
    `).run(category_id, ...product_ids);

    cache.clearProductCache();

    eventService.emit(
      'PRODUCTS_BULK_CATEGORY_CHANGED',
      eventService.ENTITY_TYPES.PRODUCT,
      null,
      {
        userId: req.session.adminUser?.id,
        userRole: req.session.adminUser?.role,
        payload: {
          product_ids,
          category_id,
          category_name: category.name,
          count: result.changes
        },
        metadata: { ip: req.ip }
      }
    );

    res.json({
      success: true,
      message: `${result.changes} product(s) moved to category "${category.name}"`,
      count: result.changes,
      category: category.name
    });
  } catch (err) {
    console.error('Bulk category change failed:', err);
    res.status(500).json({ error: 'Failed to change category' });
  }
});

/**
 * POST /api/admin/products/bulk/discount
 * Apply discount to multiple products
 * Body: {
 *   product_ids: [1, 2, 3],
 *   discount_type: 'percentage' | 'fixed',
 *   discount_value: 10
 * }
 */
router.post('/bulk/discount', adminAuth, requirePermission('products.update'), (req, res) => {
  const { product_ids, discount_type, discount_value } = req.body;

  if (!Array.isArray(product_ids) || product_ids.length === 0) {
    return res.status(400).json({ error: 'product_ids array is required' });
  }

  if (!discount_type || !['percentage', 'fixed'].includes(discount_type)) {
    return res.status(400).json({ error: 'discount_type must be "percentage" or "fixed"' });
  }

  if (discount_value === undefined || discount_value < 0) {
    return res.status(400).json({ error: 'discount_value must be a positive number' });
  }

  if (product_ids.length > 100) {
    return res.status(400).json({ error: 'Cannot update more than 100 products at once' });
  }

  try {
    const placeholders = product_ids.map(() => '?').join(',');

    // Get products with their current prices
    const products = db.prepare(`
      SELECT id, name, price
      FROM products
      WHERE id IN (${placeholders})
    `).all(...product_ids);

    if (products.length === 0) {
      return res.status(404).json({ error: 'No products found' });
    }

    // Calculate new prices
    const updates = products.map(p => {
      let newPrice;
      if (discount_type === 'percentage') {
        newPrice = p.price * (1 - discount_value / 100);
      } else {
        newPrice = p.price - discount_value;
      }

      // Ensure price doesn't go below 0
      newPrice = Math.max(0, Math.round(newPrice * 100) / 100);

      return { id: p.id, oldPrice: p.price, newPrice };
    });

    // Apply new prices
    const stmt = db.prepare('UPDATE products SET price = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    updates.forEach(u => stmt.run(u.newPrice, u.id));

    cache.clearProductCache();

    eventService.emit(
      'PRODUCTS_BULK_DISCOUNT_APPLIED',
      eventService.ENTITY_TYPES.PRODUCT,
      null,
      {
        userId: req.session.adminUser?.id,
        userRole: req.session.adminUser?.role,
        payload: {
          product_ids,
          discount_type,
          discount_value,
          count: updates.length,
          price_changes: updates
        },
        metadata: { ip: req.ip }
      }
    );

    res.json({
      success: true,
      message: `Discount applied to ${updates.length} product(s)`,
      count: updates.length,
      discount_type,
      discount_value,
      changes: updates
    });
  } catch (err) {
    console.error('Bulk discount failed:', err);
    res.status(500).json({ error: 'Failed to apply discount' });
  }
});

/**
 * POST /api/admin/products/bulk/brand
 * Change brand for multiple products
 * Body: { product_ids: [1, 2, 3], brand_id: 5 }
 */
router.post('/bulk/brand', adminAuth, requirePermission('products.update'), (req, res) => {
  const { product_ids, brand_id } = req.body;

  if (!Array.isArray(product_ids) || product_ids.length === 0) {
    return res.status(400).json({ error: 'product_ids array is required' });
  }

  if (product_ids.length > 100) {
    return res.status(400).json({ error: 'Cannot update more than 100 products at once' });
  }

  try {
    // brand_id can be null (remove brand)
    let brand = null;
    if (brand_id) {
      brand = db.prepare('SELECT id, name FROM brands WHERE id = ?').get(brand_id);
      if (!brand) {
        return res.status(404).json({ error: 'Brand not found' });
      }
    }

    const placeholders = product_ids.map(() => '?').join(',');

    const result = db.prepare(`
      UPDATE products
      SET brand_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id IN (${placeholders})
    `).run(brand_id, ...product_ids);

    cache.clearProductCache();

    eventService.emit(
      'PRODUCTS_BULK_BRAND_CHANGED',
      eventService.ENTITY_TYPES.PRODUCT,
      null,
      {
        userId: req.session.adminUser?.id,
        userRole: req.session.adminUser?.role,
        payload: {
          product_ids,
          brand_id,
          brand_name: brand?.name || null,
          count: result.changes
        },
        metadata: { ip: req.ip }
      }
    );

    res.json({
      success: true,
      message: brand
        ? `${result.changes} product(s) assigned to brand "${brand.name}"`
        : `${result.changes} product(s) brand removed`,
      count: result.changes,
      brand: brand?.name || null
    });
  } catch (err) {
    console.error('Bulk brand change failed:', err);
    res.status(500).json({ error: 'Failed to change brand' });
  }
});

module.exports = router;
