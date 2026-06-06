// src/types/staff.ts
var ROLE_PERMISSIONS = {
  OWNER: { catalog: "write", orders: "write", campaigns: "write", settings: "write" },
  MANAGER: { catalog: "write", orders: "write", campaigns: "write", settings: "read" },
  STAFF: { catalog: "read", orders: "write", campaigns: "read", settings: "read" }
};

// src/types/campaign.ts
import { z } from "zod";
var CampaignStatusSchema = z.enum(["draft", "active", "paused"]);
var CampaignTypeSchema = z.enum(["PERCENT", "FIXED", "BUNDLE_PLACEHOLDER"]);
var CampaignAppliesToSchema = z.enum(["ALL", "CATEGORIES", "PRODUCTS"]);
var CampaignSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  name: z.string(),
  status: CampaignStatusSchema,
  type: CampaignTypeSchema,
  value: z.number(),
  appliesTo: CampaignAppliesToSchema,
  categoryIds: z.array(z.string()).optional(),
  productIds: z.array(z.string()).optional(),
  startAt: z.string().nullable().optional(),
  endAt: z.string().nullable().optional(),
  stackable: z.boolean().optional().default(false),
  priority: z.number().optional().default(0)
});

// src/types/delivery.ts
import { z as z2 } from "zod";
var DeliveryZoneSchema = z2.object({
  id: z2.string(),
  tenantId: z2.string(),
  name: z2.string(),
  fee: z2.number(),
  etaMinutes: z2.number().optional(),
  isActive: z2.boolean().default(true),
  sortOrder: z2.number().optional(),
  centerLat: z2.number().optional(),
  centerLng: z2.number().optional(),
  radiusKm: z2.number().optional()
});
var DeliverySettingsSchema = z2.object({
  tenantId: z2.string(),
  modes: z2.object({
    pickup: z2.boolean(),
    delivery: z2.boolean()
  }),
  deliveryFee: z2.number().optional(),
  zones: z2.array(DeliveryZoneSchema).optional()
});

// src/types/pricing.ts
function applyOptionDeltas(basePrice, items) {
  const delta = items.reduce((sum, i) => sum + (i.priceDelta ?? i.priceModifier ?? 0), 0);
  return basePrice + delta;
}
function applyCampaign(price, campaigns, productId, categoryId) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const active = campaigns.filter((c) => {
    if (c.status !== "active") return false;
    if (c.startAt && c.startAt > now) return false;
    if (c.endAt && c.endAt < now) return false;
    if (c.appliesTo === "CATEGORIES" && categoryId && c.categoryIds?.includes(categoryId)) return true;
    if (c.appliesTo === "PRODUCTS" && productId && c.productIds?.includes(productId)) return true;
    if (c.appliesTo === "ALL") return true;
    return false;
  });
  if (active.length === 0) return { discount: 0 };
  const best = active.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))[0];
  let discount = 0;
  if (best.type === "PERCENT") discount = price * best.value / 100;
  else if (best.type === "FIXED") discount = Math.min(best.value, price);
  return { discount, campaign: best };
}

