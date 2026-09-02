const db = require('./db');
const fs = require('fs');
const path = require('path');

// Create images directory if it doesn't exist
const imagesDir = path.join(__dirname, 'public', 'images', 'products');
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
}

// Generate SVG placeholder image
function generateSVG(name, color, type = 'product') {
  const bgColor = color || '#3b82f6';
  const textColor = '#ffffff';
  
  return `<svg width="800" height="800" xmlns="http://www.w3.org/2000/svg">
  <rect width="800" height="800" fill="${bgColor}"/>
  <text x="400" y="380" font-family="Arial, sans-serif" font-size="48" font-weight="bold" fill="${textColor}" text-anchor="middle">${name}</text>
  <text x="400" y="440" font-family="Arial, sans-serif" font-size="32" fill="${textColor}" text-anchor="middle">${type}</text>
</svg>`;
}

// Save SVG to file
function saveSVG(filename, svgContent) {
  const filepath = path.join(imagesDir, filename);
  fs.writeFileSync(filepath, svgContent);
  return `/images/products/${filename}`;
}

async function seedVariantImages() {
  await db.initPromise;
  
  console.log('🎨 Seeding variant images...\n');
  
  // Get all active products with colors
  const products = db.prepare('SELECT id, name, colors FROM products WHERE active = 1').all();
  
  for (const product of products) {
    let colors = [];
    try {
      colors = JSON.parse(product.colors || '[]');
    } catch {
      continue;
    }
    
    if (colors.length === 0) continue;
    
    console.log(`Processing: ${product.name} (${colors.length} colors)`);
    
    // Check if product already has variant images
    const existingImages = db.prepare('SELECT COUNT(*) as count FROM product_images WHERE product_id = ?').get(product.id);
    
    if (existingImages.count > 0) {
      console.log(`  ⏭️  Skipping - already has ${existingImages.count} images\n`);
      continue;
    }
    
    let sortOrder = 0;
    
    // Add default gallery images (3 generic images)
    for (let i = 1; i <= 3; i++) {
      const svg = generateSVG(product.name, '#6b7280', `Gallery ${i}`);
      const filename = `${product.id}-gallery-${i}.svg`;
      const imageUrl = saveSVG(filename, svg);
      
      db.prepare('INSERT INTO product_images (product_id, image_url, sort_order, variant_attributes) VALUES (?, ?, ?, ?)')
        .run(product.id, imageUrl, sortOrder++, '{}');
      
      console.log(`  ✓ Added gallery image ${i}`);
    }
    
    // Add variant images for each color
    for (const color of colors) {
      const colorName = typeof color === 'string' ? color : color.name;
      const colorHex = typeof color === 'object' ? color.hex : '#3b82f6';
      const colorSize = typeof color === 'object' ? color.size : null;
      
      const svg = generateSVG(product.name, colorHex, colorName);
      // Sanitize filename: remove special characters and replace spaces with hyphens
      const safeColorName = colorName.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').toLowerCase();
      const filename = `${product.id}-color-${safeColorName}.svg`;
      const imageUrl = saveSVG(filename, svg);
      
      // Store both color and size separately for better matching
      const variantAttrs = {};
      if (colorSize) {
        // Extract base color name (e.g., "Red" from "Red - Small")
        const baseColorName = colorName.split(' - ')[0];
        variantAttrs.color = [baseColorName];
        variantAttrs.size = [colorSize];
      } else {
        variantAttrs.color = [colorName];
      }
      
      db.prepare('INSERT INTO product_images (product_id, image_url, sort_order, variant_attributes) VALUES (?, ?, ?, ?)')
        .run(product.id, imageUrl, sortOrder++, JSON.stringify(variantAttrs));
      
      console.log(`  ✓ Added variant image: ${colorName}`);
    }
    
    console.log(`  ✅ Total: ${sortOrder} images\n`);
  }
  
  console.log('✨ Variant images seeding complete!');
  process.exit(0);
}

seedVariantImages().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
