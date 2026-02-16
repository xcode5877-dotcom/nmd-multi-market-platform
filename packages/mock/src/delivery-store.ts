import type { DeliverySettings } from '@nmd/core';

const STORAGE_KEY = 'nmd.delivery';

function load(): Record<string, DeliverySettings> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return {};
}

function save(data: Record<string, DeliverySettings>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function getDeliverySettings(tenantId: string): DeliverySettings | null {
  const data = load();
  return data[tenantId] ?? null;
}

export function saveDeliverySettings(tenantId: string, settings: DeliverySettings): void {
  const data = load();
  data[tenantId] = { ...settings, tenantId };
  save(data);
}
