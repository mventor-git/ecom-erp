/**
 * mventor-ticket-037: Seed Script for Gallery Images, Variant Images, Hero Slides, and Announcements
 * 
 * This script:
 * 1. Seeds product_images table with each product's main image
 * 2. Generates variant placeholder images using Sharp
 * 3. Seeds hero_slides with real product photos
 * 4. Seeds announcements
 */

const db = require('./db');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const IMAGES_DIR = path.join(__dirname, 'public', 'images');
const VARIANTS_DIR = path.join(IMAGES_DIR, 'variants');

// Ensure variants directory exists
if (!fs.existsSync(VARIANTS_DIR)) {
  fs.mkdirSync(VARIANTS_DIR, { recursive: true });
}

async function generateVariantImage(color, size, filename) {
  const width = 300;
  const height = 300;
  
  // Parse hex color
  const hex = color.hex || '#888888';
  
  // Create SVG with color and text
  const svgText = `
    <svg width="${width}" height="${height}">
      <rect width="100%" height="100%" fill="${hex}"/>
      <text x="50%" y="45%" font-family="Arial" font-size="24" fill="white" text-anchor="middle" dominant-baseline="middle">
        ${color.name}
      </text>
      ${size ? `<text x="50%" y="60%" font-family="Arial" font-size="18" fill="white" text-anchor="middle" dominant-baseline="middle">
        ${size}
      </text>` : ''}
    </svg>
  `;
  
  const outputPath = path.join(VARIANTS_DIR, filename);
  
  await sharp(Buffer.from(svgText))
    .png()
    .toFile(outputPath);
  
  return `/images/variants/${filename}`;
}

async function seedGalleryImages() {
  console.log('\n=== Seeding Gallery Images ===');
  
  const products = db.prepare('SELECT id, name, image_url FROM products WHERE active = 1').all();
  let count = 0;
  
  for (const product of products) {
    // Check if product already has gallery images
    const existing = db.prepare('SELECT COUNT(*) as cnt FROM product_images WHERE product_id = ?').get(product.id);
    
    if (existing.cnt === 0 && product.image_url) {
      // Add main image as first gallery image
      db.prepare(`
        INSERT INTO product_images (product_id, image_url, sort_order, variant_attributes)
        VALUES (?, ?, 0, '{}')
      `).run(product.id, product.image_url);
      count++;
    }
  }
  
  console.log(`  Added ${count} gallery images`);
}

async function seedVariantImages() {
  console.log('\n=== Generating Variant Images ===');
  
  const products = db.prepare(`
    SELECT id, name, colors, sizes 
    FROM products 
    WHERE active = 1 AND (colors != '[]' OR sizes != '[]')
  `).all();
  
  let count = 0;
  
  for (const product of products) {
    let colors = [];
    let sizes = [];
    
    try {
      colors = typeof product.colors === 'string' ? JSON.parse(product.colors) : (product.colors || []);
      sizes = typeof product.sizes === 'string' ? JSON.parse(product.sizes) : (product.sizes || []);
    } catch { continue; }
    
    if (colors.length === 0 && sizes.length === 0) continue;
    
    // Check if product already has variant images
    const existingVariants = db.prepare(`
      SELECT COUNT(*) as cnt FROM product_images 
      WHERE product_id = ? AND variant_attributes != '{}'
    `).get(product.id);
    
    if (existingVariants.cnt > 0) continue;
    
    // Determine if colors have size info embedded
    const colorsHaveSize = colors.some(c => c.size);
    
    if (colorsHaveSize) {
      // Each color entry already has size info
      for (const color of colors) {
        const slug = `${product.id}-${color.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${(color.size || '').replace(/[^a-z0-9]/gi, '-').toLowerCase()}`.replace(/-+/g, '-').replace(/^-|-$/g, '');
        const filename = `variant-${slug}.png`;
        
        const imageUrl = await generateVariantImage(color, color.size, filename);
        
        const variantAttrs = JSON.stringify({
          color: [color.name],
          size: color.size ? [color.size] : []
        });
        
        db.prepare(`
          INSERT INTO product_images (product_id, image_url, sort_order, variant_attributes)
          VALUES (?, ?, 1, ?)
        `).run(product.id, imageUrl, variantAttrs);
        
        count++;
      }
    } else if (colors.length > 0 && sizes.length > 0) {
      // Cross-product of colors and sizes
      for (const color of colors) {
        for (const size of sizes) {
          const sizeName = typeof size === 'string' ? size : size.name;
          const slug = `${product.id}-${color.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${sizeName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`.replace(/-+/g, '-').replace(/^-|-$/g, '');
          const filename = `variant-${slug}.png`;
          
          const imageUrl = await generateVariantImage(color, sizeName, filename);
          
          const variantAttrs = JSON.stringify({
            color: [color.name],
            size: [sizeName]
          });
          
          db.prepare(`
            INSERT INTO product_images (product_id, image_url, sort_order, variant_attributes)
            VALUES (?, ?, 1, ?)
          `).run(product.id, imageUrl, variantAttrs);
          
          count++;
        }
      }
    } else if (colors.length > 0) {
      // Color-only variants
      for (const color of colors) {
        const slug = `${product.id}-${color.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`.replace(/-+/g, '-').replace(/^-|-$/g, '');
        const filename = `variant-${slug}.png`;
        
        const imageUrl = await generateVariantImage(color, null, filename);
        
        const variantAttrs = JSON.stringify({
          color: [color.name]
        });
        
        db.prepare(`
          INSERT INTO product_images (product_id, image_url, sort_order, variant_attributes)
          VALUES (?, ?, 1, ?)
        `).run(product.id, imageUrl, variantAttrs);
        
        count++;
      }
    } else if (sizes.length > 0) {
      // Size-only variants
      for (const size of sizes) {
        const sizeName = typeof size === 'string' ? size : size.name;
        const slug = `${product.id}-${sizeName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`.replace(/-+/g, '-').replace(/^-|-$/g, '');
        const filename = `variant-${slug}.png`;
        
        const imageUrl = await generateVariantImage({ name: sizeName, hex: '#6b7280' }, sizeName, filename);
        
        const variantAttrs = JSON.stringify({
          size: [sizeName]
        });
        
        db.prepare(`
          INSERT INTO product_images (product_id, image_url, sort_order, variant_attributes)
          VALUES (?, ?, 1, ?)
        `).run(product.id, imageUrl, variantAttrs);
        
        count++;
      }
    }
  }
  
  console.log(`  Generated ${count} variant images`);
}

