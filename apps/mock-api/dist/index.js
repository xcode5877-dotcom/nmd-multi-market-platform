// src/index.ts
import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import jwt from "jsonwebtoken";
import { join as join3 } from "path";
import { existsSync as existsSync3, mkdirSync as mkdirSync2 } from "fs";

// src/store.ts
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from "fs";
import { join } from "path";
var DATA_FILE = join(process.cwd(), "data.json");
var ORDERS_DIR = join(process.cwd(), "..", "..", "packages", "mock", "data");
var ORDERS_FILE = join(ORDERS_DIR, "orders.json");
var ORDERS_TMP = join(ORDERS_DIR, "orders.tmp.json");
var DEFAULT_GLOBAL_CATEGORIES = [
  { id: "cat-food", title: "\u0637\u0639\u0627\u0645", icon: "\u{1F355}", isProfessional: false, sortOrder: 0, legacyCode: "FOOD" },
  { id: "cat-clothing", title: "\u0645\u0644\u0627\u0628\u0633", icon: "\u{1F6CD}", isProfessional: false, sortOrder: 1, legacyCode: "CLOTHING" },
  { id: "cat-groceries", title: "\u062E\u0636\u0627\u0631", icon: "\u{1F96C}", isProfessional: false, sortOrder: 2, legacyCode: "GROCERIES" },
  { id: "cat-butcher", title: "\u0645\u0644\u062D\u0645\u0629", icon: "\u{1F969}", isProfessional: false, sortOrder: 3, legacyCode: "BUTCHER" },
  { id: "cat-offers", title: "\u0639\u0631\u0648\u0636", icon: "\u{1F4E6}", isProfessional: false, sortOrder: 4, legacyCode: "OFFERS" },
  { id: "cat-professional", title: "\u062E\u062F\u0645\u0627\u062A \u0645\u0647\u0646\u064A\u0629", icon: "\u2696\uFE0F", isProfessional: true, sortOrder: 5, legacyCode: "GENERAL" }
];
var DEFAULT = {
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
  leads: []
};
var DEFAULT_HERO = {
  title: "\u0645\u0631\u062D\u0628\u0627\u064B \u0628\u0643",
  subtitle: "\u0627\u0643\u062A\u0634\u0641 \u0623\u0641\u0636\u0644 \u0627\u0644\u0645\u0646\u062A\u062C\u0627\u062A \u0644\u062F\u064A\u0646\u0627",
  ctaText: "\u062A\u0633\u0648\u0642 \u0627\u0644\u0622\u0646",
  ctaLink: "#"
};
function migrateTenant(t) {
  const tenant = t;
  if (!tenant.hero) {
    tenant.hero = DEFAULT_HERO;
  }
  if (!tenant.banners) {
    tenant.banners = [];
  }
  if (!tenant.type || !["CLOTHING", "FOOD", "GENERAL"].includes(tenant.type)) {
    tenant.type = "GENERAL";
  }
  if (!tenant.marketCategory) {
    tenant.marketCategory = "GENERAL";
  }
  if (tenant.isListedInMarket === void 0) {
    tenant.isListedInMarket = true;
  }
  if (!tenant.tenantType) {
    tenant.tenantType = tenant.type === "FOOD" ? "RESTAURANT" : "SHOP";
  }
  if (!tenant.deliveryProviderMode) {
    tenant.deliveryProviderMode = "TENANT";
  }
  if (tenant.allowMarketCourierFallback === void 0) {
    tenant.allowMarketCourierFallback = true;
  }
  if (tenant.defaultPrepTimeMin === void 0 && tenant.tenantType === "RESTAURANT") {
    tenant.defaultPrepTimeMin = 30;
  }
  if (!tenant.businessType) {
    tenant.businessType = tenant.type === "FOOD" ? "RESTAURANT" : "RETAIL";
  }
  if (!tenant.financialConfig) {
    tenant.financialConfig = {
      commissionType: "PERCENTAGE",
      commissionValue: 10,
      deliveryFeeModel: "TENANT"
    };
  }
  if (!tenant.paymentCapabilities) {
    tenant.paymentCapabilities = { cash: true, card: false };
  }
  if (!tenant.collections) {
    tenant.collections = [];
  }
  return tenant;
}
function migrateMarket(m) {
  const market = m;
  if (!market.paymentCapabilities) {
    market.paymentCapabilities = { cash: true, card: false };
  }
  return market;
}
function migrateCategory(c) {
  if (c.parentId === void 0) c.parentId = null;
  if (c.isVisible === void 0) c.isVisible = true;
  return c;
}
function migrateCourier(c) {
  const courier = c;
  if (courier.scopeType === "MARKET" && !courier.marketId) {
    courier.marketId = courier.scopeId;
  }
  return courier;
}
function load() {
  try {
    if (existsSync(DATA_FILE)) {
      const raw = readFileSync(DATA_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      const markets = (parsed.markets ?? []).map((m) => migrateMarket(m));
      const tenants = (parsed.tenants ?? []).map((t) => migrateTenant(t));
      const catalog = {};
      for (const [tid, cat] of Object.entries(parsed.catalog ?? {})) {
        const c = cat;
        catalog[tid] = {
          categories: (c.categories ?? []).map((x) => migrateCategory(x)),
          products: c.products ?? [],
          optionGroups: c.optionGroups ?? [],
          optionItems: c.optionItems ?? []
        };
      }
      const users = parsed.users ?? [];
      const auditEvents = parsed.auditEvents ?? [];
      const globalCategories = Array.isArray(parsed.globalCategories) && parsed.globalCategories.length > 0 ? parsed.globalCategories : [...DEFAULT_GLOBAL_CATEGORIES];
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
        couriers: (parsed.couriers ?? []).map((c) => migrateCourier(c)),
        customers: parsed.customers ?? [],
        deliveryJobs: parsed.deliveryJobs ?? [],
        templates: parsed.templates ?? [],
        staff: parsed.staff ?? [],
        globalCategories,
        leads: parsed.leads ?? []
      };
    }
  } catch {
  }
  return { ...DEFAULT, users: [], auditEvents: [] };
}
function save(data) {
  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
}
function loadOrders() {
  try {
    if (!existsSync(ORDERS_FILE)) return [];
    const raw = readFileSync(ORDERS_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
function saveOrders(orders) {
  try {
    if (!existsSync(ORDERS_DIR)) mkdirSync(ORDERS_DIR, { recursive: true });
    writeFileSync(ORDERS_TMP, JSON.stringify(orders, null, 2), "utf-8");
    renameSync(ORDERS_TMP, ORDERS_FILE);
  } catch (err) {
    console.error("Failed to persist orders:", err);
  }
}
var cache = null;
function getData() {
  if (!cache) cache = load();
  return cache;
}
function persist() {
  if (cache) save(cache);
}
function getMarkets() {
  return getData().markets;
}
function setMarkets(markets) {
  getData().markets = markets;
  persist();
}
function getTenants() {
  return getData().tenants;
}
function setTenants(tenants) {
  getData().tenants = tenants;
  persist();
}
function getUsers() {
  return getData().users;
}
function setUsers(users) {
  getData().users = users;
  persist();
}
function getAuditEvents() {
  return getData().auditEvents;
}
function appendAuditEvent(event) {
  const data = getData();
  const ev = {
    ...event,
    id: `audit-${crypto.randomUUID?.() ?? Date.now()}`,
    at: (/* @__PURE__ */ new Date()).toISOString()
  };
  data.auditEvents = [...data.auditEvents ?? [], ev];
  persist();
}
function getCatalog(tenantId) {
  const cat = getData().catalog[tenantId];
  if (!cat) {
    return { categories: [], products: [], optionGroups: [], optionItems: [] };
  }
  const categories = (cat.categories ?? []).map((c) => {
    const x = c;
    if (x.parentId === void 0) x.parentId = null;
    if (x.isVisible === void 0) x.isVisible = true;
    return x;
  });
  return {
    categories,
    products: cat.products ?? [],
    optionGroups: cat.optionGroups ?? [],
    optionItems: cat.optionItems ?? []
  };
}
function setCatalog(tenantId, catalog) {
  getData().catalog[tenantId] = {
    categories: catalog.categories ?? [],
    products: catalog.products ?? [],
    optionGroups: catalog.optionGroups ?? [],
    optionItems: catalog.optionItems ?? []
  };
  persist();
}
var ordersCache = null;
function getOrders() {
  if (ordersCache === null) ordersCache = loadOrders();
  return ordersCache;
}
function setOrders(orders) {
  ordersCache = orders;
  saveOrders(orders);
}
function getCampaigns() {
  return getData().campaigns;
}
function setCampaigns(campaigns) {
  getData().campaigns = campaigns;
  persist();
}
function getDelivery() {
  return getData().delivery;
}
function setDelivery(delivery) {
  getData().delivery = delivery;
  persist();
}
function getDeliveryZones(tenantId) {
  return getData().deliveryZones[tenantId] ?? [];
}
function setDeliveryZones(tenantId, zones) {
  getData().deliveryZones[tenantId] = zones;
  persist();
}
function getCouriers() {
  return getData().couriers ?? [];
}
function setCouriers(couriers) {
  getData().couriers = couriers;
  persist();
}
function getCustomers() {
  return getData().customers;
}
function setCustomers(customers) {
  getData().customers = customers;
  persist();
}
function getDeliveryJobs() {
  return getData().deliveryJobs ?? [];
}
function setDeliveryJobs(jobs) {
  getData().deliveryJobs = jobs;
  persist();
}
function getTemplates() {
  return getData().templates;
}
function getGlobalCategories() {
  const cats = getData().globalCategories;
  return (cats ?? []).length > 0 ? [...cats].sort((a, b) => a.sortOrder - b.sortOrder) : [...DEFAULT_GLOBAL_CATEGORIES];
}
function setGlobalCategories(categories) {
  getData().globalCategories = categories;
  persist();
}
function getStaff() {
  return getData().staff;
}
function setStaff(staff) {
  getData().staff = staff;
  persist();
}
function getLeads() {
  return getData().leads ?? [];
}
function appendLead(lead) {
  const data = getData();
  const full = {
    ...lead,
    id: `lead-${crypto.randomUUID?.() ?? Date.now()}`,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  };
  data.leads = [...data.leads ?? [], full];
  persist();
  return full;
}

// src/market-config.ts
import { readFileSync as readFileSync2, writeFileSync as writeFileSync2, existsSync as existsSync2 } from "fs";
import { join as join2 } from "path";
var CONFIG_FILE = join2(process.cwd(), "market-config.json");
var DEFAULT_BANNERS = [
  {
    id: "b1",
    imageUrl: "https://placehold.co/1200x514/6366f1/ffffff?text=\u0627\u0644\u0633\u0648\u0642",
    title: "\u0645\u0631\u062D\u0628\u0627\u064B \u0628\u0643\u0645",
    linkTo: "",
    active: true
  }
];
var DEFAULT_LAYOUT = [
  { id: "all", title: "\u062C\u0645\u064A\u0639 \u0627\u0644\u0645\u062D\u0644\u0627\u062A", type: "SLIDER", storeIds: [] }
];
var SEED_BANNERS = {
  dabburiyya: [
    { id: "b1", imageUrl: "https://placehold.co/1200x514/1e293b/ffffff?text=\u0639\u0631\u0636+\u062E\u0627\u0635", title: "\u0628\u064A\u062A\u0633\u0627 \u0625\u064A\u0637\u0627\u0644\u064A\u0629 \u0637\u0627\u0632\u062C\u0629", linkTo: "buffalo", active: true },
    { id: "b2", imageUrl: "https://placehold.co/1200x514/0f766e/ffffff?text=\u062A\u0648\u0635\u064A\u0644+\u0633\u0631\u064A\u0639", title: "\u0627\u0637\u0644\u0628 \u0645\u0646 \u0645\u062D\u0644\u0627\u062A\u0643 \u0627\u0644\u0645\u0641\u0636\u0644\u0629", linkTo: "buffalo", active: true }
  ],
  iksal: [
    { id: "b1", imageUrl: "https://placehold.co/1200x514/4f46e5/ffffff?text=\u0633\u0648\u0642+\u0625\u0643\u0633\u0627\u0644", title: "\u0645\u0631\u062D\u0628\u0627\u064B \u0628\u0643\u0645 \u0641\u064A \u0633\u0648\u0642 \u0625\u0643\u0633\u0627\u0644", linkTo: "buffalo", active: true }
  ]
};
var SEED_LAYOUT = {
  dabburiyya: [
    { id: "featured", title: "\u0645\u062D\u0644\u0627\u062A \u0645\u0645\u064A\u0632\u0629", type: "SLIDER", storeIds: ["buffalo"] },
    { id: "restaurants", title: "\u0623\u0641\u0636\u0644 \u0627\u0644\u0645\u0637\u0627\u0639\u0645", type: "SLIDER", storeIds: ["buffalo"] },
    { id: "new", title: "\u062C\u062F\u064A\u062F \u0641\u064A \u062F\u0628\u0648\u0631\u064A\u0629", type: "SLIDER", storeIds: ["buffalo"] }
  ],
  iksal: [{ id: "featured", title: "\u0645\u062D\u0644\u0627\u062A \u0645\u0645\u064A\u0632\u0629", type: "SLIDER", storeIds: ["buffalo"] }]
};
function load2() {
  try {
    if (existsSync2(CONFIG_FILE)) {
      const raw = readFileSync2(CONFIG_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      return {
        banners: parsed.banners ?? SEED_BANNERS,
        layout: parsed.layout ?? SEED_LAYOUT
      };
    }
  } catch {
  }
  return { banners: { ...SEED_BANNERS }, layout: { ...SEED_LAYOUT } };
}
function save2(store) {
  try {
    writeFileSync2(CONFIG_FILE, JSON.stringify(store, null, 2), "utf-8");
  } catch (err) {
    console.error("[market-config] Failed to persist:", err);
  }
}
var cache2 = null;
function getStore() {
  if (!cache2) cache2 = load2();
  return cache2;
}
function getBannersForMarket(marketSlug) {
  return getStore().banners[marketSlug] ?? DEFAULT_BANNERS;
}
function getLayoutForMarket(marketSlug) {
  return getStore().layout[marketSlug] ?? DEFAULT_LAYOUT;
}
function setBannersForMarket(marketSlug, banners) {
  const store = getStore();
  store.banners[marketSlug] = banners;
  save2(store);
}
function setLayoutForMarket(marketSlug, layout) {
  const store = getStore();
  store.layout[marketSlug] = layout;
  save2(store);
}

// src/delivery-engine.ts
var NEAR_READY_WINDOW_MINUTES = 10;
var FALLBACK_SHOP_SERVICE_MINUTES = 5;
var FALLBACK_RESTAURANT_READY_MINUTES = 5;
var FALLBACK_RESTAURANT_NEAR_READY_MINUTES = 7;
function getTenant(tenants, tenantId) {
  return tenants.find((t) => t.id === tenantId);
}
function isOrderEligibleForMarketDispatch(order, tenants) {
  const tenant = order.tenantId ? getTenant(tenants, order.tenantId) : void 0;
  const tenantType = tenant?.tenantType ?? "SHOP";
  const mode = order.deliveryAssignmentMode ?? "TENANT";
  if (mode !== "MARKET") return false;
  if (order.fulfillmentType === "PICKUP") return false;
  if (["OUT_FOR_DELIVERY", "DELIVERED", "CANCELED"].includes(order.status ?? "")) return false;
  if (tenantType === "RESTAURANT") {
    const status = order.status ?? "PREPARING";
    if (status === "READY") return true;
    const readyAt = order.readyAt;
    if (!readyAt) return false;
    const now = Date.now();
    const readyMs = new Date(readyAt).getTime();
    const diffMin = (readyMs - now) / (60 * 1e3);
    return diffMin <= NEAR_READY_WINDOW_MINUTES;
  }
  return ["PREPARING", "READY", "NEW"].includes(order.status ?? "");
}
async function evaluateFallback(marketId, repos2) {
  const tenants = (await repos2.tenants.findAll()).filter((t) => t.marketId === marketId);
  const tenantIds = new Set(tenants.map((t) => t.id));
  const orders = await repos2.orders.findAll();
  const now = Date.now();
  let changed = false;
  const updated = orders.map((o) => {
    if (!o.tenantId || !tenantIds.has(o.tenantId)) return o;
    if (o.deliveryAssignmentMode === "MARKET" || o.fallbackTriggeredAt) return o;
    if (o.fulfillmentType === "PICKUP") return o;
    const tenant = getTenant(tenants, o.tenantId);
    if (!tenant?.allowMarketCourierFallback) return o;
    const createdAt = o.createdAt ? new Date(o.createdAt).getTime() : now;
    const elapsedMin = (now - createdAt) / (60 * 1e3);
    const tenantType = tenant.tenantType ?? "SHOP";
    if (tenantType === "RESTAURANT") {
      const status = o.status ?? "PREPARING";
      const readyAt = o.readyAt ? new Date(o.readyAt).getTime() : 0;
      const isReady = status === "READY";
      const isNearReady = !isReady && readyAt && (readyAt - now) / (60 * 1e3) <= NEAR_READY_WINDOW_MINUTES;
      if (isReady && elapsedMin >= FALLBACK_RESTAURANT_READY_MINUTES) {
        changed = true;
        return { ...o, deliveryAssignmentMode: "MARKET", fallbackTriggeredAt: (/* @__PURE__ */ new Date()).toISOString() };
      }
      if (isNearReady && elapsedMin >= FALLBACK_RESTAURANT_NEAR_READY_MINUTES) {
        changed = true;
        return { ...o, deliveryAssignmentMode: "MARKET", fallbackTriggeredAt: (/* @__PURE__ */ new Date()).toISOString() };
      }
    } else {
      if (elapsedMin >= FALLBACK_SHOP_SERVICE_MINUTES) {
        changed = true;
        return { ...o, deliveryAssignmentMode: "MARKET", fallbackTriggeredAt: (/* @__PURE__ */ new Date()).toISOString() };
      }
    }
    return o;
  });
  if (changed) await repos2.orders.setAll(updated);
}
async function getDispatchQueue(marketId, repos2) {
  await evaluateFallback(marketId, repos2);
  const tenants = (await repos2.tenants.findAll()).filter((t) => t.marketId === marketId);
  const tenantIds = new Set(tenants.map((t) => t.id));
  const orders = await repos2.orders.findAll();
  const jobs = getDeliveryJobs();
  const activeJobOrderIds = new Set(
    jobs.filter((j) => !["CANCELED", "DONE"].includes(j.status)).flatMap((j) => j.items.map((i) => i.orderId))
  );
  return orders.filter((o) => o.tenantId && tenantIds.has(o.tenantId)).filter((o) => isOrderEligibleForMarketDispatch(o, tenants)).filter((o) => !o.courierId).filter((o) => !activeJobOrderIds.has(o.id ?? "")).sort((a, b) => {
    const aReady = a.readyAt ? new Date(a.readyAt).getTime() : 0;
    const bReady = b.readyAt ? new Date(b.readyAt).getTime() : 0;
    if (aReady && bReady) return aReady - bReady;
    return (a.createdAt ?? "").localeCompare(b.createdAt ?? "");
  });
}

// src/repos/json-repos.ts
function createJsonMarketsRepo() {
  return {
    async findAll() {
      return getMarkets();
    },
    async setAll(markets) {
      setMarkets(markets);
    }
  };
}
function createJsonTenantsRepo() {
  return {
    async findAll() {
      return getTenants();
    },
    async setAll(tenants) {
      setTenants(tenants);
    }
  };
}
function createJsonUsersRepo() {
  return {
    async findAll() {
      return getUsers();
    },
    async setAll(users) {
      setUsers(users);
    }
  };
}
function createJsonCouriersRepo() {
  return {
    async findAll() {
      return getCouriers();
    },
    async setAll(couriers) {
      setCouriers(couriers);
    }
  };
}
function createJsonCustomersRepo() {
  return {
    async findAll() {
      return getCustomers();
    },
    async setAll(customers) {
      setCustomers(customers);
    }
  };
}
function createJsonOrdersRepo() {
  return {
    async findAll() {
      const orders = getOrders();
      return orders.map((o) => ({ ...o, orderType: o.orderType ?? "PRODUCT" }));
    },
    async setAll(orders) {
      setOrders(orders);
    },
    async addOrderWithPayment(order) {
      const orders = getOrders();
      setOrders([...orders, { ...order, orderType: order.orderType ?? "PRODUCT" }]);
    }
  };
}
function createJsonCatalogRepo() {
  return {
    async getCatalog(tenantId) {
      return getCatalog(tenantId);
    },
    async setCatalog(tenantId, catalog) {
      setCatalog(tenantId, catalog);
    }
  };
}
function defaultDeliverySettings(tenantId) {
  return {
    tenantId,
    modes: { pickup: true, delivery: true },
    minimumOrder: 0,
    deliveryFee: 5,
    zones: []
  };
}
function createJsonDeliveryRepo() {
  return {
    async getSettings(tenantId) {
      const d = getDelivery();
      const s = d[tenantId];
      return s != null ? s : defaultDeliverySettings(tenantId);
    },
    async setSettings(tenantId, settings) {
      const d = getDelivery();
      d[tenantId] = { ...settings, tenantId };
      setDelivery(d);
    }
  };
}
function createJsonDeliveryZonesRepo() {
  return {
    async getByTenant(tenantId) {
      return getDeliveryZones(tenantId);
    },
    async setAll(tenantId, zones) {
      setDeliveryZones(tenantId, zones);
    }
  };
}
function createJsonPaymentsRepo() {
  return {
    async createForOrder() {
    }
  };
}

// src/repos/db-repos.ts
import { PrismaClient } from "@prisma/client";
var prisma = new PrismaClient();
function marketToDomain(m) {
  return {
    id: m.id,
    name: m.name,
    slug: m.slug,
    branding: m.branding ? JSON.parse(m.branding) : void 0,
    isActive: m.isActive,
    sortOrder: m.sortOrder ?? void 0,
    paymentCapabilities: m.paymentCapabilities ? JSON.parse(m.paymentCapabilities) : void 0
  };
}
function tenantToDomain(t) {
  return {
    id: t.id,
    slug: t.slug,
    name: t.name,
    logoUrl: t.logoUrl,
    primaryColor: t.primaryColor,
    secondaryColor: t.secondaryColor,
    fontFamily: t.fontFamily,
    radiusScale: t.radiusScale,
    layoutStyle: t.layoutStyle,
    enabled: t.enabled,
    createdAt: t.createdAt,
    templateId: t.templateId ?? void 0,
    hero: t.hero ? JSON.parse(t.hero) : void 0,
    banners: t.banners ? JSON.parse(t.banners) : void 0,
    whatsappPhone: t.whatsappPhone ?? void 0,
    type: t.type ?? void 0,
    businessType: t.businessType ?? void 0,
    marketCategory: t.marketCategory ?? void 0,
    marketId: t.marketId ?? void 0,
    isListedInMarket: t.isListedInMarket ?? void 0,
    marketSortOrder: t.marketSortOrder ?? void 0,
    tenantType: t.tenantType ?? void 0,
    deliveryProviderMode: t.deliveryProviderMode ?? void 0,
    allowMarketCourierFallback: t.allowMarketCourierFallback ?? void 0,
    defaultPrepTimeMin: t.defaultPrepTimeMin ?? void 0,
    financialConfig: t.financialConfig ? JSON.parse(t.financialConfig) : void 0,
    paymentCapabilities: t.paymentCapabilities ? JSON.parse(t.paymentCapabilities) : void 0
  };
}
function orderToDomain(o) {
  const base = {
    id: o.id,
    tenantId: o.tenantId ?? void 0,
    courierId: o.courierId ?? void 0,
    marketId: o.marketId ?? void 0,
    status: o.status ?? void 0,
    fulfillmentType: o.fulfillmentType ?? void 0,
    orderType: o.orderType ?? "PRODUCT",
    total: o.total ?? void 0,
    createdAt: o.createdAt ?? void 0
  };
  if (o.payment) base.payment = JSON.parse(o.payment);
  if (o.deliveryTimeline) base.deliveryTimeline = JSON.parse(o.deliveryTimeline);
  if (o.payload) {
    const payload = JSON.parse(o.payload);
    Object.assign(base, payload);
  }
  return base;
}
function orderToDb(order) {
  const { id, tenantId, courierId, marketId, status, fulfillmentType, orderType, total, createdAt, payment, deliveryTimeline, ...rest } = order;
  return {
    id: String(id ?? ""),
    tenantId: tenantId != null ? String(tenantId) : null,
    courierId: courierId != null ? String(courierId) : null,
    marketId: marketId != null ? String(marketId) : null,
    status: status != null ? String(status) : null,
    fulfillmentType: fulfillmentType != null ? String(fulfillmentType) : null,
    orderType: orderType != null ? String(orderType) : "PRODUCT",
    total: typeof total === "number" ? total : null,
    createdAt: createdAt != null ? String(createdAt) : null,
    payment: payment != null ? JSON.stringify(payment) : null,
    deliveryTimeline: deliveryTimeline != null ? JSON.stringify(deliveryTimeline) : null,
    payload: Object.keys(rest).length > 0 ? JSON.stringify(rest) : null
  };
}
function createDbMarketsRepo() {
  return {
    async findAll() {
      const rows = await prisma.market.findMany();
      return rows.map(marketToDomain);
    },
    async setAll(markets) {
      await prisma.market.deleteMany();
      if (markets.length > 0) {
        await prisma.market.createMany({
          data: markets.map((m) => ({
            id: m.id,
            name: m.name,
            slug: m.slug,
            branding: m.branding ? JSON.stringify(m.branding) : null,
            isActive: m.isActive ?? true,
            sortOrder: m.sortOrder ?? null,
            paymentCapabilities: m.paymentCapabilities ? JSON.stringify(m.paymentCapabilities) : null
          }))
        });
      }
    }
  };
}
function createDbTenantsRepo() {
  return {
    async findAll() {
      const rows = await prisma.tenant.findMany();
      return rows.map(tenantToDomain);
    },
    async setAll(tenants) {
      await prisma.tenant.deleteMany();
      if (tenants.length > 0) {
        await prisma.tenant.createMany({
          data: tenants.map((t) => ({
            id: t.id,
            slug: t.slug,
            name: t.name,
            logoUrl: t.logoUrl ?? "",
            primaryColor: t.primaryColor ?? "#000",
            secondaryColor: t.secondaryColor ?? "#fff",
            fontFamily: t.fontFamily ?? "inherit",
            radiusScale: t.radiusScale ?? 1,
            layoutStyle: t.layoutStyle ?? "default",
            enabled: t.enabled ?? true,
            createdAt: t.createdAt ?? (/* @__PURE__ */ new Date()).toISOString(),
            templateId: t.templateId ?? null,
            hero: t.hero ? JSON.stringify(t.hero) : null,
            banners: t.banners ? JSON.stringify(t.banners) : null,
            whatsappPhone: t.whatsappPhone ?? null,
            type: t.type ?? null,
            businessType: t.businessType ?? (t.type === "FOOD" ? "RESTAURANT" : "RETAIL"),
            marketCategory: t.marketCategory ?? null,
            marketId: t.marketId ?? null,
            isListedInMarket: t.isListedInMarket ?? null,
            marketSortOrder: t.marketSortOrder ?? null,
            tenantType: t.tenantType ?? null,
            deliveryProviderMode: t.deliveryProviderMode ?? null,
            allowMarketCourierFallback: t.allowMarketCourierFallback ?? null,
            defaultPrepTimeMin: t.defaultPrepTimeMin ?? null,
            financialConfig: t.financialConfig ? JSON.stringify(t.financialConfig) : null,
            paymentCapabilities: t.paymentCapabilities ? JSON.stringify(t.paymentCapabilities) : null
          }))
        });
      }
    }
  };
}
function createDbUsersRepo() {
  return {
    async findAll() {
      const rows = await prisma.user.findMany();
      return rows.map((u) => ({
        id: u.id,
        email: u.email,
        role: u.role,
        marketId: u.marketId ?? void 0,
        tenantId: u.tenantId ?? void 0,
        courierId: u.courierId ?? void 0,
        password: u.password ?? void 0
      }));
    },
    async setAll(users) {
      await prisma.user.deleteMany();
      if (users.length > 0) {
        await prisma.user.createMany({
          data: users.map((u) => ({
            id: u.id,
            email: u.email,
            role: u.role,
            marketId: u.marketId ?? null,
            tenantId: u.tenantId ?? null,
            courierId: u.courierId ?? null,
            password: u.password ?? null
          }))
        });
      }
    }
  };
}
function createDbCouriersRepo() {
  return {
    async findAll() {
      const rows = await prisma.courier.findMany();
      return rows.map((c) => ({
        id: c.id,
        scopeType: c.scopeType,
        scopeId: c.scopeId,
        marketId: c.marketId ?? void 0,
        name: c.name,
        phone: c.phone ?? void 0,
        isActive: c.isActive,
        isOnline: c.isOnline,
        capacity: c.capacity,
        isAvailable: c.isAvailable ?? void 0,
        deliveryCount: c.deliveryCount ?? void 0
      }));
    },
    async setAll(couriers) {
      await prisma.courier.deleteMany();
      if (couriers.length > 0) {
        await prisma.courier.createMany({
          data: couriers.map((c) => ({
            id: c.id,
            scopeType: c.scopeType,
            scopeId: c.scopeId,
            marketId: c.marketId ?? null,
            name: c.name,
            phone: c.phone ?? null,
            isActive: c.isActive ?? true,
            isOnline: c.isOnline ?? false,
            capacity: c.capacity ?? 1,
            isAvailable: c.isAvailable ?? null,
            deliveryCount: c.deliveryCount ?? null
          }))
        });
      }
    }
  };
}
function createDbCustomersRepo() {
  return {
    async findAll() {
      const rows = await prisma.customer.findMany();
      return rows.map((c) => ({
        id: c.id,
        phone: c.phone,
        createdAt: c.createdAt
      }));
    },
    async setAll(customers) {
      await prisma.customer.deleteMany();
      if (customers.length > 0) {
        await prisma.customer.createMany({
          data: customers.map((c) => ({
            id: c.id,
            phone: c.phone,
            createdAt: c.createdAt ?? (/* @__PURE__ */ new Date()).toISOString()
          }))
        });
      }
    }
  };
}
function createDbOrdersRepo() {
  return {
    async findAll() {
      const rows = await prisma.order.findMany();
      return rows.map(orderToDomain);
    },
    async setAll(orders) {
      await prisma.order.deleteMany();
      if (orders.length > 0) {
        for (const o of orders) {
          const rec = orderToDb(o);
          if (rec.id) await prisma.order.create({ data: rec });
        }
      }
    },
    async addOrderWithPayment(order, payment) {
      const rec = orderToDb(order);
      const orderId = rec.id;
      if (!orderId) throw new Error("Order id required");
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const paymentId = `pay-${orderId}`;
      await prisma.$transaction([
        prisma.order.create({ data: rec }),
        prisma.payment.upsert({
          where: { id: paymentId },
          create: {
            id: paymentId,
            orderId,
            method: payment.method,
            status: payment.status,
            amount: payment.amount,
            currency: payment.currency ?? "ILS",
            provider: null,
            providerRef: null,
            createdAt: now,
            updatedAt: now
          },
          update: {
            status: payment.status,
            amount: payment.amount,
            updatedAt: now
          }
        })
      ]);
    }
  };
}
function catalogToDomain(categories, products, optionGroups) {
  const catArr = categories.map((c) => ({
    id: c.id,
    tenantId: c.tenantId,
    name: c.name,
    slug: c.slug,
    description: c.description ?? void 0,
    imageUrl: c.imageUrl ?? void 0,
    sortOrder: c.sortOrder,
    parentId: c.parentId ?? void 0,
    isVisible: c.isVisible ?? true
  }));
  const prodArr = products.map((p) => {
    const base = {
      id: p.id,
      tenantId: p.tenantId,
      categoryId: p.categoryId,
      name: p.name,
      slug: p.slug,
      description: p.description ?? void 0,
      type: p.type,
      basePrice: p.basePrice,
      currency: p.currency,
      imageUrl: p.imageUrl ?? void 0,
      stock: p.stock ?? void 0,
      isAvailable: p.isAvailable,
      createdAt: p.createdAt ?? void 0,
      isFeatured: p.isFeatured ?? void 0
    };
    if (p.images) base.images = JSON.parse(p.images);
    if (p.optionGroups) base.optionGroups = JSON.parse(p.optionGroups);
    if (p.variants) base.variants = JSON.parse(p.variants);
    return base;
  });
  const grpArr = optionGroups.map((g) => {
    const base = {
      id: g.id,
      tenantId: g.tenantId,
      name: g.name,
      type: g.type ?? void 0,
      required: g.required,
      minSelected: g.minSelected,
      maxSelected: g.maxSelected,
      selectionType: g.selectionType,
      scope: g.scope ?? void 0,
      scopeId: g.scopeId ?? void 0,
      allowHalfPlacement: g.allowHalfPlacement ?? void 0
    };
    base.items = g.items ? JSON.parse(g.items) : [];
    return base;
  });
  const itemArr = grpArr.flatMap((g) => g.items ?? []);
  return {
    categories: catArr,
    products: prodArr,
    optionGroups: grpArr,
    optionItems: itemArr
  };
}
function createDbCatalogRepo() {
  return {
    async getCatalog(tenantId) {
      const [categories, products, optionGroups] = await Promise.all([
        prisma.catalogCategory.findMany({ where: { tenantId } }),
        prisma.catalogProduct.findMany({ where: { tenantId } }),
        prisma.catalogOptionGroup.findMany({ where: { tenantId } })
      ]);
      return catalogToDomain(categories, products, optionGroups);
    },
    async setCatalog(tenantId, catalog) {
      await prisma.$transaction([
        prisma.catalogCategory.deleteMany({ where: { tenantId } }),
        prisma.catalogProduct.deleteMany({ where: { tenantId } }),
        prisma.catalogOptionGroup.deleteMany({ where: { tenantId } })
      ]);
      const cats = catalog.categories ?? [];
      const prods = catalog.products ?? [];
      const grps = catalog.optionGroups ?? [];
      for (const c of cats) {
        if (c.id) {
          await prisma.catalogCategory.create({
            data: {
              id: c.id,
              tenantId,
              name: c.name ?? "",
              slug: c.slug ?? "",
              description: c.description ?? null,
              imageUrl: c.imageUrl ?? null,
              sortOrder: c.sortOrder ?? 0,
              parentId: c.parentId ?? null,
              isVisible: c.isVisible ?? true
            }
          });
        }
      }
      for (const p of prods) {
        if (p.id) {
          await prisma.catalogProduct.create({
            data: {
              id: p.id,
              tenantId,
              categoryId: p.categoryId ?? "",
              name: p.name ?? "",
              slug: p.slug ?? "",
              description: p.description ?? null,
              type: p.type ?? "SIMPLE",
              basePrice: p.basePrice ?? 0,
              currency: p.currency ?? "ILS",
              imageUrl: p.imageUrl ?? null,
              images: p.images != null ? JSON.stringify(p.images) : null,
              optionGroups: p.optionGroups != null ? JSON.stringify(p.optionGroups) : null,
              variants: p.variants != null ? JSON.stringify(p.variants) : null,
              stock: p.stock ?? null,
              isAvailable: p.isAvailable ?? true,
              createdAt: p.createdAt ?? null,
              isFeatured: p.isFeatured ?? null
            }
          });
        }
      }
      for (const g of grps) {
        if (g.id) {
          await prisma.catalogOptionGroup.create({
            data: {
              id: g.id,
              tenantId,
              name: g.name ?? "",
              type: g.type ?? null,
              required: g.required ?? false,
              minSelected: g.minSelected ?? 0,
              maxSelected: g.maxSelected ?? 1,
              selectionType: g.selectionType ?? "single",
              scope: g.scope ?? null,
              scopeId: g.scopeId ?? null,
              allowHalfPlacement: g.allowHalfPlacement ?? null,
              items: g.items != null ? JSON.stringify(g.items) : null
            }
          });
        }
      }
    }
  };
}
function defaultDeliverySettings2(tenantId) {
  return {
    tenantId,
    modes: { pickup: true, delivery: true },
    minimumOrder: 0,
    deliveryFee: 5,
    zones: []
  };
}
function createDbDeliveryRepo() {
  return {
    async getSettings(tenantId) {
      const row = await prisma.tenantDeliverySettings.findUnique({ where: { tenantId } });
      if (!row) {
        const def = defaultDeliverySettings2(tenantId);
        await this.setSettings(tenantId, def);
        return def;
      }
      const out = {
        tenantId: row.tenantId,
        minimumOrder: row.minimumOrder,
        deliveryFee: row.deliveryFee
      };
      if (row.modes) out.modes = JSON.parse(row.modes);
      if (row.payload) Object.assign(out, JSON.parse(row.payload));
      return out;
    },
    async setSettings(tenantId, settings) {
      const { modes, minimumOrder, deliveryFee, ...rest } = settings;
      const payload = Object.keys(rest).length > 0 ? JSON.stringify(rest) : null;
      await prisma.tenantDeliverySettings.upsert({
        where: { tenantId },
        create: {
          tenantId,
          modes: modes != null ? JSON.stringify(modes) : null,
          minimumOrder: typeof minimumOrder === "number" ? minimumOrder : 0,
          deliveryFee: typeof deliveryFee === "number" ? deliveryFee : 0,
          payload
        },
        update: {
          modes: modes != null ? JSON.stringify(modes) : void 0,
          minimumOrder: typeof minimumOrder === "number" ? minimumOrder : void 0,
          deliveryFee: typeof deliveryFee === "number" ? deliveryFee : void 0,
          payload: payload ?? void 0
        }
      });
    }
  };
}
function createDbDeliveryZonesRepo() {
  return {
    async getByTenant(tenantId) {
      const rows = await prisma.deliveryZone.findMany({
        where: { tenantId },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
      });
      return rows.map((z) => ({
        id: z.id,
        tenantId: z.tenantId,
        name: z.name,
        fee: z.fee,
        etaMinutes: z.etaMinutes ?? void 0,
        isActive: z.isActive,
        sortOrder: z.sortOrder ?? void 0
      }));
    },
    async setAll(tenantId, zones) {
      await prisma.deliveryZone.deleteMany({ where: { tenantId } });
      if (zones.length > 0) {
        await prisma.deliveryZone.createMany({
          data: zones.map((z) => ({
            id: z.id,
            tenantId,
            name: z.name,
            fee: z.fee,
            etaMinutes: z.etaMinutes ?? null,
            minimumOrder: z.minimumOrder != null ? Number(z.minimumOrder) : null,
            geo: z.geo != null ? JSON.stringify(z.geo) : null,
            isActive: z.isActive ?? true,
            sortOrder: z.sortOrder ?? null
          }))
        });
      }
    }
  };
}
function createDbPaymentsRepo() {
  return {
    async createForOrder(orderId, payment) {
      const order = await prisma.order.findUnique({ where: { id: orderId } });
      if (!order) throw new Error(`Order ${orderId} not found; cannot create Payment`);
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const id = `pay-${orderId}`;
      await prisma.payment.upsert({
        where: { id },
        create: {
          id,
          orderId,
          method: payment.method,
          status: payment.status,
          amount: payment.amount,
          currency: payment.currency ?? "ILS",
          provider: null,
          providerRef: null,
          createdAt: now,
          updatedAt: now
        },
        update: {
          status: payment.status,
          amount: payment.amount,
          updatedAt: now
        }
      });
    }
  };
}

// src/repos/index.ts
var STORAGE_DRIVER = (process.env.STORAGE_DRIVER ?? "json").toLowerCase();
function createRepos() {
  if (STORAGE_DRIVER === "db") {
    return {
      markets: createDbMarketsRepo(),
      tenants: createDbTenantsRepo(),
      users: createDbUsersRepo(),
      couriers: createDbCouriersRepo(),
      customers: createDbCustomersRepo(),
      orders: createDbOrdersRepo(),
      catalog: createDbCatalogRepo(),
      delivery: createDbDeliveryRepo(),
      deliveryZones: createDbDeliveryZonesRepo(),
      payments: createDbPaymentsRepo()
    };
  }
  return {
    markets: createJsonMarketsRepo(),
    tenants: createJsonTenantsRepo(),
    users: createJsonUsersRepo(),
    couriers: createJsonCouriersRepo(),
    customers: createJsonCustomersRepo(),
    orders: createJsonOrdersRepo(),
    catalog: createJsonCatalogRepo(),
    delivery: createJsonDeliveryRepo(),
    deliveryZones: createJsonDeliveryZonesRepo(),
    payments: createJsonPaymentsRepo()
  };
}

// src/customer-auth.ts
import { createHash, randomInt } from "crypto";
var OTP_TTL_MS = 5 * 60 * 1e3;
var MAX_ATTEMPTS = 3;
var RATE_LIMIT_WINDOW_MS = 60 * 60 * 1e3;
var RATE_LIMIT_START_MAX = 5;
var LOCK_MS = 10 * 60 * 1e3;
var otpStore = /* @__PURE__ */ new Map();
var rateLimitStore = /* @__PURE__ */ new Map();
function normalizePhone(phone) {
  return String(phone ?? "").replace(/\D/g, "").slice(-10) || phone;
}
function hashCode(code) {
  return createHash("sha256").update(String(code).trim()).digest("hex");
}
function generateOtp() {
  return String(randomInt(1e3, 9999));
}
function createOtp(phone) {
  const key = normalizePhone(phone);
  if (!key || key.length < 9) return { ok: false, error: "Invalid phone", code: "INVALID_PHONE" };
  const now = Date.now();
  const rl = rateLimitStore.get(key);
  if (rl) {
    if (now - rl.windowStart > RATE_LIMIT_WINDOW_MS) {
      rateLimitStore.set(key, { count: 1, windowStart: now });
    } else if (rl.count >= RATE_LIMIT_START_MAX) {
      return { ok: false, error: "Too many requests", code: "RATE_LIMITED" };
    } else {
      rl.count++;
    }
  } else {
    rateLimitStore.set(key, { count: 1, windowStart: now });
  }
  const code = generateOtp();
  otpStore.set(key, {
    codeHash: hashCode(code),
    expiresAt: now + OTP_TTL_MS,
    attempts: 0,
    lockedUntil: 0
  });
  if (process.env.NODE_ENV !== "production") {
    console.log(`[dev] OTP for ${phone}: ${code} (expires in 5 min)`);
    return { ok: true, devCode: code };
  }
  return { ok: true };
}
function verifyOtp(phone, code) {
  const key = normalizePhone(phone);
  const entry = otpStore.get(key);
  if (!entry) return { ok: false, error: "Invalid or expired code", code: "OTP_INVALID" };
  const now = Date.now();
  if (now < entry.lockedUntil) {
    return { ok: false, error: "Too many failed attempts. Try again later.", code: "OTP_LOCKED" };
  }
  if (now > entry.expiresAt) {
    otpStore.delete(key);
    return { ok: false, error: "Code expired", code: "OTP_EXPIRED" };
  }
  entry.attempts++;
  const inputHash = hashCode(code);
  if (inputHash !== entry.codeHash) {
    if (entry.attempts >= MAX_ATTEMPTS) {
      entry.lockedUntil = now + LOCK_MS;
      return { ok: false, error: "Too many failed attempts. Locked for 10 minutes.", code: "OTP_LOCKED" };
    }
    return { ok: false, error: "Invalid code", code: "OTP_INVALID" };
  }
  otpStore.delete(key);
  return { ok: true };
}

// src/index.ts
var PORT = Number(process.env.PORT ?? 5190);
var repos = createRepos();
function wrapAsync(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
var JWT_SECRET = process.env.JWT_SECRET ?? "nmd-dev-secret-2026";
console.log("[MockAPI] JWT_SECRET loaded:", JWT_SECRET ? `${JWT_SECRET.slice(0, 8)}...` : "MISSING (using default)");
var app = express();
var DABBURIYYA_MARKET_ID = "market-dabburiyya";
var IKSAL_MARKET_ID = "market-iksal";
var ROOT_ADMIN_ID = "user-root-admin";
var BUFFALO28_TENANT_ID = "78463821-ccb7-48af-841b-84a18c42abb6";
var OBR_TENANT_ID = "3f801fb9-f6f9-4e81-b3a2-f8954498cdac";
var TOP_MARKET_TENANT_ID = "60904bcc-970a-45e3-8669-8015ee2afe64";
async function seedUsersIfNeeded() {
  const users = await repos.users.findAll();
  const seeds = [
    { id: ROOT_ADMIN_ID, email: "root@nmd.com", role: "ROOT_ADMIN", password: "123456" },
    { id: "user-dab-admin", email: "dab@nmd.com", role: "MARKET_ADMIN", marketId: DABBURIYYA_MARKET_ID, password: "123456" },
    { id: "user-iks-admin", email: "iks@nmd.com", role: "MARKET_ADMIN", marketId: IKSAL_MARKET_ID, password: "123456" },
    { id: "user-buffalo-admin", email: "buffalo@admin.com", role: "TENANT_ADMIN", tenantId: BUFFALO28_TENANT_ID, password: "123456" },
    { id: "user-tenant-ms-brands", email: "ms-brands@nmd.com", role: "TENANT_ADMIN", tenantId: "5b35539f-90e1-49cc-8c32-8d26cdce20f2", password: "ms-brands@2026" },
    { id: "user-tenant-obr", email: "obr@nmd.com", role: "TENANT_ADMIN", tenantId: OBR_TENANT_ID, password: "obr@2026" },
    { id: "user-tenant-top-market", email: "top-market@nmd.com", role: "TENANT_ADMIN", tenantId: TOP_MARKET_TENANT_ID, password: "top-market@2026" },
    { id: "user-tenant-lawyer-falan", email: "lawyer@nmd.com", role: "TENANT_ADMIN", tenantId: "a7b8c9d0-e1f2-4a3b-8c9d-0e1f2a3b4c5d", password: "123456" },
    { id: "user-courier-dab-1", email: "ahmed@courier.nmd.com", role: "COURIER", marketId: DABBURIYYA_MARKET_ID, courierId: "courier-50971b77-4811-49e8-825b-78bd84041782", password: "123456" },
    { id: "user-courier-iksal-1", email: "courier@iksal.nmd.com", role: "COURIER", marketId: IKSAL_MARKET_ID, courierId: "courier-iksal-001", password: "123456" }
  ];
  if (users.length === 0) {
    await repos.users.setAll(seeds);
    return;
  }
  let changed = false;
  const next = [...users];
  for (const seed of seeds) {
    const idx = next.findIndex((u) => u.email?.toLowerCase() === seed.email.toLowerCase() || u.id === seed.id);
    if (idx >= 0) {
      if (!next[idx].password) {
        next[idx] = { ...next[idx], ...seed };
        changed = true;
      }
    } else {
      next.push(seed);
      changed = true;
    }
  }
  if (changed) await repos.users.setAll(next);
}
async function seedMarketsIfNeeded() {
  const markets = await repos.markets.findAll();
  if (markets.length > 0) return;
  const newMarkets = [
    { id: DABBURIYYA_MARKET_ID, name: "\u0633\u0648\u0642 \u062F\u0628\u0648\u0631\u064A\u0629 \u0627\u0644\u0631\u0642\u0645\u064A", slug: "dabburiyya", isActive: true, sortOrder: 0 },
    { id: IKSAL_MARKET_ID, name: "\u0633\u0648\u0642 \u0625\u0643\u0633\u0627\u0644 \u0627\u0644\u0631\u0642\u0645\u064A", slug: "iksal", isActive: true, sortOrder: 1 }
  ];
  await repos.markets.setAll(newMarkets);
}
async function seedTenantMarketIdsIfNeeded() {
  const markets = await repos.markets.findAll();
  const dabburiyya = markets.find((m) => m.slug === "dabburiyya");
  if (!dabburiyya) return;
  const tenants = await repos.tenants.findAll();
  let changed = false;
  for (const t of tenants) {
    if (!t.marketId) {
      t.marketId = dabburiyya.id;
      t.isListedInMarket = true;
      changed = true;
    }
  }
  if (changed) await repos.tenants.setAll(tenants);
}
async function seedOrdersIfNeeded() {
  const orders = await repos.orders.findAll();
  if (orders.length > 0) return;
  const tenants = await repos.tenants.findAll();
  const msBrands = tenants.find((t) => t.slug === "ms-brands");
  if (!msBrands?.marketId) return;
  const seed = {
    id: "order-seed-delivery-1",
    tenantId: msBrands.id,
    marketId: msBrands.marketId,
    status: "PREPARING",
    fulfillmentType: "DELIVERY",
    deliveryAssignmentMode: "MARKET",
    total: 50,
    subtotal: 45,
    currency: "ILS",
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    readyAt: new Date(Date.now() + 30 * 60 * 1e3).toISOString(),
    items: [],
    customerName: "Test",
    customerPhone: "0501234567"
  };
  await repos.orders.setAll([seed]);
}
async function seedDeliveryZonesIfNeeded() {
  const tenants = await repos.tenants.findAll();
  for (const t of tenants) {
    const existing = await repos.deliveryZones.getByTenant(t.id);
    if (existing.length > 0) continue;
    const slug = t.slug ?? "";
    let zones = [];
    if (slug === "buffalo" || slug === "pizza") {
      zones = [
        { id: `dz-${t.id}-1`, tenantId: t.id, name: "\u0627\u0644\u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0648\u0633\u0637\u0649", fee: 15, etaMinutes: 30, isActive: true, sortOrder: 0 },
        { id: `dz-${t.id}-2`, tenantId: t.id, name: "\u0627\u0644\u0634\u0645\u0627\u0644", fee: 20, etaMinutes: 45, isActive: true, sortOrder: 1 },
        { id: `dz-${t.id}-3`, tenantId: t.id, name: "\u0627\u0644\u062C\u0646\u0648\u0628", fee: 18, etaMinutes: 40, isActive: true, sortOrder: 2 },
        { id: `dz-${t.id}-4`, tenantId: t.id, name: "\u0627\u0644\u0634\u0631\u0642", fee: 22, etaMinutes: 50, isActive: true, sortOrder: 3 },
        { id: `dz-${t.id}-5`, tenantId: t.id, name: "\u0627\u0644\u063A\u0631\u0628", fee: 25, etaMinutes: 55, isActive: true, sortOrder: 4 },
        { id: `dz-${t.id}-6`, tenantId: t.id, name: "\u0636\u0648\u0627\u062D\u064A", fee: 30, etaMinutes: 60, isActive: true, sortOrder: 5 },
        { id: `dz-${t.id}-7`, tenantId: t.id, name: "\u062E\u0627\u0631\u062C \u0627\u0644\u0645\u062F\u064A\u0646\u0629", fee: 40, etaMinutes: 90, isActive: true, sortOrder: 6 }
      ];
    } else if (slug === "ms-brands") {
      zones = [{ id: `dz-${t.id}-1`, tenantId: t.id, name: "\u0627\u0644\u062A\u0648\u0635\u064A\u0644 \u0627\u0644\u0639\u0627\u0645", fee: 10, etaMinutes: 45, isActive: true, sortOrder: 0 }];
    } else {
      zones = [
        { id: `dz-${t.id}-1`, tenantId: t.id, name: "\u0627\u0644\u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0627\u0641\u062A\u0631\u0627\u0636\u064A\u0629", fee: 10, etaMinutes: 45, isActive: true, sortOrder: 0 }
      ];
    }
    await repos.deliveryZones.setAll(t.id, zones);
  }
}
var UPLOADS_DIR = join3(process.cwd(), "..", "..", "packages", "mock", "uploads");
var UPLOADS_BANNERS_DIR = join3(UPLOADS_DIR, "banners");
if (!existsSync3(UPLOADS_DIR)) mkdirSync2(UPLOADS_DIR, { recursive: true });
if (!existsSync3(UPLOADS_BANNERS_DIR)) mkdirSync2(UPLOADS_BANNERS_DIR, { recursive: true });
var storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = (file.originalname.match(/\.([^.]+)$/)?.[1] ?? "jpg").toLowerCase();
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
    cb(null, name);
  }
});
var upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files allowed"));
  }
});
var BANNER_MAX_BYTES = 2 * 1024 * 1024;
var ALLOWED_BANNER_MIMES = ["image/webp", "image/jpeg", "image/jpg", "image/png"];
var bannerStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_BANNERS_DIR),
  filename: (_req, file, cb) => {
    const ext = (file.originalname.match(/\.([^.]+)$/)?.[1] ?? "jpg").toLowerCase().replace("jpeg", "jpg");
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
    cb(null, name);
  }
});
var bannerUpload = multer({
  storage: bannerStorage,
  limits: { fileSize: BANNER_MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_BANNER_MIMES.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Banner: only WebP, JPG, PNG allowed"));
  }
});
var corsOptions = {
  origin: true,
  // Reflect request origin (required when credentials: true; * not allowed)
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "X-Emergency-Mode"],
  exposedHeaders: ["Authorization"],
  credentials: true
};
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use((req, res, next) => {
  if (req.headers.origin) res.setHeader("Access-Control-Allow-Origin", req.headers.origin);
  next();
});
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use((req, res, next) => {
  if (req.method === "POST" && req.path === "/upload/banner") {
    return bannerUpload.single("file")(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message });
      next();
    });
  }
  if (req.method === "POST" && req.path === "/upload") {
    return upload.array("files", 20)(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message });
      next();
    });
  }
  next();
});
app.use("/uploads", cors({ origin: "*", methods: ["GET", "OPTIONS"] }), express.static(UPLOADS_DIR));
var PUBLIC_ROUTES = [
  { method: "POST", path: /^\/auth\/login$/ },
  { method: "GET", path: /^\/health$/ },
  { method: "GET", path: /^\/storefront\/tenants$/ },
  { method: "GET", path: /^\/markets$/ },
  { method: "GET", path: /^\/markets\/by-slug\/[^/]+$/ },
  { method: "GET", path: /^\/markets\/by-slug\/[^/]+\/banners$/ },
  { method: "GET", path: /^\/markets\/by-slug\/[^/]+\/layout$/ },
  { method: "GET", path: /^\/markets\/[^/]+\/tenants$/ },
  { method: "GET", path: /^\/tenants\/by-slug\/[^/]+$/ },
  { method: "GET", path: /^\/tenants\/by-id\/[^/]+$/ },
  { method: "GET", path: /^\/catalog\/[^/]+$/ },
  { method: "POST", path: /^\/orders$/ },
  { method: "GET", path: /^\/customer\/auth\/check-phone$/ },
  { method: "POST", path: /^\/customer\/auth\/start$/ },
  { method: "POST", path: /^\/customer\/auth\/verify$/ },
  { method: "GET", path: /^\/campaigns$/ },
  { method: "GET", path: /^\/delivery\/[^/]+$/ },
  { method: "GET", path: /^\/tenants\/[^/]+\/delivery-zones$/ },
  { method: "GET", path: /^\/public\/orders\/[^/]+$/ },
  { method: "GET", path: /^\/global-categories$/ },
  { method: "POST", path: /^\/leads$/ },
  { method: "GET", path: /^\/merchant\/dashboard$/ },
  { method: "GET", path: /^\/merchant\/leads$/ }
];
function isPublicRoute(method, path) {
  return PUBLIC_ROUTES.some((r) => r.method === method && r.path.test(path));
}
app.use(async (req, _res, next) => {
  const token = req.query.token || req.headers.authorization?.split(" ")[1] || req.body?.access_token;
  const isUpload = req.method === "POST" && req.path === "/upload";
  if (isUpload) {
    console.log("[DEBUG-AUTH] Header:", req.headers.authorization, "Query:", req.query.token, "Body:", req.body?.access_token);
    const source = token ? req.query.token ? "query" : req.headers.authorization ? "header" : "body" : "MISSING";
    console.log("[Auth] POST /upload - token from:", source, token ? `${token.slice(0, 20)}...` : "");
    if (!token) console.log("[Auth] Incoming Headers (full):", req.headers);
  }
  req.user = void 0;
  req.customer = void 0;
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded.role === "CUSTOMER") {
        const customers = await repos.customers.findAll();
        const customer = customers.find((c) => c.id === decoded.sub);
        if (customer) req.customer = { id: customer.id, phone: customer.phone };
      } else {
        const users = await repos.users.findAll();
        const user = users.find((u) => u.id === decoded.sub);
        if (user) {
          req.user = { ...user, password: void 0 };
          if (isUpload) console.log("[Auth] req.user set from DB:", user.id, user.role);
        } else if (decoded.role && ["ROOT_ADMIN", "TENANT_ADMIN", "MARKET_ADMIN"].includes(decoded.role)) {
          req.user = { id: decoded.sub, email: `${decoded.sub}@jwt`, role: decoded.role, tenantId: decoded.tenantId, marketId: decoded.marketId };
          if (isUpload) console.log("[Auth] req.user set from JWT fallback (user not in DB):", decoded.sub, decoded.role);
        } else if (isUpload) {
          console.log("[Auth] User not found for sub:", decoded.sub, "role:", decoded.role, "- users:", users.map((u) => u.id));
        }
      }
    } catch (err) {
      console.log("[Auth] JWT verify failed:", err instanceof Error ? err.message : err, isUpload ? "(POST /upload)" : "");
    }
  }
  req.emergencyMode = String(req.headers["x-emergency-mode"] ?? "").toLowerCase() === "true";
  req.emergencyReason = req.body?._meta?.emergencyReason ?? "";
  next();
});
app.use(async (req, res, next) => {
  if (req.method !== "GET" || req.path !== "/courier/events") return next();
  if (req.user) return next();
  const token = req.query.token;
  if (!token) return next();
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const users = await repos.users.findAll();
    const user = users.find((u) => u.id === decoded.sub);
    if (user) req.user = { ...user, password: void 0 };
  } catch {
  }
  next();
});
app.use((req, res, next) => {
  if (req.path.startsWith("/uploads")) return next();
  if (isPublicRoute(req.method, req.path)) return next();
  if (req.path.startsWith("/customer/") && !req.path.startsWith("/customer/auth/")) {
    if (!req.customer) return res.status(401).json({ error: "Unauthorized" });
    return next();
  }
  if (req.user) return next();
  if (req.method === "POST" && (req.path === "/upload" || req.path === "/upload/banner")) {
    const hasAuth = !!req.get("Authorization");
    console.log("[Auth] 401 on POST", req.path, "- token", hasAuth ? "present but invalid or user not found" : "MISSING");
  }
  return res.status(401).json({ error: "Unauthorized" });
});
app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "email and password required" });
  const users = await repos.users.findAll();
  const user = users.find((u) => u.email?.toLowerCase() === String(email).trim().toLowerCase());
  if (!user || user.password !== password) {
    return res.status(401).json({ error: "Invalid email or password" });
  }
  const token = jwt.sign(
    { sub: user.id, role: user.role, tenantId: user.tenantId, marketId: user.marketId },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
  res.json({ accessToken: token });
});
app.get("/auth/me", wrapAsync(async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  const u = req.user;
  let tenantSlug;
  if (u.tenantId) {
    const tenants = await repos.tenants.findAll();
    const t = tenants.find((x) => x.id === u.tenantId);
    tenantSlug = t?.slug;
  }
  res.json({
    id: u.id,
    email: u.email,
    role: u.role,
    marketId: u.marketId,
    tenantId: u.tenantId,
    tenantSlug: tenantSlug ?? void 0,
    courierId: u.courierId,
    mustChangePassword: u.mustChangePassword ?? false
  });
}));
app.get("/customer/auth/check-phone", async (req, res) => {
  const phone = req.query.phone;
  if (!phone || typeof phone !== "string") return res.status(400).json({ error: "phone required" });
  const key = normalizePhoneForMatch(phone);
  if (!key || key.length < 9) return res.status(400).json({ error: "Invalid phone" });
  const customers = await repos.customers.findAll();
  const exists = customers.some((c) => normalizePhoneForMatch(c.phone) === key);
  res.json({ exists });
});
app.post("/customer/auth/start", async (req, res) => {
  const { phone } = req.body;
  if (!phone || typeof phone !== "string") return res.status(400).json({ error: "phone required" });
  const result = createOtp(phone);
  if (!result.ok) return res.status(429).json({ error: result.error, code: result.code });
  res.json({ ok: true, ...result.devCode && { devCode: result.devCode } });
});
function normalizePhoneForMatch(phone) {
  return String(phone ?? "").replace(/\D/g, "").slice(-10);
}
app.post("/customer/auth/verify", async (req, res) => {
  const { phone, code, name } = req.body;
  if (!phone || !code) return res.status(400).json({ error: "phone and code required" });
  const result = verifyOtp(phone, code);
  if (!result.ok) {
    const status = result.code === "OTP_LOCKED" || result.code === "RATE_LIMITED" ? 429 : 401;
    return res.status(status).json({ error: result.error, code: result.code });
  }
  const key = normalizePhoneForMatch(phone);
  const customers = await repos.customers.findAll();
  let customer = customers.find((c) => normalizePhoneForMatch(c.phone) === key);
  const nameTrimmed = typeof name === "string" ? name.trim() : void 0;
  if (!customer) {
    const id = `customer-${crypto.randomUUID?.() ?? Date.now()}`;
    customer = { id, phone: String(phone).trim(), name: nameTrimmed || void 0, createdAt: (/* @__PURE__ */ new Date()).toISOString() };
    const next = [...customers, customer];
    await repos.customers.setAll(next);
  } else if (nameTrimmed && !customer.name) {
    customer = { ...customer, name: nameTrimmed };
    const next = customers.map((c) => c.id === customer.id ? customer : c);
    await repos.customers.setAll(next);
  }
  const token = jwt.sign({ sub: customer.id, role: "CUSTOMER" }, JWT_SECRET, { expiresIn: "30d" });
  res.json({ token, customer: { id: customer.id, phone: customer.phone, name: customer.name } });
});
app.get("/customer/me", async (req, res) => {
  const customer = req.customer;
  if (!customer) return res.status(401).json({ error: "Unauthorized" });
  const full = (await repos.customers.findAll()).find((c) => c.id === customer.id);
  res.json({ id: customer.id, phone: customer.phone, name: full?.name ?? customer.name });
});
app.get("/customer/activity", wrapAsync(async (req, res) => {
  const customer = req.customer;
  if (!customer) return res.status(401).json({ error: "Unauthorized" });
  const orders = await repos.orders.findAll();
  const customerOrders = orders.filter((o) => o.customerId === customer.id);
  const leads = getLeads();
  const customerLeads = leads.filter(
    (l) => l.type === "PROFESSIONAL_CONTACT" && l.metadata?.customerId === customer.id
  );
  const tenants = await repos.tenants.findAll();
  const ordersWithTenant = customerOrders.map((o) => {
    const t = tenants.find((x) => x.id === o.tenantId);
    return { ...o, tenantName: t?.name, tenantSlug: t?.slug };
  });
  const leadsWithTenant = customerLeads.map((l) => {
    const t = tenants.find((x) => x.id === l.tenantId);
    return { ...l, tenantName: t?.name, tenantSlug: t?.slug };
  });
  res.json({ orders: ordersWithTenant, leads: leadsWithTenant });
}));
function requireCourier(req, res) {
  const user = req.user;
  if (!user || user.role !== "COURIER" || !user.courierId || !user.marketId) {
    res.status(403).json({ error: "Courier access required" });
    return null;
  }
  return { courierId: user.courierId, marketId: user.marketId };
}
app.get("/courier/me", async (req, res) => {
  const scope = requireCourier(req, res);
  if (!scope) return;
  const courier = (await repos.couriers.findAll()).find((c) => c.id === scope.courierId);
  const market = (await repos.markets.findAll()).find((m) => m.id === scope.marketId);
  if (!courier || !market) return res.status(404).json({ error: "Courier or market not found" });
  if (courier.marketId !== scope.marketId) return res.status(403).json({ error: "Forbidden" });
  res.json({
    id: req.user.id,
    email: req.user.email,
    role: "COURIER",
    courierId: scope.courierId,
    marketId: scope.marketId,
    courier: { id: courier.id, name: courier.name, phone: courier.phone, isOnline: courier.isOnline, isAvailable: courier.isAvailable },
    market: { id: market.id, name: market.name }
  });
});
app.get("/courier/orders", wrapAsync(async (req, res) => {
  const scope = requireCourier(req, res);
  if (!scope) return;
  const orders = (await repos.orders.findAll()).filter((o) => o.fulfillmentType === "DELIVERY" && o.courierId === scope.courierId && o.status !== "CANCELED");
  const tenants = await repos.tenants.findAll();
  const enriched = orders.map((o) => {
    const t = o.tenantId ? tenants.find((x) => x.id === o.tenantId) : void 0;
    const tenant = t ? { name: t.name ?? "", phone: t.whatsappPhone, address: t.addressLine, location: t.location } : { name: "", phone: void 0, address: void 0, location: void 0 };
    const customer = { name: o.customerName ?? "", phone: o.customerPhone ?? "", deliveryAddress: o.deliveryAddress ?? "", deliveryLocation: o.deliveryLocation };
    const currency = o.currency ?? "ILS";
    const pay = o.payment;
    const orderTotal = pay?.financials?.gross ?? (Number(o.total) || 0);
    const paymentMethod = pay?.method ?? (o.paymentMethod === "CARD" ? "CARD" : "CASH");
    const amountToCollect = paymentMethod === "CASH" ? orderTotal : 0;
    return { ...o, tenant, customer, currency, orderTotal, paymentMethod, amountToCollect, cashChangeFor: o.cashChangeFor };
  });
  res.json(enriched);
}));
app.get("/courier/stats", async (req, res) => {
  const scope = requireCourier(req, res);
  if (!scope) return;
  const metrics = await computeCourierMetrics(scope.marketId, scope.courierId);
  res.json(metrics);
});
var VALID_ACTION_FROM_DELIVERY = {
  ASSIGNED: ["ACKNOWLEDGE"],
  IN_PROGRESS: ["PICKED_UP"],
  PICKED_UP: ["DELIVERED"],
  DELIVERED: ["FINISH"]
};
function computeDurations(tl) {
  const a = tl.assignedAt ? new Date(tl.assignedAt).getTime() : 0;
  const k = tl.acknowledgedAt ? new Date(tl.acknowledgedAt).getTime() : 0;
  const p = tl.pickedUpAt ? new Date(tl.pickedUpAt).getTime() : 0;
  const d = tl.deliveredAt ? new Date(tl.deliveredAt).getTime() : 0;
  if (!a || !d) return void 0;
  const mins = (x, y) => Math.round((y - x) / 6e4);
  const out = { totalMinutes: mins(a, d) };
  if (k) out.assignedToAcknowledged = mins(a, k);
  if (k && p) out.acknowledgedToPickedUp = mins(k, p);
  if (p) out.pickedUpToDelivered = mins(p, d);
  return out;
}
var DELIVERY_STATUS_TO_ACTION = {
  ASSIGNED: "ACKNOWLEDGE",
  PICKED_UP: "PICKED_UP",
  DELIVERED: "DELIVERED"
};
var VALID_ACTIONS = ["ACKNOWLEDGE", "PICKED_UP", "DELIVERED", "FINISH"];
async function computePaymentForOrder(order, tenantId) {
  const itemsTotal = order.subtotal ?? (order.items ?? []).reduce((s, i) => s + (Number(i.totalPrice) || 0), 0);
  const deliverySettings = await repos.delivery.getSettings(tenantId);
  const deliveryFee = order.delivery?.fee ?? deliverySettings?.deliveryFee ?? 0;
  const gross = Number(order.total) || itemsTotal + deliveryFee;
  const tenant = (await repos.tenants.findAll()).find((t) => t.id === tenantId);
  const cfg = tenant?.financialConfig ?? { commissionType: "PERCENTAGE", commissionValue: 10, deliveryFeeModel: "TENANT" };
  const commission = cfg.commissionType === "PERCENTAGE" ? Math.round(gross * (cfg.commissionValue / 100) * 100) / 100 : cfg.commissionValue;
  const gatewayFee = 0;
  const isMarketFee = cfg.deliveryFeeModel === "MARKET";
  const netToMarket = commission + gatewayFee + (isMarketFee ? deliveryFee : 0);
  const netToMerchant = gross - commission - gatewayFee - (isMarketFee ? deliveryFee : 0);
  return {
    method: "CASH",
    provider: "NMD",
    status: "PENDING",
    currency: "ILS",
    breakdown: { itemsTotal, deliveryFee },
    financials: { gross, commission, gatewayFee, netToMerchant, netToMarket }
  };
}
app.post("/courier/orders/:orderId/status", async (req, res) => {
  const scope = requireCourier(req, res);
  if (!scope) return;
  const { orderId } = req.params;
  const body = req.body ?? {};
  let action = body.action;
  if (!action && body.deliveryStatus != null) {
    action = DELIVERY_STATUS_TO_ACTION[body.deliveryStatus] ?? body.deliveryStatus;
  }
  if (!action) {
    return res.status(400).json({ error: "Missing action or deliveryStatus", code: "BAD_REQUEST", details: { expected: ["action", "deliveryStatus"] } });
  }
  if (!VALID_ACTIONS.includes(action)) {
    return res.status(400).json({ error: "Invalid action or deliveryStatus", code: "BAD_REQUEST", details: { received: body.action ?? body.deliveryStatus, validActions: VALID_ACTIONS } });
  }
  const orders = await repos.orders.findAll();
  const idx = orders.findIndex((o) => o.id === orderId);
  if (idx === -1) return res.status(404).json({ error: "Order not found" });
  const order = orders[idx];
  if (order.courierId !== scope.courierId) return res.status(403).json({ error: "Order not assigned to you", code: "FORBIDDEN" });
  const currentDeliveryStatus = order.deliveryStatus ?? "UNASSIGNED";
  const allowed = VALID_ACTION_FROM_DELIVERY[currentDeliveryStatus];
  if (!allowed?.includes(action)) {
    return res.status(409).json({
      error: `Invalid transition: ${currentDeliveryStatus} -> ${action}`,
      code: "INVALID_TRANSITION",
      details: { currentDeliveryStatus, action, allowed }
    });
  }
  const tl = { ...order.deliveryTimeline || {} };
  const hasAck = !!tl.acknowledgedAt;
  const hasPicked = !!tl.pickedUpAt;
  const hasDelivered = !!tl.deliveredAt;
  const hasClosed = !!tl.closedAt;
  if (action === "ACKNOWLEDGE" && hasAck) return res.json(order);
  if (action === "PICKED_UP" && hasPicked) return res.json(order);
  if (action === "DELIVERED" && hasDelivered) return res.json(order);
  if (action === "FINISH" && hasClosed) return res.json(order);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  if (action === "ACKNOWLEDGE") tl.acknowledgedAt = tl.acknowledgedAt ?? now;
  if (action === "PICKED_UP") tl.pickedUpAt = tl.pickedUpAt ?? now;
  if (action === "DELIVERED") {
    tl.deliveredAt = tl.deliveredAt ?? now;
    tl.durations = computeDurations(tl);
    const couriers = await repos.couriers.findAll();
    const cIdx = couriers.findIndex((c) => c.id === scope.courierId);
    if (cIdx >= 0) {
      couriers[cIdx] = { ...couriers[cIdx], isAvailable: true, deliveryCount: (couriers[cIdx].deliveryCount ?? 0) + 1 };
      await repos.couriers.setAll(couriers);
    }
  }
  if (action === "FINISH") {
    tl.closedAt = tl.closedAt ?? now;
    if (!tl.durations && tl.deliveredAt) {
      tl.durations = computeDurations(tl);
    }
  }
  const deliveryStatusMap = { ACKNOWLEDGE: "IN_PROGRESS", PICKED_UP: "PICKED_UP", DELIVERED: "DELIVERED", FINISH: "DELIVERED" };
  const newDeliveryStatus = deliveryStatusMap[action] ?? currentDeliveryStatus;
  const updated = { ...order, deliveryStatus: newDeliveryStatus, deliveryTimeline: tl };
  if (action === "DELIVERED") updated.deliveredAt = tl.deliveredAt;
  if (action === "FINISH") {
    const pay = updated.payment;
    if (pay && (pay.method === "CASH" || !pay.method)) {
      updated.payment = {
        ...pay,
        status: "COLLECTED",
        cashLedger: { collected: true, collectedAt: now, collectedByCourierId: scope.courierId }
      };
    }
  }
  orders[idx] = updated;
  await repos.orders.setAll(orders);
  res.json(orders[idx]);
});
var courierEventListeners = /* @__PURE__ */ new Map();
app.get("/courier/events", async (req, res) => {
  const scope = requireCourier(req, res);
  if (!scope) return;
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  const send = (data) => {
    try {
      res.write(`data: ${data}

`);
      res.flush?.();
    } catch {
      courierEventListeners.delete(scope.courierId);
    }
  };
  courierEventListeners.set(scope.courierId, send);
  send(JSON.stringify({ type: "connected", courierId: scope.courierId }));
  req.on("close", () => courierEventListeners.delete(scope.courierId));
});
function emitCourierAssigned(courierId, order) {
  const send = courierEventListeners.get(courierId);
  if (send) send(JSON.stringify({ type: "order_assigned", orderId: order.id, tenantId: order.tenantId }));
}
function emitCourierUnassigned(courierId, orderId) {
  const send = courierEventListeners.get(courierId);
  if (send) send(JSON.stringify({ type: "order_unassigned", orderId }));
}
app.post("/auth/change-password", async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "currentPassword and newPassword required" });
  }
  const users = await repos.users.findAll();
  const user = users.find((u) => u.id === req.user.id);
  if (!user) return res.status(401).json({ error: "User not found" });
  if (user.password !== currentPassword) {
    return res.status(400).json({ error: "Current password is incorrect" });
  }
  const updated = users.map(
    (u) => u.id === req.user.id ? { ...u, password: newPassword, mustChangePassword: false } : u
  );
  await repos.users.setAll(updated);
  res.json({ ok: true });
});
function requireWrite(req) {
  const user = req.user;
  if (!user) return false;
  if (user.role === "MARKET_ADMIN") return true;
  if (user.role === "ROOT_ADMIN") {
    const em = req.emergencyMode;
    return em === true;
  }
  return false;
}
function getEmergencyReason(req) {
  return req.emergencyReason?.trim() ?? "";
}
function requireWriteWithReason(req, res) {
  if (!requireWrite(req)) {
    res.status(403).json({ error: "Emergency mode required", code: "EMERGENCY_MODE_REQUIRED" });
    return false;
  }
  if (req.user?.role === "ROOT_ADMIN" && !getEmergencyReason(req)) {
    res.status(400).json({ error: "emergencyReason is required in body _meta when emergency mode is on", code: "EMERGENCY_REASON_REQUIRED" });
    return false;
  }
  return true;
}
var DEFAULT_HERO2 = {
  title: "\u0645\u0631\u062D\u0628\u0627\u064B \u0628\u0643",
  subtitle: "\u0627\u0643\u062A\u0634\u0641 \u0623\u0641\u0636\u0644 \u0627\u0644\u0645\u0646\u062A\u062C\u0627\u062A \u0644\u062F\u064A\u0646\u0627",
  ctaText: "\u062A\u0633\u0648\u0642 \u0627\u0644\u0622\u0646",
  ctaLink: "#"
};
function normalizeHero(h) {
  const base = h ?? DEFAULT_HERO2;
  const cta = base.ctaHref ?? base.ctaLink ?? "#";
  return { ...base, ctaLink: cta, ctaHref: cta };
}
function normalizeTenantResponse(t) {
  const type = t.type === "CLOTHING" || t.type === "FOOD" ? t.type : "GENERAL";
  return {
    ...t,
    type,
    hero: normalizeHero(t.hero),
    banners: t.banners ?? []
  };
}
async function resolveTenantId(tenantIdOrSlug) {
  const v = String(tenantIdOrSlug).trim();
  if (!v) return null;
  const tenants = await repos.tenants.findAll();
  const byId = tenants.find((t) => t.id === v);
  if (byId) return byId.id;
  const bySlug = tenants.find((t) => t.slug === v);
  return bySlug ? bySlug.id : null;
}
app.post("/leads", wrapAsync(async (req, res) => {
  const body = req.body;
  const tenantIdOrSlug = body.tenantId ?? body.tenantSlug;
  if (!tenantIdOrSlug || typeof tenantIdOrSlug !== "string") {
    return res.status(400).json({ error: "tenantId or tenantSlug required" });
  }
  const resolvedTenantId = await resolveTenantId(tenantIdOrSlug);
  if (!resolvedTenantId) {
    return res.status(400).json({ error: "Tenant not found" });
  }
  const rawType = body.type;
  const type = rawType === "PROFESSIONAL_CONTACT" ? "PROFESSIONAL_CONTACT" : rawType === "whatsapp" || rawType === "call" || rawType === "cta" ? rawType : "cta";
  const userAgent = req.headers["user-agent"] ?? "";
  const metadata = { ...body.metadata ?? {}, userAgent: userAgent || body.metadata?.userAgent };
  const lead = appendLead({
    tenantId: resolvedTenantId,
    type,
    status: body.status,
    contactType: body.contactType,
    metadata
  });
  res.status(201).json(lead);
}));
app.get("/leads", wrapAsync(async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  const caller = req.user;
  const querySlug = req.query.tenantSlug?.trim();
  const tenants = await repos.tenants.findAll();
  let filterTenantId = null;
  if (querySlug) {
    const resolved = await resolveTenantId(querySlug);
    if (!resolved) {
      return res.status(400).json({ error: "Tenant not found for tenantSlug" });
    }
    if (caller.role === "TENANT_ADMIN") {
      const myTenantId = String(caller.tenantId ?? "").trim();
      if (myTenantId && resolved !== myTenantId) return res.status(403).json({ error: "Forbidden: can only view own tenant leads" });
      filterTenantId = resolved;
    } else if (caller.role === "MARKET_ADMIN" && caller.marketId) {
      const t = tenants.find((x) => x.id === resolved);
      if (!t || t.marketId !== caller.marketId) return res.status(403).json({ error: "Forbidden: tenant not in your market" });
      filterTenantId = resolved;
    } else {
      filterTenantId = resolved;
    }
  }
  let leads = getLeads();
  if (caller.role === "ROOT_ADMIN") {
    if (filterTenantId) leads = leads.filter((l) => l.tenantId != null && String(l.tenantId).trim() === filterTenantId);
  } else if (caller.role === "TENANT_ADMIN") {
    const myTenantId = filterTenantId ?? String(caller.tenantId ?? "").trim();
    if (myTenantId) {
      const myTenant = tenants.find((t) => t.id === myTenantId);
      const mySlug = myTenant?.slug;
      leads = leads.filter((l) => {
        if (l.tenantId == null) return false;
        const tid = String(l.tenantId).trim();
        return tid === myTenantId || !!mySlug && tid === mySlug;
      });
    } else {
      leads = [];
    }
  } else if (caller.role === "MARKET_ADMIN" && caller.marketId) {
    const marketTenantIds = new Set(tenants.filter((t) => t.marketId === caller.marketId).map((t) => t.id));
    if (filterTenantId) {
      if (!marketTenantIds.has(filterTenantId)) leads = [];
      else leads = leads.filter((l) => l.tenantId != null && String(l.tenantId).trim() === filterTenantId);
    } else {
      leads = leads.filter((l) => marketTenantIds.has(l.tenantId));
    }
  }
  res.json(leads);
}));
app.get("/customers", wrapAsync(async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  const caller = req.user;
  const allCustomers = await repos.customers.findAll();
  const allOrders = await repos.orders.findAll();
  const allLeads = getLeads();
  if (caller.role === "ROOT_ADMIN") {
    return res.json(allCustomers);
  }
  if (caller.role === "TENANT_ADMIN" && caller.tenantId) {
    const myTenantId = String(caller.tenantId).trim();
    const customerIds = /* @__PURE__ */ new Set();
    allOrders.forEach((o) => {
      if (o.tenantId === myTenantId && o.customerId) customerIds.add(o.customerId);
    });
    allLeads.forEach((l) => {
      if (l.tenantId === myTenantId) {
        const cid = l.metadata?.customerId;
        if (cid) customerIds.add(cid);
      }
    });
    const filtered = allCustomers.filter((c) => customerIds.has(c.id));
    return res.json(filtered);
  }
  if (caller.role === "MARKET_ADMIN" && caller.marketId) {
    const tenants = await repos.tenants.findAll();
    const marketTenantIds = new Set(tenants.filter((t) => t.marketId === caller.marketId).map((t) => t.id));
    const customerIds = /* @__PURE__ */ new Set();
    allOrders.forEach((o) => {
      if (o.tenantId && marketTenantIds.has(o.tenantId) && o.customerId) customerIds.add(o.customerId);
    });
    allLeads.forEach((l) => {
      if (l.tenantId && marketTenantIds.has(l.tenantId)) {
        const cid = l.metadata?.customerId;
        if (cid) customerIds.add(cid);
      }
    });
    const filtered = allCustomers.filter((c) => customerIds.has(c.id));
    return res.json(filtered);
  }
  return res.status(403).json({ error: "Forbidden" });
}));
function leadBelongsToTenant(l, tenantId, tenantSlug) {
  if (!l.tenantId) return false;
  const tid = String(l.tenantId).trim();
  return tid === tenantId || !!tenantSlug && tid === tenantSlug;
}
app.get("/merchant/dashboard", wrapAsync(async (req, res) => {
  let tenantId;
  let tenantSlug;
  const caller = req.user;
  if (caller?.role === "TENANT_ADMIN" && caller.tenantId) {
    tenantId = caller.tenantId;
    const tenants = await repos.tenants.findAll();
    const t = tenants.find((x) => x.id === tenantId);
    tenantSlug = t?.slug;
  } else {
    const slug = req.query.tenantSlug?.trim();
    if (slug) {
      tenantSlug = slug;
      const tenants = await repos.tenants.findAll();
      const t = tenants.find((x) => x.slug === slug);
      tenantId = t?.id;
    }
  }
  if (!tenantId) {
    return res.status(400).json({ error: "tenantSlug required (or auth as TENANT_ADMIN)" });
  }
  const allCustomers = await repos.customers.findAll();
  const allOrders = await repos.orders.findAll();
  const allLeads = getLeads();
  const customerIds = /* @__PURE__ */ new Set();
  const recentByCustomer = /* @__PURE__ */ new Map();
  allOrders.forEach((o) => {
    if (o.tenantId === tenantId && o.customerId) {
      customerIds.add(o.customerId);
      const c = allCustomers.find((x) => x.id === o.customerId);
      const name = c?.name ?? o.customerName ?? "";
      const phone = c?.phone ?? o.customerPhone ?? "";
      const lastAt = o.createdAt ?? "";
      const existing = recentByCustomer.get(o.customerId);
      if (!existing || lastAt && (!existing.lastAt || lastAt > existing.lastAt)) {
        recentByCustomer.set(o.customerId, { name, phone, lastAt });
      }
    }
  });
  allLeads.forEach((l) => {
    if (leadBelongsToTenant(l, tenantId, tenantSlug)) {
      const cid = l.metadata?.customerId;
      if (cid) {
        customerIds.add(cid);
        const c = allCustomers.find((x) => x.id === cid);
        const ts = l.timestamp ?? "";
        const existing = recentByCustomer.get(cid);
        if (!existing || ts && (!existing.lastAt || ts > existing.lastAt)) {
          recentByCustomer.set(cid, { name: c?.name ?? "", phone: c?.phone ?? "", lastAt: ts });
        }
      }
    }
  });
  const recentLogins = Array.from(recentByCustomer.entries()).sort((a, b) => (b[1].lastAt || "").localeCompare(a[1].lastAt || "")).slice(0, 10).map(([, v]) => ({ name: v.name || "\u2014", phone: v.phone || "\u2014", lastVisit: v.lastAt }));
  res.json({ totalVisitors: customerIds.size, recentLogins });
}));
app.get("/merchant/leads", wrapAsync(async (req, res) => {
  const slug = req.query.tenantSlug?.trim();
  if (!slug) return res.status(400).json({ error: "tenantSlug required" });
  const tenantId = await resolveTenantId(slug);
  if (!tenantId) return res.status(404).json({ error: "Tenant not found" });
  const tenants = await repos.tenants.findAll();
  const t = tenants.find((x) => x.id === tenantId);
  const tenantSlug = t?.slug;
  const allLeads = getLeads();
  const list = allLeads.filter((l) => leadBelongsToTenant(l, tenantId, tenantSlug));
  list.sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
  res.json(list.slice(0, 50));
}));
app.get("/audit-events", async (req, res) => {
  if (req.user?.role !== "ROOT_ADMIN") return res.status(403).json({ error: "Forbidden" });
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const events = getAuditEvents().slice(-limit).reverse();
  res.json(events);
});
app.get("/monitoring/stats", async (req, res) => {
  if (req.user?.role !== "ROOT_ADMIN") return res.status(403).json({ error: "Forbidden" });
  const markets = await repos.markets.findAll();
  const tenants = await repos.tenants.findAll();
  const orders = await repos.orders.findAll();
  const stats = markets.map((m) => {
    const marketTenants = tenants.filter((t) => t.marketId === m.id);
    const tenantIds = new Set(marketTenants.map((t) => t.id));
    const marketOrders = orders.filter((o) => o.tenantId && tenantIds.has(o.tenantId));
    const revenue = marketOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    return {
      marketId: m.id,
      marketName: m.name,
      tenantCount: marketTenants.length,
      orderCount: marketOrders.length,
      revenue
    };
  });
  res.json(stats);
});
app.get("/users", async (req, res) => {
  if (req.user?.role !== "ROOT_ADMIN") return res.status(403).json({ error: "Forbidden" });
  const users = (await repos.users.findAll()).map((u) => ({ ...u, password: void 0 }));
  res.json(users);
});
app.post("/admin/users/:userId/reset-password", async (req, res) => {
  const caller = req.user;
  if (!caller) return res.status(401).json({ error: "Unauthorized" });
  const { userId } = req.params;
  const { newPassword } = req.body;
  if (!newPassword || typeof newPassword !== "string" || newPassword.length < 6) {
    return res.status(400).json({ error: "newPassword required (min 6 chars)" });
  }
  const users = await repos.users.findAll();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx === -1) return res.status(404).json({ error: "User not found" });
  const target = users[idx];
  if (caller.role === "ROOT_ADMIN") {
  } else if (caller.role === "MARKET_ADMIN" && caller.marketId) {
    if (target.role !== "TENANT_ADMIN" || !target.tenantId) {
      return res.status(403).json({ error: "Can only reset tenant admin passwords for stores in your market" });
    }
    const tenants = await repos.tenants.findAll();
    const tenant = tenants.find((t) => t.id === target.tenantId);
    if (!tenant || tenant.marketId !== caller.marketId) {
      return res.status(403).json({ error: "Store is not in your market" });
    }
  } else {
    return res.status(403).json({ error: "Forbidden" });
  }
  users[idx] = { ...users[idx], password: newPassword, mustChangePassword: true };
  await repos.users.setAll(users);
  appendAuditEvent({
    userId: caller.id,
    role: caller.role,
    marketId: caller.marketId,
    action: "update",
    entity: "user",
    entityId: userId,
    reason: `Password reset by ${caller.email}`
  });
  res.json({ ok: true });
});
app.get("/markets/:marketId/tenant-admins", async (req, res) => {
  const caller = req.user;
  if (!caller) return res.status(401).json({ error: "Unauthorized" });
  const { marketId } = req.params;
  if (caller.role === "MARKET_ADMIN" && caller.marketId !== marketId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const users = (await repos.users.findAll()).filter(
    (u) => u.role === "TENANT_ADMIN" && u.tenantId
  );
  const tenants = await repos.tenants.findAll();
  const marketTenantIds = new Set(
    tenants.filter((t) => t.marketId === marketId).map((t) => t.id)
  );
  const result = users.filter((u) => u.tenantId && marketTenantIds.has(u.tenantId)).map((u) => ({ ...u, password: void 0 }));
  res.json(result);
});
app.get("/tenants/:tenantId/tenant-admin", async (req, res) => {
  const caller = req.user;
  if (!caller) return res.status(401).json({ error: "Unauthorized" });
  const { tenantId } = req.params;
  const tenant = (await repos.tenants.findAll()).find((t) => t.id === tenantId);
  if (!tenant) return res.status(404).json({ error: "Tenant not found" });
  if (caller.role === "MARKET_ADMIN" && tenant.marketId !== caller.marketId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const users = await repos.users.findAll();
  const admin = users.find((u) => u.role === "TENANT_ADMIN" && u.tenantId === tenantId);
  if (!admin) return res.status(404).json({ error: "No tenant admin found" });
  res.json({ ...admin, password: void 0 });
});
app.post("/tenants/:tenantId/create-admin", async (req, res) => {
  const caller = req.user;
  if (!caller) return res.status(401).json({ error: "Unauthorized" });
  const { tenantId } = req.params;
  const body = req.body;
  const email = body.email?.trim();
  const password = body.password;
  if (!email || !password || password.length < 6) {
    return res.status(400).json({ error: "email and password required (password min 6 chars)" });
  }
  const tenants = await repos.tenants.findAll();
  const tenant = tenants.find((t) => t.id === tenantId);
  if (!tenant) return res.status(404).json({ error: "Tenant not found" });
  if (caller.role === "MARKET_ADMIN" && tenant.marketId !== caller.marketId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const users = await repos.users.findAll();
  const existingAdmin = users.find((u) => u.role === "TENANT_ADMIN" && u.tenantId === tenantId);
  if (existingAdmin) {
    return res.status(400).json({ error: "Tenant already has an admin account" });
  }
  const emailLower = email.toLowerCase();
  if (users.some((u) => u.email?.toLowerCase() === emailLower)) {
    return res.status(400).json({ error: "Email already in use" });
  }
  const userId = crypto.randomUUID?.() ?? `user-${Date.now()}`;
  users.push({
    id: userId,
    email: emailLower,
    role: "TENANT_ADMIN",
    tenantId,
    password
  });
  await repos.users.setAll(users);
  appendAuditEvent({
    userId: caller.id,
    role: caller.role,
    marketId: caller.marketId,
    action: "create",
    entity: "user",
    entityId: userId,
    reason: `Created tenant admin for ${tenant.name}`
  });
  res.status(201).json({ id: userId, email: emailLower, role: "TENANT_ADMIN", tenantId });
});
app.get("/global-categories", (_req, res) => {
  res.json(getGlobalCategories());
});
app.post("/global-categories", async (req, res) => {
  if (req.user?.role !== "ROOT_ADMIN") return res.status(403).json({ error: "Forbidden" });
  if (!requireWriteWithReason(req, res)) return;
  const body = req.body;
  const id = crypto.randomUUID?.() ?? `cat-${Date.now()}`;
  const cat = {
    id,
    title: body.title ?? "",
    icon: body.icon ?? "\u{1F4E6}",
    isProfessional: body.isProfessional ?? false,
    sortOrder: body.sortOrder ?? 999
  };
  const cats = getGlobalCategories();
  cats.push(cat);
  setGlobalCategories(cats);
  appendAuditEvent({
    userId: req.user.id,
    role: req.user.role,
    action: "create",
    entity: "globalCategory",
    entityId: id,
    reason: getEmergencyReason(req),
    emergencyMode: true,
    after: cat
  });
  res.status(201).json(cat);
});
app.put("/global-categories/:id", async (req, res) => {
  if (req.user?.role !== "ROOT_ADMIN") return res.status(403).json({ error: "Forbidden" });
  if (!requireWriteWithReason(req, res)) return;
  const { id } = req.params;
  const body = req.body;
  const cats = getGlobalCategories();
  const idx = cats.findIndex((c) => c.id === id);
  if (idx === -1) return res.status(404).json({ error: "Category not found" });
  const before = cats[idx];
  cats[idx] = { ...cats[idx], ...body };
  setGlobalCategories(cats);
  appendAuditEvent({
    userId: req.user.id,
    role: req.user.role,
    action: "update",
    entity: "globalCategory",
    entityId: id,
    reason: getEmergencyReason(req),
    emergencyMode: true,
    before,
    after: cats[idx]
  });
  res.json(cats[idx]);
});
app.delete("/global-categories/:id", async (req, res) => {
  if (req.user?.role !== "ROOT_ADMIN") return res.status(403).json({ error: "Forbidden" });
  if (!requireWriteWithReason(req, res)) return;
  const { id } = req.params;
  const cats = getGlobalCategories();
  const idx = cats.findIndex((c) => c.id === id);
  if (idx === -1) return res.status(404).json({ error: "Category not found" });
  const removed = cats[idx];
  cats.splice(idx, 1);
  setGlobalCategories(cats);
  appendAuditEvent({
    userId: req.user.id,
    role: req.user.role,
    action: "delete",
    entity: "globalCategory",
    entityId: id,
    reason: getEmergencyReason(req),
    emergencyMode: true,
    before: removed
  });
  res.status(204).send();
});
app.get("/markets", async (req, res) => {
  const user = req.user;
  let markets = await repos.markets.findAll();
  if (user?.role === "MARKET_ADMIN" && user.marketId) {
    markets = markets.filter((m) => m.id === user.marketId);
  } else {
    const all = req.query.all === "true";
    if (!all) markets = markets.filter((m) => m.isActive);
  }
  res.json([...markets].sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999)));
});
app.post("/markets", async (req, res) => {
  if (req.user?.role !== "ROOT_ADMIN") return res.status(403).json({ error: "Forbidden" });
  if (!requireWriteWithReason(req, res)) return;
  const body = req.body;
  const id = crypto.randomUUID?.() ?? `market-${Date.now()}`;
  const market = {
    id,
    name: body.name ?? "",
    slug: body.slug ?? id,
    branding: body.branding,
    isActive: body.isActive ?? true,
    sortOrder: body.sortOrder
  };
  const markets = await repos.markets.findAll();
  markets.push(market);
  await repos.markets.setAll(markets);
  appendAuditEvent({
    userId: req.user.id,
    role: req.user.role,
    action: "create",
    entity: "market",
    entityId: market.id,
    reason: getEmergencyReason(req),
    emergencyMode: true,
    after: market
  });
  const adminEmail = typeof body.adminEmail === "string" ? body.adminEmail.trim().toLowerCase() : "";
  const adminPassword = typeof body.adminPassword === "string" ? body.adminPassword : "";
  if (adminEmail && adminPassword.length >= 6) {
    const users = await repos.users.findAll();
    if (!users.some((u) => u.email?.toLowerCase() === adminEmail)) {
      const userId = `user-${crypto.randomUUID?.() ?? Date.now()}`;
      const newUser = {
        id: userId,
        email: adminEmail,
        role: "MARKET_ADMIN",
        marketId: market.id,
        password: adminPassword
      };
      users.push(newUser);
      await repos.users.setAll(users);
      appendAuditEvent({
        userId: req.user.id,
        role: req.user.role,
        marketId: market.id,
        action: "create",
        entity: "user",
        entityId: newUser.id,
        reason: getEmergencyReason(req),
        emergencyMode: true,
        after: newUser
      });
    }
  }
  res.status(201).json(market);
});
app.put("/markets/:id", async (req, res) => {
  if (req.user?.role !== "ROOT_ADMIN") return res.status(403).json({ error: "Forbidden" });
  if (!requireWriteWithReason(req, res)) return;
  const { id } = req.params;
  const body = req.body;
  const markets = await repos.markets.findAll();
  const idx = markets.findIndex((m) => m.id === id);
  if (idx === -1) return res.status(404).json({ error: "Market not found" });
  const before = markets[idx];
  markets[idx] = { ...markets[idx], ...body };
  await repos.markets.setAll(markets);
  appendAuditEvent({
    userId: req.user.id,
    role: req.user.role,
    action: "update",
    entity: "market",
    entityId: id,
    reason: getEmergencyReason(req),
    emergencyMode: true,
    before,
    after: markets[idx]
  });
  res.json(markets[idx]);
});
app.get("/markets/by-slug/:slug", async (req, res) => {
  const market = (await repos.markets.findAll()).find((m) => m.slug === req.params.slug);
  if (!market) return res.status(404).json({ error: "Market not found" });
  if (!market.isActive) return res.status(404).json({ error: "Market not found" });
  res.json(market);
});
app.get("/markets/by-slug/:slug/banners", async (req, res) => {
  const market = (await repos.markets.findAll()).find((m) => m.slug === req.params.slug);
  if (!market) return res.status(404).json({ error: "Market not found" });
  const banners = getBannersForMarket(req.params.slug);
  res.json(banners);
});
app.get("/markets/by-slug/:slug/layout", async (req, res) => {
  const market = (await repos.markets.findAll()).find((m) => m.slug === req.params.slug);
  if (!market) return res.status(404).json({ error: "Market not found" });
  const layout = getLayoutForMarket(req.params.slug);
  res.json(layout);
});
app.put("/markets/by-slug/:slug/banners", async (req, res) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  if (user.role !== "ROOT_ADMIN" && (user.role !== "MARKET_ADMIN" || user.marketId !== (await repos.markets.findAll()).find((m) => m.slug === req.params.slug)?.id)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const market = (await repos.markets.findAll()).find((m) => m.slug === req.params.slug);
  if (!market) return res.status(404).json({ error: "Market not found" });
  const banners = req.body;
  if (!Array.isArray(banners)) return res.status(400).json({ error: "banners must be an array" });
  setBannersForMarket(req.params.slug, banners);
  res.json(banners);
});
app.put("/markets/by-slug/:slug/layout", async (req, res) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  if (user.role !== "ROOT_ADMIN" && (user.role !== "MARKET_ADMIN" || user.marketId !== (await repos.markets.findAll()).find((m) => m.slug === req.params.slug)?.id)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const market = (await repos.markets.findAll()).find((m) => m.slug === req.params.slug);
  if (!market) return res.status(404).json({ error: "Market not found" });
  const layout = req.body;
  if (!Array.isArray(layout)) return res.status(400).json({ error: "layout must be an array" });
  setLayoutForMarket(req.params.slug, layout);
  res.json(layout);
});
app.get("/markets/:id", async (req, res) => {
  const market = (await repos.markets.findAll()).find((m) => m.id === req.params.id);
  if (!market) return res.status(404).json({ error: "Market not found" });
  if (req.user?.role === "MARKET_ADMIN" && req.user.marketId !== market.id) {
    return res.status(403).json({ error: "Forbidden" });
  }
  res.json(market);
});
app.get("/markets/:marketId/admins", async (req, res) => {
  if (req.user?.role !== "ROOT_ADMIN") return res.status(403).json({ error: "Forbidden" });
  const { marketId } = req.params;
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: "Market not found" });
  const admins = (await repos.users.findAll()).filter((u) => u.role === "MARKET_ADMIN" && u.marketId === marketId);
  res.json(admins);
});
app.post("/markets/:marketId/admins", async (req, res) => {
  if (req.user?.role !== "ROOT_ADMIN") return res.status(403).json({ error: "Forbidden" });
  if (!requireWriteWithReason(req, res)) return;
  const { marketId } = req.params;
  const { email, password } = req.body;
  if (!email || typeof email !== "string" || !email.trim()) {
    return res.status(400).json({ error: "email is required" });
  }
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: "Market not found" });
  const users = await repos.users.findAll();
  const existing = users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
  if (existing) return res.status(409).json({ error: "User with this email already exists" });
  const id = `user-${crypto.randomUUID?.() ?? Date.now()}`;
  const newUser = {
    id,
    email: email.trim().toLowerCase(),
    role: "MARKET_ADMIN",
    marketId,
    ...typeof password === "string" && password.length >= 6 ? { password } : {}
  };
  users.push(newUser);
  await repos.users.setAll(users);
  appendAuditEvent({
    userId: req.user.id,
    role: req.user.role,
    marketId,
    action: "create",
    entity: "user",
    entityId: newUser.id,
    reason: getEmergencyReason(req),
    emergencyMode: true,
    after: newUser
  });
  res.status(201).json(newUser);
});
app.put("/markets/:marketId/admin-credentials", async (req, res) => {
  if (req.user?.role !== "ROOT_ADMIN") return res.status(403).json({ error: "Forbidden" });
  if (!requireWriteWithReason(req, res)) return;
  const { marketId } = req.params;
  const { email, password } = req.body;
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: "Market not found" });
  const users = await repos.users.findAll();
  const marketAdmins = users.filter((u) => u.role === "MARKET_ADMIN" && u.marketId === marketId);
  const target = marketAdmins[0];
  if (target) {
    const newEmail = typeof email === "string" ? email.trim().toLowerCase() : void 0;
    const newPassword = typeof password === "string" && password.length >= 6 ? password : void 0;
    if (!newEmail && !newPassword) return res.status(400).json({ error: "email or password required" });
    const idx = users.findIndex((u) => u.id === target.id);
    if (idx === -1) return res.status(404).json({ error: "Admin not found" });
    if (newEmail) {
      const existing = users.find((u) => u.id !== target.id && u.email?.toLowerCase() === newEmail);
      if (existing) return res.status(409).json({ error: "User with this email already exists" });
      users[idx] = { ...users[idx], email: newEmail };
    }
    if (newPassword) users[idx] = { ...users[idx], password: newPassword };
    await repos.users.setAll(users);
    appendAuditEvent({
      userId: req.user.id,
      role: req.user.role,
      marketId,
      action: "update",
      entity: "user",
      entityId: target.id,
      reason: getEmergencyReason(req),
      emergencyMode: true,
      after: { ...users[idx], password: void 0 }
    });
    return res.json({ ...users[idx], password: void 0 });
  }
  if (typeof email !== "string" || !email.trim() || typeof password !== "string" || password.length < 6) {
    return res.status(400).json({ error: "email and password required (password min 6 chars) when creating first admin" });
  }
  const adminEmail = email.trim().toLowerCase();
  if (users.some((u) => u.email?.toLowerCase() === adminEmail)) {
    return res.status(409).json({ error: "User with this email already exists" });
  }
  const id = `user-${crypto.randomUUID?.() ?? Date.now()}`;
  const newUser = { id, email: adminEmail, role: "MARKET_ADMIN", marketId, password };
  users.push(newUser);
  await repos.users.setAll(users);
  appendAuditEvent({
    userId: req.user.id,
    role: req.user.role,
    marketId,
    action: "create",
    entity: "user",
    entityId: newUser.id,
    reason: getEmergencyReason(req),
    emergencyMode: true,
    after: newUser
  });
  res.status(201).json({ ...newUser, password: void 0 });
});
app.get("/markets/:marketId/tenants", async (req, res) => {
  const { marketId } = req.params;
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: "Market not found" });
  if (req.user?.role === "MARKET_ADMIN" && req.user.marketId !== marketId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const tenants = (await repos.tenants.findAll()).filter((t) => t.marketId === marketId && t.enabled && t.isListedInMarket !== false).sort((a, b) => {
    const soA = a.marketSortOrder ?? 999;
    const soB = b.marketSortOrder ?? 999;
    if (soA !== soB) return soA - soB;
    return (a.name ?? "").localeCompare(b.name ?? "");
  }).map((t) => {
    const n = normalizeTenantResponse(t);
    return {
      id: n.id,
      slug: n.slug,
      name: n.name,
      type: n.type === "CLOTHING" || n.type === "FOOD" ? n.type : "GENERAL",
      branding: {
        logoUrl: n.logoUrl ?? "",
        primaryColor: n.primaryColor ?? "#7C3AED",
        secondaryColor: n.secondaryColor ?? "#d4a574",
        fontFamily: n.fontFamily ?? '"Cairo", system-ui, sans-serif',
        radiusScale: n.radiusScale ?? 1,
        layoutStyle: n.layoutStyle ?? "default",
        hero: n.hero,
        banners: n.banners ?? []
      },
      isActive: n.enabled,
      marketCategory: n.marketCategory ?? "GENERAL",
      operationalStatus: n.operationalStatus,
      orderPolicy: n.orderPolicy,
      businessHours: n.businessHours
    };
  });
  res.json(tenants);
});
app.post("/markets/:marketId/tenants", async (req, res) => {
  const { marketId } = req.params;
  const user = req.user;
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  if (user.role === "ROOT_ADMIN" && !requireWriteWithReason(req, res)) return;
  if (user.role === "MARKET_ADMIN" && user.marketId !== marketId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: "Market not found" });
  const body = req.body;
  const { adminEmail, adminPassword, ...input } = body;
  const name = (input.name ?? "").trim();
  if (!name) return res.status(400).json({ error: "Store name is required" });
  const slug = (input.slug ?? name).toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") || `store-${Date.now()}`;
  const existingTenants = await repos.tenants.findAll();
  if (existingTenants.some((t) => t.slug === slug)) {
    return res.status(400).json({ error: `Slug "${slug}" already exists. Use a unique slug.` });
  }
  const id = crypto.randomUUID?.() ?? `t-${Date.now()}`;
  const hero = input.hero ?? { ...DEFAULT_HERO2, title: name };
  const tenant = {
    ...input,
    id,
    slug,
    name,
    marketId,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    logoUrl: input.logoUrl ?? "",
    primaryColor: input.primaryColor ?? "#0f766e",
    secondaryColor: input.secondaryColor ?? "#d4a574",
    fontFamily: input.fontFamily ?? '"Cairo", system-ui, sans-serif',
    radiusScale: input.radiusScale ?? 1,
    layoutStyle: input.layoutStyle ?? "default",
    enabled: input.enabled ?? true,
    hero: normalizeHero(hero),
    banners: input.banners ?? [],
    isListedInMarket: input.isListedInMarket ?? true,
    type: input.type === "CLOTHING" || input.type === "FOOD" ? input.type : "GENERAL",
    marketCategory: input.marketCategory ?? "GENERAL",
    tenantType: input.tenantType ?? (input.type === "FOOD" ? "RESTAURANT" : "SHOP"),
    deliveryProviderMode: input.deliveryProviderMode ?? "TENANT",
    allowMarketCourierFallback: input.allowMarketCourierFallback ?? true,
    financialConfig: input.financialConfig ?? { commissionType: "PERCENTAGE", commissionValue: 10, deliveryFeeModel: "TENANT" },
    paymentCapabilities: input.paymentCapabilities ?? { cash: true, card: false },
    collections: input.collections ?? []
  };
  if (adminEmail && adminPassword && adminPassword.length >= 6) {
    const users = await repos.users.findAll();
    const emailLower = adminEmail.trim().toLowerCase();
    if (users.some((u) => u.email?.toLowerCase() === emailLower)) {
      return res.status(400).json({ error: "Email already in use for another user" });
    }
  }
  const tenants = [...existingTenants, tenant];
  await repos.tenants.setAll(tenants);
  const cat = await repos.catalog.getCatalog(tenant.id);
  await repos.catalog.setCatalog(tenant.id, cat);
  const existingDelivery = await repos.delivery.getSettings(tenant.id);
  if (!existingDelivery) {
    await repos.delivery.setSettings(tenant.id, {
      tenantId: tenant.id,
      modes: { pickup: true, delivery: true },
      deliveryFee: 5,
      zones: []
    });
  }
  if (adminEmail && adminPassword && adminPassword.length >= 6) {
    const users = await repos.users.findAll();
    const emailLower = adminEmail.trim().toLowerCase();
    const userId = crypto.randomUUID?.() ?? `user-${Date.now()}`;
    users.push({
      id: userId,
      email: emailLower,
      role: "TENANT_ADMIN",
      tenantId: tenant.id,
      password: adminPassword
    });
    await repos.users.setAll(users);
  }
  appendAuditEvent({
    userId: user.id,
    role: user.role,
    marketId,
    action: "create",
    entity: "tenant",
    entityId: tenant.id,
    reason: user.role === "ROOT_ADMIN" ? getEmergencyReason(req) : void 0,
    emergencyMode: user.role === "ROOT_ADMIN",
    after: tenant
  });
  res.status(201).json(normalizeTenantResponse(tenant));
});
app.get("/tenants", async (req, res) => {
  let tenants = await repos.tenants.findAll();
  if (req.user?.role === "MARKET_ADMIN" && req.user.marketId) {
    tenants = tenants.filter((t) => t.marketId === req.user.marketId);
  }
  res.json(tenants.map(normalizeTenantResponse));
});
app.get("/storefront/tenants", async (_req, res) => {
  const tenants = (await repos.tenants.findAll()).filter((t) => t.enabled).map((t) => {
    const n = normalizeTenantResponse(t);
    return {
      id: n.id,
      slug: n.slug,
      name: n.name,
      type: n.type === "CLOTHING" || n.type === "FOOD" ? n.type : "GENERAL",
      branding: {
        logoUrl: n.logoUrl ?? "",
        primaryColor: n.primaryColor ?? "#7C3AED",
        secondaryColor: n.secondaryColor ?? "#d4a574",
        fontFamily: n.fontFamily ?? '"Cairo", system-ui, sans-serif',
        radiusScale: n.radiusScale ?? 1,
        layoutStyle: n.layoutStyle ?? "default",
        hero: n.hero,
        banners: n.banners ?? []
      },
      isActive: n.enabled,
      marketCategory: n.marketCategory ?? "GENERAL"
    };
  });
  res.json(tenants);
});
app.post("/tenants", async (req, res) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  if (user.role === "ROOT_ADMIN" && !requireWriteWithReason(req, res)) return;
  const input = req.body;
  let marketId;
  if (user.role === "MARKET_ADMIN" && user.marketId) {
    marketId = user.marketId;
    if (input.marketId && input.marketId !== user.marketId) {
      return res.status(403).json({ error: "Forbidden" });
    }
  } else {
    marketId = input.marketId;
    if (!marketId || !marketId.trim()) {
      return res.status(400).json({ error: "marketId is required", code: "MARKET_ID_REQUIRED" });
    }
    const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
    if (!market) return res.status(400).json({ error: "Invalid marketId" });
  }
  const id = crypto.randomUUID?.() ?? `t-${Date.now()}`;
  const tenant = {
    ...input,
    id,
    marketId,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    hero: input.hero ?? DEFAULT_HERO2,
    banners: input.banners ?? []
  };
  const tenants = await repos.tenants.findAll();
  tenants.push(tenant);
  await repos.tenants.setAll(tenants);
  const cat = await repos.catalog.getCatalog(tenant.id);
  await repos.catalog.setCatalog(tenant.id, cat);
  const existingDelivery = await repos.delivery.getSettings(tenant.id);
  if (!existingDelivery) {
    await repos.delivery.setSettings(tenant.id, {
      tenantId: tenant.id,
      modes: { pickup: true, delivery: true },
      deliveryFee: 5,
      zones: []
    });
  }
  appendAuditEvent({
    userId: req.user.id,
    role: req.user.role,
    marketId: tenant.marketId,
    action: "create",
    entity: "tenant",
    entityId: tenant.id,
    reason: user.role === "ROOT_ADMIN" ? getEmergencyReason(req) : void 0,
    emergencyMode: user.role === "ROOT_ADMIN",
    after: tenant
  });
  res.status(201).json(tenant);
});
async function handleTenantUpdate(req, res) {
  const { id } = req.params;
  let updates = req.body;
  const tenants = await repos.tenants.findAll();
  const idx = tenants.findIndex((t) => t.id === id);
  if (idx === -1) {
    res.status(404).json({ error: "Tenant not found" });
    return;
  }
  const tenant = tenants[idx];
  const user = req.user;
  if (user?.role === "ROOT_ADMIN" && !requireWriteWithReason(req, res)) return;
  if (user?.role === "MARKET_ADMIN") {
    if (tenant.marketId !== user.marketId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const allowed = ["marketCategory", "isListedInMarket", "marketSortOrder"];
    updates = Object.fromEntries(
      Object.entries(updates).filter(([k]) => allowed.includes(k))
    );
  }
  const before = { ...tenants[idx] };
  tenants[idx] = { ...tenants[idx], ...updates };
  await repos.tenants.setAll(tenants);
  appendAuditEvent({
    userId: user.id,
    role: user.role,
    marketId: tenant.marketId,
    action: "update",
    entity: "tenant",
    entityId: id,
    reason: user.role === "ROOT_ADMIN" ? getEmergencyReason(req) : void 0,
    emergencyMode: user.role === "ROOT_ADMIN",
    before,
    after: tenants[idx]
  });
  res.json(normalizeTenantResponse(tenants[idx]));
}
app.put("/tenants/:id", handleTenantUpdate);
app.patch("/tenants/:id", handleTenantUpdate);
app.post("/tenants/:id/toggle", async (req, res) => {
  const { id } = req.params;
  const user = req.user;
  const tenants = await repos.tenants.findAll();
  const idx = tenants.findIndex((t) => t.id === id);
  if (idx === -1) return res.status(404).json({ error: "Tenant not found" });
  const tenant = tenants[idx];
  if (user?.role === "MARKET_ADMIN" && tenant.marketId !== user.marketId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  if (user?.role === "ROOT_ADMIN" && !requireWriteWithReason(req, res)) return;
  const before = { ...tenants[idx] };
  tenants[idx] = { ...tenants[idx], enabled: !tenants[idx].enabled };
  await repos.tenants.setAll(tenants);
  appendAuditEvent({
    userId: user.id,
    role: user.role,
    marketId: tenant.marketId,
    action: "update",
    entity: "tenant",
    entityId: id,
    reason: user.role === "ROOT_ADMIN" ? getEmergencyReason(req) : void 0,
    emergencyMode: user.role === "ROOT_ADMIN",
    before,
    after: tenants[idx]
  });
  res.json(normalizeTenantResponse(tenants[idx]));
});
app.get("/tenants/by-id/:id", async (req, res) => {
  const tenant = (await repos.tenants.findAll()).find((t) => t.id === req.params.id);
  if (!tenant) return res.status(404).json({ error: "Tenant not found" });
  if (req.user?.role === "TENANT_ADMIN" && req.user.tenantId !== req.params.id) {
    return res.status(403).json({ error: "Forbidden" });
  }
  if (req.user?.role === "MARKET_ADMIN" && tenant.marketId !== req.user.marketId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  res.json(normalizeTenantResponse(tenant));
});
app.get("/tenants/by-slug/:slug", async (req, res) => {
  const slug = req.params.slug;
  let tenant = (await repos.tenants.findAll()).find((t) => t.slug === slug);
  if (!tenant && slug === "top-market") {
    tenant = (await repos.tenants.findAll()).find((t) => t.id === TOP_MARKET_TENANT_ID);
  }
  if (!tenant) return res.status(404).json({ error: "Tenant not found" });
  if (req.user?.role === "MARKET_ADMIN" && tenant.marketId !== req.user.marketId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  res.json(normalizeTenantResponse(tenant));
});
app.put("/tenants/:id/branding", async (req, res) => {
  const { id } = req.params;
  const user = req.user;
  console.log("[Branding] Incoming Config:", req.body);
  const tenants = await repos.tenants.findAll();
  const t = tenants.find((x) => x.id === id);
  if (!t) return res.status(404).json({ error: "Tenant not found" });
  if (user?.role === "MARKET_ADMIN" && t.marketId !== user.marketId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  if (user?.role === "ROOT_ADMIN" && !requireWriteWithReason(req, res)) return;
  const body = req.body;
  const idx = tenants.findIndex((x) => x.id === id);
  if (idx === -1) return res.status(404).json({ error: "Tenant not found" });
  if (body.logoUrl !== void 0) tenants[idx].logoUrl = body.logoUrl;
  if (body.hero !== void 0) {
    tenants[idx].hero = normalizeHero(body.hero);
    if (body.hero.title != null && String(body.hero.title).trim()) {
      const title = String(body.hero.title).trim();
      if (title.length <= 50) tenants[idx].name = title;
    }
  }
  if (body.banners !== void 0) tenants[idx].banners = body.banners;
  if (body.whatsappPhone !== void 0) {
    const cleaned = typeof body.whatsappPhone === "string" ? body.whatsappPhone.replace(/\D/g, "") : "";
    tenants[idx].whatsappPhone = cleaned || void 0;
    tenants[idx].phone = cleaned || void 0;
  }
  if (body.primaryColor !== void 0) tenants[idx].primaryColor = body.primaryColor;
  if (body.secondaryColor !== void 0) tenants[idx].secondaryColor = body.secondaryColor;
  if (body.fontFamily !== void 0) tenants[idx].fontFamily = body.fontFamily;
  if (body.radiusScale !== void 0) tenants[idx].radiusScale = body.radiusScale;
  if (body.layoutStyle !== void 0) tenants[idx].layoutStyle = body.layoutStyle;
  const before = { ...tenants[idx] };
  await repos.tenants.setAll(tenants);
  console.log("[Branding] Persisted tenant", id, "to store (data.json)");
  appendAuditEvent({
    userId: user.id,
    role: user.role,
    marketId: t.marketId,
    action: "update",
    entity: "tenant",
    entityId: id,
    reason: user.role === "ROOT_ADMIN" ? getEmergencyReason(req) : void 0,
    emergencyMode: user.role === "ROOT_ADMIN",
    before,
    after: tenants[idx]
  });
  res.json(normalizeTenantResponse(tenants[idx]));
});
app.put("/tenants/:id/collections", async (req, res) => {
  const { id } = req.params;
  const user = req.user;
  const tenants = await repos.tenants.findAll();
  const t = tenants.find((x) => x.id === id);
  if (!t) return res.status(404).json({ error: "Tenant not found" });
  if (user?.role === "MARKET_ADMIN" && t.marketId !== user.marketId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  if (user?.role === "ROOT_ADMIN" && !requireWriteWithReason(req, res)) return;
  const body = req.body;
  const collections = Array.isArray(body.collections) ? body.collections : [];
  const idx = tenants.findIndex((x) => x.id === id);
  if (idx === -1) return res.status(404).json({ error: "Tenant not found" });
  const before = { ...tenants[idx] };
  tenants[idx].collections = collections;
  await repos.tenants.setAll(tenants);
  appendAuditEvent({
    userId: user.id,
    role: user.role,
    marketId: t.marketId,
    action: "update",
    entity: "tenant",
    entityId: id,
    reason: user.role === "ROOT_ADMIN" ? getEmergencyReason(req) : void 0,
    emergencyMode: user.role === "ROOT_ADMIN",
    before,
    after: tenants[idx]
  });
  res.json(normalizeTenantResponse(tenants[idx]));
});
app.put("/tenants/:id/operational-settings", async (req, res) => {
  const { id } = req.params;
  const user = req.user;
  const tenants = await repos.tenants.findAll();
  const t = tenants.find((x) => x.id === id);
  if (!t) return res.status(404).json({ error: "Tenant not found" });
  if (user?.role === "MARKET_ADMIN" && t.marketId !== user.marketId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  if (user?.role === "ROOT_ADMIN" && !requireWriteWithReason(req, res)) return;
  const body = req.body;
  const idx = tenants.findIndex((x) => x.id === id);
  if (idx === -1) return res.status(404).json({ error: "Tenant not found" });
  if (body.name !== void 0) {
    const trimmed = String(body.name).trim();
    if (trimmed.length === 0) return res.status(400).json({ error: "Store name cannot be empty" });
    if (trimmed.length > 50) return res.status(400).json({ error: "Store name must be 50 characters or less" });
    tenants[idx].name = trimmed;
    const existingHero = tenants[idx].hero ?? DEFAULT_HERO2;
    tenants[idx].hero = normalizeHero({ ...existingHero, title: trimmed });
  }
  if (body.operationalStatus !== void 0) tenants[idx].operationalStatus = body.operationalStatus;
  if (body.orderPolicy !== void 0) tenants[idx].orderPolicy = body.orderPolicy;
  if (body.businessHours !== void 0) tenants[idx].businessHours = body.businessHours;
  if (body.busyBannerEnabled !== void 0) tenants[idx].busyBannerEnabled = body.busyBannerEnabled;
  if (body.busyBannerText !== void 0) tenants[idx].busyBannerText = body.busyBannerText;
  if (body.bookingEnabled !== void 0) tenants[idx].bookingEnabled = body.bookingEnabled;
  if (body.about !== void 0) tenants[idx].about = body.about;
  if (body.officeHours !== void 0) tenants[idx].officeHours = body.officeHours;
  if (body.phone !== void 0) {
    const cleaned = String(body.phone).replace(/\D/g, "");
    tenants[idx].phone = cleaned || void 0;
    if (!tenants[idx].whatsappPhone) tenants[idx].whatsappPhone = cleaned || void 0;
  }
  if (body.whatsappPhone !== void 0) {
    const cleaned = String(body.whatsappPhone).replace(/\D/g, "");
    tenants[idx].whatsappPhone = cleaned || void 0;
    tenants[idx].phone = cleaned || void 0;
  }
  const before = { ...tenants[idx] };
  await repos.tenants.setAll(tenants);
  appendAuditEvent({
    userId: user.id,
    role: user.role,
    marketId: t.marketId,
    action: "update",
    entity: "tenant",
    entityId: id,
    reason: user.role === "ROOT_ADMIN" ? getEmergencyReason(req) : void 0,
    emergencyMode: user.role === "ROOT_ADMIN",
    before,
    after: tenants[idx]
  });
  res.json(normalizeTenantResponse(tenants[idx]));
});
var UPLOAD_BASE = process.env.PUBLIC_URL || `http://localhost:${PORT}`;
app.post("/upload", async (req, res) => {
  console.log("Query Params:", req.query);
  console.log("Incoming Headers:", req.headers);
  const files = req.files ?? [];
  const base = UPLOAD_BASE;
  const urls = files.map((f) => `${base}/uploads/${f.filename}`);
  console.log("[Upload] Success:", files.length, "files, base:", base);
  res.json({ urls });
});
app.post("/upload/banner", async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: "No file uploaded" });
  const base = UPLOAD_BASE;
  const relativePath = `/uploads/banners/${file.filename}`;
  const fullUrl = `${base}${relativePath}`;
  console.log("[Upload/banner] Saved:", file.filename);
  res.json({ urls: [fullUrl], relativePath });
});
app.get("/catalog/:tenantId", wrapAsync(async (req, res) => {
  const catalog = await repos.catalog.getCatalog(req.params.tenantId);
  res.json(catalog);
}));
function normalizeProductForCompat(p) {
  const images = p.images ?? [];
  if (images.length > 0) {
    return { ...p, imageUrl: images[0].url };
  }
  return p;
}
app.put("/catalog/:tenantId", wrapAsync(async (req, res) => {
  const catalog = req.body;
  const products = (catalog.products ?? []).map(
    (p) => normalizeProductForCompat(p)
  );
  const normalized = { ...catalog, products };
  await repos.catalog.setCatalog(req.params.tenantId, normalized);
  const updated = await repos.catalog.getCatalog(req.params.tenantId);
  res.json(updated);
}));
async function getMarketTenantIds(marketId) {
  const tenants = await repos.tenants.findAll();
  return new Set(tenants.filter((t) => t.marketId === marketId).map((t) => t.id));
}
app.get("/orders", wrapAsync(async (req, res) => {
  const tenantId = req.query.tenantId;
  let orders = await repos.orders.findAll();
  if (req.user?.role === "TENANT_ADMIN") {
    const ownTenantId = req.user.tenantId;
    if (!ownTenantId) return res.status(403).json({ error: "Forbidden" });
    if (tenantId && tenantId !== ownTenantId) return res.status(403).json({ error: "Forbidden" });
    orders = orders.filter((o) => o.tenantId === ownTenantId);
  } else if (tenantId) {
    orders = orders.filter((o) => o.tenantId === tenantId);
  }
  if (req.user?.role === "MARKET_ADMIN" && req.user.marketId) {
    const allowed = await getMarketTenantIds(req.user.marketId);
    orders = orders.filter((o) => o.tenantId && allowed.has(o.tenantId));
  }
  res.json(orders);
}));
app.get("/tenants/:tenantId/orders", wrapAsync(async (req, res) => {
  const { tenantId } = req.params;
  const tenant = (await repos.tenants.findAll()).find((t) => t.id === tenantId);
  if (!tenant) return res.status(404).json({ error: "Tenant not found" });
  if (req.user?.role === "TENANT_ADMIN" && req.user.tenantId !== tenantId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  if (req.user?.role === "MARKET_ADMIN" && tenant.marketId !== req.user.marketId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const orders = (await repos.orders.findAll()).filter((o) => o.tenantId === tenantId);
  res.json(orders);
}));
app.post("/orders", wrapAsync(async (req, res) => {
  const order = req.body;
  if (req.user?.role === "MARKET_ADMIN" && req.user.marketId) {
    const tenant2 = (await repos.tenants.findAll()).find((t) => t.id === order.tenantId);
    if (!tenant2 || tenant2.marketId !== req.user.marketId) {
      return res.status(403).json({ error: "Forbidden" });
    }
  }
  const tenant = order.tenantId ? (await repos.tenants.findAll()).find((t) => t.id === order.tenantId) : void 0;
  const tenantType = tenant?.tenantType ?? (tenant?.type === "FOOD" ? "RESTAURANT" : "SHOP");
  const deliveryMode = tenant?.deliveryProviderMode ?? "TENANT";
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const created = { ...order, createdAt: order.createdAt ?? now };
  if (tenant?.marketId) created.marketId = tenant.marketId;
  const customer = req.customer;
  if (customer) created.customerId = customer.id;
  if (created.fulfillmentType === "PICKUP" || deliveryMode === "PICKUP_ONLY") {
    created.status = created.status ?? "PREPARING";
    created.deliveryAssignmentMode = void 0;
  } else {
    created.deliveryAssignmentMode = deliveryMode === "MARKET" ? "MARKET" : "TENANT";
    if (tenantType === "RESTAURANT") {
      const prepMin = order.prepTimeMin ?? tenant?.defaultPrepTimeMin ?? 30;
      created.status = "PREPARING";
      created.prepTimeMin = prepMin;
      const readyDate = new Date(created.createdAt ?? now);
      readyDate.setMinutes(readyDate.getMinutes() + prepMin);
      created.readyAt = readyDate.toISOString();
    } else {
      created.status = created.status ?? "PREPARING";
      created.readyAt = created.createdAt ?? now;
    }
  }
  const payment = await computePaymentForOrder(created, created.tenantId ?? "");
  const method = created.paymentMethod === "CARD" ? "CARD" : "CASH";
  created.payment = { ...payment, method };
  created.id = created.id ?? crypto.randomUUID?.() ?? `order-${Date.now()}`;
  created.orderType = created.orderType ?? "PRODUCT";
  await repos.orders.addOrderWithPayment(created, {
    method,
    status: payment.status,
    amount: payment.financials.gross,
    currency: payment.currency
  });
  res.status(201).json(created);
}));
app.get("/orders/:orderId", wrapAsync(async (req, res) => {
  const order = (await repos.orders.findAll()).find((o) => o.id === req.params.orderId);
  if (!order) return res.status(404).json({ error: "Order not found" });
  if (req.user?.role === "MARKET_ADMIN" && req.user.marketId) {
    const tenant = (await repos.tenants.findAll()).find((t) => t.id === order.tenantId);
    if (!tenant || tenant.marketId !== req.user.marketId) {
      return res.status(403).json({ error: "Forbidden" });
    }
  }
  res.json(order);
}));
app.get("/public/orders/:orderId", wrapAsync(async (req, res) => {
  const order = (await repos.orders.findAll()).find((o) => o.id === req.params.orderId);
  if (!order) return res.status(404).json({ error: "Order not found" });
  const tenant = order.tenantId ? (await repos.tenants.findAll()).find((t) => t.id === order.tenantId) : void 0;
  const safe = {
    id: order.id,
    status: order.status,
    total: order.total,
    currency: order.currency,
    subtotal: order.subtotal,
    items: order.items,
    createdAt: order.createdAt,
    fulfillmentType: order.fulfillmentType,
    delivery: order.delivery,
    deliveryAddress: order.deliveryAddress,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    notes: order.notes,
    tenantId: order.tenantId,
    tenantSlug: tenant?.slug
  };
  res.json(safe);
}));
app.patch("/orders/:orderId/status", wrapAsync(async (req, res) => {
  const { status } = req.body;
  const orders = await repos.orders.findAll();
  const idx = orders.findIndex((o) => o.id === req.params.orderId);
  if (idx === -1) return res.status(404).json({ error: "Order not found" });
  const order = orders[idx];
  if (req.user?.role === "MARKET_ADMIN" && req.user.marketId) {
    const tenant = (await repos.tenants.findAll()).find((t) => t.id === order.tenantId);
    if (!tenant || tenant.marketId !== req.user.marketId) {
      return res.status(403).json({ error: "Forbidden" });
    }
  }
  const updated = { ...orders[idx], status };
  if (status === "DELIVERED" && order.courierId) {
    updated.deliveredAt = (/* @__PURE__ */ new Date()).toISOString();
    const couriers = await repos.couriers.findAll();
    const cIdx = couriers.findIndex((c) => c.id === order.courierId);
    if (cIdx >= 0) {
      couriers[cIdx] = {
        ...couriers[cIdx],
        isAvailable: true,
        deliveryCount: (couriers[cIdx].deliveryCount ?? 0) + 1
      };
      await repos.couriers.setAll(couriers);
    }
  }
  orders[idx] = updated;
  await repos.orders.setAll(orders);
  res.json(orders[idx]);
}));
app.get("/campaigns", async (req, res) => {
  const tenantId = req.query.tenantId;
  let campaigns = getCampaigns();
  if (tenantId) campaigns = campaigns.filter((c) => c.tenantId === tenantId);
  res.json(campaigns);
});
app.post("/campaigns", async (req, res) => {
  const campaign = req.body;
  const campaigns = getCampaigns();
  campaigns.push(campaign);
  setCampaigns(campaigns);
  res.status(201).json(campaign);
});
app.put("/campaigns/:id", async (req, res) => {
  const campaigns = getCampaigns();
  const idx = campaigns.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Campaign not found" });
  campaigns[idx] = { ...campaigns[idx], ...req.body };
  setCampaigns(campaigns);
  res.json(campaigns[idx]);
});
app.delete("/campaigns/:id", async (req, res) => {
  const campaigns = getCampaigns();
  const next = campaigns.filter((c) => c.id !== req.params.id);
  if (next.length === campaigns.length) return res.status(404).json({ error: "Campaign not found" });
  setCampaigns(next);
  res.json({ deleted: true });
});
app.get("/delivery/:tenantId", wrapAsync(async (req, res) => {
  const settings = await repos.delivery.getSettings(req.params.tenantId);
  res.json(settings);
}));
app.put("/delivery/:tenantId", wrapAsync(async (req, res) => {
  const tenantId = req.params.tenantId;
  const settings = { ...req.body, tenantId };
  await repos.delivery.setSettings(tenantId, settings);
  res.json(settings);
}));
function sortZones(zones) {
  return [...zones].sort((a, b) => {
    const soA = a.sortOrder ?? 999;
    const soB = b.sortOrder ?? 999;
    if (soA !== soB) return soA - soB;
    return (a.name ?? "").localeCompare(b.name ?? "");
  });
}
app.get("/tenants/:tenantId/delivery-zones", wrapAsync(async (req, res) => {
  const zones = await repos.deliveryZones.getByTenant(req.params.tenantId);
  res.json(sortZones(zones));
}));
app.post("/tenants/:tenantId/delivery-zones", wrapAsync(async (req, res) => {
  const { tenantId } = req.params;
  const body = req.body;
  const id = crypto.randomUUID?.() ?? `dz-${Date.now()}`;
  const zone = {
    id,
    tenantId,
    name: body.name ?? "",
    fee: body.fee ?? 0,
    etaMinutes: body.etaMinutes,
    isActive: body.isActive ?? true,
    sortOrder: body.sortOrder
  };
  const zones = await repos.deliveryZones.getByTenant(tenantId);
  zones.push(zone);
  await repos.deliveryZones.setAll(tenantId, zones);
  res.status(201).json(zone);
}));
app.put("/tenants/:tenantId/delivery-zones/:zoneId", wrapAsync(async (req, res) => {
  const { tenantId, zoneId } = req.params;
  const body = req.body;
  const zones = await repos.deliveryZones.getByTenant(tenantId);
  const idx = zones.findIndex((z) => z.id === zoneId);
  if (idx === -1) return res.status(404).json({ error: "Zone not found" });
  zones[idx] = { ...zones[idx], ...body };
  await repos.deliveryZones.setAll(tenantId, zones);
  res.json(zones[idx]);
}));
app.patch("/tenants/:tenantId/delivery-zones/:zoneId", wrapAsync(async (req, res) => {
  const { tenantId, zoneId } = req.params;
  const body = req.body;
  const zones = await repos.deliveryZones.getByTenant(tenantId);
  const idx = zones.findIndex((z) => z.id === zoneId);
  if (idx === -1) return res.status(404).json({ error: "Zone not found" });
  zones[idx] = { ...zones[idx], ...body };
  await repos.deliveryZones.setAll(tenantId, zones);
  res.json(zones[idx]);
}));
app.delete("/tenants/:tenantId/delivery-zones/:zoneId", wrapAsync(async (req, res) => {
  const { tenantId, zoneId } = req.params;
  const zones = await repos.deliveryZones.getByTenant(tenantId);
  const filtered = zones.filter((z) => z.id !== zoneId);
  if (filtered.length === zones.length) return res.status(404).json({ error: "Zone not found" });
  await repos.deliveryZones.setAll(tenantId, filtered);
  res.json({ deleted: true });
}));
app.patch("/tenants/:tenantId/settings/delivery", async (req, res) => {
  const { tenantId } = req.params;
  const user = req.user;
  const tenants = await repos.tenants.findAll();
  const tenant = tenants.find((t) => t.id === tenantId);
  if (!tenant) return res.status(404).json({ error: "Tenant not found" });
  if (user?.role === "TENANT_ADMIN" && user.tenantId !== tenantId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  if (user?.role === "MARKET_ADMIN" && user.marketId !== tenant.marketId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  if (user?.role === "ROOT_ADMIN" && !requireWriteWithReason(req, res)) return;
  const body = req.body;
  const updates = {};
  if (body.tenantType !== void 0) updates.tenantType = body.tenantType;
  if (body.deliveryProviderMode !== void 0) updates.deliveryProviderMode = body.deliveryProviderMode;
  if (body.allowMarketCourierFallback !== void 0) updates.allowMarketCourierFallback = body.allowMarketCourierFallback;
  if (body.defaultPrepTimeMin !== void 0) updates.defaultPrepTimeMin = body.defaultPrepTimeMin;
  const idx = tenants.findIndex((t) => t.id === tenantId);
  const before = { ...tenants[idx] };
  tenants[idx] = { ...tenants[idx], ...updates };
  await repos.tenants.setAll(tenants);
  appendAuditEvent({
    userId: user.id,
    role: user.role,
    marketId: tenant.marketId,
    action: "update",
    entity: "tenant",
    entityId: tenantId,
    reason: user.role === "ROOT_ADMIN" ? getEmergencyReason(req) : void 0,
    emergencyMode: user.role === "ROOT_ADMIN",
    before,
    after: tenants[idx]
  });
  res.json(tenants[idx]);
});
app.post("/tenants/:tenantId/orders/:orderId/ready", async (req, res) => {
  const { tenantId, orderId } = req.params;
  const user = req.user;
  const tenant = (await repos.tenants.findAll()).find((t) => t.id === tenantId);
  if (!tenant) return res.status(404).json({ error: "Tenant not found" });
  if (user?.role === "TENANT_ADMIN" && user.tenantId !== tenantId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  if (user?.role === "MARKET_ADMIN" && user.marketId !== tenant.marketId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  if (user?.role === "ROOT_ADMIN" && !requireWriteWithReason(req, res)) return;
  const orders = await repos.orders.findAll();
  const idx = orders.findIndex((o) => o.id === orderId);
  if (idx === -1) return res.status(404).json({ error: "Order not found" });
  if (orders[idx].tenantId !== tenantId) return res.status(403).json({ error: "Forbidden" });
  const now = (/* @__PURE__ */ new Date()).toISOString();
  orders[idx] = { ...orders[idx], status: "READY", readyAt: now };
  await repos.orders.setAll(orders);
  res.json(orders[idx]);
});
function courierMarketId(c) {
  if (c.scopeType !== "MARKET") return void 0;
  return c.marketId ?? c.scopeId;
}
var SLA_OK_MIN = 30;
function computeGamification(orders, period) {
  const now = /* @__PURE__ */ new Date();
  const todayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const weekStart = todayStart - 7 * 24 * 60 * 60 * 1e3;
  const cutoff = period === "day" ? todayStart : weekStart;
  const filtered = orders.filter((o) => {
    const at = o.deliveryTimeline?.deliveredAt;
    if (!at) return false;
    return new Date(at).getTime() >= cutoff;
  });
  let points = 0;
  const badges = [];
  for (const o of filtered) {
    points += 10;
    const totalMin = o.deliveryTimeline?.durations?.totalMinutes;
    if (totalMin != null && totalMin < SLA_OK_MIN) points += 5;
  }
  const onTimeCount = filtered.filter((o) => {
    const m = o.deliveryTimeline?.durations?.totalMinutes;
    return m != null && m < SLA_OK_MIN;
  }).length;
  const count = filtered.length;
  const allOnTime = count > 0 && onTimeCount === count;
  if (period === "day") {
    if (count >= 3 && allOnTime) badges.push("\u0633\u0631\u064A\u0639");
  } else {
    if (count >= 5) badges.push("\u0628\u0637\u0644 \u0627\u0644\u0623\u0633\u0628\u0648\u0639");
    if (count >= 5 && allOnTime) badges.push("\u062F\u0642\u064A\u0642");
    if (count >= 10) badges.push("\u0645\u062B\u0627\u0628\u0631");
  }
  return { points, badges, rankScore: points };
}
async function computeCourierMetrics(marketId, courierId) {
  const tenantIds = await getMarketTenantIds(marketId);
  const orders = (await repos.orders.findAll()).filter(
    (o) => o.fulfillmentType === "DELIVERY" && o.courierId === courierId && o.status === "DELIVERED" && o.tenantId && tenantIds.has(o.tenantId)
  );
  const withDeliveredAt = orders.filter((o) => o.deliveryTimeline?.deliveredAt);
  const now = /* @__PURE__ */ new Date();
  const todayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const weekStart = todayStart - 7 * 24 * 60 * 60 * 1e3;
  let deliveredCountToday = 0;
  let deliveredCountWeek = 0;
  const totalMins = [];
  const pickupMins = [];
  let onTimeCount = 0;
  let withDurationCount = 0;
  for (const o of withDeliveredAt) {
    const t = new Date(o.deliveryTimeline.deliveredAt).getTime();
    if (t >= todayStart) deliveredCountToday++;
    if (t >= weekStart) deliveredCountWeek++;
    const dur = o.deliveryTimeline?.durations;
    if (dur?.totalMinutes != null) {
      totalMins.push(dur.totalMinutes);
      withDurationCount++;
      if (dur.totalMinutes < SLA_OK_MIN) onTimeCount++;
    }
    if (dur?.pickedUpToDelivered != null) pickupMins.push(dur.pickedUpToDelivered);
  }
  const gamificationDay = computeGamification(withDeliveredAt, "day");
  const gamificationWeek = computeGamification(withDeliveredAt, "week");
  return {
    deliveredCountToday,
    deliveredCountWeek,
    avgTotalMin: totalMins.length ? Math.round(totalMins.reduce((a, b) => a + b, 0) / totalMins.length) : null,
    avgPickupToDeliveredMin: pickupMins.length ? Math.round(pickupMins.reduce((a, b) => a + b, 0) / pickupMins.length) : null,
    onTimeRate: withDurationCount > 0 ? Math.round(onTimeCount / withDurationCount * 100) : null,
    pointsToday: gamificationDay.points,
    pointsWeek: gamificationWeek.points,
    badgesWeek: gamificationWeek.badges
  };
}
app.get("/markets/:marketId/couriers", async (req, res) => {
  const { marketId } = req.params;
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: "Market not found" });
  if (req.user?.role === "TENANT_ADMIN") return res.status(403).json({ error: "Forbidden", code: "SCOPE_VIOLATION" });
  if (req.user?.role === "MARKET_ADMIN" && req.user.marketId !== marketId) {
    return res.status(403).json({ error: "Cannot access couriers from another market", code: "CROSS_MARKET_ACCESS" });
  }
  const couriers = (await repos.couriers.findAll()).filter((c) => courierMarketId(c) === marketId);
  res.json(couriers);
});
app.get("/markets/:marketId/couriers/stats", async (req, res) => {
  const { marketId } = req.params;
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: "Market not found" });
  if (req.user?.role === "TENANT_ADMIN") return res.status(403).json({ error: "Forbidden", code: "SCOPE_VIOLATION" });
  if (req.user?.role === "MARKET_ADMIN" && req.user.marketId !== marketId) {
    return res.status(403).json({ error: "Cannot access couriers from another market", code: "CROSS_MARKET_ACCESS" });
  }
  const couriers = (await repos.couriers.findAll()).filter((c) => courierMarketId(c) === marketId);
  const list = await Promise.all(couriers.map(async (c) => ({
    ...c,
    ...await computeCourierMetrics(marketId, c.id)
  })));
  res.json(list);
});
app.get("/markets/:marketId/leaderboard", async (req, res) => {
  const { marketId } = req.params;
  const period = req.query.period || "week";
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: "Market not found" });
  if (req.user?.role === "TENANT_ADMIN") return res.status(403).json({ error: "Forbidden", code: "SCOPE_VIOLATION" });
  if (req.user?.role === "MARKET_ADMIN" && req.user.marketId !== marketId) {
    return res.status(403).json({ error: "Cannot access leaderboard from another market", code: "CROSS_MARKET_ACCESS" });
  }
  if (req.user?.role === "COURIER" && req.user.marketId !== marketId) {
    return res.status(403).json({ error: "Courier can only access own market leaderboard", code: "CROSS_MARKET_ACCESS" });
  }
  if (period !== "week") return res.status(400).json({ error: "period=week only" });
  const couriers = (await repos.couriers.findAll()).filter((c) => courierMarketId(c) === marketId);
  const withMetrics = await Promise.all(couriers.map(async (c) => ({
    courierId: c.id,
    name: c.name,
    ...await computeCourierMetrics(marketId, c.id)
  })));
  withMetrics.sort((a, b) => {
    const pa = a.pointsWeek ?? 0;
    const pb = b.pointsWeek ?? 0;
    if (pa !== pb) return pb - pa;
    const oa = a.onTimeRate ?? -1;
    const ob = b.onTimeRate ?? -1;
    if (oa !== ob) return ob - oa;
    const ma = a.avgTotalMin ?? 9999;
    const mb = b.avgTotalMin ?? 9999;
    return ma - mb;
  });
  const leaderboard = withMetrics.map((row, i) => ({
    courierId: row.courierId,
    name: row.name,
    pointsWeek: row.pointsWeek ?? 0,
    badgesWeek: row.badgesWeek ?? [],
    avgTotalMin: row.avgTotalMin,
    onTimeRate: row.onTimeRate,
    rank: i + 1
  }));
  const myCourierId = req.user?.role === "COURIER" ? req.user.courierId : void 0;
  const myRow = myCourierId ? leaderboard.find((r) => r.courierId === myCourierId) : void 0;
  res.json({
    leaderboard,
    myRank: myRow?.rank ?? null
  });
});
app.post("/markets/:marketId/couriers", async (req, res) => {
  const { marketId } = req.params;
  const user = req.user;
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: "Market not found" });
  if (user?.role === "TENANT_ADMIN") return res.status(403).json({ error: "Forbidden", code: "SCOPE_VIOLATION" });
  if (user?.role === "MARKET_ADMIN" && user.marketId !== marketId) {
    return res.status(403).json({ error: "Cannot create couriers in another market", code: "CROSS_MARKET_ACCESS" });
  }
  if (user?.role === "ROOT_ADMIN" && !requireWriteWithReason(req, res)) return;
  const body = req.body;
  const id = `courier-${crypto.randomUUID?.() ?? Date.now()}`;
  const courier = {
    id,
    scopeType: "MARKET",
    scopeId: marketId,
    marketId,
    name: body.name ?? "",
    phone: body.phone,
    isActive: true,
    isOnline: false,
    capacity: 3,
    isAvailable: true,
    deliveryCount: 0
  };
  const couriers = await repos.couriers.findAll();
  couriers.push(courier);
  await repos.couriers.setAll(couriers);
  appendAuditEvent({
    userId: user.id,
    role: user.role,
    marketId,
    action: "create",
    entity: "courier",
    entityId: id,
    reason: user.role === "ROOT_ADMIN" ? getEmergencyReason(req) : void 0,
    emergencyMode: user.role === "ROOT_ADMIN",
    after: courier
  });
  res.status(201).json(courier);
});
app.patch("/markets/:marketId/couriers/:courierId", async (req, res) => {
  const { marketId, courierId } = req.params;
  const user = req.user;
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: "Market not found" });
  if (user?.role === "TENANT_ADMIN") return res.status(403).json({ error: "Forbidden", code: "SCOPE_VIOLATION" });
  if (user?.role === "MARKET_ADMIN" && user.marketId !== marketId) {
    return res.status(403).json({ error: "Cannot update couriers in another market", code: "CROSS_MARKET_ACCESS" });
  }
  if (user?.role === "ROOT_ADMIN" && !requireWriteWithReason(req, res)) return;
  const couriers = await repos.couriers.findAll();
  const idx = couriers.findIndex((c) => c.id === courierId && courierMarketId(c) === marketId);
  if (idx === -1) {
    const other = couriers.find((c) => c.id === courierId);
    if (other && courierMarketId(other) && courierMarketId(other) !== marketId) {
      return res.status(403).json({ error: "Courier belongs to another market", code: "CROSS_MARKET_ACCESS" });
    }
    return res.status(404).json({ error: "Courier not found" });
  }
  const before = { ...couriers[idx] };
  const body = req.body;
  couriers[idx] = { ...couriers[idx], ...body };
  await repos.couriers.setAll(couriers);
  appendAuditEvent({
    userId: user.id,
    role: user.role,
    marketId,
    action: "update",
    entity: "courier",
    entityId: courierId,
    reason: user.role === "ROOT_ADMIN" ? getEmergencyReason(req) : void 0,
    emergencyMode: user.role === "ROOT_ADMIN",
    before,
    after: couriers[idx]
  });
  res.json(couriers[idx]);
});
app.delete("/markets/:marketId/couriers/:courierId", async (req, res) => {
  const { marketId, courierId } = req.params;
  const user = req.user;
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: "Market not found" });
  if (user?.role === "TENANT_ADMIN") return res.status(403).json({ error: "Forbidden", code: "SCOPE_VIOLATION" });
  if (user?.role === "MARKET_ADMIN" && user.marketId !== marketId) {
    return res.status(403).json({ error: "Cannot delete couriers in another market", code: "CROSS_MARKET_ACCESS" });
  }
  if (user?.role === "ROOT_ADMIN" && !requireWriteWithReason(req, res)) return;
  const couriers = await repos.couriers.findAll();
  const idx = couriers.findIndex((c) => c.id === courierId && courierMarketId(c) === marketId);
  if (idx === -1) {
    const other = couriers.find((c) => c.id === courierId);
    if (other && courierMarketId(other) && courierMarketId(other) !== marketId) {
      return res.status(403).json({ error: "Courier belongs to another market", code: "CROSS_MARKET_ACCESS" });
    }
    return res.status(404).json({ error: "Courier not found" });
  }
  const before = { ...couriers[idx] };
  couriers[idx] = { ...couriers[idx], isActive: false };
  await repos.couriers.setAll(couriers);
  appendAuditEvent({
    userId: user.id,
    role: user.role,
    marketId,
    action: "update",
    entity: "courier",
    entityId: courierId,
    reason: user.role === "ROOT_ADMIN" ? getEmergencyReason(req) : "soft-delete",
    emergencyMode: user.role === "ROOT_ADMIN",
    before,
    after: couriers[idx]
  });
  res.json(couriers[idx]);
});
app.get("/tenants/:tenantId/couriers", async (req, res) => {
  const { tenantId } = req.params;
  const tenant = (await repos.tenants.findAll()).find((t) => t.id === tenantId);
  if (!tenant) return res.status(404).json({ error: "Tenant not found" });
  if (req.user?.role === "TENANT_ADMIN" && req.user.tenantId !== tenantId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  if (req.user?.role === "MARKET_ADMIN" && req.user.marketId !== tenant.marketId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const couriers = (await repos.couriers.findAll()).filter((c) => c.scopeType === "TENANT" && c.scopeId === tenantId);
  res.json(couriers);
});
app.post("/tenants/:tenantId/couriers", async (req, res) => {
  const { tenantId } = req.params;
  const user = req.user;
  const tenant = (await repos.tenants.findAll()).find((t) => t.id === tenantId);
  if (!tenant) return res.status(404).json({ error: "Tenant not found" });
  if (user?.role === "TENANT_ADMIN" && user.tenantId !== tenantId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  if (user?.role === "MARKET_ADMIN" && user.marketId !== tenant.marketId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  if (user?.role === "ROOT_ADMIN" && !requireWriteWithReason(req, res)) return;
  const body = req.body;
  const id = `courier-${crypto.randomUUID?.() ?? Date.now()}`;
  const courier = {
    id,
    scopeType: "TENANT",
    scopeId: tenantId,
    name: body.name ?? "",
    phone: body.phone,
    isActive: true,
    isOnline: false,
    capacity: 3
  };
  const couriers = await repos.couriers.findAll();
  couriers.push(courier);
  await repos.couriers.setAll(couriers);
  res.status(201).json(courier);
});
app.patch("/tenants/:tenantId/couriers/:courierId", async (req, res) => {
  const { tenantId, courierId } = req.params;
  const user = req.user;
  const tenant = (await repos.tenants.findAll()).find((t) => t.id === tenantId);
  if (!tenant) return res.status(404).json({ error: "Tenant not found" });
  if (user?.role === "TENANT_ADMIN" && user.tenantId !== tenantId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  if (user?.role === "MARKET_ADMIN" && user.marketId !== tenant.marketId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  if (user?.role === "ROOT_ADMIN" && !requireWriteWithReason(req, res)) return;
  const couriers = await repos.couriers.findAll();
  const idx = couriers.findIndex((c) => c.id === courierId && c.scopeType === "TENANT" && c.scopeId === tenantId);
  if (idx === -1) return res.status(404).json({ error: "Courier not found" });
  const body = req.body;
  couriers[idx] = { ...couriers[idx], ...body };
  await repos.couriers.setAll(couriers);
  res.json(couriers[idx]);
});
app.get("/markets/:marketId/orders", wrapAsync(async (req, res) => {
  const { marketId } = req.params;
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: "Market not found" });
  if (req.user?.role === "MARKET_ADMIN" && req.user.marketId !== marketId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const tenantIds = await getMarketTenantIds(marketId);
  const orders = (await repos.orders.findAll()).filter(
    (o) => o.tenantId && tenantIds.has(o.tenantId)
  );
  res.json(orders);
}));
function ordersInDateRange(orders, from, to) {
  if (!from && !to) return orders;
  const fromMs = from ? new Date(from).setHours(0, 0, 0, 0) : 0;
  const toMs = to ? new Date(to).setHours(23, 59, 59, 999) : Number.MAX_SAFE_INTEGER;
  return orders.filter((o) => {
    const t = o.createdAt ? new Date(o.createdAt).getTime() : 0;
    return t >= fromMs && t <= toMs;
  });
}
function computeOrderFinancials(o) {
  if (!o) return { gross: 0, itemsTotal: 0, deliveryFee: 0, commission: 0, netToMerchant: 0, isCash: true, isCashCollected: false };
  const pay = o.payment;
  const safeNum = (v) => typeof v === "number" && !Number.isNaN(v) ? v : 0;
  const items = Array.isArray(o?.items) ? o.items : [];
  const itemsSum = items.reduce((s, i) => s + safeNum(i?.totalPrice), 0);
  const subtotal = safeNum(o?.subtotal) || itemsSum;
  const total = safeNum(o?.total) || subtotal + safeNum(o?.delivery?.fee);
  const deliveryFee = safeNum(pay?.breakdown?.deliveryFee) || safeNum(o?.delivery?.fee);
  const gross = safeNum(pay?.financials?.gross) || total;
  const itemsTotal = safeNum(pay?.breakdown?.itemsTotal) || subtotal;
  const commission = safeNum(pay?.financials?.commission);
  const netToMerchant = safeNum(pay?.financials?.netToMerchant);
  const method = pay?.method ?? o?.paymentMethod;
  const isCash = method === "CASH" || method === void 0 || method === null;
  const isCashCollected = Boolean(pay?.cashLedger?.collected);
  return { gross, itemsTotal, deliveryFee, commission, netToMerchant, isCash, isCashCollected };
}
app.get("/markets/:marketId/finance/summary", wrapAsync(async (req, res) => {
  const { marketId } = req.params;
  const from = req.query.from;
  const to = req.query.to;
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: "Market not found" });
  if (req.user?.role === "MARKET_ADMIN" && req.user.marketId !== marketId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const tenantIds = await getMarketTenantIds(marketId);
  const allOrders = (await repos.orders.findAll()).filter(
    (o) => o.tenantId && tenantIds.has(o.tenantId)
  );
  const orders = ordersInDateRange(allOrders, from, to);
  let gross = 0;
  let itemsTotal = 0;
  let deliveryFees = 0;
  let commission = 0;
  let netToMerchants = 0;
  let cashCollected = 0;
  let outstandingCash = 0;
  let totalOrders = orders.length;
  let deliveredOrders = 0;
  let activeDeliveryOrders = 0;
  let cashOrders = 0;
  for (const o of orders) {
    const f = computeOrderFinancials(o);
    if (f.isCash) cashOrders++;
    const isDelivered = o.status === "DELIVERED" || o.status === "COMPLETED";
    if (isDelivered) deliveredOrders++;
    const isActiveDelivery = o.fulfillmentType === "DELIVERY" && !["DELIVERED", "COMPLETED", "CANCELED"].includes(o.status ?? "");
    if (isActiveDelivery) activeDeliveryOrders++;
    gross += f.gross;
    itemsTotal += f.itemsTotal;
    deliveryFees += f.deliveryFee;
    commission += f.commission;
    netToMerchants += f.netToMerchant;
    if (f.isCash) {
      if (f.isCashCollected) cashCollected += f.gross;
      else if (isDelivered) outstandingCash += f.gross;
    }
  }
  res.json({
    gross,
    itemsTotal,
    deliveryFees,
    commission,
    netToMerchants,
    cashCollected,
    outstandingCash,
    totalOrders,
    deliveredOrders,
    activeDeliveryOrders,
    cashOrders
  });
}));
app.get("/markets/:marketId/finance/tenants", wrapAsync(async (req, res) => {
  const { marketId } = req.params;
  const from = req.query.from;
  const to = req.query.to;
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: "Market not found" });
  if (req.user?.role === "MARKET_ADMIN" && req.user.marketId !== marketId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const tenantIds = await getMarketTenantIds(marketId);
  const allOrders = (await repos.orders.findAll()).filter(
    (o) => o.tenantId && tenantIds.has(o.tenantId)
  );
  const orders = ordersInDateRange(allOrders, from, to);
  const tenants = await repos.tenants.findAll();
  const byTenant = /* @__PURE__ */ new Map();
  for (const o of orders) {
    const tid = o.tenantId ?? "";
    if (!tid) continue;
    let row = byTenant.get(tid);
    if (!row) {
      row = { gross: 0, itemsTotal: 0, deliveryFees: 0, commission: 0, netToMerchant: 0, orderCount: 0, deliveredCount: 0 };
      byTenant.set(tid, row);
    }
    row.orderCount++;
    const isDelivered = o.status === "DELIVERED" || o.status === "COMPLETED";
    if (isDelivered) row.deliveredCount++;
    const f = computeOrderFinancials(o);
    row.gross += f.gross;
    row.itemsTotal += f.itemsTotal;
    row.deliveryFees += f.deliveryFee;
    row.commission += f.commission;
    row.netToMerchant += f.netToMerchant;
  }
  const result = Array.from(byTenant.entries()).map(([tenantId, row]) => {
    const t = tenants.find((x) => x.id === tenantId);
    return {
      tenantId,
      tenantName: t?.name ?? tenantId,
      ...row
    };
  });
  res.json(result);
}));
app.get("/markets/:marketId/finance/couriers", wrapAsync(async (req, res) => {
  const { marketId } = req.params;
  const from = req.query.from;
  const to = req.query.to;
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: "Market not found" });
  if (req.user?.role === "MARKET_ADMIN" && req.user.marketId !== marketId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const tenantIds = await getMarketTenantIds(marketId);
  const allOrders = (await repos.orders.findAll()).filter(
    (o) => o.tenantId && tenantIds.has(o.tenantId) && o.courierId
  );
  const orders = ordersInDateRange(allOrders, from, to);
  const couriers = (await repos.couriers.findAll()).filter((c) => courierMarketId(c) === marketId);
  const ACTIVE_STATUSES = /* @__PURE__ */ new Set(["ASSIGNED", "IN_PROGRESS", "PICKED_UP"]);
  const byCourier = /* @__PURE__ */ new Map();
  for (const o of orders) {
    const cid = o.courierId ?? "";
    if (!cid) continue;
    let row = byCourier.get(cid);
    if (!row) {
      row = { deliveredCount: 0, cashCollectedGross: 0, outstandingGross: 0, activeUncollectedGross: 0 };
      byCourier.set(cid, row);
    }
    const f = computeOrderFinancials(o);
    const isDelivered = o.status === "DELIVERED" || o.status === "COMPLETED";
    const deliveryStatus = o.deliveryStatus ?? "";
    if (isDelivered) row.deliveredCount++;
    if (f.isCash) {
      if (f.isCashCollected) row.cashCollectedGross += f.gross;
      else if (isDelivered) row.outstandingGross += f.gross;
      else if (ACTIVE_STATUSES.has(deliveryStatus)) row.activeUncollectedGross += f.gross;
    }
  }
  const result = couriers.map((c) => {
    const row = byCourier.get(c.id) ?? { deliveredCount: 0, cashCollectedGross: 0, outstandingGross: 0, activeUncollectedGross: 0 };
    return {
      courierId: c.id,
      courierName: c.name ?? c.id,
      ...row
    };
  });
  res.json(result);
}));
app.post("/markets/:marketId/orders/:orderId/assign-courier", async (req, res) => {
  const { marketId, orderId } = req.params;
  const user = req.user;
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: "Market not found" });
  if (user?.role === "MARKET_ADMIN" && user.marketId !== marketId) {
    return res.status(403).json({ error: "Cannot assign couriers in another market", code: "CROSS_MARKET_ACCESS" });
  }
  if (user?.role === "ROOT_ADMIN" && !requireWriteWithReason(req, res)) return;
  const body = req.body;
  const courierId = body.courierId;
  if (!courierId || typeof courierId !== "string") {
    return res.status(400).json({ error: "courierId is required" });
  }
  const orders = await repos.orders.findAll();
  const idx = orders.findIndex((o) => o.id === orderId);
  if (idx === -1) return res.status(404).json({ error: "Order not found" });
  const order = orders[idx];
  const orderMarketId = order.marketId ?? (await repos.tenants.findAll()).find((t) => t.id === order.tenantId)?.marketId;
  if (orderMarketId !== marketId) {
    return res.status(403).json({ error: "Order not in this market", code: "CROSS_MARKET_ACCESS" });
  }
  if (order.deliveryAssignmentMode !== "MARKET") {
    return res.status(400).json({ error: "Order must have deliveryAssignmentMode MARKET" });
  }
  const currentStatus = order.deliveryStatus ?? (order.courierId ? "ASSIGNED" : "UNASSIGNED");
  if (currentStatus !== "UNASSIGNED" && !body.reassign) {
    return res.status(409).json({ error: "Order already assigned. Use reassign: true to change courier.", code: "CONCURRENCY_CONFLICT" });
  }
  const couriers = await repos.couriers.findAll();
  const courier = couriers.find((c) => c.id === courierId);
  if (!courier) return res.status(404).json({ error: "Courier not found" });
  const cMarketId = courierMarketId(courier);
  if (cMarketId !== marketId) {
    return res.status(403).json({ error: "Courier belongs to another market", code: "CROSS_MARKET_ACCESS" });
  }
  if (!courier.isActive || !courier.isOnline) {
    return res.status(400).json({ error: "Courier must be active and online" });
  }
  if (courier.isAvailable === false) {
    return res.status(400).json({ error: "Courier is busy with another delivery" });
  }
  const before = { ...order };
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const timeline = order.deliveryTimeline ?? {};
  const assignedAt = timeline.assignedAt ?? now;
  orders[idx] = {
    ...order,
    courierId,
    deliveryStatus: "ASSIGNED",
    deliveryTimeline: { ...timeline, assignedAt }
  };
  await repos.orders.setAll(orders);
  const courierIdx = couriers.findIndex((c) => c.id === courierId);
  if (courierIdx >= 0) {
    couriers[courierIdx] = { ...couriers[courierIdx], isAvailable: false };
    await repos.couriers.setAll(couriers);
  }
  appendAuditEvent({
    userId: user.id,
    role: user.role,
    marketId,
    action: "update",
    entity: "order",
    entityId: orderId,
    reason: `assign-courier ${courierId}`,
    before: { courierId: before.courierId, deliveryStatus: before.deliveryStatus },
    after: { courierId, deliveryStatus: "ASSIGNED" }
  });
  emitCourierAssigned(courierId, orders[idx]);
  res.json(orders[idx]);
});
app.post("/markets/:marketId/orders/:orderId/contact", async (req, res) => {
  const { marketId, orderId } = req.params;
  const user = req.user;
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: "Market not found" });
  if (user?.role === "TENANT_ADMIN") return res.status(403).json({ error: "Forbidden", code: "SCOPE_VIOLATION" });
  if (user?.role === "MARKET_ADMIN" && user.marketId !== marketId) {
    return res.status(403).json({ error: "Order not in this market", code: "CROSS_MARKET_ACCESS" });
  }
  if (user?.role === "ROOT_ADMIN" && !requireWriteWithReason(req, res)) return;
  const body = req.body;
  const notes = body.notes?.trim() || body.message?.trim() || void 0;
  const channel = body.channel?.trim() || void 0;
  const orders = await repos.orders.findAll();
  const idx = orders.findIndex((o) => o.id === orderId);
  if (idx === -1) return res.status(404).json({ error: "Order not found" });
  const order = orders[idx];
  const orderMarketId = order.marketId ?? (await repos.tenants.findAll()).find((t) => t.id === order.tenantId)?.marketId;
  if (orderMarketId !== marketId) return res.status(403).json({ error: "Order not in this market", code: "CROSS_MARKET_ACCESS" });
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const contactLog = order.contactLog ?? {};
  const entries = contactLog.entries ?? [];
  entries.push({
    at: now,
    channel,
    notes,
    userId: user?.id
  });
  orders[idx] = {
    ...order,
    contactLog: {
      ...contactLog,
      lastContactedAt: now,
      channel,
      notes,
      entries
    }
  };
  await repos.orders.setAll(orders);
  res.json(orders[idx]);
});
app.delete("/markets/:marketId/orders/:orderId/assign-courier", async (req, res) => {
  const { marketId, orderId } = req.params;
  const user = req.user;
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: "Market not found" });
  if (user?.role === "MARKET_ADMIN" && user.marketId !== marketId) {
    return res.status(403).json({ error: "Cannot unassign in another market", code: "CROSS_MARKET_ACCESS" });
  }
  if (user?.role === "ROOT_ADMIN" && !requireWriteWithReason(req, res)) return;
  const orders = await repos.orders.findAll();
  const idx = orders.findIndex((o) => o.id === orderId);
  if (idx === -1) return res.status(404).json({ error: "Order not found" });
  const order = orders[idx];
  const orderMarketId = order.marketId ?? (await repos.tenants.findAll()).find((t) => t.id === order.tenantId)?.marketId;
  if (orderMarketId !== marketId) {
    return res.status(403).json({ error: "Order not in this market", code: "CROSS_MARKET_ACCESS" });
  }
  const courierId = order.courierId;
  const before = { ...order };
  orders[idx] = { ...order, courierId: void 0, deliveryStatus: "UNASSIGNED" };
  await repos.orders.setAll(orders);
  if (courierId) {
    emitCourierUnassigned(courierId, orderId);
    const otherAssigned = orders.filter(
      (o) => o.courierId === courierId && o.id !== orderId && o.status !== "DELIVERED" && o.status !== "CANCELED"
    );
    if (otherAssigned.length === 0) {
      const couriers = await repos.couriers.findAll();
      const cIdx = couriers.findIndex((c) => c.id === courierId);
      if (cIdx >= 0) {
        couriers[cIdx] = { ...couriers[cIdx], isAvailable: true };
        await repos.couriers.setAll(couriers);
      }
    }
  }
  appendAuditEvent({
    userId: user.id,
    role: user.role,
    marketId,
    action: "update",
    entity: "order",
    entityId: orderId,
    reason: "unassign-courier",
    before: { courierId: before.courierId, deliveryStatus: before.deliveryStatus },
    after: { courierId: void 0, deliveryStatus: void 0 }
  });
  res.json(orders[idx]);
});
app.get("/markets/:marketId/dispatch/queue", async (req, res) => {
  const { marketId } = req.params;
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: "Market not found" });
  if (req.user?.role === "TENANT_ADMIN") return res.status(403).json({ error: "Forbidden" });
  if (req.user?.role === "MARKET_ADMIN" && req.user.marketId !== marketId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const queue = await getDispatchQueue(marketId, repos);
  res.json(queue);
});
app.get("/markets/:marketId/delivery-jobs", async (req, res) => {
  const { marketId } = req.params;
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: "Market not found" });
  if (req.user?.role === "TENANT_ADMIN") return res.status(403).json({ error: "Forbidden" });
  if (req.user?.role === "MARKET_ADMIN" && req.user.marketId !== marketId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const jobs = getDeliveryJobs().filter((j) => j.marketId === marketId);
  res.json(jobs);
});
app.post("/markets/:marketId/delivery-jobs", async (req, res) => {
  const { marketId } = req.params;
  const user = req.user;
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: "Market not found" });
  if (user?.role === "TENANT_ADMIN") return res.status(403).json({ error: "Forbidden" });
  if (user?.role === "MARKET_ADMIN" && user.marketId !== marketId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  if (user?.role === "ROOT_ADMIN" && !requireWriteWithReason(req, res)) return;
  const body = req.body;
  const items = body.items ?? [];
  const tenantIds = new Set((await repos.tenants.findAll()).filter((t) => t.marketId === marketId).map((t) => t.id));
  for (const it of items) {
    if (!tenantIds.has(it.tenantId)) return res.status(400).json({ error: `Order ${it.orderId} tenant not in market` });
  }
  const id = `job-${crypto.randomUUID?.() ?? Date.now()}`;
  const job = {
    id,
    marketId,
    status: "NEW",
    items,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  const jobs = getDeliveryJobs();
  jobs.push(job);
  setDeliveryJobs(jobs);
  res.status(201).json(job);
});
app.patch("/markets/:marketId/delivery-jobs/:jobId/assign", async (req, res) => {
  const { marketId, jobId } = req.params;
  const user = req.user;
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: "Market not found" });
  if (user?.role === "TENANT_ADMIN") return res.status(403).json({ error: "Forbidden" });
  if (user?.role === "MARKET_ADMIN" && user.marketId !== marketId) {
    return res.status(403).json({ error: "Cannot assign couriers in another market", code: "CROSS_MARKET_ACCESS" });
  }
  if (user?.role === "ROOT_ADMIN" && !requireWriteWithReason(req, res)) return;
  const body = req.body;
  const jobs = getDeliveryJobs();
  const idx = jobs.findIndex((j) => j.id === jobId && j.marketId === marketId);
  if (idx === -1) return res.status(404).json({ error: "Delivery job not found" });
  const courier = (await repos.couriers.findAll()).find((c) => c.id === body.courierId);
  if (!courier) return res.status(404).json({ error: "Courier not found" });
  if (courierMarketId(courier) !== marketId) {
    return res.status(403).json({ error: "Courier belongs to another market", code: "CROSS_MARKET_ACCESS" });
  }
  jobs[idx] = { ...jobs[idx], courierId: body.courierId, status: "ASSIGNED" };
  setDeliveryJobs(jobs);
  res.json(jobs[idx]);
});
app.get("/templates", async (_req, res) => {
  res.json(getTemplates());
});
app.get("/staff", async (req, res) => {
  const tenantId = req.query.tenantId;
  let staff = getStaff();
  if (tenantId) staff = staff.filter((s) => s.tenantId === tenantId);
  res.json(staff);
});
app.post("/staff", async (req, res) => {
  const user = req.body;
  const staff = getStaff();
  staff.push(user);
  setStaff(staff);
  res.status(201).json(user);
});
app.get("/health", async (_req, res) => {
  res.json({ ok: true });
});
app.use((err, _req, res, _next) => {
  console.error(err);
  const status = err.status ?? 500;
  const body = {
    error: err.message || "Internal server error"
  };
  if (err.code) body.code = err.code;
  if (process.env.NODE_ENV !== "production") body.details = err.stack;
  res.status(status).json(body);
});
(async () => {
  await seedUsersIfNeeded();
  await seedMarketsIfNeeded();
  await seedTenantMarketIdsIfNeeded();
  await seedOrdersIfNeeded();
  await seedDeliveryZonesIfNeeded();
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Mock API server running at http://0.0.0.0:${PORT} (STORAGE_DRIVER=${process.env.STORAGE_DRIVER ?? "json"})`);
  });
})();
export {
  emitCourierAssigned,
  emitCourierUnassigned
};
//# sourceMappingURL=index.js.map