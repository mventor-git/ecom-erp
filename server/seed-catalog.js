/**
 * Catalog Database Seed Script
 * 
 * Reads the Excel seed data file and populates the database with
 * generic demo-catalog products for a neutral Ecom-ERP store.
 * 
 * Usage: node seed-catalog.js
 * 
 * Reads from: <seed-data-dir>/Work Sheet-1.xlsx
 * Copies images from: <seed-data-dir>/Products Images/
 * Images to: server/public/images/products/
 */

require('dotenv').config();
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');

const db = require('./db');

// ─── Paths ───────────────────────────────────────────────────────────────────

const SEED_DATA_DIR = './seed-data';
const EXCEL_PATH = path.join(SEED_DATA_DIR, 'Work Sheet-1.xlsx');
const IMAGES_SOURCE_DIR = path.join(SEED_DATA_DIR, 'Products Images');
const IMAGES_TARGET_DIR = path.join(__dirname, 'public', 'images', 'products');

// ─── Categories ──────────────────────────────────────────────────────────────

const CATEGORIES = [
  { name_en: 'Electronics', name_ar: 'إلكترونيات', slug: 'electronics' },
  { name_en: 'Home & Kitchen', name_ar: 'المنزل والمطبخ', slug: 'home-kitchen' },
  { name_en: 'Fashion', name_ar: 'أزياء', slug: 'fashion' },
  { name_en: 'Grocery', name_ar: 'بقالة', slug: 'grocery' },
  { name_en: 'Beauty & Care', name_ar: 'الجمال والعناية', slug: 'beauty-care' },
];

// ─── Brand ───────────────────────────────────────────────────────────────────

const BRANDS = [
  { name: 'Demo', slug: 'demo', icon_url: '' },
  { name: 'Generic', slug: 'generic', icon_url: '' },
];

// ─── Name Translation + Duplicate Merge ─────────────────────────────────────

function translateName(name) {
  // If name has Arabic characters, translate it
  const hasArabic = /[\u0600-\u06FF]/.test(name);
  if (!hasArabic && !ARABIC_TO_ENGLISH[name]) return name;
  
  return ARABIC_TO_ENGLISH[name] || name;
}

function resolveDuplicates(rows) {
  // Build reverse map: merge-source → merge-target
  const mergeTarget = {};
  for (const [target, sources] of Object.entries(DUPLICATE_MERGE)) {
    for (const src of sources) {
      mergeTarget[src] = target;
    }
  }
  
  const resolved = [];
  const merged = new Set();
  
  for (const row of rows) {
    const targetName = mergeTarget[row.name];
    if (targetName) {
      // This row should be merged into the target product
      if (!merged.has(targetName)) {
        // Create a merged row with accumulated stock and best price
        const sourceRows = rows.filter(r => mergeTarget[r.name] === targetName || r.name === targetName);
        const totalStock = sourceRows.reduce((sum, r) => sum + r.stock, 0);
        const bestPrice = Math.max(...sourceRows.map(r => r.price_egp));
        
        // Find the first row of the target to clone
        const targetRow = sourceRows.find(r => r.name === targetName) || sourceRows[0];
        resolved.push({
          ...targetRow,
          name: targetName,
          stock: totalStock,
          price_egp: bestPrice || targetRow.price_egp,
          price_cents: Math.round((bestPrice || targetRow.price_egp) * 100),
        });
        merged.add(targetName);
      }
    } else if (!mergeTarget[row.name]) {
      // Not a merge source, keep as-is (but maybe translated)
      resolved.push(row);
    }
  }
  
  return resolved;
}

// ─── Image Folder → Product Name Mapping ─────────────────────────────────────
// Legacy Excel image-folder map retired (no external source). Kept for shape.
const IMAGE_FOLDER_MAP = {};

// ─── Product Category Assignment ────────────────────────────────────────────

function getCategorySlug(productName) {
  const name = productName.toLowerCase();

  // Electronics
  if (/speaker|headphone|earbud|charger|power\s*bank|phone|tablet|laptop/.test(name)) {
    return 'electronics';
  }

  // Fashion
  if (/shirt|sneaker|shoe|bag|tote|jacket|dress|jeans|cap|scarf/.test(name)) {
    return 'fashion';
  }

  // Grocery
  if (/coffee|honey|tea|sugar|rice|pasta|beans|chocolate|snack/.test(name)) {
    return 'grocery';
  }

  // Beauty & Care
  if (/lotion|shampoo|soap|cream|perfume|cosmetic|skincare/.test(name)) {
    return 'beauty-care';
  }

  // Home & Kitchen (default for rest)
  return 'home-kitchen';
}

// ─── Arabic → English Name Translation ──────────────────────────────────────