// src/permissions/admin-permissions.ts
function isPlatformSuperAdmin(role) {
  return role === "ROOT_ADMIN" || role === "SUPER_ADMIN";
}
function isMarketAdminRole(role) {
  return role === "MARKET_ADMIN";
}
function isTenantAdminRole(role) {
  return role === "TENANT_ADMIN";
}
function isStaffAdminRole(role) {
  return isPlatformSuperAdmin(role) || isMarketAdminRole(role) || isTenantAdminRole(role);
}
var MARKET_ADMIN_MODULES = /* @__PURE__ */ new Set([
  "dashboard",
  "marketOverview",
  "marketStores",
  "marketOrders",
  "marketReports",
  "marketBanners",
  "marketDispatch",
  "marketCouriers",
  "deliveryLeads",
  "customers",
  "storeSettings",
  "orders",
  "products",
  "categories",
  "options",
  "workingHours",
  "branding",
  "homepage",
  "deliveryZones"
]);
var TENANT_ADMIN_MODULES = /* @__PURE__ */ new Set([
  "dashboard",
  "orders",
  "orderBoard",
  "products",
  "categories",
  "options",
  "campaigns",
  "storeSettings",
  "workingHours",
  "coupons",
  "settlementSummary",
  "staff",
  "branding",
  "homepage",
  "deliveryLeads",
  "customers"
]);
var ROUTE_MODULE_MAP = {
  "/monitoring": "monitoring",
  "/economics": "platformEconomics",
  "/markets": "marketsList",
  "/tenants": "allTenants",
  "/platform-fees": "platformFees",
  "/categories": "platformCatalog",
  "/pillars": "platformCatalog",
  "/system/templates": "platformCatalog",
  "/delivery-leads": "deliveryLeads",
  "/drivers": "drivers",
  "/drivers/couriers": "drivers",
  "/drivers/markets": "drivers",
  "/drivers/reports": "superAdminReports",
  "/drivers/finance": "settlementPayments",
  "/external-orders": "externalOrders",
  "/contests": "contests",
  "/rewards": "globalRewards",
  "/coupons": "coupons",
  "/lucky-wheel": "luckyWheel",
  "/push-notifications": "pushBroadcast",
  "/home-builder": "homeBuilder",
  "/modifier-icons": "modifierIcons",
  "/customers": "customers",
  "/settings": "platformSettings",
  "/settings/payments": "platformSettings",
  "/settings/category-policies": "platformSettings",
  "/settings/home-layout": "homeBuilder",
  "/audit": "audit",
  "/plans": "platformSettings",
  "/modules": "platformSettings",
  "/api": "platformSettings",
  "/tenant": "dashboard",
  "/tenant/products": "products",
  "/tenant/orders": "orders",
  "/tenant/delivery-zones": "deliveryZones",
  "/tenant/customers": "customers",
  "/tenant/account/security": "storeSettings"
};
var MERCHANT_ROUTE_MODULE_MAP = {
  "/": "dashboard",
  "/orders": "orders",
  "/orders/board": "orderBoard",
  "/leads": "deliveryLeads",
  "/catalog/products": "products",
  "/catalog/categories": "categories",
  "/catalog/options": "options",
  "/campaigns": "campaigns",
  "/settings/store": "storeSettings",
  "/settings/settlement": "settlementSummary",
  "/settings/staff": "staff",
  "/settings/delivery": "deliveryZones",
  "/branding": "branding",
  "/homepage": "homepage"
};
function canViewModule(role, module) {
  if (!role) return false;
  if (isPlatformSuperAdmin(role)) return true;
  if (isMarketAdminRole(role)) return MARKET_ADMIN_MODULES.has(module);
  if (isTenantAdminRole(role)) return TENANT_ADMIN_MODULES.has(module);
  return false;
}
function canEditField(role, field) {
  if (!role) return false;
  if (isPlatformSuperAdmin(role)) return true;
  if (field === "markupExempt" || field === "platformFee" || field === "financialConfig") return false;
  if (field === "commissionType" || field === "commissionValue" || field === "deliveryFeeModel") return false;
  if (field === "loyaltyBonus") return isMarketAdminRole(role);
  if (field === "marketId" || field === "enabled") return isMarketAdminRole(role);
  if (isTenantAdminRole(role)) {
    return field !== "markupExempt" && field !== "platformFee" && field !== "financialConfig";
  }
  return false;
}
function normalizeRoutePath(route) {
  const path = route.split("?")[0]?.trim() ?? "/";
  if (path.length > 1 && path.endsWith("/")) return path.slice(0, -1);
  return path || "/";
}
function resolveRouteModule(route, map) {
  const normalized = normalizeRoutePath(route);
  if (map[normalized]) return map[normalized];
  if (normalized.startsWith("/markets/") && normalized.includes("/tenants/")) {
    if (normalized.includes("/settings/delivery")) return "deliveryZones";
    return "marketStores";
  }
  if (normalized.match(/^\/markets\/[^/]+\/orders/)) return "marketOrders";
  if (normalized.match(/^\/markets\/[^/]+\/dispatch/)) return "marketDispatch";
  if (normalized.match(/^\/markets\/[^/]+\/finance/)) return "marketFinance";
  if (normalized.match(/^\/markets\/[^/]+\/platform-fee/)) return "marketPlatformFee";
  if (normalized.match(/^\/markets\/[^/]+\/reports/)) return "marketReports";
  if (normalized.match(/^\/markets\/[^/]+\/banners/)) return "marketBanners";
  if (normalized.match(/^\/markets\/[^/]+\/layout/)) return "marketBanners";
  if (normalized.match(/^\/markets\/[^/]+\/tenants/)) return "marketStores";
  if (normalized.match(/^\/markets\/[^/]+$/)) return "marketOverview";
  if (normalized.startsWith("/tenants/") && normalized.endsWith("/settlement")) return "settlementLedger";
  if (normalized.startsWith("/tenants/")) return "allTenants";
  if (normalized.startsWith("/tenant/")) {
    const sub = normalized.replace(/^\/tenant/, "") || "/";
    return map[`/tenant${sub === "/" ? "" : sub}`] ?? map["/tenant"] ?? "dashboard";
  }
  if (normalized.startsWith("/drivers/")) return "drivers";
  if (normalized.startsWith("/settings/")) return "platformSettings";
  if (normalized.startsWith("/campaigns")) return "campaigns";
  if (normalized.startsWith("/catalog/")) {
    const merchantMap = MERCHANT_ROUTE_MODULE_MAP;
    return merchantMap[normalized];
  }
  return void 0;
}
function canAccessRoute(role, route) {
  if (!role || role === "CUSTOMER" || role === "COURIER") return false;
  if (isPlatformSuperAdmin(role)) return true;
  const nmdModule = resolveRouteModule(route, ROUTE_MODULE_MAP);
  const merchantModule = resolveRouteModule(route, MERCHANT_ROUTE_MODULE_MAP);
  const module = nmdModule ?? merchantModule;
  if (!module) return isMarketAdminRole(role) || isTenantAdminRole(role);
  return canViewModule(role, module);
}
function getTenantMerchantPortalUrl(tenantSlug) {
  const base = "/merchant";
  const slug = tenantSlug?.trim();
  if (slug) return `${base}?tenant=${encodeURIComponent(slug)}`;
  return base;
}
function isExternalAdminRedirect(path) {
  return path.startsWith("/merchant");
}
function getSafeDashboardRoute(role, context = "nmd-admin", tenantSlug) {
  if (isPlatformSuperAdmin(role)) return "/monitoring";
  if (isMarketAdminRole(role)) return "/markets";
  if (isTenantAdminRole(role)) {
    if (context === "merchant") return "/";
    return getTenantMerchantPortalUrl(tenantSlug);
  }
  return "/login";
}
var TENANT_ADMIN_TENANT_PATCH_FIELDS = [
  "name",
  "about",
  "phone",
  "whatsappPhone",
  "officeHours",
  "openTime",
  "closeTime",
  "forceClosed",
  "operationalStatus",
  "overrideStatus",
  "orderPolicy",
  "businessHours",
  "busyBannerEnabled",
  "busyBannerText",
  "bookingEnabled",
  "storeType",
  "addressLine",
  "location",
  "supportsWeightSelling",
  "paymentMethods",
  "paymentCapabilities",
  "banners",
  "hero",
  "logoUrl",
  "primaryColor",
  "secondaryColor",
  "fontFamily",
  "radiusScale",
  "layoutStyle",
  "collections"
];
function filterTenantPatchForRole(role, updates) {
  if (isPlatformSuperAdmin(role)) return updates;
  if (isMarketAdminRole(role)) {
    const allowed = [
      "marketCategory",
      "isListedInMarket",
      "marketSortOrder",
      "marketId",
      "pillarId",
      "subCategoryId",
      "supportsWeightSelling",
      "overrideStatus"
    ];
    return Object.fromEntries(Object.entries(updates).filter(([k]) => allowed.includes(k)));
  }
  if (isTenantAdminRole(role)) {
    return Object.fromEntries(
      Object.entries(updates).filter(
        ([k]) => TENANT_ADMIN_TENANT_PATCH_FIELDS.includes(k)
      )
    );
  }
  return {};
}
function stripProtectedCategoryFields(role, categories, existing) {
  if (isPlatformSuperAdmin(role)) return categories;
  const existingById = new Map(existing.map((c) => [c.id, c]));
  return categories.map((cat) => {
    const id = cat.id;
    const prev = id ? existingById.get(id) : void 0;
    if (!canEditField(role, "markupExempt")) {
      return { ...cat, markupExempt: prev?.markupExempt ?? false };
    }
    return cat;
  });
}

