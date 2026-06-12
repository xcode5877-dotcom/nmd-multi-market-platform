/**
 * Keeps order.status and deliveryStatus aligned when admin marks an order delivered.
 */

export type OrderDeliveryFields = {
  status?: string;
  courierId?: string;
  deliveryStatus?: string;
  deliveredAt?: string;
  deliveryTimeline?: { deliveredAt?: string; [key: string]: unknown };
  [key: string]: unknown;
};

/** True when order should not appear in courier active/history lists. */
export function isCourierListTerminalStatus(status: string | undefined): boolean {
  const s = String(status ?? '').toUpperCase();
  return s === 'COMPLETED' || s === 'DELIVERED' || s === 'CANCELED' || s === 'CANCELLED';
}

/**
 * When admin/internal API sets DELIVERED:
 * - deliveryStatus → DELIVERED
 * - deliveryTimeline.deliveredAt populated
 * - if courier assigned → order.status → COMPLETED (courier app terminal state)
 */
export function syncAdminDeliveredOrder(order: OrderDeliveryFields): OrderDeliveryFields {
  const now = new Date().toISOString();
  const deliveredAt =
    order.deliveredAt ??
    order.deliveryTimeline?.deliveredAt ??
    now;

  const updated: OrderDeliveryFields = {
    ...order,
    deliveryStatus: 'DELIVERED',
    deliveredAt,
    deliveryTimeline: {
      ...(order.deliveryTimeline ?? {}),
      deliveredAt,
    },
  };

  if (order.courierId) {
    updated.status = 'COMPLETED';
  } else {
    updated.status = 'DELIVERED';
  }

  return updated;
}

/** Invariant: status=DELIVERED must never pair with a non-DELIVERED deliveryStatus. */
export function hasDeliveredStatusMismatch(order: OrderDeliveryFields): boolean {
  const st = String(order.status ?? '').toUpperCase();
  if (st !== 'DELIVERED') return false;
  const ds = String(order.deliveryStatus ?? '').toUpperCase();
  return ds !== 'DELIVERED';
}