const ARABIC_TO_ENGLISH = {
  'مكبر صوت': 'Bluetooth Speaker',
  'تيشيرت قطن': 'Cotton T-Shirt',
  'بن عربي': 'Arabica Coffee Beans',
};

// ─── Duplicate Resolution ───────────────────────────────────────────────────
// Products that appear to be the same item entered with different names.
// The key is the name to KEEP, the value is an array of names to MERGE into it.
const DUPLICATE_MERGE = {
  'Cotton T-Shirt': ['Cotton Tee', 'Basic T-Shirt'],
};

// ─── Color Name → Hex Mapping ───────────────────────────────────────────────

const COLOR_MAP = {
  'pink': '#ec4899',
  'silver': '#c0c0c0',
  'blue': '#3b82f6',
  'red': '#ef4444',
  'purple': '#a855f7',
  'purble': '#a855f7',
  'orange': '#f97316',
  'black': '#111111',
  'green': '#22c55e',
  'camel': '#c19a6b',
  'brown': '#8b4513',
  'grey': '#9ca3af',
  'gray': '#9ca3af',
  'white': '#ffffff',
  'yellow': '#eab308',
  'no color': null,
};

function getColorHex(colorName) {
  if (!colorName || colorName === 'No Color*') return null;
  const key = colorName.trim().toLowerCase();
  return COLOR_MAP[key] || '#6b7280';
}

// ─── Parse Excel ─────────────────────────────────────────────────────────────

function parseExcel() {
  if (!fs.existsSync(EXCEL_PATH)) {
    console.error(`❌  Excel file not found at: ${EXCEL_PATH}`);
    process.exit(1);
  }

  const wb = XLSX.readFile(EXCEL_PATH);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '', header: 1 });

  const data = [];
  
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r[0] || !r[0].toString().trim()) continue;
    
    const retailPrice = parseFloat(r[8]) || 0;
    const merchantPrice = parseFloat(r[9]) || 0;
    const openingPrice = parseFloat(r[10]) || 0;
    
    let price = retailPrice;
    if (price <= 0) price = merchantPrice;
    if (price <= 0) price = openingPrice;
    
    const rawName = r[0].toString().trim();
    
    data.push({
      name: translateName(rawName),           // ← translate Arabic → English here
      originalName: rawName,
      size: r[3] ? r[3].toString().trim() : 'No Sizes*',
      variant: r[4] ? r[4].toString().trim() : 'No Variants*',
      color: r[5] ? r[5].toString().trim() : 'No Color*',
      stock: parseInt(r[6]) || 0,
      price_egp: price,
      price_cents: Math.round(price * 100),
    });
  }

  console.log(`📊  Read ${data.length} product rows from Excel`);
  return data;
}

// ─── Group Rows Into ONE Product Per Base Name ──────────────────────────────
// Each product gets a `colors` JSON that holds ALL variant options.
// Each variant entry includes: name (color), hex, size (if applicable), stock.

function groupProducts(rows) {
  // --- Step 1: Resolve duplicates (merge like Cotton Tee → Cotton T-Shirt)
  const resolved = resolveDuplicates(rows);
  
  // --- Step 2: Group by final English name
  const groups = {};
  for (const row of resolved) {
    const key = row.name;
    if (!groups[key]) groups[key] = [];
    groups[key].push(row);
  }
  
  // --- Step 3: Build one product per group with all variants in colors[]
  const products = [];
  
  for (const [name, nameRows] of Object.entries(groups)) {
    const hasSizes = nameRows.some(r => r.size !== 'No Sizes*' && r.size !== '');
    const hasColors = nameRows.some(r => r.color !== 'No Color*' && r.color !== '');
    const hasVariants = nameRows.some(r => r.variant !== 'No Variants*' && r.variant !== '');
    const uniqueSizes = [...new Set(nameRows.map(r => r.size).filter(s => s !== 'No Sizes*' && s !== ''))];
    
    // Compute price: average of all non-zero prices
    let priceSum = 0, priceCount = 0;
    for (const row of nameRows) {
      const p = getBestPrice(row);
      if (p > 0) { priceSum += p; priceCount++; }
    }
    const avgPrice = priceCount > 0 ? Math.round(priceSum / priceCount) : 5000;
    
    // Total stock
    const totalStock = nameRows.reduce((sum, r) => sum + r.stock, 0);
    
    // Build the variants array (stored in `colors` JSON field)
    const variants = [];
    
    if (hasVariants && !hasSizes) {
      // Variant-based (Medication Organizer: Dynamic/Zip/Rods)
      for (const row of nameRows) {
        const hex = getColorHex(row.color) || '#6b7280';
        variants.push({
          variant: row.variant,
          name: `${row.variant}`,
          hex: hex,
          stock: row.stock,
        });
      }
    } else if (hasSizes && hasColors) {
      // Size + Color variants (GymBall, Yoga Mat, مشد فقرات الظهر)
      for (const size of uniqueSizes) {
        const sizeRows = nameRows.filter(r => r.size === size);
        for (const row of sizeRows) {
          const hex = getColorHex(row.color);
          if (hex) {
            // Clean size label
            const cleanSize = String(size).replace(/[()]/g, '').replace(/\s+/g, ' ').trim();
            variants.push({
              name: row.color.trim(),
              hex: hex,
              size: cleanSize,
              stock: row.stock,
            });
          }
        }
      }
    } else if (hasSizes) {
      // Size-only variants (throw pillows, shoe sizes)
      for (const row of nameRows) {
        const cleanSize = String(row.size).replace(/[()]/g, '').replace(/\s+/g, ' ').trim();
        variants.push({
          name: cleanSize,
          size: cleanSize,
          stock: row.stock,
          hex: '#6b7280',
        });
      }
    } else if (hasColors) {
      // Color-only variants (cushion covers, tote bags)
      const seenColors = new Set();
      for (const row of nameRows) {
        const hex = getColorHex(row.color);
        if (hex && !seenColors.has(row.color.trim().toLowerCase())) {
          seenColors.add(row.color.trim().toLowerCase());
          variants.push({
            name: row.color.trim(),
            hex: hex,
            stock: row.stock,
          });
        }
      }
    } else {
      // Single product, no variants
      // nothing to add to variants array
    }
    
    products.push({
      name: name,
      description: name,
      price_cents: avgPrice,
      stock: totalStock,
      category_slug: getCategorySlug(name),
      colors: variants,
      image_ref: name,
    });
  }
  
  return products;
}

