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
  sortOrder: z2.number().optional()
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
function tenantBrandingToCssVars(branding) {
  const style = LAYOUT_STYLES[branding.layoutStyle] ?? LAYOUT_STYLES.default;
  return {
    "--color-primary": branding.primaryColor,
    "--color-secondary": branding.secondaryColor,
    "--radius": `${branding.radiusScale * 4}px`,
    "--font": branding.fontFamily,
    "--layout-header": style.header,
    "--layout-card": style.card,
    "--layout-section": style.section,
    "--layout-button": style.button,
    "--layout-badge": style.badge
  };
}

// src/utils/money.ts
function formatMoney(amount, opts = {}) {
  const {
    currency = "ILS",
    locale = "he-IL",
    minimumFractionDigits = 0,
    maximumFractionDigits = 2
  } = opts;
  const n = Number(amount);
  if (Number.isNaN(n) || !Number.isFinite(n)) return "\u20AA 0";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits,
    maximumFractionDigits
  }).format(n);
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
  WHOLE: "\u0643\u0627\u0645\u0644",
  LEFT: "\u064A\u0633\u0627\u0631",
  RIGHT: "\u064A\u0645\u064A\u0646"
};
var PLACEMENT_OPTIONS_AR = [
  { value: "WHOLE", label: PLACEMENT_LABELS_AR.WHOLE },
  { value: "RIGHT", label: PLACEMENT_LABELS_AR.RIGHT },
  { value: "LEFT", label: PLACEMENT_LABELS_AR.LEFT }
];
function formatPlacementAr(p) {
  if (!p) return void 0;
  return PLACEMENT_LABELS_AR[p] ?? p;
}
function formatAddonNameWithPlacement(name, p) {
  const label = formatPlacementAr(p);
  return label ? `${name} (${label})` : name;
}

// src/utils/whatsapp.ts
function buildWhatsAppMessage(order, tenant) {
  const lines = [];
  lines.push(`*\u0637\u0644\u0628 \u062C\u062F\u064A\u062F - ${tenant.name}*`);
  lines.push("");
  lines.push(`#${order.id.slice(0, 8)}`);
  lines.push(`\u0627\u0644\u062A\u0627\u0631\u064A\u062E: ${new Date(order.createdAt).toLocaleDateString("ar-SA")}`);
  lines.push("");
  const delivery = order.delivery;
  if (order.fulfillmentType === "DELIVERY" || delivery?.method === "DELIVERY") {
    lines.push("\u0637\u0631\u064A\u0642\u0629 \u0627\u0644\u0627\u0633\u062A\u0644\u0627\u0645: \u062A\u0648\u0635\u064A\u0644");
    if (delivery?.zoneName) lines.push(`\u0627\u0644\u0645\u0646\u0637\u0642\u0629: ${delivery.zoneName}`);
    if (delivery?.fee != null) lines.push(`\u0633\u0639\u0631 \u0627\u0644\u062A\u0648\u0635\u064A\u0644: \u20AA${delivery.fee}`);
    if (delivery?.addressText) lines.push(`\u0627\u0644\u0639\u0646\u0648\u0627\u0646: ${delivery.addressText}`);
    else if (order.deliveryAddress) lines.push(`\u0627\u0644\u0639\u0646\u0648\u0627\u0646: ${order.deliveryAddress}`);
  } else {
    lines.push("\u0637\u0631\u064A\u0642\u0629 \u0627\u0644\u0627\u0633\u062A\u0644\u0627\u0645: \u0627\u0633\u062A\u0644\u0627\u0645 \u0645\u0646 \u0627\u0644\u0645\u062D\u0644");
  }
  if (order.customerName) lines.push(`\u0627\u0644\u0627\u0633\u0645: ${order.customerName}`);
  if (order.customerPhone) lines.push(`\u0627\u0644\u062C\u0648\u0627\u0644: ${order.customerPhone}`);
  lines.push("");
  lines.push("*\u0627\u0644\u0639\u0646\u0627\u0635\u0631:*");
  for (const item of order.items) {
    const optParts = item.selectedOptions.map((s) => {
      const g = item.optionGroups.find((x) => x.id === s.optionGroupId);
      const ids = "optionItemIds" in s ? s.optionItemIds : [];
      const placements = "optionPlacements" in s ? s.optionPlacements ?? {} : {};
      return ids.map((id) => {
        const name = g?.items.find((i) => i.id === id)?.name;
        if (!name) return "";
        return formatAddonNameWithPlacement(name, placements[id]);
      }).filter(Boolean).join("\u060C ");
    }).filter(Boolean).join(" | ");
    lines.push(`\u2022 ${item.productName} x${item.quantity}${optParts ? ` (${optParts})` : ""}: ${formatMoney(item.totalPrice)}`);
  }
  lines.push("");
  lines.push(`\u0627\u0644\u0625\u062C\u0645\u0627\u0644\u064A: ${formatMoney(order.total)}`);
  if (order.notes) lines.push(`\u0645\u0644\u0627\u062D\u0638\u0627\u062A: ${order.notes}`);
  return lines.join("\n");
}
function isValidWhatsAppPhone(phone) {
  if (!phone || typeof phone !== "string") return false;
  const cleaned = phone.replace(/\D/g, "");
  return cleaned.length >= 9 && /^\d+$/.test(cleaned);
}
function buildWhatsAppUrl(phone, message) {
  const cleaned = phone.replace(/\D/g, "");
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${cleaned}?text=${encoded}`;
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
  PLACEMENT_LABELS_AR,
  PLACEMENT_OPTIONS_AR,
  ROLE_PERMISSIONS,
  applyCampaign,
  applyOptionDeltas,
  buildWhatsAppMessage,
  buildWhatsAppUrl,
  filterOptionGroupsForTenant,
  formatAddonNameWithPlacement,
  formatMoney,
  formatPlacementAr,
  formatPrice,
  generateId,
  isValidWhatsAppPhone,
  mockCategories,
  mockProducts,
  mockTenants,
  parseSubdomainTenant,
  resolveTenantFromUrl,
  resolveTenantId,
  setLastTenant,
  tenantBrandingToCssVars
};
//# sourceMappingURL=index.js.map