import { z } from 'zod';

/**
 * Market layout section for storefront home (admin-configured).
 * SLIDER = horizontal strip; MARKET_GROUP = "order together" group.
 */
type MarketSectionType = 'SLIDER' | 'MARKET_GROUP';
interface MarketSection {
    id: string;
    title: string;
    type: MarketSectionType;
    /** Tenant IDs or slugs. Order preserved. */
    storeIds: string[];
    /** Display order (lower = first). Optional for backward compatibility. */
    sortOrder?: number;
}

type LayoutStyle = 'minimal' | 'cozy' | 'bold' | 'modern' | 'default' | 'compact' | 'spacious';
interface StorefrontHero {
    title: string;
    subtitle: string;
    imageUrl?: string;
    ctaText?: string;
    /** CTA link URL - use ctaHref or ctaLink for compatibility */
    ctaLink?: string;
    ctaHref?: string;
}
interface StorefrontBanner {
    id: string;
    imageUrl: string;
    title?: string;
    subtitle?: string;
    /** @deprecated use ctaHref */
    link?: string;
    ctaText?: string;
    ctaHref?: string;
    enabled: boolean;
    /** Alias for enabled - use isActive in UI */
    isActive?: boolean;
    sortOrder: number;
    /** ISO datetime - when offer expires; show countdown if in future */
    expiresAt?: string;
    /** Show countdown pill when expiresAt is set (default true) */
    showCountdown?: boolean;
}
/** Homepage collection: category-based or manual product selection */
interface HomeCollection {
    id: string;
    title: string;
    type: 'category' | 'manual';
    /** Category ID when type='category' */
    targetId?: string;
    /** Product IDs when type='manual' */
    targetIds?: string[];
    isActive: boolean;
    sortOrder?: number;
}
interface TenantBranding {
    logoUrl: string;
    primaryColor: string;
    secondaryColor: string;
    fontFamily: string;
    radiusScale: number;
    layoutStyle: LayoutStyle;
    hero?: StorefrontHero;
    banners?: StorefrontBanner[];
    /** WhatsApp number for order notifications (e.g. 966501234567) */
    whatsappPhone?: string;
    /** Phone for call button. Falls back to whatsappPhone if not set */
    phone?: string;
    /** Admin-controlled homepage sections */
    collections?: HomeCollection[];
}
type TenantStoreType = 'CLOTHING' | 'FOOD' | 'GENERAL';
/** Manual override for store operational status */
type OperationalStatus = 'open' | 'closed' | 'busy';
/** Super-admin remote override: AUTO follows schedule, FORCE_OPEN/FORCE_CLOSED bypass everything */
type OverrideStatus = 'AUTO' | 'FORCE_OPEN' | 'FORCE_CLOSED';
/** When to accept orders: always, or only when status is open */
type OrderPolicy = 'accept_always' | 'accept_only_when_open';
type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
interface DayHours {
    open: string;
    close: string;
    isClosedDay: boolean;
}
type BusinessHours = Partial<Record<DayKey, DayHours>>;
type MarketCategory = 'FOOD' | 'CLOTHING' | 'GROCERIES' | 'BUTCHER' | 'OFFERS' | 'ELECTRONICS' | 'HOME' | 'GENERAL';
/** Store mode: RESTAURANT = cart/orders; PROFESSIONAL = contact-only, no cart */
type StoreMode = 'RESTAURANT' | 'PROFESSIONAL';
interface Tenant {
    id: string;
    name: string;
    slug: string;
    branding: TenantBranding;
    /** Store type: FOOD = CUSTOM option groups only; CLOTHING = SIZE/COLOR/CUSTOM; GENERAL = all. */
    type?: TenantStoreType;
    /** Store mode: RESTAURANT = cart/checkout; PROFESSIONAL = contact buttons, no cart */
    storeType?: StoreMode;
    /** Professional bio (rich text / HTML). For PROFESSIONAL stores. */
    about?: string;
    /** Multi-sector: RETAIL | RESTAURANT | SERVICE (default RETAIL) */
    businessType?: 'RETAIL' | 'RESTAURANT' | 'SERVICE';
    /** Market category for filtering in mall/market UI */
    marketCategory?: MarketCategory;
    /** Market group id when store participates in combined orders (same marketId = one cart). */
    marketId?: string | null;
    /** Payment capabilities: cash-first; card=false shows "Coming soon" in storefront */
    paymentCapabilities?: {
        cash: boolean;
        card: boolean;
    };
    /** Granular payment toggles resolved per store. */
    paymentMethods?: {
        cash: boolean;
        card: boolean;
        installments: boolean;
    };
    /** Manual override: open | closed | busy. If set, overrides businessHours. */
    operationalStatus?: OperationalStatus;
    /** accept_always = accept orders even when closed; accept_only_when_open = block when closed */
    orderPolicy?: OrderPolicy;
    /** Per-day hours: { mon: { open, close, isClosedDay }, ... } */
    businessHours?: BusinessHours;
    /** Show custom banner when busy (e.g. "We are busy, orders might take longer") */
    busyBannerEnabled?: boolean;
    /** Custom text for busy banner */
    busyBannerText?: string;
    /** Office hours (ساعات العمل). For PROFESSIONAL stores. Legacy free-text; prefer openTime/closeTime. */
    officeHours?: string;
    /** Daily open time (HH:mm, e.g. 08:00). Used with closeTime for automatic open/closed. Fallback 08:00. */
    openTime?: string;
    /** Daily close time (HH:mm, e.g. 17:00). Used with openTime for automatic open/closed. Fallback 17:00. */
    closeTime?: string;
    /** Manual override: when true, store displays as CLOSED regardless of openTime/closeTime. */
    forceClosed?: boolean;
    /** Super-admin remote override: AUTO (default) follows schedule; FORCE_OPEN/FORCE_CLOSED bypass everything. */
    overrideStatus?: OverrideStatus;
    /** Appointment duration in minutes. For PROFESSIONAL booking. */
    appointmentDuration?: number;
    /** Enable online booking (Coming Soon). For PROFESSIONAL stores. */
    bookingEnabled?: boolean;
    /** SLA category policy id (platform-admin configured). Used for order-ready timers. */
    categoryId?: string;
    /** When true, merchant sees "وحدة البيع" and "قفزة الكمية" in product form (e.g. weight-based businesses). */
    supportsWeightSelling?: boolean;
}