function getBestPrice(row) {
  return Math.round((row.price_egp || 0) * 100);
}

// ─── Copy Images ─────────────────────────────────────────────────────────────

function copyProductImages(products) {
  if (!fs.existsSync(IMAGES_SOURCE_DIR)) {
    console.log('⚠️  Image source directory not found, skipping image copy');
    return;
  }
  
  // Ensure target directory exists
  if (!fs.existsSync(IMAGES_TARGET_DIR)) {
    fs.mkdirSync(IMAGES_TARGET_DIR, { recursive: true });
  }
  
  // Build reverse mapping: product name key → image folder
  const nameToFolders = {};
  for (const [folder, names] of Object.entries(IMAGE_FOLDER_MAP)) {
    for (const n of names) {
      if (!nameToFolders[n]) nameToFolders[n] = [];
      nameToFolders[n].push(folder);
    }
  }
  
  // Check source folders for available images
  const availableFolders = {};
  if (fs.existsSync(IMAGES_SOURCE_DIR)) {
    const dirs = fs.readdirSync(IMAGES_SOURCE_DIR, { withFileTypes: true });
    for (const d of dirs) {
      if (d.isDirectory()) {
        const files = fs.readdirSync(path.join(IMAGES_SOURCE_DIR, d.name))
          .filter(f => /\.(png|jpg|jpeg|gif|webp)$/i.test(f));
        if (files.length > 0) {
          availableFolders[d.name] = files;
        }
      }
    }
  }
  
  console.log(`\n📷  ${Object.keys(availableFolders).length} image folders found`);
  
  let copied = 0;
  
  for (const product of products) {
    const ref = product.image_ref;
    const folders = nameToFolders[ref];
    
    if (!folders) {
      // Try exact match
      const exactFolder = availableFolders[ref];
      if (exactFolder) {
        copyFolderImages(ref, exactFolder, product);
        copied++;
      }
      continue;
    }
    
    // Try each possible folder
    for (const folder of folders) {
      const files = availableFolders[folder];
      if (files) {
        copyFolderImages(folder, files, product);
        copied++;
        break;
      }
    }
  }
  
  console.log(`📷  Copied images for ${copied}/${products.length} products`);
}

function copyFolderImages(folderName, files, product) {
  // Create product image directory
  const slug = product.name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 80);
  
  const targetProductDir = path.join(IMAGES_TARGET_DIR, slug);
  if (!fs.existsSync(targetProductDir)) {
    fs.mkdirSync(targetProductDir, { recursive: true });
  }
  
  const sourceDir = path.join(IMAGES_SOURCE_DIR, folderName);
  const imageUrls = [];
  
  for (const file of files) {
    const sourceFile = path.join(sourceDir, file);
    const ext = path.extname(file);
    const targetFile = path.join(targetProductDir, file);
    
    try {
      fs.copyFileSync(sourceFile, targetFile);
      const relativePath = `/images/products/${slug}/${file}`;
      imageUrls.push(relativePath);
      
      // Set main image
      if (!product.image_url) {
        product.image_url = relativePath;
      }
    } catch (err) {
      console.error(`  ⚠️  Failed to copy ${sourceFile}: ${err.message}`);
    }
  }
  
  if (imageUrls.length > 0) {
    product.gallery_images = imageUrls;
  }
}

