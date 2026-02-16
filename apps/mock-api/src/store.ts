import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'fs';
import { join } from 'path';

const DATA_FILE = join(process.cwd(), 'data.json');
// packages/mock/data relative to apps/mock-api (cwd when running mock-api)
const ORDERS_DIR = join(process.cwd(), '..', '..', 'packages', 'mock', 'data');
const ORDERS_FILE = join(ORDERS_DIR, 'orders.json');
const ORDERS_TMP = join(ORDERS_DIR, 'orders.tmp.json');

export interface StorefrontHero {
  title: string;
  subtitle: string;
  imageUrl?: string;
  ctaText?: string;
  ctaLink?: string;
  ctaHref?: string;
}

export interface StorefrontBanner {
  id: string;
  imageUrl: string;
  title?: string;
  subtitle?: string;
  link?: string;
  ctaText?: string;
  ctaHref?: string;
  enabled: boolean;
  isActive?: boolean;
  sortOrder: number;
  expiresAt?: string;
  showCountdown?: boolean;
}

export type TenantStoreType = 'CLOTHING' | 'FOOD' | 'GENERAL';

export type MarketCategory =
  | 'FOOD'
  | 'CLOTHING'
  | 'GROCERIES'
  | 'BUTCHER'
  | 'OFFERS'
  | 'ELECTRONICS'
  | 'HOME'
  | 'GENERAL';

export interface MarketBranding {
  logoUrl?: string;
  primaryColor?: string;
  hero?: StorefrontHero;
  banners?: StorefrontBanner[];
}

export interface Market {
  id: string;
  name: string;
  slug: string;
  branding?: MarketBranding;
  isActive: boolean;
  sortOrder?: number;
  paymentCapabilities?: { cash: boolean; card: boolean };
}

/** Delivery provider mode: TENANT = own couriers; MARKET = market couriers; PICKUP_ONLY = no delivery */
export type DeliveryProviderMode = 'TENANT' | 'MARKET' | 'PICKUP_ONLY';

/** Tenant type for delivery eligibility: RESTAURANT needs readyAt; SHOP/SERVICE eligible immediately */
export type TenantType = 'RESTAURANT' | 'SHOP' | 'SERVICE';

export interface RegistryTenant {
  id: string;
  slug: string;
  name: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
  radiusScale: number;
  layoutStyle: 'default' | 'compact' | 'spacious';
  enabled: boolean;
  createdAt: string;
  templateId?: string;
  hero?: StorefrontHero;
  banners?: StorefrontBanner[];
  whatsappPhone?: string;
  type?: TenantStoreType;
  /** Multi-sector: RETAIL | RESTAURANT | SERVICE (default RETAIL) */
  businessType?: 'RETAIL' | 'RESTAURANT' | 'SERVICE';
  marketCategory?: MarketCategory;
  marketId?: string;
  isListedInMarket?: boolean;
  marketSortOrder?: number;
  /** Delivery system: RESTAURANT | SHOP | SERVICE (default SHOP for non-FOOD) */
  tenantType?: TenantType;
  /** TENANT | MARKET | PICKUP_ONLY (default TENANT for delivery-enabled) */
  deliveryProviderMode?: DeliveryProviderMode;
  /** Option B: fallback to market courier if not assigned in time */
  allowMarketCourierFallback?: boolean;
  /** Default prep time in minutes for RESTAURANT orders */
  defaultPrepTimeMin?: number;
  /** Aggregator financial config */
  financialConfig?: {
    commissionType: 'PERCENTAGE' | 'FIXED';
    commissionValue: number;
    deliveryFeeModel: 'MARKET' | 'TENANT';
  };
  paymentCapabilities?: { cash: boolean; card: boolean };
}

export interface TenantCatalog {
  categories: unknown[];
  products: unknown[];
  optionGroups: unknown[];
  optionItems: unknown[];
}

export interface DeliveryZoneRecord {
  id: string;
  tenantId: string;
  name: string;
  fee: number;
  etaMinutes?: number;
  isActive: boolean;
  sortOrder?: number;
}

