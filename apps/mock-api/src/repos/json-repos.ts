import { getMarkets, setMarkets, getTenants, setTenants, getUsers, setUsers, getCouriers, setCouriers, getCustomers, setCustomers, getOrders, setOrders, getCatalog, setCatalog as setCatalogStore, getDelivery, setDelivery, getDeliveryZones, setDeliveryZones } from '../store.js';
import type { Market, RegistryTenant, User, Courier, Customer } from '../store.js';
import type { OrderRecord } from './types.js';
import { logOrderAudit } from '../order-protection.js';
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

function normalizeOrder(order: OrderRecord): OrderRecord {
  return { ...order, orderType: (order.orderType as string) ?? 'PRODUCT' };
}

function upsertInJsonList(orders: OrderRecord[], order: OrderRecord): OrderRecord[] {
  const normalized = normalizeOrder(order);
  const idx = orders.findIndex((o) => String(o.id) === String(normalized.id));
  if (idx === -1) return [...orders, normalized];
  const next = [...orders];
  next[idx] = normalized;
  return next;
}

export function createJsonOrdersRepo(): OrdersRepo {
  return {
    async findAll() {
      const orders = getOrders() as OrderRecord[];
      return orders.map((o) => normalizeOrder(o));
    },
    async create(order: OrderRecord) {
      const orders = getOrders() as OrderRecord[];
      const normalized = normalizeOrder(order);
      setOrders([...orders, normalized]);
      logOrderAudit('created', normalized);
    },
    async update(order: OrderRecord) {
      const orders = getOrders() as OrderRecord[];
      const idx = orders.findIndex((o) => String(o.id) === String(order.id));
      if (idx === -1) throw new Error(`Order not found: ${String(order.id)}`);
      const next = [...orders];
      const normalized = normalizeOrder(order);
      next[idx] = normalized;
      setOrders(next);
      logOrderAudit('updated', normalized);
    },
    async upsert(order: OrderRecord) {
      const orders = getOrders() as OrderRecord[];
      const exists = orders.some((o) => String(o.id) === String(order.id));
      const normalized = normalizeOrder(order);
      setOrders(upsertInJsonList(orders, order));
      logOrderAudit(exists ? 'updated' : 'created', normalized);
    },
    async updateMany(ordersToWrite: OrderRecord[]) {
      let orders = getOrders() as OrderRecord[];
      for (const o of ordersToWrite) {
        const exists = orders.some((row) => String(row.id) === String(o.id));
        const normalized = normalizeOrder(o);
        orders = upsertInJsonList(orders, o);
        logOrderAudit(exists ? 'updated' : 'created', normalized);
      }
      setOrders(orders);
    },
    async restore(order: OrderRecord) {
      const orders = getOrders() as OrderRecord[];
      const normalized = normalizeOrder(order);
      setOrders(upsertInJsonList(orders, order));
      logOrderAudit('restored', normalized);
    },
    async addOrderWithPayment(order: OrderRecord) {
      const orders = getOrders() as OrderRecord[];
      const normalized = normalizeOrder(order);
      setOrders([...orders, normalized]);
      logOrderAudit('created', normalized);
    },
    async deleteById(id: string) {
      const orders = (getOrders() as OrderRecord[]).filter((o) => String(o.id) !== id);
      setOrders(orders);
    },
    async deleteByTenantId(tenantId: string) {
      const orders = (getOrders() as OrderRecord[]).filter((o) => String(o.tenantId) !== tenantId);
      setOrders(orders);
    },
    async deleteByCourierId(courierId: string) {
      const orders = (getOrders() as OrderRecord[]).filter((o) => String(o.courierId) !== courierId);
      setOrders(orders);
    },
    async unassignCourier(courierId: string) {
      const orders = (getOrders() as OrderRecord[]).map((o) =>
        String(o.courierId) === courierId ? { ...o, courierId: undefined } : o
      );
      setOrders(orders);
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
    async deleteSettings(tenantId: string) {
      const d = getDelivery();
      delete d[tenantId];
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
    async deleteForOrderIds() {
      /* no-op */
    },
  };
}
