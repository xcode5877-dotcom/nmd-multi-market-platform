import type { Order, Tenant } from '../types';
import { formatMoney } from './money.js';
import { formatAddonNameWithPlacement } from './placements.js';

/**
 * Build WhatsApp message for order handoff (Arabic, short, clear).
 */
export function buildWhatsAppMessage(order: Order, tenant: Tenant): string {
  const lines: string[] = [];
  lines.push(`*طلب جديد - ${tenant.name}*`);
  lines.push('');
  lines.push(`#${order.id.slice(0, 8)}`);
  lines.push(`التاريخ: ${new Date(order.createdAt).toLocaleDateString('ar-SA')}`);
  lines.push('');
  const delivery = (order as { delivery?: { method?: string; zoneName?: string; fee?: number; addressText?: string } }).delivery;
  if (order.fulfillmentType === 'DELIVERY' || delivery?.method === 'DELIVERY') {
    lines.push('طريقة الاستلام: توصيل');
    if (delivery?.zoneName) lines.push(`المنطقة: ${delivery.zoneName}`);
    if (delivery?.fee != null) lines.push(`سعر التوصيل: ₪${delivery.fee}`);
    if (delivery?.addressText) lines.push(`العنوان: ${delivery.addressText}`);
    else if (order.deliveryAddress) lines.push(`العنوان: ${order.deliveryAddress}`);
  } else {
    lines.push('طريقة الاستلام: استلام من المحل');
  }
  if (order.customerName) lines.push(`الاسم: ${order.customerName}`);
  if (order.customerPhone) lines.push(`الجوال: ${order.customerPhone}`);
  lines.push('');
  lines.push('*العناصر:*');
  for (const item of order.items) {
    const optParts = item.selectedOptions
      .map((s) => {
        const g = item.optionGroups.find((x) => x.id === s.optionGroupId);
        const ids = 'optionItemIds' in s ? s.optionItemIds : [];
        const placements = 'optionPlacements' in s ? (s.optionPlacements ?? {}) : {};
        return ids
          .map((id) => {
            const name = g?.items.find((i) => i.id === id)?.name;
            if (!name) return '';
            return formatAddonNameWithPlacement(name, placements[id]);
          })
          .filter(Boolean)
          .join('، ');
      })
      .filter(Boolean)
      .join(' | ');
    lines.push(`• ${item.productName} x${item.quantity}${optParts ? ` (${optParts})` : ''}: ${formatMoney(item.totalPrice)}`);
  }
  lines.push('');
  lines.push(`الإجمالي: ${formatMoney(order.total)}`);
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
 * Build WhatsApp URL with pre-filled message.
 * Phone must be digits only (with country code). No fallback.
 */
export function buildWhatsAppUrl(phone: string, message: string): string {
  const cleaned = phone.replace(/\D/g, '');
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${cleaned}?text=${encoded}`;
}
