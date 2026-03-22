/**
 * Push subscription storage keyed by customer phone.
 * VAPID keys: process.env first (required in production), then hardcoded fallback for dev.
 * Production: set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY (generate with node scripts/gen-vapid.cjs).
 * Same keys must be used for all clients (storefront, admin, web-gateway if it serves push).
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import webpush from 'web-push';

export type PushSubscriptionJSON = {
  endpoint: string;
  keys?: { p256dh?: string; auth?: string };
  expirationTime?: number | null;
};

const VAPID_PUBLIC_KEY_ENV = 'VAPID_PUBLIC_KEY';
const VAPID_PRIVATE_KEY_ENV = 'VAPID_PRIVATE_KEY';
const VAPID_MAILTO = 'mailto:admin@nmd.marketing';

/** Fallback pair — used only when env vars are not set. Generate with: node scripts/gen-vapid.cjs */
const HARDCODED_VAPID_PUBLIC = 'BFadhS3-u7kPKhi0zE8yVLb05BJzSjqbX1yrFOxKQ9gSTIL-NxAYlE-EVDOhuHO8s2pJ60nt3Gi_ZlDrQEldyKg';
const HARDCODED_VAPID_PRIVATE = 'EysEyBtpApxAV4-mjGyQZgWTRalMR4rIgfg9eWb9ua4';

/** Docker: set PUSH_SUBSCRIPTIONS_FILE e.g. /app/data/push-subscriptions.json. Default: cwd/data for local dev. */
const PUSH_SUBS_FILE = process.env.PUSH_SUBSCRIPTIONS_FILE || join(process.cwd(), 'data', 'push-subscriptions.json');

const pubEnv = (process.env[VAPID_PUBLIC_KEY_ENV] ?? '').trim();
const privEnv = (process.env[VAPID_PRIVATE_KEY_ENV] ?? '').trim();
const vapidPublicKey: string = pubEnv && privEnv ? pubEnv : HARDCODED_VAPID_PUBLIC;
const vapidPrivateKey: string = pubEnv && privEnv ? privEnv : HARDCODED_VAPID_PRIVATE;

webpush.setVapidDetails(VAPID_MAILTO, vapidPublicKey, vapidPrivateKey);

/** Returns the public key used for push (same value as /customer/push-public-key and /merchant/push-public-key). */
export function getVapidPublicKey(): string {
  return vapidPublicKey.trim();
}

type Stored = Record<string, PushSubscriptionJSON[]>;

function load(): Stored {
  try {
    if (existsSync(PUSH_SUBS_FILE)) {
      const raw = readFileSync(PUSH_SUBS_FILE, 'utf-8');
      const data = JSON.parse(raw) as Stored;
      return typeof data === 'object' && data !== null ? data : {};
    }
  } catch {
    // ignore
  }
  return {};
}

function save(data: Stored): void {
  try {
    const dir = dirname(PUSH_SUBS_FILE);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(PUSH_SUBS_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    console.error('[Push] Failed to save subscriptions:', e?.code ?? 'error', e?.message ?? err, 'path:', PUSH_SUBS_FILE);
  }
}

const memory: Stored = load();

export function saveSubscription(phone: string, subscription: PushSubscriptionJSON): void {
  const key = String(phone).replace(/\D/g, '');
  if (!key) return;
  const list = memory[key] ?? [];
  const sameEndpoint = list.find((s) => s.endpoint === subscription.endpoint);
  const isNew = !sameEndpoint;
  if (sameEndpoint) {
    sameEndpoint.keys = subscription.keys;
    sameEndpoint.expirationTime = subscription.expirationTime;
  } else {
    list.push({ ...subscription });
  }
  memory[key] = list.slice(-10);
  save(memory);
  console.log(`[Push] Subscription ${isNew ? 'registered' : 'updated'} for phone ***${key.slice(-4)} (${list.length} device(s))`);
}

export function getSubscriptionsByPhone(phone: string): PushSubscriptionJSON[] {
  const key = String(phone).replace(/\D/g, '');
  return memory[key] ?? [];
}

const ADMIN_KEY_PREFIX = 'tenant:';

export function saveAdminSubscription(tenantId: string, subscription: PushSubscriptionJSON): void {
  const key = ADMIN_KEY_PREFIX + String(tenantId);
  const list = memory[key] ?? [];
  const sameEndpoint = list.find((s) => s.endpoint === subscription.endpoint);
  const isNew = !sameEndpoint;
  if (sameEndpoint) {
    sameEndpoint.keys = subscription.keys;
    sameEndpoint.expirationTime = subscription.expirationTime;
  } else {
    list.push({ ...subscription });
  }
  memory[key] = list.slice(-20);
  save(memory);
  console.log(`[Push] Admin subscription ${isNew ? 'registered' : 'updated'} for tenant ${tenantId} (${list.length} device(s))`);
}

export function getSubscriptionsByTenant(tenantId: string): PushSubscriptionJSON[] {
  const key = ADMIN_KEY_PREFIX + String(tenantId);
  return memory[key] ?? [];
}

/** Web-push error shape (statusCode, body) for logging. */
interface WebPushError extends Error {
  statusCode?: number;
  body?: string | Buffer;
  endpoint?: string;
}

export function sendPushNotification(subscription: PushSubscriptionJSON, payload: string | Record<string, unknown>): Promise<unknown> {
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const endpoint = subscription?.endpoint;
  const keys = subscription?.keys;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return Promise.reject(new Error('Push subscription missing endpoint or keys (p256dh/auth)'));
  }
  const pushSubscription = {
    endpoint,
    keys: { p256dh: keys.p256dh, auth: keys.auth },
  };

  return webpush
    .sendNotification(pushSubscription, body, { TTL: 86400, urgency: 'normal' })
    .catch((err: WebPushError) => {
      const statusCode = err?.statusCode;
      const bodyStr = err?.body != null ? (Buffer.isBuffer(err.body) ? err.body.toString('utf-8') : String(err.body)) : '';
      console.error('[Push] sendNotification failed', {
        statusCode,
        body: bodyStr,
        endpoint: endpoint?.slice(0, 60) + '...',
        message: err?.message,
        fullError: err,
      });
      if (statusCode === 401 || statusCode === 403) {
        throw new Error(`VAPID keys invalid (${statusCode}). Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY to override the hardcoded keys.`);
      }
      if (statusCode === 400) {
        throw new Error(`Push payload or subscription invalid (400): ${bodyStr || err?.message}`);
      }
      throw new Error(bodyStr || err?.message || `Push failed (${statusCode ?? 'unknown'})`);
    });
}
