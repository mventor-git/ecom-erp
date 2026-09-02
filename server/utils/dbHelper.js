/**
 * Thin DB helper to reduce the ~10 repeated `db.prepare(...).get()/.run()/.all()`
 * patterns across routes/orders/admin/etc.
 *
 * Does NOT replace repository layer — only removes boilerplate for simple
 * get-one / get-many / insert / update-by-id queries.
 */
const db = require('../db');

function getRow(table, idColumn = 'id', idValue) {
  if (idValue === undefined || idValue === null) return null;
  const row = db.prepare(`SELECT * FROM ${table} WHERE ${idColumn} = ?`).get(idValue);
  return row || null;
}

function getRows(table, column, value) {
  if (value === undefined || value === null) return [];
  return db.prepare(`SELECT * FROM ${table} WHERE ${column} = ?`).all(value) || [];
}

function getMany(sql, params = []) {
  return db.prepare(sql).all(...(Array.isArray(params) ? params : [params])) || [];
}

function insert(table, obj) {
  const keys = Object.keys(obj);
  const cols = keys.join(', ');
  const placeholders = keys.map(() => '?').join(', ');
  const result = db.prepare(`INSERT INTO ${table} (${cols}) VALUES (${placeholders})`).run(...Object.values(obj));
  return result;
}

function update(table, idColumn, idValue, obj) {
  const sets = Object.keys(obj).map(k => `${k} = ?`).join(', ');
  const result = db.prepare(`UPDATE ${table} SET ${sets} WHERE ${idColumn} = ?`).run(...Object.values(obj), idValue);
  return result;
}

function deleteRow(table, idColumn, idValue) {
  return db.prepare(`DELETE FROM ${table} WHERE ${idColumn} = ?`).run(idValue);
}

function getFirst(query, params = []) {
  return db.prepare(query).get(...(Array.isArray(params) ? params : [params])) || null;
}

module.exports = {
  getRow, getRows, getMany, insert, update, deleteRow, getFirst,
};
