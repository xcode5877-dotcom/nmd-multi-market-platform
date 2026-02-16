import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { setMockApiTokenProvider } from '@nmd/mock';

const TOKEN_KEY = 'nmd-access-token';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  marketId?: string;
  tenantId?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setToken: (token: string | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ?? '';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() =>
    typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null
  );
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(!!MOCK_API_URL && !!token);

  const setToken = useCallback((t: string | null) => {
    if (typeof localStorage !== 'undefined') {
      if (t) localStorage.setItem(TOKEN_KEY, t);
      else localStorage.removeItem(TOKEN_KEY);
    }
    setTokenState(t);
    setUser(null);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
  }, [setToken]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${MOCK_API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(err.error ?? 'Invalid email or password');
    }
    const data = (await res.json()) as { accessToken: string };
    setToken(data.accessToken);
  }, [setToken]);

  /** Wire token into MockApiClient so admin requests include Authorization header */
  useEffect(() => {
    setMockApiTokenProvider(() =>
      token ?? (typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null)
    );
  }, [token]);

  useEffect(() => {
    if (!MOCK_API_URL || !token) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${MOCK_API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          setToken(null);
          return;
        }
        const u = (await res.json()) as AuthUser;
        if (!cancelled) setUser(u);
      } catch {
        if (!cancelled) setToken(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token, setToken]);

  const value: AuthContextValue = {
    user,
    token,
    isLoading,
    login,
    logout,
    setToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
