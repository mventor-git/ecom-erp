const db = require('./db');

db.initPromise.then(() => {
  const images = db.prepare('SELECT id, image_url, variant_attributes FROM product_images WHERE product_id = 1 AND variant_attributes != "{}" LIMIT 5').all();
  console.log('Product 1 variant images:');
  images.forEach(img => {
    console.log('  ID:', img.id);
    console.log('    URL:', img.image_url);
    console.log('    Attrs:', img.variant_attributes);
  });
  process.exit(0);
});
