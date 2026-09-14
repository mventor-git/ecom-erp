/**
 * Per-file post-test cleanup for GL-coupled movements (mventor-ticket-093).
 *
 * Since 093, ledger-owned stock movements post journals at creation time.
 * Many older suites delete their movement rows in cleanup — which would
 * orphan those journals. This global afterAll removes ONLY journals whose
 * source movement no longer exists: in production that set is permanently
 * empty (movements are history and are never deleted), so this sweep can
 * only ever collect test artifacts — financial history of real operations
 * is structurally untouchable by it.
 *
 * Registered via setupFilesAfterEach; uses require.cache so files that never
 * loaded db (pure unit tests) are completely untouched.
 */
const ORPHAN_SQL = `
  DELETE FROM journal_entries
  WHERE source_type = 'inventory_movement'
    AND source_event LIKE 'stock_%'
    AND CAST(source_id AS INTEGER) NOT IN (SELECT id FROM inventory_movements)
`;

afterAll(async () => {
  try {
    const key = require.resolve('../db');
    const cached = require.cache[key];
    if (!cached) return; // this file never booted the DB — nothing of ours to clean
    const db = cached.exports;
    if (db && db.initPromise) await db.initPromise;
    db.prepare(ORPHAN_SQL).run();
  } catch { /* cleanup must never fail a suite */ }
});
