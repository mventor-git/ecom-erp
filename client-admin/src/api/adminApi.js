import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// ── CSRF Token Management ──
let csrfToken = null;

/** Fetch the CSRF token from the server and cache it */
export async function fetchCsrfToken() {
  try {
    const res = await api.get('/admin/csrf-token');
    csrfToken = res.data.csrfToken;
    return csrfToken;
  } catch {
    csrfToken = null;
    return null;
  }
}

/** Clear the cached CSRF token (e.g. on logout) */
export function clearCsrfToken() {
  csrfToken = null;
}

// Axios request interceptor: attach CSRF token to state-changing admin requests
api.interceptors.request.use(config => {
  if (csrfToken && ['post', 'put', 'patch', 'delete'].includes(config.method?.toLowerCase())) {
    const path = config.url || '';
    if (path.startsWith('/admin/')) {
      config.headers['X-CSRF-Token'] = csrfToken;
    }
  }
  return config;
});

// Admin API
export const adminLogin = (username, password) =>
  api.post('/admin/login', { username, password });

export const adminLogout = () => api.post('/admin/logout');

export const checkAdmin = () => api.get('/admin/me');

export const getAdminProducts = () => api.get('/admin/products');

export const createProduct = (data) => api.post('/admin/products', data);

export const updateProduct = (id, data) => api.put(`/admin/products/${id}`, data);

export const deleteProduct = (id) => api.delete(`/admin/products/${id}`);

// -- Product Trash (mventor-ticket-044) --

export const trashAllProducts = () => api.post('/admin/products/trash-all');

export const getTrashedProducts = () => api.get('/admin/products/trash');

export const restoreAllProducts = () => api.post('/admin/products/trash/restore-all');

export const restoreProduct = (id) => api.post(`/admin/products/trash/${id}/restore`);

export const getAdminCategories = () => api.get('/admin/categories');

export const createCategory = (name) => api.post('/admin/categories', { name });

export const deleteCategory = (id) => api.delete(`/admin/categories/${id}`);

export const updateCategory = (id, data) => api.put(`/admin/categories/${id}`, data);

// Admin Brands API
export const getAdminBrands = () => api.get('/admin/brands');

export const createBrand = (name, iconUrl) => api.post('/admin/brands', { name, icon_url: iconUrl });

export const updateBrand = (id, data) => api.put(`/admin/brands/${id}`, data);

export const deleteBrand = (id) => api.delete(`/admin/brands/${id}`);

// Public Brands API (for customer-facing filter)
export const getPublicBrands = () => api.get('/products/brands/list');

// Admin Orders API
export const getAdminOrders = (params = {}) => api.get('/admin/orders', { params });

export const getAdminOrderStats = () => api.get('/admin/orders/stats');

// Daily revenue/orders series for dashboard charts (?days=7|14|30|90)
export const getSalesDaily = (days = 14) => api.get('/admin/reports/sales-daily', { params: { days } });

export const updateOrderStatus = (id, status, reason) =>
  api.put(`/admin/orders/${id}/status`, { status, reason: reason || '' });

export const getOrderStatuses = () => api.get('/admin/orders/statuses');

export const getOrderTimeline = (id) => api.get(`/admin/orders/${id}/timeline`);

// Product Images API (gallery)
export const getProductImages = (productId) => api.get(`/admin/products/${productId}/images`);

export const addProductImage = (productId, imageUrl, variantAttributes) =>
  api.post(`/admin/products/${productId}/images`, { image_url: imageUrl, variant_attributes: variantAttributes || {} });

export const updateProductImage = (productId, imageId, variantAttributes) =>
  api.put(`/admin/products/${productId}/images/${imageId}`, { variant_attributes: variantAttributes || {} });

export const reorderProductImages = (productId, imageIds) =>
  api.put(`/admin/products/${productId}/images/reorder`, { image_ids: imageIds });

export const deleteProductImage = (productId, imageId) =>
  api.delete(`/admin/products/${productId}/images/${imageId}`);

