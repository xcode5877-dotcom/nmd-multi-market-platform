/**
 * Super Admin / platform ops order status actions — mirrors merchant flow.
 * Uses existing APIs only; no new backend behavior.
 */

export type PlatformOrderActionId =
  | 'receive'
  | 'preparing'
  | 'ready'
  | 'handed_to_driver'
  | 'pickup_complete'
  | 'cancel';

export type PlatformOrderAction = {
  id: PlatformOrderActionId;
  label: string;
  hint?: string;
  variant?: 'primary' | 'outline' | 'danger';
};

export type PlatformOrderLike = {
  id?: string;
  tenantId?: string;
  status?: string;
  fulfillmentType?: string;
  courierId?: string;
  paymentMethod?: string;
  deliveryTimeline?: { handedToDriverAt?: string };
};

const TERMINAL_STATUSES = new Set(['COMPLETED', 'CANCELLED', 'CANCELED', 'DELIVERED']);

export const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING: 'قيد الانتظار',
  CONFIRMED: 'مستلم',
  PREPARING: 'قيد التحضير',
  READY: 'جاهز للتسليم',
  COMPLETED: 'مكتمل',
  CANCELLED: 'ملغي',
  CANCELED: 'ملغي',
  DELIVERED: 'تم التسليم',
  OUT_FOR_DELIVERY: 'خرج للتوصيل',
};

export function canUsePlatformOrderOps(role?: string): boolean {
  return role === 'ROOT_ADMIN' || role === 'SUPER_ADMIN' || role === 'MARKET_ADMIN';
}

/** Valid platform-ops actions for current order state. */
export function getPlatformOrderActions(order: PlatformOrderLike): PlatformOrderAction[] {
  const status = (order.status ?? 'PENDING').toUpperCase();
  if (TERMINAL_STATUSES.has(status)) return [];

  const fulfillment = order.fulfillmentType ?? 'DELIVERY';
  const handedAt = order.deliveryTimeline?.handedToDriverAt;
  const hasCourier = !!order.courierId;

  if (handedAt) return [];

  const actions: PlatformOrderAction[] = [];

  if (status === 'PENDING') {
    actions.push({
      id: 'receive',
      label: 'استلام الطلب',
      hint: 'تأكيد استلام الطلب من المتجر',
      variant: 'primary',
    });
  }

  if (status === 'CONFIRMED') {
    actions.push({
      id: 'preparing',
      label: 'قيد التحضير',
      hint: 'بدء تحضير الطلب',
      variant: 'primary',
    });
  }

  if (status === 'PREPARING') {
    actions.push({
      id: 'ready',
      label: 'جاهز للتسليم',
      hint: 'إشعار السائقين / جاهز للاستلام',
      variant: 'primary',
    });
  }

  if (status === 'READY') {
    if (fulfillment === 'PICKUP') {
      actions.push({
        id: 'pickup_complete',
        label: 'تم التسليم للزبون',
        hint: 'إغلاق طلب الاستلام من المتجر',
        variant: 'primary',
      });
    } else if (hasCourier && !handedAt) {
      actions.push({
        id: 'handed_to_driver',
        label: 'تسليم للسائق',
        hint: 'بعد تعيين سائق — يسمح للسائق ببدء التوصيل',
        variant: 'primary',
      });
    }
  }

  actions.push({
    id: 'cancel',
    label: 'إلغاء / رفض الطلب',
    hint: 'عند تعذّر التنفيذ من المتجر',
    variant: 'danger',
  });

  return actions;
}

export function formatOrderStatusLabel(status?: string): string {
  if (!status) return '—';
  return ORDER_STATUS_LABELS[status.toUpperCase()] ?? status;
}
