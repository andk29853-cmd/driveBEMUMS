import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, getToken, setToken } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [appSettings, setAppSettings] = useState({
    cabinetName: 'Kabinet Kolektiva BEM UMS 2026',
    appTagline: 'Cloud Arsip Terpusat',
  });
  const [loading, setLoading] = useState(true);

  const refreshSettings = useCallback(async () => {
    try {
      const res = await api.get('/settings');
      if (res?.settings) setAppSettings(res.settings);
    } catch {
      /* gunakan default */
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [{ user }] = await Promise.all([api.get('/auth/me'), refreshSettings()]);
      setUser(user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [refreshSettings]);

  useEffect(() => {
    refresh();
    const onUnauthorized = () => setUser(null);
    window.addEventListener('drive:unauthorized', onUnauthorized);
    return () => window.removeEventListener('drive:unauthorized', onUnauthorized);
  }, [refresh]);

  const login = async (email, password) => {
    const { token, user } = await api.post('/auth/login', { email, password });
    setToken(token);
    setUser(user);
    return user;
  };

  const loginWithKey = async (key) => {
    const { token, user } = await api.post('/auth/admin-key', { key });
    setToken(token);
    setUser(user);
    return user;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  const isLoggedIn = Boolean(user?.id);
  const isManager = user?.role === 'ADMIN' || user?.role === 'SECRETARY';

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        appSettings,
        setAppSettings,
        refreshSettings,
        loading,
        login,
        loginWithKey,
        logout,
        refresh,
        isLoggedIn,
        isManager,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
