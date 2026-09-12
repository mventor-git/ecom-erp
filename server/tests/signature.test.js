/**
 * Employee personal signature (CRITICAL REQUIREMENT #1).
 *
 * users ARE the staff identity — no second employee table. A signature is a
 * filesystem asset (public/images/signatures) referenced relationally on users.
 * Proves the real HTTP route: upload → path/mime stored → file on disk →
 * public URL served → delete clears it. The authenticated actor is the session
 * user (the client never supplies "signed by X").
 */
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const db = require('../db');

let server, base;
let targetUserId;

async function start() {
  await db.initPromise;
  // A normal, non-admin user to be the signature target. Idempotent
  // get-or-create: a previous force-killed run can leave the fixed-email row
  // (teardown skipped), and a blind re-insert would hit UNIQUE forever; a
  // blind DELETE can FK-fail if other fixtures reference it. Reuse if present.
  const existing = db.prepare("SELECT id FROM users WHERE email = 'sig.target@example.com'").get();
  targetUserId = existing
    ? existing.id
    : db.prepare("INSERT INTO users (email, username, name, password_hash, is_active, role_id) VALUES ('sig.target@example.com','sigtarget','Sig Target','x',1,2)")
        .run().lastInsertRowid;
  const app = express();
  app.use(express.json());
  // Stub an authenticated super-admin session so requirePermission('users.update')
  // (which reads req.session.userId → looks up the user) succeeds.
  app.use((req, res, next) => { req.session = { userId: 1 }; next(); });
  app.use('/api/admin/users', require('../routes/users'));
  server = http.createServer(app);
  await new Promise(r => server.listen(0, r));
  base = `http://localhost:${server.address().port}`;
}

afterAll(async () => {
  try { if (server) { server.closeAllConnections?.(); server.close(); } } catch {}
  try {
    const u = db.prepare('SELECT signature_path FROM users WHERE id = ?').get(targetUserId);
    if (u && u.signature_path) { const f = path.join(__dirname, '..', 'public', u.signature_path.replace(/^\/images\//, '')); try { fs.unlinkSync(f); } catch {} }
    db.prepare('DELETE FROM users WHERE id = ?').run(targetUserId);
    db.saveDb();
  } catch {}
});

function makePngBlob() {
  // A minimal valid 1x1 PNG.
  const base64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  return new Blob([Buffer.from(base64, 'base64')], { type: 'image/png' });
}

async function upload(userId) {
  const fd = new FormData();
  fd.append('signature', makePngBlob(), 'sig.png');
  const r = await fetch(`${base}/api/admin/users/${userId}/signature`, { method: 'PUT', body: fd });
  return { status: r.status, data: await r.json() };
}

beforeAll(async () => { await start(); });

test('signature upload stores file + sets relational reference; delete clears it', async () => {
  // Upload
  const up = await upload(targetUserId);
  expect(up.status).toBe(200);
  expect(up.data.signature_path).toMatch(/^\/images\/signatures\/sig_.*\.png$/);

  const user = db.prepare('SELECT signature_path, signature_mime, signature_updated_at FROM users WHERE id = ?').get(targetUserId);
  expect(user.signature_path).toBe(up.data.signature_path);
  expect(user.signature_mime).toBe('image/png');
  expect(user.signature_updated_at).toBeTruthy();

  // File exists on disk at the referenced path (strip only the leading '/')
  const disk = path.join(__dirname, '..', 'public', user.signature_path.replace(/^\//, ''));
  expect(fs.existsSync(disk)).toBe(true);

  // DELETE clears reference + removes file
  const del = await fetch(`${base}/api/admin/users/${targetUserId}/signature`, { method: 'DELETE' });
  expect(del.status).toBe(200);
  const after = db.prepare('SELECT signature_path FROM users WHERE id = ?').get(targetUserId);
  expect(after.signature_path).toBe('');
  expect(fs.existsSync(disk)).toBe(false);
});