export type UserRole = 'ROOT_ADMIN' | 'MARKET_ADMIN' | 'TENANT_ADMIN' | 'COURIER' | 'CUSTOMER';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  marketId?: string; // required for MARKET_ADMIN, COURIER
  tenantId?: string; // required for TENANT_ADMIN
  courierId?: string; // required for COURIER
  /** Plain password for MVP; use hashing in production */
  password?: string;
}

/** Courier: MARKET or TENANT scoped. Option 1: market-scoped only - every courier has marketId. */
export interface Courier {
  id: string;
  scopeType: 'MARKET' | 'TENANT';
  scopeId: string;
  /** Market ID for market-scoped couriers (required for MARKET scope). Option 1: every courier belongs to exactly one market. */
  marketId?: string;
  name: string;
  phone?: string;
  isActive: boolean;
  isOnline: boolean;
  capacity: number;
  /** Available to take new orders (false when assigned to active delivery) */
  isAvailable?: boolean;
  /** Total deliveries completed (incremented when order status = DELIVERED) */
  deliveryCount?: number;
}

export interface Customer {
  id: string;
  phone: string;
  createdAt?: string;
}

/** Delivery job item (order reference) */
export interface DeliveryJobItem {
  orderId: string;
  tenantId: string;
}

/** Delivery job status */
export type DeliveryJobStatus = 'NEW' | 'ASSIGNED' | 'PICKING' | 'DELIVERING' | 'DONE' | 'CANCELED';

export interface DeliveryJob {
  id: string;
  marketId: string;
  courierId?: string;
  status: DeliveryJobStatus;
  items: DeliveryJobItem[];
  createdAt?: string;
}

export interface AuditEvent {
  id: string;
  at: string;
  userId: string;
  role: string;
  marketId?: string;
  action: 'create' | 'update' | 'delete';
  entity: string;
  entityId: string;
  reason?: string;
  emergencyMode?: boolean;
  before?: unknown;
  after?: unknown;
}

export interface MockData {
  markets: Market[];
  tenants: RegistryTenant[];
  users: User[];
  auditEvents: AuditEvent[];
  catalog: Record<string, TenantCatalog>;
  orders: unknown[];
  campaigns: unknown[];
  delivery: Record<string, unknown>;
  deliveryZones: Record<string, DeliveryZoneRecord[]>;
  couriers: Courier[];
  customers: Customer[];
  deliveryJobs: DeliveryJob[];
  templates: unknown[];
  staff: unknown[];
}

const DEFAULT: MockData = {
  markets: [],
  tenants: [],
  users: [],
  auditEvents: [],
  catalog: {},
  orders: [],
  campaigns: [],
  delivery: {},
  deliveryZones: {},
  couriers: [],
  customers: [],
  deliveryJobs: [],
  templates: [],
  staff: [],
};

const DEFAULT_HERO: StorefrontHero = {
  title: 'مرحباً بك',
  subtitle: 'اكتشف أفضل المنتجات لدينا',
  ctaText: 'تسوق الآن',
  ctaLink: '#',
};