// Image Upload API
export const uploadImage = (file) => {
  const form = new FormData();
  form.append('image', file);
  return api.post('/admin/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const listImages = () => api.get('/admin/upload/list');

export const deleteImage = (filename) => api.delete(`/admin/upload/${filename}`);

// Featured Products API
export const getAdminFeatured = () => api.get('/admin/featured');

export const toggleFeature = (id, featured) =>
  api.put(`/admin/products/${id}/feature`, { featured });

export const reorderFeatured = (productIds) =>
  api.put('/admin/featured/reorder', { product_ids: productIds });

// Welcome Slides API
export const getWelcomeSlides = () => api.get('/admin/welcome-slides');

export const createWelcomeSlide = (data) => api.post('/admin/welcome-slides', data);

export const updateWelcomeSlide = (id, data) => api.put(`/admin/welcome-slides/${id}`, data);

export const deleteWelcomeSlide = (id) => api.delete(`/admin/welcome-slides/${id}`);

export const reorderWelcomeSlides = (slideIds) =>
  api.put('/admin/welcome-slides/reorder', { slide_ids: slideIds });

// ── ERP: Inventory API ──
export const getInventorySummary = (params = {}) => api.get('/admin/inventory/summary', { params });

export const getLowStockItems = (warehouseId) =>
  api.get('/admin/inventory/low-stock', { params: warehouseId ? { warehouse_id: warehouseId } : {} });

export const getInventoryMovements = (params = {}) => api.get('/admin/inventory/movements', { params });

export const getInventoryStock = (productId, warehouseId, locationId) =>
  api.get('/admin/inventory/stock', { params: { product_id: productId, warehouse_id: warehouseId, location_id: locationId } });

export const createInventoryMovement = (data) => api.post('/admin/inventory/movements', data);

// ── ERP: Warehouses API ──
export const getWarehouses = () => api.get('/admin/warehouses');

export const getWarehouse = (id) => api.get(`/admin/warehouses/${id}`);

export const createWarehouse = (data) => api.post('/admin/warehouses', data);

export const updateWarehouse = (id, data) => api.put(`/admin/warehouses/${id}`, data);

export const deleteWarehouse = (id) => api.delete(`/admin/warehouses/${id}`);

export const getWarehouseLocations = (warehouseId) => api.get(`/admin/warehouses/${warehouseId}/locations`);

export const createLocation = (warehouseId, data) => api.post(`/admin/warehouses/${warehouseId}/locations`, data);

export const updateLocation = (id, data) => api.put(`/admin/locations/${id}`, data);

export const deleteLocation = (id) => api.delete(`/admin/locations/${id}`);

export const transferInventory = (data) => api.post('/admin/inventory/transfer', data);

// ── ERP: Suppliers API ──
export const getSuppliers = () => api.get('/admin/suppliers');

export const getSupplier = (id) => api.get(`/admin/suppliers/${id}`);

export const createSupplier = (data) => api.post('/admin/suppliers', data);

export const updateSupplier = (id, data) => api.put(`/admin/suppliers/${id}`, data);

export const deleteSupplier = (id) => api.delete(`/admin/suppliers/${id}`);

export const getSupplierProducts = (id) => api.get(`/admin/suppliers/${id}/products`);

export const getSupplierHistory = (id) => api.get(`/admin/suppliers/${id}/history`);
export const getPurchaseOrders = (params = {}) => api.get('/admin/purchase-orders', { params });

export const getPurchaseOrder = (id) => api.get(`/admin/purchase-orders/${id}`);

export const createPurchaseOrder = (data) => api.post('/admin/purchase-orders', data);

export const updatePurchaseOrderStatus = (id, status, reject_reason) => api.put(`/admin/purchase-orders/${id}/status`, reject_reason ? { status, reject_reason } : { status });

export const receivePurchaseOrder = (id, items) => api.post(`/admin/purchase-orders/${id}/receive`, { items });

// ── ERP: Supplier Payments (mventor-ticket-088 API / 089 UI) ──

export const getPoPayables = (poId) => api.get(`/admin/supplier-payments/outstanding/${poId}`);

export const getPoPayments = (poId) => api.get('/admin/supplier-payments', { params: { purchase_order_id: poId } });

export const recordSupplierPayment = (data) => api.post('/admin/supplier-payments', data);

export const reverseSupplierPayment = (id, reason) => api.post(`/admin/supplier-payments/${id}/reverse`, { reason });

// ── ERP: AP Aging report (mventor-ticket-090) ──

export const getApAging = (params = {}) => api.get('/admin/supplier-payments/aging', { params });

// ── ERP: Events API ──
export const getEvents = (params = {}) => api.get('/admin/events', { params });

export const getEventTimeline = (entityType, entityId) => api.get(`/admin/events/timeline/${entityType}/${entityId}`);

export const getEventCounts = () => api.get('/admin/events/counts');

// ── ERP: Settings API ──
export const getSettings = () => api.get('/admin/settings');

export const getSettingsByCategory = (category) => api.get(`/admin/settings/${category}`);

export const updateSettings = (settings) => api.put('/admin/settings', { settings });

export const updateSettingsBatch = (settings) => api.post('/admin/settings/batch', { settings });

export const getPublicSettings = () => api.get('/settings/public');

export const updateSetting = (key, value) => api.put(`/admin/settings/${key}`, { value });

// 3D model upload (.glb/.gltf) for the welcome-page showcase
export const uploadModel = (file) => {
  const form = new FormData();
  form.append('model', file);
  return api.post('/admin/upload/model', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

// ── Invoices (xlsx template, Settings -> Documents) ──
export const getInvoices = () => api.get('/admin/invoices');

export const generateInvoice = (orderId) => api.post('/admin/invoices/generate', { order_id: orderId || null });

export const getMovementTypes = () => api.get('/admin/invoices/movement-types');

export const generateMovementDoc = (type, movementId) =>
  api.post('/admin/invoices/generate-movement', { type, movement_id: movementId || null });

export const getInvoiceDownloadUrl = (filename) => `/api/admin/invoices/download/${encodeURIComponent(filename)}`;

// ── mventor-ticket-043: Supply / Issue Orders + Financial Periods ──
export const getSupplyOrders = () => api.get('/admin/supply-orders');

export const getSupplyOrder = (id) => api.get(`/admin/supply-orders/${id}`);

export const createSupplyOrder = (data) => api.post('/admin/supply-orders', data);

export const addSupplyItem = (id, data) => api.post(`/admin/supply-orders/${id}/items`, data);

export const removeSupplyItem = (itemId) => api.delete(`/admin/supply-order-items/${itemId}`);

export const issueSupplyOrder = (id) => api.post(`/admin/supply-orders/${id}/issue`);

export const cancelSupplyOrder = (id) => api.post(`/admin/supply-orders/${id}/cancel`);

export const getIssueOrders = (params) => api.get('/admin/issue-orders' + (params ? (params.startsWith('?') ? params : '?' + params) : ''));

export const getIssueOrder = (id) => api.get(`/admin/issue-orders/${id}`);

export const createIssueOrder = (data) => api.post('/admin/issue-orders', data);

export const addIssueItem = (id, data) => api.post(`/admin/issue-orders/${id}/items`, data);

export const removeIssueItem = (itemId) => api.delete(`/admin/issue-order-items/${itemId}`);

export const issueIssueOrder = (id, warehouseId) => api.post(`/admin/issue-orders/${id}/issue`, { warehouse_id: warehouseId });

export const cancelIssueOrder = (id) => api.post(`/admin/issue-orders/${id}/cancel`);

export const getFinancialPeriods = () => api.get('/admin/financial-periods');

export const createFinancialPeriod = (data) => api.post('/admin/financial-periods', data);

export const closeFinancialPeriod = (id) => api.post(`/admin/financial-periods/${id}/close`);

export const setOpeningBalance = (id, warehouseId, items) =>
  api.post(`/admin/financial-periods/${id}/opening-balance`, { warehouse_id: warehouseId, items });

// ── Document view URLs (Drive-style viewer + print) ──
export const viewInvoiceUrl = (orderId) => `/api/admin/view/invoice/${orderId}`;

export const viewReceiptUrl = (orderId) => `/api/admin/view/receipt/${orderId}`;

export const viewMovementUrl = (movementId) => `/api/admin/view/movement/${movementId}`;

export const viewSupplyOrderUrl = (id) => `/api/admin/view/supply-order/${id}`;

export const viewIssueOrderUrl = (id) => `/api/admin/view/issue-order/${id}`;

export const viewShippingUrl = (orderId) => `/api/admin/view/shipping/${orderId}`;

export const viewShippingPolicyUrl = () => '/api/admin/view/shipping-policy';

export const emailReceipt = (orderId) => api.post(`/admin/view/receipt/${orderId}/email`);

// ── mventor-ticket-044: Report files + scheduling ──
export const getReportFiles = () => api.get('/admin/reports/files');

export const getReportFileUrl = (filename) => `/api/admin/reports/files/${encodeURIComponent(filename)}`;

export const exportReportPdf = (reportType, params = {}) =>
  `/api/admin/reports/${reportType}/export/pdf?${new URLSearchParams(params).toString()}`;

export const exportReportMd = (reportType, params = {}) =>
  `/api/admin/reports/${reportType}/export/md?${new URLSearchParams(params).toString()}`;

// ── mventor-ticket-046: Price lists ──
export const getPriceLists = () => api.get('/admin/price-lists');

export const createPriceList = (data) => api.post('/admin/price-lists', data);

export const updatePriceList = (id, data) => api.put(`/admin/price-lists/${id}`, data);

export const deletePriceList = (id) => api.delete(`/admin/price-lists/${id}`);

export const getPriceListUsage = () => api.get('/admin/price-lists/usage');

export const getProductPrices = (productId) => api.get(`/admin/price-lists/products/${productId}/prices`);

export const setProductPrices = (productId, overrides) =>
  api.put(`/admin/price-lists/products/${productId}/prices`, { overrides });

// Kashier sessions
export const getKashierSessions = () => api.get('/admin/kashier/sessions');
export const testKashierSession = () => api.post('/admin/kashier/test-session');




// ── mventor-ticket-048: Picking + Packing ──
export const getPickingTasks = (params = {}) => api.get('/admin/picking/tasks', { params });

export const updatePickingStatus = (id, status, notes = '') =>
  api.post(`/admin/picking/tasks/${id}/status`, { status, notes });

export const getPackingTasks = (params = {}) => api.get('/admin/packing/tasks', { params });

export const getPackingStats = () => api.get('/admin/packing/stats');

export const assignPackingTask = (id, assigneeId) =>
  api.post(`/admin/packing/tasks/${id}/assign`, { assignee_id: assigneeId });

export const updatePackingStatus = (id, status, notes = '') =>
  api.post(`/admin/packing/tasks/${id}/status`, { status, notes });

export const viewPickingSheetUrl = (orderId) => `/api/admin/view/picking/${orderId}`;
export const viewPackingSheetUrl = (orderId) => `/api/admin/view/packing/${orderId}`;

// ── mventor-ticket-049: Shipping ──
export const getShipmentProviders = () => api.get('/admin/shipping/providers');

export const createShipmentProvider = (data) => api.post('/admin/shipping/providers', data);

export const updateShipmentProvider = (id, data) => api.put(`/admin/shipping/providers/${id}`, data);

export const deleteShipmentProvider = (id) => api.delete(`/admin/shipping/providers/${id}`);

export const getShipments = (params = {}) => api.get('/admin/shipping/shipments', { params });

export const createShipment = (data) => api.post('/admin/shipping/shipments', data);

export const updateShipmentStatus = (id, status, notes = '') =>
  api.put(`/admin/shipping/shipments/${id}/status`, { status, notes });

export const getShipmentTracking = (id) => api.get(`/admin/shipping/shipments/${id}/tracking`);

// ── ERP: API Integrations API ──
export const getIntegrations = () => api.get('/admin/integrations');

export const updateIntegrations = (settings) => api.put('/admin/integrations', { settings });

export const testIntegration = (provider, extra = {}) => api.post('/admin/integrations/test', { provider, ...extra });

// ── ERP: Reports API ──
export const getReport = (reportType, params = {}) => api.get(`/admin/reports/${reportType}`, { params });

export const exportReport = (reportType, format = 'csv', params = {}) =>
  api.get(`/admin/reports/${reportType}/export`, { params: { format, ...params } });

// ── ERP: Users API ──
export const getUsers = () => api.get('/admin/users');

export const getUser = (id) => api.get(`/admin/users/${id}`);

export const createUser = (data) => api.post('/admin/users', data);

export const updateUser = (id, data) => api.put(`/admin/users/${id}`, data);

export const deleteUser = (id) => api.delete(`/admin/users/${id}`);

export const getCurrentUser = () => api.get('/admin/users/me/current');

export const getRoles = () => api.get('/admin/users/roles/list');

export const getPermissions = () => api.get('/admin/users/permissions/list');

// Multi-role (mventor-ticket-050)
export const getUserRoles = (id) => api.get(`/admin/users/${id}/roles`);

export const setUserRoles = (id, roleIds) => api.put(`/admin/users/${id}/roles`, { role_ids: roleIds });

// Personal employee signatures (multipart upload of a PNG/JPEG/WebP/SVG)
export const uploadUserSignature = (id, file) => {
  const fd = new FormData();
  fd.append('signature', file);
  return api.put(`/admin/users/${id}/signature`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
};
export const removeUserSignature = (id) => api.delete(`/admin/users/${id}/signature`);
export const getUserSignature = (id) => api.get(`/admin/users/${id}/signature`);

// ── Customers (list/profile/export) ──
export const getCustomers = (params) => api.get('/admin/customers', { params });

export const getCustomerProfile = (id) => api.get(`/admin/customers/${id}`);

export const getCustomersExportUrl = () => '/api/admin/customers/export';

// ── VIP invitations (mventor-ticket-060) ──
export const createVipInvite = (name) => api.post('/admin/customers/vip-invites', { name });
export const getVipInvites = () => api.get('/admin/customers/vip-invites');
export const vipInviteCardUrl = (code, logo) =>
  `/api/admin/customers/vip-invites/${encodeURIComponent(code)}/card${logo ? `?logo=${encodeURIComponent(logo)}` : ''}`;

export const getCustomerActionsExportUrl = (id) => `/api/admin/customers/${id}/export`;

// ── Products import/export + smart features ──
export const getProductsExportUrl = () => '/api/admin/products/export';

export const importProductsFile = (file) => {
  const form = new FormData();
  form.append('file', file);
  return api.post('/admin/products/import', form, { headers: { 'Content-Type': 'multipart/form-data' } });
};

export const storeProductUrl = (id) => {
  const port = window.location.port;
  const origin = port === '5174' ? window.location.origin.replace(':5174', ':5173') : window.location.origin;
  return `${origin}/products/${id}`;
};

// ── ERP: Notifications API ──
export const getNotificationRules = () => api.get('/admin/notifications/rules');

export const createNotificationRule = (data) => api.post('/admin/notifications/rules', data);

export const getInAppNotifications = (params = {}) => api.get('/admin/notifications/in-app', { params });

export const markNotificationRead = (id) => api.put(`/admin/notifications/in-app/${id}/read`);

// ── AI Assistant API ──
export const getModels = () => api.get('/admin/ai/models');

export const selectModel = (model) => api.post('/admin/ai/models/select', { model });

export const getAISettings = () => api.get('/admin/ai/settings');

export const updateAISettings = (settings) => api.put('/admin/ai/settings', settings);

export const getAIStats = () => api.get('/admin/ai/stats');

// ── Announcements API ──
export const getAnnouncements = () => api.get('/admin/announcements');

export const createAnnouncement = (data) => api.post('/admin/announcements', data);

export const updateAnnouncement = (id, data) => api.put(`/admin/announcements/${id}`, data);

export const deleteAnnouncement = (id) => api.delete(`/admin/announcements/${id}`);

// ── Hero Slides API ──
export const getHeroSlides = () => api.get('/admin/hero-slides');

export const createHeroSlide = (data) => api.post('/admin/hero-slides', data);

export const updateHeroSlide = (id, data) => api.put(`/admin/hero-slides/${id}`, data);

export const deleteHeroSlide = (id) => api.delete(`/admin/hero-slides/${id}`);

// Paymob end-to-end credential test (auth + 1 EGP intention)

// ── Pricing Engine ──────────────────────────────────────────────────
export const pricingPreview = (params) => api.get('/admin/pricing/preview', { params });
export const pricingApply = (body) => api.post('/admin/pricing/apply', body);
export const pricingOffers = () => api.get('/admin/pricing/offers');
export const pricingLastApply = () => api.get('/admin/pricing/last-apply');
export const pricingRevert = () => api.post('/admin/pricing/revert');
export const pricingProfitReport = () => api.get('/admin/pricing/profit-report');
