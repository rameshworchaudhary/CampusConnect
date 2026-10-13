import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

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
