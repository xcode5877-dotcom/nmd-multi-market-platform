// src/index.ts
import express from "express";
import cors from "cors";
import multer from "multer";
import jwt from "jsonwebtoken";
import { join as join2 } from "path";
import { existsSync as existsSync2, mkdirSync as mkdirSync2 } from "fs";

// src/store.ts
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from "fs";
import { join } from "path";
var DATA_FILE = join(process.cwd(), "data.json");
var ORDERS_DIR = join(process.cwd(), "..", "..", "packages", "mock", "data");
var ORDERS_FILE = join(ORDERS_DIR, "orders.json");
var ORDERS_TMP = join(ORDERS_DIR, "orders.tmp.json");
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
  deliveryJobs: [],
  templates: [],
  staff: []
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
  if (!tenant.financialConfig) {
    tenant.financialConfig = {
      commissionType: "PERCENTAGE",
      commissionValue: 10,
      deliveryFeeModel: "TENANT"
    };
  }
  return tenant;
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
      const markets = parsed.markets ?? [];
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
        deliveryJobs: parsed.deliveryJobs ?? [],
        templates: parsed.templates ?? [],
        staff: parsed.staff ?? []
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
function getDeliveryJobs() {
  return getData().deliveryJobs ?? [];
}
function setDeliveryJobs(jobs) {
  getData().deliveryJobs = jobs;
  persist();
}

