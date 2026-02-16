import {
  createTenant,
  getTenantById,
  getTenantBySlug,
  listEnabledTenants,
  listTenants,
  toggleTenant,
  updateTenant
} from "./chunk-6IZ2B3IX.js";
import {
  deleteOptionGroup,
  deleteOptionItem,
  ensureTenantCatalog,
  getCatalog,
  listOptionGroups,
  listOptionItemsByGroup,
  searchProductsAcrossTenants,
  setCatalog,
  upsertOptionGroup,
  upsertOptionItem
} from "./chunk-KXTMI2NF.js";
import {
  getDeliverySettings,
  saveDeliverySettings
} from "./chunk-77ON5LVH.js";
import {
  getDeliveryZones,
  setDeliveryZones
} from "./chunk-H65H2BKD.js";
import {
  addOrder,
  getOrder,
  getOrdersThisWeek,
  getOrdersToday,
  listOrders,
  listOrdersByTenant,
  updateOrderStatus
} from "./chunk-SAU2GD47.js";
import {
  CLOTHING_TEMPLATE,
  buildClothingTemplateForTenant
} from "./chunk-D6QASIIW.js";

// src/seed.ts
var DEMO_TENANTS = [
  {
    slug: "buffalo28",
    name: "Buffalo28 Pizza",
    logoUrl: "/logo-pizza.svg",
    primaryColor: "#b91c1c",
    secondaryColor: "#fbbf24",
    fontFamily: '"Cairo", system-ui, sans-serif',
    radiusScale: 1.25,
    layoutStyle: "default",
    enabled: true,
    type: "FOOD"
  },
  {
    slug: "ms-brands",
    name: "MS Brands",
    logoUrl: "/logo.svg",
    primaryColor: "#059669",
    secondaryColor: "#d4a574",
    fontFamily: '"Cairo", system-ui, sans-serif',
    radiusScale: 1,
    layoutStyle: "default",
    enabled: true
  },
  {
    slug: "pizza",
    name: "NMD Pizzeria",
    logoUrl: "/logo-pizza.svg",
    primaryColor: "#b91c1c",
    secondaryColor: "#fbbf24",
    fontFamily: '"Cairo", system-ui, sans-serif',
    radiusScale: 1.25,
    layoutStyle: "default",
    enabled: true,
    type: "FOOD"
  },
  {
    slug: "groceries",
    name: "NMD Groceries",
    logoUrl: "/logo.svg",
    primaryColor: "#059669",
    secondaryColor: "#d4a574",
    fontFamily: '"Cairo", system-ui, sans-serif',
    radiusScale: 1,
    layoutStyle: "default",
    enabled: true
  },
  {
    slug: "apparel",
    name: "NMD Apparel",
    logoUrl: "/logo.svg",
    primaryColor: "#7c3aed",
    secondaryColor: "#a78bfa",
    fontFamily: '"Cairo", system-ui, sans-serif',
    radiusScale: 1,
    layoutStyle: "default",
    enabled: true
  }
];
function seedTenants() {
  const existing = loadTenants();
  if (existing.length > 0) return;
  const created = (/* @__PURE__ */ new Date()).toISOString();
  const tenants = DEMO_TENANTS.map((t, i) => ({
    ...t,
    id: `tenant-${i + 1}`,
    createdAt: created
  }));
  localStorage.setItem("nmd.tenants", JSON.stringify(tenants));
}
function loadTenants() {
  try {
    const raw = localStorage.getItem("nmd.tenants");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// src/catalog-seed.ts
function seedTenantCatalog(tenantId, slug, categories, products) {
  const existing = getCatalog(tenantId);
  if (existing.categories.length > 0 || existing.products.length > 0) return;
  const cats = categories.map((c) => ({ ...c, tenantId }));
  const prods = products.map((p) => ({ ...p, tenantId }));
  setCatalog(tenantId, { categories: cats, products: prods, optionGroups: existing.optionGroups ?? [] });
}
var PIZZA_CATEGORIES = [
  { id: "pcat-1", tenantId: "", name: "Pizzas", slug: "pizzas", sortOrder: 0 },
  { id: "pcat-2", tenantId: "", name: "Sides", slug: "sides", sortOrder: 1 }
];
var PIZZA_PRODUCTS = [
  {
    id: "pprod-1",
    tenantId: "",
    categoryId: "pcat-1",
    name: "Margherita Pizza",
    slug: "margherita",
    type: "PIZZA",
    basePrice: 55,
    currency: "ILS",
    images: [{ id: "pimg-1", url: "https://placehold.co/400x300?text=Pizza", sortOrder: 0 }],
    optionGroups: [
      {
        id: "pog-1",
        name: "Size",
        type: "SIZE",
        required: true,
        minSelected: 1,
        maxSelected: 1,
        selectionType: "single",
        items: [
          { id: "poi-1", name: "Regular", priceModifier: 0, sortOrder: 0 },
          { id: "poi-2", name: "Large", priceModifier: 15, sortOrder: 1 }
        ]
      },
      {
        id: "pog-2",
        name: "Extra Toppings",
        type: "CUSTOM",
        required: false,
        minSelected: 0,
        maxSelected: 3,
        selectionType: "multi",
        allowHalfPlacement: true,
        items: [
          { id: "poi-3", name: "Mushrooms", priceModifier: 5, sortOrder: 0, placement: "HALF" },
          { id: "poi-4", name: "Olives", priceModifier: 4, sortOrder: 1, placement: "HALF" }
        ]
      }
    ],
    isAvailable: true
  }
];
var GROCERIES_CATEGORIES = [
  { id: "gcat-1", tenantId: "", name: "Fruits", slug: "fruits", sortOrder: 0 },
  { id: "gcat-2", tenantId: "", name: "Vegetables", slug: "vegetables", sortOrder: 1 }
];
var GROCERIES_PRODUCTS = [
  {
    id: "gprod-1",
    tenantId: "",
    categoryId: "gcat-1",
    name: "Fresh Apples",
    slug: "fresh-apples",
    type: "SIMPLE",
    basePrice: 12,
    currency: "ILS",
    images: [{ id: "gimg-1", url: "https://placehold.co/400x300?text=Apples", sortOrder: 0 }],
    optionGroups: [],
    isAvailable: true
  },
  {
    id: "gprod-2",
    tenantId: "",
    categoryId: "gcat-2",
    name: "Organic Tomatoes",
    slug: "organic-tomatoes",
    type: "SIMPLE",
    basePrice: 8,
    currency: "ILS",
    images: [{ id: "gimg-2", url: "https://placehold.co/400x300?text=Tomatoes", sortOrder: 0 }],
    optionGroups: [],
    isAvailable: true
  }
];
var APPAREL_CATEGORIES = [
  { id: "acat-1", tenantId: "", name: "T-Shirts", slug: "t-shirts", sortOrder: 0 },
  { id: "acat-2", tenantId: "", name: "Pants", slug: "pants", sortOrder: 1 }
];
var APPAREL_PRODUCTS = [
  {
    id: "aprod-1",
    tenantId: "",
    categoryId: "acat-1",
    name: "Classic Tee",
    slug: "classic-tee",
    type: "APPAREL",
    basePrice: 89,
    currency: "ILS",
    images: [{ id: "aimg-1", url: "https://placehold.co/400x300?text=Tee", sortOrder: 0 }],
    optionGroups: [
      {
        id: "aog-1",
        name: "Size",
        required: true,
        minSelected: 1,
        maxSelected: 1,
        selectionType: "single",
        items: [
          { id: "aoi-1", name: "S", priceModifier: 0, sortOrder: 0 },
          { id: "aoi-2", name: "M", priceModifier: 0, sortOrder: 1 },
          { id: "aoi-3", name: "L", priceModifier: 0, sortOrder: 2 }
        ]
      }
    ],
    isAvailable: true
  }
];
function seedCatalogForTenants() {
  const tenants = JSON.parse(localStorage.getItem("nmd.tenants") ?? "[]");
  for (const t of tenants) {
    if (t.slug === "pizza" || t.slug === "buffalo28") {
      seedTenantCatalog(t.id, t.slug, PIZZA_CATEGORIES, PIZZA_PRODUCTS);
    } else if (t.slug === "groceries") {
      seedTenantCatalog(t.id, t.slug, GROCERIES_CATEGORIES, GROCERIES_PRODUCTS);
    } else if (t.slug === "apparel") {
      seedTenantCatalog(t.id, t.slug, APPAREL_CATEGORIES, APPAREL_PRODUCTS);
    }
  }
}

// src/campaign-store.ts
var STORAGE_KEY = "nmd.campaigns";
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
  }
  return [];
}
function save(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
function listCampaigns(tenantId) {
  return load().filter((c) => c.tenantId === tenantId);
}
function getCampaign(id) {
  return load().find((c) => c.id === id) ?? null;
}
function createCampaign(input) {
  const id = crypto.randomUUID?.() ?? `camp-${Date.now()}`;
  const campaign = { ...input, id };
  const data = load();
  data.push(campaign);
  save(data);
  return campaign;
}
function updateCampaign(id, updates) {
  const data = load();
  const idx = data.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  data[idx] = { ...data[idx], ...updates };
  save(data);
  return data[idx];
}
function deleteCampaign(id) {
  const data = load().filter((c) => c.id !== id);
  if (data.length === load().length) return false;
  save(data);
  return true;
}
function toggleCampaignStatus(id) {
  const c = getCampaign(id);
  if (!c) return null;
  const next = c.status === "active" ? "paused" : "active";
  return updateCampaign(id, { status: next });
}

// src/campaign-seed.ts
function seedCampaigns() {
  const tenants = listTenants();
  const existing = loadCampaigns();
  if (existing.length > 0) return;
  const pizza = tenants.find((t) => t.slug === "pizza");
  const groceries = tenants.find((t) => t.slug === "groceries");
  if (pizza) {
    createCampaign({
      tenantId: pizza.id,
      name: "\u062E\u0635\u0645 \u0627\u0644\u0628\u064A\u062A\u0632\u0627",
      status: "active",
      type: "PERCENT",
      value: 15,
      appliesTo: "ALL",
      stackable: false,
      priority: 1
    });
  }
  if (groceries) {
    createCampaign({
      tenantId: groceries.id,
      name: "\u062E\u0635\u0645 \u062B\u0627\u0628\u062A",
      status: "active",
      type: "FIXED",
      value: 5,
      appliesTo: "ALL",
      stackable: false,
      priority: 1
    });
  }
}
function loadCampaigns() {
  try {
    const raw = localStorage.getItem("nmd.campaigns");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// src/delivery-seed.ts
function seedDelivery() {
  const tenants = listTenants();
  for (const t of tenants) {
    if (getDeliverySettings(t.id)) continue;
    saveDeliverySettings(t.id, {
      tenantId: t.id,
      modes: { pickup: true, delivery: true },
      deliveryFee: 5,
      zones: []
    });
  }
}
var BUFFALO_ZONES = [
  { name: "\u0627\u0644\u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0648\u0633\u0637\u0649", fee: 15, etaMinutes: 30, isActive: true, sortOrder: 0 },
  { name: "\u0627\u0644\u0634\u0645\u0627\u0644", fee: 20, etaMinutes: 45, isActive: true, sortOrder: 1 },
  { name: "\u0627\u0644\u062C\u0646\u0648\u0628", fee: 18, etaMinutes: 40, isActive: true, sortOrder: 2 },
  { name: "\u0627\u0644\u0634\u0631\u0642", fee: 22, etaMinutes: 50, isActive: true, sortOrder: 3 },
  { name: "\u0627\u0644\u063A\u0631\u0628", fee: 25, etaMinutes: 55, isActive: true, sortOrder: 4 },
  { name: "\u0636\u0648\u0627\u062D\u064A", fee: 30, etaMinutes: 60, isActive: true, sortOrder: 5 },
  { name: "\u062E\u0627\u0631\u062C \u0627\u0644\u0645\u062F\u064A\u0646\u0629", fee: 40, etaMinutes: 90, isActive: true, sortOrder: 6 }
];
function seedDeliveryZones() {
  const tenants = listTenants();
  for (const t of tenants) {
    if (getDeliveryZones(t.id).length > 0) continue;
    const slug = t.slug ?? "";
    let zones;
    if (slug === "buffalo28" || slug === "pizza") {
      zones = BUFFALO_ZONES.map((z, i) => ({ ...z, id: `dz-${t.id}-${i + 1}`, tenantId: t.id }));
    } else if (slug === "ms-brands") {
      zones = [{ id: `dz-${t.id}-1`, tenantId: t.id, name: "\u0627\u0644\u062A\u0648\u0635\u064A\u0644 \u0627\u0644\u0639\u0627\u0645", fee: 10, etaMinutes: 45, isActive: true, sortOrder: 0 }];
    } else {
      zones = [{ id: `dz-${t.id}-1`, tenantId: t.id, name: "\u0627\u0644\u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0627\u0641\u062A\u0631\u0627\u0636\u064A\u0629", fee: 10, etaMinutes: 45, isActive: true, sortOrder: 0 }];
    }
    setDeliveryZones(t.id, zones);
  }
}

// src/template-store.ts
var STORAGE_KEY2 = "nmd.templates";
function load2() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY2);
    if (raw) return JSON.parse(raw);
  } catch {
  }
  return [];
}
function save2(templates) {
  localStorage.setItem(STORAGE_KEY2, JSON.stringify(templates));
}
function listTemplates() {
  return load2();
}
function getTemplate(id) {
  return load2().find((t) => t.id === id) ?? null;
}
function seedTemplates() {
  const existing = load2();
  if (existing.length > 0) return;
  const templates = [
    { id: "t-minimal", name: "\u0628\u0633\u064A\u0637", layoutStyle: "minimal" },
    { id: "t-cozy", name: "\u0645\u0631\u064A\u062D", layoutStyle: "cozy" },
    { id: "t-bold", name: "\u0648\u0627\u0636\u062D", layoutStyle: "bold" },
    { id: "t-modern", name: "\u062D\u062F\u064A\u062B", layoutStyle: "modern" }
  ];
  save2(templates);
}