export function migrateTenant(t: Record<string, unknown>): RegistryTenant {
  const tenant = t as unknown as RegistryTenant;
  if (!tenant.hero) {
    tenant.hero = DEFAULT_HERO;
  }
  if (!tenant.banners) {
    tenant.banners = [];
  }
  if (!tenant.type || !['CLOTHING', 'FOOD', 'GENERAL'].includes(tenant.type)) {
    tenant.type = 'GENERAL';
  }
  if (!tenant.marketCategory) {
    tenant.marketCategory = 'GENERAL';
  }
  if (tenant.isListedInMarket === undefined) {
    tenant.isListedInMarket = true;
  }
  if (!tenant.tenantType) {
    tenant.tenantType = tenant.type === 'FOOD' ? 'RESTAURANT' : 'SHOP';
  }
  if (!tenant.deliveryProviderMode) {
    tenant.deliveryProviderMode = 'TENANT';
  }
  if (tenant.allowMarketCourierFallback === undefined) {
    tenant.allowMarketCourierFallback = true;
  }
  if (tenant.defaultPrepTimeMin === undefined && tenant.tenantType === 'RESTAURANT') {
    tenant.defaultPrepTimeMin = 30;
  }
  if (!(tenant as RegistryTenant).businessType) {
    (tenant as RegistryTenant).businessType = tenant.type === 'FOOD' ? 'RESTAURANT' : 'RETAIL';
  }
  if (!tenant.financialConfig) {
    (tenant as RegistryTenant).financialConfig = {
      commissionType: 'PERCENTAGE',
      commissionValue: 10,
      deliveryFeeModel: 'TENANT',
    };
  }
  if (!tenant.paymentCapabilities) {
    (tenant as RegistryTenant).paymentCapabilities = { cash: true, card: false };
  }
  return tenant;
}

export function migrateMarket(m: Record<string, unknown>): Market {
  const market = m as unknown as Market;
  if (!market.paymentCapabilities) {
    (market as Market).paymentCapabilities = { cash: true, card: false };
  }
  return market;
}

function migrateCategory(c: Record<string, unknown>): Record<string, unknown> {
  if (c.parentId === undefined) c.parentId = null;
  if (c.isVisible === undefined) c.isVisible = true;
  return c;
}

export function migrateCourier(c: Record<string, unknown>): Courier {
  const courier = c as unknown as Courier;
  if (courier.scopeType === 'MARKET' && !courier.marketId) {
    courier.marketId = courier.scopeId;
  }
  return courier;
}

function load(): MockData {
  try {
    if (existsSync(DATA_FILE)) {
      const raw = readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<MockData>;
      const markets = (parsed.markets ?? []).map((m) => migrateMarket(m as unknown as Record<string, unknown>));
      const tenants = (parsed.tenants ?? []).map((t) => migrateTenant(t as unknown as Record<string, unknown>));
      const catalog: Record<string, TenantCatalog> = {};
      for (const [tid, cat] of Object.entries(parsed.catalog ?? {})) {
        const c = cat as TenantCatalog;
        catalog[tid] = {
          categories: (c.categories ?? []).map((x) => migrateCategory(x as Record<string, unknown>)),
          products: c.products ?? [],
          optionGroups: c.optionGroups ?? [],
          optionItems: c.optionItems ?? [],
        };
      }
      const users = (parsed.users ?? []) as User[];
      const auditEvents = (parsed.auditEvents ?? []) as AuditEvent[];
      return {
        markets,
        tenants,
        users,
        auditEvents,
        catalog,
        orders: [],
        campaigns: parsed.campaigns ?? [],
        delivery: parsed.delivery ?? {},
        deliveryZones: parsed.deliveryZones ?? {},
        couriers: (parsed.couriers ?? []).map((c) => migrateCourier(c as unknown as Record<string, unknown>)),
        customers: (parsed.customers ?? []) as Customer[],
        deliveryJobs: parsed.deliveryJobs ?? [],
        templates: parsed.templates ?? [],
        staff: parsed.staff ?? [],
      };
    }
  } catch {
    /* ignore */
  }
  return { ...DEFAULT, users: [], auditEvents: [] };
}

