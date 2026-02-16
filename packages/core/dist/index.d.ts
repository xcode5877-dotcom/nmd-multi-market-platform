import { z } from 'zod';

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
}
type TenantStoreType = 'CLOTHING' | 'FOOD' | 'GENERAL';
type MarketCategory = 'FOOD' | 'CLOTHING' | 'GROCERIES' | 'BUTCHER' | 'OFFERS' | 'ELECTRONICS' | 'HOME' | 'GENERAL';
interface Tenant {
    id: string;
    name: string;
    slug: string;
    branding: TenantBranding;
    /** Store type: FOOD = CUSTOM option groups only; CLOTHING = SIZE/COLOR/CUSTOM; GENERAL = all. */
    type?: TenantStoreType;
    /** Market category for filtering in mall/market UI */
    marketCategory?: MarketCategory;
    /** Payment capabilities: cash-first; card=false shows "Coming soon" in storefront */
    paymentCapabilities?: {
        cash: boolean;
        card: boolean;
    };
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
    sortOrder: number;
    enabled?: boolean;
    defaultSelected?: boolean;
    /** When "HALF", storefront shows placement control (يمين/يسار/كامل). Placement does not affect price. */
    placement?: OptionPlacement;
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
    currency: string;
    /** Legacy: single image URL; auto-set from images[0] when images exist */
    imageUrl?: string;
    /** Multi-image gallery; when saving, imageUrl = images[0].url if images has ≥1 item */
    images?: ProductImage[];
    optionGroups: OptionGroup[];
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
    selectedOptions: SelectedOption[] | PizzaSelectedOption[];
    optionGroups: OptionGroup[];
    totalPrice: number;
    imageUrl?: string;
}

