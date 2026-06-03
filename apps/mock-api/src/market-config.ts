/**
 * Admin-ready marketplace config. Persisted to market-config.json.
 * Path: /data/market-config.json (persistent volume in Docker). Override with MARKET_CONFIG_FILE.
 * API: GET/PUT /markets/by-slug/:slug/banners, GET/PUT /markets/by-slug/:slug/layout
 *
 * Load order: tries several paths in priority order; for each market slug the first file with a
 * non-empty banners/layout array wins. Repo `data/market-config.json` fills gaps when the volume
 * file is missing keys or has empty arrays (so real image URLs from source control are used).
 */

import { readFileSync, writeFileSync, existsSync, copyFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import type { ModifierIcon } from '@nmd/core';

export interface MarketBanner {
  id: string;
  imageUrl: string;
  title: string;
  /** Tenant slug to link to */
  linkTo: string;
  active: boolean;
}

export type MarketSectionType = 'SLIDER' | 'MARKET_GROUP';

export interface MarketSection {
  id: string;
  title: string;
  type: MarketSectionType;
  /** Tenant IDs or slugs. Order preserved. */
  storeIds: string[];
}

export type MarketFeedCampaignKind =
  | 'HERO_BANNER'
  | 'OFFER_STRIP'
  | 'COMPETITION_CARD'
  | 'REWARD_CARD'
  | 'STORE_FEATURE'
  | 'POPUP_TRIGGER'
  | 'CATEGORY_DISCOVERY'
  | 'MOOD_DISCOVERY'
  | 'GLASS_STRIP'
  | 'CHALLENGE_CARD'
  | 'REWARDS_DISCOVERY'
  | 'FEATURED_STORE_STORY'
  | 'CUSTOM_BANNER'
  /** Legacy aliases (Flutter Phase 8) */
  | 'editorialHero'
  | 'compactPromo'
  | 'interactiveEvent'
  | 'announcement';

export type MarketFeedCampaignAction =
  | 'OPEN_STORE'
  | 'OPEN_REWARD'
  | 'OPEN_COMPETITION'
  | 'OPEN_CATEGORY'
  | 'OPEN_SEARCH'
  | 'OPEN_POPUP'
  | 'EXTERNAL_LINK'
  | 'NONE'
  /** Legacy */
  | 'store'
  | 'reward'
  | 'event'
  | 'popup'
  | 'route';

export type MarketFeedCampaignPlacement =
  | 'TOP'
  | 'TOP_AFTER_LEGACY_BANNERS'
  | 'AFTER_PILLARS'
  | 'AFTER_SECTION_1'
  | 'AFTER_STORE_SECTION_1'
  | 'AFTER_SECTION_2'
  | 'AFTER_STORE_SECTION_2'
  | 'AFTER_EVERY_2_ROWS'
  | 'AFTER_EVERY_N_SECTIONS'
  | 'MANUAL_ORDER';

export type MarketFeedCampaignDesignVariant =
  | 'soft_teal'
  | 'white_card'
  | 'dark_teal_strip'
  | 'image_editorial'
  | 'minimal_text';

export type MarketFeedCampaignVisualWeight = 'light' | 'medium' | 'heavy';

export type HomeFeedSpacingStyle = 'compact' | 'normal' | 'spacious';

export interface MarketFeedCampaignChip {
  label: string;
  emoji?: string;
  iconUrl?: string;
  action?: MarketFeedCampaignAction;
  targetId?: string;
  targetSlug?: string;
  sortOrder?: number;
  active?: boolean;
}

export interface HomeFeedSettings {
  maxBlocksPerHome: number;
  maxPromoBlocksPerHome?: number;
  minStoreSectionsBetweenPromos?: number;
  firstPromoAfterSectionIndex?: number;
  spacingStyle: HomeFeedSpacingStyle;
  preventAdjacentLargeVisual: boolean;
  showLegacyBanners?: boolean;
  showPillars?: boolean;
}

export interface MarketFeedCampaign {
  id: string;
  title: string;
  subtitle: string;
  imageUrl?: string;
  type: MarketFeedCampaignKind;
  ctaLabel: string;
  ctaAction: MarketFeedCampaignAction;
  targetId?: string;
  targetUrl?: string;
  popupBody?: string;
  active: boolean;
  placement: MarketFeedCampaignPlacement;
  /** Used when placement is MANUAL_ORDER — insert after this section index (0-based). */
  manualAfterSection?: number;
  startDate?: string;
  endDate?: string;
  priority: number;
  sortOrder: number;
  participantCount?: number;
  countdownEndsAt?: string;
  /** CATEGORY_DISCOVERY — labels shown as chips (legacy) */
  categoryLabels?: string[];
  /** MOOD_DISCOVERY — structured chips with emoji + per-chip action */
  chips?: MarketFeedCampaignChip[];
  backgroundStyle?: string;
  designVariant?: MarketFeedCampaignDesignVariant | string;
  visualWeight?: MarketFeedCampaignVisualWeight;
  /** AFTER_EVERY_N_SECTIONS — interval (default 2) */
  afterEveryNSections?: number;
  allowAdjacentLargeVisual?: boolean;
  titleColor?: string;
  backgroundColor?: string;
  iconEmoji?: string;
}

interface MarketConfigStore {
  banners: Record<string, MarketBanner[]>;
  layout: Record<string, MarketSection[]>;
  feedCampaigns?: Record<string, MarketFeedCampaign[]> | MarketFeedCampaign[];
  homeFeedSettings?: Record<string, HomeFeedSettings>;
  /** Per-market shared modifier icon library (Super Admin). */
  modifierIconLibrary?: Record<string, ModifierIcon[]>;
  /** Ordered homepage blocks (Super Admin visual builder). */
  homePageBlocks?: Record<string, HomePageBlock[]>;
  /** When true, customer app uses [homePageBlocks] instead of legacy composer. */
  homePageBuilderEnabled?: Record<string, boolean>;
}

export type HomePageBlockType =
  | 'HERO_BANNERS'
  | 'PILLARS'
  | 'STORE_SECTION'
  | 'EDITORIAL_PROMO'
  | 'CUSTOM_IMAGE_BANNER';

export interface HomePageBlock {
  id: string;
  type: HomePageBlockType;
  title: string;
  visible: boolean;
  sortOrder: number;
  config: Record<string, unknown>;
}

/** Coerce slug campaigns to a safe array (never throws). */
export function coerceFeedCampaignList(val: unknown): MarketFeedCampaign[] {
  if (val == null) return [];
  if (Array.isArray(val)) {
    return val.filter((x) => x != null && typeof x === 'object') as MarketFeedCampaign[];
  }
  if (typeof val === 'object') {
    return [val as MarketFeedCampaign];
  }
  return [];
}

/**
 * Normalize persisted feedCampaigns to map-by-slug.
 * Handles legacy top-level array or per-slug non-array values.
 */
export function normalizeFeedCampaignsRoot(
  raw: unknown,
  fallbackSlug = 'dabburiyya',
): Record<string, MarketFeedCampaign[]> {
  if (raw == null) return {};
  if (Array.isArray(raw)) {
    const key = normalizeMarketSlugForConfig(fallbackSlug);
    console.warn(
      '[market-config] feedCampaigns was a top-level array — coerced to map',
      key,
    );
    return { [key]: coerceFeedCampaignList(raw) };
  }
  if (typeof raw !== 'object') return {};
  const out: Record<string, MarketFeedCampaign[]> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    out[normalizeMarketSlugForConfig(k)] = coerceFeedCampaignList(v);
  }
  return out;
}