// src/tenant.ts
function parseSubdomainTenant(hostname) {
  const parts = hostname.split(".");
  if (parts.length >= 2) {
    const subdomain = parts[0];
    if (subdomain && !["www", "api", "admin"].includes(subdomain.toLowerCase())) {
      return subdomain;
    }
  }
  return null;
}
function resolveTenantId(hostname, searchParams) {
  const urlTenant = searchParams.get("tenantId");
  if (urlTenant) return urlTenant;
  return parseSubdomainTenant(hostname);
}
var LAST_TENANT_KEY = "nmd.lastTenant";
var DAY_ORDER = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
var STORE_TIMEZONE = "Asia/Jerusalem";
var WEEKDAY_MAP = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
function getNowInStoreTz() {
  const now = /* @__PURE__ */ new Date();
  const tz = { timeZone: STORE_TIMEZONE };
  const dayStr = new Intl.DateTimeFormat("en-US", { ...tz, weekday: "short" }).format(now);
  const dayIdx = WEEKDAY_MAP[dayStr] ?? 0;
  const timeStr = new Intl.DateTimeFormat("en-CA", { ...tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
  const [hour, minute] = timeStr.split(":").map(Number);
  return { dayIdx, hour: hour ?? 0, minute: minute ?? 0 };
}
var DEFAULT_OPEN = "08:00";
var DEFAULT_CLOSE = "17:00";
function parseTimeHHmm(s) {
  if (!s || typeof s !== "string") return { h: 8, m: 0 };
  const parts = s.trim().split(":").map(Number);
  const h = Math.min(23, Math.max(0, parts[0] ?? 8));
  const m = Math.min(59, Math.max(0, parts[1] ?? 0));
  return { h, m };
}
function getOperationalStatus(tenant) {
  const override = tenant.overrideStatus;
  if (override === "FORCE_CLOSED") return "closed";
  if (override === "FORCE_OPEN") return "open";
  if (tenant.forceClosed === true) return "closed";
  if (tenant.operationalStatus === "open" || tenant.operationalStatus === "busy") return tenant.operationalStatus;
  const hasSimpleHours = tenant.openTime !== void 0 || tenant.closeTime !== void 0;
  if (hasSimpleHours) {
    const openTime = tenant.openTime ?? DEFAULT_OPEN;
    const closeTime = tenant.closeTime ?? DEFAULT_CLOSE;
    const { hour: hour2, minute: minute2 } = getNowInStoreTz();
    const open = parseTimeHHmm(openTime);
    const close = parseTimeHHmm(closeTime);
    const nowMin2 = hour2 * 60 + minute2;
    const openMin2 = open.h * 60 + open.m;
    const closeMin2 = close.h * 60 + close.m;
    if (closeMin2 > openMin2) {
      if (nowMin2 >= openMin2 && nowMin2 < closeMin2) return "open";
    } else {
      if (nowMin2 >= openMin2 || nowMin2 < closeMin2) return "open";
    }
    return "closed";
  }
  if (tenant.operationalStatus) return tenant.operationalStatus;
  const hours = tenant.businessHours;
  if (!hours || Object.keys(hours).length === 0) return "open";
  const { dayIdx, hour, minute } = getNowInStoreTz();
  const dayKey = DAY_ORDER[dayIdx];
  const day = hours[dayKey];
  if (!day || day.isClosedDay) return "closed";
  const [openH, openM] = (day.open || "00:00").split(":").map(Number);
  const [closeH, closeM] = (day.close || "23:59").split(":").map(Number);
  const nowMin = hour * 60 + minute;
  const openMin = openH * 60 + openM;
  const closeMin = closeH * 60 + closeM;
  if (nowMin >= openMin && nowMin < closeMin) return "open";
  return "closed";
}
function isStoreOpen(tenant) {
  return getOperationalStatus(tenant) === "open";
}
function resolveTenantFromUrl() {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const slug = params.get("tenant");
  if (slug) return slug;
  return localStorage.getItem(LAST_TENANT_KEY);
}
function setLastTenant(slugOrId) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LAST_TENANT_KEY, slugOrId);
}
var LAYOUT_STYLES = {
  minimal: { header: "flat", card: "flat", section: "tight", button: "square", badge: "subtle" },
  cozy: { header: "soft", card: "soft", section: "medium", button: "rounded", badge: "soft" },
  bold: { header: "strong", card: "strong", section: "spacious", button: "pill", badge: "strong" },
  modern: { header: "clean", card: "clean", section: "medium", button: "rounded", badge: "clean" },
  default: { header: "soft", card: "soft", section: "medium", button: "rounded", badge: "soft" },
  compact: { header: "flat", card: "flat", section: "tight", button: "square", badge: "subtle" },
  spacious: { header: "strong", card: "strong", section: "spacious", button: "pill", badge: "strong" }
};
var PLATFORM_BRANDING = {
  logoUrl: "",
  primaryColor: "#0f766e",
  secondaryColor: "#f0fdfa",
  fontFamily: '"Cairo", system-ui, sans-serif',
  radiusScale: 1.5,
  layoutStyle: "default"
};
function tenantBrandingToCssVars(branding) {
  const b = branding ?? PLATFORM_BRANDING;
  const style = LAYOUT_STYLES[b.layoutStyle] ?? LAYOUT_STYLES.default;
  return {
    "--color-primary": b.primaryColor,
    "--color-secondary": b.secondaryColor,
    "--radius": `${b.radiusScale * 4}px`,
    "--font": b.fontFamily,
    "--layout-header": style.header,
    "--layout-card": style.card,
    "--layout-section": style.section,
    "--layout-button": style.button,
    "--layout-badge": style.badge
  };
}

