export type FeedCampaignKind =
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
  | 'CUSTOM_BANNER';

export type FeedCampaignAction =
  | 'OPEN_STORE'
  | 'OPEN_REWARD'
  | 'OPEN_COMPETITION'
  | 'OPEN_CATEGORY'
  | 'OPEN_SEARCH'
  | 'OPEN_POPUP'
  | 'EXTERNAL_LINK'
  | 'NONE';

export type FeedCampaignPlacement =
  | 'AFTER_FIRST_SECTION'
  | 'AFTER_SECOND_SECTION'
  | 'AFTER_EVERY_2_SECTIONS'
  | 'MANUAL_PRIORITY'
  /** @deprecated remapped on save/read */
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

export type FeedCampaignDesignVariant =
  | 'soft_teal'
  | 'white_card'
  | 'dark_teal_strip'
  | 'image_editorial'
  | 'minimal_text';

export type FeedCampaignVisualWeight = 'light' | 'medium' | 'heavy';

export type HomeFeedSpacingStyle = 'compact' | 'normal' | 'spacious';

export type FeedCampaignChip = {
  label: string;
  emoji?: string;
  iconUrl?: string;
  action?: FeedCampaignAction;
  targetId?: string;
  targetSlug?: string;
  sortOrder?: number;
  active?: boolean;
};

export type FeedCampaign = {
  id: string;
  title: string;
  subtitle: string;
  imageUrl?: string;
  type: FeedCampaignKind;
  ctaLabel: string;
  ctaAction: FeedCampaignAction;
  targetId?: string;
  targetUrl?: string;
  popupBody?: string;
  active: boolean;
  placement: FeedCampaignPlacement;
  manualAfterSection?: number;
  startDate?: string;
  endDate?: string;
  priority: number;
  sortOrder: number;
  participantCount?: number;
  countdownEndsAt?: string;
  categoryLabels?: string[];
  chips?: FeedCampaignChip[];
  backgroundStyle?: string;
  designVariant?: FeedCampaignDesignVariant;
  visualWeight?: FeedCampaignVisualWeight;
  afterEveryNSections?: number;
  allowAdjacentLargeVisual?: boolean;
  titleColor?: string;
  backgroundColor?: string;
  iconEmoji?: string;
};

export type HomeFeedSettings = {
  maxBlocksPerHome: number;
  maxPromoBlocksPerHome?: number;
  minStoreSectionsBetweenPromos?: number;
  firstPromoAfterSectionIndex?: number;
  spacingStyle: HomeFeedSpacingStyle;
  preventAdjacentLargeVisual: boolean;
  showLegacyBanners?: boolean;
  showPillars?: boolean;
};

export const DEFAULT_HOME_FEED_SETTINGS: HomeFeedSettings = {
  maxBlocksPerHome: 3,
  maxPromoBlocksPerHome: 3,
  minStoreSectionsBetweenPromos: 2,
  firstPromoAfterSectionIndex: 1,
  spacingStyle: 'normal',
  preventAdjacentLargeVisual: true,
  showLegacyBanners: true,
  showPillars: true,
};

/** Primary campaign types shown as cards in Home Page Builder. */
export const PRIMARY_CAMPAIGN_TYPE_CARDS: Array<{
  type: FeedCampaignKind;
  titleAr: string;
  descriptionAr: string;
}> = [
  {
    type: 'MOOD_DISCOVERY',
    titleAr: 'اكتشاف حسب المزاج',
    descriptionAr:
      'كرت مثل: شو جاي عبالك اليوم؟ يحتوي أيقونات يختارها الزبون وتفتح محل/تصنيف/بحث.',
  },
  {
    type: 'CHALLENGE_CARD',
    titleAr: 'إعلان تحدي / مسابقة',
    descriptionAr: 'كرت لمسابقة أو بطولة أو جائزة مع زر مشاركة.',
  },
  {
    type: 'REWARDS_DISCOVERY',
    titleAr: 'تذكير بالمكافآت',
    descriptionAr: 'كرت يشجع الزبون على استخدام العملات واستبدال الجوائز.',
  },
  {
    type: 'FEATURED_STORE_STORY',
    titleAr: 'محل جديد / مميز',
    descriptionAr: 'كرت يعرّف بمحل جديد أو مميز، ويجب أن يفتح صفحة المحل عند الضغط.',
  },
  {
    type: 'GLASS_STRIP',
    titleAr: 'عروض الليلة',
    descriptionAr: 'شريط عروض مختصر بين أقسام المحلات.',
  },
];
export const HOME_FEED_PROMO_HELPER_AR =
  'يمكن عرض حتى 3 إعلانات داخل الصفحة الرئيسية، بين أقسام المحلات فقط. لن تظهر الإعلانات داخل صفحات التصنيفات مثل المطاعm والخدمات.';

