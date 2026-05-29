import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, statSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';

/** Path to data.json; process must have write permission so admin email and other updates persist. */
const DATA_FILE = process.env.DATA_FILE || join(process.cwd(), 'data.json');
// Orders: use ORDERS_FILE when set (e.g. /data/orders.json in Docker) so data persists on host volume
const ORDERS_FILE = process.env.ORDERS_FILE || join(process.cwd(), '..', '..', 'packages', 'mock', 'data', 'orders.json');
const ORDERS_DIR = dirname(ORDERS_FILE);
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
  /** Optional image URL for market selection / picker (e.g. hero or card). */
  imageUrl?: string;
  branding?: MarketBranding;
  isActive: boolean;
  sortOrder?: number;
  paymentCapabilities?: { cash: boolean; card: boolean };
  /** Market-level categories (for storefront/market page). */
  categories?: Array<{ id: string; name: string; slug: string; icon?: string; sortOrder?: number }>;
  /** Stores/tenants in this market (for rich API response). */
  stores?: RegistryTenant[];
  /** Market-level default platform service fee (Phase 1). JSON storage only until DB column added. */
  platformFeeConfig?: import('./platform-fee.js').PlatformFeeConfig;
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
  layoutStyle: import('@nmd/core').LayoutStyle;
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
    /** Store-level platform fee override (Phase 1). Persisted in financialConfig JSON. */
    platformFee?: import('./platform-fee.js').TenantPlatformFeeOverride;
  };
  paymentCapabilities?: { cash: boolean; card: boolean };
  /** Admin-controlled homepage sections */
  collections?: import('@nmd/core').HomeCollection[];
  /** Manual override: open | closed | busy */
  operationalStatus?: 'open' | 'closed' | 'busy';
  /** accept_always | accept_only_when_open */
  orderPolicy?: 'accept_always' | 'accept_only_when_open';
  /** Per-day hours: { mon: { open, close, isClosedDay }, ... } */
  businessHours?: import('@nmd/core').BusinessHours;
  /** Show custom banner when busy */
  busyBannerEnabled?: boolean;
  busyBannerText?: string;
  /** Store mode: RESTAURANT | PROFESSIONAL. PROFESSIONAL = no cart, contact-only */
  storeType?: 'RESTAURANT' | 'PROFESSIONAL';
  /** Professional bio (HTML). For PROFESSIONAL stores */
  about?: string;
  /** Phone for call button. Falls back to whatsappPhone */
  phone?: string;
  /** Office hours (ساعات العمل). For PROFESSIONAL stores. Legacy free-text. */
  officeHours?: string;
  /** Daily open time HH:mm (e.g. 08:00). Fallback 08:00 when missing. */
  openTime?: string;
  /** Daily close time HH:mm (e.g. 17:00). Fallback 17:00 when missing. */
  closeTime?: string;
  /** Manual override: when true, store shows as CLOSED regardless of openTime/closeTime. */
  forceClosed?: boolean;
  /** Appointment duration in minutes. For PROFESSIONAL booking */
  appointmentDuration?: number;
  /** Enable online booking (Coming Soon). For PROFESSIONAL stores */
  bookingEnabled?: boolean;
  /** Store address (e.g. for maps and courier pickup). */
  addressLine?: string;
  /** Store location for maps. Merchant sets in settings. Super Admin can set for distance/out-of-range fix. */
  location?: { lat: number; lng: number };
  /** Max delivery radius in km from store location. When set with location, used as fallback when no zone matches (fixes "Out of Range"). */
  deliveryRadiusKm?: number;
  /** SLA category policy id (platform-admin configured). */
  categoryId?: string;
  /** Display order for storefront (lower = first). Used by GET /storefront/tenants and market stores. */
  sortOrder?: number;
  /** Pillar (food / retail / services / crafts). Admin-assigned; used for storefront section filtering. */
  pillarId?: string | null;
  /** Sub-category under a pillar. Admin-assigned; used for grouping on section pages. */
  subCategoryId?: string | null;
  /** When true, merchant sees "وحدة البيع" and "قفزة الكمية" in product form (e.g. vegetables/butchery). */
  supportsWeightSelling?: boolean;
}

/** Pillar for storefront navigation (Food, Retail, Services, Crafts). Admin-managed. */
export interface Pillar {
  id: string;
  name: string;
  nameAr?: string;
  slug: string;
  icon?: string;
  sortOrder: number;
}