export function describeFeedCampaignsConfigShape(raw: unknown): string {
  if (raw == null) return 'missing';
  if (Array.isArray(raw)) return 'array-root';
  if (typeof raw === 'object') return 'map';
  return typeof raw;
}

function ensureFeedCampaignsMap(store: MarketConfigStore): Record<string, MarketFeedCampaign[]> {
  const normalized = normalizeFeedCampaignsRoot(store.feedCampaigns);
  store.feedCampaigns = normalized;
  return normalized;
}

/** Primary write target (same as first read candidate when env set). */
const PRIMARY_CONFIG_FILE = process.env.MARKET_CONFIG_FILE || join(process.cwd(), 'market-config.json');
/** Legacy path for one-time migration into persistent dir. */
const LEGACY_CONFIG_FILE = join(process.cwd(), 'market-config.json');

const DEFAULT_BANNERS: MarketBanner[] = [
  {
    id: 'b1',
    imageUrl: 'https://placehold.co/1200x514/6366f1/ffffff?text=السوق',
    title: 'مرحباً بكم',
    linkTo: '',
    active: true,
  },
];

const DEFAULT_LAYOUT: MarketSection[] = [
  { id: 'all', title: 'جميع المحلات', type: 'SLIDER', storeIds: [] },
];

/** Only used when no file/layer provides banners for a slug. Uses remote placeholder — never a local /uploads path that may 404. */
const SEED_BANNERS: Record<string, MarketBanner[]> = {
  dabburiyya: [
    {
      id: 'b1',
      imageUrl: 'https://placehold.co/1200x514/1e293b/ffffff?text=%D8%B3%D9%88%D9%82+%D8%AF%D8%A8%D9%88%D8%B1%D9%8A%D8%A9',
      title: 'مرحباً بكم في سوق دبورية',
      linkTo: 'buffalo',
      active: true,
    },
    {
      id: 'b2',
      imageUrl: 'https://placehold.co/1200x514/0f766e/ffffff?text=توصيل+سريع',
      title: 'اطلب من محلاتك المفضلة',
      linkTo: 'buffalo',
      active: true,
    },
  ],
  iksal: [
    {
      id: 'b1',
      imageUrl: 'https://placehold.co/1200x514/4f46e5/ffffff?text=%D8%B3%D9%88%D9%82+%D8%A5%D9%83%D8%B3%D8%A7%D9%84',
      title: 'مرحباً بكم في سوق إكسال',
      linkTo: 'buffalo',
      active: true,
    },
  ],
};

const SEED_LAYOUT: Record<string, MarketSection[]> = {
  dabburiyya: [
    { id: 'featured', title: 'المحلات المميزة', type: 'SLIDER', storeIds: ['buffalo'] },
    { id: 'del3-krshk', title: 'دلع كرشك', type: 'SLIDER', storeIds: ['buffalo'] },
    { id: 'restaurants', title: 'أفضل المطاعم', type: 'SLIDER', storeIds: ['buffalo'] },
    { id: 'new', title: 'جديد في دبورية', type: 'SLIDER', storeIds: ['buffalo'] },
  ],
  iksal: [{ id: 'featured', title: 'المحلات المميزة', type: 'SLIDER', storeIds: ['buffalo'] }],
};