async function seedHeroSlides() {
  console.log('\n=== Seeding Hero Slides ===');
  
  // Check if hero slides already exist
  const existing = db.prepare('SELECT COUNT(*) as cnt FROM hero_slides').get();
  if (existing.cnt > 0) {
    console.log('  Hero slides already exist, skipping');
    return;
  }
  
  // Get featured products with real images
  const featuredProducts = db.prepare(`
    SELECT p.id, p.name, p.description, p.price, p.image_url
    FROM products p
    WHERE p.active = 1 AND p.featured = 1
    ORDER BY p.featured_order ASC
    LIMIT 5
  `).all();
  
  // Map of product names to real image folders
  const realImageMap = {
    'Bluetooth Speaker': 'bluetooth-speaker',
    'Stand Mixer': 'stand-mixer',
    'Denim Tote Bag': 'denim-tote-bag',
    'Ceramic Mug Set': 'ceramic-mug-set',
    'Table Lamp': 'table-lamp',
    'Canvas Sneakers': 'canvas-sneakers',
  };
  
  let count = 0;
  
  for (let i = 0; i < featuredProducts.length; i++) {
    const product = featuredProducts[i];
    const folderName = realImageMap[product.name];
    
    let heroImage = product.image_url; // fallback to SVG
    
    if (folderName) {
      const folderPath = path.join(IMAGES_DIR, 'products', folderName);
      if (fs.existsSync(folderPath)) {
        const images = fs.readdirSync(folderPath).filter(f => 
          f.match(/\.(jpg|jpeg|png|webp)$/i)
        );
        if (images.length > 0) {
          heroImage = `/images/products/${folderName}/${images[0]}`;
        }
      }
    }
    
    db.prepare(`
      INSERT INTO hero_slides (title, description, cta_text, cta_link, product_id, image_url, is_active, sort_order)
      VALUES (?, ?, 'Shop Now', ?, ?, ?, 1, ?)
    `).run(
      product.name,
      product.description ? product.description.substring(0, 200) : `Premium ${product.name} at the best price`,
      `/products/${product.id}`,
      product.id,
      heroImage,
      i
    );
    
    count++;
  }
  
  console.log(`  Created ${count} hero slides`);
}

async function seedAnnouncements() {
  console.log('\n=== Seeding Announcements ===');
  
  // Check if announcements already exist
  const existing = db.prepare('SELECT COUNT(*) as cnt FROM announcements').get();
  if (existing.cnt > 0) {
    console.log('  Announcements already exist, skipping');
    return;
  }
  
  const announcements = [
    { text: 'Free shipping on orders over 500 Ø¬.Ù…!', icon: 'ðŸšš' },
    { text: 'New arrivals just landed — shop the latest deals', icon: 'âœ¨' },
    { text: 'Ramadan Sale â€” Up to 30% off selected items', icon: 'ðŸŒ™' },
  ];
  
  for (let i = 0; i < announcements.length; i++) {
    db.prepare(`
      INSERT INTO announcements (text, icon, is_active, sort_order)
      VALUES (?, ?, 1, ?)
    `).run(announcements[i].text, announcements[i].icon, i);
  }
  
  console.log(`  Created ${announcements.length} announcements`);
}

async function main() {
  console.log('mventor-ticket-037: Seeding gallery images, variants, hero slides, and announcements...\n');
  
  await db.initPromise;
  
  await seedGalleryImages();
  await seedVariantImages();
  await seedHeroSlides();
  await seedAnnouncements();
  
  // Verify
  const galleryCount = db.prepare('SELECT COUNT(*) as cnt FROM product_images').get();
  const variantCount = db.prepare("SELECT COUNT(*) as cnt FROM product_images WHERE variant_attributes != '{}'").get();
  const heroCount = db.prepare('SELECT COUNT(*) as cnt FROM hero_slides').get();
  const annCount = db.prepare('SELECT COUNT(*) as cnt FROM announcements').get();
  
  console.log('\n=== Verification ===');
  console.log(`  Total gallery images: ${galleryCount.cnt}`);
  console.log(`  Variant images: ${variantCount.cnt}`);
  console.log(`  Hero slides: ${heroCount.cnt}`);
  console.log(`  Announcements: ${annCount.cnt}`);
  
  console.log('\nDone!');
  process.exit(0);
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
