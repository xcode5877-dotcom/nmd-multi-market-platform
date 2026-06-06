import type { ModifierIcon } from '@nmd/core';

export type { ModifierIcon };

export const MODIFIER_ICON_CATEGORY_LABELS: Record<string, string> = {
  pizza: 'بيتزا / إضافات',
  sauce: 'صلصات',
  drink: 'مشروبات',
  side: 'جانبية',
  default: 'عام',
};

export function createModifierIcon(partial?: Partial<ModifierIcon>): ModifierIcon {
  const key = (partial?.key ?? 'new_icon').trim().toLowerCase().replace(/\s+/g, '_');
  return {
    id: partial?.id ?? `mi_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    key,
    labelAr: partial?.labelAr ?? key,
    labelHe: partial?.labelHe,
    labelEn: partial?.labelEn ?? key,
    iconUrl: partial?.iconUrl ?? '',
    keywords: partial?.keywords ?? [],
    category: partial?.category ?? 'pizza',
    active: partial?.active !== false,
    sortOrder: partial?.sortOrder ?? Date.now(),
  };
}

export function normalizeModifierIconsList(raw: unknown): ModifierIcon[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x) => x != null && typeof x === 'object')
    .map((x) => {
      const row = x as ModifierIcon;
      return createModifierIcon(row);
    })
    .sort((a, b) => a.sortOrder - b.sortOrder || a.labelAr.localeCompare(b.labelAr, 'ar'));
}
