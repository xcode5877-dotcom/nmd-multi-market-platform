/**
 * Delivery System Rules Engine
 * NEAR_READY_WINDOW_MINUTES = 10
 * BATCH_WINDOW_MINUTES = 7
 * Fallback: SHOP/SERVICE 5 min; RESTAURANT READY 5 min; RESTAURANT near-ready 7 min
 */

import type { RegistryTenant } from './store.js';
import { getDeliveryJobs } from './store.js';
import type { Repos } from './repos/types.js';

export const NEAR_READY_WINDOW_MINUTES = 10;
export const BATCH_WINDOW_MINUTES = 7;
export const FALLBACK_SHOP_SERVICE_MINUTES = 5;
export const FALLBACK_RESTAURANT_READY_MINUTES = 5;
export const FALLBACK_RESTAURANT_NEAR_READY_MINUTES = 7;

export type OrderStatus = 'NEW' | 'PREPARING' | 'READY' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELED';
export type DeliveryAssignmentMode = 'TENANT' | 'MARKET';

export interface OrderRecord {
  id?: string;
  tenantId?: string;
  status?: string;
  prepTimeMin?: number;
  readyAt?: string;
  deliveryAssignmentMode?: DeliveryAssignmentMode;
  fallbackTriggeredAt?: string;
  createdAt?: string;
  fulfillmentType?: string;
  [key: string]: unknown;
}

function getTenant(tenants: RegistryTenant[], tenantId: string): RegistryTenant | undefined {
  return tenants.find((t) => t.id === tenantId);
}

/** Check if order is eligible for MARKET dispatch (READY or near-ready for RESTAURANT; immediately for SHOP/SERVICE) */
export function isOrderEligibleForMarketDispatch(order: OrderRecord, tenants: RegistryTenant[]): boolean {
  const tenant = order.tenantId ? getTenant(tenants, order.tenantId) : undefined;
  const tenantType = tenant?.tenantType ?? 'SHOP';
  const mode = order.deliveryAssignmentMode ?? 'TENANT';

  if (mode !== 'MARKET') return false;
  if (order.fulfillmentType === 'PICKUP') return false;
  if (['OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELED'].includes(order.status ?? '')) return false;

  if (tenantType === 'RESTAURANT') {
    const status = order.status ?? 'PREPARING';
    if (status === 'READY') return true;
    const readyAt = order.readyAt;
    if (!readyAt) return false;
    const now = Date.now();
    const readyMs = new Date(readyAt).getTime();
    const diffMin = (readyMs - now) / (60 * 1000);
    return diffMin <= NEAR_READY_WINDOW_MINUTES;
  }

  // SHOP or SERVICE: eligible if PREPARING or READY (no readyAt needed)
  return ['PREPARING', 'READY', 'NEW'].includes(order.status ?? '');
}

/** Evaluate fallback: TENANT -> MARKET when allowMarketCourierFallback and conditions met */
export async function evaluateFallback(marketId: string, repos: Repos): Promise<void> {
  const tenants = (await repos.tenants.findAll()).filter((t) => t.marketId === marketId);
  const tenantIds = new Set(tenants.map((t) => t.id));
  const orders = (await repos.orders.findAll()) as OrderRecord[];
  const now = Date.now();
  let changed = false;
  const updated = orders.map((o) => {
    if (!o.tenantId || !tenantIds.has(o.tenantId)) return o;
    if (o.deliveryAssignmentMode === 'MARKET' || o.fallbackTriggeredAt) return o;
    if (o.fulfillmentType === 'PICKUP') return o;
    const tenant = getTenant(tenants, o.tenantId);
    if (!tenant?.allowMarketCourierFallback) return o;

    const createdAt = o.createdAt ? new Date(o.createdAt).getTime() : now;
    const elapsedMin = (now - createdAt) / (60 * 1000);
    const tenantType = tenant.tenantType ?? 'SHOP';

    if (tenantType === 'RESTAURANT') {
      const status = o.status ?? 'PREPARING';
      const readyAt = o.readyAt ? new Date(o.readyAt).getTime() : 0;
      const isReady = status === 'READY';
      const isNearReady = !isReady && readyAt && (readyAt - now) / (60 * 1000) <= NEAR_READY_WINDOW_MINUTES;

      if (isReady && elapsedMin >= FALLBACK_RESTAURANT_READY_MINUTES) {
        changed = true;
        return { ...o, deliveryAssignmentMode: 'MARKET' as const, fallbackTriggeredAt: new Date().toISOString() };
      }
      if (isNearReady && elapsedMin >= FALLBACK_RESTAURANT_NEAR_READY_MINUTES) {
        changed = true;
        return { ...o, deliveryAssignmentMode: 'MARKET' as const, fallbackTriggeredAt: new Date().toISOString() };
      }
    } else {
      // SHOP or SERVICE
      if (elapsedMin >= FALLBACK_SHOP_SERVICE_MINUTES) {
        changed = true;
        return { ...o, deliveryAssignmentMode: 'MARKET' as const, fallbackTriggeredAt: new Date().toISOString() };
      }
    }
    return o;
  });

  if (changed) await repos.orders.setAll(updated);
}

/** Get queue of orders eligible for MARKET dispatch (after fallback eval) */
export async function getDispatchQueue(marketId: string, repos: Repos): Promise<OrderRecord[]> {
  await evaluateFallback(marketId, repos);
  const tenants = (await repos.tenants.findAll()).filter((t) => t.marketId === marketId);
  const tenantIds = new Set(tenants.map((t) => t.id));
  const orders = (await repos.orders.findAll()) as OrderRecord[];
  const jobs = getDeliveryJobs();
  const activeJobOrderIds = new Set(
    jobs
      .filter((j) => !['CANCELED', 'DONE'].includes(j.status))
      .flatMap((j) => j.items.map((i) => i.orderId))
  );

  return orders
    .filter((o) => o.tenantId && tenantIds.has(o.tenantId))
    .filter((o) => isOrderEligibleForMarketDispatch(o, tenants))
    .filter((o) => !o.courierId)
    .filter((o) => !activeJobOrderIds.has(o.id ?? ''))
    .sort((a, b) => {
      const aReady = a.readyAt ? new Date(a.readyAt).getTime() : 0;
      const bReady = b.readyAt ? new Date(b.readyAt).getTime() : 0;
      if (aReady && bReady) return aReady - bReady;
      return (a.createdAt ?? '').localeCompare(b.createdAt ?? '');
    });
}

/** Check if two orders can be batched (same tenant for RESTAURANT; readyAt within BATCH_WINDOW) */
export function canBatchOrders(orderA: OrderRecord, orderB: OrderRecord, tenants: RegistryTenant[]): boolean {
  const tenantA = orderA.tenantId ? getTenant(tenants, orderA.tenantId) : undefined;
  const tenantB = orderB.tenantId ? getTenant(tenants, orderB.tenantId) : undefined;
  const typeA = tenantA?.tenantType ?? 'SHOP';
  const typeB = tenantB?.tenantType ?? 'SHOP';

  if (typeA === 'RESTAURANT' || typeB === 'RESTAURANT') {
    if (orderA.tenantId !== orderB.tenantId) return false;
    const aReady = orderA.readyAt ? new Date(orderA.readyAt).getTime() : 0;
    const bReady = orderB.readyAt ? new Date(orderB.readyAt).getTime() : 0;
    if (!aReady || !bReady) return orderA.status === 'READY' && orderB.status === 'READY';
    return Math.abs(aReady - bReady) / (60 * 1000) <= BATCH_WINDOW_MINUTES;
  }
  return true;
}
