// src/index.ts
import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import jwt from "jsonwebtoken";
import { join as join4, resolve, dirname as dirname4, basename } from "path";
import { existsSync as existsSync5, mkdirSync as mkdirSync4, readdirSync, unlinkSync as unlinkSync2 } from "fs";
import sharp from "sharp";

// src/store.ts
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, statSync, unlinkSync } from "fs";
import { join, dirname } from "path";
var DATA_FILE = process.env.DATA_FILE || join(process.cwd(), "data.json");
var ORDERS_FILE = process.env.ORDERS_FILE || join(process.cwd(), "..", "..", "packages", "mock", "data", "orders.json");
var ORDERS_DIR = dirname(ORDERS_FILE);
var ORDERS_TMP = join(ORDERS_DIR, "orders.tmp.json");
var DEFAULT_GLOBAL_CATEGORIES = [
  { id: "cat-test", nameAr: "\u0627\u062E\u062A\u0628\u0627\u0631 \u0627\u0644\u0631\u0628\u0637 \u0627\u0644\u062C\u062F\u064A\u062F", title: "\u0627\u062E\u062A\u0628\u0627\u0631", icon: "\u{1F517}", isProfessional: false, sortOrder: 0 },
  { id: "cat-test-2", nameAr: "\u062A\u0635\u0646\u064A\u0641 \u062B\u0627\u0646\u064D \u0644\u0644\u0627\u062E\u062A\u0628\u0627\u0631", title: "\u0627\u062E\u062A\u0628\u0627\u0631 \u0662", icon: "\u{1F4CB}", isProfessional: false, sortOrder: 1 }
];
var DEFAULT_CATEGORY_POLICIES = [
  { id: "cat-sla-food", name: "\u0637\u0639\u0627\u0645 / \u062D\u0644\u0648\u064A\u0627\u062A", greenMs: 3 * 60 * 1e3, orangeMs: 5 * 60 * 1e3, redMs: 6 * 60 * 1e3, isUrgent: true },
  { id: "cat-sla-general", name: "\u0639\u0627\u0645", greenMs: 10 * 60 * 1e3, orangeMs: 15 * 60 * 1e3, redMs: 20 * 60 * 1e3, isUrgent: false }
];
var DEFAULT_PILLARS = [
  { id: "pillar-food", name: "Food", nameAr: "\u0637\u0639\u0627\u0645", slug: "food", icon: "\u{1F37D}\uFE0F", sortOrder: 0 },
  { id: "pillar-retail", name: "Retail", nameAr: "\u062A\u062C\u0632\u0626\u0629", slug: "retail", icon: "\u{1F6D2}", sortOrder: 1 },
  { id: "pillar-services", name: "Services", nameAr: "\u062E\u062F\u0645\u0627\u062A", slug: "services", icon: "\u{1F4BC}", sortOrder: 2 },
  { id: "pillar-crafts", name: "Crafts", nameAr: "\u062D\u0631\u0641\u064A\u0648\u0646", slug: "crafts", icon: "\u{1F527}", sortOrder: 3 }
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
  leads: [],
  categoryPolicies: DEFAULT_CATEGORY_POLICIES,
  pillars: DEFAULT_PILLARS,
  subCategories: [],
  settlementLogs: [],
  optionTemplates: {}
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
  if (!tenant.categoryId) {
    tenant.categoryId = DEFAULT_CATEGORY_POLICIES[0]?.id ?? "cat-sla-general";
  }
  if (typeof tenant.sortOrder !== "number") {
    tenant.sortOrder = 0;
  }
  if (tenant.pillarId === void 0) {
    tenant.pillarId = null;
  }
  if (tenant.subCategoryId === void 0) {
    tenant.subCategoryId = null;
  }
  const opStatus = tenant.operationalStatus;
  if (opStatus !== "open" && opStatus !== "closed" && opStatus !== "busy") {
    tenant.operationalStatus = "open";
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
function migrateCategory(c, index) {
  if (c.parentId === void 0) c.parentId = null;
  if (c.isVisible === void 0) c.isVisible = true;
  if (typeof c.sortOrder !== "number") c.sortOrder = index;
  return c;
}
function migrateCourier(c) {
  const courier = c;
  if (courier.scopeType === "MARKET" && !courier.marketId) {
    courier.marketId = courier.scopeId;
  }
  if (courier.initialFloat === void 0) courier.initialFloat = 300;
  return courier;
}
function parseToMockData(parsed) {
  const rawMarkets = parsed.markets ?? [];
  const tenants = (parsed.tenants ?? []).map((t, i) => migrateTenant({ ...t, sortOrder: t.sortOrder ?? i }));
  const markets = rawMarkets.map((m) => {
    const market = migrateMarket(m);
    market.categories = m.categories ?? [];
    market.stores = (m.stores ?? []).map(
      (s) => migrateTenant({ ...s, marketId: m.id })
    );
    if (Array.isArray(m.tenantIds)) market.tenantIds = m.tenantIds;
    return market;
  });
  const catalog = {};
  for (const [tid, cat] of Object.entries(parsed.catalog ?? {})) {
    const c = cat;
    catalog[tid] = {
      categories: (c.categories ?? []).map((x, i) => migrateCategory(x, i)),
      products: (c.products ?? []).map((p, i) => {
        const prod = { ...p };
        if (typeof prod.sortOrder !== "number") prod.sortOrder = i;
        return prod;
      }),
      optionGroups: c.optionGroups ?? [],
      optionItems: c.optionItems ?? []
    };
  }
  const users = parsed.users ?? [];
  const auditEvents = parsed.auditEvents ?? [];
  const globalCategories = Array.isArray(parsed.globalCategories) && parsed.globalCategories.length > 0 ? parsed.globalCategories : [...DEFAULT_GLOBAL_CATEGORIES];
  const categoryPolicies = Array.isArray(parsed.categoryPolicies) && parsed.categoryPolicies.length > 0 ? parsed.categoryPolicies : [...DEFAULT_CATEGORY_POLICIES];
  const pillars = Array.isArray(parsed.pillars) && parsed.pillars.length > 0 ? parsed.pillars : [...DEFAULT_PILLARS];
  const subCategories = Array.isArray(parsed.subCategories) ? parsed.subCategories : [];
  const settlementLogs = Array.isArray(parsed.settlementLogs) ? parsed.settlementLogs : [];
  const optionTemplates = parsed.optionTemplates && typeof parsed.optionTemplates === "object" ? parsed.optionTemplates : {};
  for (const t of tenants) {
    const tid = t.id;
    if (tid && !t.marketId) {
      for (const m of markets) {
        const mStores = m.stores ?? [];
        const mIds = m.tenantIds ?? [];
        if (mStores.some((s) => s.id === tid) || mIds.includes(tid)) {
          t.marketId = m.id;
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
    delivery: parsed.delivery && typeof parsed.delivery === "object" ? parsed.delivery : {},
    deliveryZones: parsed.deliveryZones && typeof parsed.deliveryZones === "object" ? parsed.deliveryZones : {},
    couriers: (parsed.couriers ?? []).map((c) => migrateCourier(c)),
    customers: parsed.customers ?? [],
    deliveryJobs: parsed.deliveryJobs ?? [],
    templates: parsed.templates ?? [],
    staff: parsed.staff ?? [],
    globalCategories,
    leads: parsed.leads ?? [],
    categoryPolicies,
    pillars,
    subCategories,
    settlementLogs,
    optionTemplates
  };
}
function load() {
  try {
    if (existsSync(DATA_FILE)) {
      const raw = readFileSync(DATA_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      const data = parseToMockData(parsed);
      data.orders = [];
      return data;
    }
  } catch {
  }
  return { ...DEFAULT, users: [], auditEvents: [] };
}
function loadFromPath(filePath) {
  try {
    if (!existsSync(filePath)) return null;
    const raw = readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    return parseToMockData(parsed);
  } catch (err) {
    console.error("[store] loadFromPath failed:", filePath, err instanceof Error ? err.message : err);
    return null;
  }
}
function save(data) {
  try {
    const dir = dirname(DATA_FILE);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("[store] Failed to persist data (check permissions, e.g. DATA_FILE path):", err instanceof Error ? err.message : err);
    throw err;
  }
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
var RENAME_RETRIES = 3;
var RENAME_DELAY_MS = 50;
function saveOrders(orders) {
  const payload = JSON.stringify(orders, null, 2);
  try {
    if (!existsSync(ORDERS_DIR)) mkdirSync(ORDERS_DIR, { recursive: true });
    writeFileSync(ORDERS_TMP, payload, "utf-8");
    let renamed = false;
    for (let attempt = 0; attempt < RENAME_RETRIES; attempt++) {
      try {
        renameSync(ORDERS_TMP, ORDERS_FILE);
        renamed = true;
        break;
      } catch (e) {
        const code = e?.code;
        if (code === "EBUSY" && attempt < RENAME_RETRIES - 1) {
          const end = Date.now() + RENAME_DELAY_MS;
          while (Date.now() < end) {
          }
        } else {
          writeFileSync(ORDERS_FILE, payload, "utf-8");
          if (existsSync(ORDERS_TMP)) try {
            unlinkSync(ORDERS_TMP);
          } catch {
          }
          renamed = true;
          if (code && code !== "EBUSY") console.error("[store] orders rename failed, wrote directly:", code, e?.message);
          break;
        }
      }
    }
    if (!renamed) {
      writeFileSync(ORDERS_FILE, payload, "utf-8");
      if (existsSync(ORDERS_TMP)) try {
        unlinkSync(ORDERS_TMP);
      } catch {
      }
      console.error("[store] orders save used direct write after rename retries");
    }
  } catch (err) {
    console.error("Failed to persist orders:", err);
  }
}
var cache = null;
var lastLoadedMtimeMs = 0;
function dataFileMtimeMs() {
  try {
    if (existsSync(DATA_FILE)) return statSync(DATA_FILE).mtimeMs;
  } catch {
  }
  return 0;
}
function getData() {
  const mtime = dataFileMtimeMs();
  if (!cache || mtime > lastLoadedMtimeMs) {
    cache = load();
    lastLoadedMtimeMs = mtime || Date.now();
  }
  return cache;
}
function invalidateDataCache() {
  cache = null;
  lastLoadedMtimeMs = 0;
}
function persist() {
  if (cache) {
    save(cache);
    lastLoadedMtimeMs = dataFileMtimeMs() || Date.now();
  }
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
  const categories = (cat.categories ?? []).map((c, i) => {
    const x = c;
    if (x.parentId === void 0) x.parentId = null;
    if (x.isVisible === void 0) x.isVisible = true;
    if (typeof x.sortOrder !== "number") x.sortOrder = i;
    return x;
  });
  const allOptionGroups = cat.optionGroups ?? [];
  const optionGroupsList = allOptionGroups.filter(
    (g) => g.tenantId === tenantId || g.ownerId === tenantId || !g.tenantId && !g.ownerId
  );
  const optionGroupsById = new Map(optionGroupsList.map((g) => [g.id, g]));
  const products = (cat.products ?? []).map((p, i) => {
    const prod = p;
    if (typeof prod.sortOrder !== "number") prod.sortOrder = i;
    const optionGroupIds = prod.optionGroupIds;
    let out = prod;
    if (Array.isArray(optionGroupIds) && optionGroupIds.length > 0) {
      const resolved = optionGroupIds.map((id) => optionGroupsById.get(id)).filter(Boolean);
      out = { ...prod, optionGroups: resolved.length > 0 ? resolved : prod.optionGroups };
    }
    if (out.quantityStep === void 0) out.quantityStep = 1;
    if (out.unitName === void 0) out.unitName = "\u062D\u0628\u0629";
    return out;
  });
  return {
    categories,
    products,
    optionGroups: optionGroupsList,
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
function getOptionTemplates(tenantId) {
  const list = getData().optionTemplates?.[tenantId];
  return Array.isArray(list) ? [...list] : [];
}
function addOptionTemplate(tenantId, group) {
  const data = getData();
  if (!data.optionTemplates) data.optionTemplates = {};
  const list = data.optionTemplates[tenantId] ?? [];
  const rec = group;
  const idx = list.findIndex((g) => g.id === rec.id);
  const withTenant = { ...rec, tenantId };
  const next = idx >= 0 ? list.map((g, i) => i === idx ? withTenant : g) : [...list, withTenant];
  data.optionTemplates[tenantId] = next;
  const cat = getCatalog(tenantId);
  const catalogGroups = cat.optionGroups ?? [];
  const catIdx = catalogGroups.findIndex((g) => g.id === rec.id);
  const merged = catIdx >= 0 ? catalogGroups.map((g, i) => i === catIdx ? withTenant : g) : [...catalogGroups, withTenant];
  setCatalog(tenantId, { ...cat, optionGroups: merged });
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
function getSettlementLogs() {
  return getData().settlementLogs ?? [];
}
function appendSettlementLog(entry) {
  const data = getData();
  if (!data.settlementLogs) data.settlementLogs = [];
  data.settlementLogs.push(entry);
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
function getCategoryPolicies() {
  const list = getData().categoryPolicies;
  return Array.isArray(list) && list.length > 0 ? [...list] : [...DEFAULT_CATEGORY_POLICIES];
}
function setCategoryPolicies(policies) {
  getData().categoryPolicies = policies;
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
    timestamp: lead.timestamp && lead.timestamp.trim() ? lead.timestamp : (/* @__PURE__ */ new Date()).toISOString()
  };
  data.leads = [...data.leads ?? [], full];
  persist();
  return full;
}
function getPillars() {
  const list = getData().pillars;
  return Array.isArray(list) && list.length > 0 ? [...list].sort((a, b) => a.sortOrder - b.sortOrder) : [...DEFAULT_PILLARS];
}
function setPillars(pillars) {
  getData().pillars = pillars;
  persist();
}
function getSubCategories() {
  const list = getData().subCategories;
  return Array.isArray(list) ? [...list].sort((a, b) => a.sortOrder - b.sortOrder) : [];
}
function setSubCategories(subCategories) {
  getData().subCategories = subCategories;
  persist();
}

// src/market-config.ts
import { readFileSync as readFileSync2, writeFileSync as writeFileSync2, existsSync as existsSync2, copyFileSync, mkdirSync as mkdirSync2 } from "fs";
import { join as join2, dirname as dirname2 } from "path";
var CONFIG_FILE = process.env.MARKET_CONFIG_FILE || join2(process.cwd(), "market-config.json");
var LEGACY_CONFIG_FILE = join2(process.cwd(), "market-config.json");
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
function migrateFromLegacyIfNeeded() {
  if (!existsSync2(LEGACY_CONFIG_FILE)) return;
  if (existsSync2(CONFIG_FILE)) return;
  try {
    const dir = dirname2(CONFIG_FILE);
    if (!existsSync2(dir)) mkdirSync2(dir, { recursive: true });
    copyFileSync(LEGACY_CONFIG_FILE, CONFIG_FILE);
    console.log("[market-config] Migrated from", LEGACY_CONFIG_FILE, "to", CONFIG_FILE);
  } catch (err) {
    console.warn("[market-config] Migration copy failed (will use defaults):", err instanceof Error ? err.message : err);
  }
}
function load2() {
  migrateFromLegacyIfNeeded();
  try {
    if (existsSync2(CONFIG_FILE)) {
      const raw = readFileSync2(CONFIG_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      return {
        banners: parsed.banners ?? SEED_BANNERS,
        layout: parsed.layout ?? SEED_LAYOUT
      };
    }
  } catch (err) {
    console.warn("[market-config] Load failed (will use defaults):", err instanceof Error ? err.message : err);
  }
  return { banners: { ...SEED_BANNERS }, layout: { ...SEED_LAYOUT } };
}
function save2(store) {
  try {
    const dir = dirname2(CONFIG_FILE);
    if (!existsSync2(dir)) mkdirSync2(dir, { recursive: true });
    writeFileSync2(CONFIG_FILE, JSON.stringify(store, null, 2), "utf-8");
    cache2 = null;
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
function normalizeSection(s) {
  return {
    ...s,
    type: s.type === "MARKET_GROUP" ? "MARKET_GROUP" : "SLIDER"
  };
}
function getLayoutForMarket(marketSlug) {
  const raw = getStore().layout[marketSlug] ?? DEFAULT_LAYOUT;
  return raw.map((s) => normalizeSection(s));
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
  if (order.fulfillmentType === "PICKUP" || order.fulfillmentType === "IN_STORE") return false;
  if (order.fulfillmentType !== "DELIVERY") return false;
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
    if (o.fulfillmentType === "PICKUP" || o.fulfillmentType === "IN_STORE") return o;
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
  return orders.filter((o) => o.tenantId && tenantIds.has(o.tenantId)).filter((o) => o.fulfillmentType === "DELIVERY").filter((o) => isOrderEligibleForMarketDispatch(o, tenants)).filter((o) => !o.courierId).filter((o) => !activeJobOrderIds.has(o.id ?? "")).sort((a, b) => {
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
    },
    async deleteById(id) {
      const orders = getOrders().filter((o) => String(o.id) !== id);
      setOrders(orders);
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
    },
    async deleteSettings(tenantId) {
      const d = getDelivery();
      delete d[tenantId];
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
    },
    async deleteForOrderIds() {
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
    imageUrl: m.imageUrl ?? void 0,
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
    collections: t.collections ? JSON.parse(t.collections) : void 0,
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
    paymentCapabilities: t.paymentCapabilities ? JSON.parse(t.paymentCapabilities) : void 0,
    operationalStatus: t.operationalStatus ?? void 0,
    orderPolicy: t.orderPolicy ?? void 0,
    businessHours: t.businessHours ? JSON.parse(t.businessHours) : void 0,
    busyBannerEnabled: t.busyBannerEnabled ?? void 0,
    busyBannerText: t.busyBannerText ?? void 0,
    bookingEnabled: t.bookingEnabled ?? void 0,
    about: t.about ?? void 0,
    officeHours: t.officeHours ?? void 0,
    openTime: t.openTime ?? void 0,
    closeTime: t.closeTime ?? void 0,
    forceClosed: t.forceClosed ?? void 0,
    phone: t.phone ?? void 0,
    storeType: t.storeType ?? void 0,
    appointmentDuration: t.appointmentDuration ?? void 0,
    addressLine: t.addressLine ?? void 0,
    location: t.location ? JSON.parse(t.location) : void 0,
    deliveryRadiusKm: t.deliveryRadiusKm ?? void 0,
    pillarId: t.pillarId ?? void 0,
    subCategoryId: t.subCategoryId ?? void 0
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
            imageUrl: m.imageUrl ?? null,
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
            paymentCapabilities: t.paymentCapabilities ? JSON.stringify(t.paymentCapabilities) : null,
            operationalStatus: t.operationalStatus ?? null,
            orderPolicy: t.orderPolicy ?? null,
            businessHours: t.businessHours ? JSON.stringify(t.businessHours) : null,
            busyBannerEnabled: t.busyBannerEnabled ?? null,
            busyBannerText: t.busyBannerText ?? null,
            bookingEnabled: t.bookingEnabled ?? null,
            about: t.about ?? null,
            officeHours: t.officeHours ?? null,
            openTime: t.openTime ?? null,
            closeTime: t.closeTime ?? null,
            forceClosed: t.forceClosed ?? null,
            phone: t.phone ?? null,
            storeType: t.storeType ?? null,
            appointmentDuration: t.appointmentDuration ?? null,
            collections: t.collections ? JSON.stringify(t.collections) : null,
            addressLine: t.addressLine ?? null,
            location: t.location ? JSON.stringify(t.location) : null,
            deliveryRadiusKm: t.deliveryRadiusKm ?? null,
            pillarId: t.pillarId ?? null,
            subCategoryId: t.subCategoryId ?? null
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
        password: u.password ?? void 0,
        mustChangePassword: u.mustChangePassword ?? void 0,
        fcmToken: u.fcmToken ?? void 0
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
            password: u.password ?? null,
            mustChangePassword: u.mustChangePassword ?? null,
            fcmToken: u.fcmToken ?? null
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
        name: c.name ?? void 0,
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
            name: c.name ?? null,
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
    },
    async deleteById(id) {
      await prisma.order.delete({ where: { id } });
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
      isFeatured: p.isFeatured ?? void 0,
      isArchived: p.isArchived ?? void 0,
      sortOrder: p.sortOrder ?? void 0
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
              isFeatured: p.isFeatured ?? null,
              isArchived: p.isArchived ?? false,
              sortOrder: p.sortOrder ?? 0
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
    },
    async deleteSettings(tenantId) {
      await prisma.tenantDeliverySettings.deleteMany({ where: { tenantId } });
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
    },
    async deleteForOrderIds(orderIds) {
      if (orderIds.length === 0) return;
      await prisma.payment.deleteMany({ where: { orderId: { in: orderIds } } });
    }
  };
}

// src/repos/index.ts
var driver = "db";
function createRepos() {
  if (driver === "db") {
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

// src/index.ts
import { PrismaClient as PrismaClient2 } from "@prisma/client";

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
  return String(randomInt(1e5, 999999));
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
  const isDevOrMock = process.env.NODE_ENV !== "production" || process.env.MOCK_OTP === "1" || process.env.MOCK_OTP === "true";
  if (isDevOrMock) {
    console.log(`[OTP] ${phone} (normalized: ${key}) \u2192 code: ${code} (expires in 5 min)`);
    return { ok: true, codeForSending: code, devCode: code };
  }
  return { ok: true, codeForSending: code };
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

// src/push-subscriptions.ts
import { readFileSync as readFileSync3, writeFileSync as writeFileSync3, existsSync as existsSync3, mkdirSync as mkdirSync3 } from "fs";
import { join as join3, dirname as dirname3 } from "path";
import webpush from "web-push";
var VAPID_PUBLIC_KEY_ENV = "VAPID_PUBLIC_KEY";
var VAPID_PRIVATE_KEY_ENV = "VAPID_PRIVATE_KEY";
var VAPID_MAILTO = "mailto:admin@nmd.marketing";
var HARDCODED_VAPID_PUBLIC = "BFadhS3-u7kPKhi0zE8yVLb05BJzSjqbX1yrFOxKQ9gSTIL-NxAYlE-EVDOhuHO8s2pJ60nt3Gi_ZlDrQEldyKg";
var HARDCODED_VAPID_PRIVATE = "EysEyBtpApxAV4-mjGyQZgWTRalMR4rIgfg9eWb9ua4";
var PUSH_SUBS_FILE = process.env.PUSH_SUBSCRIPTIONS_FILE || join3(process.cwd(), "data", "push-subscriptions.json");
var pubEnv = (process.env[VAPID_PUBLIC_KEY_ENV] ?? "").trim();
var privEnv = (process.env[VAPID_PRIVATE_KEY_ENV] ?? "").trim();
var vapidPublicKey = pubEnv && privEnv ? pubEnv : HARDCODED_VAPID_PUBLIC;
var vapidPrivateKey = pubEnv && privEnv ? privEnv : HARDCODED_VAPID_PRIVATE;
webpush.setVapidDetails(VAPID_MAILTO, vapidPublicKey, vapidPrivateKey);
function getVapidPublicKey() {
  return vapidPublicKey.trim();
}
function load3() {
  try {
    if (existsSync3(PUSH_SUBS_FILE)) {
      const raw = readFileSync3(PUSH_SUBS_FILE, "utf-8");
      const data = JSON.parse(raw);
      return typeof data === "object" && data !== null ? data : {};
    }
  } catch {
  }
  return {};
}
function save3(data) {
  try {
    const dir = dirname3(PUSH_SUBS_FILE);
    if (!existsSync3(dir)) {
      mkdirSync3(dir, { recursive: true });
    }
    writeFileSync3(PUSH_SUBS_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    const e = err;
    console.error("[Push] Failed to save subscriptions:", e?.code ?? "error", e?.message ?? err, "path:", PUSH_SUBS_FILE);
  }
}
var memory = load3();
function saveSubscription(phone, subscription) {
  const key = String(phone).replace(/\D/g, "");
  if (!key) return;
  const list = memory[key] ?? [];
  const sameEndpoint = list.find((s) => s.endpoint === subscription.endpoint);
  const isNew = !sameEndpoint;
  if (sameEndpoint) {
    sameEndpoint.keys = subscription.keys;
    sameEndpoint.expirationTime = subscription.expirationTime;
  } else {
    list.push({ ...subscription });
  }
  memory[key] = list.slice(-10);
  save3(memory);
  console.log(`[Push] Subscription ${isNew ? "registered" : "updated"} for phone ***${key.slice(-4)} (${list.length} device(s))`);
}
function getSubscriptionsByPhone(phone) {
  const key = String(phone).replace(/\D/g, "");
  return memory[key] ?? [];
}
var ADMIN_KEY_PREFIX = "tenant:";
function saveAdminSubscription(tenantId, subscription) {
  const key = ADMIN_KEY_PREFIX + String(tenantId);
  const list = memory[key] ?? [];
  const sameEndpoint = list.find((s) => s.endpoint === subscription.endpoint);
  const isNew = !sameEndpoint;
  if (sameEndpoint) {
    sameEndpoint.keys = subscription.keys;
    sameEndpoint.expirationTime = subscription.expirationTime;
  } else {
    list.push({ ...subscription });
  }
  memory[key] = list.slice(-20);
  save3(memory);
  console.log(`[Push] Admin subscription ${isNew ? "registered" : "updated"} for tenant ${tenantId} (${list.length} device(s))`);
}
function getSubscriptionsByTenant(tenantId) {
  const key = ADMIN_KEY_PREFIX + String(tenantId);
  return memory[key] ?? [];
}
function sendPushNotification(subscription, payload) {
  const body = typeof payload === "string" ? payload : JSON.stringify(payload);
  const endpoint = subscription?.endpoint;
  const keys = subscription?.keys;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return Promise.reject(new Error("Push subscription missing endpoint or keys (p256dh/auth)"));
  }
  const pushSubscription = {
    endpoint,
    keys: { p256dh: keys.p256dh, auth: keys.auth }
  };
  return webpush.sendNotification(pushSubscription, body, { TTL: 86400, urgency: "normal" }).catch((err) => {
    const statusCode = err?.statusCode;
    const bodyStr = err?.body != null ? Buffer.isBuffer(err.body) ? err.body.toString("utf-8") : String(err.body) : "";
    console.error("[Push] sendNotification failed", {
      statusCode,
      body: bodyStr,
      endpoint: endpoint?.slice(0, 60) + "...",
      message: err?.message,
      fullError: err
    });
    if (statusCode === 401 || statusCode === 403) {
      throw new Error(`VAPID keys invalid (${statusCode}). Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY to override the hardcoded keys.`);
    }
    if (statusCode === 400) {
      throw new Error(`Push payload or subscription invalid (400): ${bodyStr || err?.message}`);
    }
    throw new Error(bodyStr || err?.message || `Push failed (${statusCode ?? "unknown"})`);
  });
}

// src/services/NotificationService.ts
var WHATSAPP_SERVICE_URL = process.env.WHATSAPP_WEB_SERVICE_URL ?? process.env.WHATSAPP_SERVICE_URL ?? "http://whatsapp-service:3000";
var ORDER_ACTIONS_BASE = process.env.ORDER_ACTIONS_BASE_URL ?? "https://nmd.marketing/merchant";
function formatMoney(value) {
  if (value == null || Number.isNaN(value)) return "0";
  return `\u20AA${Number(value).toFixed(2)}`;
}
function notifyMerchantNewOrder(order, tenant) {
  const tenantId = order.tenantId;
  if (!tenantId) return;
  const amount = order.total;
  const amountStr = amount != null && !Number.isNaN(Number(amount)) ? formatMoney(Number(amount)) : "\u2014";
  const pushPayload = {
    title: "\u0637\u0644\u0628 \u062C\u062F\u064A\u062F \u0648\u0635\u0644! \u{1F514}",
    body: `\u0637\u0644\u0628 \u062C\u062F\u064A\u062F \u0628\u0642\u064A\u0645\u0629 ${amountStr}! \u0627\u0636\u063A\u0637 \u0644\u0645\u0631\u0627\u062C\u0639\u0629 \u0627\u0644\u062A\u0641\u0627\u0635\u064A\u0644 \u0648\u062A\u062D\u0636\u064A\u0631 \u0627\u0644\u0637\u0644\u0628.`,
    tag: "new-order-alarm",
    renotify: true
  };
  const subs = getSubscriptionsByTenant(tenantId);
  for (const sub of subs) {
    sendPushNotification(sub, pushPayload).catch(
      (e) => console.error("[NotificationService] Merchant push failed:", e)
    );
  }
}
var TEMPLATES = {
  CONFIRMED: (name, num, store) => `\u0623\u0647\u0644\u0627\u064B ${name}\u060C \u0645\u062A\u062C\u0631 ${store} \u0642\u0627\u0645 \u0628\u062A\u0623\u0643\u064A\u062F \u0637\u0644\u0628\u0643 #${num} \u0648\u0647\u0648 \u0642\u064A\u062F \u0627\u0644\u062A\u062C\u0647\u064A\u0632! \u{1F468}\u200D\u{1F373}`,
  READY: (name, num, store) => `\u0628\u0634\u0631\u0649 \u0633\u0627\u0631\u0629! \u0645\u062A\u062C\u0631 ${store} \u2014 \u0637\u0644\u0628\u0643 #${num} \u0623\u0635\u0628\u062D \u062C\u0627\u0647\u0632\u0627\u064B. \u2705`,
  COMPLETED: (name, num, store) => `\u0645\u062A\u062C\u0631 ${store}: \u0637\u0644\u0628\u0643 #${num} \u062E\u0631\u062C \u0627\u0644\u0622\u0646 \u0645\u0639 \u0627\u0644\u0645\u0631\u0633\u0644\u060C \u0646\u062A\u0645\u0646\u0649 \u0644\u0643 \u062A\u062C\u0631\u0628\u0629 \u0631\u0627\u0626\u0639\u0629! \u{1F69A}`
};
function triggerStatusNotification(order, newStatus, storeName) {
  const status = String(newStatus).toUpperCase();
  if (!TEMPLATES[status]) {
    return;
  }
  const phone = order.customerPhone ? String(order.customerPhone).replace(/\s/g, "").trim() : "";
  const name = (order.customerName ?? "").trim() || "\u0639\u0645\u064A\u0644\u0646\u0627";
  const orderNumber = (order.id ?? "").toString().slice(0, 8);
  const store = (storeName ?? "").trim() || "\u0627\u0644\u0645\u062A\u062C\u0631";
  const message = TEMPLATES[status](name, orderNumber, store);
  console.log("[NotificationService] WhatsApp (simulation)");
  console.log("[NotificationService] To:", phone || "(no phone)");
  console.log("[NotificationService] Message:", message);
  console.log("[NotificationService] ---");
}
var CUSTOMER_PUSH_MESSAGES = {
  CONFIRMED: { title: "\u062A\u062D\u062F\u064A\u062B \u0627\u0644\u0637\u0644\u0628", body: "\u0637\u0644\u0628\u0643 \u0642\u064A\u062F \u0627\u0644\u062A\u0646\u0641\u064A\u0630 \u0627\u0644\u0622\u0646! \u{1F468}\u200D\u{1F373}" },
  READY: { title: "\u062A\u062D\u062F\u064A\u062B \u0627\u0644\u0637\u0644\u0628", body: "\u0637\u0644\u0628\u0643 \u0641\u064A \u0627\u0644\u0637\u0631\u064A\u0642 \u0625\u0644\u064A\u0643! \u{1F69A}" },
  COMPLETED: { title: "\u062A\u062D\u062F\u064A\u062B \u0627\u0644\u0637\u0644\u0628", body: "\u0637\u0644\u0628\u0643 \u0641\u064A \u0627\u0644\u0637\u0631\u064A\u0642 \u0625\u0644\u064A\u0643! \u{1F69A}" },
  DELIVERED: { title: "\u062A\u0645 \u0627\u0644\u062A\u0648\u0635\u064A\u0644", body: "\u062A\u0645 \u062A\u0648\u0635\u064A\u0644 \u0627\u0644\u0637\u0644\u0628\u060C \u0628\u0627\u0644\u0647\u0646\u0627\u0621 \u0648\u0627\u0644\u0634\u0641\u0627\u0621! \u{1F37D}\uFE0F" }
};
function sendFCMToCustomerToken(fcmToken, status, orderId) {
  const msg = CUSTOMER_PUSH_MESSAGES[String(status).toUpperCase()];
  if (!msg) return;
  console.log("[NotificationService] FCM (mock) to token", fcmToken.slice(0, 20) + "...", "orderId:", orderId, "title:", msg.title, "body:", msg.body);
}
function sendFCMToToken(token, title, body) {
  console.log("[NotificationService] FCM (mock) broadcast to token", token.slice(0, 20) + "...", "title:", title, "body:", body);
}
function notifyCustomerOrderStatusPush(phone, status) {
  const msg = CUSTOMER_PUSH_MESSAGES[String(status).toUpperCase()];
  if (!msg) return;
  const normalizedPhone = String(phone ?? "").replace(/\D/g, "").trim();
  if (!normalizedPhone) return;
  const subs = getSubscriptionsByPhone(normalizedPhone);
  if (subs.length === 0) {
    console.log("[NotificationService] notifyCustomerOrderStatusPush: no subscription for phone ***" + normalizedPhone.slice(-4));
    return;
  }
  console.log("[NotificationService] notifyCustomerOrderStatusPush: found " + subs.length + " subscription(s) for phone ***" + normalizedPhone.slice(-4));
  const payload = {
    title: msg.title,
    body: msg.body,
    tag: "nmd-order-status",
    renotify: true
  };
  for (const sub of subs) {
    sendPushNotification(sub, payload).catch((e) => {
      console.warn("[NotificationService] Customer push failed for", normalizedPhone.slice(-4), e?.message ?? e);
    });
  }
}

// src/services/CouponService.ts
var STOREFRONT_BASE = process.env.STOREFRONT_BASE_URL ?? process.env.PUBLIC_URL ?? "https://nmd.marketing";
function buildWinnerCouponMessage(code) {
  const lines = [
    "\u0645\u0628\u0631\u0648\u0643! \u0644\u0642\u062F \u0641\u0632\u062A \u0645\u0639 Now Market.",
    "",
    `\u0643\u0648\u062F \u0627\u0644\u062E\u0635\u0645 \u0627\u0644\u062E\u0627\u0635 \u0628\u0643 \u0647\u0648: ${code}.`,
    "",
    "\u0627\u0633\u062A\u062E\u062F\u0645\u0647 \u0627\u0644\u0622\u0646 \u0639\u0628\u0631 \u0627\u0644\u0631\u0627\u0628\u0637 \u0627\u0644\u062A\u0627\u0644\u064A.",
    STOREFRONT_BASE
  ];
  return lines.join("\n");
}
function sendWhatsAppNotification(phoneNumber, code) {
  const normalized = phoneNumber.replace(/\D/g, "").trim();
  if (!normalized || normalized.length < 9) return;
  const message = buildWinnerCouponMessage(code);
  console.log(`[WhatsApp to ${normalized}]: ${message}`);
}

// src/firebase-admin.ts
import { readFileSync as readFileSync4, existsSync as existsSync4 } from "fs";
import admin from "firebase-admin";
var app = null;
function initFirebase() {
  if (app) return app;
  const json = (process.env.FIREBASE_SERVICE_ACCOUNT_JSON ?? "").trim();
  const path = (process.env.FIREBASE_SERVICE_ACCOUNT_PATH ?? "").trim();
  console.log("[FCM] Init check: FIREBASE_SERVICE_ACCOUNT_JSON length=", json.length, ", FIREBASE_SERVICE_ACCOUNT_PATH=", path || "(empty)");
  if (json) {
    try {
      const cred = JSON.parse(json);
      console.log("[FCM] Loaded project_id (verify correct app):", cred.project_id ?? "(missing)");
      app = admin.initializeApp({ credential: admin.credential.cert(cred) });
      console.log("[FCM] Initialized from FIREBASE_SERVICE_ACCOUNT_JSON");
      return app;
    } catch (e) {
      console.error("[FCM] Invalid FIREBASE_SERVICE_ACCOUNT_JSON:", e.message);
      return null;
    }
  }
  if (path) {
    const fileExists = existsSync4(path);
    console.log("[FCM] Path mode: file exists=", fileExists, ", path=", path);
    if (!fileExists) {
      console.error("[FCM] File not found at FIREBASE_SERVICE_ACCOUNT_PATH. Check volume mount.");
      return null;
    }
    try {
      const raw = readFileSync4(path, "utf8");
      const cred = JSON.parse(raw);
      console.log("[FCM] Loaded project_id (verify correct app):", cred.project_id ?? "(missing)");
      if (!cred.client_email || !cred.private_key) {
        console.error("[FCM] JSON missing client_email or private_key (wrong file type?). Use Firebase Console \u2192 Service accounts \u2192 Generate new private key.");
        return null;
      }
      app = admin.initializeApp({ credential: admin.credential.cert(cred) });
      console.log("[FCM] Initialized from FIREBASE_SERVICE_ACCOUNT_PATH");
      return app;
    } catch (e) {
      console.error("[FCM] Failed to load service account from path:", e.message);
      return null;
    }
  }
  console.warn("[FCM] Not configured: set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH");
  return null;
}
var FCM_MISMATCH_WARNING = "[FCM] *** Service Account JSON does not match the App's Firebase project. Replace the key file with one from the same project as your app (e.g. now-market-59841). ***";
function isMismatchedCredentialError(err) {
  const msg = err instanceof Error ? err.message : String(err);
  const code = typeof err?.code === "string" ? err.code : "";
  const lower = (msg + " " + code).toLowerCase();
  return lower.includes("mismatch") || lower.includes("credential") && lower.includes("project") || lower.includes("sender") && lower.includes("match") || lower.includes("third-party") || lower.includes("auth/credential");
}
function logMismatchIfNeeded(err) {
  if (isMismatchedCredentialError(err)) console.warn(FCM_MISMATCH_WARNING);
}
async function sendFCMMulticast(tokens, payload) {
  const a = initFirebase();
  const clean = (tokens ?? []).map((t) => t.trim()).filter(Boolean);
  if (!a || clean.length === 0) {
    return { successCount: 0, failureCount: 0 };
  }
  try {
    const res = await a.messaging().sendEachForMulticast({
      tokens: clean,
      notification: {
        title: payload.title,
        body: payload.body
      },
      data: payload.data ?? {},
      android: {
        priority: "high",
        notification: {
          sound: "default",
          channelId: "new_order_alerts",
          priority: "max",
          defaultSound: true
        }
      },
      apns: {
        payload: { aps: { sound: "default", contentAvailable: true } },
        fcmOptions: {}
      }
    });
    console.log("[FCM] sendEachForMulticast result: success=", res.successCount, "failure=", res.failureCount);
    if (res.failureCount > 0) {
      res.responses.forEach((resp, idx) => {
        if (!resp.success && resp.error) {
          console.error(`[FCM] Token ${idx} Error:`, JSON.stringify(resp.error, null, 2));
          logMismatchIfNeeded(resp.error);
        }
      });
    }
    return { successCount: res.successCount, failureCount: res.failureCount };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[FCM] sendMulticast failed:", msg);
    logMismatchIfNeeded(e);
    return { successCount: 0, failureCount: clean.length };
  }
}

// src/index.ts
var PORT = Number(process.env.PORT ?? 5190);
var repos = createRepos();
var prisma2 = new PrismaClient2();
var isStorageDb = () => (process.env.STORAGE_DRIVER ?? "").toLowerCase() === "db";
async function getCustomerFcmToken(customerId) {
  if (isStorageDb()) {
    const row = await prisma2.customerFCMToken.findFirst({
      where: { customerId },
      orderBy: { createdAt: "desc" },
      select: { token: true }
    });
    return row?.token ?? null;
  }
  const customers = await repos.customers.findAll();
  const c = customers.find((x) => x.id === customerId);
  return c?.fcmToken ?? null;
}
async function getAllCustomerFcmTokens() {
  if (isStorageDb()) {
    const rows = await prisma2.customerFCMToken.findMany({ select: { token: true } });
    return rows.map((r) => r.token);
  }
  const customers = await repos.customers.findAll();
  return customers.map((c) => c.fcmToken).filter(Boolean);
}
async function sendFCMNotification(customerId, title, body) {
  try {
    const token = await getCustomerFcmToken(customerId);
    if (!token) {
      console.log("[FCM] sendFCMNotification: no token for customerId", customerId);
      return;
    }
    sendFCMToToken(token, title, body);
  } catch (e) {
    console.warn("[FCM] sendFCMNotification failed for customerId", customerId, e);
  }
}
async function sendFCMToTenantForNewOrder(tenantId, order) {
  try {
    const tenantRow = await prisma2.tenant.findUnique({ where: { id: tenantId }, select: { marketId: true, name: true } });
    const marketId = tenantRow?.marketId ?? null;
    const storeName = tenantRow?.name ?? tenantId;
    const amountStr = order.total != null && !Number.isNaN(Number(order.total)) ? `\u20AA${Number(order.total).toFixed(2)}` : "\u2014";
    const fcmTitle = "\u0637\u0644\u0628 \u062C\u062F\u064A\u062F \u0648\u0635\u0644! \u{1F514}";
    const fcmBody = `\u0637\u0644\u0628 \u062C\u062F\u064A\u062F \u0628\u0642\u064A\u0645\u0629 ${amountStr}! \u0627\u0636\u063A\u0637 \u0644\u0645\u0631\u0627\u062C\u0639\u0629 \u0627\u0644\u062A\u0641\u0627\u0635\u064A\u0644 \u0648\u062A\u062D\u0636\u064A\u0631 \u0627\u0644\u0637\u0644\u0628.`;
    const orderId = order.id ?? "";
    console.log("[FCM] sendFCMToTenantForNewOrder: tenant", tenantId, storeName, "orderId", orderId);
    const ownerUsers = await prisma2.user.findMany({
      where: {
        OR: [{ tenantId }, ...marketId ? [{ role: "MARKET_ADMIN", marketId }] : []]
      },
      select: { id: true, fcmToken: true }
    });
    const ownerIds = [...new Set(ownerUsers.map((u) => u.id))];
    console.log("[FCM] Owner user(s) for store:", ownerIds.length, ownerIds);
    const tokensFromTable = await prisma2.userFCMToken.findMany({
      where: { userId: { in: ownerIds } },
      select: { token: true }
    });
    const legacyTokens = ownerUsers.map((u) => u.fcmToken).filter(Boolean);
    const allTokens = [.../* @__PURE__ */ new Set([...tokensFromTable.map((r) => r.token), ...legacyTokens])];
    console.log("[FCM] Total FCM tokens to send:", allTokens.length, "(UserFCMToken:", tokensFromTable.length, ", legacy:", legacyTokens.length, ")");
    if (allTokens.length === 0) {
      console.warn("[FCM] No FCM tokens for store owners. Merchant must log in from the app and allow notifications.");
      return;
    }
    for (const token of allTokens) {
      const result = await sendFCMToToken(token, { title: fcmTitle, body: fcmBody, data: { orderId, type: "new_order" } });
      if (result.success) console.log("[FCM] Sent to token", token.slice(0, 20) + "...");
      else console.error("[FCM] Send failed:", result.error, "token:", token.slice(0, 20) + "...");
    }
  } catch (e) {
    console.error("[FCM] sendFCMToTenantForNewOrder failed:", e);
  }
}
function wrapAsync(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
var JWT_SECRET = process.env.JWT_SECRET ?? "nmd-dev-secret-2026";
console.log("[MockAPI] JWT_SECRET loaded:", JWT_SECRET ? `${JWT_SECRET.slice(0, 8)}...` : "MISSING (using default)");
var app2 = express();
var DABBURIYYA_MARKET_ID = "market-dabburiyya";
var IKSAL_MARKET_ID = "market-iksal";
var ROOT_ADMIN_ID = "user-root-admin";
function isPlatformAdmin(role) {
  return role === "ROOT_ADMIN" || role === "SUPER_ADMIN";
}
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
  const tenants = await repos.tenants.findAll();
  let changed = false;
  for (const t of tenants) {
    if (!t.marketId && t.id) {
      for (const m of markets) {
        const stores = m.stores ?? [];
        const ids = m.tenantIds ?? [];
        if (stores.some((s) => s.id === t.id) || ids.includes(t.id)) {
          t.marketId = m.id;
          changed = true;
          break;
        }
      }
    }
    if (t.enabled === void 0) {
      t.enabled = true;
      changed = true;
    }
    if (t.isListedInMarket === void 0) {
      t.isListedInMarket = true;
      changed = true;
    }
    const op = t.operationalStatus;
    if (op !== "open" && op !== "closed" && op !== "busy") {
      t.operationalStatus = "open";
      changed = true;
    }
  }
  if (changed) await repos.tenants.setAll(tenants);
}
async function seedOrdersIfNeeded() {
}
async function seedDeliveryZonesIfNeeded() {
  const tenants = await repos.tenants.findAll();
  for (const t of tenants) {
    const existing = await repos.deliveryZones.getByTenant(t.id);
    if (existing.length > 0) continue;
    const zones = [
      { id: `dz-${t.id}-1`, tenantId: t.id, name: "\u062F\u0628\u0648\u0631\u064A\u0629", fee: 15, isActive: true, sortOrder: 0 },
      { id: `dz-${t.id}-2`, tenantId: t.id, name: "\u0627\u0644\u0634\u0628\u0644\u064A / \u0623\u0645 \u0627\u0644\u063A\u0646\u0645", fee: 25, isActive: true, sortOrder: 1 },
      { id: `dz-${t.id}-3`, tenantId: t.id, name: "\u0627\u0644\u0642\u0631\u0649 \u0627\u0644\u0632\u0639\u0628\u064A\u0629", fee: 40, isActive: true, sortOrder: 2 },
      { id: `dz-${t.id}-4`, tenantId: t.id, name: "\u0625\u0643\u0633\u0627\u0644", fee: 35, isActive: true, sortOrder: 3 }
    ];
    await repos.deliveryZones.setAll(t.id, zones);
  }
}
var UPLOADS_DIR = (() => {
  const envDir = process.env.UPLOADS_DIR;
  if (envDir) return resolve(envDir);
  const dataUploads = join4(process.cwd(), "data", "uploads");
  if (!existsSync5(dataUploads)) mkdirSync4(dataUploads, { recursive: true });
  return resolve(dataUploads);
})();
var UPLOADS_BANNERS_DIR = join4(UPLOADS_DIR, "banners");
if (!existsSync5(UPLOADS_DIR)) mkdirSync4(UPLOADS_DIR, { recursive: true });
if (!existsSync5(UPLOADS_BANNERS_DIR)) mkdirSync4(UPLOADS_BANNERS_DIR, { recursive: true });
console.log("[mock-api] UPLOADS_DIR (static /uploads):", UPLOADS_DIR, "exists:", existsSync5(UPLOADS_DIR));
var SAFE_IMAGE_EXT = /^(jpg|jpeg|png|webp|gif)$/i;
function safeImageExt(originalName) {
  const ext = (originalName.match(/\.([^.]+)$/)?.[1] ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  return SAFE_IMAGE_EXT.test(ext) ? ext : "jpg";
}
var storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = safeImageExt(file.originalname);
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
    cb(null, name);
  }
});
var upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files allowed"));
  }
});
var BANNER_MAX_BYTES = 10 * 1024 * 1024;
var ALLOWED_BANNER_MIMES = ["image/webp", "image/jpeg", "image/jpg", "image/png"];
var bannerStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_BANNERS_DIR),
  filename: (_req, file, cb) => {
    const ext = safeImageExt(file.originalname).replace("jpeg", "jpg");
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
  origin: (origin, cb) => {
    cb(null, true);
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "X-Emergency-Mode"],
  exposedHeaders: ["Authorization"],
  credentials: true
};
app2.use(cors(corsOptions));
app2.options("*", cors(corsOptions));
app2.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) res.setHeader("Access-Control-Allow-Origin", origin);
  next();
});
app2.use(express.json({ limit: "10mb" }));
app2.use(express.urlencoded({ extended: true, limit: "10mb" }));
app2.use((_req, res, next) => {
  const origJson = res.json.bind(res);
  res.json = function(body) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return origJson(body);
  };
  next();
});
var UPLOAD_WEBP_QUALITY = 75;
async function compressNewUploadToWebP(filePath) {
  const ext = (filePath.match(/\.([^.]+)$/)?.[1] ?? "").toLowerCase();
  if (!["jpg", "jpeg", "png", "webp"].includes(ext)) return basename(filePath);
  try {
    const dir = dirname4(filePath);
    const base = basename(filePath, ext ? `.${ext}` : "");
    const webpPath = join4(dir, `${base}.webp`);
    await sharp(filePath).resize(1920, 1920, { fit: "inside", withoutEnlargement: true }).webp({ quality: UPLOAD_WEBP_QUALITY }).toFile(webpPath);
    if (webpPath !== filePath) unlinkSync2(filePath);
    return basename(webpPath);
  } catch (err) {
    console.warn("[Upload] WebP convert failed (file left as-is):", err instanceof Error ? err.message : err);
    return basename(filePath);
  }
}
var UPLOADS_CACHE = "public, max-age=31536000, immutable";
app2.use("/uploads", cors({ origin: "*", methods: ["GET", "HEAD", "OPTIONS"] }), (req, res, next) => {
  if (req.method !== "GET" && req.method !== "HEAD") return next();
  const rel = (req.path.replace(/^\/uploads\/?/, "") || "").replace(/^\/+/, "");
  if (!rel) return next();
  const full = resolve(join4(UPLOADS_DIR, rel));
  if (!full.startsWith(resolve(UPLOADS_DIR))) return res.status(400).end();
  if (existsSync5(full)) return next();
  const dir = dirname4(full);
  const base = basename(full);
  if (!existsSync5(dir)) return next();
  const lower = base.toLowerCase();
  const found = readdirSync(dir).find((f) => f.toLowerCase() === lower);
  if (found) {
    const target = join4(dir, found);
    res.setHeader("Cache-Control", UPLOADS_CACHE);
    res.sendFile(target, { maxAge: 31536e3 }, (err) => {
      if (err) next();
    });
  } else {
    next();
  }
}, express.static(UPLOADS_DIR, { index: false, setHeaders: (res) => res.setHeader("Cache-Control", UPLOADS_CACHE) }));
app2.use((req, res, next) => {
  console.log(`INCOMING REQUEST: ${req.method} ${req.url}`);
  next();
});
function uploadErrorMessage(err) {
  if (err?.code === "LIMIT_FILE_SIZE") return "File too large";
  if (err?.code === "LIMIT_UNEXPECTED_FILE") return "Unexpected file field";
  return err?.message ?? "Upload failed";
}
app2.use((req, res, next) => {
  if (req.method === "POST" && req.path === "/upload/banner") {
    return bannerUpload.single("file")(req, res, (err) => {
      if (err) return res.status(400).json({ error: uploadErrorMessage(err) });
      next();
    });
  }
  if (req.method === "POST" && req.path === "/upload") {
    return upload.array("files", 20)(req, res, (err) => {
      if (err) return res.status(400).json({ error: uploadErrorMessage(err) });
      next();
    });
  }
  next();
});
var PUBLIC_ROUTES = [
  { method: "GET", path: /^\/$/ },
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
  { method: "POST", path: /^\/customer\/save-fcm-token$/ },
  { method: "GET", path: /^\/campaigns$/ },
  { method: "GET", path: /^\/delivery\/[^/]+$/ },
  { method: "GET", path: /^\/tenants\/[^/]+\/delivery-zones$/ },
  { method: "GET", path: /^\/public\/orders\/[^/]+$/ },
  { method: "GET", path: /^\/global-categories$/ },
  { method: "GET", path: /^\/categories$/ },
  { method: "GET", path: /^\/pillars$/ },
  { method: "GET", path: /^\/sub-categories$/ },
  { method: "POST", path: /^\/leads$/ },
  { method: "GET", path: /^\/merchant\/dashboard$/ },
  { method: "GET", path: /^\/merchant\/leads$/ },
  { method: "POST", path: /^\/internal\/orders\/[^/]+\/status$/ },
  { method: "GET", path: /^\/customer\/push-public-key$/ },
  { method: "GET", path: /^\/merchant\/push-public-key$/ },
  { method: "GET", path: /^\/data$/ },
  { method: "GET", path: /^\/contest\/active$/ }
];
function isPublicRoute(method, path) {
  return PUBLIC_ROUTES.some((r) => r.method === method && r.path.test(path));
}
app2.use(async (req, _res, next) => {
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
        } else if (decoded.role && ["ROOT_ADMIN", "SUPER_ADMIN", "TENANT_ADMIN", "MARKET_ADMIN"].includes(decoded.role)) {
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
async function handleTestFcm(req, res) {
  console.log("--- TEST FCM TRIGGERED ---");
  const body = req.body;
  const userIdRaw = body?.userId != null && typeof body.userId === "string" ? body.userId.trim() : null;
  const tenantIdRaw = body?.tenantId != null && typeof body.tenantId === "string" ? body.tenantId.trim() : null;
  let ownerIds;
  let label;
  if (tenantIdRaw) {
    const tenant = await prisma2.tenant.findUnique({ where: { id: tenantIdRaw }, select: { name: true, marketId: true } });
    if (!tenant) {
      res.status(404).json({ error: "Tenant not found", tenantId: tenantIdRaw });
      return;
    }
    const marketId = tenant.marketId ?? null;
    const users = await prisma2.user.findMany({
      where: { OR: [{ tenantId: tenantIdRaw }, ...marketId ? [{ role: "MARKET_ADMIN", marketId }] : []] },
      select: { id: true }
    });
    ownerIds = [...new Set(users.map((u) => u.id))];
    label = `tenant ${tenantIdRaw} (${tenant.name ?? "?"})`;
  } else if (userIdRaw) {
    const user = await prisma2.user.findUnique({ where: { id: userIdRaw }, select: { id: true } });
    if (!user) {
      res.status(404).json({ error: "User not found", userId: userIdRaw });
      return;
    }
    ownerIds = [userIdRaw];
    label = `user ${userIdRaw}`;
  } else {
    res.status(400).json({
      error: "userId or tenantId required in body",
      example: '{"userId":"bb20b202-8060-48e6-bb9f-dab5f7de84a1"} or {"tenantId":"<tenant-uuid>"}'
    });
    return;
  }
  const tokensFromTable = await prisma2.userFCMToken.findMany({
    where: { userId: { in: ownerIds } },
    select: { token: true }
  });
  const legacyUsers = await prisma2.user.findMany({
    where: { id: { in: ownerIds }, fcmToken: { not: null } },
    select: { fcmToken: true }
  });
  const legacyTokens = legacyUsers.map((u) => u.fcmToken).filter(Boolean) ?? [];
  const allTokens = [.../* @__PURE__ */ new Set([...tokensFromTable.map((r) => r.token), ...legacyTokens])];
  console.log("[FCM] Test send for", label, "ownerIds:", ownerIds.length, "tokens:", allTokens.length);
  if (allTokens.length === 0) {
    console.warn("[FCM] No FCM tokens for", label);
    res.json({ ok: false, error: "No FCM tokens for this " + (tenantIdRaw ? "tenant" : "user"), ownerIds, tokens: 0 });
    return;
  }
  const results = [];
  for (const token of allTokens) {
    const result = await sendFCMToToken(token, {
      title: "\u0627\u062E\u062A\u0628\u0627\u0631 \u062A\u0646\u0628\u064A\u0647 \u{1F514}",
      body: "Test FCM from mock-api (internal/test-fcm)",
      data: { type: "test" }
    });
    results.push({ token: token.slice(0, 24) + "...", success: result.success, error: result.error });
    if (result.success) console.log("[FCM] Test sent successfully to", token.slice(0, 20) + "...");
    else console.error("[FCM] Test send failed:", result.error, "token:", token.slice(0, 20) + "...");
  }
  res.json({ ok: true, label, ownerIds, sent: results.filter((r) => r.success).length, results });
}
app2.post("/internal/test-fcm", wrapAsync(handleTestFcm));
app2.post("/orders/test-fcm", wrapAsync(handleTestFcm));
app2.use(async (req, res, next) => {
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
app2.use((req, res, next) => {
  if (req.path.startsWith("/uploads")) return next();
  if (req.method === "POST" && (req.path === "/internal/test-fcm" || req.path === "/orders/test-fcm")) return next();
  if (isPublicRoute(req.method, req.path)) return next();
  if (req.path.startsWith("/customer/") && !req.path.startsWith("/customer/auth/")) {
    if (!req.customer) return res.status(401).json({ error: "Unauthorized" });
    return next();
  }
  if (req.user) return next();
  if (req.customer) return next();
  if (req.method === "POST" && (req.path === "/upload" || req.path === "/upload/banner")) {
    const hasAuth = !!req.get("Authorization");
    console.log("[Auth] 401 on POST", req.path, "- token", hasAuth ? "present but invalid or user not found" : "MISSING");
  }
  return res.status(401).json({ error: "Unauthorized" });
});
app2.post("/auth/login", async (req, res) => {
  const body = req.body;
  const users = await repos.users.findAll();
  let user;
  if (body.phone != null && body.code != null) {
    const phone = String(body.phone).replace(/\D/g, "");
    const code = String(body.code).trim();
    if (phone === "999" && code === "1234") {
      user = users.find((u) => isPlatformAdmin(u.role) && u.email?.toLowerCase() === "root@nmd.com");
      if (!user) user = users.find((u) => isPlatformAdmin(u.role));
    }
  }
  if (!user && body.email != null && body.password != null) {
    const email = String(body.email).trim();
    const password = body.password;
    if (!email || !password) return res.status(400).json({ error: "email and password required" });
    user = users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (!user || user.password !== password) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
  }
  if (!user) {
    if (body.phone != null && body.code != null) return res.status(401).json({ error: "Invalid OTP backdoor (use phone=999, code=1234 for Root)" });
    return res.status(400).json({ error: "email and password required" });
  }
  const token = jwt.sign(
    { sub: user.id, role: user.role, tenantId: user.tenantId, marketId: user.marketId },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
  res.json({ accessToken: token });
});
app2.get("/auth/login", (_req, res) => {
  res.set("Allow", "POST");
  res.status(405).json({ error: "Method Not Allowed. Use POST with { email, password } or { phone, code } (backdoor: 999 / 1234 for Root)." });
});
app2.post("/app/auth/login", wrapAsync(async (req, res) => {
  const body = req.body;
  const email = body.email != null ? String(body.email).trim() : "";
  const password = body.password;
  if (!email || !password) return res.status(400).json({ error: "email and password required" });
  const users = await repos.users.findAll();
  const user = users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!user || user.password !== password) return res.status(401).json({ error: "Invalid email or password" });
  const token = jwt.sign(
    { sub: user.id, role: user.role, tenantId: user.tenantId, marketId: user.marketId },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
  res.json({ accessToken: token });
}));
app2.get("/auth/me", wrapAsync(async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  const u = req.user;
  console.log("[Auth] GET /auth/me userId=", u.id, "role=", u.role, "tenantId=", u.tenantId ?? "(none)");
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
var FCM_TOKENS_PER_USER_LIMIT = 10;
app2.put("/users/me/fcm-token", wrapAsync(async (req, res) => {
  const raw = req.body?.fcmToken;
  const hasAuth = !!req.user;
  const authHeaderPresent = !!req.get("Authorization");
  console.log("[FCM] PUT /users/me/fcm-token received", "body.fcmToken:", raw != null ? typeof raw === "string" ? raw.slice(0, 32) + "..." : "(not a string)" : "(missing)", "Authorization header:", authHeaderPresent ? "present" : "MISSING", "req.user:", hasAuth ? req.user.id : "none");
  if (!req.user) {
    console.warn("[FCM] PUT /users/me/fcm-token 401 Unauthorized (missing or invalid Bearer token)");
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (raw != null && typeof raw !== "string") return res.status(400).json({ error: "fcmToken must be a string" });
  const token = raw && raw.trim() ? raw.trim() : null;
  const userId = req.user.id;
  console.log("[FCM] Saving token for user ID:", userId);
  console.log("[FCM] Token [" + (token ? token.slice(0, 24) + "..." : "clear") + "] received for User [" + userId + "]");
  const userWithTenant = await prisma2.user.findUnique({
    where: { id: userId },
    select: { tenantId: true }
  });
  const tenantId = userWithTenant?.tenantId ?? null;
  const tenantName = tenantId != null ? (await prisma2.tenant.findUnique({ where: { id: tenantId }, select: { name: true } }))?.name ?? tenantId : null;
  console.log("--- SAVING FCM TOKEN FOR USER:", userId, "tenantId:", tenantId, "tenantName:", tenantName ?? "\u2014", token ? `token: ${token.slice(0, 24)}...` : "(clear)");
  if (token) {
    await prisma2.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { fcmToken: token } });
      const existing = await tx.userFCMToken.findUnique({ where: { token } });
      if (existing) {
        if (existing.userId !== userId) await tx.userFCMToken.update({ where: { token }, data: { userId } });
      } else {
        await tx.userFCMToken.create({ data: { userId, token } });
      }
      const count = await tx.userFCMToken.count({ where: { userId } });
      if (count > FCM_TOKENS_PER_USER_LIMIT) {
        const oldest = await tx.userFCMToken.findMany({
          where: { userId },
          orderBy: { createdAt: "asc" },
          take: count - FCM_TOKENS_PER_USER_LIMIT
        });
        await tx.userFCMToken.deleteMany({ where: { id: { in: oldest.map((r) => r.id) } } });
      }
    });
    console.log("[FCM] Saved token to both User.fcmToken and UserFCMToken for user ID:", userId);
  } else {
    await prisma2.user.update({ where: { id: userId }, data: { fcmToken: null } });
    await prisma2.userFCMToken.deleteMany({ where: { userId } });
  }
  res.json({ ok: true });
}));
app2.get("/customer/auth/check-phone", async (req, res) => {
  const phone = req.query.phone;
  if (!phone || typeof phone !== "string") return res.status(400).json({ error: "phone required" });
  const key = normalizePhoneForMatch(phone);
  if (!key || key.length < 9) return res.status(400).json({ error: "Invalid phone" });
  const customers = await repos.customers.findAll();
  const exists = customers.some((c) => normalizePhoneForMatch(c.phone) === key);
  res.json({ exists });
});
app2.get("/customer/auth/otp-gateway-health", async (_req, res) => {
  const gatewayUrl = (process.env.WHATSAPP_GATEWAY_URL || "").replace(/\/$/, "");
  if (!gatewayUrl) {
    return res.json({ gatewayConfigured: false, gatewayReachable: false, ready: false });
  }
  try {
    const healthRes = await fetch(`${gatewayUrl}/health`, { method: "GET" });
    const data = await healthRes.json().catch(() => ({}));
    res.json({
      gatewayConfigured: true,
      gatewayReachable: healthRes.ok,
      ready: healthRes.ok && data.ready === true
    });
  } catch (e) {
    res.json({
      gatewayConfigured: true,
      gatewayReachable: false,
      ready: false,
      error: e instanceof Error ? e.message : "Request failed"
    });
  }
});
async function sendOtpViaGateway(gatewayUrl, waApiKey, phone, code, retries = 1) {
  const url = `${gatewayUrl}/send-otp`;
  const gatewayHost = gatewayUrl.replace(/^https?:\/\//, "").split("/")[0] || "gateway";
  const opts = {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": waApiKey },
    body: JSON.stringify({ phone, code })
  };
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const sendRes = await fetch(url, opts);
      if (sendRes.ok) {
        return { sent: true };
      }
      const errText = await sendRes.text();
      console.warn(
        `[customer/auth/start] WhatsApp send-otp failed (attempt ${attempt + 1}/${retries + 1}):`,
        sendRes.status,
        gatewayHost,
        errText.slice(0, 200)
      );
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 2e3));
        continue;
      }
      console.warn(
        "[customer/auth/start] If OTP is delayed, check WhatsApp gateway GET /health and third-party provider status page for outages."
      );
      return { sent: false, status: sendRes.status, error: errText.slice(0, 100) };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(
        `[customer/auth/start] WhatsApp send-otp error (attempt ${attempt + 1}/${retries + 1}):`,
        gatewayHost,
        msg
      );
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 2e3));
        continue;
      }
      console.warn(
        "[customer/auth/start] If OTP is delayed, check WhatsApp gateway GET /health and third-party provider status page for outages."
      );
      return { sent: false, error: msg };
    }
  }
  return { sent: false };
}
app2.post("/customer/auth/start", async (req, res) => {
  const { phone } = req.body;
  if (!phone || typeof phone !== "string") {
    console.log("[customer/auth/start] 400: phone required");
    return res.status(400).json({ error: "phone required" });
  }
  const normalized = normalizePhoneForMatch(phone);
  if (!normalized || normalized.length < 9) {
    console.log("[customer/auth/start] 400: invalid phone", phone);
    return res.status(400).json({ error: "Invalid phone format" });
  }
  const result = createOtp(phone);
  if (!result.ok) {
    console.log("[customer/auth/start] 429:", result.error, result.code);
    return res.status(429).json({ error: result.error, code: result.code });
  }
  const gatewayUrl = (process.env.WHATSAPP_GATEWAY_URL || "").replace(/\/$/, "");
  const waApiKey = process.env.WA_API_KEY;
  let whatsAppSent = false;
  if (gatewayUrl && waApiKey && result.codeForSending) {
    const sendResult = await sendOtpViaGateway(gatewayUrl, waApiKey, normalized, result.codeForSending, 1);
    whatsAppSent = sendResult.sent;
  }
  if (result.devCode) console.log("[customer/auth/start] 200 \u2192 OTP sent (see [OTP] log above or client toast)");
  res.json({ ok: true, whatsAppSent, ...result.devCode && { devCode: result.devCode } });
});
function normalizePhoneForMatch(phone) {
  return String(phone ?? "").replace(/\D/g, "").slice(-10);
}
app2.post("/customer/auth/verify", async (req, res) => {
  const { phone, code, name } = req.body;
  if (!phone || !code) return res.status(400).json({ error: "phone and code required" });
  const result = verifyOtp(phone, code);
  if (!result.ok) {
    const status = result.code === "OTP_LOCKED" || result.code === "RATE_LIMITED" ? 429 : 401;
    return res.status(status).json({ error: result.error, code: result.code });
  }
  const key = normalizePhoneForMatch(phone);
  const customers = await repos.customers.findAll();
  const existing = customers.find((c) => normalizePhoneForMatch(c.phone) === key);
  const isNewUser = !existing;
  let customer = existing;
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
  res.json({
    token,
    customer: { id: customer.id, phone: customer.phone, name: customer.name },
    isNewUser
  });
});
app2.get("/customer/me", async (req, res) => {
  const customer = req.customer;
  if (!customer) return res.status(401).json({ error: "Unauthorized" });
  const full = (await repos.customers.findAll()).find((c) => c.id === customer.id);
  res.json({ id: customer.id, phone: customer.phone, name: full?.name ?? customer.name });
});
app2.patch("/customer/profile", async (req, res) => {
  const customer = req.customer;
  if (!customer) return res.status(401).json({ error: "Unauthorized" });
  const { name } = req.body;
  const nameTrimmed = typeof name === "string" ? name.trim() : void 0;
  const customers = await repos.customers.findAll();
  const idx = customers.findIndex((c) => c.id === customer.id);
  if (idx === -1) return res.status(404).json({ error: "Customer not found" });
  const updated = { ...customers[idx], name: nameTrimmed ?? customers[idx].name };
  customers[idx] = updated;
  await repos.customers.setAll(customers);
  res.json({ customer: { id: updated.id, phone: updated.phone, name: updated.name } });
});
app2.put("/customer/me/fcm-token", wrapAsync(async (req, res) => {
  const customer = req.customer;
  if (!customer) return res.status(401).json({ error: "Unauthorized" });
  const raw = req.body?.fcmToken;
  const token = raw != null && typeof raw === "string" ? raw.trim() : null;
  const customers = await repos.customers.findAll();
  const idx = customers.findIndex((c) => c.id === customer.id);
  if (idx === -1) return res.status(404).json({ error: "Customer not found" });
  const updated = { ...customers[idx], fcmToken: token || null };
  customers[idx] = updated;
  await repos.customers.setAll(customers);
  console.log("[FCM] Customer fcm-token saved for customer ID:", customer.id);
  res.status(204).send();
}));
app2.post("/customer/save-fcm-token", wrapAsync(async (req, res) => {
  const customerFromAuth = req.customer;
  const body = req.body;
  const customerId = customerFromAuth?.id ?? (typeof body.customerId === "string" ? body.customerId.trim() : void 0);
  if (!customerId) return res.status(401).json({ error: "Unauthorized or provide customerId in body for testing" });
  const raw = body.fcmToken;
  const token = raw != null && typeof raw === "string" ? raw.trim() : null;
  if (!token) return res.status(400).json({ error: "fcmToken required" });
  const isDb = (process.env.STORAGE_DRIVER ?? "").toLowerCase() === "db";
  if (isDb) {
    await prisma2.customerFCMToken.deleteMany({ where: { customerId } });
    await prisma2.customerFCMToken.upsert({
      where: { token },
      create: { customerId, token },
      update: { customerId }
    });
    console.log("[FCM] Customer FCM token saved (DB) for customer ID:", customerId);
  } else {
    const customers = await repos.customers.findAll();
    const idx = customers.findIndex((c) => c.id === customerId);
    if (idx === -1) return res.status(404).json({ error: "Customer not found" });
    const updated = { ...customers[idx], fcmToken: token };
    customers[idx] = updated;
    await repos.customers.setAll(customers);
    console.log("[FCM] Customer fcm-token saved (JSON) for customer ID:", customerId);
  }
  res.status(204).send();
}));
app2.get("/customer/push-public-key", (_req, res) => {
  res.json({ publicKey: getVapidPublicKey() });
});
app2.get("/merchant/push-public-key", (_req, res) => {
  res.json({ publicKey: getVapidPublicKey() });
});
app2.post("/merchant/push-subscription", async (req, res) => {
  const u = req.user;
  if (!u) return res.status(401).json({ error: "Unauthorized" });
  const body = req.body;
  const sub = body?.subscription;
  if (!sub || !sub.endpoint) return res.status(400).json({ error: "subscription with endpoint required" });
  let tenantId = body.tenantId ?? u.tenantId;
  if (!tenantId) return res.status(400).json({ error: "tenantId required (or login as tenant admin)" });
  if (u.role === "TENANT_ADMIN" && u.tenantId !== tenantId) return res.status(403).json({ error: "Forbidden: can only subscribe for your store" });
  if (u.role === "MARKET_ADMIN" && u.marketId) {
    const tenants = await repos.tenants.findAll();
    const tenant = tenants.find((t) => t.id === tenantId && t.marketId === u.marketId);
    if (!tenant) return res.status(403).json({ error: "Forbidden: tenant not in your market" });
  }
  const subscription = {
    endpoint: sub.endpoint,
    keys: sub.keys ? { p256dh: sub.keys.p256dh, auth: sub.keys.auth } : void 0,
    expirationTime: sub.expirationTime ?? null
  };
  saveAdminSubscription(tenantId, subscription);
  res.json({ ok: true });
});
app2.post("/merchant/push-test", async (req, res) => {
  const u = req.user;
  if (!u) return res.status(401).json({ error: "Unauthorized" });
  let tenantId = u.tenantId;
  if (!tenantId) return res.status(400).json({ error: "No tenant for this user; open a store first" });
  const subs = getSubscriptionsByTenant(tenantId);
  if (subs.length === 0) return res.status(404).json({ error: "No push subscriptions for this store; allow notifications and reopen the app" });
  const payload = { title: "\u0637\u0644\u0628 \u062C\u062F\u064A\u062F \u0648\u0635\u0644! \u{1F514}", body: "\u0644\u062F\u064A\u0643 \u0637\u0644\u0628 \u062C\u062F\u064A\u062F \u064A\u0646\u062A\u0638\u0631 \u0627\u0644\u0642\u0628\u0648\u0644 \u0641\u064A \u0645\u062A\u062C\u0631 \u062F\u0628\u0648\u0631\u064A\u0629" };
  try {
    await Promise.all(subs.map((sub) => sendPushNotification(sub, payload)));
    res.json({ ok: true, sent: subs.length });
  } catch (e) {
    console.error("[Push] Test send failed:", e);
    res.status(500).json({ error: e instanceof Error ? e.message : "Push send failed" });
  }
});
app2.post("/customer/push-subscription", async (req, res) => {
  const customer = req.customer;
  const hasAuth = !!req.headers.authorization;
  if (!customer) {
    console.log("[Push] POST /customer/push-subscription 401 \u2013 no customer (auth header present:", hasAuth, ")");
    return res.status(401).json({ error: "Unauthorized" });
  }
  const body = req.body;
  const sub = body?.subscription;
  if (!sub || !sub.endpoint) {
    console.log("[Push] POST /customer/push-subscription 400 \u2013 subscription with endpoint required");
    return res.status(400).json({ error: "subscription with endpoint required" });
  }
  const phoneFromBody = typeof body.phone === "string" ? body.phone.trim() : "";
  if (!phoneFromBody) {
    console.log("[Push] POST /customer/push-subscription 400 \u2013 phone required in body");
    return res.status(400).json({ error: "phone required in body for customer push subscription" });
  }
  const normalizedBody = phoneFromBody.replace(/\D/g, "");
  const normalizedCustomer = customer.phone.replace(/\D/g, "");
  if (normalizedBody !== normalizedCustomer) {
    console.log("[Push] POST /customer/push-subscription 403 \u2013 phone mismatch body vs customer");
    return res.status(403).json({ error: "Phone in body does not match authenticated customer" });
  }
  const subscription = {
    endpoint: sub.endpoint,
    keys: sub.keys ? { p256dh: sub.keys.p256dh, auth: sub.keys.auth } : void 0,
    expirationTime: sub.expirationTime ?? null
  };
  try {
    saveSubscription(customer.phone, subscription);
    console.log("[Push] Customer subscription saved under phone key ***" + customer.phone.replace(/\D/g, "").slice(-4));
    res.json({ ok: true });
  } catch (err) {
    console.error("[Push] Customer subscription save threw:", err);
    res.status(500).json({ error: "Failed to save subscription" });
  }
});
app2.get("/customer/activity", wrapAsync(async (req, res) => {
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
app2.get("/contest/active", wrapAsync(async (_req, res) => {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const contest = await prisma2.contest.findFirst({
    where: {
      isActive: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]
    },
    orderBy: { createdAt: "desc" }
  });
  if (!contest) return res.json(null);
  res.json({
    id: contest.id,
    title: contest.title,
    description: contest.description,
    type: contest.type,
    options: contest.options ? JSON.parse(contest.options) : [],
    rewardCode: contest.rewardCode,
    bannerImageUrl: contest.bannerImageUrl ?? void 0,
    teamAName: contest.teamAName ?? void 0,
    teamBName: contest.teamBName ?? void 0,
    isPrediction: contest.isPrediction ?? false,
    finalScoreA: contest.finalScoreA ?? void 0,
    finalScoreB: contest.finalScoreB ?? void 0,
    expiresAt: contest.expiresAt
  });
}));
app2.post("/contest/participate", wrapAsync(async (req, res) => {
  const customer = req.customer;
  if (!customer) return res.status(401).json({ error: "Unauthorized" });
  const body = req.body;
  const contestId = String(body?.contestId ?? "").trim();
  const contest = await prisma2.contest.findUnique({ where: { id: contestId } });
  if (!contest || !contest.isActive) return res.status(404).json({ error: "Contest not found or inactive" });
  const now = (/* @__PURE__ */ new Date()).toISOString();
  if (contest.expiresAt && contest.expiresAt < now) return res.status(400).json({ error: "Contest has expired" });
  const existing = await prisma2.contestParticipation.findUnique({
    where: { customerId_contestId: { customerId: customer.id, contestId } }
  });
  if (existing) return res.status(400).json({ error: "Already participated", participation: { id: existing.id, isWinner: existing.isWinner } });
  let userAnswer;
  let scoreA = null;
  let scoreB = null;
  if (contest.isPrediction) {
    const a = typeof body?.scoreA === "number" ? body.scoreA : parseInt(String(body?.scoreA ?? ""), 10);
    const b = typeof body?.scoreB === "number" ? body.scoreB : parseInt(String(body?.scoreB ?? ""), 10);
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) return res.status(400).json({ error: "scoreA and scoreB required (non-negative integers) for match prediction" });
    scoreA = a;
    scoreB = b;
    userAnswer = `${scoreA}-${scoreB}`;
  } else {
    userAnswer = String(body?.userAnswer ?? "").trim();
    if (!userAnswer) return res.status(400).json({ error: "contestId and userAnswer required" });
  }
  const correctAnswer = contest.correctAnswer?.trim();
  const finalA = contest.finalScoreA;
  const finalB = contest.finalScoreB;
  const isWinner = contest.type === "QUESTION" ? !!correctAnswer && userAnswer === correctAnswer : contest.isPrediction && finalA != null && finalB != null && scoreA === finalA && scoreB === finalB;
  const participation = await prisma2.contestParticipation.create({
    data: {
      id: `cp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      customerId: customer.id,
      contestId,
      userAnswer,
      scoreA: scoreA ?? void 0,
      scoreB: scoreB ?? void 0,
      isWinner,
      createdAt: now
    }
  });
  res.status(201).json({
    id: participation.id,
    isWinner,
    rewardCode: isWinner ? contest.rewardCode : void 0
  });
}));
app2.get("/contest/me", wrapAsync(async (req, res) => {
  const customer = req.customer;
  if (!customer) return res.status(401).json({ error: "Unauthorized" });
  const list = await prisma2.contestParticipation.findMany({
    where: { customerId: customer.id },
    include: { contest: true },
    orderBy: { createdAt: "desc" }
  });
  res.json(list.map((p) => ({ contestId: p.contestId, userAnswer: p.userAnswer, isWinner: p.isWinner, rewardCode: p.contest.rewardCode ?? void 0, createdAt: p.createdAt })));
}));
function requireContestAdmin(req, res) {
  const user = req.user;
  if (!user || !isPlatformAdmin(user.role)) {
    res.status(403).json({ error: "Forbidden" });
    return false;
  }
  return true;
}
function contestToJson(c) {
  return {
    id: c.id,
    title: c.title,
    description: c.description,
    type: c.type,
    options: c.options ? JSON.parse(c.options) : [],
    correctAnswer: c.correctAnswer,
    isActive: c.isActive,
    rewardCode: c.rewardCode,
    bannerImageUrl: c.bannerImageUrl ?? void 0,
    teamAName: c.teamAName ?? void 0,
    teamBName: c.teamBName ?? void 0,
    isPrediction: c.isPrediction ?? false,
    finalScoreA: c.finalScoreA ?? void 0,
    finalScoreB: c.finalScoreB ?? void 0,
    expiresAt: c.expiresAt,
    createdAt: c.createdAt
  };
}
app2.get("/contests", wrapAsync(async (req, res) => {
  if (!requireContestAdmin(req, res)) return;
  const list = await prisma2.contest.findMany({ orderBy: { createdAt: "desc" } });
  res.json(list.map(contestToJson));
}));
app2.post("/contests", wrapAsync(async (req, res) => {
  if (!requireContestAdmin(req, res)) return;
  const body = req.body;
  const title = String(body?.title ?? "").trim();
  if (!title) return res.status(400).json({ error: "title required" });
  const type = body.type === "PREDICTION" ? "PREDICTION" : "QUESTION";
  const isPrediction = !!body?.isPrediction;
  const id = `contest-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  await prisma2.contest.create({
    data: {
      id,
      title,
      description: body.description?.trim() ?? null,
      type,
      options: !isPrediction && body.options && body.options.length > 0 ? JSON.stringify(body.options) : null,
      correctAnswer: body.correctAnswer?.trim() ?? null,
      isActive: true,
      rewardCode: body.rewardCode?.trim() ?? null,
      bannerImageUrl: body.bannerImageUrl?.trim() || null,
      teamAName: body.teamAName?.trim() || null,
      teamBName: body.teamBName?.trim() || null,
      isPrediction,
      expiresAt: body.expiresAt?.trim() || null,
      createdAt: now
    }
  });
  const c = await prisma2.contest.findUnique({ where: { id } });
  res.status(201).json(c ? contestToJson(c) : { id });
}));
app2.put("/contests/:id", wrapAsync(async (req, res) => {
  if (!requireContestAdmin(req, res)) return;
  const { id } = req.params;
  const body = req.body;
  const existing = await prisma2.contest.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "Contest not found" });
  await prisma2.contest.update({
    where: { id },
    data: {
      ...body.title !== void 0 && { title: body.title.trim() },
      ...body.description !== void 0 && { description: body.description?.trim() ?? null },
      ...body.options !== void 0 && { options: body.options?.length ? JSON.stringify(body.options) : null },
      ...body.correctAnswer !== void 0 && { correctAnswer: body.correctAnswer?.trim() ?? null },
      ...body.isActive !== void 0 && { isActive: !!body.isActive },
      ...body.rewardCode !== void 0 && { rewardCode: body.rewardCode?.trim() ?? null },
      ...body.bannerImageUrl !== void 0 && { bannerImageUrl: body.bannerImageUrl?.trim() || null },
      ...body.expiresAt !== void 0 && { expiresAt: body.expiresAt?.trim() || null },
      ...body.isPrediction !== void 0 && { isPrediction: !!body.isPrediction },
      ...body.teamAName !== void 0 && { teamAName: body.teamAName?.trim() || null },
      ...body.teamBName !== void 0 && { teamBName: body.teamBName?.trim() || null },
      ...body.finalScoreA !== void 0 && { finalScoreA: Number.isInteger(body.finalScoreA) ? body.finalScoreA : null },
      ...body.finalScoreB !== void 0 && { finalScoreB: Number.isInteger(body.finalScoreB) ? body.finalScoreB : null }
    }
  });
  const c = await prisma2.contest.findUnique({ where: { id } });
  res.json(c ? contestToJson(c) : { id });
}));
app2.delete("/contests/:id", wrapAsync(async (req, res) => {
  if (!requireContestAdmin(req, res)) return;
  const { id } = req.params;
  await prisma2.contest.delete({ where: { id } }).catch((e) => {
    if (e.code === "P2025") return null;
    throw e;
  });
  res.status(204).end();
}));
app2.post("/contests/:id/result", wrapAsync(async (req, res) => {
  if (!requireContestAdmin(req, res)) return;
  const { id } = req.params;
  const body = req.body;
  const contest = await prisma2.contest.findUnique({ where: { id } });
  if (!contest) return res.status(404).json({ error: "Contest not found" });
  if (contest.type !== "PREDICTION") return res.status(400).json({ error: "Only PREDICTION contests can have result set" });
  if (contest.isPrediction) {
    const finalScoreA = typeof body?.finalScoreA === "number" ? body.finalScoreA : parseInt(String(body?.finalScoreA ?? ""), 10);
    const finalScoreB = typeof body?.finalScoreB === "number" ? body.finalScoreB : parseInt(String(body?.finalScoreB ?? ""), 10);
    if (!Number.isInteger(finalScoreA) || !Number.isInteger(finalScoreB) || finalScoreA < 0 || finalScoreB < 0) return res.status(400).json({ error: "finalScoreA and finalScoreB required (non-negative integers) for match prediction" });
    const correctAnswer2 = `${finalScoreA}-${finalScoreB}`;
    await prisma2.contest.update({ where: { id }, data: { correctAnswer: correctAnswer2, finalScoreA, finalScoreB } });
    const updated2 = await prisma2.contestParticipation.updateMany({
      where: { contestId: id, scoreA: finalScoreA, scoreB: finalScoreB },
      data: { isWinner: true }
    });
    return res.json({ correctAnswer: correctAnswer2, finalScoreA, finalScoreB, winnersCount: updated2.count });
  }
  const correctAnswer = String(body?.correctAnswer ?? "").trim();
  if (!correctAnswer) return res.status(400).json({ error: "correctAnswer required" });
  await prisma2.contest.update({ where: { id }, data: { correctAnswer } });
  const updated = await prisma2.contestParticipation.updateMany({
    where: { contestId: id, userAnswer: correctAnswer },
    data: { isWinner: true }
  });
  res.json({ correctAnswer, winnersCount: updated.count });
}));
app2.get("/contests/:id/participations", wrapAsync(async (req, res) => {
  if (!requireContestAdmin(req, res)) return;
  const { id } = req.params;
  const contest = await prisma2.contest.findUnique({ where: { id } });
  if (!contest) return res.status(404).json({ error: "Contest not found" });
  const list = await prisma2.contestParticipation.findMany({ where: { contestId: id }, orderBy: { createdAt: "desc" } });
  const customers = await repos.customers.findAll();
  const rows = list.map((p) => {
    const c = customers.find((x) => x.id === p.customerId);
    return { id: p.id, customerId: p.customerId, customerPhone: c?.phone, customerName: c?.name, userAnswer: p.userAnswer, scoreA: p.scoreA ?? void 0, scoreB: p.scoreB ?? void 0, isWinner: p.isWinner, createdAt: p.createdAt };
  });
  res.json({
    contest: { id: contest.id, title: contest.title, type: contest.type, correctAnswer: contest.correctAnswer, isPrediction: contest.isPrediction ?? false, finalScoreA: contest.finalScoreA ?? void 0, finalScoreB: contest.finalScoreB ?? void 0 },
    participations: rows
  });
}));
function normalizePhoneForCoupon(phone) {
  return String(phone ?? "").replace(/\D/g, "").trim();
}
app2.get("/coupons/validate", wrapAsync(async (req, res) => {
  const code = req.query.code?.trim()?.toUpperCase();
  const tenantId = req.query.tenantId?.trim() || void 0;
  const cartStoreIds = req.query.cartStoreIds?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
  const subtotal = Number(req.query.subtotal) || 0;
  const customerPhone = normalizePhoneForCoupon(req.query.customerPhone);
  if (!code) return res.status(400).json({ valid: false, error: "code required" });
  const coupon = await prisma2.coupon.findUnique({ where: { code } });
  if (!coupon) return res.json({ valid: false, error: "\u0627\u0644\u0643\u0648\u062F \u063A\u064A\u0631 \u0635\u062D\u064A\u062D" });
  if (coupon.usedAt) return res.json({ valid: false, error: "\u0627\u0644\u0643\u0648\u062F \u0645\u0633\u062A\u062E\u062F\u0645 \u0645\u0633\u0628\u0642\u0627\u064B" });
  if (coupon.expiresAt && coupon.expiresAt < (/* @__PURE__ */ new Date()).toISOString()) return res.json({ valid: false, error: "\u0627\u0646\u062A\u0647\u062A \u0635\u0644\u0627\u062D\u064A\u0629 \u0627\u0644\u0643\u0648\u062F" });
  if (coupon.tenantId && tenantId && coupon.tenantId !== tenantId) return res.json({ valid: false, error: "\u0627\u0644\u0643\u0648\u062F \u063A\u064A\u0631 \u0635\u0627\u0644\u062D \u0644\u0647\u0630\u0627 \u0627\u0644\u0645\u062A\u062C\u0631" });
  if (coupon.storeId) {
    const allStoreIds = cartStoreIds.length > 0 ? cartStoreIds : tenantId ? [tenantId] : [];
    if (allStoreIds.length > 0 && !allStoreIds.includes(coupon.storeId)) {
      const store = await prisma2.tenant.findUnique({ where: { id: coupon.storeId }, select: { name: true } }).catch(() => null);
      const storeName = store?.name ?? coupon.storeId;
      return res.json({ valid: false, error: `\u0647\u0630\u0627 \u0627\u0644\u0643\u0648\u062F \u0635\u0627\u0644\u062D \u0641\u0642\u0637 \u0644\u0645\u062A\u062C\u0631 ${storeName}` });
    }
  }
  if (coupon.oneTimeUse && coupon.winnerPhone) {
    const normalized = normalizePhoneForCoupon(coupon.winnerPhone);
    if (normalized && customerPhone && normalized !== customerPhone) return res.json({ valid: false, error: "\u0627\u0644\u0643\u0648\u062F \u063A\u064A\u0631 \u0635\u0627\u0644\u062D \u0644\u0647\u0630\u0627 \u0627\u0644\u0631\u0642\u0645" });
  }
  let discountAmount = 0;
  if (coupon.type === "FIXED") discountAmount = Math.min(Number(coupon.value), subtotal);
  else if (coupon.type === "PERCENT") discountAmount = Math.min(subtotal * Number(coupon.value) / 100, subtotal);
  if (discountAmount <= 0) return res.json({ valid: false, error: "\u0627\u0644\u062D\u062F \u0627\u0644\u0623\u062F\u0646\u0649 \u0644\u0644\u0637\u0644\u0628 \u063A\u064A\u0631 \u0645\u062D\u0642\u0642" });
  res.json({
    valid: true,
    coupon: { id: coupon.id, code: coupon.code, type: coupon.type, value: coupon.value, discountAmount, storeId: coupon.storeId ?? void 0 }
  });
}));
app2.get("/customer/rewards", wrapAsync(async (req, res) => {
  const customer = req.customer;
  if (!customer) return res.status(401).json({ error: "Unauthorized" });
  const phoneNorm = normalizePhoneForCoupon(customer.phone);
  if (!phoneNorm) return res.json([]);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const list = await prisma2.coupon.findMany({
    where: {
      winnerPhone: { not: null },
      usedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]
    },
    orderBy: { createdAt: "desc" }
  });
  const forCustomer = list.filter((c) => normalizePhoneForCoupon(c.winnerPhone ?? "") === phoneNorm);
  res.json(forCustomer.map((c) => ({ id: c.id, code: c.code, type: c.type, value: c.value, expiresAt: c.expiresAt ?? void 0 })));
}));
app2.post("/coupons", wrapAsync(async (req, res) => {
  const user = req.user;
  if (!user || !isPlatformAdmin(user.role)) return res.status(403).json({ error: "Forbidden: platform admin only" });
  const body = req.body;
  const code = String(body?.code ?? "").trim().toUpperCase();
  if (!code) return res.status(400).json({ error: "code required" });
  const type = body?.type === "PERCENT" ? "PERCENT" : "FIXED";
  const value = Number(body?.value);
  if (Number.isNaN(value) || value <= 0) return res.status(400).json({ error: "value must be a positive number" });
  if (type === "PERCENT" && value > 100) return res.status(400).json({ error: "percent value must be 1-100" });
  const existing = await prisma2.coupon.findUnique({ where: { code } });
  if (existing) return res.status(409).json({ error: "Coupon code already exists" });
  const id = `coupon-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  await prisma2.coupon.create({
    data: {
      id,
      code,
      type,
      value,
      tenantId: body?.tenantId?.trim() || null,
      storeId: body?.storeId?.trim() || null,
      oneTimeUse: !!body?.oneTimeUse,
      winnerPhone: body?.winnerPhone?.trim() || null,
      createdAt: now,
      expiresAt: body?.expiresAt?.trim() || null
    }
  });
  const created = await prisma2.coupon.findUnique({ where: { id } });
  const winnerPhone = body?.winnerPhone?.trim();
  if (winnerPhone) {
    sendWhatsAppNotification(winnerPhone, code);
  }
  res.status(201).json(created);
}));
app2.get("/coupons", wrapAsync(async (req, res) => {
  const user = req.user;
  if (!user || !isPlatformAdmin(user.role)) return res.status(403).json({ error: "Forbidden: platform admin only" });
  const list = await prisma2.coupon.findMany({ orderBy: { createdAt: "desc" } });
  res.json(list);
}));
function requireCourier(req, res) {
  const user = req.user;
  if (!user || user.role !== "COURIER" || !user.courierId || !user.marketId) {
    res.status(403).json({ error: "Courier access required" });
    return null;
  }
  return { courierId: user.courierId, marketId: user.marketId };
}
app2.get("/courier/me", async (req, res) => {
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
function enrichCourierOrders(orders, tenants) {
  return orders.map((o) => {
    const t = o.tenantId ? tenants.find((x) => x.id === o.tenantId) : void 0;
    const tenant = t ? { name: t.name ?? "", phone: t.whatsappPhone, address: t.addressLine, location: t.location, categoryId: t.categoryId } : { name: "", phone: void 0, address: void 0, location: void 0, categoryId: void 0 };
    const deliveryZoneName = o.delivery?.zoneName ?? "";
    const customer = { name: o.customerName ?? "", phone: o.customerPhone ?? "", deliveryAddress: o.deliveryAddress ?? "", deliveryLocation: o.deliveryLocation, deliveryZoneName };
    const currency = o.currency ?? "ILS";
    const pay = o.payment;
    const orderTotal = pay?.financials?.gross ?? (Number(o.total) || 0);
    const paymentMethod = pay?.method ?? (o.paymentMethod === "CARD" ? "CARD" : "CASH");
    const amountToCollect = paymentMethod === "CASH" ? orderTotal : 0;
    return { ...o, tenant, customer, currency, orderTotal, paymentMethod, amountToCollect, cashChangeFor: o.cashChangeFor, deliveryZoneName };
  });
}
app2.get("/courier/orders", wrapAsync(async (req, res) => {
  const scope = requireCourier(req, res);
  if (!scope) return;
  const orders = (await repos.orders.findAll()).filter((o) => o.fulfillmentType === "DELIVERY" && o.courierId === scope.courierId && o.status !== "CANCELED");
  const tenants = await repos.tenants.findAll();
  res.json(enrichCourierOrders(orders, tenants));
}));
app2.get("/courier/orders/available", wrapAsync(async (req, res) => {
  const scope = requireCourier(req, res);
  if (!scope) return;
  const tenants = await repos.tenants.findAll();
  const allOrders = await repos.orders.findAll();
  const available = allOrders.filter((o) => {
    if (o.fulfillmentType !== "DELIVERY" || o.courierId || o.status === "CANCELED") return false;
    if (o.status !== "PREPARING" && o.status !== "READY") return false;
    const orderMarketId = o.marketId ?? tenants.find((t) => t.id === o.tenantId)?.marketId;
    return orderMarketId === scope.marketId;
  });
  const tenantList = await repos.tenants.findAll();
  res.json(enrichCourierOrders(available, tenantList));
}));
app2.post("/courier/orders/:orderId/accept", wrapAsync(async (req, res) => {
  const scope = requireCourier(req, res);
  if (!scope) return;
  const { orderId } = req.params;
  const tenants = await repos.tenants.findAll();
  const orders = await repos.orders.findAll();
  const idx = orders.findIndex((o) => o.id === orderId);
  if (idx === -1) return res.status(404).json({ error: "Order not found" });
  const order = orders[idx];
  if (order.fulfillmentType !== "DELIVERY") return res.status(400).json({ error: "Order is not a delivery order", code: "BAD_REQUEST" });
  if (order.status !== "PREPARING" && order.status !== "READY") return res.status(400).json({ error: "Order is not available to accept", code: "BAD_REQUEST" });
  const orderMarketId = order.marketId ?? tenants.find((t) => t.id === order.tenantId)?.marketId;
  if (orderMarketId !== scope.marketId) return res.status(403).json({ error: "Order not in your market", code: "CROSS_MARKET_ACCESS" });
  if (order.courierId) {
    return res.status(409).json({
      error: "This order was taken by another courier",
      code: "ORDER_TAKEN",
      details: { orderId, currentCourierId: order.courierId }
    });
  }
  const couriers = await repos.couriers.findAll();
  const courier = couriers.find((c) => c.id === scope.courierId);
  if (!courier || !courier.isActive || !courier.isOnline) return res.status(400).json({ error: "Courier must be active and online", code: "BAD_REQUEST" });
  if (courier.isAvailable === false) {
    const activeOrdersForCourier = orders.filter(
      (o) => o.courierId === scope.courierId && o.status !== "COMPLETED" && o.status !== "CANCELLED"
    );
    if (activeOrdersForCourier.length > 0) {
      return res.status(400).json({ error: "You are busy with another delivery", code: "COURIER_BUSY" });
    }
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const timeline = order.deliveryTimeline ?? {};
  const updated = {
    ...order,
    courierId: scope.courierId,
    deliveryStatus: "ASSIGNED",
    deliveryTimeline: { ...timeline, assignedAt: timeline.assignedAt ?? now }
  };
  orders[idx] = updated;
  await repos.orders.setAll(orders);
  const courierIdx = couriers.findIndex((c) => c.id === scope.courierId);
  if (courierIdx >= 0) {
    couriers[courierIdx] = { ...couriers[courierIdx], isAvailable: false };
    await repos.couriers.setAll(couriers);
  }
  emitCourierAssigned(scope.courierId, updated);
  const tenantList = await repos.tenants.findAll();
  const enriched = enrichCourierOrders([updated], tenantList);
  res.status(200).json(enriched[0]);
}));
app2.get("/courier/stats", async (req, res) => {
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
app2.post("/courier/orders/:orderId/status", async (req, res) => {
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
  if (action === "PICKED_UP") {
    if (hasPicked) return res.json(order);
    if (!tl.handedToDriverAt) {
      return res.status(400).json({
        error: "Merchant must mark order as handed to driver first",
        code: "HANDOVER_REQUIRED",
        details: { message: "\u0627\u0646\u062A\u0638\u0631 \u062A\u0633\u0644\u064A\u0645 \u0627\u0644\u0637\u0644\u0628 \u0645\u0646 \u0627\u0644\u0645\u062D\u0644" }
      });
    }
  }
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
  if (action === "DELIVERED") {
    updated.deliveredAt = tl.deliveredAt;
    updated.status = "COMPLETED";
  }
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
app2.patch("/courier/orders/:orderId/location", wrapAsync(async (req, res) => {
  const scope = requireCourier(req, res);
  if (!scope) return;
  const { orderId } = req.params;
  const body = req.body ?? {};
  const lat = typeof body.lat === "number" ? body.lat : void 0;
  const lng = typeof body.lng === "number" ? body.lng : void 0;
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ error: "Missing or invalid lat/lng", code: "BAD_REQUEST" });
  }
  const orders = await repos.orders.findAll();
  const idx = orders.findIndex((o) => o.id === orderId);
  if (idx === -1) return res.status(404).json({ error: "Order not found" });
  const order = orders[idx];
  if (order.courierId !== scope.courierId) return res.status(403).json({ error: "Order not assigned to you", code: "FORBIDDEN" });
  const deliveryStatus = order.deliveryStatus ?? "UNASSIGNED";
  if (deliveryStatus !== "PICKED_UP") {
    return res.status(400).json({ error: "Location updates only when order is on the way (PICKED_UP)", code: "INVALID_STATE" });
  }
  const updated = { ...order, courierLocation: { lat, lng } };
  orders[idx] = updated;
  await repos.orders.setAll(orders);
  res.json(updated);
}));
var courierEventListeners = /* @__PURE__ */ new Map();
app2.get("/courier/events", async (req, res) => {
  const scope = requireCourier(req, res);
  if (!scope) return;
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
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
function emitOrderAvailableForMarket(marketId, orderId, couriers) {
  const marketCourierIds = couriers.filter((c) => c.scopeType === "MARKET" && (c.marketId ?? c.scopeId) === marketId).map((c) => c.id).filter(Boolean);
  const payload = JSON.stringify({ type: "order_available", orderId });
  for (const cid of marketCourierIds) {
    const send = courierEventListeners.get(cid);
    if (send) {
      try {
        send(payload);
      } catch {
        courierEventListeners.delete(cid);
      }
    }
  }
}
function emitOrderReadyForMarket(marketId, orderId, couriers) {
  const marketCourierIds = couriers.filter((c) => c.scopeType === "MARKET" && (c.marketId ?? c.scopeId) === marketId).map((c) => c.id).filter(Boolean);
  const payload = JSON.stringify({ type: "order_ready", orderId });
  for (const cid of marketCourierIds) {
    const send = courierEventListeners.get(cid);
    if (send) {
      try {
        send(payload);
      } catch {
        courierEventListeners.delete(cid);
      }
    }
  }
}
app2.post("/auth/change-password", async (req, res) => {
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
  if (user.role === "SUPER_ADMIN") return true;
  if (user.role === "MARKET_ADMIN") return true;
  if (isPlatformAdmin(user.role)) {
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
  if (req.user?.role === "SUPER_ADMIN") return true;
  if (isPlatformAdmin(req.user?.role) && !getEmergencyReason(req)) {
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
var DEFAULT_OPEN_TIME = "08:00";
var DEFAULT_CLOSE_TIME = "17:00";
function normalizeTenantResponse(t) {
  const type = t.type === "CLOTHING" || t.type === "FOOD" ? t.type : "GENERAL";
  const banners = t.banners;
  const openTime = t.openTime ?? DEFAULT_OPEN_TIME;
  const closeTime = t.closeTime ?? DEFAULT_CLOSE_TIME;
  const forceClosed = t.forceClosed ?? false;
  return {
    ...t,
    type,
    hero: normalizeHero(t.hero),
    banners: Array.isArray(banners) ? banners : [],
    openTime,
    closeTime,
    forceClosed
  };
}
function resolveTenantCategoryName(t) {
  const subs = getSubCategories();
  const pillars = getPillars();
  if (t.subCategoryId) {
    const sub = subs.find((s) => s.id === t.subCategoryId);
    if (sub) return sub.nameAr && sub.nameAr.trim() || sub.name || null;
  }
  if (t.pillarId) {
    const pillar = pillars.find((p) => p.id === t.pillarId);
    if (pillar) return pillar.nameAr && pillar.nameAr.trim() || pillar.name || null;
  }
  return null;
}
function norm(s) {
  return String(s ?? "").trim().toLowerCase();
}
async function resolveTenantId(tenantIdOrSlug) {
  const v = String(tenantIdOrSlug).trim();
  if (!v) return null;
  const tenants = await repos.tenants.findAll();
  const byId = tenants.find((t) => norm(t.id) === norm(v));
  if (byId) return byId.id;
  const bySlug = tenants.find((t) => norm(t.slug ?? "") === norm(v));
  return bySlug ? bySlug.id : null;
}
function leadBelongsToTenantFilter(l, reqId, reqSlug, _tenants) {
  const rid = norm(reqId);
  const rslug = reqSlug ? norm(reqSlug) : "";
  const lid = l.tenantId != null ? norm(l.tenantId) : "";
  const lslug = l.tenantSlug != null ? norm(l.tenantSlug) : "";
  const lstore = l.storeId != null ? norm(l.storeId) : "";
  if (rid && (lid === rid || lslug === rid || lstore === rid)) return true;
  if (rslug && (lid === rslug || lslug === rslug || lstore === rslug)) return true;
  return false;
}
app2.post("/leads", wrapAsync(async (req, res) => {
  const body = req.body;
  const tenantIdOrSlug = body.tenantId ?? body.tenantSlug ?? body.professionalId;
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
    timestamp: typeof body.timestamp === "string" ? body.timestamp : void 0,
    metadata
  });
  res.status(201).json(lead);
}));
app2.get("/leads", wrapAsync(async (req, res) => {
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
  if (isPlatformAdmin(caller.role)) {
    if (filterTenantId) {
      const t = tenants.find((x) => x.id === filterTenantId);
      const slug = t?.slug;
      leads = leads.filter((l) => leadBelongsToTenantFilter(l, filterTenantId, slug, tenants));
    }
  } else if (caller.role === "TENANT_ADMIN") {
    let myTenantId = filterTenantId ?? String(caller.tenantId ?? "").trim();
    if (!myTenantId && caller.id) {
      const users = await repos.users.findAll();
      const u = users.find((x) => x.id === caller.id);
      const tid = u?.tenantId;
      if (tid) myTenantId = String(tid).trim();
    }
    const myTenant = myTenantId ? tenants.find((t) => norm(t.id) === norm(myTenantId) || norm(t.slug ?? "") === norm(myTenantId)) : null;
    const mySlug = myTenant?.slug ?? (myTenantId && !myTenant ? myTenantId : "");
    const effectiveId = myTenant?.id ?? myTenantId;
    if (process.env.NODE_ENV !== "production") {
      console.log("DEBUG GET /leads: User Slug:", mySlug, "User TenantId:", myTenantId, "EffectiveId:", effectiveId, "First lead tenantId:", leads[0]?.tenantId, "Total before filter:", leads.length);
    }
    if (effectiveId || mySlug) {
      leads = leads.filter((l) => leadBelongsToTenantFilter(l, effectiveId || mySlug, mySlug || void 0, tenants));
    } else {
      leads = [];
    }
  } else if (caller.role === "MARKET_ADMIN" && caller.marketId) {
    const marketTenantIds = new Set(tenants.filter((t) => t.marketId === caller.marketId).map((t) => t.id));
    if (filterTenantId) {
      if (!marketTenantIds.has(filterTenantId)) leads = [];
      else {
        const t = tenants.find((x) => x.id === filterTenantId);
        const slug = t?.slug;
        leads = leads.filter((l) => leadBelongsToTenantFilter(l, filterTenantId, slug, tenants));
      }
    } else {
      leads = leads.filter((l) => {
        if (l.tenantId == null) return false;
        const tid = String(l.tenantId).trim();
        if (marketTenantIds.has(tid)) return true;
        const tenant = tenants.find((t) => norm(t.id) === norm(tid) || norm(t.slug ?? "") === norm(tid));
        return !!tenant && marketTenantIds.has(tenant.id);
      });
    }
  }
  res.json(leads);
}));
app2.get("/customers", wrapAsync(async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  const caller = req.user;
  const allCustomers = await repos.customers.findAll();
  const allOrders = await repos.orders.findAll();
  const allLeads = getLeads();
  if (isPlatformAdmin(caller.role)) {
    const querySlug = req.query.tenantSlug?.trim();
    if (querySlug) {
      const filterTenantId = await resolveTenantId(querySlug);
      if (!filterTenantId) return res.status(400).json({ error: "Tenant not found for tenantSlug" });
      const customerIds = /* @__PURE__ */ new Set();
      allOrders.forEach((o) => {
        if (o.tenantId === filterTenantId && o.customerId) customerIds.add(o.customerId);
      });
      allLeads.forEach((l) => {
        if (l.tenantId === filterTenantId) {
          const cid = l.metadata?.customerId;
          if (cid) customerIds.add(cid);
        }
      });
      const filtered = allCustomers.filter((c) => customerIds.has(c.id));
      return res.json(filtered);
    }
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
  const tid = norm(String(l.tenantId));
  const rid = norm(tenantId);
  const rslug = tenantSlug ? norm(tenantSlug) : "";
  return tid === rid || !!rslug && tid === rslug;
}
app2.get("/merchant/dashboard", wrapAsync(async (req, res) => {
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
app2.get("/merchant/leads", wrapAsync(async (req, res) => {
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
app2.get("/audit-events", async (req, res) => {
  if (!isPlatformAdmin(req.user?.role)) return res.status(403).json({ error: "Forbidden" });
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const events = getAuditEvents().slice(-limit).reverse();
  res.json(events);
});
app2.get("/monitoring/stats", async (req, res) => {
  if (!isPlatformAdmin(req.user?.role)) return res.status(403).json({ error: "Forbidden" });
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
app2.get("/users", async (req, res) => {
  if (!isPlatformAdmin(req.user?.role)) return res.status(403).json({ error: "Forbidden" });
  const users = (await repos.users.findAll()).map((u) => ({ ...u, password: void 0 }));
  res.json(users);
});
app2.post("/admin/notifications/broadcast", wrapAsync(async (req, res) => {
  const user = req.user;
  if (!user || !isPlatformAdmin(user.role)) return res.status(403).json({ error: "Forbidden: platform admin only" });
  const body = req.body;
  const t = typeof body.title === "string" ? body.title.trim() : "";
  const b = typeof body.body === "string" ? body.body.trim() : "";
  if (!t && !b) return res.status(400).json({ error: "title or body required" });
  const tokens = await getAllCustomerFcmTokens();
  const uniqueTokens = Array.from(new Set(tokens.map((tok) => tok.trim()).filter(Boolean)));
  if (uniqueTokens.length === 0) {
    return res.json({ sent: 0, failed: 0, message: "No customer FCM tokens registered" });
  }
  const payload = {
    title: t || "\u0625\u0634\u0639\u0627\u0631",
    body: b || ""
  };
  const { successCount, failureCount } = await sendFCMMulticast(uniqueTokens, payload);
  res.json({ sent: successCount, failed: failureCount, totalTokens: uniqueTokens.length });
}));
app2.post("/admin/notifications/send-to-customer", wrapAsync(async (req, res) => {
  const user = req.user;
  if (!user || !isPlatformAdmin(user.role)) return res.status(403).json({ error: "Forbidden: platform admin only" });
  const body = req.body;
  const customerId = (body.customerId ?? "").toString().trim();
  if (!customerId) return res.status(400).json({ error: "customerId required" });
  const title = (body.title ?? "").toString().trim() || "\u0625\u0634\u0639\u0627\u0631";
  const msgBody = (body.body ?? "").toString().trim() || "";
  await sendFCMNotification(customerId, title, msgBody);
  res.json({ ok: true });
}));
app2.post("/admin/users/:userId/reset-password", async (req, res) => {
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
  if (isPlatformAdmin(caller.role)) {
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
  console.log("Updating password for User ID:", userId, "to:", newPassword);
  await repos.users.setAll(users);
  if (process.env.NODE_ENV !== "production") {
    console.log("Password updated successfully for tenant:", target.tenantId ?? userId);
  }
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
app2.get("/markets/:marketId/tenant-admins", async (req, res) => {
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
app2.get("/tenants/:tenantId/tenant-admin", async (req, res) => {
  const caller = req.user;
  if (!caller) return res.status(401).json({ error: "Unauthorized" });
  const { tenantId } = req.params;
  const tenant = (await repos.tenants.findAll()).find((t) => t.id === tenantId);
  if (!tenant) return res.status(404).json({ error: "Tenant not found" });
  if (caller.role === "MARKET_ADMIN" && tenant.marketId !== caller.marketId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const users = await repos.users.findAll();
  const admin2 = users.find((u) => u.role === "TENANT_ADMIN" && u.tenantId === tenantId);
  if (!admin2) return res.status(404).json({ error: "No tenant admin found" });
  res.json({ ...admin2, password: void 0 });
});
app2.post("/tenants/:tenantId/create-admin", async (req, res) => {
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
app2.get("/global-categories", (_req, res) => {
  res.json(getGlobalCategories());
});
app2.get("/categories", (_req, res) => {
  res.json(getGlobalCategories());
});
app2.post("/global-categories", async (req, res) => {
  if (!isPlatformAdmin(req.user?.role)) return res.status(403).json({ error: "Forbidden" });
  if (!requireWriteWithReason(req, res)) return;
  const body = req.body;
  const id = crypto.randomUUID?.() ?? `cat-${Date.now()}`;
  const cat = {
    id,
    title: body.title ?? "",
    nameAr: body.nameAr != null ? String(body.nameAr).trim() || void 0 : void 0,
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
app2.put("/global-categories/:id", async (req, res) => {
  if (!isPlatformAdmin(req.user?.role)) return res.status(403).json({ error: "Forbidden" });
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
app2.delete("/global-categories/:id", async (req, res) => {
  if (!isPlatformAdmin(req.user?.role)) return res.status(403).json({ error: "Forbidden" });
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
app2.get("/pillars", (_req, res) => {
  res.json(getPillars());
});
app2.post("/pillars", async (req, res) => {
  if (!isPlatformAdmin(req.user?.role)) return res.status(403).json({ error: "Forbidden" });
  if (!requireWriteWithReason(req, res)) return;
  const body = req.body;
  const id = crypto.randomUUID?.() ?? `pillar-${Date.now()}`;
  const slug = (body.slug ?? body.name).toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") || id;
  const pillar = {
    id,
    name: body.name ?? "",
    nameAr: body.nameAr != null ? String(body.nameAr).trim() || void 0 : void 0,
    slug,
    icon: body.icon,
    sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : getPillars().length
  };
  const list = getPillars();
  list.push(pillar);
  setPillars(list);
  appendAuditEvent({
    userId: req.user.id,
    role: req.user.role,
    action: "create",
    entity: "pillar",
    entityId: id,
    reason: getEmergencyReason(req),
    emergencyMode: true,
    after: pillar
  });
  res.status(201).json(pillar);
});
app2.put("/pillars/:id", async (req, res) => {
  if (!isPlatformAdmin(req.user?.role)) return res.status(403).json({ error: "Forbidden" });
  if (!requireWriteWithReason(req, res)) return;
  const { id } = req.params;
  const body = req.body;
  const list = getPillars();
  const idx = list.findIndex((p) => p.id === id);
  if (idx === -1) return res.status(404).json({ error: "Pillar not found" });
  const before = list[idx];
  list[idx] = { ...list[idx], ...body };
  setPillars(list);
  appendAuditEvent({
    userId: req.user.id,
    role: req.user.role,
    action: "update",
    entity: "pillar",
    entityId: id,
    reason: getEmergencyReason(req),
    emergencyMode: true,
    before,
    after: list[idx]
  });
  res.json(list[idx]);
});
app2.delete("/pillars/:id", async (req, res) => {
  if (!isPlatformAdmin(req.user?.role)) return res.status(403).json({ error: "Forbidden" });
  if (!requireWriteWithReason(req, res)) return;
  const { id } = req.params;
  const list = getPillars();
  const idx = list.findIndex((p) => p.id === id);
  if (idx === -1) return res.status(404).json({ error: "Pillar not found" });
  const removed = list[idx];
  const subs = getSubCategories().filter((s) => s.pillarId === id);
  if (subs.length > 0) {
    return res.status(400).json({ error: "Cannot delete pillar: remove or reassign its sub-categories first" });
  }
  list.splice(idx, 1);
  setPillars(list);
  appendAuditEvent({
    userId: req.user.id,
    role: req.user.role,
    action: "delete",
    entity: "pillar",
    entityId: id,
    reason: getEmergencyReason(req),
    emergencyMode: true,
    before: removed
  });
  res.status(204).send();
});
app2.get("/sub-categories", (req, res) => {
  const pillarId = req.query.pillarId?.trim();
  let list = getSubCategories();
  if (pillarId) list = list.filter((s) => s.pillarId === pillarId);
  res.json(list);
});
app2.post("/sub-categories", async (req, res) => {
  if (!isPlatformAdmin(req.user?.role)) return res.status(403).json({ error: "Forbidden" });
  if (!requireWriteWithReason(req, res)) return;
  const body = req.body;
  const pillarId = (body.pillarId ?? "").trim();
  if (!pillarId) return res.status(400).json({ error: "pillarId is required" });
  const pillars = getPillars();
  if (!pillars.some((p) => p.id === pillarId)) return res.status(400).json({ error: "Pillar not found" });
  const id = crypto.randomUUID?.() ?? `sub-${Date.now()}`;
  const slug = (body.slug ?? body.name).toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") || id;
  const sub = {
    id,
    pillarId,
    name: body.name ?? "",
    nameAr: body.nameAr != null ? String(body.nameAr).trim() || void 0 : void 0,
    slug,
    sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : getSubCategories().length
  };
  const list = getSubCategories();
  list.push(sub);
  setSubCategories(list);
  appendAuditEvent({
    userId: req.user.id,
    role: req.user.role,
    action: "create",
    entity: "subCategory",
    entityId: id,
    reason: getEmergencyReason(req),
    emergencyMode: true,
    after: sub
  });
  res.status(201).json(sub);
});
app2.put("/sub-categories/:id", async (req, res) => {
  if (!isPlatformAdmin(req.user?.role)) return res.status(403).json({ error: "Forbidden" });
  if (!requireWriteWithReason(req, res)) return;
  const { id } = req.params;
  const body = req.body;
  const list = getSubCategories();
  const idx = list.findIndex((s) => s.id === id);
  if (idx === -1) return res.status(404).json({ error: "Sub-category not found" });
  const before = list[idx];
  list[idx] = { ...list[idx], ...body };
  setSubCategories(list);
  appendAuditEvent({
    userId: req.user.id,
    role: req.user.role,
    action: "update",
    entity: "subCategory",
    entityId: id,
    reason: getEmergencyReason(req),
    emergencyMode: true,
    before,
    after: list[idx]
  });
  res.json(list[idx]);
});
app2.delete("/sub-categories/:id", async (req, res) => {
  if (!isPlatformAdmin(req.user?.role)) return res.status(403).json({ error: "Forbidden" });
  if (!requireWriteWithReason(req, res)) return;
  const { id } = req.params;
  const list = getSubCategories();
  const idx = list.findIndex((s) => s.id === id);
  if (idx === -1) return res.status(404).json({ error: "Sub-category not found" });
  const removed = list[idx];
  list.splice(idx, 1);
  setSubCategories(list);
  const tenants = await repos.tenants.findAll();
  let changed = false;
  for (let i = 0; i < tenants.length; i++) {
    if (tenants[i].subCategoryId === id) {
      tenants[i].subCategoryId = null;
      changed = true;
    }
  }
  if (changed) await repos.tenants.setAll(tenants);
  appendAuditEvent({
    userId: req.user.id,
    role: req.user.role,
    action: "delete",
    entity: "subCategory",
    entityId: id,
    reason: getEmergencyReason(req),
    emergencyMode: true,
    before: removed
  });
  res.status(204).send();
});
app2.get("/category-policies", (_req, res) => {
  res.json(getCategoryPolicies());
});
app2.patch("/category-policies/:id", async (req, res) => {
  if (!isPlatformAdmin(req.user?.role)) return res.status(403).json({ error: "Forbidden: platform admin only" });
  if (!requireWriteWithReason(req, res)) return;
  const { id } = req.params;
  const body = req.body;
  const policies = getCategoryPolicies();
  const idx = policies.findIndex((p) => p.id === id);
  if (idx === -1) return res.status(404).json({ error: "Category policy not found" });
  const before = { ...policies[idx] };
  if (body.name !== void 0) policies[idx].name = String(body.name).trim() || policies[idx].name;
  if (typeof body.greenMs === "number" && body.greenMs >= 0) policies[idx].greenMs = body.greenMs;
  if (typeof body.orangeMs === "number" && body.orangeMs >= 0) policies[idx].orangeMs = body.orangeMs;
  if (typeof body.redMs === "number" && body.redMs >= 0) policies[idx].redMs = body.redMs;
  if (typeof body.isUrgent === "boolean") policies[idx].isUrgent = body.isUrgent;
  setCategoryPolicies(policies);
  appendAuditEvent({
    userId: req.user.id,
    role: req.user.role,
    action: "update",
    entity: "categoryPolicy",
    entityId: id,
    reason: getEmergencyReason(req),
    emergencyMode: true,
    before,
    after: policies[idx]
  });
  res.json(policies[idx]);
});
app2.get("/markets", async (req, res) => {
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
app2.post("/markets", async (req, res) => {
  if (!isPlatformAdmin(req.user?.role)) return res.status(403).json({ error: "Forbidden" });
  if (!requireWriteWithReason(req, res)) return;
  const body = req.body;
  const id = crypto.randomUUID?.() ?? `market-${Date.now()}`;
  const market = {
    id,
    name: body.name ?? "",
    slug: body.slug ?? id,
    imageUrl: typeof body.imageUrl === "string" ? body.imageUrl : void 0,
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
app2.put("/markets/:id", async (req, res) => {
  const user = req.user;
  const { id } = req.params;
  const isRoot = isPlatformAdmin(user?.role);
  const isMarketAdminOwn = user?.role === "MARKET_ADMIN" && user.marketId === id;
  if (!isRoot && !isMarketAdminOwn) return res.status(403).json({ error: "Forbidden" });
  if (isRoot && !requireWriteWithReason(req, res)) return;
  const body = req.body;
  const markets = await repos.markets.findAll();
  const idx = markets.findIndex((m) => m.id === id);
  if (idx === -1) return res.status(404).json({ error: "Market not found" });
  const before = markets[idx];
  if (isMarketAdminOwn && !isRoot) {
    const { name, sortOrder, ...rest } = body;
    if (name !== void 0 || sortOrder !== void 0) return res.status(403).json({ error: "Forbidden: only Super Admin can change display name and sort order" });
    Object.assign(markets[idx], rest);
  } else {
    markets[idx] = { ...markets[idx], ...body };
  }
  try {
    await repos.markets.setAll(markets);
  } catch (err) {
    console.error("[markets] Failed to persist (check file permissions, e.g. /data):", err instanceof Error ? err.message : err);
    return res.status(500).json({ error: "Failed to save market", code: "PERSIST_ERROR" });
  }
  appendAuditEvent({
    userId: user.id,
    role: user.role,
    action: "update",
    entity: "market",
    entityId: id,
    reason: isRoot ? getEmergencyReason(req) : void 0,
    emergencyMode: isRoot,
    before,
    after: markets[idx]
  });
  res.json(markets[idx]);
});
app2.get("/markets/by-slug/:slug", async (req, res) => {
  const market = (await repos.markets.findAll()).find((m) => m.slug === req.params.slug);
  if (!market) return res.status(404).json({ error: "Market not found" });
  if (!market.isActive) return res.status(404).json({ error: "Market not found" });
  res.json(market);
});
app2.get("/markets/by-slug/:slug/banners", async (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  const market = (await repos.markets.findAll()).find((m) => m.slug === req.params.slug);
  if (!market) return res.status(404).json({ error: "Market not found" });
  const banners = getBannersForMarket(req.params.slug);
  res.json(banners);
});
app2.get("/markets/by-slug/:slug/layout", async (req, res) => {
  const market = (await repos.markets.findAll()).find((m) => m.slug === req.params.slug);
  if (!market) return res.status(404).json({ error: "Market not found" });
  const layout = getLayoutForMarket(req.params.slug);
  res.json(layout);
});
app2.put("/markets/by-slug/:slug/banners", async (req, res) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  if (!isPlatformAdmin(user.role) && (user.role !== "MARKET_ADMIN" || user.marketId !== (await repos.markets.findAll()).find((m) => m.slug === req.params.slug)?.id)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const market = (await repos.markets.findAll()).find((m) => m.slug === req.params.slug);
  if (!market) return res.status(404).json({ error: "Market not found" });
  const banners = req.body;
  if (!Array.isArray(banners)) {
    return res.json(getBannersForMarket(req.params.slug));
  }
  setBannersForMarket(req.params.slug, banners);
  res.json(banners);
});
app2.put("/markets/by-slug/:slug/layout", async (req, res) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  if (!isPlatformAdmin(user.role) && (user.role !== "MARKET_ADMIN" || user.marketId !== (await repos.markets.findAll()).find((m) => m.slug === req.params.slug)?.id)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const market = (await repos.markets.findAll()).find((m) => m.slug === req.params.slug);
  if (!market) return res.status(404).json({ error: "Market not found" });
  const raw = req.body;
  let layout;
  if (Array.isArray(raw)) {
    layout = raw;
  } else if (raw && typeof raw === "object" && !Array.isArray(raw) && "layout" in raw && Array.isArray(raw.layout)) {
    layout = raw.layout;
  } else if (raw && typeof raw === "object" && "_meta" in raw) {
    const obj = raw;
    const keys = Object.keys(obj).filter((k) => k !== "_meta" && /^\d+$/.test(k)).sort((a, b) => Number(a) - Number(b));
    layout = keys.map((k) => obj[k]).filter((x) => x != null && typeof x === "object" && "id" in x && Array.isArray(x.storeIds));
  } else {
    return res.status(400).json({ error: "layout must be an array" });
  }
  const normalizedLayout = layout.map((s) => ({
    ...s,
    type: s.type === "MARKET_GROUP" ? "MARKET_GROUP" : "SLIDER"
  }));
  setLayoutForMarket(req.params.slug, normalizedLayout);
  const storeIdsInMarketGroup = /* @__PURE__ */ new Set();
  for (const section of normalizedLayout) {
    if (section.type === "MARKET_GROUP") {
      for (const id of section.storeIds) {
        if (id && typeof id === "string") storeIdsInMarketGroup.add(id.trim());
      }
    }
  }
  if (storeIdsInMarketGroup.size > 0) {
    const tenants = await repos.tenants.findAll();
    let changed = false;
    for (const t of tenants) {
      const inGroup = storeIdsInMarketGroup.has(t.id) || storeIdsInMarketGroup.has(t.slug ?? "");
      if (inGroup && t.marketId !== market.id) {
        t.marketId = market.id;
        changed = true;
      }
    }
    if (changed) await repos.tenants.setAll(tenants);
  }
  res.json(normalizedLayout);
});
app2.get("/markets/:id", async (req, res) => {
  const market = (await repos.markets.findAll()).find((m) => m.id === req.params.id);
  if (!market) return res.status(404).json({ error: "Market not found" });
  if (req.user?.role === "MARKET_ADMIN" && req.user.marketId !== market.id) {
    return res.status(403).json({ error: "Forbidden" });
  }
  res.json(market);
});
app2.get("/markets/:marketId/admins", async (req, res) => {
  if (!isPlatformAdmin(req.user?.role)) return res.status(403).json({ error: "Forbidden" });
  const { marketId } = req.params;
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: "Market not found" });
  const admins = (await repos.users.findAll()).filter((u) => u.role === "MARKET_ADMIN" && u.marketId === marketId);
  res.json(admins);
});
app2.post("/markets/:marketId/admins", async (req, res) => {
  if (!isPlatformAdmin(req.user?.role)) return res.status(403).json({ error: "Forbidden" });
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
app2.put("/markets/:marketId/admin-credentials", async (req, res) => {
  if (!isPlatformAdmin(req.user?.role)) return res.status(403).json({ error: "Forbidden" });
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
app2.get("/markets/:marketId/tenants", async (req, res) => {
  const { marketId } = req.params;
  const categoryId = req.query.categoryId?.trim() || req.query.marketCategory?.trim();
  const allMarkets = await repos.markets.findAll();
  let market = allMarkets.find((m) => m.id === marketId);
  if (!market && marketId) {
    const slugNorm = marketId.toLowerCase().replace(/^market-/, "");
    market = allMarkets.find(
      (m) => m.slug === marketId || m.slug === slugNorm || m.slug === "dabburiyya" && (marketId === "daburiyya" || marketId === "dabburiyya")
    );
  }
  if (!market) return res.status(404).json({ error: "Market not found" });
  const resolvedMarketId = market.id;
  if (req.user?.role === "MARKET_ADMIN" && req.user.marketId !== resolvedMarketId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const marketTenantIds = new Set(market.tenantIds ?? []);
  const allTenants = await repos.tenants.findAll();
  let tenants = allTenants.filter(
    (t) => (t.marketId === resolvedMarketId || t.marketId === marketId || marketTenantIds.has(t.id)) && t.enabled !== false && t.isListedInMarket !== false
  );
  if (categoryId) {
    const norm2 = (s) => (s ?? "").toLowerCase();
    const globalCats = getGlobalCategories();
    tenants = tenants.filter((t) => {
      const mc = (t.marketCategory ?? "").trim();
      if (norm2(mc) === norm2(categoryId)) return true;
      const cat = globalCats.find((c) => norm2(c.id) === norm2(categoryId));
      if (cat?.legacyCode && norm2(mc) === norm2(cat.legacyCode)) return true;
      return false;
    });
  }
  tenants = tenants.sort((a, b) => {
    const orderA = a.sortOrder ?? 999;
    const orderB = b.sortOrder ?? 999;
    if (orderA !== orderB) return orderA - orderB;
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
      operationalStatus: n.operationalStatus === "open" || n.operationalStatus === "closed" || n.operationalStatus === "busy" ? n.operationalStatus : "open",
      orderPolicy: n.orderPolicy,
      businessHours: n.businessHours,
      openTime: n.openTime,
      closeTime: n.closeTime,
      forceClosed: n.forceClosed,
      overrideStatus: n.overrideStatus ?? void 0,
      pillarId: n.pillarId ?? null,
      subCategoryId: n.subCategoryId ?? null,
      categoryName: resolveTenantCategoryName(t) ?? null
    };
  });
  res.json(tenants);
});
app2.post("/markets/:marketId/tenants", async (req, res) => {
  const { marketId } = req.params;
  const user = req.user;
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  if (isPlatformAdmin(user.role) && !requireWriteWithReason(req, res)) return;
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
    reason: isPlatformAdmin(user.role) ? getEmergencyReason(req) : void 0,
    emergencyMode: isPlatformAdmin(user.role),
    after: tenant
  });
  res.status(201).json(normalizeTenantResponse(tenant));
});
app2.get("/tenants", async (req, res) => {
  let tenants = await repos.tenants.findAll();
  if (req.user?.role === "MARKET_ADMIN" && req.user.marketId) {
    tenants = tenants.filter((t) => t.marketId === req.user.marketId);
  }
  tenants = tenants.sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));
  res.json(tenants.map(normalizeTenantResponse));
});
app2.get("/storefront/tenants", async (_req, res) => {
  const tenants = (await repos.tenants.findAll()).filter((t) => t.enabled).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)).map((t) => {
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
      marketId: t.marketId ?? null,
      operationalStatus: n.operationalStatus,
      orderPolicy: n.orderPolicy,
      businessHours: n.businessHours,
      openTime: n.openTime,
      closeTime: n.closeTime,
      forceClosed: n.forceClosed,
      overrideStatus: n.overrideStatus ?? void 0,
      pillarId: n.pillarId ?? null,
      subCategoryId: n.subCategoryId ?? null,
      categoryName: resolveTenantCategoryName(t) ?? null
    };
  });
  res.json(tenants);
});
app2.post("/tenants", async (req, res) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  if (isPlatformAdmin(user.role) && !requireWriteWithReason(req, res)) return;
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
    reason: isPlatformAdmin(user.role) ? getEmergencyReason(req) : void 0,
    emergencyMode: isPlatformAdmin(user.role),
    after: tenant
  });
  res.status(201).json(tenant);
});
function normalizeId(s) {
  return String(s ?? "").trim();
}
async function handleTenantUpdate(req, res) {
  const { id } = req.params;
  let updates = req.body;
  const user = req.user;
  let updatedAdminPayload;
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const tenants = await repos.tenants.findAll();
  const idx = tenants.findIndex((t) => t.id === id);
  if (idx === -1) {
    res.status(404).json({ error: "Tenant not found" });
    return;
  }
  const tenant = tenants[idx];
  const rawUpdates = req.body;
  if (isPlatformAdmin(user.role) && !requireWriteWithReason(req, res)) return;
  if (user.role === "MARKET_ADMIN") {
    const callerMarketId = normalizeId(user.marketId);
    const tenantMarketId = normalizeId(tenant.marketId);
    const assigningToCallerMarket = tenantMarketId === "" && normalizeId(updates.marketId) === callerMarketId;
    const tenantBelongsToCallerMarket = callerMarketId && (tenantMarketId === callerMarketId || assigningToCallerMarket);
    if (!tenantBelongsToCallerMarket) {
      res.status(403).json({ error: "Not authorized for this tenant: tenant must belong to your market" });
      return;
    }
    const allowed = ["marketCategory", "isListedInMarket", "marketSortOrder", "marketId", "pillarId", "subCategoryId", "adminEmail", "supportsWeightSelling", "overrideStatus"];
    updates = Object.fromEntries(
      Object.entries(updates).filter(([k]) => allowed.includes(k))
    );
    if (rawUpdates.pillarId !== void 0) {
      updates.pillarId = rawUpdates.pillarId === null || rawUpdates.pillarId === "" ? null : String(rawUpdates.pillarId);
    }
    if (rawUpdates.subCategoryId !== void 0) {
      updates.subCategoryId = rawUpdates.subCategoryId === null || rawUpdates.subCategoryId === "" ? null : String(rawUpdates.subCategoryId);
    }
    if (updates.marketId !== void 0 && normalizeId(updates.marketId) !== callerMarketId) {
      updates = { ...updates, marketId: user.marketId };
    }
    delete updates.adminEmail;
  }
  const newAdminEmail = typeof rawUpdates.adminEmail === "string" ? rawUpdates.adminEmail.trim().toLowerCase() : void 0;
  if (newAdminEmail !== void 0 && (user.role === "MARKET_ADMIN" || isPlatformAdmin(user.role))) {
    if (process.env.NODE_ENV !== "production") {
      console.log("[PUT /tenants/:id] adminEmail received:", newAdminEmail, "for tenantId:", id);
    }
    const users = await repos.users.findAll();
    const tenantAdminUser = users.find((u) => u.tenantId === id && u.role === "TENANT_ADMIN");
    if (!tenantAdminUser) {
      if (process.env.NODE_ENV !== "production") {
        console.log("[PUT /tenants/:id] No TENANT_ADMIN user found for tenantId:", id);
      }
      res.status(400).json({ error: "\u0644\u0627 \u064A\u0648\u062C\u062F \u062D\u0633\u0627\u0628 \u0645\u062F\u064A\u0631 \u0644\u0647\u0630\u0627 \u0627\u0644\u0645\u062D\u0644 \u0644\u062A\u062D\u062F\u064A\u062B \u0628\u0631\u064A\u062F\u0647" });
      return;
    }
    if (users.some((u) => u.id !== tenantAdminUser.id && u.email?.toLowerCase() === newAdminEmail)) {
      res.status(409).json({ error: "\u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0645\u0633\u062A\u062E\u062F\u0645 \u0628\u0627\u0644\u0641\u0639\u0644 \u0644\u062D\u0633\u0627\u0628 \u0622\u062E\u0631" });
      return;
    }
    tenantAdminUser.email = newAdminEmail;
    await repos.users.setAll(users);
    if (process.env.NODE_ENV !== "production") {
      console.log("[PUT /tenants/:id] Updated tenant admin email for tenantId:", id, "(Postgres User table when STORAGE_DRIVER=db)");
    }
    updatedAdminPayload = { tenantId: id, email: newAdminEmail };
  }
  delete updates.adminEmail;
  const before = { ...tenants[idx] };
  if (updates.banners !== void 0 && !Array.isArray(updates.banners)) delete updates.banners;
  if (updates.hero !== void 0 && (typeof updates.hero !== "object" || updates.hero === null)) delete updates.hero;
  tenants[idx] = { ...tenants[idx], ...updates };
  await repos.tenants.setAll(tenants);
  appendAuditEvent({
    userId: user.id,
    role: user.role,
    marketId: tenant.marketId,
    action: "update",
    entity: "tenant",
    entityId: id,
    reason: isPlatformAdmin(user.role) ? getEmergencyReason(req) : void 0,
    emergencyMode: isPlatformAdmin(user.role),
    before,
    after: tenants[idx]
  });
  const response = normalizeTenantResponse(tenants[idx]);
  if (updatedAdminPayload) {
    response.updatedAdmin = updatedAdminPayload;
  }
  res.json(response);
}
app2.put("/tenants/:id", handleTenantUpdate);
app2.patch("/tenants/:id", handleTenantUpdate);
app2.post("/tenants/:id/toggle", async (req, res) => {
  const { id } = req.params;
  const user = req.user;
  const tenants = await repos.tenants.findAll();
  const idx = tenants.findIndex((t) => t.id === id);
  if (idx === -1) return res.status(404).json({ error: "Tenant not found" });
  const tenant = tenants[idx];
  if (user?.role === "MARKET_ADMIN" && tenant.marketId !== user.marketId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  if (isPlatformAdmin(user?.role) && !requireWriteWithReason(req, res)) return;
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
    reason: isPlatformAdmin(user.role) ? getEmergencyReason(req) : void 0,
    emergencyMode: isPlatformAdmin(user.role),
    before,
    after: tenants[idx]
  });
  res.json(normalizeTenantResponse(tenants[idx]));
});
app2.get("/tenants/by-id/:id", async (req, res) => {
  const requestedId = req.params.id;
  const tenant = (await repos.tenants.findAll()).find((t) => t.id === requestedId);
  const uid = req.user;
  if (!tenant) {
    console.log("[Tenant] GET /tenants/by-id/" + requestedId + " \u2192 404 (tenant not found). req.user id=", uid?.id, "tenantId=", uid?.tenantId);
    return res.status(404).json({ error: "Tenant not found" });
  }
  if (req.user?.role === "TENANT_ADMIN" && req.user.tenantId !== requestedId) {
    console.log("[Tenant] GET /tenants/by-id/" + requestedId + " \u2192 403 (TENANT_ADMIN user.tenantId=" + req.user.tenantId + " != requested id)");
    return res.status(403).json({ error: "Forbidden" });
  }
  if (req.user?.role === "MARKET_ADMIN" && tenant.marketId !== req.user.marketId) {
    console.log("[Tenant] GET /tenants/by-id/" + requestedId + " \u2192 403 (MARKET_ADMIN marketId mismatch)");
    return res.status(403).json({ error: "Forbidden" });
  }
  const deliveryZones = sortZones(await repos.deliveryZones.getByTenant(tenant.id)).map(normalizeZoneForResponse);
  res.json({ ...normalizeTenantResponse(tenant), deliveryZones });
});
app2.get("/tenants/by-slug/:slug", async (req, res) => {
  const slug = req.params.slug;
  let tenant = (await repos.tenants.findAll()).find((t) => t.slug === slug);
  if (!tenant && slug === "top-market") {
    tenant = (await repos.tenants.findAll()).find((t) => t.id === TOP_MARKET_TENANT_ID);
  }
  if (!tenant) return res.status(404).json({ error: "Tenant not found" });
  if (req.user?.role === "MARKET_ADMIN" && tenant.marketId !== req.user.marketId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const deliveryZones = sortZones(await repos.deliveryZones.getByTenant(tenant.id)).map(normalizeZoneForResponse);
  res.json({ ...normalizeTenantResponse(tenant), deliveryZones });
});
app2.put("/tenants/:id/branding", async (req, res) => {
  const { id } = req.params;
  const user = req.user;
  console.log("[Branding] Incoming Config:", req.body);
  const tenants = await repos.tenants.findAll();
  const t = tenants.find((x) => x.id === id);
  if (!t) return res.status(404).json({ error: "Tenant not found" });
  if (user?.role === "MARKET_ADMIN" && t.marketId !== user.marketId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  if (isPlatformAdmin(user?.role) && !requireWriteWithReason(req, res)) return;
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
  if (body.banners !== void 0 && Array.isArray(body.banners)) tenants[idx].banners = body.banners;
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
  console.log("[Branding] Persisted tenant", id, process.env.STORAGE_DRIVER === "db" ? "to database" : "to store");
  appendAuditEvent({
    userId: user.id,
    role: user.role,
    marketId: t.marketId,
    action: "update",
    entity: "tenant",
    entityId: id,
    reason: isPlatformAdmin(user.role) ? getEmergencyReason(req) : void 0,
    emergencyMode: isPlatformAdmin(user.role),
    before,
    after: tenants[idx]
  });
  res.json(normalizeTenantResponse(tenants[idx]));
});
app2.put("/tenants/:id/collections", async (req, res) => {
  const { id } = req.params;
  const user = req.user;
  const tenants = await repos.tenants.findAll();
  const t = tenants.find((x) => x.id === id);
  if (!t) return res.status(404).json({ error: "Tenant not found" });
  if (user?.role === "MARKET_ADMIN" && t.marketId !== user.marketId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  if (isPlatformAdmin(user?.role) && !requireWriteWithReason(req, res)) return;
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
    reason: isPlatformAdmin(user.role) ? getEmergencyReason(req) : void 0,
    emergencyMode: isPlatformAdmin(user.role),
    before,
    after: tenants[idx]
  });
  res.json(normalizeTenantResponse(tenants[idx]));
});
app2.put("/tenants/:id/operational-settings", async (req, res) => {
  const { id } = req.params;
  const user = req.user;
  const tenants = await repos.tenants.findAll();
  const t = tenants.find((x) => x.id === id);
  if (!t) return res.status(404).json({ error: "Tenant not found" });
  if (user?.role === "MARKET_ADMIN" && t.marketId !== user.marketId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  if (user?.role === "TENANT_ADMIN" && user.tenantId !== id) {
    return res.status(403).json({ error: "Forbidden: can only update your own store" });
  }
  if (isPlatformAdmin(user?.role) && !requireWriteWithReason(req, res)) return;
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
  if (body.overrideStatus !== void 0) {
    const val = body.overrideStatus;
    tenants[idx].overrideStatus = val === "FORCE_OPEN" || val === "FORCE_CLOSED" ? val : void 0;
  }
  if (body.orderPolicy !== void 0) tenants[idx].orderPolicy = body.orderPolicy;
  if (body.businessHours !== void 0) tenants[idx].businessHours = body.businessHours;
  if (body.busyBannerEnabled !== void 0) tenants[idx].busyBannerEnabled = body.busyBannerEnabled;
  if (body.busyBannerText !== void 0) tenants[idx].busyBannerText = body.busyBannerText;
  if (body.bookingEnabled !== void 0) tenants[idx].bookingEnabled = body.bookingEnabled;
  if (body.about !== void 0) tenants[idx].about = body.about;
  if (body.officeHours !== void 0) tenants[idx].officeHours = body.officeHours;
  if (body.openTime !== void 0) tenants[idx].openTime = body.openTime;
  if (body.closeTime !== void 0) tenants[idx].closeTime = body.closeTime;
  if (body.forceClosed !== void 0) tenants[idx].forceClosed = body.forceClosed;
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
  if (body.storeType !== void 0) {
    tenants[idx].storeType = body.storeType;
  }
  if (body.addressLine !== void 0) tenants[idx].addressLine = body.addressLine;
  if (body.location !== void 0) tenants[idx].location = body.location;
  if (body.supportsWeightSelling !== void 0) tenants[idx].supportsWeightSelling = body.supportsWeightSelling;
  const before = { ...tenants[idx] };
  await repos.tenants.setAll(tenants);
  appendAuditEvent({
    userId: user.id,
    role: user.role,
    marketId: t.marketId,
    action: "update",
    entity: "tenant",
    entityId: id,
    reason: isPlatformAdmin(user.role) ? getEmergencyReason(req) : void 0,
    emergencyMode: isPlatformAdmin(user.role),
    before,
    after: tenants[idx]
  });
  res.json(normalizeTenantResponse(tenants[idx]));
});
app2.delete("/tenants/:id", async (req, res) => {
  const { id } = req.params;
  const user = req.user;
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  if (user.role === "TENANT_ADMIN") {
    return res.status(403).json({ error: "Forbidden: only SUPER_ADMIN or MARKET_ADMIN can delete a store" });
  }
  const tenants = await repos.tenants.findAll();
  const t = tenants.find((x) => x.id === id);
  if (!t) return res.status(404).json({ error: "Tenant not found" });
  if (user.role === "MARKET_ADMIN" && t.marketId !== user.marketId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  if (isPlatformAdmin(user.role) && !requireWriteWithReason(req, res)) return;
  const orderIds = (await repos.orders.findAll()).filter((o) => o.tenantId === id).map((o) => o.id).filter(Boolean);
  await repos.payments.deleteForOrderIds(orderIds);
  const orders = (await repos.orders.findAll()).filter((o) => o.tenantId !== id);
  await repos.orders.setAll(orders);
  await repos.catalog.setCatalog(id, { categories: [], products: [], optionGroups: [] });
  await repos.delivery.deleteSettings(id);
  await repos.deliveryZones.setAll(id, []);
  const couriers = (await repos.couriers.findAll()).filter(
    (c) => !(c.scopeType === "TENANT" && c.scopeId === id)
  );
  await repos.couriers.setAll(couriers);
  const remainingTenants = tenants.filter((x) => x.id !== id);
  await repos.tenants.setAll(remainingTenants);
  appendAuditEvent({
    userId: user.id,
    role: user.role,
    marketId: t.marketId,
    action: "delete",
    entity: "tenant",
    entityId: id,
    reason: isPlatformAdmin(user.role) ? getEmergencyReason(req) : "full store delete",
    emergencyMode: isPlatformAdmin(user.role),
    before: t,
    after: null
  });
  res.status(204).send();
});
var UPLOAD_BASE = process.env.PUBLIC_URL || `http://localhost:${PORT}`;
app2.post("/upload", async (req, res) => {
  const files = req.files ?? [];
  const base = UPLOAD_BASE;
  const urls = [];
  for (const f of files) {
    const fullPath = join4(UPLOADS_DIR, f.filename);
    const name = existsSync5(fullPath) ? await compressNewUploadToWebP(fullPath) : f.filename;
    urls.push(`${base}/uploads/${name}`);
  }
  console.log("[Upload] Success:", files.length, "files (WebP q75), base:", base);
  res.json({ urls });
});
app2.post("/upload/banner", async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: "No file uploaded" });
  const fullPath = join4(UPLOADS_BANNERS_DIR, file.filename);
  const name = existsSync5(fullPath) ? await compressNewUploadToWebP(fullPath) : file.filename;
  const base = UPLOAD_BASE;
  const relativePath = `/uploads/banners/${name}`;
  const fullUrl = `${base}${relativePath}`;
  console.log("[Upload/banner] Saved:", name, "(WebP q75)");
  res.json({ urls: [fullUrl], relativePath });
});
async function resolveCatalogTenantId(param) {
  const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(param);
  if (uuidLike) return param;
  const tenant = (await repos.tenants.findAll()).find((t) => t.slug === param);
  return tenant?.id ?? param;
}
app2.get("/catalog/:tenantId", wrapAsync(async (req, res) => {
  try {
    const tenantId = await resolveCatalogTenantId(req.params.tenantId);
    const catalog = await repos.catalog.getCatalog(tenantId);
    const sortByOrder = (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    const products = [...catalog.products ?? []].sort(sortByOrder);
    const sorted = {
      ...catalog,
      categories: [...catalog.categories ?? []].sort(sortByOrder),
      products
    };
    res.json(sorted);
  } catch (err) {
    console.error("[catalog] getCatalog failed:", err instanceof Error ? err.message : err);
    res.status(200).json({ categories: [], products: [], optionGroups: [], optionItems: [] });
  }
}));
function normalizeProductForCompat(p) {
  const images = p.images ?? [];
  if (images.length > 0) {
    return { ...p, imageUrl: images[0].url };
  }
  return p;
}
app2.post("/bulk-sort", wrapAsync(async (req, res) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  const body = req.body;
  const { entity, tenantId: rawTenantId, items } = body;
  if (!entity || !rawTenantId || !Array.isArray(items)) {
    return res.status(400).json({ error: "entity, tenantId, and items (array of { id, sortOrder }) required" });
  }
  const tenantId = await resolveCatalogTenantId(rawTenantId);
  if (user.role === "TENANT_ADMIN" && user.tenantId !== tenantId) {
    return res.status(403).json({ error: "Forbidden: tenant scope" });
  }
  const catalog = await repos.catalog.getCatalog(tenantId);
  const orderMap = new Map(items.map((i) => [i.id, i.sortOrder]));
  if (entity === "categories") {
    const categories = (catalog.categories ?? []).map((c) => {
      const rec = c;
      const id = rec.id;
      const so = orderMap.get(id);
      return so !== void 0 ? { ...rec, sortOrder: so } : rec;
    });
    await repos.catalog.setCatalog(tenantId, { ...catalog, categories });
  } else if (entity === "products") {
    const products = (catalog.products ?? []).map((p) => {
      const rec = p;
      const id = rec.id;
      const so = orderMap.get(id);
      return so !== void 0 ? { ...rec, sortOrder: so } : rec;
    });
    await repos.catalog.setCatalog(tenantId, { ...catalog, products });
  } else {
    return res.status(400).json({ error: "entity must be categories or products" });
  }
  const updated = await repos.catalog.getCatalog(tenantId);
  res.json(updated);
}));
app2.put("/catalog/:tenantId", wrapAsync(async (req, res) => {
  const tenantId = await resolveCatalogTenantId(req.params.tenantId);
  const catalog = req.body;
  const products = (catalog.products ?? []).map(
    (p) => normalizeProductForCompat(p)
  );
  const optionGroups = (catalog.optionGroups ?? []).map(
    (g) => ({ ...g, tenantId: g.tenantId ?? tenantId })
  );
  const normalized = { ...catalog, products, optionGroups };
  await repos.catalog.setCatalog(tenantId, normalized);
  const updated = await repos.catalog.getCatalog(tenantId);
  res.json(updated);
}));
app2.get("/tenants/:tenantId/option-templates", wrapAsync(async (req, res) => {
  const tenantId = await resolveCatalogTenantId(req.params.tenantId);
  const user = req.user;
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  if (user.role === "TENANT_ADMIN" && user.tenantId !== tenantId) return res.status(403).json({ error: "Forbidden" });
  if (user.role === "MARKET_ADMIN") {
    const tenants = await repos.tenants.findAll();
    const t = tenants.find((x) => x.id === tenantId);
    if (!t || t.marketId !== user.marketId) return res.status(403).json({ error: "Forbidden" });
  }
  const list = getOptionTemplates(tenantId);
  res.json(list);
}));
app2.post("/tenants/:tenantId/option-templates", wrapAsync(async (req, res) => {
  const tenantId = await resolveCatalogTenantId(req.params.tenantId);
  const user = req.user;
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  if (user.role === "TENANT_ADMIN" && user.tenantId !== tenantId) return res.status(403).json({ error: "Forbidden" });
  if (user.role === "MARKET_ADMIN") {
    const tenants = await repos.tenants.findAll();
    const t = tenants.find((x) => x.id === tenantId);
    if (!t || t.marketId !== user.marketId) return res.status(403).json({ error: "Forbidden" });
  }
  const group = req.body;
  if (!group || typeof group !== "object") return res.status(400).json({ error: "Body must be an option group object" });
  addOptionTemplate(tenantId, group);
  const list = getOptionTemplates(tenantId);
  res.status(201).json(list);
}));
async function getMarketTenantIds(marketId) {
  const tenants = await repos.tenants.findAll();
  return new Set(tenants.filter((t) => t.marketId === marketId).map((t) => t.id));
}
app2.get("/orders", wrapAsync(async (req, res) => {
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
app2.get("/tenants/:tenantId/orders", wrapAsync(async (req, res) => {
  const { tenantId } = req.params;
  const from = req.query.from;
  const to = req.query.to;
  const search = (req.query.search || "").trim().toLowerCase();
  const tenant = (await repos.tenants.findAll()).find((t) => t.id === tenantId);
  if (!tenant) return res.status(404).json({ error: "Tenant not found" });
  if (req.user?.role === "TENANT_ADMIN" && req.user.tenantId !== tenantId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  if (req.user?.role === "MARKET_ADMIN" && tenant.marketId !== req.user.marketId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  let orders = (await repos.orders.findAll()).filter((o) => o.tenantId === tenantId);
  if (from || to) {
    const fromMs = from ? new Date(from).setHours(0, 0, 0, 0) : 0;
    const toMs = to ? new Date(to).setHours(23, 59, 59, 999) : Number.MAX_SAFE_INTEGER;
    orders = orders.filter((o) => {
      const t = o.createdAt ? new Date(o.createdAt).getTime() : 0;
      return t >= fromMs && t <= toMs;
    });
  }
  if (search) {
    const searchDigits = search.replace(/\D/g, "");
    orders = orders.filter((o) => {
      const name = (o.customerName ?? "").toLowerCase();
      const phone = (o.customerPhone ?? "").replace(/\D/g, "");
      return name.includes(search) || searchDigits.length >= 4 && phone.includes(searchDigits);
    });
  }
  orders.forEach(enrichOrderWithMerchantAmount);
  const couriers = await repos.couriers.findAll();
  for (const o of orders) {
    await enrichOrderWithCourierInfo(o, couriers);
  }
  res.json(orders);
}));
app2.post("/orders", wrapAsync(async (req, res) => {
  const order = req.body;
  if (req.user?.role === "MARKET_ADMIN" && req.user.marketId) {
    const tenant2 = (await repos.tenants.findAll()).find((t) => t.id === order.tenantId);
    if (!tenant2 || tenant2.marketId !== req.user.marketId) {
      return res.status(403).json({ error: "Forbidden" });
    }
  }
  const tenant = order.tenantId ? (await repos.tenants.findAll()).find((t) => t.id === order.tenantId) : void 0;
  const tenantType = tenant?.tenantType ?? (tenant?.type === "FOOD" ? "RESTAURANT" : "SHOP");
  const deliveryMode = tenant?.deliveryProviderMode ?? "MARKET";
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const created = { ...order, createdAt: order.createdAt ?? now };
  if (tenant != null) created.marketId = tenant.marketId;
  const customer = req.customer;
  if (customer) created.customerId = customer.id;
  if (created.fulfillmentType === "PICKUP" || deliveryMode === "PICKUP_ONLY") {
    created.status = created.status ?? "PREPARING";
    created.deliveryAssignmentMode = void 0;
  } else {
    created.deliveryAssignmentMode = "MARKET";
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
  let orderSubtotal = created.subtotal ?? created.items?.reduce((s, i) => s + (Number(i.totalPrice) || 0), 0) ?? 0;
  const orderDeliveryFee = created.delivery?.fee ?? 0;
  let couponDiscount = 0;
  const orderCouponId = order.couponId;
  const clientCouponDiscount = Number(order.couponDiscountAmount);
  if (orderCouponId) {
    if (clientCouponDiscount > 0) {
      couponDiscount = Math.min(clientCouponDiscount, orderSubtotal + orderDeliveryFee);
    } else {
      const coupon = await prisma2.coupon.findUnique({ where: { id: orderCouponId } });
      if (coupon && !coupon.usedAt && (!coupon.expiresAt || coupon.expiresAt > now)) {
        if (!coupon.tenantId || coupon.tenantId === created.tenantId) {
          const customerPhoneNorm = normalizePhoneForCoupon(created.customerPhone ?? req.customer?.phone);
          if (!coupon.oneTimeUse || !coupon.winnerPhone || normalizePhoneForCoupon(coupon.winnerPhone) === customerPhoneNorm) {
            if (coupon.type === "FIXED") couponDiscount = Math.min(Number(coupon.value), orderSubtotal);
            else if (coupon.type === "PERCENT") couponDiscount = Math.min(orderSubtotal * Number(coupon.value) / 100, orderSubtotal);
          }
        }
      }
    }
  }
  const finalTotal = Math.max(0, orderSubtotal + orderDeliveryFee - couponDiscount);
  created.subtotal = orderSubtotal;
  created.total = finalTotal;
  const payment = await computePaymentForOrder(created, created.tenantId ?? "");
  const method = created.paymentMethod === "CARD" ? "CARD" : "CASH";
  created.payment = { ...payment, method };
  created.merchantAmount = payment.breakdown.itemsTotal;
  created.platformDeliveryFee = payment.breakdown.deliveryFee;
  created.id = created.id ?? crypto.randomUUID?.() ?? `order-${Date.now()}`;
  created.orderType = created.orderType ?? "PRODUCT";
  await repos.orders.addOrderWithPayment(created, {
    method,
    status: payment.status,
    amount: payment.financials.gross,
    currency: payment.currency
  });
  const couponId = order.couponId;
  if (couponId) {
    await prisma2.coupon.updateMany({ where: { id: couponId }, data: { usedAt: now } }).catch(() => {
    });
  }
  if (tenant) {
    notifyMerchantNewOrder(created, tenant);
    const orderTenantId = created.tenantId;
    if (orderTenantId) {
      sendFCMToTenantForNewOrder(orderTenantId, created).catch(
        (e) => console.error("[FCM] sendFCMToTenantForNewOrder error:", e)
      );
    }
  }
  const fulfillmentType = created.fulfillmentType;
  const marketIdForNotify = created.marketId;
  if (fulfillmentType === "DELIVERY" && marketIdForNotify) {
    const couriers = await repos.couriers.findAll();
    emitOrderAvailableForMarket(marketIdForNotify, created.id ?? "", couriers);
  }
  res.status(201).json(created);
}));
app2.get("/orders/:orderId", wrapAsync(async (req, res) => {
  const order = (await repos.orders.findAll()).find((o) => o.id === req.params.orderId);
  if (!order) return res.status(404).json({ error: "Order not found" });
  if (req.user?.role === "MARKET_ADMIN" && req.user.marketId) {
    const tenant = (await repos.tenants.findAll()).find((t) => t.id === order.tenantId);
    if (!tenant || tenant.marketId !== req.user.marketId) {
      return res.status(403).json({ error: "Forbidden" });
    }
  }
  enrichOrderWithMerchantAmount(order);
  res.json(order);
}));
app2.get("/public/orders/:orderId", wrapAsync(async (req, res) => {
  const order = (await repos.orders.findAll()).find((o) => o.id === req.params.orderId);
  if (!order) return res.status(404).json({ error: "Order not found" });
  const tenant = order.tenantId ? (await repos.tenants.findAll()).find((t) => t.id === order.tenantId) : void 0;
  let assignedDriver;
  if (order.courierId) {
    const courier = (await repos.couriers.findAll()).find((c) => c.id === order.courierId);
    if (courier) assignedDriver = { name: courier.name ?? "", phone: courier.phone ?? "" };
  }
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
    deliveryLocation: order.deliveryLocation,
    courierLocation: order.courierLocation,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    notes: order.notes,
    tenantId: order.tenantId,
    tenantSlug: tenant?.slug,
    assignedDriver
  };
  res.json(safe);
}));
var INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET ?? process.env.WA_INTERNAL_SECRET ?? "";
app2.post("/internal/orders/:orderId/status", wrapAsync(async (req, res) => {
  if (INTERNAL_API_SECRET && req.headers["x-internal-secret"] !== INTERNAL_API_SECRET) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const orderId = req.params.orderId;
  const { status } = req.body;
  if (!status || !["CONFIRMED", "READY", "COMPLETED", "DELIVERED"].includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }
  const orders = await repos.orders.findAll();
  const idx = orders.findIndex((o) => o.id === orderId);
  if (idx === -1) return res.status(404).json({ error: "Order not found" });
  const order = orders[idx];
  const updated = { ...orders[idx], status };
  if (status === "DELIVERED" && order.courierId) {
    updated.deliveredAt = (/* @__PURE__ */ new Date()).toISOString();
    const couriers = await repos.couriers.findAll();
    const cIdx = couriers.findIndex((c) => c.id === order.courierId);
    if (cIdx >= 0) {
      couriers[cIdx] = { ...couriers[cIdx], isAvailable: true, deliveryCount: (couriers[cIdx].deliveryCount ?? 0) + 1 };
      await repos.couriers.setAll(couriers);
    }
  }
  orders[idx] = updated;
  await repos.orders.setAll(orders);
  if (["CONFIRMED", "READY", "COMPLETED"].includes(status)) {
    const tenantForNotify = (await repos.tenants.findAll()).find((t) => t.id === order.tenantId);
    triggerStatusNotification(updated, status, tenantForNotify?.name);
    updated.lastStatusNotification = { status, at: (/* @__PURE__ */ new Date()).toISOString() };
    orders[idx] = updated;
    await repos.orders.setAll(orders);
  }
  try {
    const orderWithCustomer = updated;
    let customerPhone = orderWithCustomer.customerPhone;
    if (!customerPhone && orderWithCustomer.customerId) {
      const customers = await repos.customers.findAll();
      const customer = customers.find((c) => c.id === orderWithCustomer.customerId);
      customerPhone = customer?.phone;
    }
    if (customerPhone) notifyCustomerOrderStatusPush(customerPhone, status);
  } catch {
  }
  res.json(orders[idx]);
}));
app2.patch("/orders/:orderId/status", wrapAsync(async (req, res) => {
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
  if (req.user?.role === "TENANT_ADMIN" && req.user.tenantId) {
    if (order.tenantId !== req.user.tenantId) {
      return res.status(403).json({ error: "Forbidden: order does not belong to your store" });
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
  if (["CONFIRMED", "READY", "COMPLETED"].includes(status)) {
    const tenantForNotify = (await repos.tenants.findAll()).find((t) => t.id === order.tenantId);
    triggerStatusNotification(updated, status, tenantForNotify?.name);
    updated.lastStatusNotification = { status, at: (/* @__PURE__ */ new Date()).toISOString() };
    orders[idx] = updated;
    await repos.orders.setAll(orders);
  }
  try {
    const orderWithCustomer = updated;
    let customerPhone = orderWithCustomer.customerPhone;
    const customerId = orderWithCustomer.customerId;
    const customers = await repos.customers.findAll();
    const customer = customerId ? customers.find((c) => c.id === customerId) : void 0;
    if (!customerPhone && customer) customerPhone = customer.phone;
    if (customerPhone) notifyCustomerOrderStatusPush(customerPhone, status);
    if (customerId && orderWithCustomer.id && ["CONFIRMED", "READY", "COMPLETED", "DELIVERED"].includes(status)) {
      const fcmToken = await getCustomerFcmToken(customerId);
      if (fcmToken) sendFCMToCustomerToken(fcmToken, status, orderWithCustomer.id);
    }
    if (customerId && ["COMPLETED", "CANCELLED"].includes(status)) {
      const title = "\u062A\u062D\u062F\u064A\u062B \u062D\u0627\u0644\u0629 \u0637\u0644\u0628\u0643";
      const body = status === "COMPLETED" ? "\u0637\u0644\u0628\u0643 \u062C\u0627\u0647\u0632! \u0627\u0633\u062A\u0645\u062A\u0639 \u0628\u0648\u062C\u0628\u062A\u0643." : "\u0646\u0639\u062A\u0630\u0631\u060C \u062A\u0645 \u0625\u0644\u063A\u0627\u0621 \u0637\u0644\u0628\u0643.";
      await sendFCMNotification(customerId, title, body);
    }
  } catch {
  }
  res.json(orders[idx]);
}));
app2.delete("/orders/:orderId/hard-delete", wrapAsync(async (req, res) => {
  const user = req.user;
  if (!user || user.role !== "SUPER_ADMIN") {
    return res.status(403).json({ error: "Forbidden: SUPER_ADMIN only" });
  }
  const orderId = req.params.orderId;
  if (!orderId) return res.status(400).json({ error: "orderId required" });
  const orders = await repos.orders.findAll();
  const exists = orders.some((o) => o.id === orderId);
  if (!exists) return res.status(404).json({ error: "Order not found" });
  await repos.orders.deleteById(orderId);
  res.status(204).send();
}));
app2.get("/campaigns", async (req, res) => {
  const tenantId = req.query.tenantId;
  let campaigns = getCampaigns();
  if (tenantId) campaigns = campaigns.filter((c) => c.tenantId === tenantId);
  res.json(campaigns);
});
app2.post("/campaigns", async (req, res) => {
  const campaign = req.body;
  const campaigns = getCampaigns();
  campaigns.push(campaign);
  setCampaigns(campaigns);
  res.status(201).json(campaign);
});
app2.put("/campaigns/:id", async (req, res) => {
  const campaigns = getCampaigns();
  const idx = campaigns.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Campaign not found" });
  campaigns[idx] = { ...campaigns[idx], ...req.body };
  setCampaigns(campaigns);
  res.json(campaigns[idx]);
});
app2.delete("/campaigns/:id", async (req, res) => {
  const campaigns = getCampaigns();
  const next = campaigns.filter((c) => c.id !== req.params.id);
  if (next.length === campaigns.length) return res.status(404).json({ error: "Campaign not found" });
  setCampaigns(next);
  res.json({ deleted: true });
});
app2.get("/delivery/:tenantId", wrapAsync(async (req, res) => {
  const settings = await repos.delivery.getSettings(req.params.tenantId);
  res.json(settings);
}));
app2.put("/delivery/:tenantId", wrapAsync(async (req, res) => {
  const tenantId = req.params.tenantId;
  const settings = { ...req.body, tenantId };
  await repos.delivery.setSettings(tenantId, settings);
  res.json(settings);
}));
var DEFAULT_ZONE_CENTER = { lat: 32.08, lng: 34.78 };
var DEFAULT_RADIUS_KM = 2;
function normalizeZoneForResponse(z) {
  return {
    ...z,
    centerLat: z.centerLat ?? DEFAULT_ZONE_CENTER.lat,
    centerLng: z.centerLng ?? DEFAULT_ZONE_CENTER.lng,
    radiusKm: z.radiusKm ?? DEFAULT_RADIUS_KM
  };
}
function sortZones(zones) {
  return [...zones].sort((a, b) => {
    const soA = a.sortOrder ?? 999;
    const soB = b.sortOrder ?? 999;
    if (soA !== soB) return soA - soB;
    return (a.name ?? "").localeCompare(b.name ?? "");
  });
}
app2.get("/tenants/:tenantId/delivery-zones", wrapAsync(async (req, res) => {
  const { tenantId } = req.params;
  const zones = await repos.deliveryZones.getByTenant(tenantId);
  const sorted = sortZones(zones);
  res.json(sorted.map(normalizeZoneForResponse));
}));
function requirePlatformAdminForDelivery(req, res) {
  if (!req.user || !isPlatformAdmin(req.user.role)) {
    res.status(403).json({ error: "Forbidden: only platform admin (ROOT_ADMIN/SUPER_ADMIN) can manage delivery zones" });
    return false;
  }
  return true;
}
app2.post("/tenants/:tenantId/delivery-zones", wrapAsync(async (req, res) => {
  if (!requirePlatformAdminForDelivery(req, res)) return;
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
    sortOrder: body.sortOrder,
    centerLat: body.centerLat,
    centerLng: body.centerLng,
    radiusKm: body.radiusKm
  };
  const zones = await repos.deliveryZones.getByTenant(tenantId);
  zones.push(zone);
  await repos.deliveryZones.setAll(tenantId, zones);
  res.status(201).json(normalizeZoneForResponse(zone));
}));
app2.put("/tenants/:tenantId/delivery-zones/:zoneId", wrapAsync(async (req, res) => {
  if (!requirePlatformAdminForDelivery(req, res)) return;
  const { tenantId, zoneId } = req.params;
  const body = req.body;
  const zones = await repos.deliveryZones.getByTenant(tenantId);
  const idx = zones.findIndex((z) => z.id === zoneId);
  if (idx === -1) return res.status(404).json({ error: "Zone not found" });
  zones[idx] = { ...zones[idx], ...body };
  await repos.deliveryZones.setAll(tenantId, zones);
  res.json(normalizeZoneForResponse(zones[idx]));
}));
app2.patch("/tenants/:tenantId/delivery-zones/:zoneId", wrapAsync(async (req, res) => {
  if (!requirePlatformAdminForDelivery(req, res)) return;
  const { tenantId, zoneId } = req.params;
  const body = req.body;
  const zones = await repos.deliveryZones.getByTenant(tenantId);
  const idx = zones.findIndex((z) => z.id === zoneId);
  if (idx === -1) return res.status(404).json({ error: "Zone not found" });
  zones[idx] = { ...zones[idx], ...body };
  await repos.deliveryZones.setAll(tenantId, zones);
  res.json(normalizeZoneForResponse(zones[idx]));
}));
app2.delete("/tenants/:tenantId/delivery-zones/:zoneId", wrapAsync(async (req, res) => {
  if (!requirePlatformAdminForDelivery(req, res)) return;
  const { tenantId, zoneId } = req.params;
  const zones = await repos.deliveryZones.getByTenant(tenantId);
  const filtered = zones.filter((z) => z.id !== zoneId);
  if (filtered.length === zones.length) return res.status(404).json({ error: "Zone not found" });
  await repos.deliveryZones.setAll(tenantId, filtered);
  res.json({ deleted: true });
}));
app2.post("/markets/:marketId/sync-delivery", wrapAsync(async (req, res) => {
  const { marketId } = req.params;
  const body = req.body;
  const sourceTenantId = typeof body?.sourceTenantId === "string" ? body.sourceTenantId.trim() : void 0;
  if (!sourceTenantId) {
    return res.status(400).json({ error: "sourceTenantId is required", code: "SOURCE_TENANT_REQUIRED" });
  }
  const user = req.user;
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  if (user.role !== "ROOT_ADMIN" && user.role !== "SUPER_ADMIN") {
    if (user.role !== "MARKET_ADMIN" || user.marketId !== marketId) {
      return res.status(403).json({ error: "Forbidden: only platform admin or market admin for this market can sync delivery" });
    }
  }
  const markets = await repos.markets.findAll();
  const market = markets.find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: "Market not found" });
  const tenantIds = await getMarketTenantIds(marketId);
  if (!tenantIds.has(sourceTenantId)) {
    return res.status(400).json({ error: "Source tenant is not in this market", code: "SOURCE_NOT_IN_MARKET" });
  }
  const sourceZones = await repos.deliveryZones.getByTenant(sourceTenantId);
  const templateZones = sourceZones.map((z) => ({
    name: z.name,
    fee: z.fee,
    etaMinutes: z.etaMinutes,
    isActive: z.isActive ?? true,
    sortOrder: z.sortOrder,
    centerLat: z.centerLat,
    centerLng: z.centerLng,
    radiusKm: z.radiusKm
  }));
  const synced = [];
  for (const tid of tenantIds) {
    if (tid === sourceTenantId) continue;
    const newZones = templateZones.map((t, i) => ({
      id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `dz-sync-${tid}-${Date.now()}-${i}`,
      tenantId: tid,
      name: t.name,
      fee: t.fee,
      etaMinutes: t.etaMinutes,
      isActive: t.isActive,
      sortOrder: t.sortOrder,
      centerLat: t.centerLat,
      centerLng: t.centerLng,
      radiusKm: t.radiusKm
    }));
    await repos.deliveryZones.setAll(tid, newZones);
    synced.push(tid);
  }
  res.json({ synced: synced.length, tenantIds: synced });
}));
app2.patch("/tenants/:tenantId/settings/delivery", async (req, res) => {
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
  if (isPlatformAdmin(user?.role) && !requireWriteWithReason(req, res)) return;
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
    reason: isPlatformAdmin(user.role) ? getEmergencyReason(req) : void 0,
    emergencyMode: isPlatformAdmin(user.role),
    before,
    after: tenants[idx]
  });
  res.json(tenants[idx]);
});
app2.post("/tenants/:tenantId/orders/:orderId/ready", async (req, res) => {
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
  if (isPlatformAdmin(user?.role) && !requireWriteWithReason(req, res)) return;
  const orders = await repos.orders.findAll();
  const idx = orders.findIndex((o) => o.id === orderId);
  if (idx === -1) return res.status(404).json({ error: "Order not found" });
  if (orders[idx].tenantId !== tenantId) return res.status(403).json({ error: "Forbidden" });
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const updated = { ...orders[idx], status: "READY", readyAt: now };
  orders[idx] = updated;
  await repos.orders.setAll(orders);
  triggerStatusNotification(updated, "READY", tenant?.name);
  updated.lastStatusNotification = { status: "READY", at: now };
  orders[idx] = updated;
  await repos.orders.setAll(orders);
  try {
    const orderWithCustomer = updated;
    let customerPhone = orderWithCustomer.customerPhone;
    const customers = await repos.customers.findAll();
    const customer = orderWithCustomer.customerId ? customers.find((c) => c.id === orderWithCustomer.customerId) : void 0;
    if (!customerPhone && customer) customerPhone = customer.phone;
    if (customerPhone) notifyCustomerOrderStatusPush(customerPhone, "READY");
    if (orderWithCustomer.customerId && orderWithCustomer.id) {
      const fcmToken = await getCustomerFcmToken(orderWithCustomer.customerId);
      if (fcmToken) sendFCMToCustomerToken(fcmToken, "READY", orderWithCustomer.id);
    }
  } catch {
  }
  const fulfillmentType = updated.fulfillmentType;
  if (fulfillmentType === "DELIVERY") {
    const marketId = tenant.marketId;
    if (marketId) {
      const couriers = await repos.couriers.findAll();
      emitOrderReadyForMarket(marketId, orderId, couriers);
    }
  }
  res.json(orders[idx]);
});
app2.post("/tenants/:tenantId/orders/:orderId/handed-to-driver", wrapAsync(async (req, res) => {
  const { tenantId, orderId } = req.params;
  const user = req.user;
  const tenant = (await repos.tenants.findAll()).find((t) => t.id === tenantId);
  if (!tenant) return res.status(404).json({ error: "Tenant not found" });
  if (user?.role === "TENANT_ADMIN" && user.tenantId !== tenantId) return res.status(403).json({ error: "Forbidden" });
  if (user?.role === "MARKET_ADMIN" && user.marketId !== tenant.marketId) return res.status(403).json({ error: "Forbidden" });
  const orders = await repos.orders.findAll();
  const idx = orders.findIndex((o) => o.id === orderId);
  if (idx === -1) return res.status(404).json({ error: "Order not found" });
  const order = orders[idx];
  if (order.tenantId !== tenantId) return res.status(403).json({ error: "Forbidden" });
  if (!order.courierId) return res.status(400).json({ error: "Order has no driver assigned", code: "BAD_REQUEST" });
  if (order.status !== "READY") return res.status(400).json({ error: "Order must be READY", code: "BAD_REQUEST" });
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const tl = { ...order.deliveryTimeline || {}, handedToDriverAt: order.deliveryTimeline?.handedToDriverAt ?? now };
  orders[idx] = { ...order, deliveryTimeline: tl };
  await repos.orders.setAll(orders);
  res.json(orders[idx]);
}));
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
app2.get("/markets/:marketId/couriers", async (req, res) => {
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
app2.get("/markets/:marketId/couriers/stats", async (req, res) => {
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
app2.get("/markets/:marketId/leaderboard", async (req, res) => {
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
app2.post("/markets/:marketId/couriers", async (req, res) => {
  const { marketId } = req.params;
  const user = req.user;
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: "Market not found" });
  if (user?.role === "TENANT_ADMIN") return res.status(403).json({ error: "Forbidden", code: "SCOPE_VIOLATION" });
  if (user?.role === "MARKET_ADMIN" && user.marketId !== marketId) {
    return res.status(403).json({ error: "Cannot create couriers in another market", code: "CROSS_MARKET_ACCESS" });
  }
  if (isPlatformAdmin(user?.role) && !requireWriteWithReason(req, res)) return;
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
    reason: isPlatformAdmin(user.role) ? getEmergencyReason(req) : void 0,
    emergencyMode: isPlatformAdmin(user.role),
    after: courier
  });
  res.status(201).json(courier);
});
app2.patch("/markets/:marketId/couriers/:courierId", async (req, res) => {
  const { marketId, courierId } = req.params;
  const user = req.user;
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: "Market not found" });
  if (user?.role === "TENANT_ADMIN") return res.status(403).json({ error: "Forbidden", code: "SCOPE_VIOLATION" });
  if (user?.role === "MARKET_ADMIN" && user.marketId !== marketId) {
    return res.status(403).json({ error: "Cannot update couriers in another market", code: "CROSS_MARKET_ACCESS" });
  }
  if (isPlatformAdmin(user?.role) && !requireWriteWithReason(req, res)) return;
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
    reason: isPlatformAdmin(user.role) ? getEmergencyReason(req) : void 0,
    emergencyMode: isPlatformAdmin(user.role),
    before,
    after: couriers[idx]
  });
  res.json(couriers[idx]);
});
app2.delete("/markets/:marketId/couriers/:courierId", async (req, res) => {
  const { marketId, courierId } = req.params;
  const user = req.user;
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: "Market not found" });
  if (user?.role === "TENANT_ADMIN") return res.status(403).json({ error: "Forbidden", code: "SCOPE_VIOLATION" });
  if (user?.role === "MARKET_ADMIN" && user.marketId !== marketId) {
    return res.status(403).json({ error: "Cannot delete couriers in another market", code: "CROSS_MARKET_ACCESS" });
  }
  if (isPlatformAdmin(user?.role) && !requireWriteWithReason(req, res)) return;
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
  const orders = await repos.orders.findAll();
  let ordersChanged = false;
  for (let i = 0; i < orders.length; i++) {
    if (orders[i].courierId === courierId) {
      orders[i] = { ...orders[i], courierId: void 0 };
      ordersChanged = true;
    }
  }
  if (ordersChanged) await repos.orders.setAll(orders);
  const remaining = couriers.filter((_, i) => i !== idx);
  await repos.couriers.setAll(remaining);
  appendAuditEvent({
    userId: user.id,
    role: user.role,
    marketId,
    action: "delete",
    entity: "courier",
    entityId: courierId,
    reason: isPlatformAdmin(user.role) ? getEmergencyReason(req) : "driver deleted and unassigned from orders",
    emergencyMode: isPlatformAdmin(user.role),
    before,
    after: null
  });
  res.json(before);
});
app2.get("/tenants/:tenantId/couriers", async (req, res) => {
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
app2.post("/tenants/:tenantId/couriers", async (req, res) => {
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
  if (isPlatformAdmin(user?.role) && !requireWriteWithReason(req, res)) return;
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
app2.patch("/tenants/:tenantId/couriers/:courierId", async (req, res) => {
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
  if (isPlatformAdmin(user?.role) && !requireWriteWithReason(req, res)) return;
  const couriers = await repos.couriers.findAll();
  const idx = couriers.findIndex((c) => c.id === courierId && c.scopeType === "TENANT" && c.scopeId === tenantId);
  if (idx === -1) return res.status(404).json({ error: "Courier not found" });
  const body = req.body;
  couriers[idx] = { ...couriers[idx], ...body };
  await repos.couriers.setAll(couriers);
  res.json(couriers[idx]);
});
app2.get("/markets/:marketId/orders", wrapAsync(async (req, res) => {
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
  orders.forEach(enrichOrderWithMerchantAmount);
  const couriers = await repos.couriers.findAll();
  for (const o of orders) {
    await enrichOrderWithCourierInfo(o, couriers);
  }
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
function enrichOrderWithMerchantAmount(o) {
  if (o == null) return;
  const rec = o;
  if (rec.merchantAmount != null && rec.platformDeliveryFee != null) return;
  const f = computeOrderFinancials(o);
  if (rec.merchantAmount == null) rec.merchantAmount = f.itemsTotal;
  if (rec.platformDeliveryFee == null) rec.platformDeliveryFee = f.deliveryFee;
}
async function enrichOrderWithCourierInfo(o, couriers) {
  if (o == null) return;
  const courierId = o.courierId;
  if (!courierId) return;
  const courier = couriers.find((c) => c.id === courierId);
  if (courier) o.assignedDriver = { name: courier.name ?? "\u0633\u0627\u0626\u0642", phone: courier.phone };
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
app2.get("/markets/:marketId/finance/summary", wrapAsync(async (req, res) => {
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
app2.get("/tenants/:tenantId/dashboard-stats", wrapAsync(async (req, res) => {
  const { tenantId } = req.params;
  const tenant = (await repos.tenants.findAll()).find((t) => t.id === tenantId);
  if (!tenant) return res.status(404).json({ error: "Tenant not found" });
  if (req.user?.role === "TENANT_ADMIN" && req.user.tenantId !== tenantId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  if (req.user?.role === "MARKET_ADMIN" && tenant.marketId !== req.user.marketId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const allOrders = await repos.orders.findAll();
  const tenantOrders = allOrders.filter((o) => o.tenantId === tenantId);
  const completed = tenantOrders.filter((o) => o.status === "DELIVERED" || o.status === "COMPLETED");
  const nonCancelled = tenantOrders.filter((o) => o.status !== "CANCELLED");
  const now = /* @__PURE__ */ new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().slice(0, 10);
  const todayEnd = todayStart;
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  const ordersToday = ordersInDateRange(completed, todayStart, todayEnd);
  const ordersThisMonth = ordersInDateRange(completed, monthStart, monthEnd);
  const commissionPercent = tenant?.financialConfig?.commissionValue ?? 0;
  function applyCommissionFallback(f, percent) {
    if (f.commission > 0 || f.netToMerchant > 0) return { commission: f.commission, netToMerchant: f.netToMerchant };
    if (f.gross <= 0) return { commission: 0, netToMerchant: 0 };
    const commission = Math.round(f.gross * (percent / 100) * 100) / 100;
    const netToMerchant = Math.round((f.gross - commission) * 100) / 100;
    return { commission, netToMerchant };
  }
  let dailyRevenue = 0;
  let monthlyRevenue = 0;
  let dailyCommission = 0;
  let monthlyCommission = 0;
  let dailyNet = 0;
  let monthlyNet = 0;
  for (const o of ordersToday) {
    const f = computeOrderFinancials(o);
    const commissionOnItems = Math.round(f.itemsTotal * (commissionPercent / 100) * 100) / 100;
    dailyRevenue += f.itemsTotal;
    dailyCommission += commissionOnItems;
    dailyNet += f.itemsTotal - commissionOnItems;
  }
  for (const o of ordersThisMonth) {
    const f = computeOrderFinancials(o);
    const commissionOnItems = Math.round(f.itemsTotal * (commissionPercent / 100) * 100) / 100;
    monthlyRevenue += f.itemsTotal;
    monthlyCommission += commissionOnItems;
    monthlyNet += f.itemsTotal - commissionOnItems;
  }
  let totalSales = 0;
  let totalPlatformFee = 0;
  let totalMerchantBalance = 0;
  for (const o of nonCancelled) {
    const f = computeOrderFinancials(o);
    const commissionOnItems = Math.round(f.itemsTotal * (commissionPercent / 100) * 100) / 100;
    totalSales += f.itemsTotal;
    totalPlatformFee += commissionOnItems;
    totalMerchantBalance += f.itemsTotal - commissionOnItems;
  }
  res.json({
    dailyRevenue,
    monthlyRevenue,
    orderCountToday: ordersToday.length,
    orderCountMonth: ordersThisMonth.length,
    totalSales,
    platformFee: totalPlatformFee,
    merchantBalance: totalMerchantBalance,
    platformCommissionPercent: commissionPercent
  });
}));
app2.get("/markets/:marketId/finance/tenants", wrapAsync(async (req, res) => {
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
app2.get("/markets/:marketId/finance/couriers", wrapAsync(async (req, res) => {
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
app2.get("/markets/:marketId/reports/daily-summary", wrapAsync(async (req, res) => {
  const { marketId } = req.params;
  const from = req.query.from;
  const to = req.query.to;
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: "Market not found" });
  if (req.user?.role === "MARKET_ADMIN" && req.user.marketId !== marketId) return res.status(403).json({ error: "Forbidden" });
  const tenantIds = await getMarketTenantIds(marketId);
  const allOrders = (await repos.orders.findAll()).filter(
    (o) => o.tenantId && tenantIds.has(o.tenantId)
  );
  const orders = ordersInDateRange(allOrders, from, to);
  let totalOrders = orders.length;
  let deliveryOrders = 0;
  let pickupOrders = 0;
  let totalRevenue = 0;
  let totalMerchantSales = 0;
  let totalDeliveryFees = 0;
  let dailyCashFlow = 0;
  for (const o of orders) {
    const f = computeOrderFinancials(o);
    if ((o.fulfillmentType ?? "") === "DELIVERY") deliveryOrders++;
    else pickupOrders++;
    totalRevenue += f.gross;
    totalMerchantSales += f.itemsTotal;
    totalDeliveryFees += f.deliveryFee;
    if (f.isCash) dailyCashFlow += f.gross;
  }
  res.json({
    totalOrders,
    deliveryOrders,
    pickupOrders,
    totalRevenue,
    totalMerchantSales,
    totalDeliveryFees,
    dailyCashFlow
  });
}));
app2.get("/markets/:marketId/reports/merchant-performance", wrapAsync(async (req, res) => {
  const { marketId } = req.params;
  const from = req.query.from;
  const to = req.query.to;
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: "Market not found" });
  if (req.user?.role === "MARKET_ADMIN" && req.user.marketId !== marketId) return res.status(403).json({ error: "Forbidden" });
  const tenantIds = await getMarketTenantIds(marketId);
  const tenants = (await repos.tenants.findAll()).filter((t) => tenantIds.has(t.id));
  const allOrders = (await repos.orders.findAll()).filter(
    (o) => o.tenantId && tenantIds.has(o.tenantId)
  );
  const orders = ordersInDateRange(allOrders, from, to);
  const byTenant = /* @__PURE__ */ new Map();
  for (const t of tenants) {
    byTenant.set(t.id, { orderCount: 0, sales: 0, deliveryFees: 0 });
  }
  for (const o of orders) {
    const f = computeOrderFinancials(o);
    const row = byTenant.get(o.tenantId ?? "");
    if (row) {
      row.orderCount++;
      row.sales += f.itemsTotal;
      row.deliveryFees += f.deliveryFee;
    }
  }
  const result = tenants.map((t) => {
    const row = byTenant.get(t.id) ?? { orderCount: 0, sales: 0, deliveryFees: 0 };
    return {
      tenantId: t.id,
      tenantName: t.name ?? t.id,
      ...row
    };
  });
  res.json(result);
}));
app2.get("/markets/:marketId/reports/driver-leaderboard", wrapAsync(async (req, res) => {
  const { marketId } = req.params;
  const from = req.query.from;
  const to = req.query.to;
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: "Market not found" });
  if (req.user?.role === "MARKET_ADMIN" && req.user.marketId !== marketId) return res.status(403).json({ error: "Forbidden" });
  const tenantIds = await getMarketTenantIds(marketId);
  const allOrders = (await repos.orders.findAll()).filter(
    (o) => o.tenantId && tenantIds.has(o.tenantId) && o.fulfillmentType === "DELIVERY" && (o.status === "DELIVERED" || o.status === "COMPLETED")
  );
  const orders = ordersInDateRange(allOrders, from, to);
  const couriers = (await repos.couriers.findAll()).filter((c) => courierMarketId(c) === marketId);
  const deliveryCountByCourier = /* @__PURE__ */ new Map();
  const totalCashCollectedByCourier = /* @__PURE__ */ new Map();
  for (const o of orders) {
    const cid = o.courierId ?? "";
    if (cid) {
      deliveryCountByCourier.set(cid, (deliveryCountByCourier.get(cid) ?? 0) + 1);
      const f = computeOrderFinancials(o);
      if (f.isCash) {
        totalCashCollectedByCourier.set(cid, (totalCashCollectedByCourier.get(cid) ?? 0) + f.gross);
      }
    }
  }
  const rows = couriers.map((c) => ({
    courierId: c.id,
    courierName: c.name ?? c.id,
    phone: c.phone,
    deliveryCount: deliveryCountByCourier.get(c.id) ?? 0,
    initialFloat: c.initialFloat ?? 300,
    totalCashCollected: totalCashCollectedByCourier.get(c.id) ?? 0
  }));
  rows.sort((a, b) => b.deliveryCount - a.deliveryCount);
  const ranked = rows.map((r, i) => ({ ...r, rank: i + 1 }));
  res.json(ranked);
}));
app2.get("/markets/:marketId/reports/settlement-log", wrapAsync(async (req, res) => {
  const { marketId } = req.params;
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: "Market not found" });
  if (req.user?.role === "MARKET_ADMIN" && req.user.marketId !== marketId) return res.status(403).json({ error: "Forbidden" });
  const couriers = (await repos.couriers.findAll()).filter((c) => courierMarketId(c) === marketId);
  const courierIds = new Set(couriers.map((c) => c.id));
  const allLogs = getSettlementLogs();
  const marketLogs = allLogs.filter(
    (e) => e.courierId && courierIds.has(e.courierId) && (e.marketId === marketId || !e.marketId)
  );
  marketLogs.sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
  const withNames = marketLogs.map((e) => {
    const c = couriers.find((x) => x.id === e.courierId);
    return { ...e, courierName: c?.name ?? e.courierId };
  });
  res.json(withNames);
}));
app2.post("/admin/couriers/:id/settle", wrapAsync(async (req, res) => {
  const courierId = req.params.id;
  const user = req.user;
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  if (user.role !== "MARKET_ADMIN" && !isPlatformAdmin(user.role)) return res.status(403).json({ error: "Forbidden" });
  const couriers = await repos.couriers.findAll();
  const courier = couriers.find((c) => c.id === courierId);
  if (!courier) return res.status(404).json({ error: "Courier not found" });
  const cMarketId = courierMarketId(courier);
  if (user.role === "MARKET_ADMIN" && user.marketId !== cMarketId) return res.status(403).json({ error: "Forbidden" });
  const body = req.body;
  const totalCollected = typeof body.totalCollected === "number" ? body.totalCollected : 0;
  const entry = {
    id: `settle-${Date.now()}-${courierId}`,
    courierId,
    adminId: user.id,
    totalCollected,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    marketId: cMarketId
  };
  appendSettlementLog(entry);
  res.status(201).json(entry);
}));
app2.post("/markets/:marketId/orders/:orderId/assign-courier", async (req, res) => {
  const { marketId, orderId } = req.params;
  const user = req.user;
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: "Market not found" });
  if (user?.role === "MARKET_ADMIN" && user.marketId !== marketId) {
    return res.status(403).json({ error: "Cannot assign couriers in another market", code: "CROSS_MARKET_ACCESS" });
  }
  if (isPlatformAdmin(user?.role) && !requireWriteWithReason(req, res)) return;
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
  const isDelivery = order.fulfillmentType === "DELIVERY";
  const assignmentMode = order.deliveryAssignmentMode ?? (isDelivery ? "MARKET" : void 0);
  if (assignmentMode !== "MARKET") {
    return res.status(400).json({ error: "Order must be a delivery order with market dispatch (deliveryAssignmentMode MARKET)" });
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
  const platformAdmin = isPlatformAdmin(user?.role);
  if (!platformAdmin) {
    if (!courier.isActive || !courier.isOnline) {
      return res.status(400).json({ error: "Courier must be active and online" });
    }
    if (courier.isAvailable === false) {
      return res.status(400).json({ error: "Courier is busy with another delivery" });
    }
  }
  const before = { ...order };
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const timeline = order.deliveryTimeline ?? {};
  const assignedAt = timeline.assignedAt ?? now;
  orders[idx] = {
    ...order,
    courierId,
    deliveryStatus: "ASSIGNED",
    deliveryAssignmentMode: "MARKET",
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
app2.post("/markets/:marketId/orders/:orderId/contact", async (req, res) => {
  const { marketId, orderId } = req.params;
  const user = req.user;
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: "Market not found" });
  if (user?.role === "TENANT_ADMIN") return res.status(403).json({ error: "Forbidden", code: "SCOPE_VIOLATION" });
  if (user?.role === "MARKET_ADMIN" && user.marketId !== marketId) {
    return res.status(403).json({ error: "Order not in this market", code: "CROSS_MARKET_ACCESS" });
  }
  if (isPlatformAdmin(user?.role) && !requireWriteWithReason(req, res)) return;
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
app2.delete("/markets/:marketId/orders/:orderId/assign-courier", async (req, res) => {
  const { marketId, orderId } = req.params;
  const user = req.user;
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: "Market not found" });
  if (user?.role === "MARKET_ADMIN" && user.marketId !== marketId) {
    return res.status(403).json({ error: "Cannot unassign in another market", code: "CROSS_MARKET_ACCESS" });
  }
  if (isPlatformAdmin(user?.role) && !requireWriteWithReason(req, res)) return;
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
app2.get("/markets/:marketId/dispatch/queue", async (req, res) => {
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
app2.get("/markets/:marketId/delivery-jobs", async (req, res) => {
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
app2.post("/markets/:marketId/delivery-jobs", async (req, res) => {
  const { marketId } = req.params;
  const user = req.user;
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: "Market not found" });
  if (user?.role === "TENANT_ADMIN") return res.status(403).json({ error: "Forbidden" });
  if (user?.role === "MARKET_ADMIN" && user.marketId !== marketId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  if (isPlatformAdmin(user?.role) && !requireWriteWithReason(req, res)) return;
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
app2.patch("/markets/:marketId/delivery-jobs/:jobId/assign", async (req, res) => {
  const { marketId, jobId } = req.params;
  const user = req.user;
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: "Market not found" });
  if (user?.role === "TENANT_ADMIN") return res.status(403).json({ error: "Forbidden" });
  if (user?.role === "MARKET_ADMIN" && user.marketId !== marketId) {
    return res.status(403).json({ error: "Cannot assign couriers in another market", code: "CROSS_MARKET_ACCESS" });
  }
  if (isPlatformAdmin(user?.role) && !requireWriteWithReason(req, res)) return;
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
app2.get("/templates", async (_req, res) => {
  res.json(getTemplates());
});
app2.get("/staff", async (req, res) => {
  const tenantId = req.query.tenantId;
  let staff = getStaff();
  if (tenantId) staff = staff.filter((s) => s.tenantId === tenantId);
  res.json(staff);
});
app2.post("/staff", async (req, res) => {
  const user = req.body;
  const staff = getStaff();
  staff.push(user);
  setStaff(staff);
  res.status(201).json(user);
});
app2.get("/", (_req, res) => {
  res.json({ name: "nmd-mock-api", login: "POST /auth/login", rootAdmin: "root@nmd.com (email+password or phone=999 code=1234)" });
});
app2.get("/health", async (_req, res) => {
  res.json({ ok: true });
});
app2.get("/data", async (_req, res) => {
  const tenants = await repos.tenants.findAll();
  const names = tenants.map((t) => t.name ?? "");
  const hasShaghafInTenants = names.some((n) => n.includes("\u0634\u063A\u0641"));
  const fullData = getData();
  const hasShaghafAnywhere = JSON.stringify(fullData).includes("\u0634\u063A\u0641");
  res.json({
    tenantCount: tenants.length,
    hasShaghaf: hasShaghafInTenants,
    hasShaghafAnywhereInData: hasShaghafAnywhere,
    sampleTenantNames: names.slice(0, 10)
  });
});
app2.use((err, _req, res, _next) => {
  console.error(err);
  const status = err.status ?? 500;
  const body = {
    error: err.message || "Internal server error"
  };
  if (err.code) body.code = err.code;
  if (process.env.NODE_ENV !== "production") body.details = err.stack;
  res.status(status).json(body);
});
async function seedDbFromJsonIfEmpty() {
  if ((process.env.STORAGE_DRIVER ?? "").toLowerCase() !== "db") return;
  const markets = await repos.markets.findAll();
  if (markets.length > 0) {
    if (process.env.NODE_ENV !== "production") {
      console.log("[seed] DB already has", markets.length, "market(s) \u2014 skip seed (tenant/market changes are preserved)");
    }
    return;
  }
  const candidates = [
    process.env.SEED_JSON_PATH,
    process.env.DATA_FILE,
    "/data/data.json",
    join4(process.cwd(), "data", "data.json"),
    join4(process.cwd(), "data.json")
  ].filter(Boolean);
  const seedPath = candidates.find((p) => existsSync5(p)) ?? candidates[0] ?? join4(process.cwd(), "data", "data.json");
  const data = loadFromPath(seedPath);
  if (!data) {
    console.log("[seed] No JSON file at", seedPath, "- starting with empty DB");
    return;
  }
  console.log("[seed] Seeding DB from", seedPath);
  if (data.markets.length > 0) await repos.markets.setAll(data.markets);
  if (data.tenants.length > 0) await repos.tenants.setAll(data.tenants);
  if (data.users.length > 0) await repos.users.setAll(data.users);
  for (const [tenantId, catalog] of Object.entries(data.catalog ?? {})) {
    if (tenantId && (catalog.categories?.length > 0 || catalog.products?.length > 0 || catalog.optionGroups?.length > 0)) {
      await repos.catalog.setCatalog(tenantId, catalog);
    }
  }
  for (const [tenantId, settings] of Object.entries(data.delivery ?? {})) {
    if (tenantId && settings && typeof settings === "object") {
      await repos.delivery.setSettings(tenantId, settings);
    }
  }
  for (const [tenantId, zones] of Object.entries(data.deliveryZones ?? {})) {
    if (tenantId && Array.isArray(zones)) {
      await repos.deliveryZones.setAll(tenantId, zones);
    }
  }
  if ((data.couriers ?? []).length > 0) await repos.couriers.setAll(data.couriers);
  if ((data.customers ?? []).length > 0) await repos.customers.setAll(data.customers);
  console.log("[seed] Done: markets=", data.markets.length, "tenants=", data.tenants.length, "catalog tenants=", Object.keys(data.catalog ?? {}).length);
}
var DATA_FILE_PATH = process.env.DATA_FILE || join4(process.cwd(), "data.json");
(async () => {
  await seedDbFromJsonIfEmpty();
  const storageDriver = (process.env.STORAGE_DRIVER ?? "").toLowerCase();
  if (storageDriver === "json" && existsSync5(DATA_FILE_PATH)) {
    const existing = getData();
    if (existing.users.length > 0 || existing.tenants.length > 0) {
      console.log("[seed] DATA_FILE has existing users/tenants \u2014 skip JSON seeds (zero data loss on restart/build)");
    } else {
      console.log("[seed] DATA_FILE exists \u2014 skip JSON seeds to avoid overwriting mounted volume");
    }
  } else {
    await seedUsersIfNeeded();
    await seedMarketsIfNeeded();
    await seedTenantMarketIdsIfNeeded();
    await seedOrdersIfNeeded();
    await seedDeliveryZonesIfNeeded();
  }
  if (storageDriver !== "db") {
    invalidateDataCache();
  }
  app2.listen(PORT, "0.0.0.0", () => {
    console.log(`Mock API server running at http://0.0.0.0:${PORT} (STORAGE_DRIVER=${process.env.STORAGE_DRIVER ?? "json"})`);
    if (storageDriver === "json") {
      console.log(`DATA_FILE=${DATA_FILE_PATH} \u2014 ensure process has write permission so admin email and other updates persist.`);
    }
  });
})();
export {
  emitCourierAssigned,
  emitCourierUnassigned,
  emitOrderAvailableForMarket,
  emitOrderReadyForMarket
};
//# sourceMappingURL=index.js.map