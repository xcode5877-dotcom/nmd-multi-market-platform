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
import type { RegistryTenant, MarketCourier, MarketCourierWithStats } from './types';

const MOCK_API_URL =
  (typeof import.meta !== 'undefined' && (import.meta as { env?: Record<string, string> }).env?.VITE_MOCK_API_URL) ||
  '';
/** Must match AuthContext TOKEN_KEY in apps/nmd-admin - same localStorage key for JWT */
const TOKEN_KEY = 'nmd-access-token';
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
  } else {
    token = getToken();
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
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    type,
    marketCategory: r.marketCategory ?? 'GENERAL',
    paymentCapabilities: r.paymentCapabilities ?? { cash: true, card: false },
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
    },
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
  const res = await fetch(`${MOCK_API_URL}${path}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    if (res.status === 404) throw new Error('NOT_FOUND');
    throw new Error(`API error: ${res.status}`);
  }
  return res.json();
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const method = init?.method ?? 'GET';
  const body = mergeEmergencyMeta(init?.body as string | undefined, method);
  const headers = getApiHeaders(path, method, init);
  const isPublicOrder = method === 'POST' && path === '/orders';
  if (!headers['Authorization'] && MOCK_API_URL && !isPublicOrder) {
    console.warn(`[MockApiClient] Protected request to ${path} without token. Ensure you are logged in and token is in localStorage (key: ${TOKEN_KEY}).`);
  }
  const res = await fetch(`${MOCK_API_URL}${path}`, {
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

/** Upload files to mock-api; returns URLs. Only works when VITE_MOCK_API_URL is set. */
export async function uploadFiles(files: File[]): Promise<string[]> {
  if (!MOCK_API_URL || files.length === 0) return [];
  const form = new FormData();
  files.forEach((f) => form.append('files', f));
  const res = await fetch(`${MOCK_API_URL}/upload`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
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

  async getProducts(tenantId: string, categoryId?: string): Promise<Product[]> {
    if (this.useApi) {
      try {
        const catalog = await apiFetch<{ products: Product[] }>(`/catalog/${tenantId}`);
        let products = catalog?.products ?? [];
        if (categoryId) products = products.filter((p) => (p as Product).categoryId === categoryId);
        return products as Product[];
      } catch {
        return [];
      }
    }
    await delay(80);
    try {
      const catalog = getCatalog(tenantId);
      const products = catalog?.products ?? [];
      if (categoryId) {
        return products.filter((p) => p.categoryId === categoryId);
      }
      return products;
    } catch {
      return [];
    }
  }

  async createOrder(tenantId: string, payload: OrderPayload): Promise<Order> {
    const subtotal = payload.items.reduce((sum, item) => sum + item.totalPrice, 0);
    const deliveryFee = payload.delivery?.fee ?? 0;
    const total = subtotal + deliveryFee;
    const order: Order = {
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
      delivery: payload.delivery,
    };
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

  // --- Admin/OS Control API (used by nmd-admin, admin) ---
  async getMe(): Promise<{ id: string; email: string; role: string; marketId?: string; tenantId?: string } | null> {
    if (!this.useApi) return { id: 'local', email: 'local@dev', role: 'ROOT_ADMIN' };
    try {
      return await apiFetch<{ id: string; email: string; role: string; marketId?: string; tenantId?: string }>('/auth/me');
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
  async createTenantForMarket(marketId: string, input: Omit<RegistryTenant, 'id' | 'createdAt' | 'marketId'>): Promise<RegistryTenant> {
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

  async createMarketCourier(marketId: string, data: { name?: string; phone?: string }): Promise<MarketCourier> {
    return apiFetch<MarketCourier>(`/markets/${marketId}/couriers`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async patchMarketCourier(
    marketId: string,
    courierId: string,
    updates: { name?: string; phone?: string; isActive?: boolean; isOnline?: boolean; isAvailable?: boolean; capacity?: number }
  ): Promise<MarketCourier> {
    return apiFetch<MarketCourier>(`/markets/${marketId}/couriers/${courierId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async deleteMarketCourier(marketId: string, courierId: string): Promise<MarketCourier> {
    return apiFetch<MarketCourier>(`/markets/${marketId}/couriers/${courierId}`, {
      method: 'DELETE',
    });
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
    return { ...cat };
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

  async listOrdersByTenant(tenantId: string): Promise<Order[]> {
    if (this.useApi) {
      return apiFetch<Order[]>(`/tenants/${encodeURIComponent(tenantId)}/orders`);
    }
    const { listOrdersByTenant: lot } = await import('./orders-store');
    return lot(tenantId);
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

  async patchDeliveryZoneApi(tenantId: string, zoneId: string, updates: Partial<Pick<DeliveryZone, 'isActive' | 'name' | 'fee' | 'etaMinutes' | 'sortOrder'>>): Promise<DeliveryZone | null> {
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

  async updateBrandingApi(
    tenantId: string,
    updates: { logoUrl?: string; hero?: import('@nmd/core').StorefrontHero; banners?: import('@nmd/core').StorefrontBanner[]; whatsappPhone?: string }
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
  branding: { logoUrl?: string; primaryColor?: string };
  isActive?: boolean;
  marketCategory?: string;
}

function marketTenantToTenant(m: MarketTenantResponse): Tenant {
  return {
    id: m.id,
    name: m.name,
    slug: m.slug,
    type: (m.type === 'CLOTHING' || m.type === 'FOOD') ? m.type : 'GENERAL',
    marketCategory: (m.marketCategory as import('@nmd/core').MarketCategory) ?? 'GENERAL',
    branding: {
      logoUrl: m.branding?.logoUrl ?? '',
      primaryColor: m.branding?.primaryColor ?? '#7C3AED',
      secondaryColor: '#d4a574',
      fontFamily: '"Cairo", system-ui, sans-serif',
      radiusScale: 1,
      layoutStyle: 'default',
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
    const list = await apiFetch<MarketTenantResponse[]>(`/markets/${marketId}/tenants`);
    return (Array.isArray(list) ? list : []).map(marketTenantToTenant);
  } catch {
    return [];
  }
}
