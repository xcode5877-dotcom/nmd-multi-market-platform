// src/catalog-store.ts
var STORAGE_KEY = "nmd.catalog";
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    for (const k of Object.keys(parsed)) {
      if (!parsed[k].optionGroups) parsed[k].optionGroups = [];
      if (!parsed[k].optionItems) parsed[k].optionItems = [];
    }
    return parsed;
  } catch {
  }
  return {};
}
function save(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
function normalizeCategory(c) {
  return {
    ...c,
    parentId: c.parentId ?? null,
    isVisible: c.isVisible ?? true
  };
}
function getCatalog(tenantId) {
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
    optionItems: cat.optionItems ?? []
  };
}
function ensureTenantCatalog(tenantId) {
  const data = load();
  if (!data[tenantId]) {
    const empty = {
      categories: [],
      products: [],
      optionGroups: [],
      optionItems: []
    };
    data[tenantId] = empty;
    save(data);
    return empty;
  }
  const cat = data[tenantId];
  const normalized = {
    categories: cat.categories ?? [],
    products: cat.products ?? [],
    optionGroups: cat.optionGroups ?? [],
    optionItems: cat.optionItems ?? []
  };
  if (!cat.optionItems) {
    data[tenantId] = normalized;
    save(data);
  }
  return normalized;
}
function setCatalog(tenantId, catalog) {
  const data = load();
  data[tenantId] = {
    ...catalog,
    categories: catalog.categories ?? [],
    products: catalog.products ?? [],
    optionGroups: catalog.optionGroups ?? [],
    optionItems: catalog.optionItems ?? []
  };
  save(data);
}
function listOptionGroups(tenantId) {
  return getCatalog(tenantId).optionGroups ?? [];
}
function listOptionItemsByGroup(tenantIdOrGroupId, groupId) {
  const tenantId = groupId ? tenantIdOrGroupId : void 0;
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
function upsertOptionGroup(tenantId, group) {
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
function deleteOptionGroup(tenantId, groupId) {
  const cat = getCatalog(tenantId);
  const groups = (cat.optionGroups ?? []).filter((g) => g.id !== groupId);
  setCatalog(tenantId, { ...cat, optionGroups: groups });
}
function upsertOptionItem(tenantId, groupId, item) {
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
function searchProductsAcrossTenants(query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const data = load();
  const results = [];
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
function deleteOptionItem(tenantId, groupId, itemId) {
  const cat = getCatalog(tenantId);
  const groups = cat.optionGroups ?? [];
  const gIdx = groups.findIndex((g) => g.id === groupId);
  if (gIdx === -1) return;
  const items = (groups[gIdx].items ?? []).filter((i) => i.id !== itemId);
  groups[gIdx] = { ...groups[gIdx], items };
  setCatalog(tenantId, { ...cat, optionGroups: groups });
}

export {
  getCatalog,
  ensureTenantCatalog,
  setCatalog,
  listOptionGroups,
  listOptionItemsByGroup,
  upsertOptionGroup,
  deleteOptionGroup,
  upsertOptionItem,
  searchProductsAcrossTenants,
  deleteOptionItem
};
//# sourceMappingURL=chunk-KXTMI2NF.js.map