/** Per-tenant delivery zone. No minOrder. */
declare const DeliveryZoneSchema: z.ZodObject<{
    id: z.ZodString;
    tenantId: z.ZodString;
    name: z.ZodString;
    fee: z.ZodNumber;
    etaMinutes: z.ZodOptional<z.ZodNumber>;
    isActive: z.ZodDefault<z.ZodBoolean>;
    sortOrder: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    id: string;
    tenantId: string;
    name: string;
    fee: number;
    isActive: boolean;
    etaMinutes?: number | undefined;
    sortOrder?: number | undefined;
}, {
    id: string;
    tenantId: string;
    name: string;
    fee: number;
    etaMinutes?: number | undefined;
    isActive?: boolean | undefined;
    sortOrder?: number | undefined;
}>;
type DeliveryZone = z.infer<typeof DeliveryZoneSchema>;
/** Snapshot stored with order for delivery details. */
interface OrderDeliverySnapshot {
    method: 'PICKUP' | 'DELIVERY';
    zoneId?: string;
    zoneName?: string;
    fee?: number;
    addressText?: string;
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
    }, "strip", z.ZodTypeAny, {
        id: string;
        tenantId: string;
        name: string;
        fee: number;
        isActive: boolean;
        etaMinutes?: number | undefined;
        sortOrder?: number | undefined;
    }, {
        id: string;
        tenantId: string;
        name: string;
        fee: number;
        etaMinutes?: number | undefined;
        isActive?: boolean | undefined;
        sortOrder?: number | undefined;
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
    delivery?: OrderDeliverySnapshot;
}
interface Order {
    id: string;
    tenantId: string;
    status: 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELLED';
    fulfillmentType: OrderFulfillmentType;
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
    delivery?: OrderDeliverySnapshot;
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
 * Resolve tenant from URL (dev): ?tenant=slug or fallback to last selected in localStorage
 */
declare function resolveTenantFromUrl(): string | null;
/**
 * Persist last selected tenant for dev
 */
declare function setLastTenant(slugOrId: string): void;
/**
 * Convert tenant branding to CSS variables for runtime theming
 */
declare function tenantBrandingToCssVars(branding: TenantBranding): Record<string, string>;

/**
 * Format price for display (ILS ₪).
 * @deprecated Prefer formatMoney from './utils/money'
 */
declare function formatPrice(amount: number): string;
/**
 * Generate a unique ID (simple, for mock/local use)
 */
declare function generateId(): string;

/**
 * Centralized currency formatter for Israeli Shekel (₪).
 * Uses Intl.NumberFormat with he-IL for RTL-friendly output.
 */
interface FormatMoneyOptions {
    /** Currency code (default ILS) */
    currency?: string;
    /** Locale for formatting (default he-IL for RTL) */
    locale?: string;
    /** Minimum fraction digits */
    minimumFractionDigits?: number;
    /** Maximum fraction digits */
    maximumFractionDigits?: number;
}
/**
 * Format amount as Israeli Shekel (₪).
 * Handles NaN/invalid safely; integers and floats supported.
 */
declare function formatMoney(amount: number, opts?: FormatMoneyOptions): string;

/**
 * Build WhatsApp message for order handoff (Arabic, short, clear).
 */
declare function buildWhatsAppMessage(order: Order, tenant: Tenant): string;
/**
 * Check if a WhatsApp phone is valid (digits only, non-empty, reasonable length).
 * No fallback - phone must come from tenant.branding.whatsappPhone.
 */
declare function isValidWhatsAppPhone(phone: string | undefined | null): boolean;
/**
 * Build WhatsApp URL with pre-filled message.
 * Phone must be digits only (with country code). No fallback.
 */
declare function buildWhatsAppUrl(phone: string, message: string): string;

/** Re-export for addon placement (WHOLE/LEFT/RIGHT). */
type Placement = PizzaPlacement;
/** Arabic labels for addon placement. Single source of truth. */
declare const PLACEMENT_LABELS_AR: {
    readonly WHOLE: "كامل";
    readonly LEFT: "يسار";
    readonly RIGHT: "يمين";
};
/** Options for placement selector (value + Arabic label). */
declare const PLACEMENT_OPTIONS_AR: {
    value: Placement;
    label: string;
}[];
/** Format placement to Arabic label, or undefined if no placement. */
declare function formatPlacementAr(p?: Placement | null): string | undefined;
/** Format addon name with optional placement. Returns "name" or "name (label)". */
declare function formatAddonNameWithPlacement(name: string, p?: Placement | null): string;

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

export { type ApiClient, type Campaign, type CampaignAppliesTo, CampaignAppliesToSchema, CampaignSchema, type CampaignStatus, CampaignStatusSchema, type CampaignType, CampaignTypeSchema, type CartItem, type Category, type DeliverySettings, DeliverySettingsSchema, type DeliveryZone, DeliveryZoneSchema, type FormatMoneyOptions, LAST_TENANT_KEY, type LayoutStyle, type MarketCategory, type OptionGroup, type OptionGroupType, type OptionItem, type OptionPlacement, type OptionScope, type OptionSelectionType, type Order, type OrderDeliverySnapshot, type OrderFulfillmentType, type OrderPayload, PLACEMENT_LABELS_AR, PLACEMENT_OPTIONS_AR, type PaymentMethod, type PizzaOptionSelection, type PizzaPlacement, type PizzaSelectedOption, type PizzaSliceSelection, type Placement, type PricedLine, type Product, type ProductImage, type ProductType, type ProductVariant, ROLE_PERMISSIONS, type Role, type SelectedOption, type StaffUser, type StorefrontBanner, type StorefrontHero, type Template, type Tenant, type TenantBranding, type TenantStoreType, type VariantOptionValue, applyCampaign, applyOptionDeltas, buildWhatsAppMessage, buildWhatsAppUrl, filterOptionGroupsForTenant, formatAddonNameWithPlacement, formatMoney, formatPlacementAr, formatPrice, generateId, isValidWhatsAppPhone, mockCategories, mockProducts, mockTenants, parseSubdomainTenant, resolveTenantFromUrl, resolveTenantId, setLastTenant, tenantBrandingToCssVars };
