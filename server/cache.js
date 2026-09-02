/**
 * Simple in-memory TTL cache.
 *
 * Usage:
 *   const cache = require('./cache');
 *   const data = cache.getOrSet('products:all', () => fetchProducts(), 30);
 */

const store = new Map();

const cache = {
  /**
   * Get a cached value by key.
   * Returns undefined if not found or expired.
   */
  get(key) {
    const entry = store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiry) {
      store.delete(key);
      return undefined;
    }
    return entry.value;
  },

  /**
   * Set a cached value with TTL in seconds.
   */
  set(key, value, ttlSeconds = 30) {
    store.set(key, {
      value,
      expiry: Date.now() + ttlSeconds * 1000,
    });
  },

  /**
   * Get or compute a cached value.
   * fn is called only on cache miss.
   */
  getOrSet(key, fn, ttlSeconds = 30) {
    const existing = this.get(key);
    if (existing !== undefined) return existing;
    const value = fn();
    this.set(key, value, ttlSeconds);
    return value;
  },

  /**
   * Invalidate (delete) a specific key.
   */
  invalidate(key) {
    store.delete(key);
  },

  /**
   * Invalidate all keys matching a prefix.
   * e.g., cache.invalidatePrefix('products:')
   */
  invalidatePrefix(prefix) {
    for (const key of store.keys()) {
      if (key.startsWith(prefix)) store.delete(key);
    }
  },

  /**
   * Clear the entire cache.
   */
  clear() {
    store.clear();
  },

  /**
   * Get cache stats (for monitoring).
   */
  stats() {
    return {
      size: store.size,
      keys: Array.from(store.keys()),
    };
  },
};

module.exports = cache;
