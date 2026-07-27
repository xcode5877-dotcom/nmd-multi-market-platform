/**
 * Status notification service.
 * - Customer: status-change messages (CONFIRMED, READY, COMPLETED) — simulation log or WhatsApp.
 * - Merchant: new-order "control panel" message with order details + action links, sent via whatsapp-service.
 * - Admin PWA: Web Push so admin gets a system notification when app is in background (iOS wake-up).
 */

import { formatAddonNameWithPlacement } from '@nmd/core';
import { getSubscriptionsByTenant, getSubscriptionsByPhone, sendPushNotification } from '../push-subscriptions.js';
import { sendFCMToToken as sendRealFCMToToken } from '../firebase-admin.js';

import { whatsAppFetch } from '../utils/whatsapp-http.js';

const WHATSAPP_SERVICE_URL = process.env.WHATSAPP_WEB_SERVICE_URL ?? process.env.WHATSAPP_SERVICE_URL ?? 'http://whatsapp-service:3000';
const WA_API_KEY = process.env.WA_API_KEY ?? '';
const ORDER_ACTIONS_BASE = process.env.ORDER_ACTIONS_BASE_URL ?? 'https://nmd.marketing/merchant';

export type OrderForNotification = {
  id?: string;
  status?: string;
  customerName?: string;
  customerPhone?: string;
  [key: string]: unknown;
};

export type TenantForMerchantNotify = {
  name?: string;
  whatsappPhone?: string;
  phone?: string;
  [key: string]: unknown;
};

function formatMoney(value: number | undefined | null): string {
  if (value == null || Number.isNaN(value)) return '0';
  return `₪${Number(value).toFixed(2)}`;
}

/** Arabic modifier summary for merchant WhatsApp (uses catalog names from `optionGroups`). */
function formatItemModifiersLine(item: {
  selectedOptions?: unknown;
  optionGroups?: unknown;
}): string {
  const sel = item.selectedOptions;
  const groups = item.optionGroups;
  if (!Array.isArray(sel) || sel.length === 0) return '';
  if (!Array.isArray(groups)) return '';
  const parts: string[] = [];
  for (const raw of sel) {
    if (!raw || typeof raw !== 'object') continue;
    const s = raw as Record<string, unknown>;
    const gid = String(s.optionGroupId ?? '');
    const ids = Array.isArray(s.optionItemIds) ? (s.optionItemIds as string[]) : [];
    const placements =
      s.optionPlacements && typeof s.optionPlacements === 'object'
        ? (s.optionPlacements as Record<string, string>)
        : {};
    const g = groups.find(
      (x) => x && typeof x === 'object' && (x as { id?: string }).id === gid
    ) as { items?: { id?: string; name?: string }[] } | undefined;
    for (const id of ids) {
      const name = g?.items?.find((opt) => opt.id === id)?.name ?? id;
      const placement = (placements[id] ?? 'WHOLE') as 'WHOLE' | 'LEFT' | 'RIGHT';
      parts.push(formatAddonNameWithPlacement(name, placement));
    }
  }
  return parts.join('، ');
}

/**
 * Build the merchant "control panel" message: order details + action links.
 */
