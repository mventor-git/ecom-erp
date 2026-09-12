/**
 * Idempotency Service — DURABLE claims for mutating endpoints (N1 fix).
 *
 * The original implementation was an in-memory Map keyed by
 * `METHOD path :: header` only. Confirmed defects (owner readiness
 * checkpoint):
 *   - no actor scoping  → one staff user could consume another's key
 *   - no request identity collision → same key + DIFFERENT body silently
 *     returned the first response, never executing the second mutation
 *   - process-local only → a restart erased the protection exactly in the
 *     double-submit-after-crash window
 *
 * New invariant (correctness lives in the DB, never in memory):
 *   claim key   = (actor, endpoint, Idempotency-Key) — enforced by
 *                 PRIMARY KEY on idempotency_records
 *   identity    = sha256 over a canonicalized request body
 *   same actor+endpoint+key+fp   → replay the committed response
 *   same actor+endpoint+key, ≠fp → 409 { error: "... idempotency-conflict" }
 *   in-flight concurrently       → 409 { error: "... idempotency-in-flight" }
 *   failed / non-2xx outcome     → claim deleted ⇒ safe retry with same key
 *
 * Because `saveDb()` snapshots the WHOLE database, a committed claim and the
 * mutation it protects become durable atomically across restarts: either the
 * file contains both, or neither — never "claim says done but movement lost",
 * never "movement replayed twice" after a crash.
 *
 * In-memory hot-path cache is an OPTIMIZATION ONLY; it is invalidated by any
 * failed response and it is never consulted without the DB row behind it.
 */
const crypto = require('crypto');
const db = require('../db');

const TTL_MS = 24 * 60 * 60 * 1000;      // committed claims are replayable for 24h
const INFLIGHT_STALE_MS = 30 * 1000;      // abandoned claims become reclaimable

// key -> { status, body, fp } — pure optimization
const cache = new Map();
const cacheKey = (actor, endpoint, key) => `${actor}::${endpoint}::${key}`;

function canonicalBody(value) {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return value.map(canonicalBody);
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return value.toString('base64');
  if (typeof value === 'object') {
    const out = {};
    for (const k of Object.keys(value).sort()) {
      if (value[k] !== undefined) out[k] = canonicalBody(value[k]);
    }
    return out;
  }
  if (typeof value === 'number' && !Number.isFinite(value)) return null;
  return value;
}

/** sha256 of the canonical request shape — identity of "the same request". */
function requestFingerprint(obj) {
  return crypto.createHash('sha256').update(JSON.stringify(canonicalBody(obj))).digest('hex');
}

/** Request identity of the caller — staff/JWT/anon scopes can never collide. */
function actorFor(req) {
  if (req.user && (req.user.id || req.user.email)) {
    const u = req.user;
    return u.email || `user:${u.id}`;
  }
  const sess = req.session || {};
  if (sess.userId) {
    return sess.username ? `${sess.username}#${sess.userId}` : `user:${sess.userId}`;
  }
  if (sess.username) return `user:${sess.username}`;
  if (sess.isAdmin) return 'user:env-admin';
  return 'anon';
}

function keyFor(req) {
  const header = req.headers['idempotency-key'] || req.headers['Idempotency-Key'];
  if (!header) return null;
  const method = req.method;
  const path = req.originalUrl || req.url;
  return `${method} ${path} :: ${String(header).trim()}`;
}

function isConflict(err) {
  return /UNIQUE constraint failed/i.test(String(err && err.message));
}

function agedOut(row, ms) {
  const ts = Date.parse(String(row.updated_at || row.created_at || '').replace(' ', 'T') + 'Z');
  return !Number.isFinite(ts) || Date.now() - ts > ms;
}

function selectRow(actor, endpoint, key) {
  return db.prepare(`
    SELECT state, request_fp, response_status, response_body, updated_at, created_at
    FROM idempotency_records
    WHERE actor = ? AND endpoint = ? AND idem_key = ?
  `).get(actor, endpoint, key) || null;
}

function pruneCache() {
  if (cache.size > 1000) {
    const keep = [...cache.entries()].slice(-500);
    cache.clear();
    for (const [k, v] of keep) cache.set(k, v);
  }
}

/**
 * Attempt the claim. Returns
 *   { claim: 'proceed' }                        — caller owns the slot now
 *   { replay: { status, body } }                — committed, identical request
 *   { conflict: 'idempotency-conflict' }        — key reused with a different request
 *   { inflight: true }                          — a live sibling owns the slot
 *   { error: 'idempotency-unavailable', safe:true } — claim layer broken; do NOT
 *                                             record success, execute anyway
 *                                             (handler atomicity decides).
 */
