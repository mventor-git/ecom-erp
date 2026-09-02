/**
 * Seed Script — Populates the database with sample products.
 * Run: npm run seed
 */

require('dotenv').config();
const db = require('./db');

const CATEGORIES = [
  { name: 'General', slug: 'general' },
  { name: 'Electronics', slug: 'electronics' },
  { name: 'Clothing', slug: 'clothing' },
  { name: 'Home & Garden', slug: 'home-garden' },
];

const SAMPLE_PRODUCTS = [
  // ===== General =====
  { name: 'Silicone Phone Stand', description: 'Compact foldable silicone phone stand for desks and nightstands. Universal fit for all smartphones and tablets. Available in multiple fun colors.', price: 499, category: 'general', stock: 200, image_url: '', colors: [{ name: 'Coral', hex: '#fb7185' }, { name: 'Mint', hex: '#34d399' }, { name: 'Lavender', hex: '#a78bfa' }] },
  { name: 'Premium Water Bottle', description: 'Double-walled insulated stainless steel water bottle. Keeps drinks cold for 24 hours or hot for 12 hours. BPA-free, leak-proof design with a wide mouth for easy cleaning.', price: 2499, category: 'general', stock: 50, image_url: '', colors: [{ name: 'Matte Black', hex: '#2d2d2d' }, { name: 'Pearl White', hex: '#f0f0f0' }, { name: 'Ocean Blue', hex: '#2563eb' }] },
  { name: 'Wireless Charging Pad', description: 'Fast wireless charger compatible with all Qi-enabled devices. Sleek, slim design with LED indicator. Supports up to 15W fast charging.', price: 1999, category: 'general', stock: 30, image_url: '', colors: [{ name: 'Black', hex: '#111111' }, { name: 'White', hex: '#ffffff' }] },
  { name: 'Travel Backpack 40L', description: 'Lightweight, durable travel backpack with padded laptop compartment, multiple organizers, and hidden security pocket. Water-resistant material.', price: 5999, category: 'general', stock: 20, image_url: '' },

  // ===== Electronics =====
  { name: 'Bluetooth Headphones', description: 'Over-ear wireless headphones with active noise cancellation. 40-hour battery life, premium sound quality, and comfortable memory foam ear cushions.', price: 7999, category: 'electronics', stock: 25, image_url: '', colors: [{ name: 'Midnight Black', hex: '#1a1a2e' }, { name: 'Cloud White', hex: '#f8f9fa' }, { name: 'Forest Green', hex: '#2d6a4f' }] },
  { name: 'USB-C Hub 7-in-1', description: 'Compact USB-C hub with HDMI 4K output, 3x USB 3.0 ports, SD/TF card reader, and 100W Power Delivery pass-through. Compatible with laptops, tablets, and phones.', price: 3499, category: 'electronics', stock: 40, image_url: '' },
  { name: 'Smart LED Desk Lamp', description: 'Eye-care LED desk lamp with adjustable color temperature (3000K-6500K), brightness levels, and built-in USB charging port. Touch control with memory function.', price: 4499, category: 'electronics', stock: 15, image_url: '' },
  { name: 'Portable Bluetooth Speaker', description: 'Compact waterproof Bluetooth speaker with rich 360-degree sound. IPX7 rated, 12-hour playback, and built-in microphone for calls.', price: 3999, category: 'electronics', stock: 35, image_url: '', colors: [{ name: 'Red', hex: '#dc2626' }, { name: 'Blue', hex: '#2563eb' }, { name: 'Black', hex: '#111111' }, { name: 'Camo', hex: '#4d7c3b' }] },

  // ===== Clothing =====
  { name: 'Classic Fit Crewneck T-Shirt', description: 'Premium 100% organic cotton t-shirt. Pre-shrunk fabric, reinforced seams, and a comfortable classic fit. Available in multiple colors.', price: 2499, category: 'clothing', stock: 100, image_url: '', colors: [{ name: 'White', hex: '#ffffff' }, { name: 'Black', hex: '#111111' }, { name: 'Navy', hex: '#1e3a5f' }, { name: 'Gray', hex: '#9ca3af' }, { name: 'Burgundy', hex: '#7f1d1d' }] },
  { name: 'Lightweight Hoodie', description: 'Soft cotton-blend hoodie with adjustable drawstring hood, kangaroo pocket, and ribbed cuffs. Perfect for layering.', price: 4999, category: 'clothing', stock: 45, image_url: '', colors: [{ name: 'Charcoal', hex: '#374151' }, { name: 'Cream', hex: '#fef3c7' }, { name: 'Forest', hex: '#166534' }, { name: 'Burgundy', hex: '#7f1d1d' }] },
  { name: 'Running Shoes', description: 'Lightweight performance running shoes with responsive cushioning and breathable mesh upper. Ideal for daily runs and gym workouts.', price: 8999, category: 'clothing', stock: 20, image_url: '', colors: [{ name: 'Black/White', hex: '#2d2d2d' }, { name: 'Navy/Orange', hex: '#1e3a5f' }] },
  { name: 'Wool Blend Beanie', description: 'Soft acrylic-wool blend beanie with fleece lining for extra warmth. Classic ribbed knit design, one size fits most.', price: 1499, category: 'clothing', stock: 60, image_url: '', colors: [{ name: 'Black', hex: '#111111' }, { name: 'Gray', hex: '#9ca3af' }, { name: 'Mustard', hex: '#d97706' }, { name: 'Teal', hex: '#0d9488' }] },

  // ===== Home & Garden =====
  { name: 'Indoor Succulent Planter Set', description: 'Set of 3 ceramic planters with bamboo trays. Includes drainage holes and comes with a small bag of pebbles. Perfect for succulents and cacti.', price: 2999, category: 'home-garden', stock: 25, image_url: '', colors: [{ name: 'Terracotta', hex: '#c2410c' }, { name: 'White', hex: '#f8f8f8' }, { name: 'Sage', hex: '#84a98c' }] },
  { name: 'Aromatherapy Essential Oil Diffuser', description: 'Ultrasonic cool mist diffuser with 7-color LED mood lighting. Runs up to 10 hours, auto shut-off, and covers rooms up to 300 sq ft.', price: 3299, category: 'home-garden', stock: 18, image_url: '', colors: [{ name: 'White', hex: '#f8f8f8' }, { name: 'Wood', hex: '#92400e' }] },
  { name: 'Bamboo Cutting Board Set', description: 'Set of 3 organic bamboo cutting boards in different sizes. Naturally antimicrobial, knife-friendly, with juice grooves and easy-grip handles.', price: 2799, category: 'home-garden', stock: 30, image_url: '' },
  { name: 'Collapsible Storage Bins', description: 'Set of 4 collapsible fabric storage bins with reinforced handles. Fold flat when not in use. Modern design fits any decor.', price: 3999, category: 'home-garden', stock: 40, image_url: '', colors: [{ name: 'Gray', hex: '#9ca3af' }, { name: 'Beige', hex: '#d4a574' }, { name: 'Navy', hex: '#1e3a5f' }] },
];

