import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api, { setSession, clearSession } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/auth/me')
      .then((res) => setUser(res.data.user))
      .catch(async () => {
        const storedRefresh = localStorage.getItem('refreshToken');
        if (storedRefresh) {
          try {
            const r = await api.post('/auth/refresh', { refreshToken: storedRefresh });
            setSession({
              accessToken: r.data.accessToken,
              refreshToken: r.data.refreshToken || storedRefresh,
              csrfToken: r.data.csrfToken,
            });
            const meRes = await api.get('/auth/me');
            setUser(meRes.data.user);
            return;
          } catch {
            clearSession();
          }
        }
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAdmin: user?.role === 'admin',
      async login(email, password) {
        clearSession();
        const res = await api.post('/auth/login', { email, password });
        setSession({
          accessToken: res.data.accessToken,
          refreshToken: res.data.refreshToken,
          csrfToken: res.data.csrfToken,
        });
        setUser(res.data.user);
        return res.data.user;
      },
      async logout() {
        try {
          await api.post('/auth/logout');
        } finally {
          clearSession();
          setUser(null);
        }
      },
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
