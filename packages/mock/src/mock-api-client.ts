import type { ApiClient } from '@nmd/core';
import type { Tenant, Category, Product, Order, OrderPayload, Campaign, DeliverySettings, DeliveryZone, OptionGroup, OptionItem } from '@nmd/core';
import { generateId } from '@nmd/core';
import {
  getTenantById,
  getTenantBySlug,
  listEnabledTenants,
} from './tenant-registry';
import { getCatalog, listOptionGroups, listOptionItemsByGroup } from './catalog-store';
import { addOrder, getOrder } from './orders-store';
import { getTemplate } from './template-store';
import { listCampaigns } from './campaign-store';
import { getDeliverySettings as getDeliverySettingsStore } from './delivery-store';
import { getDeliveryZones as getDeliveryZonesStore } from './delivery-zones-store';
import type { RegistryTenant, MarketCourier, MarketCourierWithStats, CategoryPolicy } from './types';
import type { MerchantStatsPayload } from './merchant-stats-local';

const MOCK_API_URL_RAW =
  (typeof import.meta !== 'undefined' && (import.meta as { env?: Record<string, string> }).env?.VITE_MOCK_API_URL) ||
  '';
/** Production fallback so merchant app at /merchant/ never uses relative paths (which would hit /merchant/auth/me instead of API). */
const PROD_API_BASE = 'https://nmd.marketing/api';
/** Always use absolute base: no trailing slash. In production, fallback to full URL so requests never include /merchant/. */
const MOCK_API_URL = (() => {
  const s = typeof MOCK_API_URL_RAW === 'string' ? MOCK_API_URL_RAW.trim().replace(/\/$/, '') : '';
  if (s) return s;
  const env = typeof import.meta !== 'undefined' ? (import.meta as { env?: Record<string, unknown> }).env : undefined;
  const isDev = !!env?.DEV;
  if (isDev) return '';
  /** Production AAB/APK / mis-built .env: never leave API base empty outside Vite dev. */
  return PROD_API_BASE;
})();

/** True when client will use HTTP (env or production fallback), not in-memory mock only. */
export function isRemoteApiConfigured(): boolean {
  return MOCK_API_URL.length > 0;
}

/** Build absolute API URL so requests never go to /merchant/auth/me when app is served at /merchant/. */
function apiBaseUrl(): string {
  return MOCK_API_URL;
}
function buildAbsoluteUrl(path: string): string {
  const base = apiBaseUrl();
  if (!base) return path;
  const p = path.startsWith('/') ? path : `/${path}`;
  return base + p;
}
/** Must match AuthContext TOKEN_KEY in apps/nmd-admin - same localStorage key for JWT */
const TOKEN_KEY = 'nmd-access-token';

/** Global token helper - explicitly reads from localStorage. No internal state. */
function getAuthToken(): string | null {
  return typeof localStorage !== 'undefined' ? localStorage.getItem('nmd-access-token') : null;
}
/** Customer OTP token - used by storefront for POST /orders when logged in */
export const CUSTOMER_TOKEN_KEY = 'nmd-customer-token';

/** Token provider for admin apps (e.g. nmd-admin). When set, used instead of localStorage for auth. */
let tokenProvider: (() => string | null) | null = null;

export function setMockApiTokenProvider(fn: () => string | null): void {
  tokenProvider = fn;
}

function getToken(): string | null {
  const fromProvider = tokenProvider?.() ?? null;
  const fromStorage = typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
  return fromProvider ?? fromStorage;
}

function getCustomerToken(): string | null {
  return typeof localStorage !== 'undefined' ? localStorage.getItem(CUSTOMER_TOKEN_KEY) : null;
}

/**
 * Path-based token selection to avoid mixing admin and customer tokens.
 * Admin apps (5174/5176) and storefront share localStorage; sending customer token to admin
 * endpoints causes 401/403. /customer/* and POST /orders use customer token; all else use admin only.
 */
function getApiHeaders(path: string, method: string, init?: RequestInit): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json', ...(init?.headers as Record<string, string>) };
  let token: string | null = null;
  if (path.startsWith('/customer/')) {
    token = getCustomerToken() ?? getToken();
  } else if (method === 'POST' && path === '/orders') {
    token = getCustomerToken();
  } else if (path.startsWith('/coupons/validate')) {
    token = getCustomerToken() ?? getToken();
  } else {
    token = getAuthToken() ?? getToken();
  }
  if (token) {
    h['Authorization'] = `Bearer ${token}`;
  }
  const emergency = (typeof window !== 'undefined' && (window as { __NMD_EMERGENCY_HEADERS__?: Record<string, string> }).__NMD_EMERGENCY_HEADERS__);
  if (emergency) Object.assign(h, emergency);
  return h;
}

function mergeEmergencyMeta(body: string | undefined, method: string): string | undefined {
  const reason = typeof window !== 'undefined' ? (window as { __NMD_EMERGENCY_REASON__?: string }).__NMD_EMERGENCY_REASON__ : undefined;
  if (!reason) return body;
  const isWrite = ['POST', 'PUT', 'PATCH', 'DELETE'].includes((method || 'GET').toUpperCase());
  if (!isWrite) return body;
  try {
    const parsed = body ? JSON.parse(body) : {};
    const merged = { ...parsed, _meta: { ...parsed._meta, emergencyReason: reason } };
    return JSON.stringify(merged);
  } catch {
    return body;
  }
}

function normalizeHero(h: import('@nmd/core').StorefrontHero | undefined) {
  const defaultHero = { title: 'مرحباً بك', subtitle: 'اكتشف أفضل المنتجات لدينا', ctaText: 'تسوق الآن', ctaLink: '#', ctaHref: '#' };
  const base = h ?? defaultHero;
  const cta = base.ctaHref ?? base.ctaLink ?? '#';
  return { ...base, ctaLink: cta, ctaHref: cta };
}

function registryToTenant(r: RegistryTenant & { hero?: import('@nmd/core').StorefrontHero; banners?: import('@nmd/core').StorefrontBanner[] }): Tenant {
  const template = r.templateId ? getTemplate(r.templateId) : null;
  const layoutStyle = template?.layoutStyle ?? r.layoutStyle;
  const type = (r.type === 'CLOTHING' || r.type === 'FOOD') ? r.type : 'GENERAL';
  const t = r as RegistryTenant & { operationalStatus?: 'open' | 'closed' | 'busy'; overrideStatus?: 'AUTO' | 'FORCE_OPEN' | 'FORCE_CLOSED'; orderPolicy?: string; businessHours?: import('@nmd/core').BusinessHours; busyBannerEnabled?: boolean; busyBannerText?: string; storeType?: 'RESTAURANT' | 'PROFESSIONAL'; businessType?: 'RETAIL' | 'RESTAURANT' | 'SERVICE'; about?: string; phone?: string; officeHours?: string; openTime?: string; closeTime?: string; forceClosed?: boolean; appointmentDuration?: number };
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    type,
    storeType: t.storeType ?? 'RESTAURANT',
    businessType: t.businessType,
    about: t.about,
    officeHours: t.officeHours,
    openTime: t.openTime ?? '08:00',
    closeTime: t.closeTime ?? '17:00',
    forceClosed: t.forceClosed ?? false,
    appointmentDuration: t.appointmentDuration,
    marketCategory: r.marketCategory ?? 'GENERAL',
    marketId: r.marketId ?? null,
    paymentCapabilities: r.paymentCapabilities ?? { cash: true, card: false },
    paymentMethods: r.paymentMethods ?? {
      cash: (r.paymentCapabilities?.cash ?? true) !== false,
      card: r.paymentCapabilities?.card === true,
      installments: Boolean((r.paymentCapabilities as { allowInstallments?: boolean } | undefined)?.allowInstallments),
    },
    branding: {
      logoUrl: r.logoUrl ?? '',
      primaryColor: r.primaryColor ?? '#0f766e',
      secondaryColor: r.secondaryColor ?? '#d4a574',
      fontFamily: r.fontFamily ?? '"Cairo", system-ui, sans-serif',
      radiusScale: r.radiusScale ?? 1,
      layoutStyle: layoutStyle as import('@nmd/core').TenantBranding['layoutStyle'],
      hero: normalizeHero(r.hero),
      banners: r.banners ?? [],
      whatsappPhone: r.whatsappPhone,
      phone: t.phone ?? r.whatsappPhone,
      collections: (r as { collections?: import('@nmd/core').HomeCollection[] }).collections ?? [],
    },
    operationalStatus: t.operationalStatus,
    overrideStatus: t.overrideStatus,
    orderPolicy: t.orderPolicy as 'accept_always' | 'accept_only_when_open' | undefined,
    businessHours: t.businessHours,
    busyBannerEnabled: t.busyBannerEnabled,
    busyBannerText: t.busyBannerText,
    categoryId: (r as { categoryId?: string }).categoryId,
  };
}