// ─── Seed Database ───────────────────────────────────────────────────────────

async function seedComfortSign() {
  try {
    await db.initPromise;
    console.log('🌱  Seeding catalog database...\n');
    
    // ── 1. Clear existing data ──
    console.log('🧹  Clearing existing products, categories, brands...');
    db.run('DELETE FROM product_images');
    db.run('DELETE FROM products');
    db.run('DELETE FROM categories');
    db.run('DELETE FROM brands');
    db.run("DELETE FROM sqlite_sequence WHERE name IN ('products', 'categories', 'brands', 'product_images')");
    db.saveDb();
    console.log('✅  Database cleared\n');
    
    // ── 2. Insert categories ──
    console.log('📁  Creating categories...');
    for (const cat of CATEGORIES) {
      db.run("INSERT INTO categories (name, slug) VALUES (?, ?)", [`${cat.name_en} (${cat.name_ar})`, cat.slug]);
      console.log(`  ✅  ${cat.name_en} (${cat.name_ar}) — ${cat.slug}`);
    }
    
    // ── 3. Insert brands ──
    console.log('\n🏷️  Creating brands...');
    for (const brand of BRANDS) {
      db.run("INSERT OR IGNORE INTO brands (name, slug, icon_url) VALUES (?, ?, ?)", [brand.name, brand.slug, brand.icon_url]);
      console.log(`  ✅  ${brand.name}`);
    }
    
    // ── 4. Parse and group products ──
    console.log('\n📊  Reading Excel data...');
    const rows = parseExcel();
    const products = groupProducts(rows);
    console.log(`📦  Grouped into ${products.length} products\n`);
    
    // ── 5. Copy images ──
    copyProductImages(products);
    
    // ── 6. Get category and brand IDs ──
    const categories = db.prepare('SELECT id, slug FROM categories').all();
    const catMap = {};
    categories.forEach(c => { catMap[c.slug] = c.id; });
    
    const brands = db.prepare('SELECT id, slug FROM brands').all();
    const brandMap = {};
    brands.forEach(b => { brandMap[b.slug] = b.id; });
    
    // ── 7. Insert products ──
    console.log('\n📦  Inserting products...');
    let inserted = 0;
    let skipped = 0;
    
    for (const product of products) {
      const categoryId = catMap[product.category_slug];
      if (!categoryId) {
        console.log(`  ⚠️  Skipped: "${product.name}" — unknown category "${product.category_slug}"`);
        skipped++;
        continue;
      }
      
      const colorsJson = JSON.stringify(product.colors);
      const price = product.price_cents > 0 ? product.price_cents : 5000;
      
      const insertResult = db.run(`
        INSERT INTO products (name, description, price, category_id, stock, image_url, colors, active)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1)
      `, [
        product.name,
        product.description || product.name,
        price,
        categoryId,
        product.stock,
        product.image_url || '',
        colorsJson,
      ]);
      
      // Get the last inserted product ID from run() result
      const productId = insertResult.lastInsertRowid;
      
      // Insert gallery images
      if (product.gallery_images && product.gallery_images.length > 0 && productId) {
        for (let i = 0; i < product.gallery_images.length; i++) {
          const imgUrl = product.gallery_images[i];
          // Skip the main image (already used as image_url)
          if (imgUrl === product.image_url) continue;
          db.run(
            "INSERT INTO product_images (product_id, image_url, sort_order) VALUES (?, ?, ?)",
            [productId, imgUrl, i]
          );
        }
      }
      
      const priceEg = (price / 100).toFixed(2);
      inserted++;
      
      // Short log line
      const colorCount = product.colors.length;
      const colorInfo = colorCount > 0 ? ` [${colorCount} colors]` : '';
      console.log(`  ✅  #${productId}: "${product.name}" — ${priceEg} EGP${colorInfo}`);
    }
    
    // ── 8. Log summary ──
    console.log(`\n📊  Summary: ${inserted} inserted, ${skipped} skipped`);
    console.log(`📁  Categories: ${CATEGORIES.length}`);
    console.log(`🏷️  Brands: ${BRANDS.length}`);
    
    // ── 9. Verify ──
    const count = db.prepare('SELECT COUNT(*) as cnt FROM products').get();
    const catCount = db.prepare('SELECT COUNT(*) as cnt FROM categories').get();
    console.log(`\n🔍  Verification:`);
    console.log(`   Products:   ${count.cnt}`);
    console.log(`   Categories: ${catCount.cnt}`);
    
    db.saveDb();
    console.log('\n💾  Database saved successfully!');
    
    // List products by category
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
    
    process.exit(0);
  } catch (err) {
    console.error('❌  Seed failed:', err);
    process.exit(1);
  }
}

seedComfortSign();
