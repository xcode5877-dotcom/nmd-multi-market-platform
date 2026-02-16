import type { StorefrontHero, StorefrontBanner } from '@nmd/core';
import type { Category, OptionGroup } from '@nmd/core';
import { generateId } from '@nmd/core';

export const CLOTHING_TEMPLATE = {
  hero: {
    title: 'مرحباً بك',
    subtitle: 'اكتشف أحدث صيحات الموضة',
    ctaText: 'تسوق الآن',
    ctaLink: '#',
    ctaHref: '#',
  } satisfies StorefrontHero,

  banners: [
    {
      id: 'banner-1',
      imageUrl: 'https://placehold.co/1200x400/e2e8f0/64748b?text=عرض+خاص',
      title: 'عرض خاص',
      subtitle: 'خصومات حتى 30%',
      ctaText: 'تسوقي الآن',
      ctaHref: '#',
      enabled: true,
      sortOrder: 0,
    },
    {
      id: 'banner-2',
      imageUrl: 'https://placehold.co/1200x400/f1f5f9/475569?text=عرض+محدود',
      title: 'عرض محدود',
      subtitle: 'ينتهي قريباً',
      ctaText: 'اكتشفي',
      ctaHref: '#',
      enabled: true,
      sortOrder: 1,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      showCountdown: true,
    },
    {
      id: 'banner-3',
      imageUrl: 'https://placehold.co/1200x400/ede9fe/6d28d9?text=وصل+حديثاً',
      title: 'وصل حديثاً',
      subtitle: 'موديلات جديدة',
      ctaText: 'عرض الكل',
      ctaHref: '#',
      enabled: true,
      sortOrder: 2,
    },
  ] as StorefrontBanner[],

  categoryNames: ['فساتين', 'بلايز', 'بناطيل', 'جاكيتات', 'أطقم'],

  optionGroupDefs: [
    { name: 'مقاسات ملابس', type: 'SIZE' as const, itemNames: ['S', 'M', 'L', 'XL'] },
    { name: 'ألوان شائعة', type: 'COLOR' as const, itemNames: ['أسود', 'أبيض', 'بيج', 'أزرق', 'وردي'] },
  ],
};

export function buildClothingTemplateForTenant(tenantId: string): {
  hero: StorefrontHero;
  banners: StorefrontBanner[];
  categories: Category[];
  optionGroups: OptionGroup[];
} {
  const categories: Category[] = CLOTHING_TEMPLATE.categoryNames.map((name, i) => ({
    id: generateId(),
    tenantId,
    name,
    slug: name.toLowerCase().replace(/\s/g, '-'),
    sortOrder: i,
    parentId: null,
    isVisible: true,
  }));

  const optionGroups: OptionGroup[] = CLOTHING_TEMPLATE.optionGroupDefs.map((def) => ({
    id: generateId(),
    tenantId,
    name: def.name,
    type: def.type,
    required: def.type === 'SIZE',
    minSelected: def.type === 'SIZE' ? 1 : 0,
    maxSelected: 1,
    selectionType: 'single' as const,
    items: def.itemNames.map((name, i) => ({
      id: generateId(),
      name,
      sortOrder: i,
    })),
  }));

  return {
    hero: { ...CLOTHING_TEMPLATE.hero },
    banners: CLOTHING_TEMPLATE.banners.map((b) => ({ ...b, id: generateId() })),
    categories,
    optionGroups,
  };
}