/** Where a placement appears on the home feed (admin cards). */
export const FEED_PLACEMENT_PREVIEW_AR: Record<string, string> = {
  AFTER_FIRST_SECTION: 'بعد أول قسم محلات',
  AFTER_SECOND_SECTION: 'بعد ثاني قسم',
  AFTER_EVERY_2_SECTIONS: 'بين الأقسام',
  MANUAL_PRIORITY: 'حسب الأولوية',
  TOP: 'بعد الهيرو الرئيسي',
};

export function normalizeFeedCampaignPlacement(
  placement: FeedCampaignPlacement,
): FeedCampaignPlacement {
  switch (placement) {
    case 'TOP':
    case 'TOP_AFTER_LEGACY_BANNERS':
    case 'AFTER_PILLARS':
    case 'AFTER_SECTION_1':
    case 'AFTER_STORE_SECTION_1':
      return 'AFTER_FIRST_SECTION';
    case 'AFTER_SECTION_2':
    case 'AFTER_STORE_SECTION_2':
      return 'AFTER_SECOND_SECTION';
    case 'AFTER_EVERY_2_ROWS':
    case 'AFTER_EVERY_N_SECTIONS':
      return 'AFTER_EVERY_2_SECTIONS';
    case 'MANUAL_ORDER':
      return 'MANUAL_PRIORITY';
    default:
      return placement;
  }
}

export const FEED_CAMPAIGN_KIND_LABELS: Record<FeedCampaignKind, string> = {
  HERO_BANNER: 'بطاقة افتتاحية (قديم)',
  OFFER_STRIP: 'شريط زجاجي',
  COMPETITION_CARD: 'مسابقة',
  REWARD_CARD: 'مكافآت',
  STORE_FEATURE: 'متجر مميز',
  POPUP_TRIGGER: 'نافذة منبثقة',
  CATEGORY_DISCOVERY: 'اكتشاف تصنيفات',
  MOOD_DISCOVERY: 'شو جاي عبالك؟',
  GLASS_STRIP: 'شريط زجاجي صغير',
  CHALLENGE_CARD: 'بطولة / تحدي',
  REWARDS_DISCOVERY: 'اكتشاف المكافآت',
  FEATURED_STORE_STORY: 'قصة متجر',
  CUSTOM_BANNER: 'بانر مخصص',
};

export const FEED_CAMPAIGN_ACTION_LABELS: Record<FeedCampaignAction, string> = {
  OPEN_STORE: 'فتح متجر',
  OPEN_REWARD: 'صفحة المكافآت',
  OPEN_COMPETITION: 'مسابقة',
  OPEN_CATEGORY: 'تصنيف / عمود',
  OPEN_SEARCH: 'بحث',
  OPEN_POPUP: 'نافذة منبثقة',
  EXTERNAL_LINK: 'رابط خارجي أو مسار',
  NONE: 'بدون إجراء',
};

export const FEED_CAMPAIGN_PLACEMENT_LABELS: Record<FeedCampaignPlacement, string> = {
  AFTER_FIRST_SECTION: 'بعد أول قسم محلات',
  AFTER_SECOND_SECTION: 'بعد ثاني قسم',
  AFTER_EVERY_2_SECTIONS: 'بين الأقسام',
  MANUAL_PRIORITY: 'حسب الأولوية',
  TOP: 'بعد الهيرو الرئيسي',
  TOP_AFTER_LEGACY_BANNERS: 'قديم: بعد البanner',
  AFTER_PILLARS: 'قديم: بعد الأعمدة',
  AFTER_SECTION_1: 'بعد القسم الأول',
  AFTER_STORE_SECTION_1: 'بعد قسم المحلات 1',
  AFTER_SECTION_2: 'بعد القسم الثاني',
  AFTER_STORE_SECTION_2: 'بعد قسم المحلات 2',
  AFTER_EVERY_2_ROWS: 'قديم: بعد كل قسمين',
  AFTER_EVERY_N_SECTIONS: 'بعد كل N أقسام',
  MANUAL_ORDER: 'بعد قسم محدد (فهرس)',
};

/** Primary placements shown in campaign editor. */
export const PRIMARY_FEED_PLACEMENTS: FeedCampaignPlacement[] = [
  'AFTER_FIRST_SECTION',
  'AFTER_SECOND_SECTION',
  'AFTER_EVERY_2_SECTIONS',
  'MANUAL_PRIORITY',
];

export const DESIGN_VARIANT_LABELS: Record<FeedCampaignDesignVariant, string> = {
  soft_teal: 'تيل ناعم',
  white_card: 'بطاقة بيضاء',
  dark_teal_strip: 'شريط تيل داكن',
  image_editorial: 'صورة تحريرية',
  minimal_text: 'نص فقط',
};

