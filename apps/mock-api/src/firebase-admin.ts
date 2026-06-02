/**
 * Firebase Admin SDK for FCM (Firebase Cloud Messaging).
 * Used to send high-priority push notifications to merchant Android app.
 *
 * Initialization (one of):
 * - FIREBASE_SERVICE_ACCOUNT_JSON: stringified JSON of the service account key (recommended in Docker)
 * - FIREBASE_SERVICE_ACCOUNT_PATH: path to a .json file (e.g. /app/firebase-service-account.json)
 *
 * If neither is set, FCM sending is no-op (web push and other flows still work).
 */

import { readFileSync, existsSync } from 'fs';
import admin from 'firebase-admin';

let app: admin.app.App | null = null;

function initFirebase(): admin.app.App | null {
  if (app) return app;

  const json = (process.env.FIREBASE_SERVICE_ACCOUNT_JSON ?? '').trim();
  const path = (process.env.FIREBASE_SERVICE_ACCOUNT_PATH ?? '').trim();

  // Diagnostic: log what we see so container logs show why FCM might not be configured
  console.log('[FCM] Init check: FIREBASE_SERVICE_ACCOUNT_JSON length=', json.length, ', FIREBASE_SERVICE_ACCOUNT_PATH=', path || '(empty)');

  if (json) {
    try {
      const cred = JSON.parse(json) as admin.ServiceAccount;
      console.log('[FCM] Loaded project_id (verify correct app):', cred.project_id ?? '(missing)');
      app = admin.initializeApp({ credential: admin.credential.cert(cred) });
      console.log('[FCM] Initialized from FIREBASE_SERVICE_ACCOUNT_JSON');
      return app;
    } catch (e) {
      console.error('[FCM] Invalid FIREBASE_SERVICE_ACCOUNT_JSON:', (e as Error).message);
      return null;
    }
  }

  if (path) {
    const fileExists = existsSync(path);
    console.log('[FCM] Path mode: file exists=', fileExists, ', path=', path);
    if (!fileExists) {
      console.error('[FCM] File not found at FIREBASE_SERVICE_ACCOUNT_PATH. Check volume mount.');
      return null;
    }
    try {
      const raw = readFileSync(path, 'utf8');
      const cred = JSON.parse(raw) as admin.ServiceAccount;
      console.log('[FCM] Loaded project_id (verify correct app):', cred.project_id ?? '(missing)');
      if (!cred.client_email || !cred.private_key) {
        console.error('[FCM] JSON missing client_email or private_key (wrong file type?). Use Firebase Console → Service accounts → Generate new private key.');
        return null;
      }
      app = admin.initializeApp({ credential: admin.credential.cert(cred) });
      console.log('[FCM] Initialized from FIREBASE_SERVICE_ACCOUNT_PATH');
      return app;
    } catch (e) {
      console.error('[FCM] Failed to load service account from path:', (e as Error).message);
      return null;
    }
  }

  console.warn('[FCM] Not configured: set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH');
  return null;
}

const FCM_MISMATCH_WARNING =
  '[FCM] *** Service Account JSON does not match the App\'s Firebase project. Replace the key file with one from the same project as your app (e.g. now-market-59841). ***';

function isMismatchedCredentialError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const code = typeof (err as { code?: string })?.code === 'string' ? (err as { code: string }).code : '';
  const lower = (msg + ' ' + code).toLowerCase();
  return (
    lower.includes('mismatch') ||
    (lower.includes('credential') && lower.includes('project')) ||
    (lower.includes('sender') && lower.includes('match')) ||
    lower.includes('third-party') ||
    lower.includes('auth/credential')
  );
}

function logMismatchIfNeeded(err: unknown): void {
  if (isMismatchedCredentialError(err)) console.warn(FCM_MISMATCH_WARNING);
}

/**
 * Send a high-priority FCM notification to a single device by token.
 * Uses both notification (for system tray) and data; priority 'high' so Android shows the notification.
 * Channel ID must match MyFirebaseMessagingService.CHANNEL_ID ("new_order_alerts").
 */
export async function sendFCMToToken(
  token: string,
  payload: { title: string; body: string; data?: Record<string, string>; imageUrl?: string },
  androidChannelId = 'new_order_alerts'
): Promise<{ success: boolean; error?: string }> {
  const a = initFirebase();
  if (!a || !token?.trim()) {
    return { success: false, error: a ? 'Missing token' : 'FCM not configured' };
  }
  try {
    const messageId = await a.messaging().send({
      token: token.trim(),
      notification: {
        title: payload.title,
        body: payload.body,
        ...(payload.imageUrl ? { imageUrl: payload.imageUrl } : {}),
      },
      data: {
        ...(payload.data ?? {}),
        ...(payload.imageUrl ? { imageUrl: payload.imageUrl } : {}),
      },
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: androidChannelId,
          priority: 'max' as const,
          defaultSound: true,
          ...(payload.imageUrl ? { imageUrl: payload.imageUrl } : {}),
        },
      },
      apns: {
        payload: { aps: { sound: 'default', contentAvailable: true } },
        fcmOptions: {},
      },
    });
    console.log('[FCM] messaging().send result (messageId):', messageId);
    return { success: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[FCM] send failed:', msg, 'token:', token.slice(0, 20) + '...');
    logMismatchIfNeeded(e);
    return { success: false, error: msg };
  }
}

/**
 * Send a notification to many device tokens at once (multicast).
 * Uses Firebase Admin messaging.sendEachForMulticast under the hood.
 * Tokens are sent as-is; caller should de-dupe beforehand.
 */
export async function sendFCMMulticast(
  tokens: string[],
  payload: { title: string; body: string; data?: Record<string, string>; imageUrl?: string },
  androidChannelId = 'customer_notifications'
): Promise<{ successCount: number; failureCount: number }> {
  const a = initFirebase();
  const clean = (tokens ?? []).map((t) => t.trim()).filter(Boolean);
  if (!a || clean.length === 0) {
    return { successCount: 0, failureCount: 0 };
  }
  try {
    const res = await a.messaging().sendEachForMulticast({
      tokens: clean,
      notification: {
        title: payload.title,
        body: payload.body,
        ...(payload.imageUrl ? { imageUrl: payload.imageUrl } : {}),
      },
      data: {
        ...(payload.data ?? {}),
        ...(payload.imageUrl ? { imageUrl: payload.imageUrl } : {}),
      },
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: androidChannelId,
          priority: 'max' as const,
          defaultSound: true,
          ...(payload.imageUrl ? { imageUrl: payload.imageUrl } : {}),
        },
      },
      apns: {
        payload: { aps: { sound: 'default', contentAvailable: true } },
        fcmOptions: {},
      },
    });
    console.log('[FCM] sendEachForMulticast result: success=', res.successCount, 'failure=', res.failureCount);
    if (res.failureCount > 0) {
      res.responses.forEach((resp, idx) => {
        if (!resp.success && resp.error) {
          console.error(`[FCM] Token ${idx} Error:`, JSON.stringify(resp.error, null, 2));
          logMismatchIfNeeded(resp.error);
        }
      });
    }
    return { successCount: res.successCount, failureCount: res.failureCount };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[FCM] sendMulticast failed:', msg);
    logMismatchIfNeeded(e);
    return { successCount: 0, failureCount: clean.length };
  }
}

export function isFCMConfigured(): boolean {
  return initFirebase() != null;
}