function save(data: MockData): void {
  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// --- Orders: separate persistence in packages/mock/data/orders.json ---
function loadOrders(): unknown[] {
  try {
    if (!existsSync(ORDERS_FILE)) return [];
    const raw = readFileSync(ORDERS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveOrders(orders: unknown[]): void {
  try {
    if (!existsSync(ORDERS_DIR)) mkdirSync(ORDERS_DIR, { recursive: true });
    writeFileSync(ORDERS_TMP, JSON.stringify(orders, null, 2), 'utf-8');
    renameSync(ORDERS_TMP, ORDERS_FILE);
  } catch (err) {
    console.error('Failed to persist orders:', err);
  }
}

let cache: MockData | null = null;

export function getData(): MockData {
  if (!cache) cache = load();
  return cache;
}

export function persist(): void {
  if (cache) save(cache);
}

export function getMarkets(): Market[] {
  return getData().markets;
}

export function setMarkets(markets: Market[]): void {
  getData().markets = markets;
  persist();
}

export function getTenants(): RegistryTenant[] {
  return getData().tenants;
}

export function setTenants(tenants: RegistryTenant[]): void {
  getData().tenants = tenants;
  persist();
}

export function getUsers(): User[] {
  return getData().users;
}

export function setUsers(users: User[]): void {
  getData().users = users;
  persist();
}

export function getAuditEvents(): AuditEvent[] {
  return getData().auditEvents;
}

export function appendAuditEvent(event: Omit<AuditEvent, 'id' | 'at'>): void {
  const data = getData();
  const ev: AuditEvent = {
    ...event,
    id: `audit-${crypto.randomUUID?.() ?? Date.now()}`,
    at: new Date().toISOString(),
  };
  data.auditEvents = [...(data.auditEvents ?? []), ev];
  persist();
}

export function getCatalog(tenantId: string): TenantCatalog {
  const cat = getData().catalog[tenantId];
  if (!cat) {
    return { categories: [], products: [], optionGroups: [], optionItems: [] };
  }
  const categories = (cat.categories ?? []).map((c) => {
    const x = c as Record<string, unknown>;
    if (x.parentId === undefined) x.parentId = null;
    if (x.isVisible === undefined) x.isVisible = true;
    return x;
  });
  return {
    categories,
    products: cat.products ?? [],
    optionGroups: cat.optionGroups ?? [],
    optionItems: cat.optionItems ?? [],
  };
}

export function setCatalog(tenantId: string, catalog: TenantCatalog): void {
  getData().catalog[tenantId] = {
    categories: catalog.categories ?? [],
    products: catalog.products ?? [],
    optionGroups: catalog.optionGroups ?? [],
    optionItems: catalog.optionItems ?? [],
  };
  persist();
}

let ordersCache: unknown[] | null = null;

export function getOrders(): unknown[] {
  if (ordersCache === null) ordersCache = loadOrders();
  return ordersCache;
}

export function setOrders(orders: unknown[]): void {
  ordersCache = orders;
  saveOrders(orders);
}

export function getCampaigns(): unknown[] {
  return getData().campaigns;
}

export function setCampaigns(campaigns: unknown[]): void {
  getData().campaigns = campaigns;
  persist();
}

export function getDelivery(): Record<string, unknown> {
  return getData().delivery;
}

export function setDelivery(delivery: Record<string, unknown>): void {
  getData().delivery = delivery;
  persist();
}

export function getDeliveryZones(tenantId: string): DeliveryZoneRecord[] {
  return getData().deliveryZones[tenantId] ?? [];
}

export function setDeliveryZones(tenantId: string, zones: DeliveryZoneRecord[]): void {
  getData().deliveryZones[tenantId] = zones;
  persist();
}

export function getCouriers(): Courier[] {
  return getData().couriers ?? [];
}

export function setCouriers(couriers: Courier[]): void {
  getData().couriers = couriers;
  persist();
}

export function getCustomers(): Customer[] {
  return getData().customers;
}

export function setCustomers(customers: Customer[]): void {
  getData().customers = customers;
  persist();
}

export function getDeliveryJobs(): DeliveryJob[] {
  return getData().deliveryJobs ?? [];
}

export function setDeliveryJobs(jobs: DeliveryJob[]): void {
  getData().deliveryJobs = jobs;
  persist();
}

export function getTemplates(): unknown[] {
  return getData().templates;
}

export function setTemplates(templates: unknown[]): void {
  getData().templates = templates;
  persist();
}

export function getStaff(): unknown[] {
  return getData().staff;
}

export function setStaff(staff: unknown[]): void {
  getData().staff = staff;
  persist();
}