interface Template {
    id: string;
    name: string;
    layoutStyle: LayoutStyle;
    componentsPreset?: string;
    tokensPreset?: string;
}

type Role = 'OWNER' | 'MANAGER' | 'STAFF';
declare const ROLE_PERMISSIONS: Record<Role, {
    catalog: 'read' | 'write';
    orders: 'read' | 'write';
    campaigns: 'read' | 'write';
    settings: 'read' | 'write';
}>;
interface StaffUser {
    id: string;
    tenantId: string;
    name: string;
    phone?: string;
    email?: string;
    role: Role;
    createdAt: string;
}

interface Category {
    id: string;
    tenantId: string;
    name: string;
    slug: string;
    description?: string;
    imageUrl?: string;
    sortOrder: number;
    /** null = main category, string = subcategory of that parent */
    parentId?: string | null;
    /** default true; hide from storefront when false */
    isVisible?: boolean;
    /** When true, platform markup is not applied to products in this category (e.g. drinks). */
    markupExempt?: boolean;
}

type ProductType = 'SIMPLE' | 'CONFIGURABLE' | 'PIZZA' | 'APPAREL';
type OptionSelectionType = 'single' | 'multi';
type OptionScope = 'PRODUCT' | 'CATEGORY' | 'GLOBAL';
type OptionGroupType = 'SIZE' | 'COLOR' | 'CUSTOM';
interface VariantOptionValue {
    groupId: string;
    optionId: string;
}
interface ProductVariant {
    id: string;
    optionValues: VariantOptionValue[];
    stock: number;
    priceOverride?: number;
}
interface ProductImage {
    id: string;
    url: string;
    alt?: string;
    sortOrder: number;
}
type OptionPlacement = 'WHOLE' | 'HALF';
interface OptionItem {
    id: string;
    groupId?: string;
    name: string;
    /** @deprecated use priceDelta */
    priceModifier?: number;
    priceDelta?: number;
    /** Customer marketplace option surcharge (when repricing enabled). */
    displayPriceDelta?: number;
    sortOrder: number;
    enabled?: boolean;
    defaultSelected?: boolean;
    /** When "HALF", storefront shows placement control (يمين/يسار/كامل). */
    placement?: OptionPlacement;
    /** Explicit per-topping split switch from store admin. */
    allowSplitting?: boolean;
    /** Key into shared Super Admin modifier icon library (e.g. olive, cheese). */
    modifierIconKey?: string;
}
interface OptionGroup {
    id: string;
    tenantId?: string;
    name: string;
    /** SIZE | COLOR | CUSTOM for variant UI (swatches vs pills) */
    type?: OptionGroupType;
    required: boolean;
    minSelected: number;
    maxSelected: number;
    selectionType: OptionSelectionType;
    scope?: OptionScope;
    scopeId?: string;
    items: OptionItem[];
    /** When true, each selected option shows placement control (يمين/يسار/كامل). Pizza add-ons. */
    allowHalfPlacement?: boolean;
    /** Alias for allowHalfPlacement used by newer admin UX. */
    allowSplitting?: boolean;
}
type PizzaSliceSelection = 'WHOLE' | 'LEFT' | 'RIGHT';
interface PizzaOptionSelection {
    optionGroupId: string;
    sliceSelection: PizzaSliceSelection;
    selectedItemIds: string[];
}
interface Product {
    id: string;
    tenantId: string;
    categoryId: string;
    name: string;
    slug: string;
    description?: string;
    type: ProductType;
    basePrice: number;
    /** Customer marketplace price (includes platform markup when enabled server-side). */
    displayPrice?: number;
    /** Customer compare-at price for offers (repriced when applicable). */
    displayComparePrice?: number;
    currency: string;
    /** Legacy: single image URL; auto-set from images[0] when images exist */
    imageUrl?: string;
    /** Multi-image gallery; when saving, imageUrl = images[0].url if images has ≥1 item */
    images?: ProductImage[];
    optionGroups: OptionGroup[];
    /** IDs of catalog option groups linked to this product (resolved to optionGroups when loading catalog) */
    optionGroupIds?: string[];
    /** Auto-generated variants (cartesian product of option groups); stock/priceOverride per variant */
    variants?: ProductVariant[];
    stock?: number;
    isAvailable: boolean;
    inStock?: boolean;
    quantity?: number;
    lowStockThreshold?: number;
    isLastItems?: boolean;
    lastItemsCount?: number;
    /** ISO date string - for "وصل حديثًا" sorting and "جديد" badge */
    createdAt?: string;
    /** Show in "مختارات" section on homepage */
    isFeatured?: boolean;
    /** When true, product is hidden from storefront but kept in catalog for admins */
    isArchived?: boolean;
    /** Display order within category (lower = first). Storefront sorts by this then createdAt. */
    sortOrder?: number;
    /** Quantity increment for add-to-cart (default 1). Use 0.5 for vegetables/butchery (e.g. kg). */
    quantityStep?: number;
    /** Unit label for display (e.g. "كيلو", "حبة", "كرتونة"). Default "حبة" when omitted. */
    unitName?: string;
    /** When true, product is sold by weight/fraction (show decimals and weight unit). When false, always integer and "حبة". */
    isWeightBased?: boolean;
}

