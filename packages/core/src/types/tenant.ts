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
  /** Admin-controlled homepage sections */
  collections?: HomeCollection[];
}

export type TenantStoreType = 'CLOTHING' | 'FOOD' | 'GENERAL';

/** Manual override for store operational status */
export type OperationalStatus = 'open' | 'closed' | 'busy';

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

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  branding: TenantBranding;
  /** Store type: FOOD = CUSTOM option groups only; CLOTHING = SIZE/COLOR/CUSTOM; GENERAL = all. */
  type?: TenantStoreType;
  /** Multi-sector: RETAIL | RESTAURANT | SERVICE (default RETAIL) */
  businessType?: 'RETAIL' | 'RESTAURANT' | 'SERVICE';
  /** Market category for filtering in mall/market UI */
  marketCategory?: MarketCategory;
  /** Payment capabilities: cash-first; card=false shows "Coming soon" in storefront */
  paymentCapabilities?: { cash: boolean; card: boolean };
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
}
