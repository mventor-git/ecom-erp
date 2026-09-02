/**
 * Unit tests for the in-memory cache module.
 */
const cache = require('../cache');

beforeEach(() => {
  cache.clear();
});

describe('cache', () => {
  test('get returns undefined for missing key', () => {
    expect(cache.get('nonexistent')).toBeUndefined();
  });

  test('set and get a value', () => {
    cache.set('key1', { data: 'hello' }, 60);
    expect(cache.get('key1')).toEqual({ data: 'hello' });
  });

  test('getOrSet calls fn only on cache miss', () => {
    const fn = jest.fn(() => 'computed');
    
    // First call — cache miss, fn runs
    const result1 = cache.getOrSet('compute', fn, 60);
    expect(result1).toBe('computed');
    expect(fn).toHaveBeenCalledTimes(1);

    // Second call — cache hit, fn does NOT run
    const result2 = cache.getOrSet('compute', fn, 60);
    expect(result2).toBe('computed');
    expect(fn).toHaveBeenCalledTimes(1); // still 1
  });

  test('getOrSet with different keys calls fn each time', () => {
    const fn = jest.fn(() => 'data');
    cache.getOrSet('a', fn, 60);
    cache.getOrSet('b', fn, 60);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  test('value expires after TTL', () => {
    jest.useFakeTimers();
    cache.set('expire', 'gone', 1); // 1 second TTL
    expect(cache.get('expire')).toBe('gone');

    // Advance time past TTL
    jest.advanceTimersByTime(1500);
    expect(cache.get('expire')).toBeUndefined();
    jest.useRealTimers();
  });

  test('invalidate removes specific key', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    cache.invalidate('a');
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe(2);
  });

  test('invalidatePrefix removes keys with matching prefix', () => {
    cache.set('products:all', []);
    cache.set('products:electronics', []);
    cache.set('categories', []);
    
    cache.invalidatePrefix('products:');
    
    expect(cache.get('products:all')).toBeUndefined();
    expect(cache.get('products:electronics')).toBeUndefined();
    expect(cache.get('categories')).toEqual([]); // not affected
  });

  test('clear removes everything', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    cache.clear();
    expect(cache.stats().size).toBe(0);
  });

  test('stats returns size and keys', () => {
    cache.set('x', 10);
    cache.set('y', 20);
    const s = cache.stats();
    expect(s.size).toBe(2);
    expect(s.keys).toContain('x');
    expect(s.keys).toContain('y');
  });
});