interface SelectedOption {
    optionGroupId: string;
    optionItemIds: string[];
}
type PizzaPlacement = 'WHOLE' | 'LEFT' | 'RIGHT';
interface PizzaSelectedOption {
    optionGroupId: string;
    sliceSelection: 'WHOLE' | 'LEFT' | 'RIGHT';
    optionItemIds: string[];
    /** Per-option placement when group has allowHalfPlacement. optionId -> WHOLE|LEFT|RIGHT. Default WHOLE. */
    optionPlacements?: Record<string, PizzaPlacement>;
}
interface CartItem {
    id: string;
    productId: string;
    productName: string;
    categoryId?: string;
    quantity: number;
    basePrice: number;
    /** Repriced customer unit (base + options markup) before campaigns; merchant base stays in basePrice. */
    customerUnitPrice?: number;
    selectedOptions: SelectedOption[] | PizzaSelectedOption[];
    optionGroups: OptionGroup[];
    totalPrice: number;
    imageUrl?: string;
    /** Quantity increment (e.g. 0.5 for kg). Default 1. Used for +/- and display. */
    quantityStep?: number;
    /** Unit label (e.g. "كيلو", "حبة"). For display next to quantity. */
    unitName?: string;
    /** When true, item is sold by weight (decimals); when false, strict integer and "حبة". */
    isWeightBased?: boolean;
}

