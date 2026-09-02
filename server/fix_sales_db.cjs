const db = require('/d/Projects/on-dev/comfort-sign-deploy/server/db');
const bcrypt = require('bcryptjs');
db.initPromise.then(async () => {
  const p = db.prepare;
  const hash = bcrypt.hashSync('testpass123');
  p('UPDATE users SET password_hash = ? WHERE email = ?').run(hash, 'test@sales.local');
  const u = p('SELECT id, email, password_hash FROM users WHERE email = ?').get('test@sales.local');
  console.log('Updated:', u ? u.email : 'NOT FOUND', '| id:', u?.id);
  console.log('Match:', bcrypt.compareSync('testpass123', u?.password_hash || ''));
}).catch(e => console.error('DB error:', e));
