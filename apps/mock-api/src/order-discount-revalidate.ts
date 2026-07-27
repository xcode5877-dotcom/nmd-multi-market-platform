/**
 * Discount revalidation after Super Admin order line edits.
 *
 * Policy:
 * - Coupon discounts (FIXED / PERCENT) are recalculated from the new merchandise subtotal.
 * - Discount never exceeds subtotal (cannot drive merchandise negative).
 * - If coupon is missing/expired/wrong-tenant, discount is cleared (set to 0).
 * - Coupons already marked usedAt remain applicable for recalculation (checkout already consumed them).
 * - There is no separate min-order field on Coupon; FIXED/PERCENT → 0 means ineligible.
 * - Item-level campaign discounts are baked into line totalPrice at add/reprice time (catalog path).
 * - Rewards/wheel coupons use the same Coupon table.
 *
 * Delivery fee is NOT part of discount revalidation (see DELIVERY_FEE_POLICY in order-totals).
 */
import { roundMoney } from './platform-fee.js';
import type { OrderRecord } from './repos/types.js';

export type CouponLike = {
  id: string;
  type: string;
  value: number;
  tenantId?: string | null;
  storeId?: string | null;
  expiresAt?: string | null;
};

export type DiscountRevalidateResult = {
  discountAmount: number;
  previousDiscountAmount: number;
  invalidated: boolean;
  recalculated: boolean;
  note?: string;
};

export async function revalidateOrderDiscountAmount(
  order: OrderRecord,
  merchandiseSubtotal: number,
  loadCoupon: (couponId: string) => Promise<CouponLike | null>
): Promise<DiscountRevalidateResult> {
  const previous = Math.max(0, Number(order.discountAmount ?? 0));
  const subtotal = Math.max(0, merchandiseSubtotal);
  const couponId = typeof order.couponId === 'string' ? order.couponId.trim() : '';

  if (!couponId) {
    // No coupon identity — freeze previous amount but never exceed new subtotal (safety clamp).
    const clamped = roundMoney(Math.min(previous, subtotal));
    return {
      discountAmount: clamped,
      previousDiscountAmount: previous,
      invalidated: clamped < previous && previous > 0,
      recalculated: clamped !== previous,
      note:
        clamped < previous
          ? 'Discount clamped to new subtotal (no couponId on order)'
          : 'Discount frozen (no couponId); capped at subtotal',
    };
  }

  const coupon = await loadCoupon(couponId);
  if (!coupon) {
    return {
      discountAmount: 0,
      previousDiscountAmount: previous,
      invalidated: previous > 0,
      recalculated: true,
      note: 'Coupon not found — discount cleared',
    };
  }

  const tenantId = String(order.tenantId ?? '');
  if (coupon.tenantId && tenantId && coupon.tenantId !== tenantId) {
    return {
      discountAmount: 0,
      previousDiscountAmount: previous,
      invalidated: true,
      recalculated: true,
      note: 'Coupon tenant mismatch — discount cleared',
    };
  }
  if (coupon.storeId && tenantId && coupon.storeId !== tenantId) {
    return {
      discountAmount: 0,
      previousDiscountAmount: previous,
      invalidated: true,
      recalculated: true,
      note: 'Coupon store mismatch — discount cleared',
    };
  }
  if (coupon.expiresAt && coupon.expiresAt < new Date().toISOString()) {
    return {
      discountAmount: 0,
      previousDiscountAmount: previous,
      invalidated: true,
      recalculated: true,
      note: 'Coupon expired — discount cleared',
    };
  }

  let next = 0;
  const type = String(coupon.type ?? '').toUpperCase();
  if (type === 'FIXED') next = Math.min(Number(coupon.value) || 0, subtotal);
  else if (type === 'PERCENT') next = Math.min(((subtotal * (Number(coupon.value) || 0)) / 100), subtotal);
  next = roundMoney(Math.max(0, next));

  return {
    discountAmount: next,
    previousDiscountAmount: previous,
    invalidated: previous > 0 && next === 0,
    recalculated: next !== previous,
    note:
      type === 'PERCENT'
        ? 'PERCENT coupon recalculated from new subtotal'
        : type === 'FIXED'
          ? 'FIXED coupon recalculated (capped at subtotal)'
          : 'Unknown coupon type — discount cleared',
  };
}