/** Per-tenant delivery zone. No minOrder. Geo-radius: center + radiusKm for distance-based pricing. */
declare const DeliveryZoneSchema: z.ZodObject<{
    id: z.ZodString;
    tenantId: z.ZodString;
    name: z.ZodString;
    fee: z.ZodNumber;
    etaMinutes: z.ZodOptional<z.ZodNumber>;
    isActive: z.ZodDefault<z.ZodBoolean>;
    sortOrder: z.ZodOptional<z.ZodNumber>;
    centerLat: z.ZodOptional<z.ZodNumber>;
    centerLng: z.ZodOptional<z.ZodNumber>;
    radiusKm: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    id: string;
    tenantId: string;
    name: string;
    fee: number;
    isActive: boolean;
    etaMinutes?: number | undefined;
    sortOrder?: number | undefined;
    centerLat?: number | undefined;
    centerLng?: number | undefined;
    radiusKm?: number | undefined;
}, {
    id: string;
    tenantId: string;
    name: string;
    fee: number;
    etaMinutes?: number | undefined;
    isActive?: boolean | undefined;
    sortOrder?: number | undefined;
    centerLat?: number | undefined;
    centerLng?: number | undefined;
    radiusKm?: number | undefined;
}>;
type DeliveryZone = z.infer<typeof DeliveryZoneSchema>;
/** Customer delivery pin (lat/lng from checkout map). */
interface DeliveryLocation {
    lat: number;
    lng: number;
}
/** Snapshot stored with order for delivery details. */
interface OrderDeliverySnapshot {
    method: 'PICKUP' | 'DELIVERY';
    zoneId?: string;
    zoneName?: string;
    fee?: number;
    addressText?: string;
    /** Customer pin from Location Picker (for courier map and Google Maps). */
    deliveryLocation?: DeliveryLocation;
    /** 'gps' = address set via detect/last location (GPS Verified). */
    deliveryAddressSource?: 'gps' | 'manual';
}
declare const DeliverySettingsSchema: z.ZodObject<{
    tenantId: z.ZodString;
    modes: z.ZodObject<{
        pickup: z.ZodBoolean;
        delivery: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        pickup: boolean;
        delivery: boolean;
    }, {
        pickup: boolean;
        delivery: boolean;
    }>;
    deliveryFee: z.ZodOptional<z.ZodNumber>;
    zones: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        tenantId: z.ZodString;
        name: z.ZodString;
        fee: z.ZodNumber;
        etaMinutes: z.ZodOptional<z.ZodNumber>;
        isActive: z.ZodDefault<z.ZodBoolean>;
        sortOrder: z.ZodOptional<z.ZodNumber>;
        centerLat: z.ZodOptional<z.ZodNumber>;
        centerLng: z.ZodOptional<z.ZodNumber>;
        radiusKm: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        tenantId: string;
        name: string;
        fee: number;
        isActive: boolean;
        etaMinutes?: number | undefined;
        sortOrder?: number | undefined;
        centerLat?: number | undefined;
        centerLng?: number | undefined;
        radiusKm?: number | undefined;
    }, {
        id: string;
        tenantId: string;
        name: string;
        fee: number;
        etaMinutes?: number | undefined;
        isActive?: boolean | undefined;
        sortOrder?: number | undefined;
        centerLat?: number | undefined;
        centerLng?: number | undefined;
        radiusKm?: number | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    tenantId: string;
    modes: {
        pickup: boolean;
        delivery: boolean;
    };
    deliveryFee?: number | undefined;
    zones?: {
        id: string;
        tenantId: string;
        name: string;
        fee: number;
        isActive: boolean;
        etaMinutes?: number | undefined;
        sortOrder?: number | undefined;
        centerLat?: number | undefined;
        centerLng?: number | undefined;
        radiusKm?: number | undefined;
    }[] | undefined;
}, {
    tenantId: string;
    modes: {
        pickup: boolean;
        delivery: boolean;
    };
    deliveryFee?: number | undefined;
    zones?: {
        id: string;
        tenantId: string;
        name: string;
        fee: number;
        etaMinutes?: number | undefined;
        isActive?: boolean | undefined;
        sortOrder?: number | undefined;
        centerLat?: number | undefined;
        centerLng?: number | undefined;
        radiusKm?: number | undefined;
    }[] | undefined;
}>;
type DeliverySettings = z.infer<typeof DeliverySettingsSchema>;

type OrderFulfillmentType = 'PICKUP' | 'DELIVERY';
type PaymentMethod = 'CASH' | 'CARD' | 'ONLINE';
interface OrderPayload {
    tenantId: string;
    items: CartItem[];
    fulfillmentType: OrderFulfillmentType;
    paymentMethod: PaymentMethod;
    notes?: string;
    customerName?: string;
    customerPhone?: string;
    deliveryAddress?: string;
    /** Customer pin from Location Picker (lat/lng). */
    deliveryLocation?: {
        lat: number;
        lng: number;
    };
    /** When set to 'gps', address was set via one-tap detect or last location (show "GPS Verified"). */
    deliveryAddressSource?: 'gps' | 'manual';
    delivery?: OrderDeliverySnapshot;
    /** Links multiple orders (e.g. multi-store cart) for customer tracking. */
    orderGroupId?: string;
    /** Applied coupon id (from validate); backend marks it used when order is created. */
    couponId?: string;
    /** Cart-level discount amount (sent with first order when coupon applies to whole cart). */
    couponDiscountAmount?: number;
}
interface Order {
    id: string;
    tenantId: string;
    status: 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELLED';
    fulfillmentType: OrderFulfillmentType;
    /** Multi-sector: PRODUCT | FOOD | SERVICE (default PRODUCT) */
    orderType?: 'PRODUCT' | 'FOOD' | 'SERVICE';
    paymentMethod: PaymentMethod;
    items: CartItem[];
    subtotal: number;
    total: number;
    currency: string;
    createdAt: string;
    notes?: string;
    customerName?: string;
    customerPhone?: string;
    deliveryAddress?: string;
    /** Customer pin from Location Picker (lat/lng). Persisted for courier map and Google Maps. */
    deliveryLocation?: {
        lat: number;
        lng: number;
    };
    /** 'gps' = one-tap detect or last location (show "GPS Verified" in Admin/Courier). */
    deliveryAddressSource?: 'gps' | 'manual';
    delivery?: OrderDeliverySnapshot;
    /** Links multiple orders (multi-store cart) for customer tracking. */
    orderGroupId?: string;
}

