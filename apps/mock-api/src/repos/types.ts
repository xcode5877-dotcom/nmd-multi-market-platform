import type { Market, RegistryTenant, User, Courier, Customer } from '../store.js';
import type { TenantCatalog, DeliveryZoneRecord } from '../store.js';

/** Order as stored: flexible shape with payment, deliveryTimeline, etc. */
export type OrderRecord = Record<string, unknown>;

export interface DeliveryRepo {
  getSettings(tenantId: string): Promise<Record<string, unknown>>;
  setSettings(tenantId: string, settings: Record<string, unknown>): Promise<void>;
  /** Remove delivery settings for tenant (used by tenant deep-delete). */
  deleteSettings(tenantId: string): Promise<void>;
}

export interface DeliveryZonesRepo {
  getByTenant(tenantId: string): Promise<DeliveryZoneRecord[]>;
  setAll(tenantId: string, zones: DeliveryZoneRecord[]): Promise<void>;
}

export interface CatalogRepo {
  getCatalog(tenantId: string): Promise<TenantCatalog>;
  setCatalog(tenantId: string, catalog: TenantCatalog): Promise<void>;
}

export interface MarketsRepo {
  findAll(): Promise<Market[]>;
  setAll(markets: Market[]): Promise<void>;
}

export interface TenantsRepo {
  findAll(): Promise<RegistryTenant[]>;
  setAll(tenants: RegistryTenant[]): Promise<void>;
}

export interface UsersRepo {
  findAll(): Promise<User[]>;
  setAll(users: User[]): Promise<void>;
}

export interface CouriersRepo {
  findAll(): Promise<Courier[]>;
  setAll(couriers: Courier[]): Promise<void>;
}

export interface CustomersRepo {
  findAll(): Promise<Customer[]>;
  setAll(customers: Customer[]): Promise<void>;
}

export interface OrdersRepo {
  findAll(): Promise<OrderRecord[]>;
  /** Create a new order record. */
  create(order: OrderRecord): Promise<void>;
  /** Update an existing order by id. */
  update(order: OrderRecord): Promise<void>;
  /** Create or update a single order by id. */
  upsert(order: OrderRecord): Promise<void>;
  /** Upsert multiple orders individually (no bulk wipe). */
  updateMany(orders: OrderRecord[]): Promise<void>;
  /** Restore a previously removed order (upsert + restored audit). */
  restore(order: OrderRecord): Promise<void>;
  /** Append one order with payment (atomic in db mode). */
  addOrderWithPayment(order: OrderRecord, payment: { method: string; status: string; amount: number; currency?: string }): Promise<void>;
  /** Hard delete order by id (and cascade: payment, etc.). SUPER_ADMIN only. */
  deleteById(id: string): Promise<void>;
  /** Delete all orders for a tenant (one-by-one, not deleteMany). */
  deleteByTenantId(tenantId: string): Promise<void>;
  /** Delete all orders assigned to a courier (one-by-one, not deleteMany). */
  deleteByCourierId(courierId: string): Promise<void>;
  /** Clear courierId on all orders for a courier (one-by-one updates). */
  unassignCourier(courierId: string): Promise<void>;
}

export interface PaymentsRepo {
  /** Create a Payment row for an order (DB only; JSON no-op). Cash-first, card-ready. */
  createForOrder(orderId: string, payment: { method: string; status: string; amount: number; currency?: string }): Promise<void>;
  /** Delete payments for given order IDs (DB only; JSON no-op). Used by tenant deep-delete. */
  deleteForOrderIds(orderIds: string[]): Promise<void>;
}

export interface Repos {
  markets: MarketsRepo;
  tenants: TenantsRepo;
  users: UsersRepo;
  couriers: CouriersRepo;
  customers: CustomersRepo;
  orders: OrdersRepo;
  catalog: CatalogRepo;
  delivery: DeliveryRepo;
  deliveryZones: DeliveryZonesRepo;
  payments: PaymentsRepo;
}
