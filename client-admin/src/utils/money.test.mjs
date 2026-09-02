import { test } from 'node:test';
import assert from 'node:assert/strict';
import { centsToEGPInput, egpToCents, egpErrorText, MAX_EGP_DECIMALS } from './money.js';

test('centsToEGPInput: converts DB cents to a clean major-unit string', () => {
  assert.equal(centsToEGPInput(25000), '250');
  assert.equal(centsToEGPInput(9999), '99.99');
  assert.equal(centsToEGPInput(50), '0.50');
  assert.equal(centsToEGPInput(500), '5');
  assert.equal(centsToEGPInput(1), '0.01');
  assert.equal(centsToEGPInput(0), '0');
  assert.equal(centsToEGPInput(null), '');
  assert.equal(centsToEGPInput(undefined), '');
  assert.equal(centsToEGPInput(NaN), '');
});

test('egpToCents: valid human EGP -> INTEGER cents', () => {
  assert.deepEqual(egpToCents('250'), { ok: true, cents: 25000 });
  assert.deepEqual(egpToCents('99.99'), { ok: true, cents: 9999 });
  assert.deepEqual(egpToCents('0.50'), { ok: true, cents: 50 });
  assert.deepEqual(egpToCents('0'), { ok: true, cents: 0 });
  assert.deepEqual(egpToCents('0.5'), { ok: true, cents: 50 });
  assert.deepEqual(egpToCents('250.00'), { ok: true, cents: 25000 });
  assert.deepEqual(egpToCents(250), { ok: true, cents: 25000 });   // numeric input ok
  assert.deepEqual(egpToCents(99.99), { ok: true, cents: 9999 });  // float input, 2dp exactly
});

test('egpToCents: rejects invalid input', () => {
  assert.deepEqual(egpToCents(''), { ok: false, reason: 'empty' });
  assert.deepEqual(egpToCents('   '), { ok: false, reason: 'empty' });
  assert.deepEqual(egpToCents(null), { ok: false, reason: 'empty' });
  assert.deepEqual(egpToCents(undefined), { ok: false, reason: 'empty' });
  assert.deepEqual(egpToCents('abc'), { ok: false, reason: 'malformed' });
  assert.deepEqual(egpToCents('12,50'), { ok: false, reason: 'malformed' });
  assert.deepEqual(egpToCents('1e3'), { ok: false, reason: 'malformed' });
  assert.deepEqual(egpToCents('-10'), { ok: false, reason: 'negative' });
  assert.deepEqual(egpToCents('-0.01'), { ok: false, reason: 'negative' });
  assert.deepEqual(egpToCents('99.999'), { ok: false, reason: 'too_precise' });
});

test('egpErrorText: every reason maps to a readable message', () => {
  assert.equal(egpErrorText('empty'), 'Required');
  assert.equal(egpErrorText('malformed'), 'Enter a valid number');
  assert.equal(egpErrorText('negative'), 'Cannot be negative');
  assert.equal(egpErrorText('too_precise'), `Max ${MAX_EGP_DECIMALS} decimals`);
  assert.equal(egpErrorText('unknown'), 'Invalid value');
});

// Documented invariant from the audit: DB INTEGER = cents, UI input = EGP.
test('invariant: edit 250 EGP -> 25000 cents -> displays back as 250', () => {
  const saved = egpToCents('250');
  assert.equal(saved.ok, true);
  assert.equal(saved.cents, 25000);
  assert.equal(centsToEGPInput(saved.cents), '250');
});

test('invariant: 99.99 EGP stays exact across round-trip', () => {
  const saved = egpToCents('99.99');
  assert.equal(saved.ok, true);
  assert.equal(saved.cents, 9999);
  assert.equal(centsToEGPInput(saved.cents), '99.99');
});
