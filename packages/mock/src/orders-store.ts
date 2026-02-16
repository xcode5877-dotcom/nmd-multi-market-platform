import type { Order } from '@nmd/core';

const STORAGE_KEY = 'nmd.orders';

function load(): Order[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return [];
}

function save(orders: Order[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
}

export function listOrders(): Order[] {
  return load();
}

export function listOrdersByTenant(tenantId: string): Order[] {
  return load().filter((o) => o.tenantId === tenantId);
}

export function getOrder(id: string): Order | null {
  return load().find((o) => o.id === id) ?? null;
}

export function updateOrderStatus(id: string, status: Order['status']): Order | null {
  const orders = load();
  const idx = orders.findIndex((o) => o.id === id);
  if (idx === -1) return null;
  orders[idx] = { ...orders[idx], status };
  save(orders);
  return orders[idx];
}

export function getOrdersToday(): Order[] {
  const today = new Date().toDateString();
  return load().filter((o) => new Date(o.createdAt).toDateString() === today);
}

export function getOrdersThisWeek(): Order[] {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  return load().filter((o) => new Date(o.createdAt) >= weekAgo);
}

export function addOrder(order: Order): void {
  const orders = load();
  orders.push(order);
  save(orders);
}
