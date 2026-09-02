const db = require('./db');

db.initPromise.then(() => {
  console.log('=== Database Schema Verification ===');
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
  console.log('Tables:', tables.map(t => t.name).join(', '));
  
  console.log('\n=== Data Integrity Check ===');
  const products = db.prepare('SELECT COUNT(*) as count FROM products').get();
  console.log('Products:', products.count);
  
  const categories = db.prepare('SELECT COUNT(*) as count FROM categories').get();
  console.log('Categories:', categories.count);
  
  const brands = db.prepare('SELECT COUNT(*) as count FROM brands').get();
  console.log('Brands:', brands.count);
  
  const orders = db.prepare('SELECT COUNT(*) as count FROM orders').get();
  console.log('Orders:', orders.count);
  
  const warehouses = db.prepare('SELECT COUNT(*) as count FROM warehouses').get();
  console.log('Warehouses:', warehouses.count);
  
  const inventory = db.prepare('SELECT COUNT(*) as count FROM inventory').get();
  console.log('Inventory records:', inventory.count);
  
  const movements = db.prepare('SELECT COUNT(*) as count FROM inventory_movements').get();
  console.log('Inventory movements:', movements.count);
  
  const events = db.prepare('SELECT COUNT(*) as count FROM events').get();
  console.log('Events:', events.count);
  
  const roles = db.prepare('SELECT COUNT(*) as count FROM roles').get();
  console.log('Roles:', roles.count);
  
  const permissions = db.prepare('SELECT COUNT(*) as count FROM permissions').get();
  console.log('Permissions:', permissions.count);
  
  const users = db.prepare('SELECT COUNT(*) as count FROM users').get();
  console.log('Users:', users.count);
  
  console.log('\n=== ERP Tables Detail ===');
  const warehouseList = db.prepare('SELECT id, name, code FROM warehouses').all();
  console.log('Warehouses:', warehouseList);
  
  const roleList = db.prepare('SELECT id, name, description FROM roles').all();
  console.log('Roles:', roleList);
  
  const userList = db.prepare('SELECT id, email, name, role_id FROM users').all();
  console.log('Users:', userList);
  
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
