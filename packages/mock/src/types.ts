import type { StorefrontHero, StorefrontBanner, MarketCategory, HomeCollection, BusinessHours, LayoutStyle } from '@nmd/core';

export type TenantStoreType = 'CLOTHING' | 'FOOD' | 'GENERAL';

export interface RegistryTenant {
  id: string;
  slug: string;
  name: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
  radiusScale: number;
  layoutStyle: LayoutStyle;
  enabled: boolean;
  createdAt: string;
  templateId?: string;
  hero?: StorefrontHero;
  banners?: StorefrontBanner[];
  /** WhatsApp number for order notifications (e.g. 966501234567) */
  whatsappPhone?: string;
  /** Store type: controls option groups. FOOD = CUSTOM only; CLOTHING = SIZE/COLOR/CUSTOM; GENERAL = all. */
  type?: TenantStoreType;
  /** Market category for filtering in mall UI */
  marketCategory?: MarketCategory;
  /** Market this tenant belongs to */
  marketId?: string;
  /** Whether tenant appears in market directory (default true) */
  isListedInMarket?: boolean;
  /** Sort order within market (ascending) */
  marketSortOrder?: number;
  /** Payment capabilities: cash-first; card=false shows "Coming soon" in storefront */
  paymentCapabilities?: { cash: boolean; card: boolean; allowInstallments?: boolean };
  paymentMethods?: { cash: boolean; card: boolean; installments: boolean };
  /** Admin-controlled homepage sections */
  collections?: HomeCollection[];
  /** Manual override: open | closed | busy */
  operationalStatus?: 'open' | 'closed' | 'busy';
  /** accept_always | accept_only_when_open */
  orderPolicy?: 'accept_always' | 'accept_only_when_open';
  /** Per-day hours */
  businessHours?: BusinessHours;
  busyBannerEnabled?: boolean;
  busyBannerText?: string;
  /** Store mode: RESTAURANT | PROFESSIONAL. PROFESSIONAL = no cart, contact-only */
  storeType?: 'RESTAURANT' | 'PROFESSIONAL';
  /** Professional bio (HTML). For PROFESSIONAL stores */
  about?: string;
  /** Phone for call button (e.g. 972501234567). Falls back to whatsappPhone */
  phone?: string;
  /** Office hours (ساعات العمل). For PROFESSIONAL stores. Legacy free-text. */
  officeHours?: string;
  /** Daily open time HH:mm (e.g. 08:00). Fallback 08:00. */
  openTime?: string;
  /** Daily close time HH:mm (e.g. 17:00). Fallback 17:00. */
  closeTime?: string;
  /** Manual override: when true, store shows as CLOSED regardless of schedule. */
  forceClosed?: boolean;
  /** Super-admin remote override: AUTO (default/undefined) follows schedule; FORCE_OPEN/FORCE_CLOSED bypass everything. */
  overrideStatus?: 'AUTO' | 'FORCE_OPEN' | 'FORCE_CLOSED';
  /** Appointment duration in minutes. For PROFESSIONAL booking */
  appointmentDuration?: number;
  /** Enable online booking (Coming Soon). For PROFESSIONAL stores */
  bookingEnabled?: boolean;
  /** SLA category policy id (platform-admin configured). */
  categoryId?: string;
}

/** Central SLA policy per category (green/orange/red thresholds in ms). */
export interface CategoryPolicy {
  id: string;
  name: string;
  greenMs: number;
  orangeMs: number;
  redMs: number;
  isUrgent: boolean;
}

/** Market-scoped courier (from GET/POST/PATCH/DELETE /markets/:marketId/couriers) */
export interface MarketCourier {
  id: string;
  scopeType: 'MARKET';
  scopeId: string;
  marketId?: string;
  name: string;
  phone?: string;
  isActive: boolean;
  isOnline: boolean;
  capacity: number;
  isAvailable?: boolean;
  deliveryCount?: number;
}

/** Market courier with performance metrics + gamification (from GET /markets/:marketId/couriers/stats) */
export interface MarketCourierWithStats extends MarketCourier {
  deliveredCountToday?: number;
  deliveredCountWeek?: number;
  avgTotalMin?: number | null;
  avgPickupToDeliveredMin?: number | null;
  onTimeRate?: number | null;
  pointsToday?: number;
  pointsWeek?: number;
  badgesWeek?: string[];
}