function resolveTenant(idOrSlug: string): { id: string; tenant: Tenant } | null {
  const byId = getTenantById(idOrSlug);
  if (byId && byId.enabled) {
    return { id: byId.id, tenant: registryToTenant(byId) };
  }
  const bySlug = getTenantBySlug(idOrSlug);
  if (bySlug && bySlug.enabled) {
    return { id: bySlug.id, tenant: registryToTenant(bySlug) };
  }
  return null;
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Public fetch - no auth. For endpoints that don't require JWT (e.g. GET /public/orders/:id). */
async function publicFetch<T>(path: string): Promise<T> {
  const res = await fetch(buildAbsoluteUrl(path), {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    if (res.status === 404) throw new Error('NOT_FOUND');
    throw new Error(`API error: ${res.status}`);
  }
  return res.json();
}

/** Public paths: no JWT required. Storefront guests can access these without login. */
const PUBLIC_PATHS = ['/tenants', '/markets', '/catalog', '/campaigns', '/delivery', '/public', '/auth/login', '/lucky-wheel', '/rewards'];

function isPublicRoute(method: string, path: string): boolean {
  const m = (method ?? 'GET').toUpperCase();
  const pathname = path.split('?')[0];
  if (m === 'GET') {
    return PUBLIC_PATHS.some((prefix) => pathname === prefix || pathname.startsWith(prefix + '/'));
  }
  if (m === 'POST' && (pathname === '/orders' || pathname === '/auth/login' || pathname === '/customer/pricing/quote' || pathname === '/customer/pricing/line' || pathname === '/customer/pricing/cart')) return true;
  return false;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const method = init?.method ?? 'GET';
  const body = mergeEmergencyMeta(init?.body as string | undefined, method);
  const headers = getApiHeaders(path, method, init);
  if (!headers['Authorization'] && MOCK_API_URL && !isPublicRoute(method, path)) {
    console.warn(`[MockApiClient] Protected request to ${path} without token. Ensure you are logged in and token is in localStorage (key: ${TOKEN_KEY}).`);
  }
  const url = buildAbsoluteUrl(path);
  const res = await fetch(url, {
    ...init,
    method,
    body,
    headers,
  });
  if (!res.ok) {
    if (res.status === 404) throw new Error('NOT_FOUND');
    try {
      const err = (await res.json()) as { error?: string; code?: string };
      if (err.code === 'EMERGENCY_MODE_REQUIRED') {
        throw new Error('Emergency mode required');
      }
      throw new Error(err.error ?? `API error: ${res.status}`);
    } catch (e) {
      if (e instanceof Error) throw e;
      throw new Error(`API error: ${res.status}`);
    }
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

/** Upload files to mock-api; returns URLs. Only works when VITE_MOCK_API_URL is set. Requires auth token. */
export async function uploadFiles(files: File[]): Promise<string[]> {
  if (!MOCK_API_URL || files.length === 0) return [];
  const form = new FormData();
  files.forEach((f) => form.append('files', f));
  const token = localStorage.getItem('nmd-access-token');
  if (token) form.append('access_token', token);
  if (typeof window !== 'undefined') {
    console.log('[Client-Debug] Token first 10 chars:', token ? token.slice(0, 10) : 'null');
  }
  if (token === null) {
    throw new Error('Upload blocked: No token found in localStorage');
  }
  const res = await fetch(`${buildAbsoluteUrl('/upload')}?token=${encodeURIComponent(token)}`, {
    method: 'POST',
    body: form,
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include',
  });
  if (!res.ok) {
    if (typeof window !== 'undefined') {
      console.error('[uploadFiles] Upload failed:', res.status, res.statusText, await res.text().catch(() => ''));
    }
    throw new Error(`Upload failed: ${res.status}`);
  }
  const data = (await res.json()) as { urls: string[] };
  return data.urls ?? [];
}

export class MockApiClient implements ApiClient {
  private get useApi(): boolean {
    return !!MOCK_API_URL;
  }

  async getTenant(tenantIdOrSlug: string): Promise<Tenant | null> {
    if (this.useApi) {
      try {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantIdOrSlug);
        const path = isUuid ? `/tenants/by-id/${tenantIdOrSlug}` : `/tenants/by-slug/${tenantIdOrSlug}`;
        const r = await apiFetch<RegistryTenant>(path);
        if (r && r.enabled) return registryToTenant(r);
        return null;
      } catch {
        return null;
      }
    }
    await delay(100);
    const resolved = resolveTenant(tenantIdOrSlug);
    return resolved?.tenant ?? null;
  }

  async getMenu(tenantId: string): Promise<Category[]> {
    if (this.useApi) {
      try {
        const catalog = await apiFetch<{ categories: Category[] }>(`/catalog/${tenantId}`);
        const categories = (catalog?.categories ?? [])
          .filter((c) => (c as Category).isVisible !== false)
          .map((c) => ({ ...c, parentId: (c as Category).parentId ?? null }));
        return [...categories].sort((a, b) => ((a as Category).sortOrder ?? 0) - ((b as Category).sortOrder ?? 0));
      } catch {
        return [];
      }
    }
    await delay(80);
    try {
      const catalog = getCatalog(tenantId);
      const categories = (catalog?.categories ?? []).filter((c) => c.isVisible !== false);
      return [...categories].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    } catch {
      return [];
    }
  }

  async getProduct(tenantId: string, productId: string): Promise<Product | null> {
    if (this.useApi) {
      try {
        const catalog = await apiFetch<{ products: Product[] }>(`/catalog/${tenantId}`);
        const products = catalog?.products ?? [];
        return (products.find((p) => p.id === productId) as Product) ?? null;
      } catch {
        return null;
      }
    }
    await delay(80);
    try {
      const catalog = getCatalog(tenantId);
      const products = catalog?.products ?? [];
      return products.find((p) => p.id === productId) ?? null;
    } catch {
      return null;
    }
  }

  async getProducts(tenantId: string, categoryId?: string, options?: { includeArchived?: boolean }): Promise<Product[]> {
    const includeArchived = options?.includeArchived === true;
    /** Product with optional catalog fields (sortOrder, isArchived) for safe access when fields may be missing from API/store. */
    type ProductWithOrder = Product & { sortOrder?: number; isArchived?: boolean };
    const getSortOrder = (p: ProductWithOrder): number => {
      const v = p.sortOrder;
      return typeof v === 'number' ? v : 999;
    };
    const isProductArchived = (p: ProductWithOrder): boolean => p.isArchived === true;
    const filterAndSort = (list: Product[]) => {
      const safeList: ProductWithOrder[] = Array.isArray(list) ? list.filter((p): p is ProductWithOrder => p != null && typeof p === 'object') : [];
      let out = includeArchived ? safeList : safeList.filter((p) => !isProductArchived(p));
      out = categoryId ? out.filter((p) => p.categoryId === categoryId) : out;
      out = [...out].sort((a, b) => {
        const soA = getSortOrder(a);
        const soB = getSortOrder(b);
        if (soA !== soB) return soA - soB;
        const ca = String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? ''));
        return ca !== 0 ? ca : String(a.name ?? '').localeCompare(String(b.name ?? ''));
      });
      return out;
    };
    if (this.useApi) {
      try {
        const catalog = await apiFetch<{ products: Product[] }>(`/catalog/${tenantId}`);
        const products = (catalog?.products ?? []) as Product[];
        return filterAndSort(products);
      } catch {
        return [];
      }
    }
    await delay(80);
    try {
      const catalog = getCatalog(tenantId);
      const products = (catalog?.products ?? []) as Product[];
      return filterAndSort(products);
    } catch {
      return [];
    }
  }

  async createOrder(tenantId: string, payload: OrderPayload): Promise<Order> {
    const subtotal = payload.items.reduce((sum, item) => sum + item.totalPrice, 0);
    const deliveryFee = payload.delivery?.fee ?? 0;
    const total = subtotal + deliveryFee;
    const order: Order & { orderGroupId?: string } = {
      id: generateId(),
      tenantId,
      status: 'PENDING',
      fulfillmentType: payload.fulfillmentType,
      paymentMethod: payload.paymentMethod,
      items: payload.items,
      subtotal,
      total,
      currency: 'ILS',
      createdAt: new Date().toISOString(),
      notes: payload.notes,
      customerName: payload.customerName,
      customerPhone: payload.customerPhone,
      deliveryAddress: payload.deliveryAddress,
      deliveryLocation: payload.deliveryLocation ?? payload.delivery?.deliveryLocation,
      deliveryAddressSource: payload.deliveryAddressSource,
      delivery: payload.delivery,
    };
    if (payload.orderGroupId) order.orderGroupId = payload.orderGroupId;
    const payloadWithCoupon = payload as { couponId?: string; couponDiscountAmount?: number };
    const orderPayload = order as unknown as Record<string, unknown>;
    if (payloadWithCoupon.couponId) orderPayload.couponId = payloadWithCoupon.couponId;
    if (payloadWithCoupon.couponDiscountAmount != null) orderPayload.couponDiscountAmount = payloadWithCoupon.couponDiscountAmount;
    if (this.useApi) {
      const created = await apiFetch<Order>('/orders', {
        method: 'POST',
        body: JSON.stringify(order),
      });
      return created;
    }
    await delay(150);
    addOrder(order);
    return order;
  }

  async getOrder(orderId: string): Promise<Order | null> {
    if (this.useApi) {
      try {
        return await apiFetch<Order>(`/orders/${orderId}`);
      } catch {
        return null;
      }
    }
    await delay(80);
    return getOrder(orderId);
  }

  /** Public order status - no auth. For storefront success/status pages. */
  async getPublicOrder(orderId: string): Promise<Order | null> {
    if (this.useApi) {
      try {
        return await publicFetch<Order>(`/public/orders/${encodeURIComponent(orderId)}`);
      } catch {
        return null;
      }
    }
    await delay(80);
    return getOrder(orderId);
  }

  /** Customer activity: orders and professional contacts. Requires customer auth. */
  async getCustomerActivity(): Promise<{ orders: Array<Record<string, unknown>>; leads: Array<Record<string, unknown>> }> {
    if (this.useApi) {
      return apiFetch<{ orders: Array<Record<string, unknown>>; leads: Array<Record<string, unknown>> }>('/customer/activity');
    }
    await delay(80);
    return { orders: [], leads: [] };
  }

  /** Validate coupon; returns discount and coupon id if valid. Uses customer token when available. */
  async validateCoupon(params: { code: string; tenantId?: string; cartStoreIds?: string[]; subtotal: number; customerPhone?: string }): Promise<
    | { valid: true; coupon: { id: string; code: string; type: string; value: number; discountAmount: number; storeId?: string } }
    | { valid: false; error: string }
  > {
    if (this.useApi) {
      const q = new URLSearchParams();
      q.set('code', params.code.trim());
      if (params.tenantId) q.set('tenantId', params.tenantId);
      if (params.cartStoreIds?.length) q.set('cartStoreIds', params.cartStoreIds.join(','));
      q.set('subtotal', String(params.subtotal));
      if (params.customerPhone) q.set('customerPhone', params.customerPhone);
      const path = `/coupons/validate?${q.toString()}`;
      try {
        const data = await apiFetch<{ valid: boolean; coupon?: { id: string; code: string; type: string; value: number; discountAmount: number; storeId?: string }; error?: string }>(path);
        return data.valid && data.coupon ? { valid: true, coupon: data.coupon } : { valid: false, error: data.error || 'الكود غير صحيح' };
      } catch (e) {
        const err = e as { message?: string };
        if (err?.message?.includes('401')) throw Object.assign(new Error('UNAUTHORIZED'), { status: 401 });
        throw e;
      }
    }
    await delay(80);
    return { valid: false, error: 'الكود غير صحيح' };
  }

  /** Server-authoritative checkout totals (platform fee hidden in merchandise amount). */
  async quoteCheckoutPricing(params: {
    stores: Array<{ tenantId: string; itemsSubtotal: number; itemCount: number; discountAmount?: number }>;
    deliveryFee?: number;
  }): Promise<{
    customerTotal: number;
    deliveryFee: number;
    displayMerchandiseTotal: number;
    discountAmount: number;
    itemsSubtotal: number;
    platformFeeApplied: boolean;
  }> {
    if (this.useApi) {
      return apiFetch('/customer/pricing/quote', {
        method: 'POST',
        body: JSON.stringify(params),
      });
    }
    const itemsSubtotal = params.stores.reduce((s, st) => s + st.itemsSubtotal, 0);
    const discountAmount = params.stores.reduce((s, st) => s + (st.discountAmount ?? 0), 0);
    const deliveryFee = params.deliveryFee ?? 0;
    const legacyMerchandise = Math.max(0, itemsSubtotal - discountAmount);
    return {
      customerTotal: legacyMerchandise + deliveryFee,
      deliveryFee,
      displayMerchandiseTotal: legacyMerchandise,
      discountAmount,
      itemsSubtotal,
      platformFeeApplied: false,
    };
  }

  /** Customer rewards (winner coupons). Requires customer auth. */
  async getCustomerRewards(): Promise<Array<{ id: string; code: string; type: string; value: number; expiresAt?: string }>> {
    if (this.useApi) {
      return apiFetch<Array<{ id: string; code: string; type: string; value: number; expiresAt?: string }>>('/customer/rewards');
    }
    await delay(80);
    return [];
  }

  /** Spin Lucky Wheel: deduct coins, weighted random, return prize. Requires customer auth. */
  async spinLuckyWheel(): Promise<{
    prizeIndex: number;
    prize: { id: string; label: string; type: string; value: number };
    balance: number;
  }> {
    if (this.useApi) {
      return apiFetch('/customer/lucky-wheel/spin', { method: 'POST' });
    }
    await delay(80);
    throw new Error('API required for spin');
  }

  /** Redeem Lucky Wheel prize. Requires customer auth. PERCENT/FIXED → coupon; COINS → add coins. */
  async redeemLuckyWheelPrize(prize: { id: string; type: string; value?: number }): Promise<
    | { ok: true; type: 'NO_WIN' }
    | { ok: true; type: 'COINS'; balance: number }
    | { ok: true; type: 'COUPON'; code: string }
  > {
    if (this.useApi) {
      return apiFetch('/customer/lucky-wheel/redeem', {
        method: 'POST',
        body: JSON.stringify({
          prizeId: prize.id,
          prizeType: prize.type,
          prizeValue: prize.value ?? 0,
        }),
      });
    }
    await delay(80);
    if (prize.type === 'COINS' && typeof prize.value === 'number' && prize.value > 0) {
      const res = await this.addCustomerCoins(prize.value);
      return { ok: true, type: 'COINS', balance: res.balance };
    }
    return { ok: true, type: 'NO_WIN' };
  }

  /** Admin: List all wheel prizes. Platform admin only. */
  async getAdminWheelPrizes(): Promise<Array<{ id: string; label: string; type: string; value: number; chanceWeight: number; isActive: boolean; sortOrder: number }>> {
    if (this.useApi) {
      return apiFetch<Array<{ id: string; label: string; type: string; value: number; chanceWeight: number; isActive: boolean; sortOrder: number }>>('/admin/wheel-prizes');
    }
    await delay(80);
    return [];
  }

  /** Admin: Create or update wheel prize. Platform admin only. */
  async upsertWheelPrize(body: {
    id?: string;
    label: string;
    type: string;
    value?: number;
    chanceWeight?: number;
    isActive?: boolean;
    sortOrder?: number;
  }): Promise<{ id: string; label: string; type: string; value: number; chanceWeight: number; isActive: boolean; sortOrder: number }> {
    if (this.useApi) {
      return apiFetch('/admin/wheel-prizes', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    }
    throw new Error('API required');
  }

  /** Lucky Wheel prizes. Public - no auth required. */
  async getWheelPrizes(): Promise<Array<{ id: string; label: string; type: string; value: number; chanceWeight: number; isActive: boolean; sortOrder: number }>> {
    if (this.useApi) {
      try {
        return apiFetch<Array<{ id: string; label: string; type: string; value: number; chanceWeight: number; isActive: boolean; sortOrder: number }>>('/lucky-wheel/prizes');
      } catch {
        return [];
      }
    }
    await delay(80);
    return [];
  }

  /** Customer Now Coins (Lucky Wheel). Requires customer auth. */
  async getCustomerCoins(): Promise<{ balance: number; spinCost: number }> {
    if (this.useApi) {
      return apiFetch<{ balance: number; spinCost: number }>('/customer/coins');
    }
    await delay(80);
    return { balance: 50, spinCost: 10 };
  }

  /** Sync coins from localStorage (one-time migration). Requires customer auth. */
  async syncCustomerCoins(localBalance: number): Promise<{ balance: number; synced: boolean }> {
    if (this.useApi) {
      return apiFetch<{ balance: number; synced: boolean }>('/customer/coins/sync', {
        method: 'POST',
        body: JSON.stringify({ balance: localBalance }),
      });
    }
    await delay(80);
    return { balance: localBalance, synced: false };
  }

  /**
   * Add coins (restricted server-side). Customers cannot self-mint; use platform admin JWT,
   * `x-api-key` (API_KEY), or `x-internal-secret` with body `{ phone, amount }`.
   */
  async addCustomerCoins(amount: number, opts?: { phone?: string }): Promise<{ balance: number }> {
    if (this.useApi) {
      return apiFetch<{ balance: number }>('/customer/coins/add', {
        method: 'POST',
        body: JSON.stringify({ amount, phone: opts?.phone }),
      });
    }
    await delay(80);
    return { balance: 50 + amount };
  }

  /** Deduct coins. Requires customer auth. Returns balance or throws on insufficient. */
  async deductCustomerCoins(amount: number): Promise<{ balance: number }> {
    if (this.useApi) {
      return apiFetch<{ balance: number }>('/customer/coins/deduct', {
        method: 'POST',
        body: JSON.stringify({ amount }),
      });
    }
    await delay(80);
    return { balance: 40 };
  }

  /** Public global rewards catalog (GET /rewards). No auth. */
  async listPublicRewards(): Promise<
    Array<{
      id: string;
      title_ar: string;
      title_en: string;
      description?: string;
      image_url?: string;
      type: string;
      coins_cost: number;
      stock_limit: number;
      expiry_date?: string;
      is_active: boolean;
      created_at: string;
      locked?: boolean;
      lock_reason?: 'EXPIRED' | 'SOLD_OUT' | null;
    }>
  > {
    if (this.useApi) {
      return apiFetch('/rewards');
    }
    await delay(80);
    return [];
  }

  /** Redeem a global reward (coins deducted server-side). Requires customer auth. */
  async redeemGlobalReward(rewardId: string): Promise<{ id: string; rewardId: string; status: string; coinsSpent: number; balance: number; redeemedAt: string }> {
    if (this.useApi) {
      return apiFetch(`/customer/rewards/${encodeURIComponent(rewardId)}/redeem`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
    }
    throw new Error('API required');
  }

  /** List coupons (platform admin). */
  async getCoupons(): Promise<Array<{ id: string; code: string; type: string; value: number; tenantId?: string | null; storeId?: string | null; oneTimeUse: boolean; winnerPhone?: string | null; usedAt?: string | null; createdAt: string; expiresAt?: string | null }>> {
    if (this.useApi) {
      return apiFetch<Array<{ id: string; code: string; type: string; value: number; tenantId?: string | null; storeId?: string | null; oneTimeUse: boolean; winnerPhone?: string | null; usedAt?: string | null; createdAt: string; expiresAt?: string | null }>>('/coupons');
    }
    return [];
  }

  /** Create coupon (platform admin). */
  async createCoupon(body: { code: string; type: 'FIXED' | 'PERCENT'; value: number; tenantId?: string; storeId?: string; oneTimeUse?: boolean; winnerPhone?: string; expiresAt?: string }): Promise<{ id: string; code: string; type: string; value: number; tenantId?: string | null; storeId?: string | null; oneTimeUse: boolean; winnerPhone?: string | null; usedAt?: string | null; createdAt: string; expiresAt?: string | null }> {
    if (this.useApi) {
      return apiFetch<{ id: string; code: string; type: string; value: number; tenantId?: string | null; storeId?: string | null; oneTimeUse: boolean; winnerPhone?: string | null; usedAt?: string | null; createdAt: string; expiresAt?: string | null }>('/coupons', { method: 'POST', body: JSON.stringify(body) });
    }
    throw new Error('API required');
  }

  async getCampaigns(tenantId: string): Promise<Campaign[]> {
    if (this.useApi) {
      try {
        return await apiFetch<Campaign[]>(`/campaigns?tenantId=${encodeURIComponent(tenantId)}`);
      } catch {
        return [];
      }
    }
    await delay(80);
    return listCampaigns(tenantId);
  }

  async getDeliverySettings(tenantId: string): Promise<DeliverySettings | null> {
    if (this.useApi) {
      try {
        return await apiFetch<DeliverySettings | null>(`/delivery/${tenantId}`);
      } catch {
        return null;
      }
    }
    await delay(80);
    return getDeliverySettingsStore(tenantId);
  }

  async getDeliveryZones(tenantId: string): Promise<DeliveryZone[]> {
    if (this.useApi) {
      try {
        return await apiFetch<DeliveryZone[]>(`/tenants/${tenantId}/delivery-zones`);
      } catch {
        return [];
      }
    }
    await delay(80);
    const zones = getDeliveryZonesStore(tenantId);
    if (zones.length > 0) return zones;
    const settings = getDeliverySettingsStore(tenantId);
    const legacy = settings?.zones ?? [];
    return legacy.map((z) => ({
      id: (z as { id?: string }).id ?? `legacy-${z.name}`,
      tenantId,
      name: z.name,
      fee: z.fee,
      etaMinutes: (z as { etaMinutes?: number }).etaMinutes,
      isActive: ((z as { enabled?: boolean }).enabled ?? (z as { isActive?: boolean }).isActive ?? true),
      sortOrder: (z as { sortOrder?: number }).sortOrder,
    }));
  }

  async getOptionGroups(tenantId: string) {
    if (this.useApi) {
      try {
        const catalog = await apiFetch<{ optionGroups: unknown[] }>(`/catalog/${tenantId}`);
        return (catalog?.optionGroups ?? []) as Awaited<ReturnType<ApiClient['getOptionGroups']>>;
      } catch {
        return [];
      }
    }
    await delay(80);
    return listOptionGroups(tenantId);
  }

  async getOptionItems(tenantId: string, groupId: string): Promise<OptionItem[]> {
    if (this.useApi) {
      try {
        const catalog = await apiFetch<{ optionGroups: { id: string; items?: OptionItem[] }[] }>(`/catalog/${tenantId}`);
        const groups = catalog?.optionGroups ?? [];
        const g = groups.find((x) => x.id === groupId);
        return g?.items ?? [];
      } catch {
        return [];
      }
    }
    await delay(80);
    return listOptionItemsByGroup(tenantId, groupId);
  }

  /** Option templates (reusable library) for "Add from Templates" in product form. */
  async getOptionTemplates(tenantId: string): Promise<OptionGroup[]> {
    if (this.useApi) {
      try {
        return (await apiFetch<unknown[]>(`/tenants/${tenantId}/option-templates`)) as OptionGroup[];
      } catch {
        return [];
      }
    }
    return listOptionGroups(tenantId) as OptionGroup[];
  }

  /** Save an option group to the templates library (and catalog). Used by Options generator. */
  async addOptionTemplate(tenantId: string, group: OptionGroup): Promise<void> {
    if (this.useApi) {
      await apiFetch(`/tenants/${tenantId}/option-templates`, {
        method: 'POST',
        body: JSON.stringify(group),
      });
      return;
    }
    const { upsertOptionGroup } = await import('./catalog-store');
    upsertOptionGroup(tenantId, group);
  }

  // --- Admin/OS Control API (used by nmd-admin, admin) ---
  async getMe(): Promise<{ id: string; email: string; role: string; marketId?: string; tenantId?: string; mustChangePassword?: boolean } | null> {
    if (!this.useApi) return { id: 'local', email: 'local@dev', role: 'ROOT_ADMIN' };
    try {
      return await apiFetch<{ id: string; email: string; role: string; marketId?: string; tenantId?: string; mustChangePassword?: boolean }>('/auth/me');
    } catch {
      return null;
    }
  }

  /** Change password (self-service). Requires auth. Uses Authorization header. */
  async changePassword(currentPassword: string, newPassword: string): Promise<{ ok: boolean }> {
    if (!this.useApi) throw new Error('Change password requires API');
    return apiFetch<{ ok: boolean }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  /** ROOT_ADMIN only: List all users (passwords omitted). */
  async listUsers(): Promise<{ id: string; email: string; role: string; tenantId?: string; marketId?: string }[]> {
    if (!this.useApi) return [];
    return apiFetch<{ id: string; email: string; role: string; tenantId?: string; marketId?: string }[]>('/users');
  }

  /** ROOT_ADMIN: Reset any user. MARKET_ADMIN: Reset tenant admins in their market only. */
  async resetUserPassword(userId: string, newPassword: string): Promise<{ ok: boolean }> {
    if (!this.useApi) throw new Error('Reset password requires API');
    return apiFetch<{ ok: boolean }>(`/admin/users/${userId}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ newPassword }),
    });
  }

  /** MARKET_ADMIN: List tenant admins for a market. ROOT_ADMIN: any market. */
  async listTenantAdminsForMarket(marketId: string): Promise<{ id: string; email: string; role: string; tenantId?: string }[]> {
    if (!this.useApi) return [];
    return apiFetch<{ id: string; email: string; role: string; tenantId?: string }[]>(
      `/markets/${marketId}/tenant-admins`
    );
  }

  /** Get tenant admin for a specific tenant. ROOT_ADMIN: any. MARKET_ADMIN: only tenants in their market. */
  async getTenantAdmin(tenantId: string): Promise<{ id: string; email: string; role: string; tenantId?: string } | null> {
    if (!this.useApi) return null;
    try {
      return await apiFetch<{ id: string; email: string; role: string; tenantId?: string }>(
        `/tenants/${tenantId}/tenant-admin`
      );
    } catch {
      return null;
    }
  }

  /** List leads (ROOT_ADMIN: all; MARKET_ADMIN: market tenants; TENANT_ADMIN: own tenant). Pass tenantSlug for store admin to filter by tenant. */
  async listLeads(
    tenantSlug?: string,
    options?: { scope?: 'delivery' }
  ): Promise<{ id: string; tenantId: string; type: string; timestamp: string; metadata?: Record<string, unknown>; status?: string; contactType?: string }[]> {
    if (!this.useApi) return [];
    const params = new URLSearchParams();
    if (tenantSlug) params.set('tenantSlug', tenantSlug);
    if (options?.scope) params.set('scope', options.scope);
    const q = params.toString() ? `?${params.toString()}` : '';
    return apiFetch<{ id: string; tenantId: string; type: string; timestamp: string; metadata?: Record<string, unknown>; status?: string; contactType?: string }[]>(`/leads${q}`);
  }

  /** List customers (ROOT_ADMIN: all; TENANT_ADMIN: only those who interacted with their tenant; MARKET_ADMIN: their market). */
  async listCustomers(tenantSlug?: string): Promise<{
    id: string;
    phone: string;
    name?: string;
    email?: string;
    createdAt?: string;
    lastActivityAt?: string;
  }[]> {
    if (!this.useApi) return [];
    const q = tenantSlug ? `?tenantSlug=${encodeURIComponent(tenantSlug)}` : '';
    return apiFetch<{
      id: string;
      phone: string;
      name?: string;
      email?: string;
      createdAt?: string;
      lastActivityAt?: string;
    }[]>(`/customers${q}`);
  }

  /** Create TENANT_ADMIN for an existing tenant (legacy stores). */
  async createTenantAdminForTenant(
    tenantId: string,
    input: { email: string; password: string }
  ): Promise<{ id: string; email: string; role: string; tenantId: string }> {
    if (!this.useApi) throw new Error('Create tenant admin requires API');
    return apiFetch<{ id: string; email: string; role: string; tenantId: string }>(
      `/tenants/${tenantId}/create-admin`,
      {
        method: 'POST',
        body: JSON.stringify(input),
      }
    );
  }

  async listTenants(): Promise<RegistryTenant[]> {
    if (this.useApi) {
      return apiFetch<RegistryTenant[]>('/tenants');
    }
    const { listTenants: lt } = await import('./tenant-registry');
    return lt();
  }

  async createTenant(input: Omit<RegistryTenant, 'id' | 'createdAt'>): Promise<RegistryTenant> {
    if (this.useApi) {
      return apiFetch<RegistryTenant>('/tenants', {
        method: 'POST',
        body: JSON.stringify(input),
      });
    }
    const { createTenant: ct } = await import('./tenant-registry');
    return ct(input);
  }

  /** Create tenant scoped to a market. Uses POST /markets/:marketId/tenants. */
  async createTenantForMarket(
    marketId: string,
    input: Omit<RegistryTenant, 'id' | 'createdAt' | 'marketId'> & { adminEmail?: string; adminPassword?: string }
  ): Promise<RegistryTenant> {
    if (this.useApi) {
      return apiFetch<RegistryTenant>(`/markets/${marketId}/tenants`, {
        method: 'POST',
        body: JSON.stringify(input),
      });
    }
    const { createTenant: ct } = await import('./tenant-registry');
    return ct({ ...input, marketId });
  }

  async updateTenant(id: string, updates: Partial<Omit<RegistryTenant, 'id' | 'createdAt'>>): Promise<RegistryTenant | null> {
    if (this.useApi) {
      const res = await apiFetch<RegistryTenant>(`/tenants/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
      return res;
    }
    const { updateTenant: ut } = await import('./tenant-registry');
    return ut(id, updates);
  }

  async toggleTenant(id: string): Promise<RegistryTenant | null> {
    if (this.useApi) {
      try {
        return await apiFetch<RegistryTenant>(`/tenants/${id}/toggle`, { method: 'POST' });
      } catch {
        return null;
      }
    }
    const { toggleTenant: tt } = await import('./tenant-registry');
    return tt(id);
  }

  async deleteTenant(id: string): Promise<void> {
    if (this.useApi) {
      await apiFetch(`/tenants/${id}`, { method: 'DELETE' });
      return;
    }
    const { deleteTenant: dt } = await import('./tenant-registry');
    return dt(id);
  }

  async getTenantById(id: string): Promise<RegistryTenant | null> {
    if (this.useApi) {
      try {
        return await apiFetch<RegistryTenant>(`/tenants/by-id/${id}`);
      } catch {
        return null;
      }
    }
    return getTenantById(id);
  }

  async getTenantBySlug(slug: string): Promise<RegistryTenant | null> {
    if (this.useApi) {
      try {
        return await apiFetch<RegistryTenant>(`/tenants/by-slug/${slug}`);
      } catch {
        return null;
      }
    }
    return getTenantBySlug(slug);
  }

  /** PATCH tenant delivery settings (tenantType, deliveryProviderMode, allowMarketCourierFallback, defaultPrepTimeMin) */
  async patchTenantDeliverySettings(
    tenantId: string,
    settings: { tenantType?: string; deliveryProviderMode?: string; allowMarketCourierFallback?: boolean; defaultPrepTimeMin?: number }
  ): Promise<RegistryTenant> {
    return apiFetch<RegistryTenant>(`/tenants/${tenantId}/settings/delivery`, {
      method: 'PATCH',
      body: JSON.stringify(settings),
    });
  }

  /** Mark order as READY (restaurant) */
  async markOrderReady(tenantId: string, orderId: string): Promise<Order> {
    return apiFetch<Order>(`/tenants/${tenantId}/orders/${orderId}/ready`, {
      method: 'POST',
    });
  }

  /** Merchant marks order as handed to driver (sync point for courier "Start Delivery"). */
  async markOrderHandedToDriver(tenantId: string, orderId: string): Promise<Order> {
    return apiFetch<Order>(`/tenants/${tenantId}/orders/${orderId}/handed-to-driver`, {
      method: 'POST',
    });
  }

  /** Market couriers */
  async getMarketCouriers(marketId: string): Promise<MarketCourier[]> {
    return apiFetch<MarketCourier[]>(`/markets/${marketId}/couriers`);
  }

  /** Market couriers with performance stats (deliveredCountToday, deliveredCountWeek, avgTotalMin, avgPickupToDeliveredMin, onTimeRate) */
  async getMarketCourierStats(marketId: string): Promise<MarketCourierWithStats[]> {
    return apiFetch<MarketCourierWithStats[]>(`/markets/${marketId}/couriers/stats`);
  }

  /** Weekly leaderboard. Returns { leaderboard, myRank }. */
  async getMarketLeaderboard(marketId: string, period = 'week'): Promise<{
    leaderboard: { courierId: string; name: string; pointsWeek: number; badgesWeek: string[]; avgTotalMin: number | null; onTimeRate: number | null; rank: number }[];
    myRank: number | null;
  }> {
    return apiFetch(`/markets/${marketId}/leaderboard?period=${period}`);
  }

  async createMarketCourier(marketId: string, data: { name?: string; email?: string; phone?: string; password?: string; allowedStoreIds?: string[] }): Promise<MarketCourier> {
    return apiFetch<MarketCourier>(`/markets/${marketId}/couriers`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async patchMarketCourier(
    marketId: string,
    courierId: string,
    updates: { name?: string; email?: string; phone?: string; isActive?: boolean; isOnline?: boolean; isAvailable?: boolean; capacity?: number; allowedStoreIds?: string[] }
  ): Promise<MarketCourier> {
    return apiFetch<MarketCourier>(`/markets/${marketId}/couriers/${courierId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async deleteMarketCourier(marketId: string, courierId: string, cascade = false): Promise<MarketCourier & { cascade?: boolean }> {
    const q = cascade ? '?cascade=true' : '';
    return apiFetch<MarketCourier & { cascade?: boolean }>(`/markets/${marketId}/couriers/${courierId}${q}`, {
      method: 'DELETE',
    });
  }

  async changeMarketCourierPassword(marketId: string, courierId: string, newPassword: string): Promise<{ ok: boolean }> {
    return apiFetch<{ ok: boolean }>(`/markets/${marketId}/couriers/${courierId}/change-password`, {
      method: 'POST',
      body: JSON.stringify({ newPassword }),
    });
  }

  async getMarketCourierFinancialStats(
    marketId: string,
    courierId: string,
    from?: string,
    to?: string
  ): Promise<{ courierId: string; marketId: string; from: string | null; to: string | null; appRevenue: number; externalRevenue: number; expenses: number; net: number }> {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const q = params.toString() ? `?${params.toString()}` : '';
    return apiFetch(`/markets/${marketId}/couriers/${courierId}/stats${q}`);
  }

  /** Market finance summary. Aggregates orders in date range. */
  async getMarketFinanceSummary(marketId: string, from?: string, to?: string): Promise<{
    gross: number;
    itemsTotal: number;
    deliveryFees: number;
    commission: number;
    netToMerchants: number;
    cashCollected: number;
    outstandingCash: number;
    totalOrders: number;
    deliveredOrders: number;
    activeDeliveryOrders: number;
    cashOrders: number;
  }> {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const q = params.toString() ? `?${params}` : '';
    return apiFetch(`/markets/${marketId}/finance/summary${q}`);
  }

  /** Market finance by tenant. */
  async getMarketFinanceTenants(marketId: string, from?: string, to?: string): Promise<{
    tenantId: string;
    tenantName: string;
    gross: number;
    itemsTotal: number;
    deliveryFees: number;
    commission: number;
    netToMerchant: number;
    orderCount: number;
    deliveredCount: number;
  }[]> {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const q = params.toString() ? `?${params}` : '';
    return apiFetch(`/markets/${marketId}/finance/tenants${q}`);
  }

  /** Market finance by courier. */
  async getMarketFinanceCouriers(marketId: string, from?: string, to?: string): Promise<{
    courierId: string;
    courierName: string;
    deliveredCount: number;
    cashCollectedGross: number;
    outstandingGross: number;
    activeUncollectedGross: number;
  }[]> {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const q = params.toString() ? `?${params}` : '';
    return apiFetch(`/markets/${marketId}/finance/couriers${q}`);
  }

  /** Reports: daily summary (orders, revenue, cash flow). */
  async getReportsDailySummary(marketId: string, from?: string, to?: string): Promise<{
    totalOrders: number;
    deliveryOrders: number;
    pickupOrders: number;
    totalRevenue: number;
    totalMerchantSales: number;
    totalDeliveryFees: number;
    dailyCashFlow: number;
  }> {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const q = params.toString() ? `?${params}` : '';
    return apiFetch(`/markets/${marketId}/reports/daily-summary${q}`);
  }

  /** Reports: merchant performance (per-store orders and sales). */
  async getReportsMerchantPerformance(marketId: string, from?: string, to?: string): Promise<{
    tenantId: string;
    tenantName: string;
    orderCount: number;
    sales: number;
    deliveryFees: number;
  }[]> {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const q = params.toString() ? `?${params}` : '';
    return apiFetch(`/markets/${marketId}/reports/merchant-performance${q}`);
  }

  /** Reports: driver leaderboard (ranked by delivery count). */
  async getReportsDriverLeaderboard(marketId: string, from?: string, to?: string): Promise<{
    courierId: string;
    courierName: string;
    phone?: string;
    deliveryCount: number;
    initialFloat: number;
    totalCashCollected: number;
    rank: number;
  }[]> {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const q = params.toString() ? `?${params}` : '';
    return apiFetch(`/markets/${marketId}/reports/driver-leaderboard${q}`);
  }

  /** Reports: settlement log (driver Coba handover history). */
  async getReportsSettlementLog(marketId: string): Promise<{
    id: string;
    courierId: string;
    courierName?: string;
    adminId: string;
    totalCollected: number;
    timestamp: string;
    marketId?: string;
  }[]> {
    return apiFetch(`/markets/${marketId}/reports/settlement-log`);
  }

  /** Shift settlement: log driver handover (total collected). Admin only. */
  async settleCourier(courierId: string, totalCollected: number): Promise<{ id: string; courierId: string; adminId: string; totalCollected: number; timestamp: string; marketId?: string }> {
    return apiFetch(`/admin/couriers/${encodeURIComponent(courierId)}/settle`, {
      method: 'POST',
      body: JSON.stringify({ totalCollected }),
    });
  }

  /** All orders for a market (from tenants in that market). For market admin orders/dispatch views. */
  async getMarketOrders(marketId: string): Promise<Order[]> {
    if (this.useApi) {
      return apiFetch<Order[]>(`/markets/${marketId}/orders`);
    }
    const { listOrdersByTenant } = await import('./orders-store');
    const { listTenants } = await import('./tenant-registry');
    const tenantIds = listTenants().filter((t) => (t as { marketId?: string }).marketId === marketId).map((t) => t.id);
    const all: Order[] = [];
    for (const tid of tenantIds) {
      const orders = listOrdersByTenant(tid);
      all.push(...orders);
    }
    return all;
  }

  /** Dispatch queue (orders eligible for market courier, not yet assigned) */
  async getDispatchQueue(marketId: string): Promise<Order[]> {
    return apiFetch<Order[]>(`/markets/${marketId}/dispatch/queue`);
  }

  /** Assign courier to a MARKET delivery order. Use reassign: true when changing courier on already-assigned order. */
  async assignCourierToOrder(marketId: string, orderId: string, courierId: string, reassign?: boolean): Promise<Order> {
    return apiFetch<Order>(`/markets/${marketId}/orders/${encodeURIComponent(orderId)}/assign-courier`, {
      method: 'POST',
      body: JSON.stringify({ courierId, reassign }),
    });
  }

  /** Unassign courier from a MARKET delivery order. */
  async unassignCourierFromOrder(marketId: string, orderId: string): Promise<Order> {
    return apiFetch<Order>(`/markets/${marketId}/orders/${encodeURIComponent(orderId)}/assign-courier`, {
      method: 'DELETE',
    });
  }

  /** Log contact for an order (e.g. WhatsApp message). Appends to contactLog.entries. */
  async logOrderContact(marketId: string, orderId: string, message?: string): Promise<Order> {
    return apiFetch<Order>(`/markets/${marketId}/orders/${encodeURIComponent(orderId)}/contact`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  }

  /** Delivery jobs */
  async getDeliveryJobs(marketId: string): Promise<{ id: string; marketId: string; courierId?: string; status: string; items: { orderId: string; tenantId: string }[] }[]> {
    return apiFetch(`/markets/${marketId}/delivery-jobs`);
  }

  async createDeliveryJob(marketId: string, items: { orderId: string; tenantId: string }[]): Promise<{ id: string; status: string; items: unknown[] }> {
    return apiFetch(`/markets/${marketId}/delivery-jobs`, {
      method: 'POST',
      body: JSON.stringify({ items }),
    });
  }

  async assignDeliveryJob(marketId: string, jobId: string, courierId: string): Promise<unknown> {
    return apiFetch(`/markets/${marketId}/delivery-jobs/${jobId}/assign`, {
      method: 'PATCH',
      body: JSON.stringify({ courierId }),
    });
  }

  async getCatalogApi(tenantId: string): Promise<{ categories: Category[]; products: Product[]; optionGroups: unknown[]; optionItems: unknown[] }> {
    if (this.useApi) {
      return apiFetch(`/catalog/${tenantId}`);
    }
    const cat = getCatalog(tenantId);
    const sortByOrder = (a: { sortOrder?: number }, b: { sortOrder?: number }) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    return {
      ...cat,
      categories: [...(cat.categories ?? [])].sort(sortByOrder),
      products: [...(cat.products ?? [])].sort(sortByOrder),
    };
  }

  async setCatalogApi(tenantId: string, catalog: { categories: Category[]; products: Product[]; optionGroups: unknown[]; optionItems?: unknown[] }): Promise<void> {
    if (this.useApi) {
      await apiFetch(`/catalog/${tenantId}`, {
        method: 'PUT',
        body: JSON.stringify({
          categories: catalog.categories ?? [],
          products: catalog.products ?? [],
          optionGroups: catalog.optionGroups ?? [],
          optionItems: catalog.optionItems ?? [],
        }),
      });
      return;
    }
    const { setCatalog: sc } = await import('./catalog-store');
    sc(tenantId, {
      categories: catalog.categories ?? [],
      products: catalog.products ?? [],
      optionGroups: (catalog.optionGroups ?? []) as OptionGroup[],
      optionItems: (catalog.optionItems ?? []) as OptionItem[],
    });
  }

  async bulkSortCatalog(
    tenantId: string,
    entity: 'categories' | 'products',
    items: { id: string; sortOrder: number }[]
  ): Promise<{ categories: Category[]; products: Product[]; optionGroups: unknown[]; optionItems: unknown[] }> {
    if (this.useApi) {
      return apiFetch(`/bulk-sort`, {
        method: 'POST',
        body: JSON.stringify({ entity, tenantId, items }),
      });
    }
    const cat = getCatalog(tenantId);
    const orderMap = new Map(items.map((i) => [i.id, i.sortOrder]));
    if (entity === 'categories') {
      const categories = (cat.categories ?? []).map((c): Category => {
        const so = orderMap.get(c.id);
        return so !== undefined ? { ...c, sortOrder: so } : c;
      });
      const { setCatalog: sc } = await import('./catalog-store');
      sc(tenantId, { ...cat, categories });
      return { ...getCatalog(tenantId) };
    }
    const products = (cat.products ?? []).map((p): Product => {
      const so = orderMap.get(p.id);
      return so !== undefined ? { ...p, sortOrder: so } : p;
    });
    const { setCatalog: sc } = await import('./catalog-store');
    sc(tenantId, { ...cat, products });
    return { ...getCatalog(tenantId) };
  }

  async listOrdersByTenant(
    tenantId: string,
    options?: { from?: string; to?: string; search?: string; paymentMethod?: 'ALL' | 'CASH' | 'CARD' }
  ): Promise<Order[]> {
    if (this.useApi) {
      const params = new URLSearchParams();
      if (options?.from) params.set('from', options.from);
      if (options?.to) params.set('to', options.to);
      if (options?.search?.trim()) params.set('search', options.search.trim());
      if (options?.paymentMethod && options.paymentMethod !== 'ALL') {
        params.set('paymentMethod', options.paymentMethod);
      }
      const qs = params.toString();
      const url = `/tenants/${encodeURIComponent(tenantId)}/orders` + (qs ? `?${qs}` : '');
      return apiFetch<Order[]>(url);
    }
    const { listOrdersByTenant: lot } = await import('./orders-store');
    let rows = lot(tenantId) as unknown as Record<string, unknown>[];
    const pm = options?.paymentMethod;
    if (pm && pm !== 'ALL') {
      const { orderPaymentChannel } = await import('./merchant-stats-local');
      rows = rows.filter((o) => {
        const ch = orderPaymentChannel(o);
        if (pm === 'CASH') return ch === 'CASH';
        if (pm === 'CARD') return ch === 'CARD';
        return true;
      });
    }
    return rows as unknown as Order[];
  }

  async getMerchantStats(
    tenantId: string,
    timeRange: 'day' | 'week' | 'month' = 'day'
  ): Promise<MerchantStatsPayload> {
    if (this.useApi) {
      return apiFetch<MerchantStatsPayload>(`/merchant/stats?timeRange=${encodeURIComponent(timeRange)}`);
    }
    const { listOrdersByTenant: lot } = await import('./orders-store');
    const { aggregateMerchantStats } = await import('./merchant-stats-local');
    const orders = lot(tenantId) as unknown as Record<string, unknown>[];
    return aggregateMerchantStats(orders, timeRange);
  }

  async getCategoryPolicies(): Promise<CategoryPolicy[]> {
    if (this.useApi) {
      return apiFetch<CategoryPolicy[]>('/category-policies');
    }
    return [
      { id: 'cat-sla-food', name: 'طعام / حلويات', greenMs: 3 * 60 * 1000, orangeMs: 5 * 60 * 1000, redMs: 6 * 60 * 1000, isUrgent: true },
      { id: 'cat-sla-general', name: 'عام', greenMs: 10 * 60 * 1000, orangeMs: 15 * 60 * 1000, redMs: 20 * 60 * 1000, isUrgent: false },
    ];
  }

  async updateCategoryPolicy(
    id: string,
    payload: { name?: string; greenMs?: number; orangeMs?: number; redMs?: number; isUrgent?: boolean }
  ): Promise<CategoryPolicy> {
    if (this.useApi) {
      return apiFetch<CategoryPolicy>(`/category-policies/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) });
    }
    const policies = await this.getCategoryPolicies();
    const idx = policies.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error('Category policy not found');
    policies[idx] = { ...policies[idx], ...payload };
    return policies[idx];
  }

  async getTenantDashboardStats(
    tenantId: string,
    options?: { from?: string; to?: string }
  ): Promise<{
    dailyRevenue: number;
    monthlyRevenue: number;
    orderCountToday: number;
    orderCountMonth: number;
    totalSales: number;
    platformFee: number;
    merchantBalance: number;
    platformCommissionPercent: number;
  }> {
    if (this.useApi) {
      const params = new URLSearchParams();
      if (options?.from) params.set('from', options.from);
      if (options?.to) params.set('to', options.to);
      const qs = params.toString();
      const url = `/tenants/${encodeURIComponent(tenantId)}/dashboard-stats` + (qs ? `?${qs}` : '');
      return apiFetch(url);
    }
    const { listOrdersByTenant: lot } = await import('./orders-store');
    const orders = lot(tenantId);
    const completed = orders.filter((o) => (o as { status?: string }).status === 'DELIVERED' || (o as { status?: string }).status === 'COMPLETED');
    const nonCancelled = orders.filter((o) => (o as { status?: string }).status !== 'CANCELLED');
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().slice(0, 10);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
    const toMs = (d: string) => new Date(d).setHours(23, 59, 59, 999);
    const fromMs = (d: string) => new Date(d).setHours(0, 0, 0, 0);
    const ordersToday = completed.filter((o) => {
      const t = o.createdAt ? new Date(o.createdAt).getTime() : 0;
      return t >= fromMs(todayStart) && t <= toMs(todayStart);
    });
    const ordersMonth = completed.filter((o) => {
      const t = o.createdAt ? new Date(o.createdAt).getTime() : 0;
      return t >= fromMs(monthStart) && t <= toMs(monthEnd);
    });
    const sum = (arr: { total?: number }[]) => arr.reduce((s, o) => s + (Number(o.total) || 0), 0);
    const dailyRevenue = sum(ordersToday);
    const monthlyRevenue = sum(ordersMonth);
    const totalSales = sum(nonCancelled);
    const tenant = getTenantById(tenantId) as { financialConfig?: { commissionValue?: number } } | null;
    const commissionPercent = tenant?.financialConfig?.commissionValue ?? 0;
    const platformFee = Math.round(totalSales * (commissionPercent / 100) * 100) / 100;
    const merchantBalance = Math.round((totalSales - platformFee) * 100) / 100;
    return {
      dailyRevenue,
      monthlyRevenue,
      orderCountToday: ordersToday.length,
      orderCountMonth: ordersMonth.length,
      totalSales,
      platformFee,
      merchantBalance,
      platformCommissionPercent: commissionPercent,
    };
  }

  async getTenantSettlementSummary(
    tenantId: string,
    preset: string = 'month'
  ): Promise<{
    period: { from: string; to: string };
    pickupCommissionOwed: number;
    paymentsMade: number;
    remainingBalance: number;
    currency: string;
  }> {
    if (this.useApi) {
      return apiFetch(
        `/tenants/${encodeURIComponent(tenantId)}/settlement/summary?preset=${encodeURIComponent(preset)}`
      );
    }
    return {
      period: { from: '', to: '' },
      pickupCommissionOwed: 0,
      paymentsMade: 0,
      remainingBalance: 0,
      currency: 'ILS',
    };
  }

  async getTenantSettlementLedger(
    tenantId: string,
    preset: string = 'month'
  ): Promise<Array<{ entryType: string; amount: number; occurredAt: string; note?: string }>> {
    if (this.useApi) {
      return apiFetch(
        `/tenants/${encodeURIComponent(tenantId)}/settlement/ledger?preset=${encodeURIComponent(preset)}`
      );
    }
    return [];
  }

  async updateOrderStatus(orderId: string, status: Order['status']): Promise<Order | null> {
    if (this.useApi) {
      try {
        return await apiFetch<Order>(`/orders/${orderId}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status }),
        });
      } catch {
        return null;
      }
    }
    const { updateOrderStatus: uos } = await import('./orders-store');
    return uos(orderId, status);
  }

  /** Manually trigger loyalty coin award for an order (mock-api POST). Requires useApi + auth. */
  async forceLoyaltyAwardOrder(orderId: string): Promise<unknown> {
    if (!this.useApi) {
      throw new Error('forceLoyaltyAwardOrder requires VITE_MOCK_API_URL (remote API)');
    }
    return apiFetch<unknown>(`/orders/${encodeURIComponent(orderId)}/loyalty-force-award`, {
      method: 'POST',
    });
  }

  /** Hard delete order (SUPER_ADMIN only). Requires useApi. */
  async hardDeleteOrder(orderId: string): Promise<void> {
    if (!this.useApi) return;
    await apiFetch(`/orders/${encodeURIComponent(orderId)}/hard-delete`, { method: 'DELETE' });
  }

  async listCampaignsApi(tenantId: string): Promise<unknown[]> {
    if (this.useApi) {
      return apiFetch<unknown[]>(`/campaigns?tenantId=${encodeURIComponent(tenantId)}`);
    }
    return listCampaigns(tenantId);
  }

  async getDeliverySettingsApi(tenantId: string): Promise<unknown | null> {
    if (this.useApi) {
      try {
        return await apiFetch<unknown>(`/delivery/${tenantId}`);
      } catch {
        return null;
      }
    }
    return getDeliverySettingsStore(tenantId);
  }

  async saveDeliverySettingsApi(tenantId: string, settings: unknown): Promise<void> {
    if (this.useApi) {
      await apiFetch(`/delivery/${tenantId}`, {
        method: 'PUT',
        body: JSON.stringify(settings),
      });
      return;
    }
    const { saveDeliverySettings } = await import('./delivery-store');
    saveDeliverySettings(tenantId, settings as Parameters<typeof saveDeliverySettings>[1]);
  }

  async listDeliveryZonesApi(tenantId: string): Promise<DeliveryZone[]> {
    return this.getDeliveryZones(tenantId);
  }

  async createDeliveryZoneApi(tenantId: string, zone: Omit<DeliveryZone, 'id' | 'tenantId'>): Promise<DeliveryZone> {
    if (this.useApi) {
      return apiFetch<DeliveryZone>(`/tenants/${tenantId}/delivery-zones`, {
        method: 'POST',
        body: JSON.stringify(zone),
      });
    }
    const { getDeliveryZones, setDeliveryZones } = await import('./delivery-zones-store');
    const id = generateId();
    const newZone: DeliveryZone = { ...zone, id, tenantId };
    const zones = [...getDeliveryZones(tenantId), newZone];
    setDeliveryZones(tenantId, zones);
    return newZone;
  }

  async updateDeliveryZoneApi(tenantId: string, zoneId: string, updates: Partial<Omit<DeliveryZone, 'id' | 'tenantId'>>): Promise<DeliveryZone | null> {
    if (this.useApi) {
      try {
        return await apiFetch<DeliveryZone>(`/tenants/${tenantId}/delivery-zones/${zoneId}`, {
          method: 'PUT',
          body: JSON.stringify(updates),
        });
      } catch {
        return null;
      }
    }
    const { getDeliveryZones, setDeliveryZones } = await import('./delivery-zones-store');
    const zones = getDeliveryZones(tenantId);
    const idx = zones.findIndex((z) => z.id === zoneId);
    if (idx === -1) return null;
    zones[idx] = { ...zones[idx], ...updates };
    setDeliveryZones(tenantId, zones);
    return zones[idx];
  }

  async patchDeliveryZoneApi(tenantId: string, zoneId: string, updates: Partial<Pick<DeliveryZone, 'isActive' | 'name' | 'fee' | 'etaMinutes' | 'sortOrder' | 'centerLat' | 'centerLng' | 'radiusKm'>>): Promise<DeliveryZone | null> {
    if (this.useApi) {
      try {
        return await apiFetch<DeliveryZone>(`/tenants/${tenantId}/delivery-zones/${zoneId}`, {
          method: 'PATCH',
          body: JSON.stringify(updates),
        });
      } catch {
        return null;
      }
    }
    return this.updateDeliveryZoneApi(tenantId, zoneId, updates);
  }

  async deleteDeliveryZoneApi(tenantId: string, zoneId: string): Promise<boolean> {
    if (this.useApi) {
      try {
        await apiFetch(`/tenants/${tenantId}/delivery-zones/${zoneId}`, { method: 'DELETE' });
        return true;
      } catch {
        return false;
      }
    }
    const { getDeliveryZones, setDeliveryZones } = await import('./delivery-zones-store');
    const zones = getDeliveryZones(tenantId).filter((z) => z.id !== zoneId);
    if (zones.length === getDeliveryZones(tenantId).length) return false;
    setDeliveryZones(tenantId, zones);
    return true;
  }

  /** Sync current store's delivery zones to all other stores in the same market. Only when using API. */
  async syncMarketDeliveryApi(marketId: string, sourceTenantId: string): Promise<{ synced: number; tenantIds: string[] }> {
    if (this.useApi) {
      const res = await apiFetch<{ synced: number; tenantIds: string[] }>(`/markets/${marketId}/sync-delivery`, {
        method: 'POST',
        body: JSON.stringify({ sourceTenantId }),
      });
      return res;
    }
    return { synced: 0, tenantIds: [] };
  }

  /** Update homepage collections (admin-controlled sections). */
  async updateCollectionsApi(tenantId: string, collections: import('@nmd/core').HomeCollection[]): Promise<void> {
    if (this.useApi) {
      await apiFetch(`/tenants/${tenantId}/collections`, {
        method: 'PUT',
        body: JSON.stringify({ collections }),
      });
      return;
    }
    const { updateTenant } = await import('./tenant-registry');
    const t = getTenantById(tenantId);
    if (t) updateTenant(tenantId, { collections } as Partial<RegistryTenant>);
  }

  /** Update operational settings (status override, business hours, busy banner). */
  async updateOperationalSettingsApi(
    tenantId: string,
    updates: {
      operationalStatus?: 'open' | 'closed' | 'busy';
      overrideStatus?: 'AUTO' | 'FORCE_OPEN' | 'FORCE_CLOSED';
      orderPolicy?: 'accept_always' | 'accept_only_when_open';
      businessHours?: import('@nmd/core').BusinessHours;
      busyBannerEnabled?: boolean;
      busyBannerText?: string;
      bookingEnabled?: boolean;
      about?: string;
      officeHours?: string;
      name?: string;
      phone?: string;
      whatsappPhone?: string;
      addressLine?: string;
      location?: { lat: number; lng: number };
      supportsWeightSelling?: boolean;
      allowInstallments?: boolean;
      installmentOptions?: number[];
    }
  ): Promise<void> {
    if (this.useApi) {
      await apiFetch(`/tenants/${tenantId}/operational-settings`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
      return;
    }
    const { updateTenant } = await import('./tenant-registry');
    const t = getTenantById(tenantId);
    if (t) updateTenant(tenantId, { ...updates } as Partial<RegistryTenant>);
  }

  async updateBrandingApi(
    tenantId: string,
    updates: {
      logoUrl?: string;
      hero?: import('@nmd/core').StorefrontHero;
      banners?: import('@nmd/core').StorefrontBanner[];
      whatsappPhone?: string;
      primaryColor?: string;
      secondaryColor?: string;
      fontFamily?: string;
      radiusScale?: number;
      layoutStyle?: string;
    }
  ): Promise<void> {
    if (this.useApi) {
      await apiFetch(`/tenants/${tenantId}/branding`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
      return;
    }
    const { updateTenant } = await import('./tenant-registry');
    const t = getTenantById(tenantId);
    if (t) updateTenant(tenantId, { ...updates } as Partial<RegistryTenant>);
  }

  /** Apply quick-start template (hero, banners, categories, option groups) for a tenant. */
  async applyTemplateApi(tenantId: string, _templateId: 'clothing'): Promise<void> {
    const { buildClothingTemplateForTenant } = await import('./quick-start-templates');
    const template = buildClothingTemplateForTenant(tenantId);

    await this.updateBrandingApi(tenantId, {
      hero: template.hero,
      banners: template.banners,
    });

    const catalog = await this.getCatalogApi(tenantId);
    await this.setCatalogApi(tenantId, {
      categories: template.categories,
      products: (catalog.products ?? []) as Product[],
      optionGroups: template.optionGroups,
    });
  }
}

export function getTenantListForMall(): Tenant[] {
  if (MOCK_API_URL) return [];
  return listEnabledTenants().map(registryToTenant);
}

/** Market tenant response shape from GET /markets/:marketId/tenants */
interface MarketTenantResponse {
  id: string;
  slug: string;
  name: string;
  type: string;
  branding?: {
    logoUrl?: string;
    primaryColor?: string;
    secondaryColor?: string;
    fontFamily?: string;
    radiusScale?: number;
    layoutStyle?: string;
    hero?: import('@nmd/core').StorefrontHero;
    banners?: import('@nmd/core').StorefrontBanner[];
  };
  isActive?: boolean;
  marketCategory?: string;
}

function marketTenantToTenant(m: MarketTenantResponse): Tenant {
  const b = m.branding ?? {};
  return {
    id: m.id,
    name: m.name,
    slug: m.slug,
    type: (m.type === 'CLOTHING' || m.type === 'FOOD') ? m.type : 'GENERAL',
    marketCategory: (m.marketCategory as import('@nmd/core').MarketCategory) ?? 'GENERAL',
    branding: {
      logoUrl: b.logoUrl ?? '',
      primaryColor: b.primaryColor ?? '#7C3AED',
      secondaryColor: b.secondaryColor ?? '#d4a574',
      fontFamily: b.fontFamily ?? '"Cairo", system-ui, sans-serif',
      radiusScale: b.radiusScale ?? 1,
      layoutStyle: (b.layoutStyle as import('@nmd/core').TenantBranding['layoutStyle']) ?? 'default',
      hero: b.hero,
      banners: b.banners ?? [],
    },
  };
}

/**
 * Fetch tenants for a market using public endpoints (no JWT).
 * @param marketSlugOrId - Market slug (e.g. 'dabburiyya') or market ID (e.g. 'market-dabburiyya'). Defaults to 'dabburiyya' when omitted.
 */
export async function getTenantListForMallAsync(marketSlugOrId?: string): Promise<Tenant[]> {
  if (!MOCK_API_URL) {
    return Promise.resolve(listEnabledTenants().map(registryToTenant));
  }
  const slugOrId = marketSlugOrId ?? 'dabburiyya';
  try {
    const isMarketId = slugOrId.startsWith('market-') || /^[0-9a-f-]{36}$/i.test(slugOrId);
    let marketId: string;
    if (isMarketId) {
      marketId = slugOrId;
    } else {
      const market = await apiFetch<{ id: string }>(`/markets/by-slug/${slugOrId}`);
      if (!market?.id) return [];
      marketId = market.id;
    }
    const list = await apiFetch<MarketTenantResponse[]>(`/markets/${marketId}/tenants?_t=${Date.now()}`);
    return (Array.isArray(list) ? list : []).map(marketTenantToTenant);
  } catch {
    return [];
  }
}
