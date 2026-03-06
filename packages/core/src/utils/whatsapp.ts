import type { Order, Tenant } from '../types';
import { formatMoney } from './money.js';
import { formatDateGregorian } from './dates.js';
import { formatAddonNameWithPlacement } from './placements.js';

/**
 * Build WhatsApp message for order handoff (Arabic, short, clear).
 * Includes: Product names, quantities, total price, customer address.
 * Defensive: handles missing or empty items; all text is intended for encodeURIComponent by caller.
 */
export function buildWhatsAppMessage(order: Order, tenant: Tenant): string {
  const lines: string[] = [];
  const orderId = typeof order?.id === 'string' ? order.id : String(order?.id ?? '');
  const createdAt = order?.createdAt ? new Date(order.createdAt) : new Date();
  lines.push(`*تفاصيل الطلب الجديد:*`);
  lines.push('---');
  lines.push(`*طلب جديد - ${tenant?.name ?? ''}*`);
  lines.push('');
  lines.push(`#${orderId.slice(0, 8)}`);
  lines.push(`التاريخ: ${formatDateGregorian(createdAt)}`);
  lines.push('');
  const delivery = (order as { delivery?: { method?: string; zoneName?: string; fee?: number; addressText?: string } }).delivery;
  if (order.fulfillmentType === 'DELIVERY' || delivery?.method === 'DELIVERY') {
    lines.push('طريقة الاستلام: توصيل');
    if (delivery?.zoneName && delivery?.fee != null) {
      lines.push(`المنطقة: ${delivery.zoneName} (+${formatMoney(delivery.fee)})`);
    } else if (delivery?.zoneName) {
      lines.push(`المنطقة: ${delivery.zoneName}`);
    } else if (delivery?.fee != null) {
      lines.push(`سعر التوصيل: ${formatMoney(delivery.fee)}`);
    }
    if (delivery?.addressText) lines.push(`العنوان: ${delivery.addressText}`);
    else if (order.deliveryAddress) lines.push(`العنوان: ${order.deliveryAddress}`);
  } else {
    lines.push('طريقة الاستلام: استلام من المحل');
  }
  if (order.customerName) lines.push(`الاسم: ${order.customerName}`);
  if (order.customerPhone) lines.push(`الجوال: ${order.customerPhone}`);
  lines.push('');
  lines.push('*العناصر:*');
  const items = Array.isArray(order.items) ? order.items : [];
  for (const item of items) {
    const name = item.productName ?? 'منتج';
    const qty = Number(item.quantity) || 1;
    const price = item.totalPrice != null ? formatMoney(item.totalPrice) : '';
    const selectedOptions = item.selectedOptions ?? [];
    const optionGroups = item.optionGroups ?? [];
    const optParts = selectedOptions
      .map((s) => {
        const g = optionGroups.find((x) => x.id === s.optionGroupId);
        const ids = 'optionItemIds' in s ? s.optionItemIds : [];
        const placements = 'optionPlacements' in s ? (s.optionPlacements ?? {}) : {};
        return ids
          .map((id) => {
            const optName = g?.items?.find((i) => i.id === id)?.name;
            if (!optName) return '';
            return formatAddonNameWithPlacement(optName, placements[id]);
          })
          .filter(Boolean)
          .join('، ');
      })
      .filter(Boolean)
      .join(' | ');
    lines.push(`• ${name} x${qty}${optParts ? ` (${optParts})` : ''}${price ? `: ${price}` : ''}`);
  }
  if (items.length === 0) lines.push('—');
  lines.push('');
  lines.push('---');
  const subtotal =
    (order as { merchantAmount?: number }).merchantAmount ??
    order.subtotal ??
    items.reduce((s, i) => s + (Number(i.totalPrice) || 0), 0);
  const deliveryFee =
    (order as { platformDeliveryFee?: number }).platformDeliveryFee ??
    (order as { delivery?: { fee?: number } }).delivery?.fee ??
    0;
  const total = Number(order.total) || subtotal + deliveryFee;
  lines.push(`المجموع: ${formatMoney(subtotal)}`);
  lines.push(`خدمة التوصيل: ${formatMoney(deliveryFee)}`);
  lines.push(`*المطلوب للدفع: ${formatMoney(total)}*`);
  if (order.notes) lines.push(`ملاحظات: ${order.notes}`);
  return lines.join('\n');
}

/**
 * Check if a WhatsApp phone is valid (digits only, non-empty, reasonable length).
 * No fallback - phone must come from tenant.branding.whatsappPhone.
 */
export function isValidWhatsAppPhone(phone: string | undefined | null): boolean {
  if (!phone || typeof phone !== 'string') return false;
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length >= 9 && /^\d+$/.test(cleaned);
}

/**
 * Build WhatsApp web URL (wa.me) with pre-filled message.
 * Use for desktop; opens in browser. Phone must be digits only (with country code). No fallback.
 */
export function buildWhatsAppUrl(phone: string, message: string): string {
  if (!phone || typeof phone !== 'string') return '';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length < 9) return '';
  const encoded = encodeURIComponent(typeof message === 'string' ? message : '');
  return `https://wa.me/${cleaned}?text=${encoded}`;
}

/**
 * Build WhatsApp native deep link (whatsapp://send) for mobile.
 * Opens the WhatsApp app directly without a browser landing page; the current tab stays on your site.
 * Phone must be digits only (with country code). No fallback.
 */
export function buildWhatsAppDeepLink(phone: string, message: string): string {
  if (!phone || typeof phone !== 'string') return '';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length < 9) return '';
  const encoded = encodeURIComponent(typeof message === 'string' ? message : '');
  return `whatsapp://send?phone=${cleaned}&text=${encoded}`;
}

/** Default base URL for order action links (merchant dashboard). */
const DEFAULT_ORDER_ACTIONS_BASE = 'https://nmd.marketing/merchant';

/**
 * Build the "Merchant Control Section" text to append to the WhatsApp order message.
 * Contains quick-action links so the merchant can update order status from WhatsApp.
 * [ORDER_ID] is replaced with the given orderId.
 * @param orderId - Order ID to inject into links
 * @param baseUrl - Optional base URL (e.g. https://nmd.marketing/merchant). No trailing slash.
 */
export function buildOrderActionLinksSection(
  orderId: string,
  baseUrl: string = DEFAULT_ORDER_ACTIONS_BASE
): string {
  const id = typeof orderId === 'string' ? orderId : String(orderId ?? '');
  if (!id) return '';
  const base = (baseUrl ?? DEFAULT_ORDER_ACTIONS_BASE).replace(/\/$/, '');
  const lines: string[] = [
    '',
    '——— (للتاجر فقط) ———',
    '✅ تأكيد الطلب: ' + `${base}/order-actions/${id}/confirm`,
    '🧑‍🍳 الطلب جاهز: ' + `${base}/order-actions/${id}/ready`,
    '🚚 تم الإرسال: ' + `${base}/order-actions/${id}/shipped`,
  ];
  return lines.join('\n');
}
