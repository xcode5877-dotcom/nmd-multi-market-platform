import { useState, useCallback } from 'react';

const API_BASE = (typeof import.meta !== 'undefined' && (import.meta as { env?: Record<string, string> }).env?.VITE_MOCK_API_URL) || '';
const CUSTOMER_TOKEN_KEY = 'nmd-customer-token';

export type NotificationPermissionState = 'default' | 'granted' | 'denied';

export interface UsePushNotificationsResult {
  permission: NotificationPermissionState | null;
  isSupported: boolean;
  isSubscribed: boolean;
  error: string | null;
  requestAndSubscribe: () => Promise<boolean>;
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

  const requestAndSubscribe = useCallback(async (): Promise<boolean> => {
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

    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') {
        setError(perm === 'denied' ? 'تم رفض التنبيهات' : 'لم يتم اختيار إذن التنبيهات');
        return false;
      }

      const keyRes = await fetch(`${API_BASE}/customer/push-public-key`);
      if (!keyRes.ok) throw new Error('Failed to get push key');
      const { publicKey } = (await keyRes.json()) as { publicKey?: string };
      if (!publicKey) throw new Error('No public key');
      alert('1. Public Key Received');

      if (typeof window !== 'undefined') {
        alert('Checking: ' + (window.isSecureContext ? 'Secure' : 'NOT Secure'));
        alert('SW: ' + ('serviceWorker' in navigator ? 'Yes' : 'No'));
        alert('Push: ' + ('PushManager' in window ? 'Yes' : 'No'));
      }

      const reg = await navigator.serviceWorker.ready;
      let sub: PushSubscription;
      alert('2. Starting PushManager Subscribe');
      try {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
      } catch (subscribeErr) {
        console.error('[Push] pushManager.subscribe failed:', subscribeErr);
        throw subscribeErr;
      }

      const res = await fetch(`${API_BASE}/customer/push-subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ subscription: sub.toJSON() }),
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
      alert('3. Error: ' + (e instanceof Error ? e.message : String(e)));
      setError(msg);
      return false;
    }
  }, [isSupported]);

  return { permission, isSupported, isSubscribed, error, requestAndSubscribe };
}
