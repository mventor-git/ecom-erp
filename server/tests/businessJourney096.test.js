/**
 * mventor-ticket-096 — product acceptance gate.
 *
 * Runs the FULL business journey on a BRAND-NEW database over real HTTP
 * (the probe spawns its own server instance): wizard -> setup -> import ->
 * purchase -> AP -> sales/settlements -> returns/refunds -> adjustments ->
 * statements -> both reconciliations -> audit -> negative money-fabrication
 * probes. This suite is the mission's "a person can actually run a company"
 * proof; its failure report is the journey's own step-by-step log.
 */
const { spawn } = require('child_process');
const path = require('path');

test('FRESH-INSTALL BUSINESS JOURNEY passes end-to-end over real HTTP', (done) => {
  const probe = path.join('probes', 'businessJourney096.js');
  const child = spawn('node', [probe], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: '' },
    windowsHide: true,
  });
  let out = '';
  child.stdout.on('data', (d) => { out += d; });
  child.stderr.on('data', (d) => { out += d; });
  child.on('close', (code) => {
    const line = (s) => s.split(/\r?\n/).filter((l) => /JOURNEY \d+\/\d+|FAIL : |ERROR|SERVER TAIL/.test(l)).join('\n');
    console.log('\n=== BUSINESS JOURNEY (fresh DB, real HTTP) ===\n' + line(out));
    expect(code).toBe(0);
    expect(/FAIL : /.test(out)).toBe(false);
    done();
  });
}, 240000);
