import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@nmd/ui';
import { useAdminContext } from '../context/AdminContext';
import { useAuth } from './AuthContext';
import { MockApiClient } from '@nmd/mock';
import { getBridgeStatus, registerFCMTokenAndSyncToServer } from '../lib/fcm-bridge';

const USE_API = !!import.meta.env.VITE_MOCK_API_URL;
const MOCK_API_URL = (import.meta.env.VITE_MOCK_API_URL ?? '').replace(/\/$/, '');
/** Full API base for FCM registration. Must be absolute URL so WebView/native can reach the server. */
const FCM_API_BASE = (MOCK_API_URL || 'https://nmd.marketing/api').replace(/\/$/, '');
const api = new MockApiClient();
const ALARM_SRC = '/alarm.mp3';
const REFETCH_MS = 5000;
/** When Web Push is not active, poll for new orders every 30s as fallback. */
const POLLING_FALLBACK_MS = 30000;
const TOKEN_KEY = 'nmd-access-token';

/** Debug: call from console to force FCM re-registration (uses same path as manual button). */
function setupForceRegisterFCM(): void {
  if (typeof window === 'undefined') return;
  (window as unknown as { forceRegisterFCM?: () => void }).forceRegisterFCM = function forceRegisterFCM() {
    const authToken = typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
    if (!authToken) {
      console.error('[FCM] forceRegisterFCM: No auth token (key: ' + TOKEN_KEY + ')');
      return;
    }
    registerFCMTokenAndSyncToServer(FCM_API_BASE, authToken, {
      onSyncSuccess: () => console.log('[FCM] forceRegisterFCM: token sent'),
    }).then((r) => console.log('[FCM] forceRegisterFCM result:', r));
  };
}
setupForceRegisterFCM();

