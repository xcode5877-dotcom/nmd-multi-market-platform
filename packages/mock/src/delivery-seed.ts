import type { DeliveryZone } from '@nmd/core';
import { listTenants } from './tenant-registry';
import { getDeliverySettings, saveDeliverySettings } from './delivery-store';
import { getDeliveryZones, setDeliveryZones } from './delivery-zones-store';

export function seedDelivery(): void {
  const tenants = listTenants();
  for (const t of tenants) {
    if (getDeliverySettings(t.id)) continue;
    saveDeliverySettings(t.id, {
      tenantId: t.id,
      modes: { pickup: true, delivery: true },
      deliveryFee: 5,
      zones: [],
    });
  }
}

const BUFFALO_ZONES: Omit<DeliveryZone, 'id' | 'tenantId'>[] = [
  { name: 'المنطقة الوسطى', fee: 15, etaMinutes: 30, isActive: true, sortOrder: 0 },
  { name: 'الشمال', fee: 20, etaMinutes: 45, isActive: true, sortOrder: 1 },
  { name: 'الجنوب', fee: 18, etaMinutes: 40, isActive: true, sortOrder: 2 },
  { name: 'الشرق', fee: 22, etaMinutes: 50, isActive: true, sortOrder: 3 },
  { name: 'الغرب', fee: 25, etaMinutes: 55, isActive: true, sortOrder: 4 },
  { name: 'ضواحي', fee: 30, etaMinutes: 60, isActive: true, sortOrder: 5 },
  { name: 'خارج المدينة', fee: 40, etaMinutes: 90, isActive: true, sortOrder: 6 },
];

export function seedDeliveryZones(): void {
  const tenants = listTenants();
  for (const t of tenants) {
    if (getDeliveryZones(t.id).length > 0) continue;
    const slug = (t as { slug?: string }).slug ?? '';
    let zones: DeliveryZone[];
    if (slug === 'buffalo28' || slug === 'pizza') {
      zones = BUFFALO_ZONES.map((z, i) => ({ ...z, id: `dz-${t.id}-${i + 1}`, tenantId: t.id }));
    } else if (slug === 'ms-brands') {
      zones = [{ id: `dz-${t.id}-1`, tenantId: t.id, name: 'التوصيل العام', fee: 10, etaMinutes: 45, isActive: true, sortOrder: 0 }];
    } else {
      zones = [{ id: `dz-${t.id}-1`, tenantId: t.id, name: 'المنطقة الافتراضية', fee: 10, etaMinutes: 45, isActive: true, sortOrder: 0 }];
    }
    setDeliveryZones(t.id, zones);
  }
}