function buildDefaultModifierIcon(
  key: string,
  labelAr: string,
  keywords: string[],
  sortOrder: number,
  category = 'pizza',
): ModifierIcon {
  return {
    id: `mi_${key}`,
    key,
    labelAr,
    labelHe: undefined,
    labelEn: key,
    iconUrl: '',
    keywords,
    category,
    active: true,
    sortOrder,
  };
}

/** Default library keys align with Flutter `PizzaToppingVisualCategory` + bundled assets. */
const DEFAULT_MODIFIER_ICON_KEYS: Array<{
  key: string;
  labelAr: string;
  keywords: string[];
  sortOrder: number;
}> = [
  { key: 'olive', labelAr: 'زيتون', keywords: ['زيتون', 'olive', 'זית', 'זיתים'], sortOrder: 0 },
  { key: 'mushroom', labelAr: 'فطر', keywords: ['فطر', 'mushroom', 'פטריה', 'פטריות'], sortOrder: 1 },
  { key: 'corn', labelAr: 'ذرة', keywords: ['ذرة', 'corn', 'תירס'], sortOrder: 2 },
  { key: 'onion', labelAr: 'بصل', keywords: ['بصل', 'onion', 'בצל'], sortOrder: 3 },
  { key: 'pepper', labelAr: 'فلفل', keywords: ['فلفل', 'pepper', 'פלפל', 'חריף'], sortOrder: 4 },
  { key: 'cheese', labelAr: 'جبنة', keywords: ['جبنة', 'جبن', 'cheese', 'mozzarella', 'גבינה'], sortOrder: 5 },
  { key: 'meat', labelAr: 'لحم', keywords: ['لحم', 'meat', 'beef', 'كفتة', 'בשר'], sortOrder: 6 },
  { key: 'chicken', labelAr: 'دجاج', keywords: ['دجاج', 'chicken', 'شاورما', 'עוף'], sortOrder: 7 },
  { key: 'tuna', labelAr: 'تونة', keywords: ['تونة', 'tuna', 'טונה'], sortOrder: 8 },
  { key: 'sauce', labelAr: 'صلصة', keywords: ['صلصة', 'sauce', 'ثوم', 'ranch', 'רוטב'], sortOrder: 9 },
  { key: 'vegetable', labelAr: 'خضار', keywords: ['خضار', 'vegetable', 'ירק'], sortOrder: 10 },
  { key: 'default', labelAr: 'إضافة', keywords: ['إضافة', 'extra', 'addon'], sortOrder: 11 },
];

function seedModifierIconsForMarket(): ModifierIcon[] {
  return DEFAULT_MODIFIER_ICON_KEYS.map((row) =>
    buildDefaultModifierIcon(row.key, row.labelAr, row.keywords, row.sortOrder),
  );
}

const SEED_MODIFIER_ICON_LIBRARY: Record<string, ModifierIcon[]> = {
  dabburiyya: seedModifierIconsForMarket(),
  iksal: seedModifierIconsForMarket(),
};

/** Optional seed promos — deactivate in admin to restore plain home. */
const SEED_FEED_CAMPAIGNS: Record<string, MarketFeedCampaign[]> = {
  dabburiyya: [
    {
      id: 'fc_gift_card',
      title: 'أرسل بطاقة هدية',
      subtitle: 'خيارات دفع متعددة',
      type: 'HERO_BANNER',
      ctaLabel: 'جرّب الآن',
      ctaAction: 'OPEN_POPUP',
      popupBody: 'أرسل بطاقة هدية لأحبائك عبر Now Market — قريباً في محلاتك المفضلة.',
      active: true,
      placement: 'AFTER_EVERY_2_ROWS',
      priority: 100,
      sortOrder: 0,
      imageUrl:
        'https://images.unsplash.com/photo-1549465220-1a8b923f0042?w=800&q=80',
    },
    {
      id: 'fc_food_discovery',
      title: 'شو عبالك اليوم؟',
      subtitle: 'خلينا نساعدك بالاختيار',
      type: 'CATEGORY_DISCOVERY',
      ctaLabel: 'اكتشف',
      ctaAction: 'NONE',
      active: true,
      placement: 'AFTER_EVERY_2_ROWS',
      priority: 90,
      sortOrder: 1,
      categoryLabels: ['بيتزا', 'برجر', 'حلويات', 'خدمات'],
    },
    {
      id: 'fc_chess',
      title: 'بطولة الشطرنج',
      subtitle: 'اربح 500₪',
      type: 'COMPETITION_CARD',
      ctaLabel: 'اشترك الآن',
      ctaAction: 'OPEN_COMPETITION',
      active: true,
      placement: 'AFTER_EVERY_2_ROWS',
      priority: 80,
      sortOrder: 2,
      participantCount: 24,
    },
  ],
};

function marketConfigPathCandidates(): string[] {
  const list = [
    process.env.MARKET_CONFIG_FILE?.trim(),
    join(process.cwd(), 'market-config.json'),
    join(process.cwd(), 'data', 'market-config.json'),
    join(process.cwd(), '..', '..', 'data', 'market-config.json'),
  ].filter((p): p is string => Boolean(p));
  const seen = new Set<string>();
  return list.filter((p) => {
    if (seen.has(p)) return false;
    seen.add(p);
    return true;
  });
}

