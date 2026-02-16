import type { DeliveryZone } from '@nmd/core';

const STORAGE_KEY = 'nmd.delivery-zones';

function load(): Record<string, DeliveryZone[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return {};
}

function save(data: Record<string, DeliveryZone[]>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function getDeliveryZones(tenantId: string): DeliveryZone[] {
  return load()[tenantId] ?? [];
}

export function setDeliveryZones(tenantId: string, zones: DeliveryZone[]): void {
  const data = load();
  data[tenantId] = zones;
  save(data);
}