declare const CampaignStatusSchema: z.ZodEnum<["draft", "active", "paused"]>;
type CampaignStatus = z.infer<typeof CampaignStatusSchema>;
declare const CampaignTypeSchema: z.ZodEnum<["PERCENT", "FIXED", "BUNDLE_PLACEHOLDER"]>;
type CampaignType = z.infer<typeof CampaignTypeSchema>;
declare const CampaignAppliesToSchema: z.ZodEnum<["ALL", "CATEGORIES", "PRODUCTS"]>;
type CampaignAppliesTo = z.infer<typeof CampaignAppliesToSchema>;
declare const CampaignSchema: z.ZodObject<{
    id: z.ZodString;
    tenantId: z.ZodString;
    name: z.ZodString;
    status: z.ZodEnum<["draft", "active", "paused"]>;
    type: z.ZodEnum<["PERCENT", "FIXED", "BUNDLE_PLACEHOLDER"]>;
    value: z.ZodNumber;
    appliesTo: z.ZodEnum<["ALL", "CATEGORIES", "PRODUCTS"]>;
    categoryIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    productIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    startAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    endAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    stackable: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    priority: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    id: string;
    tenantId: string;
    name: string;
    value: number;
    type: "PERCENT" | "FIXED" | "BUNDLE_PLACEHOLDER";
    status: "draft" | "active" | "paused";
    appliesTo: "ALL" | "CATEGORIES" | "PRODUCTS";
    stackable: boolean;
    priority: number;
    categoryIds?: string[] | undefined;
    productIds?: string[] | undefined;
    startAt?: string | null | undefined;
    endAt?: string | null | undefined;
}, {
    id: string;
    tenantId: string;
    name: string;
    value: number;
    type: "PERCENT" | "FIXED" | "BUNDLE_PLACEHOLDER";
    status: "draft" | "active" | "paused";
    appliesTo: "ALL" | "CATEGORIES" | "PRODUCTS";
    categoryIds?: string[] | undefined;
    productIds?: string[] | undefined;
    startAt?: string | null | undefined;
    endAt?: string | null | undefined;
    stackable?: boolean | undefined;
    priority?: number | undefined;
}>;
type Campaign = z.infer<typeof CampaignSchema>;

interface PricedLine {
    basePrice: number;
    optionDelta: number;
    campaignDiscount: number;
    finalPrice: number;
    campaign?: Campaign;
}
/**
 * Apply options price deltas to a base price.
 */
declare function applyOptionDeltas(basePrice: number, items: OptionItem[]): number;
/**
 * Apply single best campaign (highest priority) if not stackable.
 * Returns discount amount.
 */
declare function applyCampaign(price: number, campaigns: Campaign[], productId?: string, categoryId?: string): {
    discount: number;
    campaign?: Campaign;
};

/** Super-admin managed modifier icon library entry (market-scoped in market-config). */
interface ModifierIcon {
    id: string;
    /** Stable slug used on OptionItem.modifierIconKey (e.g. olive, mushroom). */
    key: string;
    labelAr: string;
    labelHe?: string;
    labelEn?: string;
    /** Uploaded CDN URL; empty → client uses bundled asset for [key]. */
    iconUrl: string;
    keywords: string[];
    category?: string;
    active: boolean;
    sortOrder: number;
}

