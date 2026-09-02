import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// ── CSRF Token Management ──
// The server requires an X-CSRF-Token header on state-changing admin requests.
// We fetch the token after login and attach it via an interceptor.

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
    // Only add CSRF for admin routes (starts with /admin)
    const path = config.url || '';
    if (path.startsWith('/admin/')) {
      config.headers['X-CSRF-Token'] = csrfToken;
    }
  }
  return config;
});

// Stripe checkout uses plain axios (no baseURL), so it needs its own CSRF interceptor too
axios.interceptors.request.use(config => {
  if (csrfToken && ['post', 'put', 'patch', 'delete'].includes(config.method?.toLowerCase())) {
    const path = config.url || '';
    if (path.startsWith('/api/admin/')) {
      config.headers['X-CSRF-Token'] = csrfToken;
    }
  }
  return config;
});

// Public API
export const getProducts = ({ category, sort = 'newest', brand, minPrice, maxPrice } = {}) => {
  const params = { sort };
  if (category) params.category = category;
  if (brand) params.brand = brand;
  if (minPrice != null) params.min_price = minPrice;
  if (maxPrice != null) params.max_price = maxPrice;
  return api.get('/products', { params });
};

export const getProduct = (id) => api.get(`/products/${id}`);

export const getProductImages = (id) => api.get(`/products/${id}/images`);

export const getProductReviews = (id) => api.get(`/products/${id}/reviews`);

export const addProductReview = (id, rating, comment) =>
  api.post(`/products/${id}/reviews`, { rating, comment });

export const getTopSelling = (limit = 4) => api.get('/products/top-selling', { params: { limit } });

export const getFeatured = (limit = 10) => api.get('/products/featured', { params: { limit } });

export const getCategories = () => api.get('/products/categories/list');

export const getBrands = () => api.get('/products/brands/list');

export const getCategoryShowcase = () => api.get('/products/categories/showcase');

export const createOrder = (data) => api.post('/orders', data);

export const getOrderBySession = (sessionId) => api.get(`/orders/session/${sessionId}`);

// Kashier (cards + mobile wallets)
export const getKashierStatus = () => axios.get('/api/kashier/checkout/status');

export const createKashierSession = (data) =>
  axios.post('/api/kashier/checkout/session', data, {
    headers: { 'Content-Type': 'application/json' },
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

export const getAdminCategories = () => api.get('/admin/categories');

export const createCategory = (name) => api.post('/admin/categories', { name });

// Admin Orders API
export const getAdminOrders = (params = {}) => api.get('/admin/orders', { params });

export const getAdminOrderStats = () => api.get('/admin/orders/stats');

export const updateOrderStatus = (id, status) => api.put(`/admin/orders/${id}/status`, { status });

// Image Upload API
export const uploadImage = (file) => {
  const form = new FormData();
  form.append('image', file);
  return axios.post('/api/admin/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const listImages = () => api.get('/admin/upload/list');

export const deleteImage = (filename) => api.delete(`/admin/upload/${filename}`);

// Customer Auth API (use axios directly, not api — auth routes are not under /api/)
export const getCurrentUser = () => axios.get('/auth/me');

export const logoutUser = () => axios.post('/auth/logout');

export const getMyOrders = () => axios.get('/api/orders/mine');

// Order tracker (multiple orders with timelines)
export const getOrderTracker = () => axios.get('/api/orders/tracker');

export const getOrderStatuses = () => axios.get('/api/orders/statuses');

// Customer onboarding + phone verification (mventor-ticket-053)
export const getCustomerStatus = () => axios.get('/api/customer/status');

export const saveCustomerProfile = (data) => axios.post('/api/customer/profile', data, {
  headers: { 'Content-Type': 'application/json' },
});

export const verifyCustomerCode = (code) => axios.post('/api/customer/verify', { code }, {
  headers: { 'Content-Type': 'application/json' },
});

export const resendVerificationCode = () => axios.post('/api/customer/verify/resend');

export const getMapsKey = () => axios.get('/api/customer/maps-key');

// Wishlist (per customer account)
export const getWishlist = () => api.get('/wishlist');

export const addToWishlist = (productId) => api.post(`/wishlist/${productId}`);

export const removeFromWishlist = (productId) => api.delete(`/wishlist/${productId}`);

// Delivery tab: fulfillment status per order (customer)
export const getDeliveryStatus = () => api.get('/orders/delivery');
export const getOverview = (params) => api.get('/admin/overview', { params })
