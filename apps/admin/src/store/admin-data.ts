import type { Category, Product, OptionGroup, TenantBranding } from '@nmd/core';
import { getCatalog, setCatalog } from '@nmd/mock';

const PREFIX = 'nmd-admin-';

function loadFallback<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveFallback<T>(key: string, value: T): void {
  localStorage.setItem(PREFIX + key, JSON.stringify(value));
}

export function createAdminData(tenantId: string) {
  const catalog = getCatalog(tenantId);

  return {
    getCategories: () => loadFallback<Category[]>(`categories-${tenantId}`) ?? catalog.categories ?? [],
    setCategories: (cats: Category[]) => {
      saveFallback(`categories-${tenantId}`, cats);
      setCatalog(tenantId, { ...catalog, categories: cats });
    },
    getProducts: () => loadFallback<Product[]>(`products-${tenantId}`) ?? catalog.products ?? [],
    setProducts: (prods: Product[]) => {
      saveFallback(`products-${tenantId}`, prods);
      setCatalog(tenantId, { ...catalog, products: prods });
    },
    getOptionGroups: () => loadFallback<OptionGroup[]>(`optionGroups-${tenantId}`) ?? [],
    setOptionGroups: (groups: OptionGroup[]) => saveFallback(`optionGroups-${tenantId}`, groups),
    getBranding: () => loadFallback<TenantBranding>(`branding-${tenantId}`),
    setBranding: (b: TenantBranding) => saveFallback(`branding-${tenantId}`, b),
  };
}
