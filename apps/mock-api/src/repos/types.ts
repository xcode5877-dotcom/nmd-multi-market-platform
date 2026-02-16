import type { Market, RegistryTenant, User, Courier, Customer } from '../store.js';
import type { TenantCatalog, DeliveryZoneRecord } from '../store.js';

/** Order as stored: flexible shape with payment, deliveryTimeline, etc. */
export type OrderRecord = Record<string, unknown>;

export interface DeliveryRepo {
  getSettings(tenantId: string): Promise<Record<string, unknown>>;
  setSettings(tenantId: string, settings: Record<string, unknown>): Promise<void>;
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
  setAll(orders: OrderRecord[]): Promise<void>;
  /** Append one order with payment (atomic in db mode). */
  addOrderWithPayment(order: OrderRecord, payment: { method: string; status: string; amount: number; currency?: string }): Promise<void>;
}

export interface PaymentsRepo {
  /** Create a Payment row for an order (DB only; JSON no-op). Cash-first, card-ready. */
  createForOrder(orderId: string, payment: { method: string; status: string; amount: number; currency?: string }): Promise<void>;
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
