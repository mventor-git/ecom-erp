/**
 * Unit tests for the validation module.
 */
const v = require('../validate');

describe('validateProduct', () => {
  test('valid product passes', () => {
    const result = v.validateProduct({
      name: 'Test Widget',
      price: 19.99,
      category_id: 1,
      description: 'A widget',
      image_url: '/images/test.png',
      stock: 10,
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.data.name).toBe('Test Widget');
    expect(result.data.price).toBe(19.99);
    expect(result.data.category_id).toBe(1);
  });

  test('empty name fails', () => {
    const result = v.validateProduct({ name: '', price: 10, category_id: 1 });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Product name is required (max 200 chars)');
  });

  test('negative price fails', () => {
    const result = v.validateProduct({ name: 'Test', price: -5, category_id: 1 });
    expect(result.valid).toBe(false);
  });

  test('zero price fails', () => {
    const result = v.validateProduct({ name: 'Test', price: 0, category_id: 1 });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Price must be greater than 0');
  });

  test('missing category_id fails', () => {
    const result = v.validateProduct({ name: 'Test', price: 10, category_id: null });
    expect(result.valid).toBe(false);
  });

  test('long name is truncated', () => {
    const longName = 'x'.repeat(300);
    const result = v.validateProduct({ name: longName, price: 10, category_id: 1 });
    expect(result.valid).toBe(true);
    expect(result.data.name.length).toBe(200);
  });

  test('price is rounded to 2 decimals', () => {
    const result = v.validateProduct({ name: 'Test', price: 19.999, category_id: 1 });
    expect(result.data.price).toBe(20.00);
  });
});

describe('validateLogin', () => {
  test('valid login passes', () => {
    const result = v.validateLogin({ username: 'admin', password: 'secret' });
    expect(result.valid).toBe(true);
    expect(result.data.username).toBe('admin');
  });

  test('empty username fails', () => {
    const result = v.validateLogin({ username: '', password: 'secret' });
    expect(result.valid).toBe(false);
  });

  test('empty password fails', () => {
    const result = v.validateLogin({ username: 'admin', password: '' });
    expect(result.valid).toBe(false);
  });
});

describe('validateOrderStatus', () => {
  test('valid status passes', () => {
    expect(v.validateOrderStatus({ status: 'paid' }).valid).toBe(true);
    expect(v.validateOrderStatus({ status: 'shipped' }).valid).toBe(true);
    expect(v.validateOrderStatus({ status: 'cancelled' }).valid).toBe(true);
    expect(v.validateOrderStatus({ status: 'pending' }).valid).toBe(true);
  });

  test('invalid status fails', () => {
    const result = v.validateOrderStatus({ status: 'invalid' });
    expect(result.valid).toBe(false);
  });

  test('case insensitive', () => {
    expect(v.validateOrderStatus({ status: 'SHIPPED' }).valid).toBe(true);
  });
});

describe('sanitizeString', () => {
  test('trims whitespace', () => {
    expect(v.sanitizeString('  hello  ')).toBe('hello');
  });

  test('handles non-string input', () => {
    expect(v.sanitizeString(null)).toBe('');
    expect(v.sanitizeString(undefined)).toBe('');
    expect(v.sanitizeString(123)).toBe('');
  });
});
