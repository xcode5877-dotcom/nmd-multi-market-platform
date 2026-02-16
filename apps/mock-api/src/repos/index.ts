import type { Repos } from './types.js';
import {
  createJsonMarketsRepo,
  createJsonTenantsRepo,
  createJsonUsersRepo,
  createJsonCouriersRepo,
  createJsonCustomersRepo,
  createJsonOrdersRepo,
  createJsonCatalogRepo,
  createJsonDeliveryRepo,
  createJsonDeliveryZonesRepo,
  createJsonPaymentsRepo,
} from './json-repos.js';
import {
  createDbMarketsRepo,
  createDbTenantsRepo,
  createDbUsersRepo,
  createDbCouriersRepo,
  createDbCustomersRepo,
  createDbOrdersRepo,
  createDbCatalogRepo,
  createDbDeliveryRepo,
  createDbDeliveryZonesRepo,
  createDbPaymentsRepo,
} from './db-repos.js';

const STORAGE_DRIVER = (process.env.STORAGE_DRIVER ?? 'json').toLowerCase();

export function createRepos(): Repos {
  if (STORAGE_DRIVER === 'db') {
    return {
      markets: createDbMarketsRepo(),
      tenants: createDbTenantsRepo(),
      users: createDbUsersRepo(),
      couriers: createDbCouriersRepo(),
      customers: createDbCustomersRepo(),
      orders: createDbOrdersRepo(),
      catalog: createDbCatalogRepo(),
      delivery: createDbDeliveryRepo(),
      deliveryZones: createDbDeliveryZonesRepo(),
      payments: createDbPaymentsRepo(),
    };
  }
  return {
    markets: createJsonMarketsRepo(),
    tenants: createJsonTenantsRepo(),
    users: createJsonUsersRepo(),
    couriers: createJsonCouriersRepo(),
    customers: createJsonCustomersRepo(),
    orders: createJsonOrdersRepo(),
    catalog: createJsonCatalogRepo(),
    delivery: createJsonDeliveryRepo(),
    deliveryZones: createJsonDeliveryZonesRepo(),
    payments: createJsonPaymentsRepo(),
  };
}