/** Platform admin roles — shared by nmd-admin, merchant admin, and mock-api. */
type AdminRole = 'ROOT_ADMIN' | 'SUPER_ADMIN' | 'MARKET_ADMIN' | 'TENANT_ADMIN' | 'COURIER' | 'CUSTOMER';
type AdminModule = 'dashboard' | 'orders' | 'orderBoard' | 'products' | 'categories' | 'options' | 'campaigns' | 'storeSettings' | 'workingHours' | 'coupons' | 'settlementSummary' | 'settlementLedger' | 'settlementPayments' | 'platformFee' | 'commission' | 'markupExempt' | 'homeBuilder' | 'pushBroadcast' | 'globalRewards' | 'drivers' | 'marketsList' | 'allTenants' | 'marketOverview' | 'marketStores' | 'marketOrders' | 'marketReports' | 'marketBanners' | 'marketDispatch' | 'marketCouriers' | 'marketFinance' | 'marketPlatformFee' | 'platformSettings' | 'platformFees' | 'platformEconomics' | 'superAdminReports' | 'customers' | 'deliveryLeads' | 'audit' | 'contests' | 'staff' | 'branding' | 'homepage' | 'deliveryZones' | 'platformCatalog' | 'modifierIcons' | 'luckyWheel' | 'externalOrders' | 'monitoring';
type EditableField = 'markupExempt' | 'platformFee' | 'commissionType' | 'commissionValue' | 'financialConfig' | 'marketId' | 'enabled' | 'deliveryFeeModel' | 'loyaltyBonus';
declare function isPlatformSuperAdmin(role: string | undefined): boolean;
declare function isMarketAdminRole(role: string | undefined): boolean;
declare function isTenantAdminRole(role: string | undefined): boolean;
declare function isStaffAdminRole(role: string | undefined): boolean;
/** Nav item path → module (nmd-admin super nav + shared routes). */
declare const ROUTE_MODULE_MAP: Record<string, AdminModule>;
/** Merchant admin (/merchant) path → module. */
declare const MERCHANT_ROUTE_MODULE_MAP: Record<string, AdminModule>;
declare function canViewModule(role: string | undefined, module: AdminModule): boolean;
declare function canEditField(role: string | undefined, field: EditableField): boolean;
declare function canAccessRoute(role: string | undefined, route: string): boolean;
type AdminAppContext = 'nmd-admin' | 'merchant';
/** Cross-app URL for store owners (outside /market-admin router basename). */
declare function getTenantMerchantPortalUrl(tenantSlug?: string | null): string;
declare function isExternalAdminRedirect(path: string): boolean;
declare function getSafeDashboardRoute(role: string | undefined, context?: AdminAppContext, tenantSlug?: string | null): string;
/** TENANT_ADMIN allowed keys on PATCH/PUT /tenants/:id (store owner self-service). */
declare const TENANT_ADMIN_TENANT_PATCH_FIELDS: readonly ["name", "about", "phone", "whatsappPhone", "officeHours", "openTime", "closeTime", "forceClosed", "operationalStatus", "overrideStatus", "orderPolicy", "businessHours", "busyBannerEnabled", "busyBannerText", "bookingEnabled", "storeType", "addressLine", "location", "supportsWeightSelling", "paymentMethods", "paymentCapabilities", "banners", "hero", "logoUrl", "primaryColor", "secondaryColor", "fontFamily", "radiusScale", "layoutStyle", "collections"];
type TenantPatchField = (typeof TENANT_ADMIN_TENANT_PATCH_FIELDS)[number];
declare function filterTenantPatchForRole(role: string | undefined, updates: Record<string, unknown>): Record<string, unknown>;
declare function stripProtectedCategoryFields<T extends {
    markupExempt?: boolean;
}>(role: string | undefined, categories: T[], existing: T[]): T[];

/**
 * Parse subdomain to extract tenant ID for production.
 * e.g. "acme.nmd-store.com" -> "acme"
 */
declare function parseSubdomainTenant(hostname: string): string | null;
/**
 * Resolve tenant ID from URL params (dev) or subdomain (prod)
 */
declare function resolveTenantId(hostname: string, searchParams: URLSearchParams): string | null;
declare const LAST_TENANT_KEY = "nmd.lastTenant";
/**
 * Resolve effective operational status from tenant.
 * 0. If overrideStatus is FORCE_CLOSED, return 'closed' (super-admin remote override).
 *    If overrideStatus is FORCE_OPEN, return 'open' (super-admin remote override).
 * 1. If forceClosed is true (merchant manual override), return 'closed'.
 * 2. If operationalStatus is 'open' or 'busy', use it (priority over time so dev/manual override works).
 * 3. If openTime/closeTime are used (simple daily window), compare current time in store TZ (supports next-day close e.g. 03:00).
 * 4. If operationalStatus is set (manual override), use it.
 * 5. Else compute from businessHours using store timezone (Asia/Jerusalem).
 */
declare function getOperationalStatus(tenant: Pick<Tenant, 'operationalStatus' | 'businessHours' | 'openTime' | 'closeTime' | 'forceClosed' | 'overrideStatus'>): OperationalStatus;
/**
 * Whether the store is open (accepting orders from schedule + override).
 * For order blocking, also check orderPolicy.
 */
declare function isStoreOpen(tenant: Pick<Tenant, 'operationalStatus' | 'businessHours' | 'openTime' | 'closeTime' | 'forceClosed' | 'overrideStatus'>): boolean;
/**
 * Resolve tenant from URL (dev): ?tenant=slug or fallback to last selected in localStorage
 */
declare function resolveTenantFromUrl(): string | null;
/**
 * Persist last selected tenant for dev
 */
declare function setLastTenant(slugOrId: string): void;
/** Platform (mall/city) brand identity – Now Market. Official logo colors, high-end native app design. */
declare const PLATFORM_BRANDING: TenantBranding;
/**
 * Convert tenant branding to CSS variables for runtime theming.
 * If branding is null or undefined, reverts to PLATFORM_BRANDING so platform colors are applied immediately.
 */