export const FIXED_HOME_BLOCKS = [
  { id: 'search', label: 'شريط البحث', locked: true },
  { id: 'legacy_banners', label: 'البanner / الكarousel القديم', locked: true },
  { id: 'pillars', label: 'الأعمدة / التصنيفات', locked: true },
  { id: 'store_sections', label: 'أقسام المحلات', locked: true },
] as const;

export function normalizeFeedCampaignType(type: FeedCampaignKind): FeedCampaignKind {
  switch (type) {
    case 'MOOD_DISCOVERY':
      return 'CATEGORY_DISCOVERY';
    case 'GLASS_STRIP':
      return 'OFFER_STRIP';
    case 'CHALLENGE_CARD':
      return 'COMPETITION_CARD';
    case 'REWARDS_DISCOVERY':
      return 'REWARD_CARD';
    case 'FEATURED_STORE_STORY':
      return 'STORE_FEATURE';
    case 'CUSTOM_BANNER':
      return 'HERO_BANNER';
    default:
      return type;
  }
}

export function createFeedCampaign(
  input: Omit<FeedCampaign, 'id' | 'sortOrder'> & { sortOrder?: number },
): FeedCampaign {
  return {
    id: `fc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    sortOrder: input.sortOrder ?? Date.now(),
    ...input,
    type: normalizeFeedCampaignType(input.type),
  };
}

export function validateFeedCampaign(c: FeedCampaign): string[] {
  const type = normalizeFeedCampaignType(c.type);
  const errors: string[] = [];
  if (!c.title.trim()) errors.push('العنوان مطلوب');
  if (c.active && !c.placement) errors.push('موضع الإدراج مطلوب للكتلة النشطة');

  if (isMoodType(type)) {
    const chips = c.chips ?? [];
    const activeChips = chips.filter((ch) => ch.active !== false && ch.label?.trim());
    if (activeChips.length === 0) errors.push('أضف عنصر مزاج واحد على الأقل');
    errors.push(...validateFeedCampaignChips(chips));
  }

  if (type === 'STORE_FEATURE') {
    if (!c.targetId?.trim()) errors.push('المحل المستهدف مطلوب');
    if (!c.imageUrl?.trim()) errors.push('صورة المحل مطلوبة');
  }

  if (type === 'COMPETITION_CARD') {
    if (!c.subtitle.trim()) errors.push('الوصف الفرعي مطلوب');
    if (c.ctaAction !== 'NONE' && !(c.targetId?.trim() || c.targetUrl?.trim())) {
      errors.push('هدف الإجراء مطلوب عند تفعيل الزر');
    }
  }

  if (type === 'REWARD_CARD' && !c.subtitle.trim()) {
    errors.push('الوصف الفرعي مطلوب');
  }

  if (type === 'OFFER_STRIP' && !c.subtitle.trim()) {
    errors.push('الوصف الفرعي مطلوب');
  }

  if (
    (c.ctaAction === 'OPEN_STORE' || c.ctaAction === 'OPEN_CATEGORY') &&
    !(c.targetId?.trim())
  ) {
    if (!isMoodType(type) && type !== 'STORE_FEATURE') {
      errors.push('معرّف الهدف مطلوب لهذا الإجراء');
    }
  }
  const needsImage =
    c.type === 'CUSTOM_BANNER' &&
    (c.designVariant === 'image_editorial' || c.visualWeight === 'heavy');
  if (needsImage && !(c.imageUrl?.trim())) {
    errors.push('الصورة مطلوبة لهذا النمط');
  }
  if (
    (c.type === 'FEATURED_STORE_STORY' || c.type === 'STORE_FEATURE') &&
    !(c.targetId?.trim()) &&
    c.ctaAction === 'OPEN_STORE'
  ) {
    errors.push('معرّف المتجر مطلوب');
  }
  if (isMoodType(c.type)) {
    errors.push(...validateFeedCampaignChips(c.chips));
  }
  if (
    (c.placement === 'TOP' || c.placement === 'TOP_AFTER_LEGACY_BANNERS') &&
    (c.visualWeight === 'heavy' || c.type === 'CUSTOM_BANNER') &&
    !c.allowAdjacentLargeVisual
  ) {
    errors.push('تحذير: بانر كبير قرب الكarousel — فعّل السماح أو غيّر الموضع');
  }
  return errors;
}

export function isMoodType(type: FeedCampaignKind) {
  return type === 'CATEGORY_DISCOVERY' || type === 'MOOD_DISCOVERY';
}

export function placementPreviewLabel(placement: FeedCampaignPlacement): string {
  const normalized = normalizeFeedCampaignPlacement(placement);
  return FEED_PLACEMENT_PREVIEW_AR[normalized] ?? FEED_CAMPAIGN_PLACEMENT_LABELS[normalized];
}

export function validateFeedCampaignChips(chips: FeedCampaignChip[] | undefined): string[] {
  const errors: string[] = [];
  if (!chips?.length) return errors;
  chips.forEach((chip, i) => {
    if (chip.active === false) return;
    if (!chip.label?.trim()) errors.push(`عنصر ${i + 1}: التسمية مطلوبة`);
    const action = chip.action ?? 'OPEN_CATEGORY';
    if (
      action !== 'NONE' &&
      !(chip.targetId?.trim() || chip.targetSlug?.trim())
    ) {
      errors.push(`عنصر ${i + 1}: الهدف مطلوب عند تفعيل الإجراء`);
    }
  });
  return errors;
}

/** Normalize a campaign before PUT so server and Flutter see a consistent shape. */
export function sanitizeFeedCampaignForSave(c: FeedCampaign): FeedCampaign {
  const type = normalizeFeedCampaignType(c.type);
  const placement = normalizeFeedCampaignPlacement(c.placement);
  const chips = isMoodType(type)
    ? (c.chips ?? [])
        .map((chip, i) => ({
          label: chip.label.trim(),
          emoji: chip.emoji?.trim() || undefined,
          iconUrl: chip.iconUrl?.trim() || undefined,
          action: chip.action ?? 'OPEN_CATEGORY',
          targetId: chip.targetId?.trim() || undefined,
          targetSlug: chip.targetSlug?.trim() || undefined,
          sortOrder: chip.sortOrder ?? i + 1,
          active: chip.active !== false,
        }))
        .filter((chip) => chip.label.length > 0)
    : undefined;

  return {
    ...c,
    type,
    placement,
    title: c.title.trim(),
    subtitle: c.subtitle.trim(),
    imageUrl: c.imageUrl?.trim() || undefined,
    targetId: c.targetId?.trim() || undefined,
    targetUrl: c.targetUrl?.trim() || undefined,
    popupBody: c.popupBody?.trim() || undefined,
    startDate: c.startDate?.trim() || undefined,
    endDate: c.endDate?.trim() || undefined,
    countdownEndsAt: c.countdownEndsAt?.trim() || undefined,
    ctaAction:
      type === 'STORE_FEATURE'
        ? 'OPEN_STORE'
        : type === 'REWARD_CARD'
          ? 'OPEN_REWARD'
          : c.ctaAction,
    categoryLabels:
      isMoodType(type) && !(chips?.length)
        ? (c.categoryLabels ?? []).map((l) => l.trim()).filter(Boolean)
        : undefined,
    chips: chips?.length ? chips : isMoodType(type) ? [] : undefined,
  };
}

export function sanitizeFeedCampaignsForSave(campaigns: FeedCampaign[]): FeedCampaign[] {
  return campaigns.map(sanitizeFeedCampaignForSave);
}

export function feedCampaignsSnapshotKey(campaigns: FeedCampaign[]): string {
  return JSON.stringify(sanitizeFeedCampaignsForSave(campaigns));
}

/** Defaults when admin picks a campaign type card. */
export function defaultsForCampaignType(type: FeedCampaignKind): Partial<Omit<FeedCampaign, 'id' | 'sortOrder'>> {
  switch (type) {
    case 'MOOD_DISCOVERY':
    case 'CATEGORY_DISCOVERY':
      return {
        type,
        title: 'شو جاي عبالك اليوم؟',
        subtitle: '',
        ctaAction: 'NONE',
        ctaLabel: '',
        placement: 'AFTER_FIRST_SECTION',
      };
    case 'CHALLENGE_CARD':
    case 'COMPETITION_CARD':
      return {
        type,
        ctaAction: 'OPEN_REWARD',
        ctaLabel: 'شارك الآن',
        placement: 'AFTER_SECOND_SECTION',
      };
    case 'REWARDS_DISCOVERY':
    case 'REWARD_CARD':
      return {
        type,
        title: 'استبدل عملاتك',
        subtitle: 'جوائز وقسائم بانتظارك',
        ctaAction: 'OPEN_REWARD',
        ctaLabel: 'المكافآt',
        placement: 'AFTER_FIRST_SECTION',
      };
    case 'FEATURED_STORE_STORY':
    case 'STORE_FEATURE':
      return {
        type,
        ctaAction: 'OPEN_STORE',
        ctaLabel: 'زور المحل',
        placement: 'AFTER_FIRST_SECTION',
      };
    case 'GLASS_STRIP':
    case 'OFFER_STRIP':
      return {
        type,
        title: 'عروض الليلة',
        subtitle: 'عروض مختارة لك',
        ctaAction: 'NONE',
        ctaLabel: '',
        placement: 'AFTER_EVERY_2_SECTIONS',
      };
    default:
      return { type };
  }
}
