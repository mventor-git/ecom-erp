/**
 * Unit tests for the email module.
 *
 * The settings service is mocked so tests stay hermetic — no DB access.
 */
jest.mock('../services/settingsService', () => ({
  get: jest.fn(() => null),
  set: jest.fn(),
  getByCategory: jest.fn(() => []),
  getAll: jest.fn(() => []),
}));

describe('email module', () => {
  let email;

  beforeAll(() => {
    // Clear SMTP env vars so the module loads in degraded mode
    process.env.SMTP_HOST = '';
    process.env.SMTP_USER = '';
    process.env.SMTP_PASS = '';
    process.env.MAIL_FROM = '';
    process.env.ADMIN_EMAIL = '';
    process.env.STORE_NAME = 'Test Store';
    email = require('../email');
  });

  test('isConfigured returns false without SMTP config', () => {
    expect(email.isConfigured()).toBe(false);
  });

  test('sendMail returns false when not configured', async () => {
    const result = await email.sendMail({
      to: 'test@example.com',
      subject: 'Test',
      html: '<p>Hi</p>',
    });
    expect(result).toBe(false);
  });

  test('sendOrderConfirmation returns false when not configured', async () => {
    const order = {
      id: 1,
      total: 2999,
      items: [{ name: 'Widget', price: 29.99, qty: 1 }],
      created_at: new Date().toISOString(),
    };
    const result = await email.sendOrderConfirmation(order, 'customer@test.com', 'Alice');
    expect(result).toBe(false);
  });

  test('sendAdminNotification returns false when admin email not set', async () => {
    const order = { id: 3, total: 999, items: [], created_at: new Date().toISOString() };
    const result = await email.sendAdminNotification(order, 'c@t.com', 'C');
    expect(result).toBe(false);
  });
});
