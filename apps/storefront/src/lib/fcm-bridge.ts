/**
 * Single source of truth for FCM token capture and server sync (Customer app).
 * Same pattern as admin fcm-bridge: no token in localStorage, one callback at a time.
 * Used by CustomerNotificationContext.
 */

const FCM_CALLBACK_NAME = 'window.__onFCMToken';
const FCM_CALLBACK_PROP = '__onFCMToken';
const NATIVE_UA_SUFFIX = 'NMD-Native-App';

export type FCMBridgeStatus = 'present' | 'missing';

/** True if running inside the native app WebView (User-Agent contains NMD-Native-App or NMD-Native-App-V2). */
export function isNativeAppUA(): boolean {
  if (typeof navigator === 'undefined') return false;
  return typeof navigator.userAgent === 'string' && navigator.userAgent.includes(NATIVE_UA_SUFFIX);
}

/** Event name dispatched by native onPageFinished so the frontend can initialize the bridge. */
export const NATIVE_BRIDGE_READY_EVENT = 'nativeBridgeReady';

/**
 * Subscribe to nativeBridgeReady (fired by Android onPageFinished when the bridge is ready).
 * Use this to refresh bridge status and run FCM sync after the page loads.
 * Returns an unsubscribe function.
 */
export function onNativeBridgeReady(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = () => callback();
  window.addEventListener(NATIVE_BRIDGE_READY_EVENT, handler);
  return () => window.removeEventListener(NATIVE_BRIDGE_READY_EVENT, handler);
}

/**
 * Bridge status: present only when window.NativeBridge.getFCMToken exists.
 * Resilient: uses explicit checks; UA is only for diagnostics (e.g. "in app but bridge not ready").
 */
export function getBridgeStatus(): FCMBridgeStatus {
  if (typeof window === 'undefined') return 'missing';
  const w = window as unknown as { NativeBridge?: { getFCMToken?: (callbackName: string) => void } };
  const bridge = w.NativeBridge;
  if (bridge == null || typeof bridge.getFCMToken !== 'function') return 'missing';
  return 'present';
}

/**
 * When UA contains NMD-Native-App but window.NativeBridge is missing, returns a specific debug message.
 * Frontend can show this so the user knows injection failed (timing or WebView issue).
 */
export function getBridgeDebugMessage(): string | null {
  if (typeof window === 'undefined') return null;
  if (isNativeAppUA() && getBridgeStatus() === 'missing') return 'Bridge Object Missing - Injection Failed';
  return null;
}

export interface SyncResult {
  success: boolean;
  tokenReceived: boolean;
  error?: string;
}

/**
 * Request FCM token from native bridge and PUT to server (customer endpoint).
 * Single callback; resolves when callback fired or timeout. Does not throw.
 */
export function registerFCMTokenAndSyncToServer(
  apiBase: string,
  authToken: string | null,
  options: {
    callbackTimeoutMs?: number;
    onTokenStatus?: (status: 'found' | 'not-found') => void;
    onSyncSuccess?: () => void;
  } = {}
): Promise<SyncResult> {
  const { callbackTimeoutMs = 15000, onTokenStatus, onSyncSuccess } = options;
  const url = `${apiBase.replace(/\/$/, '')}/customer/me/fcm-token`;

  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve({ success: false, tokenReceived: false, error: 'no window' });
      return;
    }
    const bridge = (window as unknown as { NativeBridge?: { getFCMToken?: (cb: string) => void } }).NativeBridge;
    const getFCMToken = bridge?.getFCMToken;
    if (!getFCMToken) {
      const debugMsg = getBridgeDebugMessage();
      resolve({
        success: false,
        tokenReceived: false,
        error: debugMsg ?? 'NativeBridge.getFCMToken not available',
      });
      return;
    }
    if (!authToken?.trim()) {
      resolve({ success: false, tokenReceived: false, error: 'no auth token' });
      return;
    }

    let promiseResolved = false;
    const win = window as unknown as Record<string, unknown>;

    const finish = (result: SyncResult, clearCallback: boolean) => {
      if (promiseResolved) return;
      promiseResolved = true;
      if (clearCallback) win[FCM_CALLBACK_PROP] = undefined;
      resolve(result);
    };

    win[FCM_CALLBACK_PROP] = (raw: string) => {
      const token = (raw ?? '').trim();
      onTokenStatus?.(token ? 'found' : 'not-found');
      if (!token) {
        finish({ success: false, tokenReceived: false }, true);
        return;
      }
      fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ fcmToken: token }),
        credentials: 'include',
      })
        .then((res) => {
          if (res.ok) {
            onSyncSuccess?.();
            finish({ success: true, tokenReceived: true }, true);
          } else {
            finish({ success: false, tokenReceived: true, error: `HTTP ${res.status}` }, true);
          }
        })
        .catch((e) => {
          const msg = e instanceof Error ? e.message : String(e);
          finish({ success: false, tokenReceived: true, error: msg }, true);
        });
    };

    try {
      getFCMToken(FCM_CALLBACK_NAME);
    } catch (e) {
      finish({ success: false, tokenReceived: false, error: e instanceof Error ? e.message : String(e) }, true);
      return;
    }

    setTimeout(() => {
      if (!promiseResolved) {
        onTokenStatus?.('not-found');
        finish({ success: false, tokenReceived: false, error: 'timeout' }, false);
      }
    }, callbackTimeoutMs);
  });
}
