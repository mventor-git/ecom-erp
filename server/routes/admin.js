const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const cache = require('../cache');
const adminAuth = require('../middleware/adminAuth');
const { requirePermission } = require('../middleware/rbac');
const { generateToken } = require('../middleware/csrf');
const { validateProduct, validateLogin, validateOrderStatus } = require('../validate');
const eventService = require('../services/eventService');

const permissionService = require("../services/permissionService");
// POST /api/admin/login - Admin login
router.post('/login', (req, res) => {
  try {
    // Validate input
    const validation = validateLogin(req.body);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.errors.join('; ') });
    }

    const { username, password } = validation.data;

    // Try RBAC-based login first (check users table)
    const user = db.prepare(`
      SELECT u.*, r.name as role_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.email = ? AND u.is_active = 1
    `).get(username);

    if (user) {
      // RBAC user found - verify password
      const isValid = bcrypt.compareSync(password, user.password_hash);
      if (!isValid) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Rotate the session ID after authentication to prevent session fixation.
      req.session.regenerate((regenerateErr) => {
        if (regenerateErr) {
          console.error('Admin session regeneration error:', regenerateErr);
          return res.status(500).json({ error: 'Login failed' });
        }

        req.session.isAdmin = true;
        req.session.userId = user.id;
        req.session.userRole = user.role_name;
        req.session.csrfToken = generateToken();

        // Update last login time
        db.prepare('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);

        req.session.save((saveErr) => {
          if (saveErr) {
            console.error('Admin session save error:', saveErr);
            return res.status(500).json({ error: 'Login failed' });
          }

          // Emit user_login event
          eventService.emit(eventService.EVENT_TYPES.USER_LOGIN, eventService.ENTITY_TYPES.USER, user.id, {
            userId: user.id,
            userRole: user.role_name,
            metadata: {
              ip: req.ip,
              userAgent: req.get('User-Agent'),
            },
          });

          return res.json({
            success: true,
            message: 'Logged in successfully',
            user: {
              id: user.id,
              email: user.email,
              name: user.name,
              role: user.role_name,
              roles: permissionService.userRoleNames(user.id),
              isSuperAdmin: permissionService.hasAnyRole(user.id, 'super_admin')
            }
          });
        });
      });
      return;
    }

    // Fall back to environment variable login (backward compatibility)
    const adminUser = process.env.ADMIN_USERNAME;
    const adminPass = process.env.ADMIN_PASSWORD;

    if (!adminUser || !adminPass) {
      console.error('Admin login unavailable: credentials are not configured');
      return res.status(503).json({ error: 'Admin login is not configured' });
    }

    if (username !== adminUser) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Compare password (use bcrypt if already hashed, otherwise plain text comparison)
    const isBcryptHash = /^\$2[aby]\$\d{2}\$/.test(adminPass);
    const isValid = isBcryptHash
      ? bcrypt.compareSync(password, adminPass)
      : password === adminPass;

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Rotate the session ID after authentication to prevent session fixation.
    req.session.regenerate((regenerateErr) => {
      if (regenerateErr) {
        console.error('Admin session regeneration error:', regenerateErr);
        return res.status(500).json({ error: 'Login failed' });
      }

      req.session.isAdmin = true;
      req.session.csrfToken = generateToken();
      req.session.save((saveErr) => {
        if (saveErr) {
          console.error('Admin session save error:', saveErr);
          return res.status(500).json({ error: 'Login failed' });
        }

        // Emit user_login event
        eventService.emit(eventService.EVENT_TYPES.USER_LOGIN, eventService.ENTITY_TYPES.USER, 0, {
          userId: username,
          userRole: 'admin',
          metadata: {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
          },
        });

        return res.json({ success: true, message: 'Logged in successfully' });
      });
    });
  } catch (err) {
    console.error('Admin login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/admin/logout - Admin logout
router.post('/logout', (req, res) => {
  // Emit user_logout event before destroying session
  if (req.session.isAdmin) {
    eventService.emit(eventService.EVENT_TYPES.USER_LOGOUT, eventService.ENTITY_TYPES.USER, 0, {
      userId: req.session.username || 'admin',
      userRole: 'admin',
      metadata: {
        ip: req.ip,
      },
    });
  }
  req.session.destroy();
  res.json({ success: true, message: 'Logged out' });
});

// GET /api/admin/me - Check if logged in
router.get('/me', (req, res) => {
  if (!req.session.isAdmin) return res.json({ isAdmin: false });

  // RBAC session: include identity + roles so the UI can gate by role
  if (req.session.userId) {
    const permissionService = require('../services/permissionService');
    const user = db.prepare(`
      SELECT u.id, u.email, u.name, r.name as role_name
      FROM users u JOIN roles r ON u.role_id = r.id
      WHERE u.id = ? AND u.is_active = 1
    `).get(req.session.userId);
    if (user) {
      const roles = permissionService.userRoleNames(user.id);
      const permissions = permissionService.userPermissions(user.id);
      return res.json({
        isAdmin: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role_name,
          roles,
          permissions,
          isSuperAdmin: roles.includes('super_admin'),
        },
      });
    }
  }

  // Env-bootstrap admin fallback (full wildcard)
  return res.json({ isAdmin: true, user: { id: 0, email: 'env-admin', name: 'Administrator', role: 'super_admin', roles: ['super_admin'], permissions: ['*'], isSuperAdmin: true } });
});

// ========== Product CRUD (Admin only) ==========

// GET /api/admin/products - List ALL products (including inactive)
router.get('/products', adminAuth, (req, res) => {
  try {
    const products = db.prepare(`
      SELECT p.*, c.name as category_name, c.slug as category_slug,
             b.id as brand_id, b.name as brand_name, b.slug as brand_slug, b.icon_url as brand_icon_url
      FROM products p
      JOIN categories c ON p.category_id = c.id
      LEFT JOIN brands b ON p.brand_id = b.id
      WHERE p.deleted_at IS NULL
      ORDER BY p.created_at DESC
    `).all();
    res.json(products);
  } catch (err) {
    console.error('Error fetching admin products:', err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// ── Icon endpoints (mventor-ticket-058): URL or uploaded file path.
// Setting a new icon always OVERWRITES the previous one.

router.put('/categories/:id/icon', adminAuth, (req, res) => {
  try {
    const { icon_url } = req.body || {};
    const cat = db.prepare('SELECT id FROM categories WHERE id = ?').get(req.params.id);
    if (!cat) return res.status(404).json({ error: 'Category not found' });
    db.prepare('UPDATE categories SET icon_url = ? WHERE id = ?').run(String(icon_url || ''), req.params.id);
    cache.invalidatePrefix('products:');
    res.json({ success: true, icon_url: String(icon_url || '') });
  } catch (err) {
    res.status(500).json({ error: 'Failed to set category icon' });
  }
});

router.put('/brands/:id/icon', adminAuth, (req, res) => {
  try {
    const { icon_url } = req.body || {};
    const brand = db.prepare('SELECT id FROM brands WHERE id = ?').get(req.params.id);
    if (!brand) return res.status(404).json({ error: 'Brand not found' });
    db.prepare('UPDATE brands SET icon_url = ? WHERE id = ?').run(String(icon_url || ''), req.params.id);
    cache.invalidatePrefix('products:');
    res.json({ success: true, icon_url: String(icon_url || '') });
  } catch (err) {
    res.status(500).json({ error: 'Failed to set brand icon' });
  }
});

// POST /api/admin/products - Create a new product
router.post('/products', adminAuth, (req, res) => {
  try {
    // Validate input
    const validation = validateProduct(req.body);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.errors.join('; ') });
    }

    const { name, description, price, cost_price, category_id, image_url, stock, brand_id } = validation.data;

    // Wholesale-first pricing (mventor-ticket-061): explicit retail wins;
    // otherwise retail is derived from wholesale × default markup.
    const pricingService = require('../services/pricingService');
    const costPriceCents = Math.max(Math.round((cost_price ?? 0) * 100), 0);
    const resolvedRetail = pricingService.resolveRetail({
      priceCents: Math.round((price ?? 0) * 100),
      costCents: costPriceCents,
    });
    const priceInCents = resolvedRetail.price;
    const oldPriceInCents = req.body.old_price !== undefined ? Math.round((parseFloat(req.body.old_price) || 0) * 100) : 0;
    const sizesJSON = req.body.sizes ? JSON.stringify(req.body.sizes) : '[]';
    const hero_title_color = req.body.hero_title_color || '#ffffff';
    const hero_desc_color = req.body.hero_desc_color || '#ffffff';
    const hero_price_color = req.body.hero_price_color || '#ffffff';
    const hero_badge_color = req.body.hero_badge_color || '#ffffff';
    const name_ar = String(req.body.name_ar || '').trim();
    const description_ar = String(req.body.description_ar || '');

    // ERP LAW (mventor-ticket-053): products are ALWAYS created with zero stock.
    // Any initial quantity is recorded as an opening_balance movement below.
    const result = db.prepare(`
      INSERT INTO products (name, name_ar, description, description_ar, price, cost_price, old_price, category_id, image_url, stock, brand_id, sizes, hero_title_color, hero_desc_color, hero_price_color, hero_badge_color)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)
    `).run(name, name_ar, description || '', description_ar, priceInCents, costPriceCents, oldPriceInCents, category_id || 1, image_url || '', brand_id || null, sizesJSON, hero_title_color, hero_desc_color, hero_price_color, hero_badge_color);

    const productId = result.lastInsertRowid;
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
    cache.invalidatePrefix('products:'); // invalidate product cache

    // Initial in-stock → opening_balance movement through the engine
    let initialMovement = null;
    try {
      const inventoryService = require('../services/inventoryService');
      initialMovement = inventoryService.recordInitialStock(
        productId, stock, req.session.username || 'admin'
      );
    } catch (moveErr) {
      console.error('Initial stock movement failed:', moveErr.message);
    }

    // Emit product_created event
    eventService.emit(eventService.EVENT_TYPES.PRODUCT_CREATED, eventService.ENTITY_TYPES.PRODUCT, productId, {
      userId: req.session.username || 'admin',
      userRole: 'admin',
      payload: {
        name: product.name,
        price: product.price,
        category_id: product.category_id,
        initial_stock: stock || 0,
      },
    });

    res.status(201).json({ ...product, initial_movement: initialMovement });
  } catch (err) {
    console.error('Error creating product:', err);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// PUT /api/admin/products/:id - Update a product
router.put('/products/:id', adminAuth, (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Validate fields that were provided
    if (req.body.name !== undefined && (!req.body.name || req.body.name.trim().length === 0)) {
      return res.status(400).json({ error: 'Product name cannot be empty' });
    }
    if (req.body.price !== undefined) {
      const p = parseFloat(req.body.price);
      if (isNaN(p) || p <= 0) {
        return res.status(400).json({ error: 'Price must be a positive number' });
      }
    }

    const priceInCents = req.body.price ? Math.round(parseFloat(req.body.price) * 100) : existing.price;
    // Wholesale cost is editable from Warehouse → Catalog (mventor-ticket-061)
    const costPriceInCents = req.body.cost_price !== undefined
      ? Math.max(Math.round((parseFloat(req.body.cost_price) || 0) * 100), 0)
      : (existing.cost_price || 0);
    const oldPriceInCents = req.body.old_price !== undefined
      ? Math.round((parseFloat(req.body.old_price) || 0) * 100)
      : existing.old_price;
    const name = req.body.name !== undefined ? req.body.name : existing.name;
    const description = req.body.description !== undefined ? req.body.description : existing.description;
    const category_id = req.body.category_id || existing.category_id;
    const image_url = req.body.image_url !== undefined ? req.body.image_url : existing.image_url;
    // ERP LAW (mventor-ticket-053): stock is IMMUTABLE outside the movement
    // engine. Any `stock` value sent to this endpoint is ignored — changes go
    // through Inventory → Movements / Supply Orders / Counts.
    const stock = existing.stock;
    const active = req.body.active !== undefined ? (req.body.active ? 1 : 0) : existing.active;
    const brand_id = req.body.brand_id !== undefined ? (req.body.brand_id || null) : existing.brand_id;
    const sizes = req.body.sizes !== undefined ? JSON.stringify(req.body.sizes) : existing.sizes;
    const featured = req.body.featured !== undefined ? (req.body.featured ? 1 : 0) : existing.featured;
    const featured_order = req.body.featured_order !== undefined ? parseInt(req.body.featured_order) : existing.featured_order;
    const is_new = req.body.is_new !== undefined ? (req.body.is_new ? 1 : 0) : existing.is_new;
    const hero_title_color = req.body.hero_title_color !== undefined ? req.body.hero_title_color : existing.hero_title_color;
    const hero_desc_color = req.body.hero_desc_color !== undefined ? req.body.hero_desc_color : existing.hero_desc_color;
    const hero_price_color = req.body.hero_price_color !== undefined ? req.body.hero_price_color : existing.hero_price_color;
    const hero_badge_color = req.body.hero_badge_color !== undefined ? req.body.hero_badge_color : existing.hero_badge_color;

    // Storefront selling mode (mventor-ticket-054): per-product price list
    // override + TWO ribbons (left = offer %, right = custom text).
    let sale_price_list = existing.sale_price_list || '';
    if (req.body.sale_price_list !== undefined) {
      const code = String(req.body.sale_price_list || '').trim();
      if (code === '') {
        sale_price_list = '';
      } else {
        const list = db.prepare('SELECT id FROM price_lists WHERE code = ? AND is_active = 1').get(code);
        if (!list) return res.status(400).json({ error: `Unknown price list: ${code}` });
        sale_price_list = code;
      }
    }
    const offer_badge = req.body.offer_badge !== undefined ? (req.body.offer_badge ? 1 : 0) : (existing.offer_badge || 0);
    const offer_color = req.body.offer_color !== undefined ? req.body.offer_color : (existing.offer_color || '#ef4444');
    const text_badge = req.body.text_badge !== undefined ? (req.body.text_badge ? 1 : 0) : (existing.text_badge || 0);
    const text_badge_text = req.body.text_badge_text !== undefined ? String(req.body.text_badge_text || '').slice(0, 60) : (existing.text_badge_text || '');
    const text_badge_color = req.body.text_badge_color !== undefined ? req.body.text_badge_color : (existing.text_badge_color || '#1f857a');
    // Arabic content variants
    const name_ar = req.body.name_ar !== undefined ? String(req.body.name_ar).trim() : (existing.name_ar || '');
    const description_ar = req.body.description_ar !== undefined ? String(req.body.description_ar) : (existing.description_ar || '');

    db.prepare(`
      UPDATE products
      SET name = ?, name_ar = ?, description = ?, description_ar = ?, price = ?, category_id = ?,
          image_url = ?, stock = ?, active = ?, brand_id = ?,
          sizes = ?, featured = ?, featured_order = ?, is_new = ?, old_price = ?,
          hero_title_color = ?, hero_desc_color = ?, hero_price_color = ?, hero_badge_color = ?,
          sale_price_list = ?, offer_badge = ?, offer_color = ?,
          text_badge = ?, text_badge_text = ?, text_badge_color = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name,
      name_ar,
      description,
      description_ar,
      priceInCents,
      category_id,
      image_url,
      stock,
      active,
      brand_id,
      sizes,
      featured,
      featured_order,
      is_new,
      oldPriceInCents,
      hero_title_color,
      hero_desc_color,
      hero_price_color,
      hero_badge_color,
      sale_price_list,
      offer_badge,
      offer_color,
      text_badge,
      text_badge_text,
      text_badge_color,
      req.params.id
    );

    const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    cache.invalidatePrefix('products:'); // invalidate product cache

    // Emit product_updated event
    eventService.emit(eventService.EVENT_TYPES.PRODUCT_UPDATED, eventService.ENTITY_TYPES.PRODUCT, parseInt(req.params.id), {
      userId: req.session.username || 'admin',
      userRole: 'admin',
      payload: {
        name: updated.name,
        price: updated.price,
        stock: updated.stock,
        active: updated.active,
      },
    });

    res.json(updated);
  } catch (err) {
    console.error('Error updating product:', err);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// DELETE /api/admin/products/:id - Delete a product
router.delete('/products/:id', adminAuth, (req, res) => {
  try {
    // Soft delete (mventor-ticket-044): move to trash instead of hard delete.
    const productTrashService = require('../services/productTrashService');
    const ok = productTrashService.trashOne(req.params.id, req.session.username || 'admin');
    if (!ok) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ success: true, message: 'Product moved to trash', trashed: true });
  } catch (err) {
    console.error('Error deleting product:', err);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// ========== Product Images Management (Admin only) ==========

// GET /api/admin/products/:id/images - List all images for a product
router.get('/products/:id/images', adminAuth, (req, res) => {
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

// POST /api/admin/products/:id/images - Add an image to a product
router.post('/products/:id/images', adminAuth, (req, res) => {
  try {
    const { image_url, variant_attributes } = req.body;
    if (!image_url) {
      return res.status(400).json({ error: 'image_url is required' });
    }

    const variantAttrs = variant_attributes ? JSON.stringify(variant_attributes) : '{}';

    // Get the next sort_order
    const maxOrder = db.prepare(`
      SELECT COALESCE(MAX(sort_order), -1) + 1 as next_order
      FROM product_images WHERE product_id = ?
    `).get(req.params.id);
    const sortOrder = maxOrder ? maxOrder.next_order : 0;

    const result = db.prepare(`
      INSERT INTO product_images (product_id, image_url, sort_order, variant_attributes)
      VALUES (?, ?, ?, ?)
    `).run(req.params.id, image_url, sortOrder, variantAttrs);

    const image = db.prepare('SELECT * FROM product_images WHERE id = ?').get(result.lastInsertRowid);
    cache.invalidatePrefix('products:');
    res.status(201).json(image);
  } catch (err) {
    console.error('Error adding product image:', err);
    res.status(500).json({ error: 'Failed to add product image' });
  }
});

// PUT /api/admin/products/:id/images/:imageId - Update image variant attributes
router.put('/products/:id/images/:imageId', adminAuth, (req, res) => {
  try {
    const { variant_attributes } = req.body;
    const variantAttrs = variant_attributes ? JSON.stringify(variant_attributes) : '{}';

    const existing = db.prepare('SELECT * FROM product_images WHERE id = ? AND product_id = ?')
      .get(req.params.imageId, req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Image not found' });
    }

    db.prepare('UPDATE product_images SET variant_attributes = ? WHERE id = ?')
      .run(variantAttrs, req.params.imageId);

    const image = db.prepare('SELECT * FROM product_images WHERE id = ?').get(req.params.imageId);
    cache.invalidatePrefix('products:');
    res.json(image);
  } catch (err) {
    console.error('Error updating product image:', err);
    res.status(500).json({ error: 'Failed to update product image' });
  }
});

// PUT /api/admin/products/:id/images/reorder - Reorder images
router.put('/products/:id/images/reorder', adminAuth, (req, res) => {
  try {
    const { image_ids } = req.body;
    if (!Array.isArray(image_ids)) {
      return res.status(400).json({ error: 'image_ids array is required' });
    }

    image_ids.forEach((id, index) => {
      db.prepare('UPDATE product_images SET sort_order = ? WHERE id = ? AND product_id = ?')
        .run(index, id, req.params.id);
    });

    cache.invalidatePrefix('products:');
    res.json({ success: true });
  } catch (err) {
    console.error('Error reordering images:', err);
    res.status(500).json({ error: 'Failed to reorder images' });
  }
});

// DELETE /api/admin/products/:id/images/:imageId - Delete an image
router.delete('/products/:id/images/:imageId', adminAuth, (req, res) => {
  try {
    const result = db.prepare('DELETE FROM product_images WHERE id = ? AND product_id = ?')
      .run(req.params.imageId, req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Image not found' });
    }
    cache.invalidatePrefix('products:');
    res.json({ success: true, message: 'Image deleted' });
  } catch (err) {
    console.error('Error deleting product image:', err);
    res.status(500).json({ error: 'Failed to delete product image' });
  }
});

// ========== Featured Products Management (Admin only) ==========

// GET /api/admin/featured - List featured products in order
router.get('/featured', adminAuth, (req, res) => {
  try {
    const products = db.prepare(`
      SELECT p.*, c.name as category_name, c.slug as category_slug,
             b.id as brand_id, b.name as brand_name, b.slug as brand_slug, b.icon_url as brand_icon_url
      FROM products p
      JOIN categories c ON p.category_id = c.id
      LEFT JOIN brands b ON p.brand_id = b.id
      WHERE p.featured = 1
      ORDER BY p.featured_order ASC, p.created_at DESC
    `).all();
    res.json(products);
  } catch (err) {
    console.error('Error fetching featured products:', err);
    res.status(500).json({ error: 'Failed to fetch featured products' });
  }
});

// PUT /api/admin/products/:id/feature - Toggle featured status and set order
router.put('/products/:id/feature', adminAuth, (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const featured = req.body.featured !== undefined ? (req.body.featured ? 1 : 0) : existing.featured;
    let featured_order = existing.featured_order;

    if (featured) {
      // If featuring, set order to next available
      if (req.body.featured_order !== undefined) {
        featured_order = parseInt(req.body.featured_order);
      } else if (!existing.featured) {
        const maxOrder = db.prepare('SELECT COALESCE(MAX(featured_order), 0) + 1 as next_order FROM products WHERE featured = 1').get();
        featured_order = maxOrder ? maxOrder.next_order : 1;
      }
    } else {
      featured_order = 0;
    }

    db.prepare('UPDATE products SET featured = ?, featured_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(featured, featured_order, req.params.id);

    const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    cache.invalidatePrefix('products:');
    res.json(updated);
  } catch (err) {
    console.error('Error toggling featured status:', err);
    res.status(500).json({ error: 'Failed to update featured status' });
  }
});

// PUT /api/admin/products/featured/reorder - Reorder featured products
router.put('/featured/reorder', adminAuth, (req, res) => {
  try {
    const { product_ids } = req.body;
    if (!Array.isArray(product_ids)) {
      return res.status(400).json({ error: 'product_ids array is required' });
    }

    product_ids.forEach((id, index) => {
      db.prepare('UPDATE products SET featured_order = ? WHERE id = ? AND featured = 1')
        .run(index, id);
    });

    cache.invalidatePrefix('products:');
    res.json({ success: true });
  } catch (err) {
    console.error('Error reordering featured products:', err);
    res.status(500).json({ error: 'Failed to reorder featured products' });
  }
});

// ========== Welcome Slides Management (Admin only) ==========

// GET /api/admin/welcome-slides - List all welcome slides
router.get('/welcome-slides', adminAuth, (req, res) => {
  try {
    const slides = db.prepare(`
      SELECT ws.*, p.name as product_name, p.image_url as product_image, p.price as product_price
      FROM welcome_slides ws
      LEFT JOIN products p ON ws.product_id = p.id
      ORDER BY ws.sort_order ASC, ws.created_at DESC
    `).all();
    res.json(slides);
  } catch (err) {
    console.error('Error fetching welcome slides:', err);
    res.status(500).json({ error: 'Failed to fetch welcome slides' });
  }
});

// POST /api/admin/welcome-slides - Create a new welcome slide
router.post('/welcome-slides', adminAuth, (req, res) => {
  try {
    const { title, subtitle, description, image_url, product_id, cta_text, cta_link, title_color, subtitle_color, desc_color, overlay_opacity } = req.body;

    if (!title || !image_url) {
      return res.status(400).json({ error: 'Title and image are required' });
    }

    const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), 0) + 1 as next_order FROM welcome_slides').get();
    const sort_order = maxOrder ? maxOrder.next_order : 0;
    const title_ar = String(req.body.title_ar || '').trim();
    const subtitle_ar = String(req.body.subtitle_ar || '').trim();

    const result = db.prepare(`
      INSERT INTO welcome_slides (title, title_ar, subtitle, subtitle_ar, description, image_url, product_id, cta_text, cta_link, title_color, subtitle_color, desc_color, overlay_opacity, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      title,
      title_ar,
      subtitle || '',
      subtitle_ar,
      description || '',
      image_url,
      product_id || null,
      cta_text || 'View Product',
      cta_link || '',
      title_color || '#ffffff',
      subtitle_color || '#ffffff',
      desc_color || '#ffffff',
      overlay_opacity !== undefined ? overlay_opacity : 0.4,
      sort_order
    );

    const slide = db.prepare('SELECT * FROM welcome_slides WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(slide);
  } catch (err) {
    console.error('Error creating welcome slide:', err);
    res.status(500).json({ error: 'Failed to create welcome slide' });
  }
});

// PUT /api/admin/welcome-slides/reorder - Reorder welcome slides
// NOTE: This MUST be before /:id routes to avoid being caught as a parameter
router.put('/welcome-slides/reorder', adminAuth, (req, res) => {
  try {
    const { slide_ids } = req.body;
    if (!Array.isArray(slide_ids)) {
      return res.status(400).json({ error: 'slide_ids array is required' });
    }

    slide_ids.forEach((id, index) => {
      db.prepare('UPDATE welcome_slides SET sort_order = ? WHERE id = ?')
        .run(index, id);
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Error reordering welcome slides:', err);
    res.status(500).json({ error: 'Failed to reorder welcome slides' });
  }
});

// PUT /api/admin/welcome-slides/:id - Update a welcome slide
router.put('/welcome-slides/:id', adminAuth, (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM welcome_slides WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Welcome slide not found' });
    }

    const { title, subtitle, description, image_url, product_id, cta_text, cta_link, title_color, subtitle_color, desc_color, overlay_opacity, is_active, sort_order } = req.body;
    const title_ar = req.body.title_ar !== undefined ? String(req.body.title_ar).trim() : (existing.title_ar || '');
    const subtitle_ar = req.body.subtitle_ar !== undefined ? String(req.body.subtitle_ar).trim() : (existing.subtitle_ar || '');

    db.prepare(`
      UPDATE welcome_slides
      SET title = ?, title_ar = ?, subtitle = ?, subtitle_ar = ?, description = ?, image_url = ?, product_id = ?,
          cta_text = ?, cta_link = ?, title_color = ?, subtitle_color = ?, desc_color = ?,
          overlay_opacity = ?, is_active = ?, sort_order = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      title !== undefined ? title : existing.title,
      title_ar,
      subtitle !== undefined ? subtitle : existing.subtitle,
      subtitle_ar,
      description !== undefined ? description : existing.description,
      image_url !== undefined ? image_url : existing.image_url,
      product_id !== undefined ? product_id : existing.product_id,
      cta_text !== undefined ? cta_text : existing.cta_text,
      cta_link !== undefined ? cta_link : existing.cta_link,
      title_color !== undefined ? title_color : existing.title_color,
      subtitle_color !== undefined ? subtitle_color : existing.subtitle_color,
      desc_color !== undefined ? desc_color : existing.desc_color,
      overlay_opacity !== undefined ? overlay_opacity : existing.overlay_opacity,
      is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active,
      sort_order !== undefined ? sort_order : existing.sort_order,
      req.params.id
    );

    const updated = db.prepare('SELECT * FROM welcome_slides WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    console.error('Error updating welcome slide:', err);
    res.status(500).json({ error: 'Failed to update welcome slide' });
  }
});

// DELETE /api/admin/welcome-slides/:id - Delete a welcome slide
router.delete('/welcome-slides/:id', adminAuth, (req, res) => {
  try {
    const result = db.prepare('DELETE FROM welcome_slides WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Welcome slide not found' });
    }
    res.json({ success: true, message: 'Welcome slide deleted' });
  } catch (err) {
    console.error('Error deleting welcome slide:', err);
    res.status(500).json({ error: 'Failed to delete welcome slide' });
  }
});

// ========== Category Management (Admin only) ==========

// GET /api/admin/categories - List categories for admin
router.get('/categories', adminAuth, (req, res) => {
  try {
    const categories = db.prepare(`
      SELECT c.*, COUNT(p.id) as product_count
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id
      GROUP BY c.id
      ORDER BY c.name
    `).all();
    res.json(categories);
  } catch (err) {
    console.error('Error fetching categories:', err);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// POST /api/admin/categories - Create a new category
router.post('/categories', adminAuth, (req, res) => {
  try {
    const { name, icon } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Category name is required' });
    }
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const result = db.prepare('INSERT INTO categories (name, slug, icon) VALUES (?, ?, ?)').run(name, slug, icon || '');
    const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(category);
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'Category already exists' });
    }
    console.error('Error creating category:', err);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// PUT /api/admin/categories/:id - Update a category (name and/or icon)
router.put('/categories/:id', adminAuth, (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Category not found' });
    }
    const { name, icon } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Category name is required' });
    }
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const name_ar = req.body.name_ar !== undefined ? String(req.body.name_ar).trim() : (existing.name_ar || '');
    db.prepare('UPDATE categories SET name = ?, name_ar = ?, slug = ?, icon = ? WHERE id = ?').run(name.trim(), name_ar, slug, icon !== undefined ? icon : (existing.icon || ''), req.params.id);
    const updated = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
    cache.invalidatePrefix('products:');
    res.json(updated);
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'Category name already exists' });
    }
    console.error('Error updating category:', err);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

// DELETE /api/admin/categories/:id - Delete a category
// Products in this category will be reassigned to the default category (id=1).
// The default category itself cannot be deleted.
router.delete('/categories/:id', adminAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);

    if (id === 1) {
      return res.status(400).json({ error: 'Cannot delete the default category' });
    }

    const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Reassign products from this category to the default category (id=1)
    db.prepare('UPDATE products SET category_id = 1 WHERE category_id = ?').run(id);

    // Delete the category
    db.prepare('DELETE FROM categories WHERE id = ?').run(id);

    cache.invalidatePrefix('products:'); // invalidate product cache
    res.json({ success: true, message: `Category "${category.name}" deleted. Products reassigned to default.` });
  } catch (err) {
    console.error('Error deleting category:', err);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

// ========== Brand Management (Admin only) ==========

// GET /api/admin/brands - List all brands
router.get('/brands', adminAuth, (req, res) => {
  try {
    const brands = db.prepare(`
      SELECT b.*, COUNT(p.id) as product_count
      FROM brands b
      LEFT JOIN products p ON p.brand_id = b.id
      GROUP BY b.id
      ORDER BY b.name
    `).all();
    res.json(brands);
  } catch (err) {
    console.error('Error fetching brands:', err);
    res.status(500).json({ error: 'Failed to fetch brands' });
  }
});

// POST /api/admin/brands - Create a new brand
router.post('/brands', adminAuth, (req, res) => {
  try {
    const { name, icon_url } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Brand name is required' });
    }
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const result = db.prepare('INSERT INTO brands (name, slug, icon_url) VALUES (?, ?, ?)').run(name.trim(), slug, icon_url || '');
    const brand = db.prepare('SELECT * FROM brands WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(brand);
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'Brand already exists' });
    }
    console.error('Error creating brand:', err);
    res.status(500).json({ error: 'Failed to create brand' });
  }
});

// PUT /api/admin/brands/:id - Update a brand
router.put('/brands/:id', adminAuth, (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM brands WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Brand not found' });
    }
    const name = req.body.name !== undefined ? req.body.name.trim() : existing.name;
    const icon_url = req.body.icon_url !== undefined ? req.body.icon_url : existing.icon_url;
    const name_ar = req.body.name_ar !== undefined ? String(req.body.name_ar).trim() : (existing.name_ar || '');
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    db.prepare('UPDATE brands SET name = ?, name_ar = ?, slug = ?, icon_url = ? WHERE id = ?').run(name, name_ar, slug, icon_url, req.params.id);
    const updated = db.prepare('SELECT * FROM brands WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'Brand name already exists' });
    }
    console.error('Error updating brand:', err);
    res.status(500).json({ error: 'Failed to update brand' });
  }
});

// DELETE /api/admin/brands/:id - Delete a brand (products lose brand association)
router.delete('/brands/:id', adminAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const brand = db.prepare('SELECT * FROM brands WHERE id = ?').get(id);
    if (!brand) {
      return res.status(404).json({ error: 'Brand not found' });
    }
    // Remove brand references from products
    db.prepare('UPDATE products SET brand_id = NULL WHERE brand_id = ?').run(id);
    db.prepare('DELETE FROM brands WHERE id = ?').run(id);
    res.json({ success: true, message: `Brand "${brand.name}" deleted.` });
  } catch (err) {
    console.error('Error deleting brand:', err);
    res.status(500).json({ error: 'Failed to delete brand' });
  }
});

// ========== Order Management (Admin only) ==========

// GET /api/admin/orders - List all orders with customer info
router.get('/orders', adminAuth, (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;

    let sql = `
      SELECT o.*, c.email as customer_email, c.name as customer_name
      FROM orders o
      JOIN customers c ON o.customer_id = c.id
    `;
    const params = [];

    if (status) {
      sql += ' WHERE o.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY o.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const orders = db.prepare(sql).all(...params);

    // Parse items JSON for each order
    orders.forEach(order => {
      try {
        order.items = JSON.parse(order.items || '[]');
      } catch {
        order.items = [];
      }
    });

    // Get total count
    const countSql = status
      ? "SELECT COUNT(*) as count FROM orders WHERE status = ?"
      : "SELECT COUNT(*) as count FROM orders";
    const countResult = status
      ? db.prepare(countSql).get(status)
      : db.prepare(countSql).get();

    res.json({ orders, total: countResult.count });
  } catch (err) {
    console.error('Error fetching orders:', err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// GET /api/admin/orders/stats - Sales statistics
router.get('/orders/stats', adminAuth, (req, res) => {
  try {
    // Total revenue from paid orders
    const revenueResult = db.prepare(`
      SELECT COALESCE(SUM(total), 0) as total_revenue,
             COUNT(*) as total_orders
      FROM orders WHERE status = 'paid'
    `).get();

    // Pending orders count
    const pendingResult = db.prepare(`
      SELECT COUNT(*) as count FROM orders WHERE status = 'pending'
    `).get();

    // Today's sales
    const todayResult = db.prepare(`
      SELECT COALESCE(SUM(total), 0) as today_revenue,
             COUNT(*) as today_orders
      FROM orders
      WHERE status = 'paid' AND date(created_at) = date('now')
    `).get();

    // Average order value
    const avgResult = db.prepare(`
      SELECT COALESCE(AVG(total), 0) as avg_order_value
      FROM orders WHERE status = 'paid'
    `).get();

    // Revenue by month (last 6 months)
    const monthlyResult = db.prepare(`
      SELECT strftime('%Y-%m', created_at) as month,
             COUNT(*) as order_count,
             COALESCE(SUM(total), 0) as revenue
      FROM orders WHERE status = 'paid'
      GROUP BY month
      ORDER BY month DESC LIMIT 6
    `).all();

    // Orders by status
    const statusResult = db.prepare(`
      SELECT status, COUNT(*) as count
      FROM orders GROUP BY status
    `).all();

    res.json({
      totalRevenue: revenueResult.total_revenue,
      totalOrders: revenueResult.total_orders,
      pendingOrders: pendingResult.count,
      todayRevenue: todayResult.today_revenue,
      todayOrders: todayResult.today_orders,
      avgOrderValue: avgResult.avg_order_value,
      monthlyRevenue: monthlyResult,
      ordersByStatus: statusResult
    });
  } catch (err) {
    console.error('Error fetching order stats:', err);
    res.status(500).json({ error: 'Failed to fetch order stats' });
  }
});

// GET /api/admin/orders/statuses - Configured order statuses + transition map
router.get('/orders/statuses', adminAuth, (req, res) => {
  try {
    const workflow = require('../services/orderWorkflowService');
    res.json({
      flowEnabled: workflow.flowEnabled(),
      statuses: workflow.validStatuses(),
      transitions: workflow.transitionMap(),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch order statuses' });
  }
});

// GET /api/admin/orders/:id/timeline - Event timeline for an order (audit/confirmation log)
router.get('/orders/:id/timeline', adminAuth, (req, res) => {
  try {
    const timeline = eventService.getTimeline('order', parseInt(req.params.id), { limit: 100 });
    res.json(timeline);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch order timeline' });
  }
});

// PUT /api/admin/orders/:id/status - Update order status (workflow-validated)
// RBAC-gated: only a user with orders.update may force a status transition (the
// previous guard was adminAuth-only, letting ANY authenticated role mutate
// order/payment state). Server re-validates the transition via the workflow.
router.put('/orders/:id/status', adminAuth, requirePermission('orders.update'), (req, res) => {
  try {
    const validation = validateOrderStatus(req.body);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.errors.join('; ') });
    }
    const { status } = validation.data;

    const workflow = require('../services/orderWorkflowService');
    const updated = workflow.transitionOrder(parseInt(req.params.id), status, {
      userId: req.session.username || 'admin',
      reason: req.body.reason || '',
    });

    if (updated) {
      try { updated.items = JSON.parse(updated.items || '[]'); } catch { updated.items = []; }
    }

    res.json(updated);
  } catch (err) {
    console.error('Error updating order status:', err);
    if (err.message.includes('Invalid transition') || err.message.includes('not found')) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// POST /api/admin/orders/:id/refund - Record a refund (workflow + event + notification)
router.post('/orders/:id/refund', adminAuth, (req, res) => {
  try {
    const workflow = require('../services/orderWorkflowService');
    const { amount, reason } = req.body || {};

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (!['paid', 'shipped', 'delivered', 'completed'].includes(order.status)) {
      return res.status(400).json({ error: `Order cannot be refunded from status "${order.status}"` });
    }

    const refundAmount = amount !== undefined ? Math.round(Number(amount)) : (order.total || 0);
    const updated = workflow.transitionOrder(order.id, 'refunded', {
      userId: req.session.username || 'admin',
      reason: reason ? `refund: ${reason}` : `refund of ${refundAmount}`,
    });

    // record the refund amount on the order
    db.prepare("UPDATE orders SET refund_amount = ?, refunded_at = CURRENT_TIMESTAMP, status_reason = ? WHERE id = ?")
      .run(refundAmount, reason || '', order.id);

    eventService.emit(eventService.EVENT_TYPES.ORDER_REFUNDED, eventService.ENTITY_TYPES.ORDER, order.id, {
      userId: req.session.username || 'admin',
      userRole: 'admin',
      payload: { amount: refundAmount, reason: reason || '' },
    });

    res.json({ ...db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id), refund_amount: refundAmount });
  } catch (err) {
    console.error('Error refunding order:', err);
    if (err.message.includes('Invalid transition') || err.message.includes('cannot be refunded')) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Failed to refund order' });
  }
});

// ========== Supplier-Product Links (Admin only) ==========

// POST /api/admin/products/:id/suppliers - Assign supplier to product
router.post('/products/:id/suppliers', adminAuth, (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    const { supplier_id, supplier_sku, unit_cost, is_preferred, lead_time_days } = req.body;

    if (!supplier_id) {
      return res.status(400).json({ error: 'supplier_id is required' });
    }

    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(supplier_id);
    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    const existing = db.prepare('SELECT * FROM product_suppliers WHERE product_id = ? AND supplier_id = ?').get(productId, supplier_id);
    if (existing) {
      return res.status(400).json({ error: 'Supplier is already assigned to this product' });
    }

    const result = db.prepare(`
      INSERT INTO product_suppliers (product_id, supplier_id, supplier_sku, unit_cost, is_preferred, lead_time_days)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      productId,
      supplier_id,
      supplier_sku || '',
      unit_cost || 0,
      is_preferred ? 1 : 0,
      lead_time_days || 0
    );

    const link = db.prepare('SELECT * FROM product_suppliers WHERE id = ?').get(result.lastInsertRowid);

    eventService.emit(eventService.EVENT_TYPES.SUPPLIER_PRODUCT_LINKED, eventService.ENTITY_TYPES.SUPPLIER, supplier_id, {
      userId: req.session.username || 'admin',
      userRole: 'admin',
      payload: { product_id: productId, supplier_id, supplier_sku: link.supplier_sku },
    });

    res.status(201).json(link);
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'Supplier is already assigned to this product' });
    }
    console.error('Error assigning supplier to product:', err);
    res.status(500).json({ error: 'Failed to assign supplier to product' });
  }
});

// DELETE /api/admin/products/:id/suppliers/:supplierId - Remove supplier from product
router.delete('/products/:id/suppliers/:supplierId', adminAuth, (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    const supplierId = parseInt(req.params.supplierId);

    const link = db.prepare('SELECT * FROM product_suppliers WHERE product_id = ? AND supplier_id = ?').get(productId, supplierId);
    if (!link) {
      return res.status(404).json({ error: 'Product-supplier link not found' });
    }

    db.prepare('DELETE FROM product_suppliers WHERE product_id = ? AND supplier_id = ?').run(productId, supplierId);

    eventService.emit(eventService.EVENT_TYPES.SUPPLIER_PRODUCT_UNLINKED, eventService.ENTITY_TYPES.SUPPLIER, supplierId, {
      userId: req.session.username || 'admin',
      userRole: 'admin',
      payload: { product_id: productId, supplier_id: supplierId },
    });

    res.json({ success: true, message: 'Supplier removed from product' });
  } catch (err) {
    console.error('Error removing supplier from product:', err);
    res.status(500).json({ error: 'Failed to remove supplier from product' });
  }
});

router.get('/overview', adminAuth, (req, res) => {
  const svc = require('../services/overviewService');
  res.json(svc.getOverviewAggregation({startDate: req.query.start || '2026-01-01', endDate: req.query.end || new Date().toISOString().slice(0,10), userRole: req.user?.role}));
});

module.exports = router;
