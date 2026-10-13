import axios from 'axios';

const defaultApiOrigin = import.meta.env.PROD
  ? 'https://campusconnect-backend-oqlm.onrender.com'
  : 'http://localhost:8080';
const configuredApiOrigin = import.meta.env.VITE_API_BASE_URL?.trim();
const isLocalApiOrigin = configuredApiOrigin
  ? /^(?:(?:https?:)?\/\/)?(localhost|127(?:\.\d{1,3}){3}|\[?::1\]?)(:\d+)?(?:\/|$)/i.test(configuredApiOrigin)
  : false;
const apiOriginToUse = import.meta.env.PROD && isLocalApiOrigin
  ? defaultApiOrigin
  : configuredApiOrigin || defaultApiOrigin;
const apiOrigin = apiOriginToUse.replace(/\/+$/, '').replace(/\/api$/i, '');
const API_BASE_URL = `${apiOrigin}/api`;

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('cc_auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const hasAuthenticatedRequest = Boolean(error.config?.headers?.Authorization);
    if (error.response?.status === 401 && hasAuthenticatedRequest) {
      window.dispatchEvent(new Event('cc:unauthorized'));
    }
    return Promise.reject(error);
  }
);