export function buildMerchantOrderMessage(
  order: {
    id?: string;
    customerName?: string;
    customerPhone?: string;
    items?: { productName?: string; quantity?: number; totalPrice?: number; [key: string]: unknown }[];
    total?: number;
    delivery?: { method?: string; addressText?: string; zoneName?: string; fee?: number };
    fulfillmentType?: string;
    notes?: string;
    [key: string]: unknown;
  },
  _storeName?: string
): string {
  const orderId = (order.id ?? '').toString();
  const shortId = orderId.slice(0, 8);
  const lines: string[] = [
    '*طلب جديد*',
    '',
    `#${shortId}`,
    `العميل: ${(order.customerName ?? '').trim() || '—'}`,
    order.customerPhone ? `الجوال: ${order.customerPhone}` : '',
    '',
    '*العناصر:*',
  ].filter(Boolean);
  const items = Array.isArray(order.items) ? order.items : [];
  for (const item of items) {
    const name = (item.productName ?? 'منتج').toString();
    const qty = Number(item.quantity) || 1;
    const price = item.totalPrice != null ? formatMoney(item.totalPrice) : '';
    const mod = formatItemModifiersLine(item as { selectedOptions?: unknown; optionGroups?: unknown });
    const core = mod ? `${qty} × ${name} → ${mod}` : `${qty} × ${name}`;
    lines.push(`• ${core}${price ? `: ${price}` : ''}`);
  }
  if (items.length === 0) lines.push('—');
  lines.push('');
  lines.push('---');
  const subtotal =
    (order as { merchantAmount?: number }).merchantAmount ??
    (order as { subtotal?: number }).subtotal ??
    items.reduce((s, i) => s + (Number(i.totalPrice) || 0), 0);
  const deliveryFee =
    (order as { platformDeliveryFee?: number }).platformDeliveryFee ??
    order.delivery?.fee ??
    0;
  const total = Number(order.total) ?? subtotal + deliveryFee;
  lines.push(`المجموع: ${formatMoney(subtotal)}`);
  lines.push(`خدمة التوصيل: ${formatMoney(deliveryFee)}`);
  lines.push(`*المطلوب للدفع: ${formatMoney(total)}*`);
  if (order.notes) lines.push(`ملاحظات: ${order.notes}`);
  const base = ORDER_ACTIONS_BASE.replace(/\/$/, '');
  lines.push('');
  lines.push('——— روابط سريعة ———');
  lines.push(`✅ تأكيد الطلب: ${base}/order-actions/${orderId}/confirm`);
  lines.push(`🧑‍🍳 الطلب جاهز: ${base}/order-actions/${orderId}/ready`);
  lines.push(`🚚 تم الإرسال: ${base}/order-actions/${orderId}/shipped`);
  lines.push('');
  lines.push('رد على هذه الرسالة بـ (1) للتأكيد، (2) للجاهزية، (3) للشحن.');
  return lines.join('\n');
}

/**
 * Send a message via the whatsapp-service (POST /send-message).
 * number: digits with country code (e.g. 972501234567).
 * orderId: optional; when set, the service stores it so merchant reply 1/2/3 updates this order.
 */
