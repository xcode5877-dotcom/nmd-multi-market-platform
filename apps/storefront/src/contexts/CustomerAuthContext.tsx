import { createContext, useContext, useCallback, useState, useEffect, type ReactNode } from 'react';

/** Ultimate Auth Sync: Customer session only. Key nmd-customer-token; distinct from admin (nmd-access-token). Logout removes only this token and resets customer state. */
const CUSTOMER_TOKEN_KEY = 'nmd-customer-token';
const API_BASE = ((typeof import.meta !== 'undefined' && (import.meta as { env?: Record<string, string> }).env?.VITE_MOCK_API_URL) || '').replace(/\/$/, '');

/** Only when running in Android wrapper (NMD-Android-App): get FCM token from bridge and POST to backend. No-op for web. */
function saveFcmTokenIfAndroidApp(apiBase: string, authToken: string | null): void {
  if (!authToken?.trim() || typeof navigator === 'undefined') return;
  console.log('NMD-DEBUG: Checking for Android Bridge...');
  console.log('NMD-DEBUG: UserAgent is:', navigator.userAgent);
  if (!navigator.userAgent.includes('NMD-Android-App')) return;
  const w = typeof window !== 'undefined' ? (window as unknown as { NMDNative?: { getFCMToken?: () => string } }) : null;

  function attemptSync(retry: boolean) {
    const bridge = w?.NMDNative;
    if (!bridge || typeof bridge.getFCMToken !== 'function') {
      console.log('NMD-DEBUG: window.NMDNative not found or getFCMToken missing.');
      return;
    }
    console.log('NMD-DEBUG: NMDNative bridge detected. Calling getFCMToken()...');
    try {
      const raw = bridge.getFCMToken();
      const token = typeof raw === 'string' ? raw.trim() : '';
      if (!token) {
        console.log('NMD-DEBUG: getFCMToken returned empty token.', retry ? 'No more retries.' : 'Retrying in 2000ms...');
        if (!retry) {
          setTimeout(() => attemptSync(true), 2000);
        }
        return;
      }
      const base = apiBase && apiBase.trim().length > 0 ? apiBase : 'https://nmd.marketing/api';
      const finalUrl = base.replace(/\/$/, '') + '/customer/save-fcm-token';
      console.log('NMD-DEBUG: Final POST URL is:', finalUrl);
      console.log('NMD-DEBUG: Sending FCM token to backend URL:', finalUrl);
      fetch(finalUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ fcmToken: token }),
        credentials: 'include',
      }).catch((err) => {
        console.log('NMD-DEBUG: Error while sending FCM token:', err instanceof Error ? err.message : String(err));
      });
    } catch (e) {
      console.log('NMD-DEBUG: Exception in saveFcmTokenIfAndroidApp:', e instanceof Error ? e.message : String(e));
    }
  }

  // Small delay to let WebView and bridge finish initialization.
  setTimeout(() => attemptSync(false), 1000);
}

export interface Customer {
  id: string;
  phone: string;
  name?: string;
}

export interface OtpGatewayHealth {
  gatewayConfigured: boolean;
  gatewayReachable: boolean;
  ready: boolean;
}

