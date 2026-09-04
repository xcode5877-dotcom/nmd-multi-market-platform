export {
  canManageOrderItems,
  isOrderManagementEditable,
  getOrderManagementBlockReason,
  ORDER_MANAGEMENT_REASONS,
  type OrderManagementReason,
} from '@nmd/core';

export const ORDER_MGMT_REASON_LABELS: Record<string, string> = {
  CUSTOMER_REQUEST: 'طلب الزبون',
  MERCHANT_REQUEST: 'طلب المتجر',
  CORRECTION: 'تصحيح',
  PRICING_ISSUE: 'مشكلة تسعير',
  OTHER: 'أخرى',
};
