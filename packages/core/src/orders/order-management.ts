/**
 * Super Admin order management — shared permission + status gates.
 * Privileged line-item editing (not customer / merchant edit windows).
 */

export type OrderManagementReason =
  | 'CUSTOMER_REQUEST'
  | 'MERCHANT_REQUEST'
  | 'CORRECTION'
  | 'PRICING_ISSUE'
  | 'OTHER';

export const ORDER_MANAGEMENT_REASONS: ReadonlyArray<{
  id: OrderManagementReason;
  labelAr: string;
  labelEn: string;
}> = [
  { id: 'CUSTOMER_REQUEST', labelAr: 'طلب الزبون', labelEn: 'Customer request' },
  { id: 'MERCHANT_REQUEST', labelAr: 'طلب المتجر', labelEn: 'Merchant request' },
  { id: 'CORRECTION', labelAr: 'تصحيح', labelEn: 'Correction' },
  { id: 'PRICING_ISSUE', labelAr: 'مشكلة تسعير', labelEn: 'Pricing issue' },
  { id: 'OTHER', labelAr: 'أخرى', labelEn: 'Other' },
];

export type OrderManagementOpType =
  | 'ADD_ITEM'
  | 'REMOVE_ITEM'
  | 'UPDATE_QUANTITY'
  | 'UPDATE_MODIFIERS'
  | 'UPDATE_ITEM_NOTES'
  | 'UPDATE_ORDER_NOTES';

/** Statuses that allow Super Admin line-item management. */
export const ORDER_MANAGEMENT_EDITABLE_STATUSES = new Set([
  'PENDING',
  'CONFIRMED', // Accepted
  'ACCEPTED',
  'PREPARING',
]);

/** Statuses that must block editing. */
export const ORDER_MANAGEMENT_BLOCKED_STATUSES = new Set([
  'READY',
  'OUT_FOR_DELIVERY',
  'COMPLETED',
  'DELIVERED',
  'CANCELLED',
  'CANCELED',
  'REJECTED',
  'FINISH',
]);

/**
 * Only platform Super Admin / Root may manage order line items.
 * MARKET_ADMIN, TENANT_ADMIN, COURIER, CUSTOMER must never pass.
 */
export function canManageOrderItems(role: string | undefined): boolean {
  return role === 'ROOT_ADMIN' || role === 'SUPER_ADMIN';
}

export function normalizeOrderManagementStatus(status: string | undefined): string {
  return String(status ?? '').trim().toUpperCase();
}

export function isOrderManagementEditable(status: string | undefined): boolean {
  const s = normalizeOrderManagementStatus(status);
  if (!s) return false;
  if (ORDER_MANAGEMENT_BLOCKED_STATUSES.has(s)) return false;
  return ORDER_MANAGEMENT_EDITABLE_STATUSES.has(s);
}

export function getOrderManagementBlockReason(status: string | undefined): string | null {
  if (isOrderManagementEditable(status)) return null;
  const s = normalizeOrderManagementStatus(status) || 'UNKNOWN';
  return `Order management is blocked for status ${s}. Allowed: PENDING, ACCEPTED/CONFIRMED, PREPARING.`;
}

export function isValidOrderManagementReason(reason: unknown): reason is OrderManagementReason {
  return (
    reason === 'CUSTOMER_REQUEST' ||
    reason === 'MERCHANT_REQUEST' ||
    reason === 'CORRECTION' ||
    reason === 'PRICING_ISSUE' ||
    reason === 'OTHER'
  );
}