interface CustomerAuthContextValue {
  customer: Customer | null;
  isLoading: boolean;
  checkPhone: (phone: string) => Promise<{ exists: boolean }>;
  checkOtpGatewayHealth: () => Promise<OtpGatewayHealth>;
  start: (phone: string) => Promise<{ ok: boolean; error?: string; devCode?: string; whatsAppSent?: boolean }>;
  verify: (phone: string, code: string, name?: string) => Promise<{ ok: boolean; error?: string; customer?: Customer; isNewUser?: boolean }>;
  updateProfile: (name: string) => Promise<{ ok: boolean; error?: string; customer?: Customer }>;
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
      const res = await fetch(`${API_BASE}/customer/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      const data = (await res.json()) as Customer;
      return data;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchMe().then((c) => {
      if (!cancelled) {
        setCustomer(c);
        setIsLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [fetchMe]);

  const checkPhone = useCallback(async (phone: string): Promise<{ exists: boolean }> => {
    if (!API_BASE) return { exists: false };
    try {
      const res = await fetch(`${API_BASE}/customer/auth/check-phone?phone=${encodeURIComponent(phone.trim())}`);
      const data = (await res.json()) as { exists?: boolean };
      return { exists: !!data.exists };
    } catch {
      return { exists: false };
    }
  }, []);

  const checkOtpGatewayHealth = useCallback(async (): Promise<OtpGatewayHealth> => {
    if (!API_BASE) return { gatewayConfigured: false, gatewayReachable: false, ready: false };
    try {
      const res = await fetch(`${API_BASE}/customer/auth/otp-gateway-health`);
      const data = (await res.json()) as { gatewayConfigured?: boolean; gatewayReachable?: boolean; ready?: boolean };
      return {
        gatewayConfigured: !!data.gatewayConfigured,
        gatewayReachable: !!data.gatewayReachable,
        ready: !!data.ready,
      };
    } catch {
      return { gatewayConfigured: false, gatewayReachable: false, ready: false };
    }
  }, []);

  const start = useCallback(async (phone: string): Promise<{ ok: boolean; error?: string; devCode?: string; whatsAppSent?: boolean }> => {
    if (!API_BASE) return { ok: false, error: 'API غير متاح. حدّث VITE_MOCK_API_URL أو شغّل Mock API.' };
    const phoneNormalized = String(phone ?? '').trim().replace(/\D/g, '');
    if (!phoneNormalized || phoneNormalized.length < 9) return { ok: false, error: 'رقم الجوال غير صالح' };
    try {
      const res = await fetch(`${API_BASE}/customer/auth/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneNormalized }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; devCode?: string; whatsAppSent?: boolean };
      if (!res.ok) return { ok: false, error: data.error ?? `خطأ: ${res.status}` };
      return { ok: true, devCode: data.devCode, whatsAppSent: data.whatsAppSent };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'خطأ في الاتصال' };
    }
  }, []);

  const verify = useCallback(async (phone: string, code: string, name?: string): Promise<{ ok: boolean; error?: string; customer?: Customer; isNewUser?: boolean }> => {
    if (!API_BASE) return { ok: false, error: 'API غير متاح' };
    try {
      const res = await fetch(`${API_BASE}/customer/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim(), code: code.trim(), name: name?.trim() || undefined }),
      });
      const data = (await res.json()) as { token?: string; customer?: Customer; isNewUser?: boolean; error?: string };
      if (!res.ok) return { ok: false, error: data.error ?? `خطأ: ${res.status}` };
      if (!data.token) return { ok: false, error: 'لم يتم استلام رمز الدخول' };
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(CUSTOMER_TOKEN_KEY, data.token);
      }
      const meData = (data.customer ?? (await fetchMe())) as Customer | null;
      setCustomer(meData);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('nmd-fcm-sync-request', { detail: { token: data.token } }));
      }
      saveFcmTokenIfAndroidApp(API_BASE, data.token);
      return { ok: true, customer: meData ?? undefined, isNewUser: !!data.isNewUser };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'خطأ في الاتصال' };
    }
  }, [fetchMe]);

  const updateProfile = useCallback(async (name: string): Promise<{ ok: boolean; error?: string; customer?: Customer }> => {
    if (!API_BASE) return { ok: false, error: 'API غير متاح' };
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem(CUSTOMER_TOKEN_KEY) : null;
    if (!token) return { ok: false, error: 'غير مسجّل الدخول' };
    try {
      const res = await fetch(`${API_BASE}/customer/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = (await res.json()) as { customer?: Customer; error?: string };
      if (!res.ok) return { ok: false, error: data.error ?? `خطأ: ${res.status}` };
      if (data.customer) setCustomer(data.customer);
      return { ok: true, customer: data.customer };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'خطأ في الاتصال' };
    }
  }, []);

  const me = useCallback(async (): Promise<Customer | null> => {
    const c = await fetchMe();
    setCustomer(c);
    return c;
  }, [fetchMe]);

  const logout = useCallback(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(CUSTOMER_TOKEN_KEY);
    }
    setCustomer(null);
  }, []);

  const value: CustomerAuthContextValue = {
    customer,
    isLoading,
    checkPhone,
    checkOtpGatewayHealth,
    start,
    verify,
    updateProfile,
    me,
    logout,
  };

  return <CustomerAuthContext.Provider value={value}>{children}</CustomerAuthContext.Provider>;
}