function tryReadMarketConfigFile(path: string): Partial<MarketConfigStore> | null {
  try {
    if (!existsSync(path)) return null;
    const raw = readFileSync(path, 'utf-8');
    if (!raw.trim()) return null;
    const parsed = JSON.parse(raw) as Partial<MarketConfigStore>;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * For each slug, use the first layer (highest-priority path first) that has a non-empty array.
 * Empty arrays in a higher-priority file are ignored so a lower-priority file can supply data.
 */
function mergeMarketConfigLayers(layers: Partial<MarketConfigStore>[]): MarketConfigStore {
  const bannerKeys = new Set<string>();
  const layoutKeys = new Set<string>();
  for (const L of layers) {
    for (const k of Object.keys(L.banners ?? {})) bannerKeys.add(k);
    for (const k of Object.keys(L.layout ?? {})) layoutKeys.add(k);
  }
  for (const k of Object.keys(SEED_BANNERS)) bannerKeys.add(k);
  for (const k of Object.keys(SEED_LAYOUT)) layoutKeys.add(k);

  const banners: Record<string, MarketBanner[]> = {};
  const layout: Record<string, MarketSection[]> = {};

  for (const k of bannerKeys) {
    let chosen: MarketBanner[] | undefined;
    for (const L of layers) {
      const row = L.banners?.[k];
      if (Array.isArray(row) && row.length > 0) {
        chosen = row.map((b) => ({ ...b }));
        break;
      }
    }
    banners[k] = chosen ?? [];
  }
  for (const k of layoutKeys) {
    let chosen: MarketSection[] | undefined;
    for (const L of layers) {
      const row = L.layout?.[k];
      if (Array.isArray(row) && row.length > 0) {
        chosen = row.map((s) => ({ ...s }));
        break;
      }
    }
    layout[k] = chosen ?? [];
  }

  for (const k of bannerKeys) {
    if (!banners[k]?.length) {
      banners[k] = SEED_BANNERS[k] ? [...SEED_BANNERS[k]] : [...DEFAULT_BANNERS];
    }
  }
  for (const k of layoutKeys) {
    if (!layout[k]?.length) {
      layout[k] = SEED_LAYOUT[k] ? [...SEED_LAYOUT[k]] : [...DEFAULT_LAYOUT];
    }
  }

  const feedKeys = new Set<string>();
  const layerFeedMaps: Record<string, MarketFeedCampaign[]>[] = [];
  for (const L of layers) {
    const norm = normalizeFeedCampaignsRoot(L.feedCampaigns);
    layerFeedMaps.push(norm);
    for (const k of Object.keys(norm)) feedKeys.add(k);
  }
  for (const k of Object.keys(SEED_FEED_CAMPAIGNS)) feedKeys.add(k);

  const feedCampaigns: Record<string, MarketFeedCampaign[]> = {};
  for (const k of feedKeys) {
    let chosen: MarketFeedCampaign[] | undefined;
    for (const norm of layerFeedMaps) {
      const row = norm[k];
      if (Array.isArray(row)) {
        chosen = row.map((c) => ({ ...c }));
        break;
      }
    }
    feedCampaigns[k] = chosen ?? SEED_FEED_CAMPAIGNS[k] ?? [];
  }

  const settingsKeys = new Set<string>();
  for (const L of layers) {
    for (const k of Object.keys(L.homeFeedSettings ?? {})) settingsKeys.add(k);
  }
  for (const k of feedKeys) settingsKeys.add(k);

  const modifierIconKeys = new Set<string>();
  const layerModifierMaps: Record<string, ModifierIcon[]>[] = [];
  for (const L of layers) {
    const raw = L.modifierIconLibrary;
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      layerModifierMaps.push(
        Object.fromEntries(
          Object.entries(raw).map(([k, v]) => [
            normalizeMarketSlugForConfig(k),
            coerceModifierIconList(v),
          ]),
        ),
      );
      for (const k of Object.keys(raw)) modifierIconKeys.add(normalizeMarketSlugForConfig(k));
    }
  }
  for (const k of Object.keys(SEED_MODIFIER_ICON_LIBRARY)) modifierIconKeys.add(k);
  for (const k of bannerKeys) modifierIconKeys.add(k);
  for (const k of layoutKeys) modifierIconKeys.add(k);

  const modifierIconLibrary: Record<string, ModifierIcon[]> = {};
  for (const k of modifierIconKeys) {
    let chosen: ModifierIcon[] | undefined;
    for (const norm of layerModifierMaps) {
      const row = norm[k];
      if (Array.isArray(row) && row.length > 0) {
        chosen = row.map((x) => ({ ...x }));
        break;
      }
    }
    modifierIconLibrary[k] = chosen ?? SEED_MODIFIER_ICON_LIBRARY[k] ?? seedModifierIconsForMarket();
  }

  const homeFeedSettings: Record<string, HomeFeedSettings> = {};
  for (const k of settingsKeys) {
    let chosen: HomeFeedSettings | undefined;
    for (const L of layers) {
      const row = L.homeFeedSettings?.[k];
      if (row && typeof row === 'object') {
        chosen = { ...DEFAULT_HOME_FEED_SETTINGS, ...row };
        break;
      }
    }
    homeFeedSettings[k] = chosen ?? { ...DEFAULT_HOME_FEED_SETTINGS };
  }

  const homePageBlockKeys = new Set<string>();
  const layerHomeBlockMaps: Record<string, HomePageBlock[]>[] = [];
  for (const L of layers) {
    const raw = L.homePageBlocks;
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      layerHomeBlockMaps.push(
        Object.fromEntries(
          Object.entries(raw).map(([k, v]) => [
            normalizeMarketSlugForConfig(k),
            coerceHomePageBlockList(v),
          ]),
        ),
      );
      for (const k of Object.keys(raw)) homePageBlockKeys.add(normalizeMarketSlugForConfig(k));
    }
    if (L.homePageBuilderEnabled) {
      for (const k of Object.keys(L.homePageBuilderEnabled)) {
        homePageBlockKeys.add(normalizeMarketSlugForConfig(k));
      }
    }
  }
  for (const k of bannerKeys) homePageBlockKeys.add(k);

  const homePageBlocks: Record<string, HomePageBlock[]> = {};
  const homePageBuilderEnabled: Record<string, boolean> = {};
  for (const L of layers) {
    if (L.homePageBuilderEnabled) {
      for (const [k, v] of Object.entries(L.homePageBuilderEnabled)) {
        if (v === true) homePageBuilderEnabled[normalizeMarketSlugForConfig(k)] = true;
      }
    }
  }
  for (const k of homePageBlockKeys) {
    let chosen: HomePageBlock[] | undefined;
    for (const norm of layerHomeBlockMaps) {
      const row = norm[k];
      if (Array.isArray(row) && row.length > 0) {
        chosen = row.map((x) => ({ ...x, config: { ...x.config } }));
        break;
      }
    }
    if (chosen) homePageBlocks[k] = chosen;
  }

  return {
    banners,
    layout,
    feedCampaigns,
    homeFeedSettings,
    modifierIconLibrary,
    homePageBlocks,
    homePageBuilderEnabled,
  };
}

