import { createContext, useContext, useCallback, useState, useEffect, type ReactNode } from 'react';
const CUSTOMER_TOKEN_KEY = 'nmd-customer-token';
const API_BASE = (typeof import.meta !== 'undefined' && (import.meta as { env?: Record<string, string> }).env?.VITE_MOCK_API_URL) || '';
export interface Customer { id: string; phone: string; name?: string; }
interface CustomerAuthContextValue {
  customer: Customer | null;
  isLoading: boolean;
  start: (phone: string) => Promise<{ ok: boolean; error?: string; devCode?: string }>;
  verify: (phone: string, code: string, name?: string) => Promise<{ ok: boolean; error?: string; customer?: Customer }>;
  me: () => Promise<Customer | null>;
  logout: () => void;
}
const CustomerAuthContext = createContext<CustomerAuthContextValue | null>(null);
export function useCustomerAuth(): CustomerAuthContextValue {
  const ctx = useContext(CustomerAuthContext);
  if (!ctx) throw new Error('useCustomerAuth must be used within CustomerAuthProvider');
  return ctx;
}
export function CustomerAuthProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const fetchMe = useCallback(async (): Promise<Customer | null> => {
    if (!API_BASE) return null;
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem(CUSTOMER_TOKEN_KEY) : null;
    if (!token) return null;
    try {
      const res = await fetch(`${API_BASE}/customer/me`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return null;
      return (await res.json()) as Customer;
    } catch { return null; }
  }, []);
  useEffect(() => {
    let cancelled = false;
    fetchMe().then((c) => { if (!cancelled) { setCustomer(c); setIsLoading(false); } });
    return () => { cancelled = true; };
  }, [fetchMe]);
  const start = useCallback(async (phone: string) => {
    if (!API_BASE) return { ok: false, error: 'API غير متاح' };
    try {
      const res = await fetch(`${API_BASE}/customer/auth/start`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; devCode?: string };
      if (!res.ok) return { ok: false, error: data.error ?? `خطأ: ${res.status}` };
      return { ok: true, devCode: data.devCode };
    } catch (e) { return { ok: false, error: e instanceof Error ? e.message : 'خطأ في الاتصال' }; }
  }, []);
  const verify = useCallback(async (phone: string, code: string, name?: string) => {
    if (!API_BASE) return { ok: false, error: 'API غير متاح' };
    try {
      const res = await fetch(`${API_BASE}/customer/auth/verify`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim(), code: code.trim(), name: name?.trim() || undefined }),
      });
      const data = (await res.json()) as { token?: string; customer?: Customer; error?: string };
      if (!res.ok) return { ok: false, error: data.error ?? `خطأ: ${res.status}` };
      if (!data.token) return { ok: false, error: 'لم يتم استلام رمز الدخول' };
      if (typeof localStorage !== 'undefined') localStorage.setItem(CUSTOMER_TOKEN_KEY, data.token);
      const meData = (data.customer ?? (await fetchMe())) as Customer | null;
      setCustomer(meData);
      return { ok: true, customer: meData ?? undefined };
    } catch (e) { return { ok: false, error: e instanceof Error ? e.message : 'خطأ في الاتصال' }; }
  }, [fetchMe]);
  const me = useCallback(async () => { const c = await fetchMe(); setCustomer(c); return c; }, [fetchMe]);
  const logout = useCallback(() => {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(CUSTOMER_TOKEN_KEY);
    setCustomer(null);
  }, []);
  return (
    <CustomerAuthContext.Provider value={{ customer, isLoading, start, verify, me, logout }}>
      {children}
    </CustomerAuthContext.Provider>
  );
}
