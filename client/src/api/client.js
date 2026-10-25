import axios from 'axios';

export function getApiBaseUrl() {
  const envUrl = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');
  if (!envUrl) {
    return '/api';
  }
  if (envUrl.endsWith('/api')) {
    return envUrl;
  }
  if (envUrl.startsWith('/')) {
    return envUrl === '/api' ? '/api' : `${envUrl}/api`;
  }
  return `${envUrl}/api`;
}

export const API_BASE_URL = getApiBaseUrl();

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

let accessToken = localStorage.getItem('accessToken') || '';
let refreshToken = localStorage.getItem('refreshToken') || '';
let csrfToken = localStorage.getItem('csrfToken') || '';

export function setSession({ accessToken: at, refreshToken: rt, csrfToken: ct } = {}) {
  if (at !== undefined) {
    accessToken = at || '';
    if (at) localStorage.setItem('accessToken', at);
    else localStorage.removeItem('accessToken');
  }
  if (rt !== undefined) {
    refreshToken = rt || '';
    if (rt) localStorage.setItem('refreshToken', rt);
    else localStorage.removeItem('refreshToken');
  }
  if (ct !== undefined) {
    csrfToken = ct || '';
    if (ct) localStorage.setItem('csrfToken', ct);
    else localStorage.removeItem('csrfToken');
  }
}

export function clearSession() {
  accessToken = '';
  refreshToken = '';
  csrfToken = '';
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('csrfToken');
}

function isAuthRoute(url = '') {
  return (
    url.includes('/auth/login') ||
    url.includes('/auth/refresh') ||
    url.includes('/auth/logout')
  );
}

api.interceptors.request.use((config) => {
  if (!config.headers) config.headers = {};
  if (config.url?.includes('/auth/login')) {
    delete config.headers.Authorization;
    delete config.headers['X-CSRF-Token'];
    return config;
  }
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  if (csrfToken) config.headers['X-CSRF-Token'] = csrfToken;
  if (refreshToken && config.url?.includes('/auth/refresh')) {
    config.headers['X-Refresh-Token'] = refreshToken;
  }
  return config;
});

let refreshing = null;

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (!original) return Promise.reject(error);

    // Never retry auth endpoints (login, refresh, logout) on 401
    if (error.response?.status === 401 && !original._retry && !isAuthRoute(original.url)) {
      original._retry = true;
      const storedRefresh = refreshToken || localStorage.getItem('refreshToken');

      if (!storedRefresh) {
        clearSession();
        return Promise.reject(error);
      }

      try {
        if (!refreshing) {
          refreshing = api
            .post('/auth/refresh', { refreshToken: storedRefresh })
            .then((r) => {
              setSession({
                accessToken: r.data.accessToken,
                refreshToken: r.data.refreshToken || storedRefresh,
                csrfToken: r.data.csrfToken,
              });
              return r.data;
            })
            .finally(() => {
              refreshing = null;
            });
        }
        await refreshing;
        original.headers.Authorization = `Bearer ${accessToken}`;
        original.headers['X-CSRF-Token'] = csrfToken;
        return api(original);
      } catch (refreshErr) {
        clearSession();
        return Promise.reject(refreshErr);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