// src/utils/money.ts
function roundMoney(amount) {
  const n = Number(amount);
  if (Number.isNaN(n) || !Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}
function formatMoney(amount, opts = {}) {
  const {
    currency = "ILS",
    minimumFractionDigits = 2,
    maximumFractionDigits = 2
  } = opts;
  const n = Number(amount);
  if (Number.isNaN(n) || !Number.isFinite(n)) return "\u20AA0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits,
    maximumFractionDigits
  }).format(n);
}

// src/utils/dates.ts
function formatDateGregorian(date) {
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "\u2014";
  return d.toLocaleDateString("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
}
function formatDateTimeGregorian(date) {
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "\u2014";
  return d.toLocaleString("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}
function formatTimeGregorian(date) {
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "\u2014";
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
}
function formatDateISO(date) {
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// src/utils/customer-price.ts
function customerUnitPrice(product, variantPriceOverride) {
  const base = variantPriceOverride ?? product.displayPrice ?? product.basePrice;
  return Number.isFinite(base) ? base : 0;
}
function customerComparePrice(product) {
  if (product.displayComparePrice != null && Number.isFinite(product.displayComparePrice)) {
    return product.displayComparePrice;
  }
  return void 0;
}

// src/utils.ts
function formatPrice(amount) {
  return formatMoney(amount);
}
function generateId() {
  return crypto.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// src/utils/placements.ts
var PLACEMENT_LABELS_AR = {
  WHOLE: "\u0643\u0627\u0645\u0644\u0629",
  LEFT: "\u0646\u0635\u0641 \u064A\u0633\u0627\u0631",
  RIGHT: "\u0646\u0635\u0641 \u064A\u0645\u064A\u0646"
};
var PLACEMENT_OPTIONS_AR = [
  { value: "WHOLE", label: PLACEMENT_LABELS_AR.WHOLE },
  { value: "RIGHT", label: PLACEMENT_LABELS_AR.RIGHT },
  { value: "LEFT", label: PLACEMENT_LABELS_AR.LEFT }
];
function formatPlacementAr(p) {
  if (!p) return void 0;
  const u = p;
  if (u === "WHOLE") return void 0;
  return PLACEMENT_LABELS_AR[u] ?? p;
}
function formatAddonNameWithPlacement(name, p) {
  const label = formatPlacementAr(p);
  return label ? `${name} (${label})` : name;
}
function formatHalfAndHalfOptionDisplay(ids, placements, getOptionName) {
  if (ids.length !== 2) {
    return ids.map((id) => formatAddonNameWithPlacement(getOptionName(id) ?? id, placements[id])).filter(Boolean).join("\u060C ");
  }
  const leftId = ids.find((id) => placements[id] === "LEFT");
  const rightId = ids.find((id) => placements[id] === "RIGHT");
  if (leftId != null && rightId != null) {
    const leftName = getOptionName(leftId) ?? leftId;
    const rightName = getOptionName(rightId) ?? rightId;
    return `\u0646\u0635\u0641 ${rightName} / \u0646\u0635\u0641 ${leftName}`;
  }
  return ids.map((id) => formatAddonNameWithPlacement(getOptionName(id) ?? id, placements[id])).filter(Boolean).join("\u060C ");
}

// src/utils/whatsapp.ts
function buildWhatsAppMessage(order, tenant) {
  const lines = [];
  const orderId = typeof order?.id === "string" ? order.id : String(order?.id ?? "");
  const createdAt = order?.createdAt ? new Date(order.createdAt) : /* @__PURE__ */ new Date();
  lines.push(`*\u062A\u0641\u0627\u0635\u064A\u0644 \u0627\u0644\u0637\u0644\u0628 \u0627\u0644\u062C\u062F\u064A\u062F:*`);
  lines.push("---");
  lines.push(`*\u0637\u0644\u0628 \u062C\u062F\u064A\u062F - ${tenant?.name ?? ""}*`);
  lines.push("");
  lines.push(`#${orderId.slice(0, 8)}`);
  lines.push(`\u0627\u0644\u062A\u0627\u0631\u064A\u062E: ${formatDateGregorian(createdAt)}`);
  lines.push("");
  const delivery = order.delivery;
  if (order.fulfillmentType === "DELIVERY" || delivery?.method === "DELIVERY") {
    lines.push("\u0637\u0631\u064A\u0642\u0629 \u0627\u0644\u0627\u0633\u062A\u0644\u0627\u0645: \u062A\u0648\u0635\u064A\u0644");
    if (delivery?.zoneName && delivery?.fee != null) {
      lines.push(`\u0627\u0644\u0645\u0646\u0637\u0642\u0629: ${delivery.zoneName} (+${formatMoney(delivery.fee)})`);
    } else if (delivery?.zoneName) {
      lines.push(`\u0627\u0644\u0645\u0646\u0637\u0642\u0629: ${delivery.zoneName}`);
    } else if (delivery?.fee != null) {
      lines.push(`\u0633\u0639\u0631 \u0627\u0644\u062A\u0648\u0635\u064A\u0644: ${formatMoney(delivery.fee)}`);
    }
    if (delivery?.addressText) lines.push(`\u0627\u0644\u0639\u0646\u0648\u0627\u0646: ${delivery.addressText}`);
    else if (order.deliveryAddress) lines.push(`\u0627\u0644\u0639\u0646\u0648\u0627\u0646: ${order.deliveryAddress}`);
  } else {
    lines.push("\u0637\u0631\u064A\u0642\u0629 \u0627\u0644\u0627\u0633\u062A\u0644\u0627\u0645: \u0627\u0633\u062A\u0644\u0627\u0645 \u0645\u0646 \u0627\u0644\u0645\u062D\u0644");
  }
  if (order.customerName) lines.push(`\u0627\u0644\u0627\u0633\u0645: ${order.customerName}`);
  if (order.customerPhone) lines.push(`\u0627\u0644\u062C\u0648\u0627\u0644: ${order.customerPhone}`);
  lines.push("");
  lines.push("*\u0627\u0644\u0639\u0646\u0627\u0635\u0631:*");
  const items = Array.isArray(order.items) ? order.items : [];
  for (const item of items) {
    const name = item.productName ?? "\u0645\u0646\u062A\u062C";
    const qty = Number(item.quantity) || 1;
    const price = item.totalPrice != null ? formatMoney(item.totalPrice) : "";
    const selectedOptions = item.selectedOptions ?? [];
    const optionGroups = item.optionGroups ?? [];
    const optParts = selectedOptions.map((s) => {
      const g = optionGroups.find((x) => x.id === s.optionGroupId);
      const ids = "optionItemIds" in s ? s.optionItemIds : [];
      const placements = "optionPlacements" in s ? s.optionPlacements ?? {} : {};
      const getOptionName = (id) => g?.items?.find((i) => i.id === id)?.name;
      return formatHalfAndHalfOptionDisplay(ids, placements, getOptionName);
    }).filter(Boolean).join(" | ");
    lines.push(`\u2022 ${name} x${qty}${optParts ? ` (${optParts})` : ""}${price ? `: ${price}` : ""}`);
  }
  if (items.length === 0) lines.push("\u2014");
  lines.push("");
  lines.push("---");
  const subtotal = order.merchantAmount ?? order.subtotal ?? items.reduce((s, i) => s + (Number(i.totalPrice) || 0), 0);
  const deliveryFee = order.platformDeliveryFee ?? order.delivery?.fee ?? 0;
  const total = Number(order.total) || subtotal + deliveryFee;
  lines.push(`\u0627\u0644\u0645\u062C\u0645\u0648\u0639: ${formatMoney(subtotal)}`);
  lines.push(`\u062E\u062F\u0645\u0629 \u0627\u0644\u062A\u0648\u0635\u064A\u0644: ${formatMoney(deliveryFee)}`);
  lines.push(`*\u0627\u0644\u0645\u0637\u0644\u0648\u0628 \u0644\u0644\u062F\u0641\u0639: ${formatMoney(total)}*`);
  if (order.notes) lines.push(`\u0645\u0644\u0627\u062D\u0638\u0627\u062A: ${order.notes}`);
  return lines.join("\n");
}
function isValidWhatsAppPhone(phone) {
  if (!phone || typeof phone !== "string") return false;
  const cleaned = phone.replace(/\D/g, "");
  return cleaned.length >= 9 && /^\d+$/.test(cleaned);
}
function buildWhatsAppUrl(phone, message) {
  if (!phone || typeof phone !== "string") return "";
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length < 9) return "";
  const encoded = encodeURIComponent(typeof message === "string" ? message : "");
  return `https://wa.me/${cleaned}?text=${encoded}`;
}
function buildWhatsAppDeepLink(phone, message) {
  if (!phone || typeof phone !== "string") return "";
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length < 9) return "";
  const encoded = encodeURIComponent(typeof message === "string" ? message : "");
  return `whatsapp://send?phone=${cleaned}&text=${encoded}`;
}
var DEFAULT_ORDER_ACTIONS_BASE = "https://nmd.marketing/merchant";
function buildOrderActionLinksSection(orderId, baseUrl = DEFAULT_ORDER_ACTIONS_BASE) {
  const id = typeof orderId === "string" ? orderId : String(orderId ?? "");
  if (!id) return "";
  const base = (baseUrl ?? DEFAULT_ORDER_ACTIONS_BASE).replace(/\/$/, "");
  const lines = [
    "",
    "\u2014\u2014\u2014 (\u0644\u0644\u062A\u0627\u062C\u0631 \u0641\u0642\u0637) \u2014\u2014\u2014",
    `\u2705 \u062A\u0623\u0643\u064A\u062F \u0627\u0644\u0637\u0644\u0628: ${base}/order-actions/${id}/confirm`,
    `\u{1F9D1}\u200D\u{1F373} \u0627\u0644\u0637\u0644\u0628 \u062C\u0627\u0647\u0632: ${base}/order-actions/${id}/ready`,
    `\u{1F69A} \u062A\u0645 \u0627\u0644\u0625\u0631\u0633\u0627\u0644: ${base}/order-actions/${id}/shipped`
  ];
  return lines.join("\n");
}

// src/utils/location-utils.ts
function haversineDistanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// src/utils/option-groups.ts
function filterOptionGroupsForTenant(tenantType, groups) {
  if (!tenantType || tenantType === "GENERAL") return groups;
  if (tenantType === "FOOD") {
    return groups.filter((g) => (g.type ?? "CUSTOM") === "CUSTOM");
  }
  return groups;
}

// src/mock-data/index.ts
var mockTenants = {
  default: {
    id: "default",
    name: "NMD Store",
    slug: "default",
    branding: {
      logoUrl: "/logo.svg",
      primaryColor: "#0f766e",
      secondaryColor: "#d4a574",
      fontFamily: '"Cairo", system-ui, sans-serif',
      radiusScale: 1,
      layoutStyle: "default"
    }
  },
  pizzeria: {
    id: "pizzeria",
    name: "NMD Pizzeria",
    slug: "pizzeria",
    branding: {
      logoUrl: "/logo-pizza.svg",
      primaryColor: "#b91c1c",
      secondaryColor: "#fbbf24",
      fontFamily: '"Cairo", system-ui, sans-serif',
      radiusScale: 1.25,
      layoutStyle: "default"
    }
  }
};
var mockCategories = {
  default: [
    { id: "cat-1", tenantId: "default", name: "Appetizers", slug: "appetizers", sortOrder: 0 },
    { id: "cat-2", tenantId: "default", name: "Main Dishes", slug: "main-dishes", sortOrder: 1 },
    { id: "cat-3", tenantId: "default", name: "Beverages", slug: "beverages", sortOrder: 2 }
  ],
  pizzeria: [
    { id: "pcat-1", tenantId: "pizzeria", name: "Pizzas", slug: "pizzas", sortOrder: 0 },
    { id: "pcat-2", tenantId: "pizzeria", name: "Sides", slug: "sides", sortOrder: 1 }
  ]
};
var mockProducts = {
  default: [
    {
      id: "prod-1",
      tenantId: "default",
      categoryId: "cat-1",
      name: "Hummus Bowl",
      slug: "hummus-bowl",
      type: "SIMPLE",
      basePrice: 15,
      currency: "ILS",
      images: [{ id: "img-1", url: "https://placehold.co/400x300?text=Hummus", sortOrder: 0 }],
      optionGroups: [],
      isAvailable: true
    },
    {
      id: "prod-2",
      tenantId: "default",
      categoryId: "cat-2",
      name: "Grilled Chicken",
      slug: "grilled-chicken",
      type: "CONFIGURABLE",
      basePrice: 45,
      currency: "ILS",
      images: [{ id: "img-2", url: "https://placehold.co/400x300?text=Chicken", sortOrder: 0 }],
      optionGroups: [
        {
          id: "og-1",
          name: "Side",
          required: true,
          minSelected: 1,
          maxSelected: 1,
          selectionType: "single",
          items: [
            { id: "oi-1", name: "Rice", priceModifier: 0, sortOrder: 0 },
            { id: "oi-2", name: "Fries", priceModifier: 3, sortOrder: 1 }
          ]
        }
      ],
      isAvailable: true
    },
    {
      id: "prod-3",
      tenantId: "default",
      categoryId: "cat-3",
      name: "Fresh Juice",
      slug: "fresh-juice",
      type: "CONFIGURABLE",
      basePrice: 12,
      currency: "ILS",
      images: [{ id: "img-3", url: "https://placehold.co/400x300?text=Juice", sortOrder: 0 }],
      optionGroups: [
        {
          id: "og-2",
          name: "Flavor",
          required: true,
          minSelected: 1,
          maxSelected: 1,
          selectionType: "single",
          items: [
            { id: "oi-3", name: "Orange", priceModifier: 0, sortOrder: 0 },
            { id: "oi-4", name: "Mango", priceModifier: 2, sortOrder: 1 }
          ]
        }
      ],
      isAvailable: true
    },
    {
      id: "prod-4",
      tenantId: "default",
      categoryId: "cat-2",
      name: "Last Items Burger",
      slug: "last-items-burger",
      type: "SIMPLE",
      basePrice: 35,
      currency: "ILS",
      images: [{ id: "img-4", url: "https://placehold.co/400x300?text=Burger", sortOrder: 0 }],
      optionGroups: [],
      isAvailable: true,
      isLastItems: true,
      lastItemsCount: 3
    }
  ],
  pizzeria: [
    {
      id: "pprod-1",
      tenantId: "pizzeria",
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
          required: false,
          minSelected: 0,
          maxSelected: 3,
          selectionType: "multi",
          items: [
            { id: "poi-3", name: "Mushrooms", priceModifier: 5, sortOrder: 0 },
            { id: "poi-4", name: "Olives", priceModifier: 4, sortOrder: 1 }
          ]
        }
      ],
      isAvailable: true
    }
  ]
};
export {
  CampaignAppliesToSchema,
  CampaignSchema,
  CampaignStatusSchema,
  CampaignTypeSchema,
  DeliverySettingsSchema,
  DeliveryZoneSchema,
  LAST_TENANT_KEY,
  MERCHANT_ROUTE_MODULE_MAP,
  PLACEMENT_LABELS_AR,
  PLACEMENT_OPTIONS_AR,
  PLATFORM_BRANDING,
  ROLE_PERMISSIONS,
  ROUTE_MODULE_MAP,
  TENANT_ADMIN_TENANT_PATCH_FIELDS,
  applyCampaign,
  applyOptionDeltas,
  buildOrderActionLinksSection,
  buildWhatsAppDeepLink,
  buildWhatsAppMessage,
  buildWhatsAppUrl,
  canAccessRoute,
  canEditField,
  canViewModule,
  customerComparePrice,
  customerUnitPrice,
  filterOptionGroupsForTenant,
  filterTenantPatchForRole,
  formatAddonNameWithPlacement,
  formatDateGregorian,
  formatDateISO,
  formatDateTimeGregorian,
  formatHalfAndHalfOptionDisplay,
  formatMoney,
  formatPlacementAr,
  formatPrice,
  formatTimeGregorian,
  generateId,
  getOperationalStatus,
  getSafeDashboardRoute,
  getTenantMerchantPortalUrl,
  haversineDistanceKm,
  isExternalAdminRedirect,
  isMarketAdminRole,
  isPlatformSuperAdmin,
  isStaffAdminRole,
  isStoreOpen,
  isTenantAdminRole,
  isValidWhatsAppPhone,
  mockCategories,
  mockProducts,
  mockTenants,
  parseSubdomainTenant,
  resolveTenantFromUrl,
  resolveTenantId,
  roundMoney,
  setLastTenant,
  stripProtectedCategoryFields,
  tenantBrandingToCssVars
};
//# sourceMappingURL=index.js.map