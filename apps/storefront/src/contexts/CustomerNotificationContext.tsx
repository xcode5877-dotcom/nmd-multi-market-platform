import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useToast } from '@nmd/ui';
import { getBridgeStatus, registerFCMTokenAndSyncToServer, onNativeBridgeReady } from '../lib/fcm-bridge';

const CUSTOMER_TOKEN_KEY = 'nmd-customer-token';
const FCM_API_BASE = (typeof import.meta !== 'undefined' && (import.meta as { env?: Record<string, string> }).env?.VITE_MOCK_API_URL)
  ? (import.meta as { env: Record<string, string> }).env.VITE_MOCK_API_URL.replace(/\/$/, '')
  : '';

declare global {
  interface Window {
    __onOrderStatus?: (payload: { orderId?: string; status?: string; title?: string; body?: string }) => void;
  }
}

export interface CustomerNotificationContextValue {
  fcmBridgeStatus: 'present' | 'missing';
  fcmTokenStatus: 'found' | 'not-found' | 'unknown';
  fcmLastSyncTime: Date | null;
  /** Last sync/registration error message (e.g. timeout, HTTP 401, Firebase error). */
  fcmLastError: string | null;
  registerFCMTokenManual: () => void;
  /** Force re-read bridge status (e.g. after "Re-check Bridge" click). */
  refreshBridgeStatus: () => void;
}

const CustomerNotificationContext = createContext<CustomerNotificationContextValue | null>(null);

export function useCustomerNotification() {
  const ctx = useContext(CustomerNotificationContext);
  return ctx;
}

export function CustomerNotificationProvider({ children }: { children: ReactNode }) {
  const addToast = useToast().addToast;
  const [fcmTokenStatus, setFcmTokenStatus] = useState<'found' | 'not-found' | 'unknown'>('unknown');
  const [fcmLastSyncTime, setFcmLastSyncTime] = useState<Date | null>(null);
  const [fcmLastError, setFcmLastError] = useState<string | null>(null);
  const [fcmBridgeStatus, setFcmBridgeStatus] = useState<'present' | 'missing'>(() => getBridgeStatus());
  const fcmTokenSentRef = useRef(false);

  const refreshBridgeStatus = useCallback(() => {
    setFcmBridgeStatus(getBridgeStatus());
  }, []);

  const runSync = useCallback(() => {
    if (!FCM_API_BASE) return;
    const authToken = typeof localStorage !== 'undefined' ? localStorage.getItem(CUSTOMER_TOKEN_KEY) : null;
    if (!authToken) return;
    if (fcmTokenSentRef.current) return;
    setFcmLastError(null);
    registerFCMTokenAndSyncToServer(FCM_API_BASE, authToken, {
      onTokenStatus: setFcmTokenStatus,
      onSyncSuccess: () => {
        fcmTokenSentRef.current = true;
        setFcmLastSyncTime(new Date());
        setFcmLastError(null);
      },
    }).then((r) => {
      if (r.success) fcmTokenSentRef.current = true;
      else if (r.tokenReceived && r.error) fcmTokenSentRef.current = false;
      if (r.error) setFcmLastError(r.error);
    });
  }, []);

  useEffect(() => {
    const unsub = onNativeBridgeReady(() => {
      refreshBridgeStatus();
      fcmTokenSentRef.current = false;
      runSync();
    });
    return unsub;
  }, [refreshBridgeStatus, runSync]);

  useEffect(() => {
    if (!FCM_API_BASE) return;
    setFcmBridgeStatus(getBridgeStatus());
    runSync();
    const t2 = setTimeout(runSync, 2000);
    const t5 = setTimeout(runSync, 5000);
    const t15 = setTimeout(runSync, 15000);
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      refreshBridgeStatus();
      fcmTokenSentRef.current = false;
      runSync();
    };
    const onSyncRequest = (e: Event) => {
      const detail = (e as CustomEvent<{ token?: string }>).detail;
      const authToken = detail?.token ?? (typeof localStorage !== 'undefined' ? localStorage.getItem(CUSTOMER_TOKEN_KEY) : null);
      if (FCM_API_BASE && authToken) {
        fcmTokenSentRef.current = false;
        setFcmBridgeStatus(getBridgeStatus());
        registerFCMTokenAndSyncToServer(FCM_API_BASE, authToken, {
          callbackTimeoutMs: 15000,
          onTokenStatus: setFcmTokenStatus,
          onSyncSuccess: () => {
            fcmTokenSentRef.current = true;
            setFcmLastSyncTime(new Date());
            setFcmLastError(null);
          },
        }).then((r) => {
          if (r.error) setFcmLastError(r.error);
        });
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('nmd-fcm-sync-request', onSyncRequest);
    return () => {
      clearTimeout(t2);
      clearTimeout(t5);
      clearTimeout(t15);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('nmd-fcm-sync-request', onSyncRequest);
    };
  }, [runSync, refreshBridgeStatus]);

  const registerFCMTokenManual = useCallback(() => {
    refreshBridgeStatus();
    const authToken = typeof localStorage !== 'undefined' ? localStorage.getItem(CUSTOMER_TOKEN_KEY) : null;
    if (!authToken) {
      addToast('يجب تسجيل الدخول أولاً', 'error');
      return;
    }
    if (getBridgeStatus() === 'missing') {
      addToast('التطبيق الأصلي غير متاح', 'error');
      return;
    }
    fcmTokenSentRef.current = false;
    setFcmLastError(null);
    registerFCMTokenAndSyncToServer(FCM_API_BASE, authToken, {
      onTokenStatus: setFcmTokenStatus,
      onSyncSuccess: () => {
        fcmTokenSentRef.current = true;
        setFcmLastSyncTime(new Date());
        setFcmLastError(null);
      },
    }).then((r) => {
      if (r.error) setFcmLastError(r.error);
      if (r.success) addToast('تم ربط الجهاز بنجاح', 'success');
      else if (!r.tokenReceived) addToast('لم يتم الحصول على رمز الجهاز', 'error');
      else if (r.error) addToast('فشل ربط الجهاز', 'error');
    });
  }, [addToast, refreshBridgeStatus]);

  useEffect(() => {
    const handler = (payload: { orderId?: string; status?: string; title?: string; body?: string }) => {
      const text = payload.body || payload.title || 'تحديث الطلب';
      addToast(text, 'info');
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden' && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try {
          new Notification(payload.title || 'تحديث الطلب', { body: payload.body, tag: 'nmd-order-status' });
        } catch {
          // ignore
        }
      }
    };
    window.__onOrderStatus = handler;
    return () => {
      window.__onOrderStatus = undefined;
    };
  }, [addToast]);

  const value: CustomerNotificationContextValue = {
    fcmBridgeStatus,
    fcmTokenStatus,
    fcmLastSyncTime,
    fcmLastError,
    registerFCMTokenManual,
    refreshBridgeStatus,
  };

  return (
    <CustomerNotificationContext.Provider value={value}>
      {children}
    </CustomerNotificationContext.Provider>
  );
}