export function coerceModifierIconList(val: unknown): ModifierIcon[] {
  if (!Array.isArray(val)) return [];
  return val
    .filter((x) => x != null && typeof x === 'object')
    .map((x) => normalizeModifierIconRow(x as ModifierIcon));
}

function normalizeModifierIconRow(raw: ModifierIcon): ModifierIcon {
  const key = String(raw.key ?? '').trim().toLowerCase() || 'default';
  return {
    id: String(raw.id ?? `mi_${key}`).trim(),
    key,
    labelAr: String(raw.labelAr ?? key).trim(),
    labelHe: raw.labelHe != null ? String(raw.labelHe).trim() : undefined,
    labelEn: raw.labelEn != null ? String(raw.labelEn).trim() : undefined,
    iconUrl: String(raw.iconUrl ?? '').trim(),
    keywords: Array.isArray(raw.keywords)
      ? raw.keywords.map((k) => String(k).trim()).filter(Boolean)
      : [],
    category: raw.category != null ? String(raw.category).trim() : 'pizza',
    active: raw.active !== false,
    sortOrder: Number.isFinite(raw.sortOrder) ? Number(raw.sortOrder) : 0,
  };
}

function sortModifierIcons(rows: ModifierIcon[]): ModifierIcon[] {
  return [...rows].sort((a, b) => a.sortOrder - b.sortOrder || a.labelAr.localeCompare(b.labelAr, 'ar'));
}

const DEFAULT_HOME_FEED_SETTINGS: HomeFeedSettings = {
  maxBlocksPerHome: 3,
  maxPromoBlocksPerHome: 3,
  minStoreSectionsBetweenPromos: 2,
  firstPromoAfterSectionIndex: 1,
  spacingStyle: 'normal',
  preventAdjacentLargeVisual: true,
  showLegacyBanners: true,
  showPillars: true,
};

/** One-time migration: copy legacy market-config.json to persistent path if it exists and new path is missing. */
function migrateFromLegacyIfNeeded(): void {
  if (!existsSync(LEGACY_CONFIG_FILE)) return;
  const target = process.env.MARKET_CONFIG_FILE || join(process.cwd(), 'market-config.json');
  if (existsSync(target)) return;
  try {
    const dir = dirname(target);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    copyFileSync(LEGACY_CONFIG_FILE, target);
    console.log('[market-config] Migrated from', LEGACY_CONFIG_FILE, 'to', target);
  } catch (err) {
    console.warn('[market-config] Migration copy failed (will use defaults):', err instanceof Error ? err.message : err);
  }
}

function load(): MarketConfigStore {
  migrateFromLegacyIfNeeded();
  const layers: Partial<MarketConfigStore>[] = [];
  for (const p of marketConfigPathCandidates()) {
    const parsed = tryReadMarketConfigFile(p);
    if (parsed) layers.push(parsed);
  }
  if (layers.length > 1 && process.env.NODE_ENV !== 'production') {
    console.log('[market-config] Merged', layers.length, 'config layers (volume + repo fallbacks)');
  }
  if (layers.length === 0) {
    console.warn('[market-config] No market-config.json found in candidates — using seed only');
    return {
      banners: { ...SEED_BANNERS },
      layout: { ...SEED_LAYOUT },
      feedCampaigns: { ...SEED_FEED_CAMPAIGNS },
      modifierIconLibrary: { ...SEED_MODIFIER_ICON_LIBRARY },
    };
  }
  const merged = mergeMarketConfigLayers(layers);
  ensureFeedCampaignsMap(merged);
  return merged;
}