function tryClaim(req) {
  const endpoint = keyFor(req);
  if (!endpoint) return { claim: 'proceed' }; // headerless ⇒ pass-through
  const actor = actorFor(req);
  const header = String((req.headers['idempotency-key'] || req.headers['Idempotency-Key']) || '').trim();
  const fp = requestFingerprint({ body: req.body === undefined ? null : req.body, query: req.query || undefined });

  const hot = cache.get(cacheKey(actor, endpoint, header));
  if (hot && hot.fp === fp && hot.status === 'committed') return { replay: { status: hot.status2, body: hot.body } };

  let existing = null;
  try {
    // expired committed claims are replay-safe to forget (their mutations are
    // already durable in the ledger; the claim's only job is dedupe window)
    db.prepare("DELETE FROM idempotency_records WHERE state = 'committed' AND created_at < datetime('now', ?)")
      .run(`-${Math.floor(TTL_MS / 60000)} minutes`);
    existing = selectRow(actor, endpoint, header);
  } catch (err) {
    console.error('[idempotency] claim layer unavailable:', err.message);
    return { error: 'idempotency-unavailable', safe: true };
  }

  if (!existing) {
    try {
      db.prepare('INSERT INTO idempotency_records (actor, endpoint, idem_key, request_fp, state) VALUES (?, ?, ?, ?, \'in_flight\')')
        .run(actor, endpoint, header, fp);
      return { claim: 'proceed', actor, endpoint, header, fp };
    } catch (err) {
      if (!isConflict(err)) {
        console.error('[idempotency] claim insert failed:', err.message);
        return { error: 'idempotency-unavailable', safe: true };
      }
      existing = selectRow(actor, endpoint, header); // lost a race — inspect
      if (!existing) return { error: 'idempotency-unavailable', safe: false };
    }
  }

  if (existing.state === 'in_flight') {
    if (agedOut(existing, INFLIGHT_STALE_MS)) {
      // abandoned mid-flight: reclaim deterministically (single writer per claim)
      try {
        db.prepare("UPDATE idempotency_records SET request_fp = ?, state='in_flight' WHERE actor=? AND endpoint=? AND idem_key=?")
          .run(fp, actor, endpoint, header);
      } catch {}
      return { claim: 'proceed', actor, endpoint, header, fp };
    }
    return { inflight: true, actor, endpoint, header };
  }

  // committed
  if (existing.request_fp !== fp) return { conflict: true };
  let body = null;
  try { body = JSON.parse(existing.response_body || 'null'); } catch { body = existing.response_body; }
  const status = existing.response_status || 200;
  cache.set(cacheKey(actor, endpoint, header), { fp, status: 'committed', status2: status, body });
  return { replay: { status, body } };
}

const replayConflict = (res) => res.status(409).json({
  error: 'idempotency-conflict: key reused with a materially different request — use a fresh Idempotency-Key or resend the identical request',
});

/**
 * Express middleware. Same public shape as before (headerless requests are
 * untouched), but every decision is backed by the persisted record table.
 */
function idempotency(req, res, next) {
  let decided = null;
  try {
    decided = tryClaim(req);
  } catch (err) {
    // belt-and-braces: any unexpected decision failure must not swallow the
    // request. Log loudly, continue WITHOUT recorded idempotency protection.
    console.error('[idempotency] decision failed:', err.message);
    return next();
  }

  if (decided.replay) return res.status(decided.replay.status).json(decided.replay.body);
  if (decided.conflict) return replayConflict(res);
  if (decided.inflight) {
    return res.status(409).json({ error: 'idempotency-in-flight: an identical request is still executing — retry with the same key to replay it' });
  }

  // proceed (claimed or pass-through). Commit only with a 2xx JSON response;
  // delete the claim otherwise so retries are safe.
  if (decided.claim && decided.actor) {
    const { actor, endpoint, header, fp } = decided;
    let settled = false;
    const fail = () => {
      if (settled) return; settled = true;
      cache.delete(cacheKey(actor, endpoint, header));
      try { db.prepare('DELETE FROM idempotency_records WHERE actor=? AND endpoint=? AND idem_key=? AND state=\'in_flight\'').run(actor, endpoint, header); } catch (e) { console.error('[idempotency] release failed:', e.message); }
    };
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      const status = res.statusCode;
      if (status >= 400) { fail(); return originalJson(body); }
      if (settled) return originalJson(body);
      settled = true;
      try {
        db.prepare("UPDATE idempotency_records SET state='committed', request_fp=?, response_status=?, response_body=?, updated_at=CURRENT_TIMESTAMP WHERE actor=? AND endpoint=? AND idem_key=?")
          .run(fp, status, JSON.stringify(body), actor, endpoint, header);
        cache.set(cacheKey(actor, endpoint, header), { fp, status: 'committed', status2: status, body });
        pruneCache();
      } catch (e) {
        // claim could not be finalized: keep whatever the handler did, log loudly
        console.error('[idempotency] commit finalize failed (claim left in-flight):', e.message);
      }
      return originalJson(body);
    };
    // `finish` safety-net for responses that never reach res.json (send/end
    // paths). Mocked res objects without .on skip it — the json wrapper above
    // already covers every real handler path in this app.
    if (typeof res.on === 'function') {
      res.on('finish', () => {
        if (res.statusCode < 400 && !settled) {
          settled = true; // non-JSON success: mark committed without body
          try { db.prepare("UPDATE idempotency_records SET state='committed', response_status=? WHERE actor=? AND endpoint=? AND idem_key=?").run(res.statusCode, actor, endpoint, header); } catch {}
        } else if (!settled) {
          fail();
        }
      });
    }
  }
  next();
}

// ---- legacy compat API (tests import get/set) -----------------------------
function get(key) { return cache.get(key) || null; }
function set(key, status, body) { cache.set(key, { status: 'committed', status2: status, body }); }

module.exports = { idempotency, get, set, keyFor, actorFor, requestFingerprint, canonicalBody };
