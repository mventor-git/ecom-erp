const db = require('../db');

const cache = new Map();
let cacheLoaded = false;

function parseValue(raw, type) {
  if (raw === null || raw === undefined) return null;
  switch (type) {
    case 'number': return Number(raw);
    case 'boolean': return raw === '1' || raw === 'true';
    case 'json':
      try { return JSON.parse(raw); } catch { return null; }
    default: return raw;
  }
}

function serializeValue(value, type) {
  if (value === null || value === undefined) return null;
  switch (type) {
    case 'boolean': return value ? '1' : '0';
    case 'json': return typeof value === 'string' ? value : JSON.stringify(value);
    case 'number': return String(value);
    default: return String(value);
  }
}

function loadCache() {
  if (cacheLoaded) return;
  const rows = db.prepare('SELECT * FROM settings').all();
  rows.forEach(row => {
    cache.set(row.key, row);
  });
  cacheLoaded = true;
}

function invalidateCache() {
  cache.clear();
  cacheLoaded = false;
}

function get(key, defaultValue) {
  loadCache();
  const row = cache.get(key);
  if (!row) return defaultValue !== undefined ? defaultValue : null;
  return parseValue(row.value, row.type);
}

function set(key, value, userId) {
  loadCache();
  const existing = cache.get(key);
  if (!existing) {
    throw new Error(`Setting "${key}" not found`);
  }
  const serialized = serializeValue(value, existing.type);
  db.prepare(`
    UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP, updated_by = ?
    WHERE key = ?
  `).run(serialized, userId || null, key);
  const updated = db.prepare('SELECT * FROM settings WHERE key = ?').get(key);
  cache.set(key, updated);
  return { ...updated, parsed_value: parseValue(updated.value, updated.type) };
}

function getByCategory(category) {
  loadCache();
  const rows = [];
  for (const row of cache.values()) {
    if (row.category === category) {
      rows.push({ ...row, parsed_value: parseValue(row.value, row.type) });
    }
  }
  return rows;
}

function getAll() {
  loadCache();
  const rows = [];
  for (const row of cache.values()) {
    rows.push({ ...row, parsed_value: parseValue(row.value, row.type) });
  }
  return rows;
}

function getPublic() {
  loadCache();
  const rows = [];
  for (const row of cache.values()) {
    if (row.is_public) {
      rows.push({ key: row.key, value: parseValue(row.value, row.type), type: row.type, category: row.category, description: row.description });
    }
  }
  return rows;
}

/**
 * Site Identity (mventor-ticket-056): the platform is fully rebrandable —
 * nothing user-facing may hardcode a brand name. Everything reads these.
 */
function siteIdentity() {
  return {
    name: get('store_name', 'E-Commerce') || 'E-Commerce',
    logoUrl: get('site_logo_url', '') || '',
    tagline: get('site_tagline', '') || '',
  };
}

module.exports = {
  get,
  set,
  getByCategory,
  getAll,
  getPublic,
  siteIdentity,
  invalidateCache,
};
