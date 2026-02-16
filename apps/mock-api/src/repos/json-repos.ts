import { getMarkets, setMarkets, getTenants, setTenants, getUsers, setUsers, getCouriers, setCouriers, getCustomers, setCustomers, getOrders, setOrders, getCatalog, setCatalog as setCatalogStore, getDelivery, setDelivery, getDeliveryZones, setDeliveryZones } from '../store.js';
import type { Market, RegistryTenant, User, Courier, Customer } from '../store.js';
import type { OrderRecord } from './types.js';
import type { MarketsRepo, TenantsRepo, UsersRepo, CouriersRepo, CustomersRepo, OrdersRepo, CatalogRepo, DeliveryRepo, DeliveryZonesRepo, PaymentsRepo } from './types.js';

export function createJsonMarketsRepo(): MarketsRepo {
  return {
    async findAll() {
      return getMarkets();
    },
    async setAll(markets: Market[]) {
      setMarkets(markets);
    },
  };
}

export function createJsonTenantsRepo(): TenantsRepo {
  return {
    async findAll() {
      return getTenants();
    },
    async setAll(tenants: RegistryTenant[]) {
      setTenants(tenants);
    },
  };
}

export function createJsonUsersRepo(): UsersRepo {
  return {
    async findAll() {
      return getUsers();
    },
    async setAll(users: User[]) {
      setUsers(users);
    },
  };
}

export function createJsonCouriersRepo(): CouriersRepo {
  return {
    async findAll() {
      return getCouriers();
    },
    async setAll(couriers: Courier[]) {
      setCouriers(couriers);
    },
  };
}

export function createJsonCustomersRepo(): CustomersRepo {
  return {
    async findAll() {
      return getCustomers();
    },
    async setAll(customers: Customer[]) {
      setCustomers(customers);
    },
  };
}

export function createJsonOrdersRepo(): OrdersRepo {
  return {
    async findAll() {
      const orders = getOrders() as OrderRecord[];
      return orders.map((o) => ({ ...o, orderType: (o.orderType as string) ?? 'PRODUCT' }));
    },
    async setAll(orders: OrderRecord[]) {
      setOrders(orders);
    },
    async addOrderWithPayment(order: OrderRecord) {
      const orders = getOrders() as OrderRecord[];
      setOrders([...orders, { ...order, orderType: (order.orderType as string) ?? 'PRODUCT' }]);
    },
  };
}

export function createJsonCatalogRepo(): CatalogRepo {
  return {
    async getCatalog(tenantId: string) {
      return getCatalog(tenantId);
    },
    async setCatalog(tenantId: string, catalog: import('../store.js').TenantCatalog) {
      setCatalogStore(tenantId, catalog);
    },
  };
}

function defaultDeliverySettings(tenantId: string): Record<string, unknown> {
  return {
    tenantId,
    modes: { pickup: true, delivery: true },
    minimumOrder: 0,
    deliveryFee: 5,
    zones: [],
  };
}

export function createJsonDeliveryRepo(): DeliveryRepo {
  return {
    async getSettings(tenantId: string) {
      const d = getDelivery();
      const s = d[tenantId];
      return s != null ? (s as Record<string, unknown>) : defaultDeliverySettings(tenantId);
    },
    async setSettings(tenantId: string, settings: Record<string, unknown>) {
      const d = getDelivery();
      d[tenantId] = { ...settings, tenantId };
      setDelivery(d);
    },
  };
}

export function createJsonDeliveryZonesRepo(): DeliveryZonesRepo {
  return {
    async getByTenant(tenantId: string) {
      return getDeliveryZones(tenantId);
    },
    async setAll(tenantId: string, zones: import('../store.js').DeliveryZoneRecord[]) {
      setDeliveryZones(tenantId, zones);
    },
  };
}

export function createJsonPaymentsRepo(): PaymentsRepo {
  return {
    async createForOrder() {
      /* no-op: JSON driver keeps payment in order.payment only */
    },
  };
}