function save(store: MarketConfigStore): void {
  try {
    const target = PRIMARY_CONFIG_FILE;
    const dir = dirname(target);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(target, JSON.stringify(store, null, 2), 'utf-8');
    cache = null;
  } catch (err) {
    console.error('[market-config] Failed to persist:', err);
  }
}

let cache: MarketConfigStore | null = null;

function getStore(): MarketConfigStore {
  if (!cache) cache = load();
  return cache;
}

/** Align config keys with storefront routes (e.g. /daburiyya → dabburiyya). */
export function normalizeMarketSlugForConfig(marketSlug: string): string {
  const s = (marketSlug ?? '').trim().toLowerCase();
  if (s === 'daburiyya') return 'dabburiyya';
  return s;
}

/** Preserve stored imageUrl exactly (https or /uploads/...). Only fills empty with a remote placeholder — never a missing local default file. */
function normalizeBannerRow(b: MarketBanner): MarketBanner {
  const imageUrl = (b.imageUrl ?? '').trim();
  if (imageUrl) return { ...b, imageUrl };
  return { ...b, imageUrl: DEFAULT_BANNERS[0].imageUrl };
}

export function getBannersForMarket(marketSlug: string): MarketBanner[] {
  const key = normalizeMarketSlugForConfig(marketSlug);
  const raw = getStore().banners[key];
  const list =
    raw != null && raw.length > 0 ? raw : (SEED_BANNERS[key]?.length ? SEED_BANNERS[key] : DEFAULT_BANNERS);
  return list.map(normalizeBannerRow);
}

function normalizeSection(s: MarketSection & { type?: string }): MarketSection {
  return {
    ...s,
    type: s.type === 'MARKET_GROUP' ? 'MARKET_GROUP' : 'SLIDER',
  };
}

export function getLayoutForMarket(marketSlug: string): MarketSection[] {
  const key = normalizeMarketSlugForConfig(marketSlug);
  const raw = getStore().layout[key];
  const fallback = SEED_LAYOUT[key]?.length ? SEED_LAYOUT[key] : DEFAULT_LAYOUT;
  const sections = raw != null && raw.length > 0 ? raw : fallback;
  return sections.map((s) => normalizeSection(s as MarketSection & { type?: string }));
}

export function setBannersForMarket(marketSlug: string, banners: MarketBanner[]): void {
  const store = getStore();
  store.banners[normalizeMarketSlugForConfig(marketSlug)] = banners;
  save(store);
}

export function setLayoutForMarket(marketSlug: string, layout: MarketSection[]): void {
  const store = getStore();
  store.layout[normalizeMarketSlugForConfig(marketSlug)] = layout;
  save(store);
}

function isCampaignActive(c: MarketFeedCampaign): boolean {
  if (c.active === false) return false;
  const now = Date.now();
  if (c.startDate) {
    const t = Date.parse(c.startDate);
    if (!Number.isNaN(t) && now < t) return false;
  }
  if (c.endDate) {
    const t = Date.parse(c.endDate);
    if (!Number.isNaN(t) && now > t) return false;
  }
  return true;
}

