// Admin API Client — centralized, one source of truth
import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) window.location.href = '/admin/login';
    return Promise.reject(err);
  }
);

export const adminApi = {
  login: (data) => api.post('/admin/login', data),
  logout: () => api.post('/admin/logout'),
  me: () => api.get('/admin/me'),
  getProducts: () => api.get('/admin/products'),
  getOrders: () => api.get('/api/orders'),
  getWarehouses: () => api.get('/warehouses'),
  getInventoryMovements: (q) => api.get('/inventory/movements', { params: q }),
  getInventoryStock: (q) => api.get('/inventory/stock', { params: q }),
  getLowStock: () => api.get('/inventory/low-stock'),
  getSuppliers: () => api.get('/admin/suppliers'),
  createSale: (data) => api.post('/api/admin-sale', data),
  getInventory: () => api.get('/api/admin/inventory'),
};
