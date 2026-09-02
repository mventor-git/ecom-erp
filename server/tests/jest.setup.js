/**
 * Jest global setup.
 * Sets environment variables before tests run.
 */
process.env.PORT = process.env.PORT || '3099';
process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_dummy';
process.env.SESSION_SECRET = 'jest-test-secret';
process.env.ADMIN_USERNAME = 'admin';
process.env.ADMIN_PASSWORD = 'test';
process.env.CLIENT_URL = 'http://localhost:5173';
