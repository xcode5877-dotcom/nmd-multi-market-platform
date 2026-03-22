import { useState, useCallback } from 'react';

const API_BASE = (typeof import.meta !== 'undefined' && (import.meta as { env?: Record<string, string> }).env?.VITE_MOCK_API_URL) || '';
const CUSTOMER_TOKEN_KEY = 'nmd-customer-token';

export type NotificationPermissionState = 'default' | 'granted' | 'denied';

export interface UsePushNotificationsResult {
  permission: NotificationPermissionState | null;
  isSupported: boolean;
  isSubscribed: boolean;
  error: string | null;
  /** Pass customer phone so backend saves subscription under phone key. */
  requestAndSubscribe: (customerPhone: string) => Promise<boolean>;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications(): UsePushNotificationsResult {
  const [permission, setPermission] = useState<NotificationPermissionState | null>(() =>
    typeof Notification !== 'undefined' ? Notification.permission : null
  );
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSupported =
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window;

  const requestAndSubscribe = useCallback(async (customerPhone: string): Promise<boolean> => {
    setError(null);
    if (!isSupported) {
      setError('التنبيهات غير مدعومة في هذا المتصفح');
      return false;
    }
    if (!API_BASE) {
      setError('API غير متاح');
      return false;
    }
    const rawToken = localStorage.getItem(CUSTOMER_TOKEN_KEY);
    const token = rawToken?.trim() ?? '';
    if (!token) {
      setError('سجّل الدخول أولاً لتفعيل التنبيهات');
      return false;
    }
    const phone = String(customerPhone ?? '').trim();
    if (!phone) {
      setError('رقم الجوال مطلوب لتفعيل التنبيهات');
      return false;
    }

    try {
      // If already denied, show clear instructions to enable from settings
      if (Notification.permission === 'denied') {
        setPermission('denied');
        setError(
          'التنبيهات معطّلة. يرجى تفعيلها من إعدادات المتصفح: الإعدادات → التطبيقات → هذا الموقع → الإشعارات'
        );
        return false;
      }

      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') {
        setError(
          perm === 'denied'
            ? 'تم رفض التنبيهات. فعّلها من إعدادات المتصفح: الإعدادات → التطبيقات → هذا الموقع → الإشعارات'
            : 'لم يتم اختيار إذن التنبيهات'
        );
        return false;
      }

      const keyRes = await fetch(`${API_BASE}/customer/push-public-key`);
      if (!keyRes.ok) throw new Error('Failed to get push key');
      const { publicKey } = (await keyRes.json()) as { publicKey?: string };
      if (!publicKey) throw new Error('No public key');

      const reg = await navigator.serviceWorker.ready;
      reg.update(); // Force SW update so push subscription uses latest worker

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });

      const payload = { subscription: sub.toJSON(), phone };
      console.log('[Push] Sending to backend – phone:', phone, 'subscription:', payload.subscription);

      const res = await fetch(`${API_BASE}/customer/push-subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errBody = await res.text();
        console.error('[Push] POST /customer/push-subscription failed:', res.status, errBody);
        throw new Error(errBody || `HTTP ${res.status}`);
      }
      setIsSubscribed(true);
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'فشل تفعيل التنبيهات';
      setError(msg);
      return false;
    }
  }, [isSupported]);

  return { permission, isSupported, isSubscribed, error, requestAndSubscribe };
}