async function seed() {
  try {
    await db.initPromise;
    console.log('🌱  Seeding database...\n');

    // Ensure required categories exist
    for (const cat of CATEGORIES) {
      db.run("INSERT OR IGNORE INTO categories (name, slug) VALUES (?, ?)", [cat.name, cat.slug]);
    }

    // Get category slug -> id mapping
    const categories = db.prepare('SELECT id, slug FROM categories').all();
    const catMap = {};
    categories.forEach(c => { catMap[c.slug] = c.id; });

    let inserted = 0;
    let skipped = 0;

    const checkStmt = db.prepare('SELECT id FROM products WHERE name = ?');
    const insertStmt = db.prepare(`
      INSERT INTO products (name, description, price, category_id, stock, image_url, colors, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `);

    for (const product of SAMPLE_PRODUCTS) {
      const existing = checkStmt.get(product.name);
      if (existing) {
        console.log(`  ⏭️   Skipped: "${product.name}" (already exists)`);
        skipped++;
        continue;
      }

      const categoryId = catMap[product.category];
      if (!categoryId) {
        console.log(`  ⚠️   Skipped: "${product.name}" — unknown category "${product.category}"`);
        skipped++;
        continue;
      }

      insertStmt.run(product.name, product.description, product.price, categoryId, product.stock, product.image_url, JSON.stringify(product.colors || []));
      inserted++;
      console.log(`  ✅  Inserted: "${product.name}" — $${(product.price / 100).toFixed(2)} (${product.category})`);
    }

    console.log(`\n📊  Summary: ${inserted} inserted, ${skipped} skipped, ${SAMPLE_PRODUCTS.length} total`);
    db.saveDb();
    console.log('💾  Database saved.');
    process.exit(0);
  } catch (err) {
    console.error('❌  Seed failed:', err);
    process.exit(1);
  }
}

seed();
