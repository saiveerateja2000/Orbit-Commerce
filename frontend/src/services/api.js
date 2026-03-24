import axios from 'axios';

const BASE_URL = process.env.REACT_APP_API_URL || '';

const api = axios.create({
  baseURL: BASE_URL,
});

// Attach JWT token to every request if present
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// On 401, clear token so the app can redirect to login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
    }
    return Promise.reject(error);
  }
);

// ── Auth ──────────────────────────────────────────────────────────────────────
export const register = (data) => api.post('/api/auth/register', data);
export const login = (data) => api.post('/api/auth/login', data);
export const getMe = () => api.get('/api/auth/me');

// ── Products ──────────────────────────────────────────────────────────────────
export const getProducts = (page = 1, category = '') => {
  const params = { page };
  if (category) params.category = category;
  return api.get('/api/products', { params });
};
export const getProduct = (id) => api.get(`/api/products/${id}`);

// ── Orders ────────────────────────────────────────────────────────────────────
export const createOrder = (data) => api.post('/api/orders', data);
export const getOrders = () => api.get('/api/orders');
export const getOrder = (id) => api.get(`/api/orders/${id}`);

// ── Payments ──────────────────────────────────────────────────────────────────
export const createPayment = (data) => api.post('/api/payments', data);
export const getPayment = (id) => api.get(`/api/payments/${id}`);

export default api;