/** Sub-category under a pillar. Admin can create/edit/delete and assign stores. */
export interface SubCategory {
  id: string;
  pillarId: string;
  name: string;
  nameAr?: string;
  slug?: string;
  sortOrder: number;
}

/** Central SLA policy per category (e.g. Food = tight 3/5min, General = relaxed). */
export interface CategoryPolicy {
  id: string;
  name: string;
  /** Green: elapsed < greenMs */
  greenMs: number;
  /** Orange: greenMs <= elapsed < orangeMs */
  orangeMs: number;
  /** Red: elapsed >= redMs (flash) */
  redMs: number;
  /** When true, use tight windows (e.g. 3min/5min for food). */
  isUrgent: boolean;
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
  centerLat?: number;
  centerLng?: number;
  radiusKm?: number;
}

export type UserRole = 'ROOT_ADMIN' | 'SUPER_ADMIN' | 'MARKET_ADMIN' | 'TENANT_ADMIN' | 'COURIER' | 'CUSTOMER';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  marketId?: string; // required for MARKET_ADMIN, COURIER
  tenantId?: string; // required for TENANT_ADMIN
  courierId?: string; // required for COURIER
  /** Plain password for MVP; use hashing in production */
  password?: string;
  /** When true, redirect to change-password on next login */
  mustChangePassword?: boolean;
  /** Firebase Cloud Messaging token for merchant push (Android/native app) */
  fcmToken?: string;
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
  /** Driver "Coba" / float: initial cash given at shift start (default 300) */
  initialFloat?: number;
}

/** Shift settlement log entry: driver hands over collected cash to admin */
export interface SettlementLogEntry {
  id: string;
  courierId: string;
  adminId: string;
  totalCollected: number;
  timestamp: string;
  marketId?: string;
}