/** iOS Safari–compatible: base64url to Uint8Array (trim and normalize). */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const raw = String(base64String).trim().replace(/\s/g, '');
  const padding = '='.repeat((4 - (raw.length % 4)) % 4);
  const base64 = (raw + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/** Reject after ms so we don't hang (e.g. serviceWorker.ready on iOS). */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} (timeout ${ms}ms)`)), ms)
    ),
  ]);
}

/** Unlock AudioContext (iOS/Safari) and pre-create Audio on first user gesture so play() works. */
function unlockAudioOnUserGesture(
  audioRef: React.MutableRefObject<HTMLAudioElement | null>,
  audioContextRef: React.MutableRefObject<AudioContext | null>
): void {
  try {
    if (!audioContextRef.current && typeof window !== 'undefined') {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (Ctx) audioContextRef.current = new Ctx();
    }
    if (audioContextRef.current?.state === 'suspended') {
      audioContextRef.current.resume();
    }
    if (!audioRef.current) {
      const a = new Audio(ALARM_SRC);
      audioRef.current = a;
    }
  } catch {
    // ignore
  }
}

/** Fallback beep when alarm.mp3 is not available (e.g. no asset). */
function playFallbackBeep(audioContextRef: React.MutableRefObject<AudioContext | null>): void {
  try {
    const ctx = audioContextRef.current ?? new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (!audioContextRef.current) audioContextRef.current = ctx;
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch {
    // ignore
  }
}

interface OrderAlarmContextValue {
  hasPendingAlarm: boolean;
  pendingCount: number;
  muted: boolean;
  setMuted: (muted: boolean) => void;
  /** True when browser blocked autoplay; user must click "Enable Sound Alerts" (user gesture) to unlock. */
  audioBlocked: boolean;
  /** Call after user gesture to unlock audio and retry alarm (e.g. "Enable Sound Alerts" button). */
  enableSoundAlerts: () => void;
  /** Stops the alarm immediately and mutes (e.g. when merchant clicks notification or "Stop sound"). */
  stopSound: () => void;
  testSound: () => void;
  /** Manual register: requestPermission() then subscribe. Use after user click (iOS). */
  registerForPush: () => Promise<void>;
  /** Manual FCM token registration: get token from native bridge, PUT to backend, show toast. */
  registerFCMTokenManual: () => void;
  /** Last subscription error message (e.g. "SSL Required", "Invalid Key") for on-screen display. */
  pushError: string | null;
  /** FCM token status: found, not-found, or unknown. */
  fcmTokenStatus: 'found' | 'not-found' | 'unknown';
  /** Native bridge present (for diagnostics). */
  fcmBridgeStatus: 'present' | 'missing';
  /** Last time FCM token was successfully synced to server (for diagnostics). */
  fcmLastSyncTime: Date | null;
}

const OrderAlarmContext = createContext<OrderAlarmContextValue | null>(null);

export function useOrderAlarm() {
  const ctx = useContext(OrderAlarmContext);
  return ctx;
}

const pushSupported =
  typeof window !== 'undefined' &&
  window.isSecureContext === true &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window;

/** True when running as installed PWA (standalone), so we re-subscribe on every launch. */
function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  return !!(navigator as { standalone?: boolean }).standalone;
}

export function OrderAlarmProvider({ children }: { children: ReactNode }) {
  const { tenantId } = useAdminContext();
  const { token } = useAuth();
  const addToast = useToast().addToast;
  const [muted, setMutedState] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const fallbackIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pushSubscriptionAttemptedRef = useRef(false);
  const fcmTokenSentRef = useRef(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const [fcmTokenStatus, setFcmTokenStatus] = useState<'found' | 'not-found' | 'unknown'>('unknown');
  const [fcmLastSyncTime, setFcmLastSyncTime] = useState<Date | null>(null);
  const [fcmBridgeStatus, setFcmBridgeStatus] = useState<'present' | 'missing'>(() => getBridgeStatus());
  const prevPendingCountRef = useRef<number>(-1);
  const unlockOnceRef = useRef(false);
  /** True after successful push subscription; when false, use 30s fallback polling. */
  const [pushSubscriptionActive, setPushSubscriptionActive] = useState(false);

  const { data: orders = [] } = useQuery({
    queryKey: ['orders-board', tenantId],
    queryFn: () => (USE_API ? api.listOrdersByTenant(tenantId) : Promise.resolve([])),
    enabled: !!tenantId,
    refetchInterval: pushSubscriptionActive ? REFETCH_MS : POLLING_FALLBACK_MS,
  });

  const pendingOrders = orders.filter((o) => o.status === 'PENDING');
  const pendingCount = pendingOrders.length;
  const hasPendingAlarm = pendingCount > 0;

  const setMuted = useCallback((m: boolean) => {
    setMutedState(m);
  }, []);

  const stopSound = useCallback(() => {
    if (fallbackIntervalRef.current) {
      clearInterval(fallbackIntervalRef.current);
      fallbackIntervalRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setMutedState(true);
  }, []);

  const testSound = useCallback(() => {
    if (muted) return;
    let audio = audioRef.current;
    if (!audio) {
      audio = new Audio(ALARM_SRC);
      audioRef.current = audio;
    }
    audio.volume = 1;
    audio.loop = false;
    audio.play().catch(() => playFallbackBeep(audioContextRef));
  }, [muted]);

  const enableSoundAlerts = useCallback(() => {
    unlockAudioOnUserGesture(audioRef, audioContextRef);
    if (audioContextRef.current?.state === 'suspended') {
      audioContextRef.current.resume();
    }
    if (fallbackIntervalRef.current) {
      clearInterval(fallbackIntervalRef.current);
      fallbackIntervalRef.current = null;
    }
    setAudioBlocked(false);
    testSound();
    const audio = audioRef.current;
    if (audio && hasPendingAlarm && !muted) {
      audio.loop = true;
      audio.play().then(() => setAudioBlocked(false)).catch(() => setAudioBlocked(true));
    }
  }, [hasPendingAlarm, muted, testSound]);

  const subscribeUser = useCallback(async (fromUserClick = false) => {
    if (!pushSupported || !MOCK_API_URL || !token || !tenantId) {
      if (fromUserClick) setPushError('المتصفح أو البيئة لا تدعم التنبيهات.');
      return;
    }
    setPushError(null);
    const SW_READY_MS = 10000;
    const SUBSCRIBE_MS = 15000;
    try {
      let permission = Notification.permission;
      if (permission === 'default') {
        permission = await Notification.requestPermission();
      }
      if (permission !== 'granted') {
        if (fromUserClick) setPushError(permission === 'denied' ? 'تم رفض الإشعارات' : 'لم يتم منح الإذن');
        return;
      }
      const keyRes = await fetch(`${MOCK_API_URL}/merchant/push-public-key`);
      if (!keyRes.ok) {
        const msg = `فشل جلب المفتاح: ${keyRes.status}`;
        if (fromUserClick) setPushError(msg);
        return;
      }
      const keyData = (await keyRes.json()) as { publicKey?: string };
      const publicKeyRaw = keyData?.publicKey;
      if (!publicKeyRaw || typeof publicKeyRaw !== 'string') {
        if (fromUserClick) setPushError('Invalid Key أو مفتاح غير صالح');
        return;
      }
      let applicationServerKey: Uint8Array;
      try {
        applicationServerKey = urlBase64ToUint8Array(publicKeyRaw);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (fromUserClick) setPushError(`تنسيق المفتاح غير صالح: ${msg}`);
        return;
      }
      const swUrl = typeof window !== 'undefined' ? new URL('/sw.js', window.location.origin).href : '/sw.js';
      const reg = await withTimeout(
        (async () => {
          const registration =
            (await navigator.serviceWorker.getRegistration('/')) ||
            (await navigator.serviceWorker.register(swUrl, { scope: '/' }));
          await registration.update();
          return registration;
        })(),
        SW_READY_MS,
        'Service Worker لم يصبح جاهزاً'
      );
      const sub = await withTimeout(
        reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey as BufferSource,
        }),
        SUBSCRIBE_MS,
        'طلب الاشتراك (Push)'
      );
      const subJson = sub.toJSON();
      console.info('[Push] PushSubscription registered', subJson);
      const authToken = typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
      const postRes = await fetch(`${MOCK_API_URL}/merchant/push-subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({ subscription: subJson, tenantId }),
      });
      if (!postRes.ok) {
        const errText = await postRes.text();
        const msg = errText || `خطأ الخادم: ${postRes.status}`;
        if (fromUserClick) setPushError(msg);
        setPushSubscriptionActive(false);
        return;
      }
      setPushError(null);
      setPushSubscriptionActive(true);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.warn('[Push] subscribeUser failed', e);
      setPushError(message);
      setPushSubscriptionActive(false);
    }
  }, [token, tenantId]);

  const registerForPush = useCallback(async () => {
    setPushError(null);
    if (!pushSupported) {
      setPushError('المتصفح لا يدعم التنبيهات (PushManager غير متوفر)');
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      setPushError(permission === 'denied' ? 'تم رفض الإشعارات' : 'لم يتم منح الإذن');
      return;
    }
    await subscribeUser(true);
  }, [subscribeUser]);

  useEffect(() => {
    if (!pushSupported || !MOCK_API_URL || !token || !tenantId) return;
    if (!isStandalone() && pushSubscriptionAttemptedRef.current) return;
    if (!isStandalone()) pushSubscriptionAttemptedRef.current = true;
    subscribeUser();
  }, [token, tenantId, subscribeUser]);

  // Native app: sync FCM token to server. Retries at 0, 2s, 5s, 15s and on visibilitychange (handles slow bridge init).
  useEffect(() => {
    if (!FCM_API_BASE || !token) return;
    setFcmBridgeStatus(getBridgeStatus());

    const runSync = () => {
      if (fcmTokenSentRef.current) return;
      registerFCMTokenAndSyncToServer(FCM_API_BASE, token, {
        onTokenStatus: setFcmTokenStatus,
        onSyncSuccess: () => {
          fcmTokenSentRef.current = true;
          setFcmLastSyncTime(new Date());
        },
      }).then((r) => {
        if (r.success) fcmTokenSentRef.current = true;
        else if (r.tokenReceived && r.error) fcmTokenSentRef.current = false;
      });
    };

    runSync();
    const t2 = setTimeout(runSync, 2000);
    const t5 = setTimeout(runSync, 5000);
    const t15 = setTimeout(runSync, 15000);
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      setFcmBridgeStatus(getBridgeStatus());
      fcmTokenSentRef.current = false;
      runSync();
    };
    const onSyncRequest = (e: Event) => {
      const detail = (e as CustomEvent<{ token?: string }>).detail;
      const authToken = detail?.token ?? token ?? (typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null);
      if (FCM_API_BASE && authToken) {
        fcmTokenSentRef.current = false;
        setFcmBridgeStatus(getBridgeStatus());
        registerFCMTokenAndSyncToServer(FCM_API_BASE, authToken, {
          callbackTimeoutMs: 15000,
          onTokenStatus: setFcmTokenStatus,
          onSyncSuccess: () => {
            fcmTokenSentRef.current = true;
            setFcmLastSyncTime(new Date());
          },
        }).then(() => {});
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
  }, [FCM_API_BASE, token]);

  const registerFCMTokenManual = useCallback(() => {
    const authToken = token ?? (typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null);
    if (!authToken) {
      addToast('يجب تسجيل الدخول أولاً', 'error');
      return;
    }
    if (getBridgeStatus() === 'missing') {
      addToast('التطبيق الأصلي غير متاح', 'error');
      return;
    }
    fcmTokenSentRef.current = false;
    registerFCMTokenAndSyncToServer(FCM_API_BASE, authToken, {
      onTokenStatus: setFcmTokenStatus,
      onSyncSuccess: () => {
        fcmTokenSentRef.current = true;
        setFcmLastSyncTime(new Date());
      },
    }).then((r) => {
      if (r.success) addToast('تم ربط الجهاز بنجاح', 'success');
      else if (!r.tokenReceived) addToast('لم يتم الحصول على رمز الجهاز', 'error');
      else if (r.error) addToast('فشل ربط الجهاز', 'error');
    });
  }, [token, addToast]);

  useEffect(() => {
    if (pendingCount <= prevPendingCountRef.current) {
      prevPendingCountRef.current = pendingCount;
      return;
    }
    const prev = prevPendingCountRef.current;
    prevPendingCountRef.current = pendingCount;
    if (prev >= 0 && pendingCount > prev) {
      addToast(`طلب جديد! لديك ${pendingCount} طلب بانتظار الموافقة`, 'info');
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden' && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try {
          new Notification('طلب جديد وصل! 🔔', {
            body: `لديك ${pendingCount} طلب بانتظار الموافقة`,
            tag: 'new-order-toast',
          });
        } catch {
          // ignore
        }
      }
    }
  }, [pendingCount, addToast]);

  /* iOS/Safari: first user interaction anywhere must unlock AudioContext so "New Order" sound can play later. */
  useEffect(() => {
    if (unlockOnceRef.current || typeof document === 'undefined') return;
    const unlock = () => {
      if (unlockOnceRef.current) return;
      unlockOnceRef.current = true;
      unlockAudioOnUserGesture(audioRef, audioContextRef);
      if (audioContextRef.current?.state === 'suspended') {
        audioContextRef.current.resume();
      }
      document.removeEventListener('click', unlock, true);
      document.removeEventListener('touchstart', unlock, true);
      document.removeEventListener('keydown', unlock, true);
    };
    const opts = { capture: true, passive: true };
    document.addEventListener('click', unlock, opts);
    document.addEventListener('touchstart', unlock, opts);
    document.addEventListener('keydown', unlock, opts);
    return () => {
      document.removeEventListener('click', unlock, true);
      document.removeEventListener('touchstart', unlock, true);
      document.removeEventListener('keydown', unlock, true);
    };
  }, []);

  useEffect(() => {
    if (!hasPendingAlarm || muted) {
      setAudioBlocked(false);
      if (fallbackIntervalRef.current) {
        clearInterval(fallbackIntervalRef.current);
        fallbackIntervalRef.current = null;
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      return;
    }
    let audio = audioRef.current;
    if (!audio) {
      audio = new Audio(ALARM_SRC);
      audioRef.current = audio;
    }
    audio.volume = 1;
    audio.loop = true;
    audio.play().catch(() => {
      setAudioBlocked(true);
      if (fallbackIntervalRef.current) return;
      fallbackIntervalRef.current = setInterval(
        () => playFallbackBeep(audioContextRef),
        800
      );
    });
    return () => {
      if (fallbackIntervalRef.current) {
        clearInterval(fallbackIntervalRef.current);
        fallbackIntervalRef.current = null;
      }
      audio?.pause();
      if (audio) audio.currentTime = 0;
    };
  }, [hasPendingAlarm, muted]);

  const value: OrderAlarmContextValue = {
    hasPendingAlarm,
    pendingCount,
    muted,
    setMuted,
    audioBlocked,
    enableSoundAlerts,
    stopSound,
    testSound,
    registerForPush,
    registerFCMTokenManual,
    pushError,
    fcmTokenStatus,
    fcmBridgeStatus,
    fcmLastSyncTime,
  };

  return (
    <OrderAlarmContext.Provider value={value}>
      {children}
    </OrderAlarmContext.Provider>
  );
}
