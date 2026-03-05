/**
 * Push subscription storage keyed by customer phone.
 * VAPID keys for Web Push (generate once or from env).
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import webpush from 'web-push';

export type PushSubscriptionJSON = {
  endpoint: string;
  keys?: { p256dh?: string; auth?: string };
  expirationTime?: number | null;
};

const VAPID_PUBLIC_KEY_ENV = 'VAPID_PUBLIC_KEY';
const VAPID_PRIVATE_KEY_ENV = 'VAPID_PRIVATE_KEY';
/** Docker: host data is typically mounted at /app/data. Override with PUSH_SUBSCRIPTIONS_FILE. */
const PUSH_SUBS_FILE = process.env.PUSH_SUBSCRIPTIONS_FILE || '/app/data/push-subscriptions.json';

let vapidPublicKey: string;
let vapidPrivateKey: string;

function ensureVapidKeys(): void {
  const pub = process.env[VAPID_PUBLIC_KEY_ENV];
  const priv = process.env[VAPID_PRIVATE_KEY_ENV];
  if (pub && priv) {
    vapidPublicKey = pub;
    vapidPrivateKey = priv;
    webpush.setVapidDetails('mailto:noreply@nmd.local', vapidPublicKey, vapidPrivateKey);
    return;
  }
  const keys = webpush.generateVAPIDKeys();
  vapidPublicKey = keys.publicKey;
  vapidPrivateKey = keys.privateKey;
  webpush.setVapidDetails('mailto:noreply@nmd.local', vapidPublicKey, vapidPrivateKey);
  if (!process.env[VAPID_PUBLIC_KEY_ENV]) {
    console.log('[Push] VAPID keys generated. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY for production.');
  }
}

ensureVapidKeys();

export function getVapidPublicKey(): string {
  return vapidPublicKey;
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
    const dir = join(PUSH_SUBS_FILE, '..');
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(PUSH_SUBS_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Push] Failed to save subscriptions:', err);
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

export function sendPushNotification(subscription: PushSubscriptionJSON, payload: string | Record<string, unknown>): Promise<unknown> {
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return webpush.sendNotification(
    {
      endpoint: subscription.endpoint,
      keys: subscription.keys as { p256dh: string; auth: string },
    },
    body,
    {
      TTL: 86400,
      urgency: 'normal',
    }
  );
}
