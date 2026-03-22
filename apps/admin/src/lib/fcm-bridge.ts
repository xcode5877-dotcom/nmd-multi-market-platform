/**
 * Single source of truth for FCM token capture and server sync (Merchant app).
 * - No FCM token is ever stored in localStorage; token is sent to server only.
 * - One callback slot at a time to avoid race conditions.
 * - Used by OrderAlarmContext for automatic and manual registration.
 */

/** Name passed to NativeBridge.getFCMToken so Android invokes this global. */
const FCM_CALLBACK_NAME = 'window.__onFCMToken';
const FCM_CALLBACK_PROP = '__onFCMToken';

export type FCMBridgeStatus = 'present' | 'missing';

export function getBridgeStatus(): FCMBridgeStatus {
  if (typeof window === 'undefined') return 'missing';
  const bridge = (window as unknown as { NativeBridge?: { getFCMToken?: (cb: string) => void } }).NativeBridge;
  return bridge?.getFCMToken ? 'present' : 'missing';
}

export interface SyncResult {
  success: boolean;
  tokenReceived: boolean;
  error?: string;
}

/**
 * Request FCM token from native bridge and PUT to server. Single callback; clears any previous.
 * Resolves when callback fired (or timeout). Does not throw.
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
  const url = `${apiBase.replace(/\/$/, '')}/users/me/fcm-token`;

  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve({ success: false, tokenReceived: false, error: 'no window' });
      return;
    }
    const bridge = (window as unknown as { NativeBridge?: { getFCMToken?: (cb: string) => void } }).NativeBridge;
    const getFCMToken = bridge?.getFCMToken;
    if (!getFCMToken) {
      resolve({ success: false, tokenReceived: false, error: 'NativeBridge.getFCMToken not available' });
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
      console.log('[fcm-bridge] Calling NativeBridge.getFCMToken with callback:', FCM_CALLBACK_NAME);
      window.alert('Calling Bridge...');
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
