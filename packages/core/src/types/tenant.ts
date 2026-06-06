export type LayoutStyle = 'minimal' | 'cozy' | 'bold' | 'modern' | 'default' | 'compact' | 'spacious';

export interface StorefrontHero {
  title: string;
  subtitle: string;
  imageUrl?: string;
  ctaText?: string;
  /** CTA link URL - use ctaHref or ctaLink for compatibility */
  ctaLink?: string;
  ctaHref?: string;
}

export interface StorefrontBanner {
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
export interface HomeCollection {
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

export interface TenantBranding {
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

export type TenantStoreType = 'CLOTHING' | 'FOOD' | 'GENERAL';

/** Manual override for store operational status */
export type OperationalStatus = 'open' | 'closed' | 'busy';

/** Super-admin remote override: AUTO follows schedule, FORCE_OPEN/FORCE_CLOSED bypass everything */
export type OverrideStatus = 'AUTO' | 'FORCE_OPEN' | 'FORCE_CLOSED';

/** When to accept orders: always, or only when status is open */
export type OrderPolicy = 'accept_always' | 'accept_only_when_open';

export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export interface DayHours {
  open: string;
  close: string;
  isClosedDay: boolean;
}

export type BusinessHours = Partial<Record<DayKey, DayHours>>;

export type MarketCategory =
  | 'FOOD'
  | 'CLOTHING'
  | 'GROCERIES'
  | 'BUTCHER'
  | 'OFFERS'
  | 'ELECTRONICS'
  | 'HOME'
  | 'GENERAL';

/** Store mode: RESTAURANT = cart/orders; PROFESSIONAL = contact-only, no cart */
export type StoreMode = 'RESTAURANT' | 'PROFESSIONAL';

export interface Tenant {
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
  paymentCapabilities?: { cash: boolean; card: boolean };
  /** Granular payment toggles resolved per store. */
  paymentMethods?: { cash: boolean; card: boolean; installments: boolean };
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
