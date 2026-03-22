/**
 * Admin-ready marketplace config. Persisted to market-config.json.
 * Path: /data/market-config.json (persistent volume in Docker). Override with MARKET_CONFIG_FILE.
 * API: GET/PUT /markets/by-slug/:slug/banners, GET/PUT /markets/by-slug/:slug/layout
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

interface MarketConfigStore {
  banners: Record<string, MarketBanner[]>;
  layout: Record<string, MarketSection[]>;
}

/** Persistent path: in Docker set MARKET_CONFIG_FILE=/app/data/market-config.json and mount host file there. */
const CONFIG_FILE = process.env.MARKET_CONFIG_FILE || join(process.cwd(), 'market-config.json');
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

const SEED_BANNERS: Record<string, MarketBanner[]> = {
  dabburiyya: [
    { id: 'b1', imageUrl: 'https://placehold.co/1200x514/1e293b/ffffff?text=عرض+خاص', title: 'بيتسا إيطالية طازجة', linkTo: 'buffalo', active: true },
    { id: 'b2', imageUrl: 'https://placehold.co/1200x514/0f766e/ffffff?text=توصيل+سريع', title: 'اطلب من محلاتك المفضلة', linkTo: 'buffalo', active: true },
  ],
  iksal: [
    { id: 'b1', imageUrl: 'https://placehold.co/1200x514/4f46e5/ffffff?text=سوق+إكسال', title: 'مرحباً بكم في سوق إكسال', linkTo: 'buffalo', active: true },
  ],
};

const SEED_LAYOUT: Record<string, MarketSection[]> = {
  dabburiyya: [
    { id: 'featured', title: 'محلات مميزة', type: 'SLIDER', storeIds: ['buffalo'] },
    { id: 'restaurants', title: 'أفضل المطاعم', type: 'SLIDER', storeIds: ['buffalo'] },
    { id: 'new', title: 'جديد في دبورية', type: 'SLIDER', storeIds: ['buffalo'] },
  ],
  iksal: [{ id: 'featured', title: 'محلات مميزة', type: 'SLIDER', storeIds: ['buffalo'] }],
};

/** One-time migration: copy legacy market-config.json to persistent path if it exists and new path is missing. */
function migrateFromLegacyIfNeeded(): void {
  if (!existsSync(LEGACY_CONFIG_FILE)) return;
  if (existsSync(CONFIG_FILE)) return;
  try {
    const dir = dirname(CONFIG_FILE);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    copyFileSync(LEGACY_CONFIG_FILE, CONFIG_FILE);
    console.log('[market-config] Migrated from', LEGACY_CONFIG_FILE, 'to', CONFIG_FILE);
  } catch (err) {
    console.warn('[market-config] Migration copy failed (will use defaults):', err instanceof Error ? err.message : err);
  }
}

function load(): MarketConfigStore {
  migrateFromLegacyIfNeeded();
  try {
    if (existsSync(CONFIG_FILE)) {
      const raw = readFileSync(CONFIG_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<MarketConfigStore>;
      return {
        banners: parsed.banners ?? SEED_BANNERS,
        layout: parsed.layout ?? SEED_LAYOUT,
      };
    }
  } catch (err) {
    console.warn('[market-config] Load failed (will use defaults):', err instanceof Error ? err.message : err);
  }
  return { banners: { ...SEED_BANNERS }, layout: { ...SEED_LAYOUT } };
}

function save(store: MarketConfigStore): void {
  try {
    const dir = dirname(CONFIG_FILE);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(CONFIG_FILE, JSON.stringify(store, null, 2), 'utf-8');
    cache = null; // Invalidate so next GET reads from disk; ensures storefront sees new banners immediately
  } catch (err) {
    console.error('[market-config] Failed to persist:', err);
  }
}

let cache: MarketConfigStore | null = null;

function getStore(): MarketConfigStore {
  if (!cache) cache = load();
  return cache;
}

export function getBannersForMarket(marketSlug: string): MarketBanner[] {
  return getStore().banners[marketSlug] ?? DEFAULT_BANNERS;
}

function normalizeSection(s: MarketSection & { type?: string }): MarketSection {
  return {
    ...s,
    type: s.type === 'MARKET_GROUP' ? 'MARKET_GROUP' : 'SLIDER',
  };
}

export function getLayoutForMarket(marketSlug: string): MarketSection[] {
  const raw = getStore().layout[marketSlug] ?? DEFAULT_LAYOUT;
  return raw.map((s) => normalizeSection(s as MarketSection & { type?: string }));
}

export function setBannersForMarket(marketSlug: string, banners: MarketBanner[]): void {
  const store = getStore();
  store.banners[marketSlug] = banners;
  save(store);
}

export function setLayoutForMarket(marketSlug: string, layout: MarketSection[]): void {
  const store = getStore();
  store.layout[marketSlug] = layout;
  save(store);
}
