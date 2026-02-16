import { seedTenants } from './seed';
import { seedCatalogForTenants } from './catalog-seed';
import { seedCampaigns } from './campaign-seed';
import { seedDelivery, seedDeliveryZones } from './delivery-seed';
import { seedTemplates } from './template-store';
import { seedStaff } from './staff-store';

export * from './types';
export * from './tenant-registry';
export * from './orders-store';
export * from './catalog-store';
export * from './campaign-store';
export * from './delivery-store';
export * from './delivery-zones-store';
export * from './template-store';
export * from './staff-store';
export * from './quick-start-templates';
export * from './mock-api-client';

export function initMock(): void {
  seedTenants();
  seedCatalogForTenants();
  seedCampaigns();
  seedDelivery();
  seedDeliveryZones();
  seedTemplates();
  seedStaff();
}
