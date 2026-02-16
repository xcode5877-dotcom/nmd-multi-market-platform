import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { getToken, setToken, apiFetch, getApiBaseUrl } from '../api';

export type AuthStatus = 'loading' | 'authed' | 'guest';

export interface CourierUser {
  id: string;
  email: string;
  role: string;
  courierId: string;
  marketId: string;
  courier: { id: string; name: string; phone?: string; isOnline: boolean; isAvailable?: boolean };
  market: { id: string; name: string };
}

interface AuthContextValue {
  user: CourierUser | null;
  token: string | null;
  authStatus: AuthStatus;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => getToken());
  const [user, setUser] = useState<CourierUser | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>(() => {
    const base = getApiBaseUrl();
    const t = getToken();
    if (!base || !t) return 'guest';
    return 'loading';
  });

  const logout = useCallback(() => {
    setToken(null);
    setTokenState(null);
    setUser(null);
    setAuthStatus('guest');
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiFetch<{ accessToken: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setToken(data.accessToken);
    setTokenState(data.accessToken);
    const me = await apiFetch<{ role?: string }>('/auth/me');
    if (me.role !== 'COURIER') {
      setToken(null);
      setTokenState(null);
      setAuthStatus('guest');
      throw new Error('Invalid role');
    }
    const courierMe = await apiFetch<CourierUser>('/courier/me');
    setUser(courierMe);
    setAuthStatus('authed');
  }, []);

  useEffect(() => {
    const base = getApiBaseUrl();
    const t = getToken();
    if (!base || !t) {
      setAuthStatus('guest');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const me = await apiFetch<{ role?: string }>('/auth/me');
        if (me.role !== 'COURIER') {
          setToken(null);
          setTokenState(null);
          if (!cancelled) setAuthStatus('guest');
          return;
        }
        const courierMe = await apiFetch<CourierUser>('/courier/me');
        if (!cancelled) {
          setUser(courierMe);
          setAuthStatus('authed');
        }
      } catch {
        if (!cancelled) {
          setToken(null);
          setTokenState(null);
          setAuthStatus('guest');
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, authStatus, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
