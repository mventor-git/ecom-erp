/**
 * Fake demo-catalog seed script
 * 
 * Generates sample products with:
 * - SVG placeholder images (no external files needed)
 * - Size variants (Small, Medium, Large)
 * - Color variants (Red, Blue, Green, etc.)
 * - Realistic prices and stock levels
 * 
 * Usage: node seed-fake-data.js
 */

require('dotenv').config();
const path = require('path');
const fs = require('fs');
const db = require('./db');

const IMAGES_DIR = path.join(__dirname, 'public', 'images', 'products');

// ─── Categories ──────────────────────────────────────────────────────────────

const CATEGORIES = [
  { name: 'Electronics', slug: 'electronics' },
  { name: 'Home & Kitchen', slug: 'home-kitchen' },
  { name: 'Fashion', slug: 'fashion' },
  { name: 'Grocery', slug: 'grocery' },
  { name: 'Beauty & Care', slug: 'beauty-care' },
];

// ─── Brands ──────────────────────────────────────────────────────────────────

const BRANDS = [
  { name: 'Demo', slug: 'demo' },
  { name: 'Generic', slug: 'generic' },
];

// ─── Color Palette ───────────────────────────────────────────────────────────

const COLORS = {
  'Red': '#ef4444',
  'Blue': '#3b82f6',
  'Green': '#22c55e',
  'Black': '#111111',
  'White': '#ffffff',
  'Gray': '#9ca3af',
  'Orange': '#f97316',
  'Purple': '#a855f7',
  'Pink': '#ec4899',
  'Yellow': '#eab308',
};

// ─── Product Templates ───────────────────────────────────────────────────────

const PRODUCTS = [
  // Electronics
  {
    name: 'Bluetooth Speaker',
    description: 'Portable Bluetooth speaker with deep bass and 12-hour battery life.',
    category: 'electronics',
    price: 45000, // 450 EGP
    stock: 50,
    variants: {
      colors: ['Black', 'Blue', 'Gray'],
    },
    featured: true,
  },
  {
    name: 'Wireless Earbuds',
    description: 'True wireless earbuds with charging case and touch controls.',
    category: 'electronics',
    price: 28000,
    stock: 80,
    variants: {
      colors: ['White', 'Black'],
    },
  },
  {
    name: 'Power Bank 20000',
    description: '20000mAh fast-charging power bank with dual USB ports.',
    category: 'electronics',
    price: 35000,
    stock: 60,
    variants: {
      colors: ['Black', 'White'],
    },
  },

  // Home & Kitchen
  {
    name: 'Ceramic Mug Set',
    description: 'Set of 4 glazed ceramic mugs, 350ml each.',
    category: 'home-kitchen',
    price: 15000,
    stock: 100,
    variants: {
      colors: ['White', 'Blue', 'Green'],
    },
  },
  {
    name: 'Stand Mixer',
    description: '5L stand mixer with 3 attachments and 6 speeds.',
    category: 'home-kitchen',
    price: 125000,
    stock: 30,
    variants: {
      colors: ['Red', 'Black', 'Gray'],
    },
    featured: true,
  },
  {
    name: 'Table Lamp',
    description: 'LED table lamp with 3 brightness levels and USB port.',
    category: 'home-kitchen',
    price: 22000,
    stock: 90,
    variants: {
      colors: ['White', 'Black'],
    },
  },
  {
    name: 'Electric Kettle',
    description: '1.7L stainless electric kettle with auto shut-off.',
    category: 'home-kitchen',
    price: 38000,
    stock: 55,
    variants: {
      colors: ['Black', 'Gray'],
    },
  },

  // Fashion
  {
    name: 'Cotton T-Shirt',
    description: '100% cotton crew-neck t-shirt, pre-shrunk.',
    category: 'fashion',
    price: 12000,
    stock: 200,
    variants: {
      colors: ['White', 'Black', 'Blue', 'Red'],
      sizes: ['Small', 'Medium', 'Large', 'X-Large'],
    },
  },
  {
    name: 'Denim Tote Bag',
    description: 'Heavy-duty denim tote with inner pocket.',
    category: 'fashion',
    price: 25000,
    stock: 70,
    variants: {
      colors: ['Blue', 'Black'],
    },
    featured: true,
  },
  {
    name: 'Canvas Sneakers',
    description: 'Classic canvas sneakers with rubber sole.',
    category: 'fashion',
    price: 55000,
    stock: 40,
    variants: {
      colors: ['White', 'Black', 'Red'],
      sizes: ['40', '41', '42', '43', '44'],
    },
  },

  // Grocery
  {
    name: 'Arabica Coffee Beans',
    description: 'Medium-roast Arabica coffee beans, 1kg bag.',
    category: 'grocery',
    price: 42000,
    stock: 65,
  },
  {
    name: 'Organic Honey',
    description: 'Raw organic honey, 500g jar.',
    category: 'grocery',
    price: 18000,
    stock: 120,
  },

  // Beauty & Care
  {
    name: 'Shea Body Lotion',
    description: 'Shea butter body lotion, 400ml pump bottle.',
    category: 'beauty-care',
    price: 25000,
    stock: 85,
  },
  {
    name: 'Herbal Shampoo',
    description: 'Herbal shampoo for all hair types, 500ml.',
    category: 'beauty-care',
    price: 14000,
    stock: 110,
  },
];

