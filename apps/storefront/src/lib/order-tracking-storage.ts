/** Key for storing the order id the customer is currently tracking (same session). */
const TRACKING_ORDER_KEY = 'nmd-tracking-order-id';
export const TRACKING_ORDER_EVENT = 'nmd-tracking-order-set';

export function setTrackingOrderId(orderId: string): void {
  try {
    sessionStorage.setItem(TRACKING_ORDER_KEY, orderId);
    window.dispatchEvent(new CustomEvent(TRACKING_ORDER_EVENT, { detail: orderId }));
  } catch {
    // ignore
  }
}

export function getTrackingOrderId(): string | null {
  try {
    return sessionStorage.getItem(TRACKING_ORDER_KEY);
  } catch {
    return null;
  }
}

export function clearTrackingOrderId(): void {
  try {
    sessionStorage.removeItem(TRACKING_ORDER_KEY);
  } catch {
    // ignore
  }
}

/** Terminal statuses: no longer "active" for the floating tracker. */
export const TERMINAL_ORDER_STATUSES = ['COMPLETED', 'DELIVERED', 'CANCELED', 'CANCELLED'] as const;

export function isOrderActive(status: string | undefined): boolean {
  if (!status) return true;
  return !TERMINAL_ORDER_STATUSES.includes(status as (typeof TERMINAL_ORDER_STATUSES)[number]);
}