function sortFeedCampaigns(rows: MarketFeedCampaign[]): MarketFeedCampaign[] {
  return [...rows].sort(
    (a, b) => (b.priority ?? 0) - (a.priority ?? 0) || (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
  );
}

/** Public storefront — active + in-schedule only. */
export function getFeedCampaignsForMarket(marketSlug: string): MarketFeedCampaign[] {
  const key = normalizeMarketSlugForConfig(marketSlug);
  const store = getStore();
  const map = ensureFeedCampaignsMap(store);
  const raw = coerceFeedCampaignList(map[key] ?? SEED_FEED_CAMPAIGNS[key] ?? []);
  return sortFeedCampaigns(raw.filter(isCampaignActive));
}

/** Super Admin builder — includes inactive / scheduled-out campaigns. */
export function getFeedCampaignsForMarketAdmin(marketSlug: string): MarketFeedCampaign[] {
  const key = normalizeMarketSlugForConfig(marketSlug);
  const store = getStore();
  const map = ensureFeedCampaignsMap(store);
  const raw = coerceFeedCampaignList(map[key] ?? SEED_FEED_CAMPAIGNS[key] ?? []);
  return sortFeedCampaigns(raw);
}

export function getFeedCampaignsConfigShape(): string {
  return describeFeedCampaignsConfigShape(getStore().feedCampaigns);
}

export function getHomeFeedSettingsForMarket(marketSlug: string): HomeFeedSettings {
  const key = normalizeMarketSlugForConfig(marketSlug);
  const store = getStore();
  if (!store.homeFeedSettings) store.homeFeedSettings = {};
  return { ...DEFAULT_HOME_FEED_SETTINGS, ...(store.homeFeedSettings[key] ?? {}) };
}

export function setHomeFeedSettingsForMarket(
  marketSlug: string,
  settings: HomeFeedSettings,
): void {
  const store = getStore();
  if (!store.homeFeedSettings) store.homeFeedSettings = {};
  store.homeFeedSettings[normalizeMarketSlugForConfig(marketSlug)] = {
    ...DEFAULT_HOME_FEED_SETTINGS,
    ...settings,
  };
  save(store);
}

export function setFeedCampaignsForMarket(
  marketSlug: string,
  campaigns: MarketFeedCampaign[],
): void {
  const store = getStore();
  const map = ensureFeedCampaignsMap(store);
  map[normalizeMarketSlugForConfig(marketSlug)] = coerceFeedCampaignList(campaigns);
  save(store);
}

function ensureModifierIconLibraryMap(store: MarketConfigStore): Record<string, ModifierIcon[]> {
  if (!store.modifierIconLibrary || typeof store.modifierIconLibrary !== 'object') {
    store.modifierIconLibrary = {};
  }
  return store.modifierIconLibrary;
}

/** Storefront + merchant picker — active icons only. */
export function getModifierIconsForMarket(marketSlug: string): ModifierIcon[] {
  const key = normalizeMarketSlugForConfig(marketSlug);
  const store = getStore();
  const map = ensureModifierIconLibraryMap(store);
  const raw = coerceModifierIconList(map[key] ?? SEED_MODIFIER_ICON_LIBRARY[key] ?? []);
  return sortModifierIcons(raw.filter((i) => i.active));
}

/** Super Admin — includes inactive/disabled entries. */
export function getModifierIconsForMarketAdmin(marketSlug: string): ModifierIcon[] {
  const key = normalizeMarketSlugForConfig(marketSlug);
  const store = getStore();
  const map = ensureModifierIconLibraryMap(store);
  const raw = coerceModifierIconList(map[key] ?? SEED_MODIFIER_ICON_LIBRARY[key] ?? []);
  return sortModifierIcons(raw);
}

export function setModifierIconsForMarket(marketSlug: string, icons: ModifierIcon[]): void {
  const store = getStore();
  const map = ensureModifierIconLibraryMap(store);
  map[normalizeMarketSlugForConfig(marketSlug)] = coerceModifierIconList(icons);
  save(store);
}

const HOME_PAGE_BLOCK_TYPES: HomePageBlockType[] = [
  'HERO_BANNERS',
  'PILLARS',
  'STORE_SECTION',
  'EDITORIAL_PROMO',
  'CUSTOM_IMAGE_BANNER',
];

export function coerceHomePageBlockList(val: unknown): HomePageBlock[] {
  if (!Array.isArray(val)) return [];
  return val
    .filter((x) => x != null && typeof x === 'object')
    .map((x) => normalizeHomePageBlock(x as HomePageBlock))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

function normalizeHomePageBlock(raw: HomePageBlock): HomePageBlock {
  const type = HOME_PAGE_BLOCK_TYPES.includes(raw.type as HomePageBlockType)
    ? (raw.type as HomePageBlockType)
    : 'STORE_SECTION';
  const cfg =
    raw.config != null && typeof raw.config === 'object' && !Array.isArray(raw.config)
      ? { ...(raw.config as Record<string, unknown>) }
      : {};
  return {
    id: String(raw.id ?? `block_${Date.now()}`).trim(),
    type,
    title: String(raw.title ?? '').trim() || defaultTitleForBlockType(type),
    visible: raw.visible !== false,
    sortOrder: Number.isFinite(raw.sortOrder) ? Number(raw.sortOrder) : 0,
    config: cfg,
  };
}

export function defaultTitleForBlockType(type: HomePageBlockType): string {
  switch (type) {
    case 'HERO_BANNERS':
      return 'سلايدر البانرات الرئيسية';
    case 'PILLARS':
      return 'الأقسام الرئيسية';
    case 'STORE_SECTION':
      return 'قسم محلات';
    case 'EDITORIAL_PROMO':
      return 'إعلان تفاعلي';
    case 'CUSTOM_IMAGE_BANNER':
      return 'بانر صورة';
    default:
      return 'بلوك';
  }
}

function ensureHomePageBlocksMap(store: MarketConfigStore): Record<string, HomePageBlock[]> {
  if (!store.homePageBlocks || typeof store.homePageBlocks !== 'object') {
    store.homePageBlocks = {};
  }
  return store.homePageBlocks;
}

function isHomePageBuilderEnabled(store: MarketConfigStore, key: string): boolean {
  return store.homePageBuilderEnabled?.[key] === true;
}

/** Build a starting block list from legacy layout + active feed campaigns (admin template only). */
export function buildLegacyHomePageBlocks(marketSlug: string): HomePageBlock[] {
  const key = normalizeMarketSlugForConfig(marketSlug);
  const blocks: HomePageBlock[] = [];
  let order = 0;
  const settings = getHomeFeedSettingsForMarket(key);
  if (settings.showLegacyBanners !== false) {
    blocks.push({
      id: 'block_hero_banners',
      type: 'HERO_BANNERS',
      title: 'سلايدر البانرات الرئيسية',
      visible: true,
      sortOrder: order++,
      config: {},
    });
  }
  if (settings.showPillars !== false) {
    blocks.push({
      id: 'block_pillars',
      type: 'PILLARS',
      title: 'الأقسام الرئيسية',
      visible: true,
      sortOrder: order++,
      config: {},
    });
  }
  const layout = getLayoutForMarket(key);
  for (const section of layout) {
    blocks.push({
      id: `block_section_${section.id}`,
      type: 'STORE_SECTION',
      title: section.title || 'قسم محلات',
      visible: true,
      sortOrder: order++,
      config: {
        source: 'LAYOUT_SECTION',
        layoutSectionId: section.id,
        layout: 'HORIZONTAL',
        limit: 24,
        storeIds: section.storeIds ?? [],
      },
    });
  }
  const campaigns = getFeedCampaignsForMarketAdmin(key).filter(isCampaignActive);
  for (const c of campaigns.slice(0, 3)) {
    blocks.push({
      id: `block_promo_${c.id}`,
      type: 'EDITORIAL_PROMO',
      title: c.title || 'إعلان',
      visible: c.active !== false,
      sortOrder: order++,
      config: { campaignId: c.id },
    });
  }
  return blocks;
}

export function validateHomePageBlocks(blocks: HomePageBlock[]): string[] {
  const errors: string[] = [];
  for (const b of blocks) {
    const cfg = b.config ?? {};
    if (b.type === 'STORE_SECTION') {
      if (!b.title.trim()) errors.push(`قسم محلات بدون عنوان (${b.id})`);
      const source = String(cfg.source ?? 'LAYOUT_SECTION');
      if (
        source === 'MANUAL' &&
        (!Array.isArray(cfg.storeIds) || cfg.storeIds.length === 0)
      ) {
        errors.push(`«${b.title}»: حدد محلات يدوياً`);
      }
      if (source === 'PILLAR' && !String(cfg.pillarId ?? '').trim()) {
        errors.push(`«${b.title}»: اختر عموداً`);
      }
      if (source === 'SUB_CATEGORY' && !String(cfg.subCategoryId ?? '').trim()) {
        errors.push(`«${b.title}»: اختر تصنيفاً فرعياً`);
      }
      if (source === 'LAYOUT_SECTION' && !String(cfg.layoutSectionId ?? '').trim()) {
        errors.push(`«${b.title}»: اختر قسم تخطيط`);
      }
    }
    if (b.type === 'EDITORIAL_PROMO' && !String(cfg.campaignId ?? '').trim()) {
      errors.push(`«${b.title}»: اختر حملة`);
    }
    if (b.type === 'CUSTOM_IMAGE_BANNER' && !String(cfg.imageUrl ?? '').trim()) {
      errors.push(`«${b.title}»: أضف صورة البانر`);
    }
  }
  return errors;
}

/** Customer app — visible blocks in order; empty if builder not enabled. */
export function getHomePageBlocksForMarket(marketSlug: string): HomePageBlock[] {
  const key = normalizeMarketSlugForConfig(marketSlug);
  const store = getStore();
  if (!isHomePageBuilderEnabled(store, key)) return [];
  const map = ensureHomePageBlocksMap(store);
  const raw = coerceHomePageBlockList(map[key] ?? []);
  return raw.filter((b) => b.visible);
}

/** Super Admin — all blocks; if never saved, returns legacy template (not enabled until PUT). */
export function getHomePageBlocksForMarketAdmin(marketSlug: string): HomePageBlock[] {
  const key = normalizeMarketSlugForConfig(marketSlug);
  const store = getStore();
  if (!isHomePageBuilderEnabled(store, key)) {
    return buildLegacyHomePageBlocks(key);
  }
  const map = ensureHomePageBlocksMap(store);
  return coerceHomePageBlockList(map[key] ?? []);
}

/** Embed storeIds on STORE_SECTION blocks so the app never depends on legacy section loops. */
function enrichStoreSectionBlockConfigs(
  marketSlug: string,
  blocks: HomePageBlock[],
): HomePageBlock[] {
  const key = normalizeMarketSlugForConfig(marketSlug);
  const layout = getLayoutForMarket(key);
  return blocks.map((b) => {
    if (b.type !== 'STORE_SECTION') return b;
    const cfg = { ...(b.config ?? {}) };
    const embedded = Array.isArray(cfg.storeIds)
      ? (cfg.storeIds as unknown[]).map((x) => String(x).trim()).filter(Boolean)
      : [];
    if (embedded.length > 0) return { ...b, config: cfg };
    const source = String(cfg.source ?? 'LAYOUT_SECTION').toUpperCase();
    if (source === 'LAYOUT_SECTION') {
      const sid = String(cfg.layoutSectionId ?? '').trim();
      const sec = layout.find((s) => String(s.id) === sid);
      if (sec?.storeIds?.length) cfg.storeIds = [...sec.storeIds];
    } else if (source === 'FEATURED') {
      const sec = layout.find((s) => String(s.id) === 'featured');
      if (sec?.storeIds?.length) cfg.storeIds = [...sec.storeIds];
    }
    return { ...b, config: cfg };
  });
}

export function setHomePageBlocksForMarket(marketSlug: string, blocks: HomePageBlock[]): void {
  const key = normalizeMarketSlugForConfig(marketSlug);
  const enriched = enrichStoreSectionBlockConfigs(key, blocks);
  const normalized = coerceHomePageBlockList(enriched).map((b, i) => ({
    ...b,
    sortOrder: i,
  }));
  const validationErrors = validateHomePageBlocks(normalized);
  if (validationErrors.length > 0) {
    throw new Error(validationErrors.join(' · '));
  }
  const store = getStore();
  if (!store.homePageBuilderEnabled) store.homePageBuilderEnabled = {};
  store.homePageBuilderEnabled[key] = true;
  const map = ensureHomePageBlocksMap(store);
  map[key] = normalized;
  save(store);
}