declare function tenantBrandingToCssVars(branding: TenantBranding | null | undefined): Record<string, string>;

/**
 * Gregorian (ميلادي) date formatting only. Never Hijri.
 * Uses en-GB for DD/MM/YYYY and consistent Gregorian calendar.
 */
/**
 * Format date as Gregorian DD/MM/YYYY.
 */
declare function formatDateGregorian(date: Date | string): string;
/**
 * Format date and time as Gregorian (DD/MM/YYYY, HH:mm).
 */
declare function formatDateTimeGregorian(date: Date | string): string;
/**
 * Format time only as HH:mm (24h, Gregorian).
 */
declare function formatTimeGregorian(date: Date | string): string;
/**
 * Format as ISO date YYYY-MM-DD (Gregorian).
 */
declare function formatDateISO(date: Date | string): string;

/** Customer-visible unit price (marketplace repriced when server sets displayPrice). */
declare function customerUnitPrice(product: Pick<Product, 'basePrice' | 'displayPrice'> & {
    priceOverride?: number;
}, variantPriceOverride?: number): number;
/** Strikethrough / compare price for offers when repriced. */
declare function customerComparePrice(product: Pick<Product, 'basePrice' | 'displayPrice' | 'displayComparePrice'>): number | undefined;

/**
 * Format price for display (ILS ₪, 2 decimals, Western numerals).
 * @deprecated Prefer formatMoney from './utils/money'
 */
declare function formatPrice(amount: number): string;
/**
 * Generate a unique ID (simple, for mock/local use)
 */
declare function generateId(): string;

/**
 * Global currency: ILS (Israeli Shekel). Display as ₪ or شيكل in UI.
 * Uses Western numerals (1,2,3) and 2 decimal places for financial amounts.
 */
interface FormatMoneyOptions {
    /** Currency code (default ILS) */
    currency?: string;
    /** Minimum fraction digits (default 2 for money) */
    minimumFractionDigits?: number;
    /** Maximum fraction digits (default 2) */
    maximumFractionDigits?: number;
}
/**
 * Round to 2 decimal places for money (avoids floating-point errors in price × quantity).
 */
declare function roundMoney(amount: number): number;
/**
 * Format amount as Israeli Shekel (₪). Gregorian/Western numerals only.
 * Financial numbers: 2 decimal places. Handles NaN/invalid safely.
 */
declare function formatMoney(amount: number, opts?: FormatMoneyOptions): string;

/**
 * Build WhatsApp message for order handoff (Arabic, short, clear).
 * Includes: Product names, quantities, total price, customer address.
 * Defensive: handles missing or empty items; all text is intended for encodeURIComponent by caller.
 */
declare function buildWhatsAppMessage(order: Order, tenant: Tenant): string;
/**
 * Check if a WhatsApp phone is valid (digits only, non-empty, reasonable length).
 * No fallback - phone must come from tenant.branding.whatsappPhone.
 */
declare function isValidWhatsAppPhone(phone: string | undefined | null): boolean;
/**
 * Build WhatsApp web URL (wa.me) with pre-filled message.
 * Use for desktop; opens in browser. Phone must be digits only (with country code). No fallback.
 */
declare function buildWhatsAppUrl(phone: string, message: string): string;
/**
 * Build WhatsApp native deep link (whatsapp://send) for mobile.
 * Opens the WhatsApp app directly without a browser landing page; the current tab stays on your site.
 * Phone must be digits only (with country code). No fallback.
 */
declare function buildWhatsAppDeepLink(phone: string, message: string): string;
/**
 * Build the "Merchant Control Section" text to append to the WhatsApp order message.
 * Contains quick-action links so the merchant can update order status from WhatsApp.
 * [ORDER_ID] is replaced with the given orderId.
 * @param orderId - Order ID to inject into links
 * @param baseUrl - Optional base URL (e.g. https://nmd.marketing/merchant). No trailing slash.
 */
declare function buildOrderActionLinksSection(orderId: string, baseUrl?: string): string;

/** Re-export for addon placement (WHOLE/LEFT/RIGHT). */
type Placement = PizzaPlacement;
/** Arabic labels for addon placement (pizza half-and-half). */
declare const PLACEMENT_LABELS_AR: {
    readonly WHOLE: "كاملة";
    readonly LEFT: "نصف يسار";
    readonly RIGHT: "نصف يمين";
};
/** Options for placement selector (value + Arabic label). */
declare const PLACEMENT_OPTIONS_AR: {
    value: Placement;
    label: string;
}[];
/** Format placement to Arabic label, or undefined if no placement / whole. */
declare function formatPlacementAr(p?: Placement | null): string | undefined;
/**
 * Format addon name with optional placement.
 * Whole pizza: name only; left/right: `name (نصف …)`.
 */