export interface Customer {
  id: string;
  phone: string;
  name?: string;
  createdAt?: string;
  /** FCM token for order status push (native customer app). */
  fcmToken?: string | null;
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

/** Global category (platform-level). Used on mall homepage and GET /categories. Big Admin may use nameAr. */
export interface GlobalCategory {
  id: string;
  title: string;
  /** Arabic display name (Big Admin style); fallback to title when absent */
  nameAr?: string;
  icon: string;
  isProfessional: boolean;
  sortOrder: number;
  /** Legacy code for backward compat with tenant.marketCategory (e.g. FOOD, CLOTHING) */
  legacyCode?: string;
}

export interface Lead {
  id: string;
  tenantId: string;
  type: 'whatsapp' | 'call' | 'cta' | 'PROFESSIONAL_CONTACT';
  timestamp: string;
  metadata?: Record<string, unknown>;
  /** For PROFESSIONAL_CONTACT: NEW, etc. */
  status?: string;
  /** For PROFESSIONAL_CONTACT: whatsapp | call */
  contactType?: string;
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
  globalCategories: GlobalCategory[];
  leads: Lead[];
  categoryPolicies: CategoryPolicy[];
  pillars: Pillar[];
  subCategories: SubCategory[];
  settlementLogs: SettlementLogEntry[];
  /** Reusable option groups per tenant (Options generator / Add from Templates). Key = tenantId. */
  optionTemplates: Record<string, unknown[]>;
}

/** Initial categories: synced with Big Admin; no old FOOD/CLOTHING enum. GET /categories returns this. */
const DEFAULT_GLOBAL_CATEGORIES: GlobalCategory[] = [
  { id: 'cat-test', nameAr: 'اختبار الربط الجديد', title: 'اختبار', icon: '🔗', isProfessional: false, sortOrder: 0 },
  { id: 'cat-test-2', nameAr: 'تصنيف ثانٍ للاختبار', title: 'اختبار ٢', icon: '📋', isProfessional: false, sortOrder: 1 },
];

/** Default SLA category policies: Food/Sweets = urgent 3/5min; General = relaxed. */
const DEFAULT_CATEGORY_POLICIES: CategoryPolicy[] = [
  { id: 'cat-sla-food', name: 'طعام / حلويات', greenMs: 3 * 60 * 1000, orangeMs: 5 * 60 * 1000, redMs: 6 * 60 * 1000, isUrgent: true },
  { id: 'cat-sla-general', name: 'عام', greenMs: 10 * 60 * 1000, orangeMs: 15 * 60 * 1000, redMs: 20 * 60 * 1000, isUrgent: false },
];

/** Default pillars for storefront (Food, Retail, Services, Crafts). */
const DEFAULT_PILLARS: Pillar[] = [
  { id: 'pillar-food', name: 'Food', nameAr: 'طعام', slug: 'food', icon: '🍽️', sortOrder: 0 },
  { id: 'pillar-retail', name: 'Retail', nameAr: 'تجزئة', slug: 'retail', icon: '🛒', sortOrder: 1 },
  { id: 'pillar-services', name: 'Services', nameAr: 'خدمات', slug: 'services', icon: '💼', sortOrder: 2 },
  { id: 'pillar-crafts', name: 'Crafts', nameAr: 'حرفيون', slug: 'crafts', icon: '🔧', sortOrder: 3 },
];

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
  globalCategories: DEFAULT_GLOBAL_CATEGORIES,
  leads: [],
  categoryPolicies: DEFAULT_CATEGORY_POLICIES,
  pillars: DEFAULT_PILLARS,
  subCategories: [],
  settlementLogs: [],
  optionTemplates: {},
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
  if (!tenant.collections) {
    (tenant as RegistryTenant).collections = [];
  }
  if (!(tenant as RegistryTenant).categoryId) {
    (tenant as RegistryTenant).categoryId = DEFAULT_CATEGORY_POLICIES[0]?.id ?? 'cat-sla-general';
  }
  if (typeof (tenant as RegistryTenant).sortOrder !== 'number') {
    (tenant as RegistryTenant).sortOrder = 0;
  }
  if ((tenant as RegistryTenant).pillarId === undefined) {
    (tenant as RegistryTenant).pillarId = null;
  }
  if ((tenant as RegistryTenant).subCategoryId === undefined) {
    (tenant as RegistryTenant).subCategoryId = null;
  }
  const opStatus = (tenant as { operationalStatus?: string }).operationalStatus;
  if (opStatus !== 'open' && opStatus !== 'closed' && opStatus !== 'busy') {
    (tenant as { operationalStatus?: string }).operationalStatus = 'open';
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

function migrateCategory(c: Record<string, unknown>, index: number): Record<string, unknown> {
  if (c.parentId === undefined) c.parentId = null;
  if (c.isVisible === undefined) c.isVisible = true;
  if (typeof (c as { sortOrder?: number }).sortOrder !== 'number') (c as { sortOrder: number }).sortOrder = index;
  return c;
}

export function migrateCourier(c: Record<string, unknown>): Courier {
  const courier = c as unknown as Courier;
  if (courier.scopeType === 'MARKET' && !courier.marketId) {
    courier.marketId = courier.scopeId;
  }
  if (courier.initialFloat === undefined) (courier as { initialFloat: number }).initialFloat = 300;
  return courier;
}

/** Parse JSON snapshot into MockData with migrations. Used by load() and by seed-from-JSON. Never removes tenants: all entries in parsed.tenants are preserved. */
export function parseToMockData(parsed: Partial<MockData>): MockData {
  const rawMarkets = (parsed.markets ?? []) as Array<Record<string, unknown>>;
  const tenants = (parsed.tenants ?? []).map((t, i) => migrateTenant({ ...(t as Record<string, unknown>), sortOrder: (t as { sortOrder?: number }).sortOrder ?? i } as unknown as Record<string, unknown>));
  const markets = rawMarkets.map((m) => {
    const market = migrateMarket(m as unknown as Record<string, unknown>) as Market & { categories?: Market['categories']; stores?: RegistryTenant[]; tenantIds?: string[] };
    market.categories = (m.categories as Market['categories']) ?? [];
    market.stores = (m.stores ?? []).map((s: Record<string, unknown>) =>
      migrateTenant({ ...s, marketId: m.id } as unknown as Record<string, unknown>)
    );
    if (Array.isArray(m.tenantIds)) market.tenantIds = m.tenantIds as string[];
    return market;
  });
  const catalog: Record<string, TenantCatalog> = {};
  for (const [tid, cat] of Object.entries(parsed.catalog ?? {})) {
    const c = cat as TenantCatalog;
    catalog[tid] = {
      categories: (c.categories ?? []).map((x, i) => migrateCategory(x as Record<string, unknown>, i)),
      products: (c.products ?? []).map((p: Record<string, unknown>, i: number) => {
        const prod = { ...p };
        if (typeof (prod as { sortOrder?: number }).sortOrder !== 'number') (prod as { sortOrder: number }).sortOrder = i;
        return prod;
      }),
      optionGroups: c.optionGroups ?? [],
      optionItems: c.optionItems ?? [],
    };
  }
  const users = (parsed.users ?? []) as User[];
  const auditEvents = (parsed.auditEvents ?? []) as AuditEvent[];
  const globalCategories = Array.isArray(parsed.globalCategories) && parsed.globalCategories.length > 0
    ? (parsed.globalCategories as GlobalCategory[])
    : [...DEFAULT_GLOBAL_CATEGORIES];
  const categoryPolicies = Array.isArray(parsed.categoryPolicies) && parsed.categoryPolicies.length > 0
    ? (parsed.categoryPolicies as CategoryPolicy[])
    : [...DEFAULT_CATEGORY_POLICIES];
  const pillars = Array.isArray(parsed.pillars) && parsed.pillars.length > 0
    ? (parsed.pillars as Pillar[])
    : [...DEFAULT_PILLARS];
  const subCategories = Array.isArray(parsed.subCategories) ? (parsed.subCategories as SubCategory[]) : [];
  const settlementLogs = Array.isArray(parsed.settlementLogs) ? (parsed.settlementLogs as SettlementLogEntry[]) : [];
  const optionTemplates = parsed.optionTemplates && typeof parsed.optionTemplates === 'object' ? (parsed.optionTemplates as Record<string, unknown[]>) : {};
  // Restore marketId for tenants that are in a market's stores or tenantIds but have no marketId (e.g. data drift)
  for (const t of tenants) {
    const tid = (t as { id?: string }).id;
    if (tid && !(t as { marketId?: string }).marketId) {
      for (const m of markets) {
        const mStores = (m as { stores?: { id?: string }[] }).stores ?? [];
        const mIds = (m as { tenantIds?: string[] }).tenantIds ?? [];
        if (mStores.some((s) => s.id === tid) || mIds.includes(tid)) {
          (t as { marketId?: string }).marketId = m.id;
          break;
        }
      }
    }
  }
  return {
    markets,
    tenants,
    users,
    auditEvents,
    catalog,
    orders: Array.isArray(parsed.orders) ? parsed.orders : [],
    campaigns: parsed.campaigns ?? [],
    delivery: (parsed.delivery && typeof parsed.delivery === 'object') ? parsed.delivery : {},
    deliveryZones: (parsed.deliveryZones && typeof parsed.deliveryZones === 'object') ? parsed.deliveryZones : {},
    couriers: (parsed.couriers ?? []).map((c) => migrateCourier(c as unknown as Record<string, unknown>)),
    customers: (parsed.customers ?? []) as Customer[],
    deliveryJobs: parsed.deliveryJobs ?? [],
    templates: parsed.templates ?? [],
    staff: parsed.staff ?? [],
    globalCategories,
    leads: parsed.leads ?? [],
    categoryPolicies,
    pillars,
    subCategories,
    settlementLogs,
    optionTemplates,
  };
}

/**
 * Load from DATA_FILE when it exists. Never overwrites existing data: this only reads.
 * When the file is missing, returns in-memory default; nothing is written until an API
 * calls set*() (e.g. setUsers, setTenants), which triggers save(). Startup seeds run
 * in index.ts only when DATA_FILE does not exist (or has no existing users/tenants).
 */
function load(): MockData {
  try {
    if (existsSync(DATA_FILE)) {
      const raw = readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<MockData>;
      const data = parseToMockData(parsed);
      data.orders = []; // orders live in ORDERS_FILE, not in main data.json
      return data;
    }
  } catch {
    /* ignore */
  }
  return { ...DEFAULT, users: [], auditEvents: [] };
}

/** Load MockData from a JSON file path (e.g. for seeding DB from data.json). Preserves all IDs. */
export function loadFromPath(filePath: string): MockData | null {
  try {
    if (!existsSync(filePath)) return null;
    const raw = readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<MockData>;
    return parseToMockData(parsed);
  } catch (err) {
    console.error('[store] loadFromPath failed:', filePath, err instanceof Error ? err.message : err);
    return null;
  }
}

function save(data: MockData): void {
  try {
    const dir = dirname(DATA_FILE);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8'); // UTF-8 for Arabic labels and names
  } catch (err) {
    console.error('[store] Failed to persist data (check permissions, e.g. DATA_FILE path):', err instanceof Error ? err.message : err);
    throw err;
  }
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

const RENAME_RETRIES = 3;
const RENAME_DELAY_MS = 50;

function saveOrders(orders: unknown[]): void {
  const payload = JSON.stringify(orders, null, 2);
  try {
    if (!existsSync(ORDERS_DIR)) mkdirSync(ORDERS_DIR, { recursive: true });
    writeFileSync(ORDERS_TMP, payload, 'utf-8');
    let renamed = false;
    for (let attempt = 0; attempt < RENAME_RETRIES; attempt++) {
      try {
        renameSync(ORDERS_TMP, ORDERS_FILE);
        renamed = true;
        break;
      } catch (e) {
        const code = (e as NodeJS.ErrnoException)?.code;
        if (code === 'EBUSY' && attempt < RENAME_RETRIES - 1) {
          const end = Date.now() + RENAME_DELAY_MS;
          while (Date.now() < end) { /* busy-wait before retry */ }
        } else {
          writeFileSync(ORDERS_FILE, payload, 'utf-8');
          if (existsSync(ORDERS_TMP)) try { unlinkSync(ORDERS_TMP); } catch { /* ignore */ }
          renamed = true;
          if (code && code !== 'EBUSY') console.error('[store] orders rename failed, wrote directly:', code, (e as Error)?.message);
          break;
        }
      }
    }
    if (!renamed) {
      writeFileSync(ORDERS_FILE, payload, 'utf-8');
      if (existsSync(ORDERS_TMP)) try { unlinkSync(ORDERS_TMP); } catch { /* ignore */ }
      console.error('[store] orders save used direct write after rename retries');
    }
  } catch (err) {
    console.error('Failed to persist orders:', err);
  }
}

let cache: MockData | null = null;
let lastLoadedMtimeMs = 0;

/** Read data.json from disk; cache invalidated when file mtime changes (e.g. host volume updated). */
function dataFileMtimeMs(): number {
  try {
    if (existsSync(DATA_FILE)) return statSync(DATA_FILE).mtimeMs;
  } catch {
    /* ignore */
  }
  return 0;
}

export function getData(): MockData {
  const mtime = dataFileMtimeMs();
  if (!cache || mtime > lastLoadedMtimeMs) {
    cache = load();
    lastLoadedMtimeMs = mtime || Date.now();
  }
  return cache;
}

/** Force next getData() to re-read from disk (e.g. after volume mount). */
export function invalidateDataCache(): void {
  cache = null;
  lastLoadedMtimeMs = 0;
}

export function persist(): void {
  if (cache) {
    save(cache);
    lastLoadedMtimeMs = dataFileMtimeMs() || Date.now();
  }
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
  const categories = (cat.categories ?? []).map((c, i) => {
    const x = c as Record<string, unknown>;
    if (x.parentId === undefined) x.parentId = null;
    if (x.isVisible === undefined) x.isVisible = true;
    if (typeof (x as { sortOrder?: number }).sortOrder !== 'number') (x as { sortOrder: number }).sortOrder = i;
    return x;
  });
  const allOptionGroups = (cat.optionGroups ?? []) as Array<{ id: string; tenantId?: string; ownerId?: string }>;
  const optionGroupsList = allOptionGroups.filter(
    (g) =>
      g.tenantId === tenantId ||
      g.ownerId === tenantId ||
      (!g.tenantId && !g.ownerId)
  );
  const optionGroupsById = new Map(optionGroupsList.map((g) => [g.id, g]));
  const products = (cat.products ?? []).map((p, i) => {
    const prod = p as Record<string, unknown>;
    if (typeof (prod as { sortOrder?: number }).sortOrder !== 'number') (prod as { sortOrder: number }).sortOrder = i;
    const optionGroupIds = prod.optionGroupIds as string[] | undefined;
    let out: Record<string, unknown> = prod;
    if (Array.isArray(optionGroupIds) && optionGroupIds.length > 0) {
      const resolved = optionGroupIds
        .map((id) => optionGroupsById.get(id))
        .filter(Boolean) as unknown[];
      out = { ...prod, optionGroups: resolved.length > 0 ? resolved : prod.optionGroups };
    }
    if (out.quantityStep === undefined) out.quantityStep = 1;
    if (out.unitName === undefined) out.unitName = 'حبة';
    return out;
  });
  return {
    categories,
    products,
    optionGroups: optionGroupsList,
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

/** Option templates (reusable library) per tenant. */
export function getOptionTemplates(tenantId: string): unknown[] {
  const list = getData().optionTemplates?.[tenantId];
  return Array.isArray(list) ? [...list] : [];
}

export function setOptionTemplates(tenantId: string, groups: unknown[]): void {
  const data = getData();
  if (!data.optionTemplates) data.optionTemplates = {};
  data.optionTemplates[tenantId] = groups;
  persist();
}

/** Append or replace one option group in templates and ensure catalog has it. */
export function addOptionTemplate(tenantId: string, group: unknown): void {
  const data = getData();
  if (!data.optionTemplates) data.optionTemplates = {};
  const list = data.optionTemplates[tenantId] ?? [];
  const rec = group as { id?: string };
  const idx = list.findIndex((g) => (g as { id?: string }).id === rec.id);
  const withTenant = { ...rec, tenantId };
  const next = idx >= 0 ? list.map((g, i) => (i === idx ? withTenant : g)) : [...list, withTenant];
  data.optionTemplates[tenantId] = next;
  const cat = getCatalog(tenantId);
  const catalogGroups = (cat.optionGroups ?? []) as unknown[];
  const catIdx = catalogGroups.findIndex((g) => (g as { id?: string }).id === rec.id);
  const merged = catIdx >= 0
    ? catalogGroups.map((g, i) => (i === catIdx ? withTenant : g))
    : [...catalogGroups, withTenant];
  setCatalog(tenantId, { ...cat, optionGroups: merged });
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

/** Force next getOrders() to reload from ORDERS_FILE (e.g. after emergency order wipe). */
export function invalidateOrdersCache(): void {
  ordersCache = null;
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

export function getSettlementLogs(): SettlementLogEntry[] {
  return getData().settlementLogs ?? [];
}

export function appendSettlementLog(entry: SettlementLogEntry): void {
  const data = getData();
  if (!data.settlementLogs) data.settlementLogs = [];
  data.settlementLogs.push(entry);
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

export function getGlobalCategories(): GlobalCategory[] {
  const cats = getData().globalCategories;
  return (cats ?? []).length > 0 ? [...cats].sort((a, b) => a.sortOrder - b.sortOrder) : [...DEFAULT_GLOBAL_CATEGORIES];
}

export function setGlobalCategories(categories: GlobalCategory[]): void {
  getData().globalCategories = categories;
  persist();
}

export function getStaff(): unknown[] {
  return getData().staff;
}

export function setStaff(staff: unknown[]): void {
  getData().staff = staff;
  persist();
}

export function getCategoryPolicies(): CategoryPolicy[] {
  const list = getData().categoryPolicies;
  return Array.isArray(list) && list.length > 0 ? [...list] : [...DEFAULT_CATEGORY_POLICIES];
}

export function setCategoryPolicies(policies: CategoryPolicy[]): void {
  getData().categoryPolicies = policies;
  persist();
}

export function getLeads(): Lead[] {
  return getData().leads ?? [];
}

export function appendLead(lead: Omit<Lead, 'id'> & { timestamp?: string }): Lead {
  const data = getData();
  const full: Lead = {
    ...lead,
    id: `lead-${crypto.randomUUID?.() ?? Date.now()}`,
    timestamp: (lead.timestamp && lead.timestamp.trim()) ? lead.timestamp : new Date().toISOString(),
  };
  data.leads = [...(data.leads ?? []), full];
  persist();
  return full;
}

export function getPillars(): Pillar[] {
  const list = getData().pillars;
  return Array.isArray(list) && list.length > 0 ? [...list].sort((a, b) => a.sortOrder - b.sortOrder) : [...DEFAULT_PILLARS];
}

export function setPillars(pillars: Pillar[]): void {
  getData().pillars = pillars;
  persist();
}

export function getSubCategories(): SubCategory[] {
  const list = getData().subCategories;
  return Array.isArray(list) ? [...list].sort((a, b) => a.sortOrder - b.sortOrder) : [];
}

export function setSubCategories(subCategories: SubCategory[]): void {
  getData().subCategories = subCategories;
  persist();
}
