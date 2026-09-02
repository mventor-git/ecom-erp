/**
 * Integration test runner.
 * Starts server -> runs Jest API tests -> stops server.
 *
 * Pre-seeds a known staff user (delete-then-insert) so mobile JWT login
 * tests have deterministic credentials, and removes it afterwards.
 *
 * Usage: node run-integration-tests.js
 */
const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const PORT = 3099;

const TEST_STAFF_EMAIL = 'integration.staff@comfortsign.local';
const TEST_STAFF_PASSWORD = 'IntegrationTest123!';

// Pre-seed staff user for mobile JWT tests (before server starts)
function seedTestUser() {
  return new Promise((resolve, reject) => {
    const DB_PATH = path.join(__dirname, 'data', 'store.db');
    if (!fs.existsSync(DB_PATH)) return resolve();

    const initSqlJs = require('sql.js');
    const bcrypt = require('bcryptjs');

    initSqlJs().then(SQL => {
      const db = new SQL.Database(fs.readFileSync(DB_PATH));

      const roleRes = db.exec("SELECT id FROM roles WHERE name = 'super_admin'");
      const roleId = roleRes[0]?.values?.[0]?.[0];
      if (!roleId) {
        console.warn('super_admin role not found — skipping staff user seed');
        return resolve();
      }

      // Deterministic: remove any previous test user, then insert fresh
      db.run('DELETE FROM users WHERE email = ?', [TEST_STAFF_EMAIL]);
      const hash = bcrypt.hashSync(TEST_STAFF_PASSWORD, 10);
      db.run(
        'INSERT INTO users (email, password_hash, name, role_id, is_active) VALUES (?, ?, ?, ?, 1)',
        [TEST_STAFF_EMAIL, hash, 'Integration Test Staff', roleId]
      );

      fs.writeFileSync(DB_PATH, Buffer.from(db.export()));
      console.log(`Seeded test staff user: ${TEST_STAFF_EMAIL}`);
      resolve();
    }).catch(reject);
  });
}

// Remove the test staff user and any mobile test customers after tests finish
function cleanupTestUser() {
  const DB_PATH = path.join(__dirname, 'data', 'store.db');
  if (!fs.existsSync(DB_PATH)) return;

  const initSqlJs = require('sql.js');
  initSqlJs().then(SQL => {
    const db = new SQL.Database(fs.readFileSync(DB_PATH));
    db.run('DELETE FROM users WHERE email = ?', [TEST_STAFF_EMAIL]);
    db.run("DELETE FROM customers WHERE email LIKE 'mobile.customer.%@test.com'");
    fs.writeFileSync(DB_PATH, Buffer.from(db.export()));
    console.log(`Removed test staff user: ${TEST_STAFF_EMAIL} and mobile test customers`);
  }).catch(err => {
    console.error('Cleanup warning (non-fatal):', err.message);
  });
}

console.log(`Starting server on port ${PORT}...`);

seedTestUser().then(() => {
  const server = spawn('node', ['index.js'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      PORT: String(PORT),
      STRIPE_SECRET_KEY: 'sk_test_dummy',
      SESSION_SECRET: 'jest-int-test',
      ADMIN_USERNAME: 'admin',
      ADMIN_PASSWORD: 'test',
      CLIENT_URL: 'http://localhost:5173',
      SMTP_HOST: '',
      SMTP_USER: '',
      SMTP_PASS: '',
    },
  });

  server.on('error', (err) => {
    console.error('Failed to start server:', err);
    cleanupTestUser();
    process.exit(1);
  });

  setTimeout(() => {
    console.log('\nRunning integration tests...\n');

    try {
      const result = execSync(
        `npx jest --testPathPatterns tests/api.test --testPathPatterns tests/mobileApi.test --verbose --forceExit`,
        { cwd: __dirname, stdio: 'inherit', env: { ...process.env, PORT: String(PORT) }, shell: true }
      );
      server.kill();
      cleanupTestUser();
      process.exit(0);
    } catch (err) {
      server.kill();
      cleanupTestUser();
      process.exit(err.status || 1);
    }
  }, 5000);
}).catch(err => {
  console.error('Failed to seed test user:', err);
  process.exit(1);
});
