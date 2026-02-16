import {
  ensureTenantCatalog
} from "./chunk-KXTMI2NF.js";
import {
  getDeliverySettings,
  saveDeliverySettings
} from "./chunk-77ON5LVH.js";

// src/tenant-registry.ts
var STORAGE_KEY = "nmd.tenants";
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
  }
  return [];
}
function save(tenants) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tenants));
}
function listTenants() {
  return load();
}
function listEnabledTenants() {
  return load().filter((t) => t.enabled);
}
function getTenantById(id) {
  return load().find((t) => t.id === id) ?? null;
}
function getTenantBySlug(slug) {
  return load().find((t) => t.slug === slug) ?? null;
}
var DEFAULT_HERO = { title: "\u0645\u0631\u062D\u0628\u0627\u064B \u0628\u0643", subtitle: "\u0627\u0643\u062A\u0634\u0641 \u0623\u0641\u0636\u0644 \u0627\u0644\u0645\u0646\u062A\u062C\u0627\u062A \u0644\u062F\u064A\u0646\u0627", ctaText: "\u062A\u0633\u0648\u0642 \u0627\u0644\u0622\u0646", ctaLink: "#" };
function createTenant(input) {
  const id = crypto.randomUUID?.() ?? `t-${Date.now()}`;
  const tenant = {
    ...input,
    id,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    hero: input.hero ?? DEFAULT_HERO,
    banners: input.banners ?? []
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
      zones: []
    });
  }
  return tenant;
}
function updateTenant(id, updates) {
  const tenants = load();
  const idx = tenants.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  tenants[idx] = { ...tenants[idx], ...updates };
  save(tenants);
  return tenants[idx];
}
function toggleTenant(id) {
  const tenants = load();
  const idx = tenants.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  tenants[idx] = { ...tenants[idx], enabled: !tenants[idx].enabled };
  save(tenants);
  return tenants[idx];
}

export {
  listTenants,
  listEnabledTenants,
  getTenantById,
  getTenantBySlug,
  createTenant,
  updateTenant,
  toggleTenant
};
//# sourceMappingURL=chunk-6IZ2B3IX.js.map