// src/staff-store.ts
import { generateId } from "@nmd/core";
var STORAGE_KEY3 = "nmd.staff";
function load3() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY3);
    if (raw) return JSON.parse(raw);
  } catch {
  }
  return [];
}
function save3(staff) {
  localStorage.setItem(STORAGE_KEY3, JSON.stringify(staff));
}
function listStaff(tenantId) {
  return load3().filter((s) => s.tenantId === tenantId);
}
function addStaff(input) {
  const user = {
    ...input,
    id: generateId(),
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  const all = load3();
  all.push(user);
  save3(all);
  return user;
}
function updateStaff(id, updates) {
  const all = load3();
  const idx = all.findIndex((s) => s.id === id);
  if (idx === -1) return null;
  all[idx] = { ...all[idx], ...updates };
  save3(all);
  return all[idx];
}
function removeStaff(id) {
  save3(load3().filter((s) => s.id !== id));
}
function seedStaff() {
  const existing = load3();
  if (existing.length > 0) return;
  const tenants = listTenants();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const staff = tenants.map((t) => ({
    id: generateId(),
    tenantId: t.id,
    name: `\u0645\u0627\u0644\u0643 ${t.name}`,
    role: "OWNER",
    createdAt: now
  }));
  save3(staff);
}

// src/mock-api-client.ts
import { generateId as generateId2 } from "@nmd/core";
var MOCK_API_URL = typeof import.meta !== "undefined" && import.meta.env?.VITE_MOCK_API_URL || "";
var TOKEN_KEY = "nmd-access-token";
var CUSTOMER_TOKEN_KEY = "nmd-customer-token";
var tokenProvider = null;
function setMockApiTokenProvider(fn) {
  tokenProvider = fn;
}
function getToken() {
  const fromProvider = tokenProvider?.() ?? null;
  const fromStorage = typeof localStorage !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
  return fromProvider ?? fromStorage;
}
function getCustomerToken() {
  return typeof localStorage !== "undefined" ? localStorage.getItem(CUSTOMER_TOKEN_KEY) : null;
}
function getApiHeaders(init) {
  const h = { "Content-Type": "application/json", ...init?.headers };
  const token = getToken() ?? getCustomerToken();
  if (token) {
    h["Authorization"] = `Bearer ${token}`;
  }
  const emergency = typeof window !== "undefined" && window.__NMD_EMERGENCY_HEADERS__;
  if (emergency) Object.assign(h, emergency);
  return h;
}
function mergeEmergencyMeta(body, method) {
  const reason = typeof window !== "undefined" ? window.__NMD_EMERGENCY_REASON__ : void 0;
  if (!reason) return body;
  const isWrite = ["POST", "PUT", "PATCH", "DELETE"].includes((method || "GET").toUpperCase());
  if (!isWrite) return body;
  try {
    const parsed = body ? JSON.parse(body) : {};
    const merged = { ...parsed, _meta: { ...parsed._meta, emergencyReason: reason } };
    return JSON.stringify(merged);
  } catch {
    return body;
  }
}
function normalizeHero(h) {
  const defaultHero = { title: "\u0645\u0631\u062D\u0628\u0627\u064B \u0628\u0643", subtitle: "\u0627\u0643\u062A\u0634\u0641 \u0623\u0641\u0636\u0644 \u0627\u0644\u0645\u0646\u062A\u062C\u0627\u062A \u0644\u062F\u064A\u0646\u0627", ctaText: "\u062A\u0633\u0648\u0642 \u0627\u0644\u0622\u0646", ctaLink: "#", ctaHref: "#" };
  const base = h ?? defaultHero;
  const cta = base.ctaHref ?? base.ctaLink ?? "#";
  return { ...base, ctaLink: cta, ctaHref: cta };
}
function registryToTenant(r) {
  const template = r.templateId ? getTemplate(r.templateId) : null;
  const layoutStyle = template?.layoutStyle ?? r.layoutStyle;
  const type = r.type === "CLOTHING" || r.type === "FOOD" ? r.type : "GENERAL";
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    type,
    marketCategory: r.marketCategory ?? "GENERAL",
    paymentCapabilities: r.paymentCapabilities ?? { cash: true, card: false },
    branding: {
      logoUrl: r.logoUrl ?? "",
      primaryColor: r.primaryColor ?? "#0f766e",
      secondaryColor: r.secondaryColor ?? "#d4a574",
      fontFamily: r.fontFamily ?? '"Cairo", system-ui, sans-serif',
      radiusScale: r.radiusScale ?? 1,
      layoutStyle,
      hero: normalizeHero(r.hero),
      banners: r.banners ?? [],
      whatsappPhone: r.whatsappPhone
    }
  };
}
function resolveTenant(idOrSlug) {
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
function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
async function publicFetch(path) {
  const res = await fetch(`${MOCK_API_URL}${path}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" }
  });
  if (!res.ok) {
    if (res.status === 404) throw new Error("NOT_FOUND");
    throw new Error(`API error: ${res.status}`);
  }
  return res.json();
}
async function apiFetch(path, init) {
  const method = init?.method ?? "GET";
  const body = mergeEmergencyMeta(init?.body, method);
  const headers = getApiHeaders(init);
  const isPublicOrder = method === "POST" && path === "/orders";
  if (!headers["Authorization"] && MOCK_API_URL && !isPublicOrder) {
    console.warn(`[MockApiClient] Protected request to ${path} without token. Ensure you are logged in and token is in localStorage (key: ${TOKEN_KEY}).`);
  }
  const res = await fetch(`${MOCK_API_URL}${path}`, {
    ...init,
    method,
    body,
    headers
  });
  if (!res.ok) {
    if (res.status === 404) throw new Error("NOT_FOUND");
    try {
      const err = await res.json();
      if (err.code === "EMERGENCY_MODE_REQUIRED") {
        throw new Error("Emergency mode required");
      }
      throw new Error(err.error ?? `API error: ${res.status}`);
    } catch (e) {
      if (e instanceof Error) throw e;
      throw new Error(`API error: ${res.status}`);
    }
  }
  if (res.status === 204) return void 0;
  return res.json();
}
async function uploadFiles(files) {
  if (!MOCK_API_URL || files.length === 0) return [];
  const form = new FormData();
  files.forEach((f) => form.append("files", f));
  const res = await fetch(`${MOCK_API_URL}/upload`, {
    method: "POST",
    body: form
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  const data = await res.json();
  return data.urls ?? [];
}
var MockApiClient = class {
  get useApi() {
    return !!MOCK_API_URL;
  }
  async getTenant(tenantIdOrSlug) {
    if (this.useApi) {
      try {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantIdOrSlug);
        const path = isUuid ? `/tenants/by-id/${tenantIdOrSlug}` : `/tenants/by-slug/${tenantIdOrSlug}`;
        const r = await apiFetch(path);
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
  async getMenu(tenantId) {
    if (this.useApi) {
      try {
        const catalog = await apiFetch(`/catalog/${tenantId}`);
        const categories = (catalog?.categories ?? []).filter((c) => c.isVisible !== false).map((c) => ({ ...c, parentId: c.parentId ?? null }));
        return [...categories].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
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
  async getProduct(tenantId, productId) {
    if (this.useApi) {
      try {
        const catalog = await apiFetch(`/catalog/${tenantId}`);
        const products = catalog?.products ?? [];
        return products.find((p) => p.id === productId) ?? null;
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
  async getProducts(tenantId, categoryId) {
    if (this.useApi) {
      try {
        const catalog = await apiFetch(`/catalog/${tenantId}`);
        let products = catalog?.products ?? [];
        if (categoryId) products = products.filter((p) => p.categoryId === categoryId);
        return products;
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
  async createOrder(tenantId, payload) {
    const subtotal = payload.items.reduce((sum, item) => sum + item.totalPrice, 0);
    const deliveryFee = payload.delivery?.fee ?? 0;
    const total = subtotal + deliveryFee;
    const order = {
      id: generateId2(),
      tenantId,
      status: "PENDING",
      fulfillmentType: payload.fulfillmentType,
      paymentMethod: payload.paymentMethod,
      items: payload.items,
      subtotal,
      total,
      currency: "ILS",
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      notes: payload.notes,
      customerName: payload.customerName,
      customerPhone: payload.customerPhone,
      deliveryAddress: payload.deliveryAddress,
      delivery: payload.delivery
    };
    if (this.useApi) {
      const created = await apiFetch("/orders", {
        method: "POST",
        body: JSON.stringify(order)
      });
      return created;
    }
    await delay(150);
    addOrder(order);
    return order;
  }
  async getOrder(orderId) {
    if (this.useApi) {
      try {
        return await apiFetch(`/orders/${orderId}`);
      } catch {
        return null;
      }
    }
    await delay(80);
    return getOrder(orderId);
  }
  /** Public order status - no auth. For storefront success/status pages. */
  async getPublicOrder(orderId) {
    if (this.useApi) {
      try {
        return await publicFetch(`/public/orders/${encodeURIComponent(orderId)}`);
      } catch {
        return null;
      }
    }
    await delay(80);
    return getOrder(orderId);
  }
  async getCampaigns(tenantId) {
    if (this.useApi) {
      try {
        return await apiFetch(`/campaigns?tenantId=${encodeURIComponent(tenantId)}`);
      } catch {
        return [];
      }
    }
    await delay(80);
    return listCampaigns(tenantId);
  }
  async getDeliverySettings(tenantId) {
    if (this.useApi) {
      try {
        return await apiFetch(`/delivery/${tenantId}`);
      } catch {
        return null;
      }
    }
    await delay(80);
    return getDeliverySettings(tenantId);
  }
  async getDeliveryZones(tenantId) {
    if (this.useApi) {
      try {
        return await apiFetch(`/tenants/${tenantId}/delivery-zones`);
      } catch {
        return [];
      }
    }
    await delay(80);
    const zones = getDeliveryZones(tenantId);
    if (zones.length > 0) return zones;
    const settings = getDeliverySettings(tenantId);
    const legacy = settings?.zones ?? [];
    return legacy.map((z) => ({
      id: z.id ?? `legacy-${z.name}`,
      tenantId,
      name: z.name,
      fee: z.fee,
      etaMinutes: z.etaMinutes,
      isActive: z.enabled ?? z.isActive ?? true,
      sortOrder: z.sortOrder
    }));
  }
  async getOptionGroups(tenantId) {
    if (this.useApi) {
      try {
        const catalog = await apiFetch(`/catalog/${tenantId}`);
        return catalog?.optionGroups ?? [];
      } catch {
        return [];
      }
    }
    await delay(80);
    return listOptionGroups(tenantId);
  }
  async getOptionItems(tenantId, groupId) {
    if (this.useApi) {
      try {
        const catalog = await apiFetch(`/catalog/${tenantId}`);
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
  async getMe() {
    if (!this.useApi) return { id: "local", email: "local@dev", role: "ROOT_ADMIN" };
    try {
      return await apiFetch("/auth/me");
    } catch {
      return null;
    }
  }
  /** Change password (self-service). Requires auth. Uses Authorization header. */
  async changePassword(currentPassword, newPassword) {
    if (!this.useApi) throw new Error("Change password requires API");
    return apiFetch("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword })
    });
  }
  async listTenants() {
    if (this.useApi) {
      return apiFetch("/tenants");
    }
    const { listTenants: lt } = await import("./tenant-registry-V2NDKWYC.js");
    return lt();
  }
  async createTenant(input) {
    if (this.useApi) {
      return apiFetch("/tenants", {
        method: "POST",
        body: JSON.stringify(input)
      });
    }
    const { createTenant: ct } = await import("./tenant-registry-V2NDKWYC.js");
    return ct(input);
  }
  /** Create tenant scoped to a market. Uses POST /markets/:marketId/tenants. */
  async createTenantForMarket(marketId, input) {
    if (this.useApi) {
      return apiFetch(`/markets/${marketId}/tenants`, {
        method: "POST",
        body: JSON.stringify(input)
      });
    }
    const { createTenant: ct } = await import("./tenant-registry-V2NDKWYC.js");
    return ct({ ...input, marketId });
  }
  async updateTenant(id, updates) {
    if (this.useApi) {
      const res = await apiFetch(`/tenants/${id}`, {
        method: "PUT",
        body: JSON.stringify(updates)
      });
      return res;
    }
    const { updateTenant: ut } = await import("./tenant-registry-V2NDKWYC.js");
    return ut(id, updates);
  }
  async toggleTenant(id) {
    if (this.useApi) {
      try {
        return await apiFetch(`/tenants/${id}/toggle`, { method: "POST" });
      } catch {
        return null;
      }
    }
    const { toggleTenant: tt } = await import("./tenant-registry-V2NDKWYC.js");
    return tt(id);
  }
  async getTenantById(id) {
    if (this.useApi) {
      try {
        return await apiFetch(`/tenants/by-id/${id}`);
      } catch {
        return null;
      }
    }
    return getTenantById(id);
  }
  async getTenantBySlug(slug) {
    if (this.useApi) {
      try {
        return await apiFetch(`/tenants/by-slug/${slug}`);
      } catch {
        return null;
      }
    }
    return getTenantBySlug(slug);
  }
  /** PATCH tenant delivery settings (tenantType, deliveryProviderMode, allowMarketCourierFallback, defaultPrepTimeMin) */
  async patchTenantDeliverySettings(tenantId, settings) {
    return apiFetch(`/tenants/${tenantId}/settings/delivery`, {
      method: "PATCH",
      body: JSON.stringify(settings)
    });
  }
  /** Mark order as READY (restaurant) */
  async markOrderReady(tenantId, orderId) {
    return apiFetch(`/tenants/${tenantId}/orders/${orderId}/ready`, {
      method: "POST"
    });
  }
  /** Market couriers */
  async getMarketCouriers(marketId) {
    return apiFetch(`/markets/${marketId}/couriers`);
  }
  /** Market couriers with performance stats (deliveredCountToday, deliveredCountWeek, avgTotalMin, avgPickupToDeliveredMin, onTimeRate) */
  async getMarketCourierStats(marketId) {
    return apiFetch(`/markets/${marketId}/couriers/stats`);
  }
  /** Weekly leaderboard. Returns { leaderboard, myRank }. */
  async getMarketLeaderboard(marketId, period = "week") {
    return apiFetch(`/markets/${marketId}/leaderboard?period=${period}`);
  }
  async createMarketCourier(marketId, data) {
    return apiFetch(`/markets/${marketId}/couriers`, {
      method: "POST",
      body: JSON.stringify(data)
    });
  }
  async patchMarketCourier(marketId, courierId, updates) {
    return apiFetch(`/markets/${marketId}/couriers/${courierId}`, {
      method: "PATCH",
      body: JSON.stringify(updates)
    });
  }
  async deleteMarketCourier(marketId, courierId) {
    return apiFetch(`/markets/${marketId}/couriers/${courierId}`, {
      method: "DELETE"
    });
  }
  /** Market finance summary. Aggregates orders in date range. */
  async getMarketFinanceSummary(marketId, from, to) {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const q = params.toString() ? `?${params}` : "";
    return apiFetch(`/markets/${marketId}/finance/summary${q}`);
  }
  /** Market finance by tenant. */
  async getMarketFinanceTenants(marketId, from, to) {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const q = params.toString() ? `?${params}` : "";
    return apiFetch(`/markets/${marketId}/finance/tenants${q}`);
  }
  /** Market finance by courier. */
  async getMarketFinanceCouriers(marketId, from, to) {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const q = params.toString() ? `?${params}` : "";
    return apiFetch(`/markets/${marketId}/finance/couriers${q}`);
  }
  /** All orders for a market (from tenants in that market). For market admin orders/dispatch views. */
  async getMarketOrders(marketId) {
    if (this.useApi) {
      return apiFetch(`/markets/${marketId}/orders`);
    }
    const { listOrdersByTenant: listOrdersByTenant2 } = await import("./orders-store-RLSYT6H3.js");
    const { listTenants: listTenants2 } = await import("./tenant-registry-V2NDKWYC.js");
    const tenantIds = listTenants2().filter((t) => t.marketId === marketId).map((t) => t.id);
    const all = [];
    for (const tid of tenantIds) {
      const orders = listOrdersByTenant2(tid);
      all.push(...orders);
    }
    return all;
  }
  /** Dispatch queue (orders eligible for market courier, not yet assigned) */
  async getDispatchQueue(marketId) {
    return apiFetch(`/markets/${marketId}/dispatch/queue`);
  }
  /** Assign courier to a MARKET delivery order. Use reassign: true when changing courier on already-assigned order. */
  async assignCourierToOrder(marketId, orderId, courierId, reassign) {
    return apiFetch(`/markets/${marketId}/orders/${encodeURIComponent(orderId)}/assign-courier`, {
      method: "POST",
      body: JSON.stringify({ courierId, reassign })
    });
  }
  /** Unassign courier from a MARKET delivery order. */
  async unassignCourierFromOrder(marketId, orderId) {
    return apiFetch(`/markets/${marketId}/orders/${encodeURIComponent(orderId)}/assign-courier`, {
      method: "DELETE"
    });
  }
  /** Log contact for an order (e.g. WhatsApp message). Appends to contactLog.entries. */
  async logOrderContact(marketId, orderId, message) {
    return apiFetch(`/markets/${marketId}/orders/${encodeURIComponent(orderId)}/contact`, {
      method: "POST",
      body: JSON.stringify({ message })
    });
  }
  /** Delivery jobs */
  async getDeliveryJobs(marketId) {
    return apiFetch(`/markets/${marketId}/delivery-jobs`);
  }
  async createDeliveryJob(marketId, items) {
    return apiFetch(`/markets/${marketId}/delivery-jobs`, {
      method: "POST",
      body: JSON.stringify({ items })
    });
  }
  async assignDeliveryJob(marketId, jobId, courierId) {
    return apiFetch(`/markets/${marketId}/delivery-jobs/${jobId}/assign`, {
      method: "PATCH",
      body: JSON.stringify({ courierId })
    });
  }
  async getCatalogApi(tenantId) {
    if (this.useApi) {
      return apiFetch(`/catalog/${tenantId}`);
    }
    const cat = getCatalog(tenantId);
    return { ...cat };
  }
  async setCatalogApi(tenantId, catalog) {
    if (this.useApi) {
      await apiFetch(`/catalog/${tenantId}`, {
        method: "PUT",
        body: JSON.stringify({
          categories: catalog.categories ?? [],
          products: catalog.products ?? [],
          optionGroups: catalog.optionGroups ?? [],
          optionItems: catalog.optionItems ?? []
        })
      });
      return;
    }
    const { setCatalog: sc } = await import("./catalog-store-2R3BPBIF.js");
    sc(tenantId, {
      categories: catalog.categories ?? [],
      products: catalog.products ?? [],
      optionGroups: catalog.optionGroups ?? [],
      optionItems: catalog.optionItems ?? []
    });
  }
  async listOrdersByTenant(tenantId) {
    if (this.useApi) {
      return apiFetch(`/tenants/${encodeURIComponent(tenantId)}/orders`);
    }
    const { listOrdersByTenant: lot } = await import("./orders-store-RLSYT6H3.js");
    return lot(tenantId);
  }
  async updateOrderStatus(orderId, status) {
    if (this.useApi) {
      try {
        return await apiFetch(`/orders/${orderId}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status })
        });
      } catch {
        return null;
      }
    }
    const { updateOrderStatus: uos } = await import("./orders-store-RLSYT6H3.js");
    return uos(orderId, status);
  }
  async listCampaignsApi(tenantId) {
    if (this.useApi) {
      return apiFetch(`/campaigns?tenantId=${encodeURIComponent(tenantId)}`);
    }
    return listCampaigns(tenantId);
  }
  async getDeliverySettingsApi(tenantId) {
    if (this.useApi) {
      try {
        return await apiFetch(`/delivery/${tenantId}`);
      } catch {
        return null;
      }
    }
    return getDeliverySettings(tenantId);
  }
  async saveDeliverySettingsApi(tenantId, settings) {
    if (this.useApi) {
      await apiFetch(`/delivery/${tenantId}`, {
        method: "PUT",
        body: JSON.stringify(settings)
      });
      return;
    }
    const { saveDeliverySettings: saveDeliverySettings2 } = await import("./delivery-store-HY2L4THJ.js");
    saveDeliverySettings2(tenantId, settings);
  }
  async listDeliveryZonesApi(tenantId) {
    return this.getDeliveryZones(tenantId);
  }
  async createDeliveryZoneApi(tenantId, zone) {
    if (this.useApi) {
      return apiFetch(`/tenants/${tenantId}/delivery-zones`, {
        method: "POST",
        body: JSON.stringify(zone)
      });
    }
    const { getDeliveryZones: getDeliveryZones2, setDeliveryZones: setDeliveryZones2 } = await import("./delivery-zones-store-T5MGZOKG.js");
    const id = generateId2();
    const newZone = { ...zone, id, tenantId };
    const zones = [...getDeliveryZones2(tenantId), newZone];
    setDeliveryZones2(tenantId, zones);
    return newZone;
  }
  async updateDeliveryZoneApi(tenantId, zoneId, updates) {
    if (this.useApi) {
      try {
        return await apiFetch(`/tenants/${tenantId}/delivery-zones/${zoneId}`, {
          method: "PUT",
          body: JSON.stringify(updates)
        });
      } catch {
        return null;
      }
    }
    const { getDeliveryZones: getDeliveryZones2, setDeliveryZones: setDeliveryZones2 } = await import("./delivery-zones-store-T5MGZOKG.js");
    const zones = getDeliveryZones2(tenantId);
    const idx = zones.findIndex((z) => z.id === zoneId);
    if (idx === -1) return null;
    zones[idx] = { ...zones[idx], ...updates };
    setDeliveryZones2(tenantId, zones);
    return zones[idx];
  }
  async patchDeliveryZoneApi(tenantId, zoneId, updates) {
    if (this.useApi) {
      try {
        return await apiFetch(`/tenants/${tenantId}/delivery-zones/${zoneId}`, {
          method: "PATCH",
          body: JSON.stringify(updates)
        });
      } catch {
        return null;
      }
    }
    return this.updateDeliveryZoneApi(tenantId, zoneId, updates);
  }
  async deleteDeliveryZoneApi(tenantId, zoneId) {
    if (this.useApi) {
      try {
        await apiFetch(`/tenants/${tenantId}/delivery-zones/${zoneId}`, { method: "DELETE" });
        return true;
      } catch {
        return false;
      }
    }
    const { getDeliveryZones: getDeliveryZones2, setDeliveryZones: setDeliveryZones2 } = await import("./delivery-zones-store-T5MGZOKG.js");
    const zones = getDeliveryZones2(tenantId).filter((z) => z.id !== zoneId);
    if (zones.length === getDeliveryZones2(tenantId).length) return false;
    setDeliveryZones2(tenantId, zones);
    return true;
  }
  async updateBrandingApi(tenantId, updates) {
    if (this.useApi) {
      await apiFetch(`/tenants/${tenantId}/branding`, {
        method: "PUT",
        body: JSON.stringify(updates)
      });
      return;
    }
    const { updateTenant: updateTenant2 } = await import("./tenant-registry-V2NDKWYC.js");
    const t = getTenantById(tenantId);
    if (t) updateTenant2(tenantId, { ...updates });
  }
  /** Apply quick-start template (hero, banners, categories, option groups) for a tenant. */
  async applyTemplateApi(tenantId, _templateId) {
    const { buildClothingTemplateForTenant: buildClothingTemplateForTenant2 } = await import("./quick-start-templates-GHIXLUVR.js");
    const template = buildClothingTemplateForTenant2(tenantId);
    await this.updateBrandingApi(tenantId, {
      hero: template.hero,
      banners: template.banners
    });
    const catalog = await this.getCatalogApi(tenantId);
    await this.setCatalogApi(tenantId, {
      categories: template.categories,
      products: catalog.products ?? [],
      optionGroups: template.optionGroups
    });
  }
};
function getTenantListForMall() {
  if (MOCK_API_URL) return [];
  return listEnabledTenants().map(registryToTenant);
}
function marketTenantToTenant(m) {
  return {
    id: m.id,
    name: m.name,
    slug: m.slug,
    type: m.type === "CLOTHING" || m.type === "FOOD" ? m.type : "GENERAL",
    marketCategory: m.marketCategory ?? "GENERAL",
    branding: {
      logoUrl: m.branding?.logoUrl ?? "",
      primaryColor: m.branding?.primaryColor ?? "#7C3AED",
      secondaryColor: "#d4a574",
      fontFamily: '"Cairo", system-ui, sans-serif',
      radiusScale: 1,
      layoutStyle: "default"
    }
  };
}
async function getTenantListForMallAsync(marketSlugOrId) {
  if (!MOCK_API_URL) {
    return Promise.resolve(listEnabledTenants().map(registryToTenant));
  }
  const slugOrId = marketSlugOrId ?? "dabburiyya";
  try {
    const isMarketId = slugOrId.startsWith("market-") || /^[0-9a-f-]{36}$/i.test(slugOrId);
    let marketId;
    if (isMarketId) {
      marketId = slugOrId;
    } else {
      const market = await apiFetch(`/markets/by-slug/${slugOrId}`);
      if (!market?.id) return [];
      marketId = market.id;
    }
    const list = await apiFetch(`/markets/${marketId}/tenants`);
    return (Array.isArray(list) ? list : []).map(marketTenantToTenant);
  } catch {
    return [];
  }
}

