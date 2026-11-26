import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, getToken, setToken } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { user } = await api.get('/auth/me');
      setUser(user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

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

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  const isLoggedIn = Boolean(user?.id);
  const isManager = user?.role === 'ADMIN' || user?.role === 'SECRETARY';

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, logout, refresh, isLoggedIn, isManager }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
