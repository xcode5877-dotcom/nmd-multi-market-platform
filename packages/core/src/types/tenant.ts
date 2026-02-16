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
}

export type TenantStoreType = 'CLOTHING' | 'FOOD' | 'GENERAL';

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
}
