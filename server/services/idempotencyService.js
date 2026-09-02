/**
 * Idempotency Service (mventor-ticket-052 / STEP 15).
 * In-memory idempotency-key cache: repeated requests with the same
 * `Idempotency-Key` header return the original response instead of
 * executing again (protects checkout + inventory movements from
 * double-submits / webhook replays).
 */

const TTL_MS = 15 * 60 * 1000; // 15 minutes

const store = new Map(); // key -> { expiresAt, body, status }

function keyFor(req) {
  const header = req.headers['idempotency-key'] || req.headers['Idempotency-Key'];
  if (!header) return null;
  const method = req.method;
  const path = req.originalUrl || req.url;
  return `${method} ${path} :: ${String(header).trim()}`;
}

function get(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry;
}

function set(key, status, body) {
  store.set(key, { expiresAt: Date.now() + TTL_MS, status, body });
  // light cleanup: drop expired entries occasionally
  if (store.size > 500) {
    const now = Date.now();
    for (const [k, v] of store) {
      if (now > v.expiresAt) store.delete(k);
    }
  }
}

/**
 * Express middleware: if an Idempotency-Key header is present and the key
 * was already processed, respond with the cached result. Otherwise run the
 * handler and cache its JSON response.
 */
function idempotency(req, res, next) {
  const key = keyFor(req);
  if (!key) return next();

  const cached = get(key);
  if (cached) {
    return res.status(cached.status).json(cached.body);
  }

  const originalJson = res.json.bind(res);
  res.json = (body) => {
    set(key, res.statusCode, body);
    return originalJson(body);
  };

  next();
}

module.exports = { idempotency, get, set, keyFor };
