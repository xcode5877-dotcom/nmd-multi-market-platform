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

  return { banners, layout, feedCampaigns, homeFeedSettings };
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
