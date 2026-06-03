export type HomePageBlockType =
  | 'HERO_BANNERS'
  | 'PILLARS'
  | 'STORE_SECTION'
  | 'EDITORIAL_PROMO'
  | 'CUSTOM_IMAGE_BANNER';

export type StoreSectionSource =
  | 'LAYOUT_SECTION'
  | 'ALL'
  | 'PILLAR'
  | 'SUB_CATEGORY'
  | 'MANUAL'
  | 'FEATURED';

export type StoreSectionLayout = 'HORIZONTAL' | 'GRID';

export type HomePageBlock = {
  id: string;
  type: HomePageBlockType;
  title: string;
  visible: boolean;
  sortOrder: number;
  config: Record<string, unknown>;
};

export const HOME_PAGE_BLOCK_TYPE_LABELS: Record<HomePageBlockType, string> = {
  HERO_BANNERS: 'سلايدر البانرات',
  PILLARS: 'الأقسام الرئيسية',
  STORE_SECTION: 'قسم محلات',
  EDITORIAL_PROMO: 'إعلان تفاعلي',
  CUSTOM_IMAGE_BANNER: 'بانر مخصص',
};

/** Arabic labels for known editorial campaigns (block list + preview). */
export const EDITORIAL_CAMPAIGN_DISPLAY_AR: Record<string, string> = {
  fc_food_mood: 'شو جاي عبالك اليوم',
  fc_weekly_challenge: 'تحدي / مسابقة',
  fc_rewards_nudge: 'مكافآت',
  fc_new_store_story: 'محل جديد / مميز',
};

export function displayBlockLabel(
  block: Pick<HomePageBlock, 'type' | 'title' | 'config'>,
  campaignTitle?: string,
): string {
  if (block.type === 'EDITORIAL_PROMO') {
    const cid = String(block.config?.campaignId ?? '').trim();
    if (cid && EDITORIAL_CAMPAIGN_DISPLAY_AR[cid]) {
      return EDITORIAL_CAMPAIGN_DISPLAY_AR[cid];
    }
    if (campaignTitle?.trim()) return campaignTitle.trim();
  }
  return block.title.trim() || HOME_PAGE_BLOCK_TYPE_LABELS[block.type];
}

export const STORE_SECTION_SOURCE_LABELS: Record<StoreSectionSource, string> = {
  LAYOUT_SECTION: 'قسم من التخطيط الحالي',
  ALL: 'كل المحلات',
  PILLAR: 'حسب العمود',
  SUB_CATEGORY: 'حسب تصنيف فرعي',
  MANUAL: 'محلات محددة',
  FEATURED: 'محلات مميزة (تخطيط)',
};

export function createHomePageBlock(
  type: HomePageBlockType,
  partial?: Partial<HomePageBlock>,
): HomePageBlock {
  const id = partial?.id ?? `block_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const defaults: Record<HomePageBlockType, Record<string, unknown>> = {
    HERO_BANNERS: {},
    PILLARS: {},
    STORE_SECTION: {
      source: 'LAYOUT_SECTION',
      layout: 'HORIZONTAL',
      limit: 12,
      storeIds: [],
    },
    EDITORIAL_PROMO: { campaignId: '' },
    CUSTOM_IMAGE_BANNER: {
      imageUrl: '',
      title: '',
      subtitle: '',
      ctaLabel: '',
      ctaAction: 'NONE',
      targetUrl: '',
    },
  };
  return {
    id,
    type,
    title: partial?.title ?? HOME_PAGE_BLOCK_TYPE_LABELS[type],
    visible: partial?.visible !== false,
    sortOrder: partial?.sortOrder ?? 0,
    config: { ...defaults[type], ...(partial?.config ?? {}) },
  };
}

const BLOCK_TYPES: HomePageBlockType[] = [
  'HERO_BANNERS',
  'PILLARS',
  'STORE_SECTION',
  'EDITORIAL_PROMO',
  'CUSTOM_IMAGE_BANNER',
];

export function normalizeHomePageBlocksList(raw: unknown): HomePageBlock[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x) => x != null && typeof x === 'object')
    .map((x) => {
      const row = x as Record<string, unknown>;
      const type = row.type as HomePageBlockType;
      if (!BLOCK_TYPES.includes(type)) return null;
      const cfgRaw = row.config;
      const config =
        cfgRaw != null && typeof cfgRaw === 'object' && !Array.isArray(cfgRaw)
          ? { ...(cfgRaw as Record<string, unknown>) }
          : {};
      return {
        id: String(row.id ?? `block_${Date.now()}`).trim(),
        type,
        title:
          String(row.title ?? '').trim() || HOME_PAGE_BLOCK_TYPE_LABELS[type],
        visible: row.visible !== false,
        sortOrder: Number.isFinite(row.sortOrder) ? Number(row.sortOrder) : 0,
        config,
      } satisfies HomePageBlock;
    })
    .filter((b): b is HomePageBlock => b != null)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function validateHomePageBlocksClient(blocks: HomePageBlock[]): string[] {
  const errors: string[] = [];
  for (const b of blocks) {
    const cfg = b.config ?? {};
    if (b.type === 'STORE_SECTION') {
      if (!b.title.trim()) errors.push('عنوان قسم المحلات مطلوب');
      const source = String(cfg.source ?? 'LAYOUT_SECTION') as StoreSectionSource;
      if (source === 'MANUAL' && !(Array.isArray(cfg.storeIds) && cfg.storeIds.length > 0)) {
        errors.push(`«${b.title}»: أضف محلاتاً`);
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
      errors.push(`«${b.title}»: صورة البانر مطلوبة`);
    }
  }
  return errors;
}

export function homePageBlocksSnapshotKey(blocks: HomePageBlock[]): string {
  return JSON.stringify(
    blocks.map((b, i) => ({
      ...b,
      sortOrder: i,
      config: b.config,
    })),
  );
}
