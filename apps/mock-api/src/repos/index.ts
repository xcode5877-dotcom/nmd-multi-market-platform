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

// FORCED to PostgreSQL. No env check — avoids any startup or runtime reverting to json (0 stores).
const driver = 'db' as const;

export function createRepos(): Repos {
  if (driver === 'db') {
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
  // Fallback only if driver were ever changed; in practice driver is always 'db'.
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
