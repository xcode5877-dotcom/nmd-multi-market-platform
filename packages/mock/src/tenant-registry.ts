import type { RegistryTenant } from './types';
import { ensureTenantCatalog } from './catalog-store';
import { getDeliverySettings, saveDeliverySettings } from './delivery-store';

const STORAGE_KEY = 'nmd.tenants';

function load(): RegistryTenant[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return [];
}

function save(tenants: RegistryTenant[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tenants));
}

export function listTenants(): RegistryTenant[] {
  return load();
}

export function listEnabledTenants(): RegistryTenant[] {
  return load().filter((t) => t.enabled);
}

export function getTenantById(id: string): RegistryTenant | null {
  return load().find((t) => t.id === id) ?? null;
}

export function getTenantBySlug(slug: string): RegistryTenant | null {
  return load().find((t) => t.slug === slug) ?? null;
}

const DEFAULT_HERO = { title: 'مرحباً بك', subtitle: 'اكتشف أفضل المنتجات لدينا', ctaText: 'تسوق الآن', ctaLink: '#' };

export function createTenant(input: Omit<RegistryTenant, 'id' | 'createdAt'>): RegistryTenant {
  const id = crypto.randomUUID?.() ?? `t-${Date.now()}`;
  const tenant: RegistryTenant = {
    ...input,
    id,
    createdAt: new Date().toISOString(),
    hero: input.hero ?? DEFAULT_HERO,
    banners: input.banners ?? [],
  };
  const tenants = load();
  tenants.push(tenant);
  save(tenants);
  ensureTenantCatalog(tenant.id);
  if (!getDeliverySettings(tenant.id)) {
    saveDeliverySettings(tenant.id, {
      tenantId: tenant.id,
      modes: { pickup: true, delivery: true },
      deliveryFee: 5,
      zones: [],
    });
  }
  return tenant;
}

export function updateTenant(id: string, updates: Partial<Omit<RegistryTenant, 'id' | 'createdAt'>>): RegistryTenant | null {
  const tenants = load();
  const idx = tenants.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  tenants[idx] = { ...tenants[idx], ...updates };
  save(tenants);
  return tenants[idx];
}

export function toggleTenant(id: string): RegistryTenant | null {
  const tenants = load();
  const idx = tenants.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  tenants[idx] = { ...tenants[idx], enabled: !tenants[idx].enabled };
  save(tenants);
  return tenants[idx];
}
