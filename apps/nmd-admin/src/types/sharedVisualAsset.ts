export type SharedVisualAssetType =
  | 'reward_icon'
  | 'category_icon'
  | 'service_icon'
  | 'community_banner'
  | 'section_cover'
  | 'placeholder';

export type SharedVisualAsset = {
  id: string;
  type: SharedVisualAssetType;
  title: string;
  imageUrl: string;
  thumbnailUrl?: string;
  darkModeUrl?: string;
  active: boolean;
  createdAt: string;
  sortOrder: number;
};

export const VISUAL_ASSET_TYPE_LABELS: Record<SharedVisualAssetType, string> = {
  reward_icon: 'أيقونة مكافأة',
  category_icon: 'أيقونة تصنيف',
  service_icon: 'أيقونة خدمة',
  community_banner: 'بانر مجتمع',
  section_cover: 'غلاف قسم',
  placeholder: 'Placeholder',
};

export const VISUAL_ASSETS_STORAGE_KEY = 'nmd-visual-assets-catalog-v1';

export function loadVisualAssetsCatalog(): SharedVisualAsset[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(VISUAL_ASSETS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SharedVisualAsset[];
    return Array.isArray(parsed) ? parsed.sort((a, b) => a.sortOrder - b.sortOrder) : [];
  } catch {
    return [];
  }
}

export function saveVisualAssetsCatalog(items: SharedVisualAsset[]): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(VISUAL_ASSETS_STORAGE_KEY, JSON.stringify(items));
}

export function createVisualAsset(input: Omit<SharedVisualAsset, 'id' | 'createdAt' | 'sortOrder'> & { sortOrder?: number }): SharedVisualAsset {
  const now = new Date().toISOString();
  return {
    id: `va_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: now,
    sortOrder: input.sortOrder ?? Date.now(),
    ...input,
  };
}
