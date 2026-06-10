/** Shared order list filter logic (frontend-only; no API/DB changes). */

export type OrderSourceFilter = 'all' | 'app' | 'external';

export type OrderStatusFilterKey =
  | 'active'
  | 'all'
  | 'PREPARING'
  | 'CONFIRMED'
  | 'READY'
  | 'completed'
  | 'canceled';

export const ORDER_ACTIVE_STATUSES = ['PENDING', 'PREPARING', 'CONFIRMED', 'READY'] as const;
export const ORDER_COMPLETED_STATUSES = ['COMPLETED', 'DELIVERED', 'FINISH'] as const;
export const ORDER_CANCELED_STATUSES = ['CANCELED', 'CANCELLED'] as const;

/** Operational screens default to app + active so external history does not flood the list. */
export const DEFAULT_ORDER_SOURCE_FILTER: OrderSourceFilter = 'app';
export const DEFAULT_ORDER_STATUS_FILTER: OrderStatusFilterKey = 'active';

export const ORDER_SOURCE_FILTER_OPTIONS: { value: OrderSourceFilter; label: string }[] = [
  { value: 'all', label: 'الكل' },
  { value: 'app', label: 'طلبات التطبيق' },
  { value: 'external', label: 'طلبات خارجية' },
];

export const ORDER_STATUS_FILTER_OPTIONS: { value: OrderStatusFilterKey; label: string }[] = [
  { value: 'active', label: 'نشطة' },
  { value: 'all', label: 'الكل' },
  { value: 'PREPARING', label: 'قيد التحضير' },
  { value: 'CONFIRMED', label: 'مؤكدة' },
  { value: 'READY', label: 'جاهزة' },
  { value: 'completed', label: 'مكتملة' },
  { value: 'canceled', label: 'ملغاة' },
];

export type OrderListFilterFields = {
  isExternal?: boolean | null;
  status?: string | null;
  deliveryStatus?: string | null;
};

export type OrderListCountFields = OrderListFilterFields & {
  createdAt?: string | null;
  updatedAt?: string | null;
};

export function normalizeOrderStatus(status: string | null | undefined): string {
  return String(status ?? '').trim().toUpperCase();
}

export function isOrderExternal(order: OrderListFilterFields): boolean {
  return Boolean(order.isExternal);
}

export function matchesOrderSourceFilter(order: OrderListFilterFields, filter: OrderSourceFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'app') return !isOrderExternal(order);
  return isOrderExternal(order);
}

export function matchesOrderStatusFilter(order: OrderListFilterFields, filter: OrderStatusFilterKey): boolean {
  if (filter === 'all') return true;
  const status = normalizeOrderStatus(order.status);
  const deliveryStatus = normalizeOrderStatus(order.deliveryStatus);
  if (filter === 'active') {
    return (ORDER_ACTIVE_STATUSES as readonly string[]).includes(status);
  }
  if (filter === 'completed') {
    return (
      (ORDER_COMPLETED_STATUSES as readonly string[]).includes(status) ||
      (ORDER_COMPLETED_STATUSES as readonly string[]).includes(deliveryStatus)
    );
  }
  if (filter === 'canceled') {
    return (ORDER_CANCELED_STATUSES as readonly string[]).includes(status);
  }
  return status === filter;
}

export function filterOrdersForList<T extends OrderListFilterFields>(
  orders: T[],
  sourceFilter: OrderSourceFilter,
  statusFilter: OrderStatusFilterKey
): T[] {
  return orders.filter(
    (o) => matchesOrderSourceFilter(o, sourceFilter) && matchesOrderStatusFilter(o, statusFilter)
  );
}

export function getOrderSortTimestamp(order: { createdAt?: string | null; updatedAt?: string | null }): number {
  const created = order.createdAt ? new Date(order.createdAt).getTime() : NaN;
  if (Number.isFinite(created)) return created;
  const updated = order.updatedAt ? new Date(order.updatedAt).getTime() : NaN;
  return Number.isFinite(updated) ? updated : 0;
}

/** Newest first; falls back to updatedAt when createdAt is missing. */
export function sortOrdersByNewest<T extends { createdAt?: string | null; updatedAt?: string | null }>(
  orders: T[]
): T[] {
  return [...orders].sort((a, b) => getOrderSortTimestamp(b) - getOrderSortTimestamp(a));
}

export function getOrderListCounts<T extends OrderListCountFields>(orders: T[]): {
  total: number;
  app: number;
  external: number;
  active: number;
  completed: number;
} {
  let app = 0;
  let external = 0;
  let active = 0;
  let completed = 0;
  for (const order of orders) {
    if (isOrderExternal(order)) external += 1;
    else app += 1;
    if (matchesOrderStatusFilter(order, 'active')) active += 1;
    if (matchesOrderStatusFilter(order, 'completed')) completed += 1;
  }
  return { total: orders.length, app, external, active, completed };
}

export function getOrderSourceBadgeMeta(order: OrderListFilterFields): {
  label: string;
  title: string;
  className: string;
} {
  if (isOrderExternal(order)) {
    return {
      label: '📞 طلب خارجي',
      title: 'طلب خارجي',
      className: 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200',
    };
  }
  return {
    label: '📱 من التطبيق',
    title: 'من التطبيق',
    className: 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-sky-100 text-sky-800 border border-sky-200',
  };
}