// ─── Generate SVG Image ──────────────────────────────────────────────────────

function generateSVGImage(productName, color = '#3b82f6') {
  const initials = productName
    .split(' ')
    .map(word => word[0])
    .join('')
    .substring(0, 3)
    .toUpperCase();

  return `<svg width="400" height="400" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${color};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${adjustColor(color, -30)};stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="400" height="400" fill="url(#grad)"/>
  <text x="200" y="200" font-family="Arial, sans-serif" font-size="80" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle">${initials}</text>
  <text x="200" y="280" font-family="Arial, sans-serif" font-size="20" fill="white" text-anchor="middle" opacity="0.9">${truncate(productName, 30)}</text>
</svg>`;
}

function adjustColor(hex, amount) {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, Math.min(255, (num >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amount));
  const b = Math.max(0, Math.min(255, (num & 0x0000FF) + amount));
  return '#' + (0x1000000 + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function truncate(str, maxLength) {
  return str.length > maxLength ? str.substring(0, maxLength - 3) + '...' : str;
}

// ─── Save SVG Image ──────────────────────────────────────────────────────────

function saveSVGImage(productName, color = '#3b82f6', variantLabel = '') {
  if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
  }

  const slug = productName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 80);

  const variantSlug = variantLabel
    ? '-' + variantLabel.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-')
    : '';

  const filename = `${slug}${variantSlug}.svg`;
  const filepath = path.join(IMAGES_DIR, filename);
  const svgContent = generateSVGImage(productName, color, variantLabel);

  fs.writeFileSync(filepath, svgContent);

  return `/images/products/${filename}`;
}

// ─── Generate Variants ───────────────────────────────────────────────────────

function generateVariants(product) {
  const variants = [];

  if (!product.variants) return variants;

  const colors = product.variants.colors || [null];
  const sizes = product.variants.sizes || [null];

  for (const color of colors) {
    for (const size of sizes) {
      const variant = {
        name: color || 'Default',
        hex: color ? COLORS[color] || '#6b7280' : '#6b7280',
      };

      if (size) {
        variant.size = size;
        variant.name = color ? `${color} - ${size}` : size;
      }

      // Distribute stock across variants
      variant.stock = Math.floor(product.stock / (colors.length * sizes.length));

      variants.push(variant);
    }
  }

  return variants;
}

// ─── Seed Database ───────────────────────────────────────────────────────────

