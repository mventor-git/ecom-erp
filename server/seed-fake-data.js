/**
 * Fake Data Seed Script for Comfort-Sign
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
  { name: 'Exercise & Fitness', slug: 'exercise-fitness' },
  { name: 'Orthopedic Support', slug: 'orthopedic-support' },
  { name: 'Insoles & Foot Care', slug: 'insoles-foot-care' },
  { name: 'Massage & Therapy', slug: 'massage-therapy' },
  { name: 'Mobility & Rehabilitation', slug: 'mobility-rehabilitation' },
  { name: 'Accessories', slug: 'accessories' },
];

// ─── Brands ──────────────────────────────────────────────────────────────────

const BRANDS = [
  { name: 'Comfort-Sign', slug: 'comfort-sign' },
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
  // Exercise & Fitness
  {
    name: 'Professional Yoga Mat',
    description: 'High-density non-slip yoga mat for comfortable practice. Perfect for yoga, pilates, and floor exercises.',
    category: 'exercise-fitness',
    price: 45000, // 450 EGP
    stock: 50,
    variants: {
      colors: ['Red', 'Blue', 'Purple', 'Black'],
      sizes: ['Small', 'Medium', 'Large'],
    },
    featured: true,
  },
  {
    name: 'Resistance Bands Set',
    description: 'Set of 5 resistance bands with different tension levels. Ideal for strength training and physical therapy.',
    category: 'exercise-fitness',
    price: 35000,
    stock: 75,
    variants: {
      colors: ['Red', 'Blue', 'Green', 'Orange', 'Purple'],
    },
    featured: true,
  },
  {
    name: 'Adjustable Dumbbells',
    description: 'Pair of adjustable dumbbells (2-20 kg). Compact design for home gym workouts.',
    category: 'exercise-fitness',
    price: 125000,
    stock: 30,
    variants: {
      colors: ['Black', 'Gray'],
    },
  },
  {
    name: 'Exercise Ball',
    description: 'Anti-burst exercise ball for core training and stability exercises.',
    category: 'exercise-fitness',
    price: 28000,
    stock: 60,
    variants: {
      colors: ['Blue', 'Purple', 'Pink'],
      sizes: ['Small (55cm)', 'Medium (65cm)', 'Large (75cm)'],
    },
  },
  {
    name: 'Jump Rope Professional',
    description: 'Speed jump rope with ball bearings. Adjustable length for all heights.',
    category: 'exercise-fitness',
    price: 15000,
    stock: 100,
    variants: {
      colors: ['Black', 'Red', 'Blue'],
    },
  },

  // Orthopedic Support
  {
    name: 'Knee Support Brace',
    description: 'Elastic knee support with patella stabilizer. Provides compression and support during activities.',
    category: 'orthopedic-support',
    price: 32000,
    stock: 80,
    variants: {
      colors: ['Black', 'Gray'],
      sizes: ['Small', 'Medium', 'Large', 'X-Large'],
    },
    featured: true,
  },
  {
    name: 'Lumbar Support Belt',
    description: 'Adjustable lumbar support belt for back pain relief. Provides firm support for lower back.',
    category: 'orthopedic-support',
    price: 48000,
    stock: 45,
    variants: {
      colors: ['Black', 'Beige'],
      sizes: ['Small', 'Medium', 'Large'],
    },
  },
  {
    name: 'Wrist Support Brace',
    description: 'Elastic wrist support with thumb loop. Ideal for carpal tunnel syndrome and wrist injuries.',
    category: 'orthopedic-support',
    price: 22000,
    stock: 90,
    variants: {
      colors: ['Black', 'Gray'],
      sizes: ['Small', 'Medium', 'Large'],
    },
  },
  {
    name: 'Ankle Support Brace',
    description: 'Adjustable ankle support with figure-8 strap system. Provides stability for sprained ankles.',
    category: 'orthopedic-support',
    price: 38000,
    stock: 55,
    variants: {
      colors: ['Black'],
      sizes: ['Small', 'Medium', 'Large'],
    },
  },
  {
    name: 'Posture Corrector',
    description: 'Adjustable posture corrector for upper back and shoulders. Helps maintain proper spine alignment.',
    category: 'orthopedic-support',
    price: 55000,
    stock: 40,
    variants: {
      colors: ['Black', 'Beige'],
      sizes: ['Small/Medium', 'Large/X-Large'],
    },
    featured: true,
  },

  // Insoles & Foot Care
  {
    name: 'Orthotic Insoles',
    description: 'Arch support insoles for flat feet and plantar fasciitis. Provides cushioning and support.',
    category: 'insoles-foot-care',
    price: 25000,
    stock: 120,
    variants: {
      sizes: ['Small (35-37)', 'Medium (38-40)', 'Large (41-43)', 'X-Large (44-46)'],
    },
  },
  {
    name: 'Gel Heel Cups',
    description: 'Soft gel heel cups for heel pain relief. Absorbs shock and reduces pressure on heels.',
    category: 'insoles-foot-care',
    price: 18000,
    stock: 150,
    variants: {
      colors: ['Transparent', 'Blue'],
      sizes: ['Small', 'Medium', 'Large'],
    },
  },
  {
    name: 'Metatarsal Pads',
    description: 'Soft metatarsal pads for ball-of-foot pain relief. Reduces pressure on metatarsal heads.',
    category: 'insoles-foot-care',
    price: 20000,
    stock: 100,
    variants: {
      colors: ['Beige', 'Gray'],
      sizes: ['Small', 'Medium', 'Large'],
    },
  },
  {
    name: 'Toe Separators',
    description: 'Silicone toe separators for bunion relief and toe alignment. Soft and flexible material.',
    category: 'insoles-foot-care',
    price: 12000,
    stock: 200,
    variants: {
      colors: ['Blue', 'Pink', 'Transparent'],
    },
  },

  // Massage & Therapy
  {
    name: 'Foam Roller',
    description: 'High-density foam roller for muscle recovery and myofascial release. Improves flexibility.',
    category: 'massage-therapy',
    price: 35000,
    stock: 65,
    variants: {
      colors: ['Black', 'Blue', 'Purple'],
      sizes: ['Small (30cm)', 'Medium (45cm)', 'Large (90cm)'],
    },
    featured: true,
  },
  {
    name: 'Massage Ball Set',
    description: 'Set of 3 massage balls with different textures. Target trigger points and tight muscles.',
    category: 'massage-therapy',
    price: 22000,
    stock: 85,
    variants: {
      colors: ['Blue', 'Green', 'Orange'],
    },
  },
  {
    name: 'Therapy Putty',
    description: 'Resistance putty for hand therapy and grip strengthening. Available in multiple resistance levels.',
    category: 'massage-therapy',
    price: 15000,
    stock: 110,
    variants: {
      colors: ['Yellow (Extra Soft)', 'Red (Soft)', 'Green (Medium)', 'Blue (Firm)', 'Black (Extra Firm)'],
    },
  },
  {
    name: 'Neck Massager',
    description: 'Electric neck massager with heat function. Relieves tension and improves blood circulation.',
    category: 'massage-therapy',
    price: 85000,
    stock: 35,
    variants: {
      colors: ['White', 'Gray'],
    },
  },

  // Mobility & Rehabilitation
  {
    name: 'Walking Cane Adjustable',
    description: 'Adjustable aluminum walking cane with ergonomic handle. Lightweight and sturdy.',
    category: 'mobility-rehabilitation',
    price: 42000,
    stock: 50,
    variants: {
      colors: ['Black', 'Brown', 'Silver'],
    },
  },
  {
    name: 'Quad Cane',
    description: 'Four-legged cane for enhanced stability. Wide base provides extra support.',
    category: 'mobility-rehabilitation',
    price: 65000,
    stock: 30,
    variants: {
      colors: ['Black', 'Silver'],
    },
  },
  {
    name: 'Hand Grip Strengthener',
    description: 'Adjustable hand grip strengthener for finger and wrist exercises. Improves grip strength.',
    category: 'mobility-rehabilitation',
    price: 18000,
    stock: 95,
    variants: {
      colors: ['Black', 'Blue', 'Red'],
    },
  },
  {
    name: 'Finger Exerciser',
    description: 'Individual finger exerciser with resistance bands. Rehabilitates finger strength and flexibility.',
    category: 'mobility-rehabilitation',
    price: 14000,
    stock: 120,
    variants: {
      colors: ['Blue', 'Green', 'Orange'],
    },
  },

  // Accessories
  {
    name: 'Gym Towel',
    description: 'Quick-dry microfiber gym towel. Compact and absorbent.',
    category: 'accessories',
    price: 12000,
    stock: 200,
    variants: {
      colors: ['Blue', 'Gray', 'Pink', 'Black'],
    },
  },
  {
    name: 'Water Bottle Sports',
    description: 'Insulated sports water bottle (750ml). Keeps drinks cold for 24 hours.',
    category: 'accessories',
    price: 25000,
    stock: 150,
    variants: {
      colors: ['Blue', 'Black', 'Red', 'Green'],
    },
  },
  {
    name: 'Gym Bag Duffle',
    description: 'Spacious gym bag with shoe compartment. Durable and water-resistant material.',
    category: 'accessories',
    price: 55000,
    stock: 70,
    variants: {
      colors: ['Black', 'Gray', 'Blue'],
    },
    featured: true,
  },
  {
    name: 'Resistance Band Door Anchor',
    description: 'Door anchor for resistance band exercises. Secure attachment point for various workouts.',
    category: 'accessories',
    price: 18000,
    stock: 80,
    variants: {
      colors: ['Black'],
    },
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
    console.log('🌱  Seeding fake data for Comfort-Sign...\n');

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
      const brandId = brandMap['comfort-sign']; // Use Comfort-Sign brand

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
          const sku = `CS-${product.name.substring(0, 3).toUpperCase()}-${i + 1}`;
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
        ) VALUES (?, ?, 'opening_balance', 'Initial stock', ?, 0, ?, 'Fake data seed', 'system')
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
