/**
 * Isolated test runner (stabilization #12).
 *
 * Snapshots the current live store.db to data/store.test.db and runs the
 * suites against the COPY (via ECOM_DB_PATH), so repeated/CI runs are
 * deterministic and the live DB file is never mutated. The copy is deleted
 * at the end. The default `npm test` / `npm run test:integration` behavior
 * is unchanged (live file, house-cleaning fixtures).
 *
 * Usage:
 *   node run-isolated-tests.js              # unit suites on a snapshot copy
 *   node run-isolated-tests.js integration  # integration suites on a snapshot
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const LIVE = path.join(__dirname, 'data', 'store.db');
const COPY = path.join(__dirname, 'data', 'store.test.db');

if (!fs.existsSync(LIVE)) {
  console.error('run-isolated-tests: live database not found at', LIVE);
  process.exit(1);
}
fs.copyFileSync(LIVE, COPY);
console.log(`Isolated DB: ${COPY} (snapshot of store.db ${new Date().toISOString()})`);

const mode = process.argv[2] === 'integration' ? 'integration' : 'unit';
// `npm` is a batch shim on Windows; shell:true is required (Node >=18 rejects
// spawning .cmd without it). Failures are surfaced loudly - never silent.
const args = mode === 'integration' ? ['run', 'test:integration'] : ['test'];
const result = spawnSync('npm', args, {
  cwd: __dirname,
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, ECOM_DB_PATH: COPY },
});

for (const ext of ['', '-wal', '-shm']) {
  try { fs.rmSync(COPY + ext, { force: true }); } catch {}
}
if (result.error) console.error('runner spawn error:', result.error.message);
console.log(`Isolated run finished (exit ${result.status}). Copy removed; live store.db untouched.`);
process.exit(result.status == null ? 1 : result.status);