async function seedFakeData() {
  try {
    await db.initPromise;
    console.log('🌱  Seeding fake demo catalog...\n');

    // ── 1. Clear existing data ──
    console.log('🧹  Clearing existing data...');
    db.run('DELETE FROM product_images');
    db.run('DELETE FROM inventory_movements');
    db.run('DELETE FROM inventory');
    db.run('DELETE FROM product_variants');
    db.run('DELETE FROM products');
    db.run('DELETE FROM categories');
    db.run('DELETE FROM brands');
    db.run("DELETE FROM sqlite_sequence WHERE name IN ('products', 'categories', 'brands', 'product_images', 'inventory', 'inventory_movements', 'product_variants')");
    db.saveDb();
    console.log('✅  Database cleared\n');

    // ── 2. Insert categories ──
    console.log('📁  Creating categories...');
    for (const cat of CATEGORIES) {
      db.run('INSERT INTO categories (name, slug) VALUES (?, ?)', [cat.name, cat.slug]);
      console.log(`  ✅  ${cat.name}`);
    }

    // ── 3. Insert brands ──
    console.log('\n🏷️  Creating brands...');
    for (const brand of BRANDS) {
      db.run('INSERT INTO brands (name, slug) VALUES (?, ?)', [brand.name, brand.slug]);
      console.log(`  ✅  ${brand.name}`);
    }

    // ── 4. Get category and brand IDs ──
    const categories = db.prepare('SELECT id, slug FROM categories').all();
    const catMap = {};
    categories.forEach(c => { catMap[c.slug] = c.id; });

    const brands = db.prepare('SELECT id, slug FROM brands').all();
    const brandMap = {};
    brands.forEach(b => { brandMap[b.slug] = b.id; });

    // ── 5. Insert products with variants ──
    console.log('\n📦  Inserting products with variants...\n');
    let inserted = 0;

    for (const product of PRODUCTS) {
      const categoryId = catMap[product.category];
      const brandId = brandMap['demo']; // Use Demo brand

      if (!categoryId) {
        console.log(`  ⚠️  Skipped: "${product.name}" — unknown category`);
        continue;
      }

      // Generate SVG image
      const primaryColor = product.variants?.colors?.[0];
      const colorHex = primaryColor ? COLORS[primaryColor] || '#3b82f6' : '#3b82f6';
      const imageUrl = saveSVGImage(product.name, colorHex);

      // Generate variants
      const variants = generateVariants(product);
      const colorsJson = JSON.stringify(variants);

      // Insert product
      const insertResult = db.run(`
        INSERT INTO products (
          name, description, price, category_id, brand_id, stock, 
          image_url, colors, active, featured, featured_order,
          cost_price, min_stock, max_stock, reorder_point
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?)
      `, [
        product.name,
        product.description,
        product.price,
        categoryId,
        brandId,
        product.stock,
        imageUrl,
        colorsJson,
        product.featured ? 1 : 0,
        product.featured ? inserted + 1 : 0,
        Math.round(product.price * 0.6), // Cost price = 60% of retail
        Math.round(product.stock * 0.2), // Min stock = 20% of total
        product.stock * 2, // Max stock = 2x total
        Math.round(product.stock * 0.3), // Reorder point = 30% of total
      ]);

      const productId = insertResult.lastInsertRowid;

      // Insert product variants (for SKU/barcode tracking)
      if (variants.length > 0) {
        for (let i = 0; i < variants.length; i++) {
          const variant = variants[i];
          const sku = ` EE-${product.name.substring(0, 3).toUpperCase()}-${i + 1}`;
          const barcode = `600000000${productId}${i}`;

          db.run(`
            INSERT INTO product_variants (
              product_id, sku, barcode, attributes, is_active
            ) VALUES (?, ?, ?, ?, 1)
          `, [
            productId,
            sku,
            barcode,
            JSON.stringify({ color: variant.name, size: variant.size || null }),
          ]);
        }
      }

      // Insert inventory record
      const defaultWarehouseId = 1; // Main Warehouse
      db.run(`
        INSERT INTO inventory (
          product_id, warehouse_id, qty_on_hand, qty_reserved,
          min_stock, max_stock, reorder_point
        ) VALUES (?, ?, ?, 0, ?, ?, ?)
      `, [
        productId,
        defaultWarehouseId,
        product.stock,
        Math.round(product.stock * 0.2),
        product.stock * 2,
        Math.round(product.stock * 0.3),
      ]);

      // Create opening_balance movement
      db.run(`
        INSERT INTO inventory_movements (
          product_id, warehouse_id, type, reason, qty_change,
          qty_before, qty_after, note, created_by
        ) VALUES (?, ?, 'opening_balance', 'Initial stock', ?, 0, ?, 'Demo seed', 'system')
      `, [productId, defaultWarehouseId, product.stock, product.stock]);

      const priceEg = (product.price / 100).toFixed(2);
      const variantCount = variants.length;
      const variantInfo = variantCount > 0 ? ` [${variantCount} variants]` : '';
      console.log(`  ✅  #${productId}: ${product.name} — ${priceEg} EGP${variantInfo}`);

      inserted++;
    }

    // ── 6. Summary ──
    console.log(`\n📊  Summary:`);
    console.log(`   Products: ${inserted}`);
    console.log(`   Categories: ${CATEGORIES.length}`);
    console.log(`   Brands: ${BRANDS.length}`);

    // ── 7. Verify ──
    const count = db.prepare('SELECT COUNT(*) as cnt FROM products').get();
    const catCount = db.prepare('SELECT COUNT(*) as cnt FROM categories').get();
    const variantCount = db.prepare('SELECT COUNT(*) as cnt FROM product_variants').get();
    const inventoryCount = db.prepare('SELECT COUNT(*) as cnt FROM inventory').get();

    console.log(`\n🔍  Verification:`);
    console.log(`   Products: ${count.cnt}`);
    console.log(`   Categories: ${catCount.cnt}`);
    console.log(`   Variants: ${variantCount.cnt}`);
    console.log(`   Inventory Records: ${inventoryCount.cnt}`);

    // ── 8. Products by category ──
    console.log('\n📋  Products by Category:');
    const byCategory = db.prepare(`
      SELECT c.name, COUNT(p.id) as cnt 
      FROM categories c 
      LEFT JOIN products p ON p.category_id = c.id 
      GROUP BY c.id 
      ORDER BY c.name
    `).all();
    for (const row of byCategory) {
      console.log(`   ${row.name}: ${row.cnt} products`);
    }

    // ── 9. Featured products ──
    console.log('\n⭐  Featured Products:');
    const featured = db.prepare(`
      SELECT name, price FROM products WHERE featured = 1 ORDER BY featured_order
    `).all();
    for (const row of featured) {
      console.log(`   ${row.name} — ${(row.price / 100).toFixed(2)} EGP`);
    }

    db.saveDb();
    console.log('\n💾  Database saved successfully!');
    console.log(`\n🎨  Generated ${inserted} SVG images in: ${IMAGES_DIR}`);

    process.exit(0);
  } catch (err) {
    console.error('❌  Seed failed:', err);
    console.error(err.stack);
    process.exit(1);
  }
}

seedFakeData();
