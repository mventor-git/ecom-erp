# Test Coverage Audit — Comfort Sign (Read Only)

TEST FRAMEWORK: Jest (jest.config.js present); integration via run-integration-tests.js
FILES IN server/tests/ (observed): api.test.js, cache.test.js, customers.test.js, email.test.js, inventory.test.js, mobileApi.test.js, notificationsRefunds.test.js, pickingPacking.test.js, priceLists.test.js + jest.setup.js
DOMAINS COVERED (from package.json patterns): cache, email, validate, inventory, productTrash, salesBridge, warehouseOrders, workflow, priceLists, paymob, pickingPacking, shipping, rbacMultiRole, profitReports, notificationsRefunds, customers, vip.
GAPS (relative to discovered features): no dedicated test for pricing engine rules, no full checkout/payment flow, no receipt/QR end-to-end, no VIP invitation attribution flow, no warehouse order full lifecycle, no AI assistant tests, no 2FA tests, no webhook idempotency tests, no mobile cart/order full flow.
NO PYTHON. NODE ONLY.
