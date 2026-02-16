import type { Category, Product, OptionGroup, OptionItem } from '@nmd/core';

const STORAGE_KEY = 'nmd.catalog';

interface TenantCatalog {
  categories: Category[];
  products: Product[];
  optionGroups: OptionGroup[];
  optionItems: OptionItem[];
}

function load(): Record<string, TenantCatalog> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    for (const k of Object.keys(parsed)) {
      if (!parsed[k].optionGroups) parsed[k].optionGroups = [];
      if (!parsed[k].optionItems) parsed[k].optionItems = [];
    }
    return parsed;
  } catch {
    /* ignore */
  }
  return {};
}

function save(data: Record<string, TenantCatalog>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function normalizeCategory(c: Partial<Category>): Category {
  return {
    ...c,
    parentId: c.parentId ?? null,
    isVisible: c.isVisible ?? true,
  } as Category;
}

export function getCatalog(tenantId: string): TenantCatalog {
  const data = load();
  const cat = data[tenantId];
  if (!cat) {
    return { categories: [], products: [], optionGroups: [], optionItems: [] };
  }
  const categories = (cat.categories ?? []).map((c) => normalizeCategory(c));
  return {
    categories,
    products: cat.products ?? [],
    optionGroups: cat.optionGroups ?? [],
    optionItems: cat.optionItems ?? [],
  };
}

/** Ensure a tenant has an entry in nmd.catalog. Creates empty catalog if missing. */
export function ensureTenantCatalog(tenantId: string): TenantCatalog {
  const data = load();
  if (!data[tenantId]) {
    const empty: TenantCatalog = {
      categories: [],
      products: [],
      optionGroups: [],
      optionItems: [],
    };
    data[tenantId] = empty;
    save(data);
    return empty;
  }
  const cat = data[tenantId];
  const normalized: TenantCatalog = {
    categories: cat.categories ?? [],
    products: cat.products ?? [],
    optionGroups: cat.optionGroups ?? [],
    optionItems: cat.optionItems ?? [],
  };
  if (!cat.optionItems) {
    data[tenantId] = normalized;
    save(data);
  }
  return normalized;
}

export function setCatalog(tenantId: string, catalog: TenantCatalog): void {
  const data = load();
  data[tenantId] = {
    ...catalog,
    categories: catalog.categories ?? [],
    products: catalog.products ?? [],
    optionGroups: catalog.optionGroups ?? [],
    optionItems: catalog.optionItems ?? [],
  };
  save(data);
}

export function listOptionGroups(tenantId: string): OptionGroup[] {
  return getCatalog(tenantId).optionGroups ?? [];
}

export function listOptionItemsByGroup(tenantIdOrGroupId: string, groupId?: string): OptionItem[] {
  const tenantId = groupId ? tenantIdOrGroupId : undefined;
  const gid = groupId ?? tenantIdOrGroupId;
  if (tenantId) {
    const groups = getCatalog(tenantId).optionGroups ?? [];
    const g = groups.find((x) => x.id === gid);
    return g?.items ?? [];
  }
  const tenants = Object.keys(load());
  for (const tid of tenants) {
    const groups = getCatalog(tid).optionGroups ?? [];
    const g = groups.find((x) => x.id === gid);
    if (g) return g.items ?? [];
  }
  return [];
}

export function upsertOptionGroup(tenantId: string, group: OptionGroup): OptionGroup {
  const cat = getCatalog(tenantId);
  const groups = cat.optionGroups ?? [];
  const idx = groups.findIndex((g) => g.id === group.id);
  const withTenant = { ...group, tenantId };
  if (idx >= 0) {
    groups[idx] = { ...withTenant, items: groups[idx].items ?? [] };
  } else {
    groups.push({ ...withTenant, items: group.items ?? [] });
  }
  setCatalog(tenantId, { ...cat, optionGroups: groups });
  return groups[idx >= 0 ? idx : groups.length - 1];
}

export function deleteOptionGroup(tenantId: string, groupId: string): void {
  const cat = getCatalog(tenantId);
  const groups = (cat.optionGroups ?? []).filter((g) => g.id !== groupId);
  setCatalog(tenantId, { ...cat, optionGroups: groups });
}

export function upsertOptionItem(tenantId: string, groupId: string, item: OptionItem): OptionItem {
  const cat = getCatalog(tenantId);
  const groups = cat.optionGroups ?? [];
  const gIdx = groups.findIndex((g) => g.id === groupId);
  if (gIdx === -1) return item;
  const items = groups[gIdx].items ?? [];
  const iIdx = items.findIndex((i) => i.id === item.id);
  const withGroup = { ...item, groupId };
  if (iIdx >= 0) items[iIdx] = withGroup;
  else items.push(withGroup);
  groups[gIdx] = { ...groups[gIdx], items };
  setCatalog(tenantId, { ...cat, optionGroups: groups });
  return withGroup;
}

/** Search products across all tenants by name (contains, case-insensitive). */
export function searchProductsAcrossTenants(query: string): Array<{ tenantId: string; product: Product }> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const data = load();
  const results: Array<{ tenantId: string; product: Product }> = [];
  for (const tenantId of Object.keys(data)) {
    const products = data[tenantId].products ?? [];
    for (const p of products) {
      if (p.name.toLowerCase().includes(q)) {
        results.push({ tenantId, product: p });
      }
    }
  }
  return results;
}

export function deleteOptionItem(tenantId: string, groupId: string, itemId: string): void {
  const cat = getCatalog(tenantId);
  const groups = cat.optionGroups ?? [];
  const gIdx = groups.findIndex((g) => g.id === groupId);
  if (gIdx === -1) return;
  const items = (groups[gIdx].items ?? []).filter((i) => i.id !== itemId);
  groups[gIdx] = { ...groups[gIdx], items };
  setCatalog(tenantId, { ...cat, optionGroups: groups });
}