export async function sendMessage(phone: string, message: string, orderId?: string): Promise<{ success: boolean; error?: string }> {
  const url = WHATSAPP_SERVICE_URL.replace(/\/$/, '') + '/send-message';
  const number = phone.replace(/\D/g, '');
  if (number.length < 9) {
    return { success: false, error: 'Invalid phone' };
  }
  try {
    const body: { number: string; message: string; orderId?: string } = { number, message };
    if (orderId) body.orderId = orderId;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (WA_API_KEY) {
      headers['x-api-key'] = WA_API_KEY;
    }
    const res = await whatsAppFetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
    if (!res.ok) {
      return { success: false, error: data.error ?? `HTTP ${res.status}` };
    }
    if (data.success === false) {
      return { success: false, error: data.error ?? 'Send failed' };
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Notify the merchant of a new order via Push only (no WhatsApp order summary).
 * OTP / WhatsApp auth flow is unchanged and separate.
 * Push leads merchant to dashboard to manage the order.
 */
export function notifyMerchantNewOrder(
  order: OrderForNotification & { items?: unknown[]; total?: number; notes?: string; delivery?: unknown; fulfillmentType?: string },
  tenant: TenantForMerchantNotify
): void {
  const tenantId = (order as { tenantId?: string }).tenantId;
  if (!tenantId) return;
  const amount = (order as { total?: number }).total;
  const amountStr = amount != null && !Number.isNaN(Number(amount)) ? formatMoney(Number(amount)) : '—';
  const pushPayload = {
    title: 'طلب جديد وصل! 🔔',
    body: `طلب جديد بقيمة ${amountStr}! اضغط لمراجعة التفاصيل وتحضير الطلب.`,
    tag: 'new-order-alarm',
    renotify: true,
  };
  const subs = getSubscriptionsByTenant(tenantId);
  for (const sub of subs) {
    sendPushNotification(sub, pushPayload).catch((e) =>
      console.error('[NotificationService] Merchant push failed:', e)
    );
  }
}

const TEMPLATES: Record<string, (name: string, orderNumber: string, storeName: string) => string> = {
  CONFIRMED: (name, num, store) =>
    `أهلاً ${name}، متجر ${store} قام بتأكيد طلبك #${num} وهو قيد التجهيز! 👨‍🍳`,
  READY: (name, num, store) =>
    `بشرى سارة! متجر ${store} — طلبك #${num} أصبح جاهزاً. ✅`,
  COMPLETED: (name, num, store) =>
    `متجر ${store}: طلبك #${num} خرج الآن مع المرسل، نتمنى لك تجربة رائعة! 🚚`,
};

/**
 * Trigger a status notification for the order.
 * Simulation mode: logs the exact Arabic message that would be sent to the customer.
 * Uses customerPhone from the order as the recipient.
 * storeName is included in every message so customers know which store is contacting them.
 */
export function triggerStatusNotification(
  order: OrderForNotification,
  newStatus: string,
  storeName?: string
): void {
  const status = String(newStatus).toUpperCase();
  if (!TEMPLATES[status]) {
    return;
  }

  const phone = order.customerPhone
    ? String(order.customerPhone).replace(/\s/g, '').trim()
    : '';
  const name = (order.customerName ?? '').trim() || 'عميلنا';
  const orderNumber = (order.id ?? '').toString().slice(0, 8);
  const store = (storeName ?? '').trim() || 'المتجر';

  const message = TEMPLATES[status](name, orderNumber, store);

  // Simulation: log to server console
  console.log('[NotificationService] WhatsApp (simulation)');
  console.log('[NotificationService] To:', phone || '(no phone)');
  console.log('[NotificationService] Message:', message);
  console.log('[NotificationService] ---');
}

/** Arabic push messages for order status (customer app). CONFIRMED=processing, READY/COMPLETED=shipped, DELIVERED=delivered. */
export const CUSTOMER_PUSH_MESSAGES: Record<string, { title: string; body: string }> = {
  CONFIRMED: { title: 'تحديث الطلب', body: 'طلبك قيد التنفيذ الآن! 👨‍🍳' },
  ACCEPTED: { title: 'تحديث الطلب', body: 'طلبك قيد التنفيذ الآن! 👨‍🍳' },
  READY: { title: 'تحديث الطلب', body: 'طلبك في الطريق إليك! 🚚' },
  COMPLETED: { title: 'تحديث الطلب', body: 'طلبك في الطريق إليك! 🚚' },
  DELIVERED: { title: 'تم التوصيل', body: 'تم توصيل الطلب، بالهناء والشفاء! 🍽️' },
  ORDER_UPDATED: { title: 'تحديث الطلب', body: 'تم تعديل تفاصيل طلبك — افتح التتبع لعرض التحديث.' },
};

/**
 * Send FCM to a single customer token (order status update).
 */
export async function sendFCMToCustomerToken(
  fcmToken: string,
  status: string,
  orderId: string
): Promise<void> {
  const msg = CUSTOMER_PUSH_MESSAGES[String(status).toUpperCase()];
  if (!msg || !fcmToken?.trim()) return;
  const result = await sendRealFCMToToken(
    fcmToken,
    {
      title: msg.title,
      body: msg.body,
      data: { orderId, status: String(status).toUpperCase(), type: 'order_status' },
    },
    'customer_notifications'
  );
  if (!result.success) {
    console.warn('[NotificationService] FCM order status failed:', result.error);
  }
}

/**
 * @deprecated Use firebase-admin.sendFCMToToken directly for broadcasts.
 */
export async function sendFCMToToken(token: string, title: string, body: string): Promise<void> {
  await sendRealFCMToToken(token, { title, body }, 'customer_notifications');
}

/**
 * Send Web Push to the customer when order status changes. Uses customer phone to look up subscriptions.
 * If no subscription, logs silently and does not throw (does not break order update).
 */
export function notifyCustomerOrderStatusPush(phone: string, status: string): void {
  const msg = CUSTOMER_PUSH_MESSAGES[String(status).toUpperCase()];
  if (!msg) return;
  const normalizedPhone = String(phone ?? '').replace(/\D/g, '').trim();
  if (!normalizedPhone) return;
  const subs = getSubscriptionsByPhone(normalizedPhone);
  if (subs.length === 0) {
    console.log('[NotificationService] notifyCustomerOrderStatusPush: no subscription for phone ***' + normalizedPhone.slice(-4));
    return;
  }
  console.log('[NotificationService] notifyCustomerOrderStatusPush: found ' + subs.length + ' subscription(s) for phone ***' + normalizedPhone.slice(-4));
  const payload = {
    title: msg.title,
    body: msg.body,
    tag: 'nmd-order-status',
    renotify: true,
  };
  for (const sub of subs) {
    sendPushNotification(sub, payload).catch((e) => {
      console.warn('[NotificationService] Customer push failed for', normalizedPhone.slice(-4), e?.message ?? e);
    });
  }
}