// src/index.ts
function initMock() {
  seedTenants();
  seedCatalogForTenants();
  seedCampaigns();
  seedDelivery();
  seedDeliveryZones();
  seedTemplates();
  seedStaff();
}
export {
  CLOTHING_TEMPLATE,
  CUSTOMER_TOKEN_KEY,
  MockApiClient,
  addOrder,
  addStaff,
  buildClothingTemplateForTenant,
  createCampaign,
  createTenant,
  deleteCampaign,
  deleteOptionGroup,
  deleteOptionItem,
  ensureTenantCatalog,
  getCampaign,
  getCatalog,
  getDeliverySettings,
  getDeliveryZones,
  getOrder,
  getOrdersThisWeek,
  getOrdersToday,
  getTemplate,
  getTenantById,
  getTenantBySlug,
  getTenantListForMall,
  getTenantListForMallAsync,
  initMock,
  listCampaigns,
  listEnabledTenants,
  listOptionGroups,
  listOptionItemsByGroup,
  listOrders,
  listOrdersByTenant,
  listStaff,
  listTemplates,
  listTenants,
  removeStaff,
  saveDeliverySettings,
  searchProductsAcrossTenants,
  seedStaff,
  seedTemplates,
  setCatalog,
  setDeliveryZones,
  setMockApiTokenProvider,
  toggleCampaignStatus,
  toggleTenant,
  updateCampaign,
  updateOrderStatus,
  updateStaff,
  updateTenant,
  uploadFiles,
  upsertOptionGroup,
  upsertOptionItem
};
//# sourceMappingURL=index.js.map