declare function formatAddonNameWithPlacement(name: string, p?: Placement | null): string;
/** Format a single option group selection for display. When two options with LEFT and RIGHT (half & half), returns "نصف X / نصف Y". */
declare function formatHalfAndHalfOptionDisplay(ids: string[], placements: Record<string, Placement>, getOptionName: (id: string) => string | undefined): string;

/**
 * Haversine formula: exact distance between two GPS points on Earth.
 * Returns distance in kilometers.
 */
declare function haversineDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number;

/**
 * Filter option groups by tenant type.
 * - FOOD: only CUSTOM groups (hide SIZE, COLOR entirely).
 * - CLOTHING: allow SIZE, COLOR, CUSTOM.
 * - GENERAL: allow all.
 */
declare function filterOptionGroupsForTenant(tenantType: TenantStoreType | null | undefined, groups: OptionGroup[]): OptionGroup[];

/**
 * API Client interface - abstract layer for backend integration.
 * Implement this with real HTTP client when backend is ready.
 */

interface ApiClient {
    getTenant(tenantId: string): Promise<Tenant | null>;
    getMenu(tenantId: string): Promise<Category[]>;
    getProduct(tenantId: string, productId: string): Promise<Product | null>;
    getProducts(tenantId: string, categoryId?: string): Promise<Product[]>;
    createOrder(tenantId: string, payload: OrderPayload): Promise<Order>;
    getOrder(orderId: string): Promise<Order | null>;
    getCampaigns(tenantId: string): Promise<Campaign[]>;
    getDeliverySettings(tenantId: string): Promise<DeliverySettings | null>;
    getDeliveryZones(tenantId: string): Promise<DeliveryZone[]>;
    getOptionGroups(tenantId: string): Promise<OptionGroup[]>;
    getOptionItems(tenantId: string, groupId: string): Promise<OptionItem[]>;
}

declare const mockTenants: Record<string, Tenant>;
declare const mockCategories: Record<string, Category[]>;
declare const mockProducts: Record<string, Product[]>;

export { type AdminAppContext, type AdminModule, type AdminRole, type ApiClient, type BusinessHours, type Campaign, type CampaignAppliesTo, CampaignAppliesToSchema, CampaignSchema, type CampaignStatus, CampaignStatusSchema, type CampaignType, CampaignTypeSchema, type CartItem, type Category, type DayHours, type DayKey, type DeliveryLocation, type DeliverySettings, DeliverySettingsSchema, type DeliveryZone, DeliveryZoneSchema, type EditableField, type FormatMoneyOptions, type HomeCollection, LAST_TENANT_KEY, type LayoutStyle, MERCHANT_ROUTE_MODULE_MAP, type MarketCategory, type MarketSection, type MarketSectionType, type ModifierIcon, type OperationalStatus, type OptionGroup, type OptionGroupType, type OptionItem, type OptionPlacement, type OptionScope, type OptionSelectionType, type Order, type OrderDeliverySnapshot, type OrderFulfillmentType, type OrderPayload, type OrderPolicy, type OverrideStatus, PLACEMENT_LABELS_AR, PLACEMENT_OPTIONS_AR, PLATFORM_BRANDING, type PaymentMethod, type PizzaOptionSelection, type PizzaPlacement, type PizzaSelectedOption, type PizzaSliceSelection, type Placement, type PricedLine, type Product, type ProductImage, type ProductType, type ProductVariant, ROLE_PERMISSIONS, ROUTE_MODULE_MAP, type Role, type SelectedOption, type StaffUser, type StoreMode, type StorefrontBanner, type StorefrontHero, TENANT_ADMIN_TENANT_PATCH_FIELDS, type Template, type Tenant, type TenantBranding, type TenantPatchField, type TenantStoreType, type VariantOptionValue, applyCampaign, applyOptionDeltas, buildOrderActionLinksSection, buildWhatsAppDeepLink, buildWhatsAppMessage, buildWhatsAppUrl, canAccessRoute, canEditField, canViewModule, customerComparePrice, customerUnitPrice, filterOptionGroupsForTenant, filterTenantPatchForRole, formatAddonNameWithPlacement, formatDateGregorian, formatDateISO, formatDateTimeGregorian, formatHalfAndHalfOptionDisplay, formatMoney, formatPlacementAr, formatPrice, formatTimeGregorian, generateId, getOperationalStatus, getSafeDashboardRoute, getTenantMerchantPortalUrl, haversineDistanceKm, isExternalAdminRedirect, isMarketAdminRole, isPlatformSuperAdmin, isStaffAdminRole, isStoreOpen, isTenantAdminRole, isValidWhatsAppPhone, mockCategories, mockProducts, mockTenants, parseSubdomainTenant, resolveTenantFromUrl, resolveTenantId, roundMoney, setLastTenant, stripProtectedCategoryFields, tenantBrandingToCssVars };
