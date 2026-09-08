/**
 * seed-rbac.js — Inserts warehouse_employee role + warehouse_staff user + permissions.
 * Safe: idempotent (ON CONFLICT DO NOTHING logic, checked via try/catch).
 * Run from server/ directory:  node seed-rbac.js
 */
const dbModule = require('./db');

async function initAndSeed() {
  // Initialize DB first (sql.js is async)
  if (dbModule.initDb) await dbModule.initDb();
  // Wait for async init to complete
  await new Promise(r => setTimeout(r, 500));

  const db = dbModule;

  // 1. Insert warehouse_employee role
  try {
    db.prepare("INSERT INTO roles (name) VALUES ('warehouse_employee')").run();
    console.log('+ role: warehouse_employee');
  } catch (e) {
    if (e.message.includes('UNIQUE') || e.message.includes('unique')) {
      console.log('= role already exists, skipping');
    } else throw e;
  }

  const roleId = db.prepare("SELECT id FROM roles WHERE name = 'warehouse_employee'").get()?.id;
  console.log('  role_id:', roleId);

  // 2. Find inventory.packing and inventory.manage permission IDs
  const packingPerm = db.prepare("SELECT id FROM permissions WHERE name = 'inventory.packing'").get();
  const managePerm  = db.prepare("SELECT id FROM permissions WHERE name = 'inventory.manage'").get();
  console.log('  inventory.packing id:', packingPerm?.id);
  console.log('  inventory.manage  id:', managePerm?.id);

  // 3. Assign permissions to warehouse_employee role
  for (const perm of [packingPerm, managePerm]) {
    if (!perm) { console.log('! permission not found, skipping'); continue; }
    try {
      db.prepare("INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)").run(roleId, perm.id);
      console.log('+ role_permission:', roleId, '->', perm.id);
    } catch (e) {
      if (e.message.includes('UNIQUE') || e.message.includes('unique')) {
        console.log('= role_permission already exists, skipping');
      } else throw e;
    }
  }

  // 4. Insert warehouse_staff user
  let userId;
  try {
    const bcrypt = require('bcryptjs');
    const hash = bcrypt.hashSync('warehouse123', 10);
    db.prepare("INSERT INTO users (email, password_hash, name, role_id, is_active) VALUES (?, ?, ?, ?, 1)")
      .run('warehouse_staff@ecom-erp.local', hash, 'Warehouse Staff', roleId);
    console.log('+ user: warehouse_staff@ecom-erp.local / warehouse123');
  } catch (e) {
    if (e.message.includes('UNIQUE') || e.message.includes('unique')) {
      console.log('= user already exists, skipping');
    } else throw e;
  }

  userId = db.prepare("SELECT id FROM users WHERE email = 'warehouse_staff@ecom-erp.local'").get()?.id;
  console.log('  user_id:', userId);

  // 5. Verify: usersWithPermission for inventory.packing
  const recipients = db.prepare(`
    SELECT DISTINCT u.id, u.email, u.name
    FROM users u
    WHERE u.is_active = 1 AND (
      u.role_id IN (SELECT role_id FROM role_permissions WHERE permission_id = (SELECT id FROM permissions WHERE name = 'inventory.packing'))
    )
  `).all();
  console.log('usersWithPermission(inventory.packing):', recipients);

  // 6. Check issue_orders (safe for notification test)
  const issueOrders = db.prepare("SELECT id, order_number, status FROM issue_orders ORDER BY id DESC LIMIT 5").all();
  console.log('issue_orders:', issueOrders);

  // 7. Check current notifications
  const notifs = db.prepare("SELECT id, user_id, title, message FROM in_app_notifications ORDER BY id DESC LIMIT 5").all();
  console.log('in_app_notifications count:', notifs.length, notifs);

  // 8. Force flush to persist changes
  if (dbModule.flushSave) dbModule.flushSave();
  if (dbModule.saveDb) dbModule.saveDb();
  console.log('=== RBAC Seed Complete ===');
  return { roleId, userId };
}

initAndSeed().catch(e => { console.error('Seed error:', e); process.exit(1); });