// src/delivery-engine.ts
var NEAR_READY_WINDOW_MINUTES = 10;
var FALLBACK_SHOP_SERVICE_MINUTES = 5;
var FALLBACK_RESTAURANT_READY_MINUTES = 5;
var FALLBACK_RESTAURANT_NEAR_READY_MINUTES = 7;
function getTenant(tenantId) {
  return getTenants().find((t) => t.id === tenantId);
}
function isOrderEligibleForMarketDispatch(order) {
  const tenant = order.tenantId ? getTenant(order.tenantId) : void 0;
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
function evaluateFallback(marketId) {
  const tenants = getTenants().filter((t) => t.marketId === marketId);
  const tenantIds = new Set(tenants.map((t) => t.id));
  const orders = getOrders();
  const now = Date.now();
  let changed = false;
  const updated = orders.map((o) => {
    if (!o.tenantId || !tenantIds.has(o.tenantId)) return o;
    if (o.deliveryAssignmentMode === "MARKET" || o.fallbackTriggeredAt) return o;
    if (o.fulfillmentType === "PICKUP") return o;
    const tenant = getTenant(o.tenantId);
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
  if (changed) setOrders(updated);
}
function getDispatchQueue(marketId) {
  evaluateFallback(marketId);
  const tenants = getTenants().filter((t) => t.marketId === marketId);
  const tenantIds = new Set(tenants.map((t) => t.id));
  const orders = getOrders();
  const jobs = getDeliveryJobs();
  const activeJobOrderIds = new Set(
    jobs.filter((j) => !["CANCELED", "DONE"].includes(j.status)).flatMap((j) => j.items.map((i) => i.orderId))
  );
  return orders.filter((o) => o.tenantId && tenantIds.has(o.tenantId)).filter((o) => isOrderEligibleForMarketDispatch(o)).filter((o) => !o.courierId).filter((o) => !activeJobOrderIds.has(o.id ?? "")).sort((a, b) => {
    const aReady = a.readyAt ? new Date(a.readyAt).getTime() : 0;
    const bReady = b.readyAt ? new Date(b.readyAt).getTime() : 0;
    if (aReady && bReady) return aReady - bReady;
    return (a.createdAt ?? "").localeCompare(b.createdAt ?? "");
  });
}

// src/index.ts
var PORT = Number(process.env.PORT ?? 5190);
var JWT_SECRET = process.env.JWT_SECRET ?? "nmd-dev-secret-change-in-production";
var app = express();
var DABBURIYYA_MARKET_ID = "market-dabburiyya";
var IKSAL_MARKET_ID = "market-iksal";
var ROOT_ADMIN_ID = "user-root-admin";
var BUFFALO28_TENANT_ID = "78463821-ccb7-48af-841b-84a18c42abb6";
var OBR_TENANT_ID = "3f801fb9-f6f9-4e81-b3a2-f8954498cdac";
var TOP_MARKET_TENANT_ID = "60904bcc-970a-45e3-8669-8015ee2afe64";
function seedUsersIfNeeded() {
  const users = getUsers();
  const seeds = [
    { id: ROOT_ADMIN_ID, email: "root@nmd.com", role: "ROOT_ADMIN", password: "123456" },
    { id: "user-dab-admin", email: "dab@nmd.com", role: "MARKET_ADMIN", marketId: DABBURIYYA_MARKET_ID, password: "123456" },
    { id: "user-iks-admin", email: "iks@nmd.com", role: "MARKET_ADMIN", marketId: IKSAL_MARKET_ID, password: "123456" },
    { id: "user-buffalo-admin", email: "buffalo@nmd.com", role: "TENANT_ADMIN", tenantId: BUFFALO28_TENANT_ID, password: "123456" },
    { id: "user-tenant-ms-brands", email: "ms-brands@nmd.com", role: "TENANT_ADMIN", tenantId: "5b35539f-90e1-49cc-8c32-8d26cdce20f2", password: "ms-brands@2026" },
    { id: "user-tenant-obr", email: "obr@nmd.com", role: "TENANT_ADMIN", tenantId: OBR_TENANT_ID, password: "obr@2026" },
    { id: "user-tenant-top-market", email: "top-market@nmd.com", role: "TENANT_ADMIN", tenantId: TOP_MARKET_TENANT_ID, password: "top-market@2026" },
    { id: "user-courier-dab-1", email: "ahmed@courier.nmd.com", role: "COURIER", marketId: DABBURIYYA_MARKET_ID, courierId: "courier-50971b77-4811-49e8-825b-78bd84041782", password: "123456" },
    { id: "user-courier-iksal-1", email: "courier@iksal.nmd.com", role: "COURIER", marketId: IKSAL_MARKET_ID, courierId: "courier-iksal-001", password: "123456" }
  ];
  if (users.length === 0) {
    setUsers(seeds);
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
  if (changed) setUsers(next);
}
function seedMarketsIfNeeded() {
  const markets = getMarkets();
  if (markets.length > 0) return;
  const newMarkets = [
    { id: DABBURIYYA_MARKET_ID, name: "\u0633\u0648\u0642 \u062F\u0628\u0648\u0631\u064A\u0629 \u0627\u0644\u0631\u0642\u0645\u064A", slug: "dabburiyya", isActive: true, sortOrder: 0 },
    { id: IKSAL_MARKET_ID, name: "\u0633\u0648\u0642 \u0625\u0643\u0633\u0627\u0644 \u0627\u0644\u0631\u0642\u0645\u064A", slug: "iksal", isActive: true, sortOrder: 1 }
  ];
  setMarkets(newMarkets);
}
function seedTenantMarketIdsIfNeeded() {
  const dabburiyya = getMarkets().find((m) => m.slug === "dabburiyya");
  if (!dabburiyya) return;
  const tenants = getTenants();
  let changed = false;
  for (const t of tenants) {
    if (!t.marketId) {
      t.marketId = dabburiyya.id;
      t.isListedInMarket = true;
      changed = true;
    }
  }
  if (changed) setTenants(tenants);
}
function seedOrdersIfNeeded() {
  const orders = getOrders();
  if (orders.length > 0) return;
  const msBrands = getTenants().find((t) => t.slug === "ms-brands");
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
  setOrders([seed]);
}
function seedDeliveryZonesIfNeeded() {
  const tenants = getTenants();
  for (const t of tenants) {
    const existing = getDeliveryZones(t.id);
    if (existing.length > 0) continue;
    const slug = t.slug ?? "";
    let zones = [];
    if (slug === "buffalo-28" || slug === "pizza") {
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
    setDeliveryZones(t.id, zones);
  }
}
var UPLOADS_DIR = join2(process.cwd(), "..", "..", "packages", "mock", "uploads");
if (!existsSync2(UPLOADS_DIR)) mkdirSync2(UPLOADS_DIR, { recursive: true });
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
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use("/uploads", express.static(UPLOADS_DIR));
var PUBLIC_ROUTES = [
  { method: "POST", path: /^\/auth\/login$/ },
  { method: "GET", path: /^\/health$/ },
  { method: "GET", path: /^\/storefront\/tenants$/ },
  { method: "GET", path: /^\/markets$/ },
  { method: "GET", path: /^\/markets\/by-slug\/[^/]+$/ },
  { method: "GET", path: /^\/markets\/[^/]+\/tenants$/ },
  { method: "GET", path: /^\/tenants\/by-slug\/[^/]+$/ },
  { method: "GET", path: /^\/tenants\/by-id\/[^/]+$/ },
  { method: "GET", path: /^\/catalog\/[^/]+$/ },
  { method: "POST", path: /^\/orders$/ },
  { method: "GET", path: /^\/campaigns$/ },
  { method: "GET", path: /^\/delivery\/[^/]+$/ },
  { method: "GET", path: /^\/tenants\/[^/]+\/delivery-zones$/ },
  { method: "GET", path: /^\/public\/orders\/[^/]+$/ }
];
function isPublicRoute(method, path) {
  return PUBLIC_ROUTES.some((r) => r.method === method && r.path.test(path));
}
app.use((req, _res, next) => {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = getUsers().find((u) => u.id === decoded.sub);
      if (user) req.user = { ...user, password: void 0 };
    } catch {
      req.user = void 0;
    }
  } else {
    req.user = void 0;
  }
  req.emergencyMode = String(req.headers["x-emergency-mode"] ?? "").toLowerCase() === "true";
  req.emergencyReason = req.body?._meta?.emergencyReason ?? "";
  next();
});
app.use((req, res, next) => {
  if (req.method !== "GET" || req.path !== "/courier/events") return next();
  if (req.user) return next();
  const token = req.query.token;
  if (!token) return next();
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = getUsers().find((u) => u.id === decoded.sub);
    if (user) req.user = { ...user, password: void 0 };
  } catch {
  }
  next();
});
app.use((req, res, next) => {
  if (req.path.startsWith("/uploads")) return next();
  if (isPublicRoute(req.method, req.path)) return next();
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  next();
});
app.post("/auth/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "email and password required" });
  const users = getUsers();
  const user = users.find((u) => u.email?.toLowerCase() === String(email).trim().toLowerCase());
  if (!user || user.password !== password) {
    return res.status(401).json({ error: "Invalid email or password" });
  }
  const token = jwt.sign(
    { sub: user.id },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
  res.json({ accessToken: token });
});
app.get("/auth/me", (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  const u = req.user;
  res.json({
    id: u.id,
    email: u.email,
    role: u.role,
    marketId: u.marketId,
    tenantId: u.tenantId,
    courierId: u.courierId
  });
});
function requireCourier(req, res) {
  const user = req.user;
  if (!user || user.role !== "COURIER" || !user.courierId || !user.marketId) {
    res.status(403).json({ error: "Courier access required" });
    return null;
  }
  return { courierId: user.courierId, marketId: user.marketId };
}
app.get("/courier/me", (req, res) => {
  const scope = requireCourier(req, res);
  if (!scope) return;
  const courier = getCouriers().find((c) => c.id === scope.courierId);
  const market = getMarkets().find((m) => m.id === scope.marketId);
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
app.get("/courier/orders", (req, res) => {
  const scope = requireCourier(req, res);
  if (!scope) return;
  const orders = getOrders().filter((o) => o.fulfillmentType === "DELIVERY" && o.courierId === scope.courierId && o.status !== "CANCELED");
  const tenants = getTenants();
  const enriched = orders.map((o) => {
    const t = o.tenantId ? tenants.find((x) => x.id === o.tenantId) : void 0;
    const tenant = t ? { name: t.name ?? "", phone: t.whatsappPhone, address: t.addressLine, location: t.location } : { name: "", phone: void 0, address: void 0, location: void 0 };
    const customer = { name: o.customerName ?? "", phone: o.customerPhone ?? "", deliveryAddress: o.deliveryAddress ?? "", deliveryLocation: o.deliveryLocation };
    const currency = o.currency ?? "ILS";
    const orderTotal = o.payment?.financials?.gross ?? (Number(o.total) || 0);
    const paymentMethod = o.payment?.method ?? (o.paymentMethod === "CARD" ? "CARD" : "CASH");
    const amountToCollect = paymentMethod === "CASH" ? orderTotal : 0;
    return { ...o, tenant, customer, currency, orderTotal, paymentMethod, amountToCollect, cashChangeFor: o.cashChangeFor };
  });
  res.json(enriched);
});
app.get("/courier/stats", (req, res) => {
  const scope = requireCourier(req, res);
  if (!scope) return;
  const metrics = computeCourierMetrics(scope.marketId, scope.courierId);
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
function computePaymentForOrder(order, tenantId) {
  const itemsTotal = order.subtotal ?? (order.items ?? []).reduce((s, i) => s + (Number(i.totalPrice) || 0), 0);
  const deliveryFee = order.delivery?.fee ?? getDelivery()[tenantId]?.deliveryFee ?? 0;
  const gross = Number(order.total) || itemsTotal + deliveryFee;
  const tenant = getTenants().find((t) => t.id === tenantId);
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
app.post("/courier/orders/:orderId/status", (req, res) => {
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
  const orders = getOrders();
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
    const couriers = getCouriers();
    const cIdx = couriers.findIndex((c) => c.id === scope.courierId);
    if (cIdx >= 0) {
      couriers[cIdx] = { ...couriers[cIdx], isAvailable: true, deliveryCount: (couriers[cIdx].deliveryCount ?? 0) + 1 };
      setCouriers(couriers);
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
  setOrders(orders);
  res.json(orders[idx]);
});
var courierEventListeners = /* @__PURE__ */ new Map();
app.get("/courier/events", (req, res) => {
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
app.post("/auth/change-password", (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "currentPassword and newPassword required" });
  }
  const users = getUsers();
  const user = users.find((u) => u.id === req.user.id);
  if (!user) return res.status(401).json({ error: "User not found" });
  if (user.password !== currentPassword) {
    return res.status(400).json({ error: "Current password is incorrect" });
  }
  const updated = users.map(
    (u) => u.id === req.user.id ? { ...u, password: newPassword } : u
  );
  setUsers(updated);
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
app.get("/audit-events", (req, res) => {
  if (req.user?.role !== "ROOT_ADMIN") return res.status(403).json({ error: "Forbidden" });
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const events = getAuditEvents().slice(-limit).reverse();
  res.json(events);
});
app.get("/monitoring/stats", (req, res) => {
  if (req.user?.role !== "ROOT_ADMIN") return res.status(403).json({ error: "Forbidden" });
  const markets = getMarkets();
  const tenants = getTenants();
  const orders = getOrders();
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
app.get("/users", (req, res) => {
  if (req.user?.role !== "ROOT_ADMIN") return res.status(403).json({ error: "Forbidden" });
  const users = getUsers().map((u) => ({ ...u, password: void 0 }));
  res.json(users);
});
app.get("/markets", (req, res) => {
  const user = req.user;
  let markets = getMarkets();
  if (user?.role === "MARKET_ADMIN" && user.marketId) {
    markets = markets.filter((m) => m.id === user.marketId);
  } else {
    const all = req.query.all === "true";
    if (!all) markets = markets.filter((m) => m.isActive);
  }
  res.json([...markets].sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999)));
});
app.post("/markets", (req, res) => {
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
  const markets = getMarkets();
  markets.push(market);
  setMarkets(markets);
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
  res.status(201).json(market);
});
app.put("/markets/:id", (req, res) => {
  if (req.user?.role !== "ROOT_ADMIN") return res.status(403).json({ error: "Forbidden" });
  if (!requireWriteWithReason(req, res)) return;
  const { id } = req.params;
  const body = req.body;
  const markets = getMarkets();
  const idx = markets.findIndex((m) => m.id === id);
  if (idx === -1) return res.status(404).json({ error: "Market not found" });
  const before = markets[idx];
  markets[idx] = { ...markets[idx], ...body };
  setMarkets(markets);
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
app.get("/markets/by-slug/:slug", (req, res) => {
  const market = getMarkets().find((m) => m.slug === req.params.slug);
  if (!market) return res.status(404).json({ error: "Market not found" });
  if (!market.isActive) return res.status(404).json({ error: "Market not found" });
  res.json(market);
});
app.get("/markets/:id", (req, res) => {
  const market = getMarkets().find((m) => m.id === req.params.id);
  if (!market) return res.status(404).json({ error: "Market not found" });
  if (req.user?.role === "MARKET_ADMIN" && req.user.marketId !== market.id) {
    return res.status(403).json({ error: "Forbidden" });
  }
  res.json(market);
});
app.get("/markets/:marketId/admins", (req, res) => {
  if (req.user?.role !== "ROOT_ADMIN") return res.status(403).json({ error: "Forbidden" });
  const { marketId } = req.params;
  const market = getMarkets().find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: "Market not found" });
  const admins = getUsers().filter((u) => u.role === "MARKET_ADMIN" && u.marketId === marketId);
  res.json(admins);
});
app.post("/markets/:marketId/admins", (req, res) => {
  if (req.user?.role !== "ROOT_ADMIN") return res.status(403).json({ error: "Forbidden" });
  if (!requireWriteWithReason(req, res)) return;
  const { marketId } = req.params;
  const { email } = req.body;
  if (!email || typeof email !== "string" || !email.trim()) {
    return res.status(400).json({ error: "email is required" });
  }
  const market = getMarkets().find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: "Market not found" });
  const users = getUsers();
  const existing = users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
  if (existing) return res.status(409).json({ error: "User with this email already exists" });
  const id = `user-${crypto.randomUUID?.() ?? Date.now()}`;
  const newUser = {
    id,
    email: email.trim().toLowerCase(),
    role: "MARKET_ADMIN",
    marketId
  };
  users.push(newUser);
  setUsers(users);
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
app.get("/markets/:marketId/tenants", (req, res) => {
  const { marketId } = req.params;
  const market = getMarkets().find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: "Market not found" });
  if (req.user?.role === "MARKET_ADMIN" && req.user.marketId !== marketId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const tenants = getTenants().filter((t) => t.marketId === marketId && t.enabled && t.isListedInMarket !== false).sort((a, b) => {
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
      branding: { logoUrl: n.logoUrl ?? "", primaryColor: n.primaryColor ?? "#7C3AED" },
      isActive: n.enabled,
      marketCategory: n.marketCategory ?? "GENERAL"
    };
  });
  res.json(tenants);
});
app.post("/markets/:marketId/tenants", (req, res) => {
  const { marketId } = req.params;
  const user = req.user;
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  if (user.role === "ROOT_ADMIN" && !requireWriteWithReason(req, res)) return;
  if (user.role === "MARKET_ADMIN" && user.marketId !== marketId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const market = getMarkets().find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: "Market not found" });
  const input = req.body;
  const id = crypto.randomUUID?.() ?? `t-${Date.now()}`;
  const tenant = {
    ...input,
    id,
    marketId,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    hero: input.hero ?? DEFAULT_HERO2,
    banners: input.banners ?? []
  };
  const tenants = getTenants();
  tenants.push(tenant);
  setTenants(tenants);
  const cat = getCatalog(tenant.id);
  setCatalog(tenant.id, cat);
  const delivery = getDelivery();
  if (!delivery[tenant.id]) {
    delivery[tenant.id] = {
      tenantId: tenant.id,
      modes: { pickup: true, delivery: true },
      deliveryFee: 5,
      zones: []
    };
    setDelivery(delivery);
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
  res.status(201).json(tenant);
});
app.get("/tenants", (req, res) => {
  let tenants = getTenants();
  if (req.user?.role === "MARKET_ADMIN" && req.user.marketId) {
    tenants = tenants.filter((t) => t.marketId === req.user.marketId);
  }
  res.json(tenants.map(normalizeTenantResponse));
});
app.get("/storefront/tenants", (_req, res) => {
  const tenants = getTenants().filter((t) => t.enabled).map((t) => {
    const n = normalizeTenantResponse(t);
    return {
      id: n.id,
      slug: n.slug,
      name: n.name,
      type: n.type === "CLOTHING" || n.type === "FOOD" ? n.type : "GENERAL",
      branding: { logoUrl: n.logoUrl ?? "", primaryColor: n.primaryColor ?? "#7C3AED" },
      isActive: n.enabled,
      marketCategory: n.marketCategory ?? "GENERAL"
    };
  });
  res.json(tenants);
});
app.post("/tenants", (req, res) => {
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
    const market = getMarkets().find((m) => m.id === marketId);
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
  const tenants = getTenants();
  tenants.push(tenant);
  setTenants(tenants);
  const cat = getCatalog(tenant.id);
  setCatalog(tenant.id, cat);
  const delivery = getDelivery();
  if (!delivery[tenant.id]) {
    delivery[tenant.id] = {
      tenantId: tenant.id,
      modes: { pickup: true, delivery: true },
      deliveryFee: 5,
      zones: []
    };
    setDelivery(delivery);
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
function handleTenantUpdate(req, res) {
  const { id } = req.params;
  let updates = req.body;
  const tenants = getTenants();
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
  setTenants(tenants);
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
app.post("/tenants/:id/toggle", (req, res) => {
  const { id } = req.params;
  const user = req.user;
  const tenants = getTenants();
  const idx = tenants.findIndex((t) => t.id === id);
  if (idx === -1) return res.status(404).json({ error: "Tenant not found" });
  const tenant = tenants[idx];
  if (user?.role === "MARKET_ADMIN" && tenant.marketId !== user.marketId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  if (user?.role === "ROOT_ADMIN" && !requireWriteWithReason(req, res)) return;
  const before = { ...tenants[idx] };
  tenants[idx] = { ...tenants[idx], enabled: !tenants[idx].enabled };
  setTenants(tenants);
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
app.get("/tenants/by-id/:id", (req, res) => {
  const tenant = getTenants().find((t) => t.id === req.params.id);
  if (!tenant) return res.status(404).json({ error: "Tenant not found" });
  if (req.user?.role === "TENANT_ADMIN" && req.user.tenantId !== req.params.id) {
    return res.status(403).json({ error: "Forbidden" });
  }
  if (req.user?.role === "MARKET_ADMIN" && tenant.marketId !== req.user.marketId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  res.json(normalizeTenantResponse(tenant));
});
app.get("/tenants/by-slug/:slug", (req, res) => {
  const slug = req.params.slug;
  let tenant = getTenants().find((t) => t.slug === slug);
  if (!tenant && slug === "top-market") {
    tenant = getTenants().find((t) => t.id === TOP_MARKET_TENANT_ID);
  }
  if (!tenant) return res.status(404).json({ error: "Tenant not found" });
  if (req.user?.role === "MARKET_ADMIN" && tenant.marketId !== req.user.marketId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  res.json(normalizeTenantResponse(tenant));
});
app.put("/tenants/:id/branding", (req, res) => {
  const { id } = req.params;
  const user = req.user;
  const tenants = getTenants();
  const t = tenants.find((x) => x.id === id);
  if (!t) return res.status(404).json({ error: "Tenant not found" });
  if (user?.role === "MARKET_ADMIN" && t.marketId !== user.marketId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  if (user?.role === "ROOT_ADMIN" && !requireWriteWithReason(req, res)) return;
  const { logoUrl, hero, banners, whatsappPhone } = req.body;
  const idx = tenants.findIndex((x) => x.id === id);
  if (idx === -1) return res.status(404).json({ error: "Tenant not found" });
  if (logoUrl !== void 0) tenants[idx].logoUrl = logoUrl;
  if (hero !== void 0) tenants[idx].hero = normalizeHero(hero);
  if (banners !== void 0) tenants[idx].banners = banners;
  if (whatsappPhone !== void 0) {
    const cleaned = typeof whatsappPhone === "string" ? whatsappPhone.replace(/\D/g, "") : "";
    tenants[idx].whatsappPhone = cleaned || void 0;
  }
  const before = { ...tenants[idx] };
  setTenants(tenants);
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
app.post("/upload", (req, res, next) => {
  upload.array("files", 20)(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    const files = req.files ?? [];
    const base = `http://localhost:${PORT}`;
    const urls = files.map((f) => `${base}/uploads/${f.filename}`);
    res.json({ urls });
  });
});
app.get("/catalog/:tenantId", (req, res) => {
  const catalog = getCatalog(req.params.tenantId);
  res.json(catalog);
});
function normalizeProductForCompat(p) {
  const images = p.images ?? [];
  if (images.length > 0) {
    return { ...p, imageUrl: images[0].url };
  }
  return p;
}
app.put("/catalog/:tenantId", (req, res) => {
  const catalog = req.body;
  const products = (catalog.products ?? []).map(
    (p) => normalizeProductForCompat(p)
  );
  const normalized = { ...catalog, products };
  setCatalog(req.params.tenantId, normalized);
  res.json(getCatalog(req.params.tenantId));
});
function getMarketTenantIds(marketId) {
  return new Set(getTenants().filter((t) => t.marketId === marketId).map((t) => t.id));
}
app.get("/orders", (req, res) => {
  const tenantId = req.query.tenantId;
  let orders = getOrders();
  if (req.user?.role === "TENANT_ADMIN") {
    const ownTenantId = req.user.tenantId;
    if (!ownTenantId) return res.status(403).json({ error: "Forbidden" });
    if (tenantId && tenantId !== ownTenantId) return res.status(403).json({ error: "Forbidden" });
    orders = orders.filter((o) => o.tenantId === ownTenantId);
  } else if (tenantId) {
    orders = orders.filter((o) => o.tenantId === tenantId);
  }
  if (req.user?.role === "MARKET_ADMIN" && req.user.marketId) {
    const allowed = getMarketTenantIds(req.user.marketId);
    orders = orders.filter((o) => o.tenantId && allowed.has(o.tenantId));
  }
  res.json(orders);
});
app.get("/tenants/:tenantId/orders", (req, res) => {
  const { tenantId } = req.params;
  const tenant = getTenants().find((t) => t.id === tenantId);
  if (!tenant) return res.status(404).json({ error: "Tenant not found" });
  if (req.user?.role === "TENANT_ADMIN" && req.user.tenantId !== tenantId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  if (req.user?.role === "MARKET_ADMIN" && tenant.marketId !== req.user.marketId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const orders = getOrders().filter((o) => o.tenantId === tenantId);
  res.json(orders);
});
app.post("/orders", (req, res) => {
  const order = req.body;
  if (req.user?.role === "MARKET_ADMIN" && req.user.marketId) {
    const tenant2 = getTenants().find((t) => t.id === order.tenantId);
    if (!tenant2 || tenant2.marketId !== req.user.marketId) {
      return res.status(403).json({ error: "Forbidden" });
    }
  }
  const tenant = order.tenantId ? getTenants().find((t) => t.id === order.tenantId) : void 0;
  const tenantType = tenant?.tenantType ?? (tenant?.type === "FOOD" ? "RESTAURANT" : "SHOP");
  const deliveryMode = tenant?.deliveryProviderMode ?? "TENANT";
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const created = { ...order, createdAt: order.createdAt ?? now };
  if (tenant?.marketId) created.marketId = tenant.marketId;
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
  const payment = computePaymentForOrder(created, created.tenantId ?? "");
  created.payment = {
    ...payment,
    method: created.paymentMethod === "CARD" ? "CARD" : "CASH"
  };
  const orders = getOrders();
  orders.push(created);
  setOrders(orders);
  res.status(201).json(created);
});
app.get("/orders/:orderId", (req, res) => {
  const order = getOrders().find((o) => o.id === req.params.orderId);
  if (!order) return res.status(404).json({ error: "Order not found" });
  if (req.user?.role === "MARKET_ADMIN" && req.user.marketId) {
    const tenant = getTenants().find((t) => t.id === order.tenantId);
    if (!tenant || tenant.marketId !== req.user.marketId) {
      return res.status(403).json({ error: "Forbidden" });
    }
  }
  res.json(order);
});
app.get("/public/orders/:orderId", (req, res) => {
  const order = getOrders().find((o) => o.id === req.params.orderId);
  if (!order) return res.status(404).json({ error: "Order not found" });
  const tenant = order.tenantId ? getTenants().find((t) => t.id === order.tenantId) : void 0;
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
});
app.patch("/orders/:orderId/status", (req, res) => {
  const { status } = req.body;
  const orders = getOrders();
  const idx = orders.findIndex((o) => o.id === req.params.orderId);
  if (idx === -1) return res.status(404).json({ error: "Order not found" });
  const order = orders[idx];
  if (req.user?.role === "MARKET_ADMIN" && req.user.marketId) {
    const tenant = getTenants().find((t) => t.id === order.tenantId);
    if (!tenant || tenant.marketId !== req.user.marketId) {
      return res.status(403).json({ error: "Forbidden" });
    }
  }
  const updated = { ...orders[idx], status };
  if (status === "DELIVERED" && order.courierId) {
    updated.deliveredAt = (/* @__PURE__ */ new Date()).toISOString();
    const couriers = getCouriers();
    const cIdx = couriers.findIndex((c) => c.id === order.courierId);
    if (cIdx >= 0) {
      couriers[cIdx] = {
        ...couriers[cIdx],
        isAvailable: true,
        deliveryCount: (couriers[cIdx].deliveryCount ?? 0) + 1
      };
      setCouriers(couriers);
    }
  }
  orders[idx] = updated;
  setOrders(orders);
  res.json(orders[idx]);
});
app.get("/campaigns", (req, res) => {
  const tenantId = req.query.tenantId;
  let campaigns = getCampaigns();
  if (tenantId) campaigns = campaigns.filter((c) => c.tenantId === tenantId);
  res.json(campaigns);
});
app.post("/campaigns", (req, res) => {
  const campaign = req.body;
  const campaigns = getCampaigns();
  campaigns.push(campaign);
  setCampaigns(campaigns);
  res.status(201).json(campaign);
});
app.put("/campaigns/:id", (req, res) => {
  const campaigns = getCampaigns();
  const idx = campaigns.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Campaign not found" });
  campaigns[idx] = { ...campaigns[idx], ...req.body };
  setCampaigns(campaigns);
  res.json(campaigns[idx]);
});
app.delete("/campaigns/:id", (req, res) => {
  const campaigns = getCampaigns();
  const next = campaigns.filter((c) => c.id !== req.params.id);
  if (next.length === campaigns.length) return res.status(404).json({ error: "Campaign not found" });
  setCampaigns(next);
  res.json({ deleted: true });
});
app.get("/delivery/:tenantId", (req, res) => {
  const settings = getDelivery()[req.params.tenantId];
  if (!settings) return res.status(404).json({ error: "Delivery settings not found" });
  res.json(settings);
});
app.put("/delivery/:tenantId", (req, res) => {
  const delivery = getDelivery();
  delivery[req.params.tenantId] = { ...req.body, tenantId: req.params.tenantId };
  setDelivery(delivery);
  res.json(delivery[req.params.tenantId]);
});
function sortZones(zones) {
  return [...zones].sort((a, b) => {
    const soA = a.sortOrder ?? 999;
    const soB = b.sortOrder ?? 999;
    if (soA !== soB) return soA - soB;
    return (a.name ?? "").localeCompare(b.name ?? "");
  });
}
app.get("/tenants/:tenantId/delivery-zones", (req, res) => {
  const zones = getDeliveryZones(req.params.tenantId);
  res.json(sortZones(zones));
});
app.post("/tenants/:tenantId/delivery-zones", (req, res) => {
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
  const zones = getDeliveryZones(tenantId);
  zones.push(zone);
  setDeliveryZones(tenantId, zones);
  res.status(201).json(zone);
});
app.put("/tenants/:tenantId/delivery-zones/:zoneId", (req, res) => {
  const { tenantId, zoneId } = req.params;
  const body = req.body;
  const zones = getDeliveryZones(tenantId);
  const idx = zones.findIndex((z) => z.id === zoneId);
  if (idx === -1) return res.status(404).json({ error: "Zone not found" });
  zones[idx] = { ...zones[idx], ...body };
  setDeliveryZones(tenantId, zones);
  res.json(zones[idx]);
});
app.patch("/tenants/:tenantId/delivery-zones/:zoneId", (req, res) => {
  const { tenantId, zoneId } = req.params;
  const body = req.body;
  const zones = getDeliveryZones(tenantId);
  const idx = zones.findIndex((z) => z.id === zoneId);
  if (idx === -1) return res.status(404).json({ error: "Zone not found" });
  zones[idx] = { ...zones[idx], ...body };
  setDeliveryZones(tenantId, zones);
  res.json(zones[idx]);
});
app.delete("/tenants/:tenantId/delivery-zones/:zoneId", (req, res) => {
  const { tenantId, zoneId } = req.params;
  const zones = getDeliveryZones(tenantId).filter((z) => z.id !== zoneId);
  if (zones.length === getDeliveryZones(tenantId).length) return res.status(404).json({ error: "Zone not found" });
  setDeliveryZones(tenantId, zones);
  res.json({ deleted: true });
});
app.patch("/tenants/:tenantId/settings/delivery", (req, res) => {
  const { tenantId } = req.params;
  const user = req.user;
  const tenants = getTenants();
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
  setTenants(tenants);
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
app.post("/tenants/:tenantId/orders/:orderId/ready", (req, res) => {
  const { tenantId, orderId } = req.params;
  const user = req.user;
  const tenant = getTenants().find((t) => t.id === tenantId);
  if (!tenant) return res.status(404).json({ error: "Tenant not found" });
  if (user?.role === "TENANT_ADMIN" && user.tenantId !== tenantId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  if (user?.role === "MARKET_ADMIN" && user.marketId !== tenant.marketId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  if (user?.role === "ROOT_ADMIN" && !requireWriteWithReason(req, res)) return;
  const orders = getOrders();
  const idx = orders.findIndex((o) => o.id === orderId);
  if (idx === -1) return res.status(404).json({ error: "Order not found" });
  if (orders[idx].tenantId !== tenantId) return res.status(403).json({ error: "Forbidden" });
  const now = (/* @__PURE__ */ new Date()).toISOString();
  orders[idx] = { ...orders[idx], status: "READY", readyAt: now };
  setOrders(orders);
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
function computeCourierMetrics(marketId, courierId) {
  const tenantIds = getMarketTenantIds(marketId);
  const orders = getOrders().filter(
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
app.get("/markets/:marketId/couriers", (req, res) => {
  const { marketId } = req.params;
  const market = getMarkets().find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: "Market not found" });
  if (req.user?.role === "TENANT_ADMIN") return res.status(403).json({ error: "Forbidden", code: "SCOPE_VIOLATION" });
  if (req.user?.role === "MARKET_ADMIN" && req.user.marketId !== marketId) {
    return res.status(403).json({ error: "Cannot access couriers from another market", code: "CROSS_MARKET_ACCESS" });
  }
  const couriers = getCouriers().filter((c) => courierMarketId(c) === marketId);
  res.json(couriers);
});
app.get("/markets/:marketId/couriers/stats", (req, res) => {
  const { marketId } = req.params;
  const market = getMarkets().find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: "Market not found" });
  if (req.user?.role === "TENANT_ADMIN") return res.status(403).json({ error: "Forbidden", code: "SCOPE_VIOLATION" });
  if (req.user?.role === "MARKET_ADMIN" && req.user.marketId !== marketId) {
    return res.status(403).json({ error: "Cannot access couriers from another market", code: "CROSS_MARKET_ACCESS" });
  }
  const couriers = getCouriers().filter((c) => courierMarketId(c) === marketId);
  const list = couriers.map((c) => ({
    ...c,
    ...computeCourierMetrics(marketId, c.id)
  }));
  res.json(list);
});
app.get("/markets/:marketId/leaderboard", (req, res) => {
  const { marketId } = req.params;
  const period = req.query.period || "week";
  const market = getMarkets().find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: "Market not found" });
  if (req.user?.role === "TENANT_ADMIN") return res.status(403).json({ error: "Forbidden", code: "SCOPE_VIOLATION" });
  if (req.user?.role === "MARKET_ADMIN" && req.user.marketId !== marketId) {
    return res.status(403).json({ error: "Cannot access leaderboard from another market", code: "CROSS_MARKET_ACCESS" });
  }
  if (req.user?.role === "COURIER" && req.user.marketId !== marketId) {
    return res.status(403).json({ error: "Courier can only access own market leaderboard", code: "CROSS_MARKET_ACCESS" });
  }
  if (period !== "week") return res.status(400).json({ error: "period=week only" });
  const couriers = getCouriers().filter((c) => courierMarketId(c) === marketId);
  const withMetrics = couriers.map((c) => ({
    courierId: c.id,
    name: c.name,
    ...computeCourierMetrics(marketId, c.id)
  }));
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
app.post("/markets/:marketId/couriers", (req, res) => {
  const { marketId } = req.params;
  const user = req.user;
  const market = getMarkets().find((m) => m.id === marketId);
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
  const couriers = getCouriers();
  couriers.push(courier);
  setCouriers(couriers);
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
app.patch("/markets/:marketId/couriers/:courierId", (req, res) => {
  const { marketId, courierId } = req.params;
  const user = req.user;
  const market = getMarkets().find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: "Market not found" });
  if (user?.role === "TENANT_ADMIN") return res.status(403).json({ error: "Forbidden", code: "SCOPE_VIOLATION" });
  if (user?.role === "MARKET_ADMIN" && user.marketId !== marketId) {
    return res.status(403).json({ error: "Cannot update couriers in another market", code: "CROSS_MARKET_ACCESS" });
  }
  if (user?.role === "ROOT_ADMIN" && !requireWriteWithReason(req, res)) return;
  const couriers = getCouriers();
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
  setCouriers(couriers);
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
app.delete("/markets/:marketId/couriers/:courierId", (req, res) => {
  const { marketId, courierId } = req.params;
  const user = req.user;
  const market = getMarkets().find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: "Market not found" });
  if (user?.role === "TENANT_ADMIN") return res.status(403).json({ error: "Forbidden", code: "SCOPE_VIOLATION" });
  if (user?.role === "MARKET_ADMIN" && user.marketId !== marketId) {
    return res.status(403).json({ error: "Cannot delete couriers in another market", code: "CROSS_MARKET_ACCESS" });
  }
  if (user?.role === "ROOT_ADMIN" && !requireWriteWithReason(req, res)) return;
  const couriers = getCouriers();
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
  setCouriers(couriers);
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
app.get("/tenants/:tenantId/couriers", (req, res) => {
  const { tenantId } = req.params;
  const tenant = getTenants().find((t) => t.id === tenantId);
  if (!tenant) return res.status(404).json({ error: "Tenant not found" });
  if (req.user?.role === "TENANT_ADMIN" && req.user.tenantId !== tenantId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  if (req.user?.role === "MARKET_ADMIN" && req.user.marketId !== tenant.marketId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const couriers = getCouriers().filter((c) => c.scopeType === "TENANT" && c.scopeId === tenantId);
  res.json(couriers);
});
app.post("/tenants/:tenantId/couriers", (req, res) => {
  const { tenantId } = req.params;
  const user = req.user;
  const tenant = getTenants().find((t) => t.id === tenantId);
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
  const couriers = getCouriers();
  couriers.push(courier);
  setCouriers(couriers);
  res.status(201).json(courier);
});
app.patch("/tenants/:tenantId/couriers/:courierId", (req, res) => {
  const { tenantId, courierId } = req.params;
  const user = req.user;
  const tenant = getTenants().find((t) => t.id === tenantId);
  if (!tenant) return res.status(404).json({ error: "Tenant not found" });
  if (user?.role === "TENANT_ADMIN" && user.tenantId !== tenantId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  if (user?.role === "MARKET_ADMIN" && user.marketId !== tenant.marketId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  if (user?.role === "ROOT_ADMIN" && !requireWriteWithReason(req, res)) return;
  const couriers = getCouriers();
  const idx = couriers.findIndex((c) => c.id === courierId && c.scopeType === "TENANT" && c.scopeId === tenantId);
  if (idx === -1) return res.status(404).json({ error: "Courier not found" });
  const body = req.body;
  couriers[idx] = { ...couriers[idx], ...body };
  setCouriers(couriers);
  res.json(couriers[idx]);
});
app.get("/markets/:marketId/orders", (req, res) => {
  const { marketId } = req.params;
  const market = getMarkets().find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: "Market not found" });
  if (req.user?.role === "MARKET_ADMIN" && req.user.marketId !== marketId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const tenantIds = getMarketTenantIds(marketId);
  const orders = getOrders().filter(
    (o) => o.tenantId && tenantIds.has(o.tenantId)
  );
  res.json(orders);
});
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
app.get("/markets/:marketId/finance/summary", (req, res) => {
  const { marketId } = req.params;
  const from = req.query.from;
  const to = req.query.to;
  const market = getMarkets().find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: "Market not found" });
  if (req.user?.role === "MARKET_ADMIN" && req.user.marketId !== marketId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const tenantIds = getMarketTenantIds(marketId);
  const allOrders = getOrders().filter(
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
});
app.get("/markets/:marketId/finance/tenants", (req, res) => {
  const { marketId } = req.params;
  const from = req.query.from;
  const to = req.query.to;
  const market = getMarkets().find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: "Market not found" });
  if (req.user?.role === "MARKET_ADMIN" && req.user.marketId !== marketId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const tenantIds = getMarketTenantIds(marketId);
  const allOrders = getOrders().filter(
    (o) => o.tenantId && tenantIds.has(o.tenantId)
  );
  const orders = ordersInDateRange(allOrders, from, to);
  const tenants = getTenants();
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
});
app.get("/markets/:marketId/finance/couriers", (req, res) => {
  const { marketId } = req.params;
  const from = req.query.from;
  const to = req.query.to;
  const market = getMarkets().find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: "Market not found" });
  if (req.user?.role === "MARKET_ADMIN" && req.user.marketId !== marketId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const tenantIds = getMarketTenantIds(marketId);
  const allOrders = getOrders().filter(
    (o) => o.tenantId && tenantIds.has(o.tenantId) && o.courierId
  );
  const orders = ordersInDateRange(allOrders, from, to);
  const couriers = getCouriers().filter((c) => courierMarketId(c) === marketId);
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
});
app.post("/markets/:marketId/orders/:orderId/assign-courier", (req, res) => {
  const { marketId, orderId } = req.params;
  const user = req.user;
  const market = getMarkets().find((m) => m.id === marketId);
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
  const orders = getOrders();
  const idx = orders.findIndex((o) => o.id === orderId);
  if (idx === -1) return res.status(404).json({ error: "Order not found" });
  const order = orders[idx];
  const orderMarketId = order.marketId ?? getTenants().find((t) => t.id === order.tenantId)?.marketId;
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
  const couriers = getCouriers();
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
  setOrders(orders);
  const courierIdx = couriers.findIndex((c) => c.id === courierId);
  if (courierIdx >= 0) {
    couriers[courierIdx] = { ...couriers[courierIdx], isAvailable: false };
    setCouriers(couriers);
  }
  appendAuditEvent({
    id: `audit-${Date.now()}`,
    at: (/* @__PURE__ */ new Date()).toISOString(),
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
app.post("/markets/:marketId/orders/:orderId/contact", (req, res) => {
  const { marketId, orderId } = req.params;
  const user = req.user;
  const market = getMarkets().find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: "Market not found" });
  if (user?.role === "TENANT_ADMIN") return res.status(403).json({ error: "Forbidden", code: "SCOPE_VIOLATION" });
  if (user?.role === "MARKET_ADMIN" && user.marketId !== marketId) {
    return res.status(403).json({ error: "Order not in this market", code: "CROSS_MARKET_ACCESS" });
  }
  if (user?.role === "ROOT_ADMIN" && !requireWriteWithReason(req, res)) return;
  const body = req.body;
  const notes = body.notes?.trim() || body.message?.trim() || void 0;
  const channel = body.channel?.trim() || void 0;
  const orders = getOrders();
  const idx = orders.findIndex((o) => o.id === orderId);
  if (idx === -1) return res.status(404).json({ error: "Order not found" });
  const order = orders[idx];
  const orderMarketId = order.marketId ?? getTenants().find((t) => t.id === order.tenantId)?.marketId;
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
  setOrders(orders);
  res.json(orders[idx]);
});
app.delete("/markets/:marketId/orders/:orderId/assign-courier", (req, res) => {
  const { marketId, orderId } = req.params;
  const user = req.user;
  const market = getMarkets().find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: "Market not found" });
  if (user?.role === "MARKET_ADMIN" && user.marketId !== marketId) {
    return res.status(403).json({ error: "Cannot unassign in another market", code: "CROSS_MARKET_ACCESS" });
  }
  if (user?.role === "ROOT_ADMIN" && !requireWriteWithReason(req, res)) return;
  const orders = getOrders();
  const idx = orders.findIndex((o) => o.id === orderId);
  if (idx === -1) return res.status(404).json({ error: "Order not found" });
  const order = orders[idx];
  const orderMarketId = order.marketId ?? getTenants().find((t) => t.id === order.tenantId)?.marketId;
  if (orderMarketId !== marketId) {
    return res.status(403).json({ error: "Order not in this market", code: "CROSS_MARKET_ACCESS" });
  }
  const courierId = order.courierId;
  const before = { ...order };
  orders[idx] = { ...order, courierId: void 0, deliveryStatus: "UNASSIGNED" };
  setOrders(orders);
  if (courierId) {
    emitCourierUnassigned(courierId, orderId);
    const otherAssigned = orders.filter(
      (o) => o.courierId === courierId && o.id !== orderId && o.status !== "DELIVERED" && o.status !== "CANCELED"
    );
    if (otherAssigned.length === 0) {
      const couriers = getCouriers();
      const cIdx = couriers.findIndex((c) => c.id === courierId);
      if (cIdx >= 0) {
        couriers[cIdx] = { ...couriers[cIdx], isAvailable: true };
        setCouriers(couriers);
      }
    }
  }
  appendAuditEvent({
    id: `audit-${Date.now()}`,
    at: (/* @__PURE__ */ new Date()).toISOString(),
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
app.get("/markets/:marketId/dispatch/queue", (req, res) => {
  const { marketId } = req.params;
  const market = getMarkets().find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: "Market not found" });
  if (req.user?.role === "TENANT_ADMIN") return res.status(403).json({ error: "Forbidden" });
  if (req.user?.role === "MARKET_ADMIN" && req.user.marketId !== marketId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const queue = getDispatchQueue(marketId);
  res.json(queue);
});
app.get("/markets/:marketId/delivery-jobs", (req, res) => {
  const { marketId } = req.params;
  const market = getMarkets().find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: "Market not found" });
  if (req.user?.role === "TENANT_ADMIN") return res.status(403).json({ error: "Forbidden" });
  if (req.user?.role === "MARKET_ADMIN" && req.user.marketId !== marketId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const jobs = getDeliveryJobs().filter((j) => j.marketId === marketId);
  res.json(jobs);
});
app.post("/markets/:marketId/delivery-jobs", (req, res) => {
  const { marketId } = req.params;
  const user = req.user;
  const market = getMarkets().find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: "Market not found" });
  if (user?.role === "TENANT_ADMIN") return res.status(403).json({ error: "Forbidden" });
  if (user?.role === "MARKET_ADMIN" && user.marketId !== marketId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  if (user?.role === "ROOT_ADMIN" && !requireWriteWithReason(req, res)) return;
  const body = req.body;
  const items = body.items ?? [];
  const tenantIds = new Set(getTenants().filter((t) => t.marketId === marketId).map((t) => t.id));
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
app.patch("/markets/:marketId/delivery-jobs/:jobId/assign", (req, res) => {
  const { marketId, jobId } = req.params;
  const user = req.user;
  const market = getMarkets().find((m) => m.id === marketId);
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
  const courier = getCouriers().find((c) => c.id === body.courierId);
  if (!courier) return res.status(404).json({ error: "Courier not found" });
  if (courierMarketId(courier) !== marketId) {
    return res.status(403).json({ error: "Courier belongs to another market", code: "CROSS_MARKET_ACCESS" });
  }
  jobs[idx] = { ...jobs[idx], courierId: body.courierId, status: "ASSIGNED" };
  setDeliveryJobs(jobs);
  res.json(jobs[idx]);
});
app.get("/templates", (_req, res) => {
  res.json(getTemplates());
});
app.get("/staff", (req, res) => {
  const tenantId = req.query.tenantId;
  let staff = getStaff();
  if (tenantId) staff = staff.filter((s) => s.tenantId === tenantId);
  res.json(staff);
});
app.post("/staff", (req, res) => {
  const user = req.body;
  const staff = getStaff();
  staff.push(user);
  setStaff(staff);
  res.status(201).json(user);
});
app.get("/health", (_req, res) => {
  res.json({ ok: true });
});
seedUsersIfNeeded();
seedMarketsIfNeeded();
seedTenantMarketIdsIfNeeded();
seedOrdersIfNeeded();
seedDeliveryZonesIfNeeded();
app.listen(PORT, () => {
  console.log(`Mock API server running at http://localhost:${PORT}`);
});
export {
  emitCourierAssigned,
  emitCourierUnassigned
};
//# sourceMappingURL=index.js.map