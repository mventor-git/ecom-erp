const db = require('./db');

async function test() {
  // Wait for database to initialize
  await db.initPromise;
  
  try {
    // Check if table exists
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='welcome_slides'").all();
    console.log('welcome_slides table exists:', tables.length > 0 ? 'YES' : 'NO');
    
    // Try to query the table
    if (tables.length > 0) {
      const slides = db.prepare('SELECT * FROM welcome_slides LIMIT 5').all();
      console.log('Slides count:', slides.length);
      if (slides.length > 0) {
        console.log('First slide:', JSON.stringify(slides[0], null, 2));
      }
    }
  } catch(e) {
    console.error('Error:', e.message);
  }
}

test();
