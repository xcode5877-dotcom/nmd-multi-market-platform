/**
 * Status notification service.
 * - Customer: status-change messages (CONFIRMED, READY, COMPLETED) — simulation log or WhatsApp.
 * - Merchant: new-order "control panel" message with order details + action links, sent via whatsapp-service.
 */

const WHATSAPP_SERVICE_URL = process.env.WHATSAPP_WEB_SERVICE_URL ?? process.env.WHATSAPP_SERVICE_URL ?? 'http://whatsapp-service:3000';
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
    lines.push(`• ${name} x${qty}${price ? `: ${price}` : ''}`);
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
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
 * Notify the merchant of a new order via WhatsApp (order details + action links).
 * Uses tenant.whatsappPhone or tenant.phone. Fire-and-forget; does not block checkout.
 */
export function notifyMerchantNewOrder(
  order: OrderForNotification & { items?: unknown[]; total?: number; notes?: string; delivery?: unknown; fulfillmentType?: string },
  tenant: TenantForMerchantNotify
): void {
  const phone = (tenant.whatsappPhone ?? tenant.phone ?? '').toString().replace(/\D/g, '').trim();
  if (phone.length < 9) {
    console.warn('[NotificationService] notifyMerchantNewOrder: no merchant phone for tenant', tenant.name ?? order.tenantId);
    return;
  }
  const withCountry = phone.startsWith('0') ? '972' + phone.slice(1) : phone.length <= 10 ? '972' + phone : phone;
  const message = buildMerchantOrderMessage(order as Parameters<typeof buildMerchantOrderMessage>[0], tenant.name);
  const orderId = order.id != null ? String(order.id) : undefined;
  (async () => {
    try {
      const result = await sendMessage(withCountry, message, orderId);
      if (result.success) {
        console.log('[NotificationService] Merchant notified for order', order.id);
      } else {
        console.error('[NotificationService] Merchant notify failed:', result.error);
      }
    } catch (e) {
      console.error('[NotificationService] notifyMerchantNewOrder error:', e);
    }
  })();
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
