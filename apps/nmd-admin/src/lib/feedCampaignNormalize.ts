import type { FeedCampaign, FeedCampaignChip } from '../types/feedCampaign';

/** Safe array coercion — never call .map/.forEach on unknown API values. */
export function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value == null) return [];
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>;
    const numericKeys = Object.keys(o)
      .filter((k) => /^\d+$/.test(k))
      .sort((a, b) => Number(a) - Number(b));
    if (numericKeys.length > 0) {
      logNormalize('array-like-object', numericKeys.length);
      return numericKeys.map((k) => o[k] as T);
    }
  }
  if (typeof value === 'string' && value.trim()) {
    logNormalize('string', value.length);
  }
  return [];
}

export function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => String(v ?? '').trim()).filter(Boolean);
  }
  if (typeof value === 'string' && value.trim()) {
    logNormalize('categoryLabels-string', value.length);
    return value
      .split(/[,،|]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function logNormalize(field: string, shape: string | number): void {
  if (typeof console !== 'undefined') {
    console.log('[HOME_BUILDER_NORMALIZE]', { field, shape });
  }
}

function normalizeChip(raw: unknown, index: number): FeedCampaignChip | null {
  if (raw == null || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const label = String(o.label ?? '').trim();
  if (!label) return null;
  return {
    label,
    emoji: o.emoji != null ? String(o.emoji).trim() : undefined,
    iconUrl: o.iconUrl != null ? String(o.iconUrl).trim() : undefined,
    action: (o.action ?? o.actionType ?? 'OPEN_CATEGORY') as FeedCampaignChip['action'],
    targetId: o.targetId != null ? String(o.targetId).trim() : undefined,
    targetSlug: o.targetSlug != null ? String(o.targetSlug).trim() : undefined,
    sortOrder: typeof o.sortOrder === 'number' ? o.sortOrder : index + 1,
    active: o.active !== false,
  };
}

/** Normalize one campaign from GET /feed-campaigns (admin or public). */
export function normalizeFeedCampaignFromApi(raw: unknown): FeedCampaign | null {
  if (raw == null || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const id = String(o.id ?? '').trim();
  if (!id) return null;

  const chipsRaw = o.chips;
  let chips = asArray<unknown>(chipsRaw)
    .map((c, i) => normalizeChip(c, i))
    .filter((c): c is FeedCampaignChip => c != null);

  const categoryLabels = asStringArray(o.categoryLabels);
  if (chips.length === 0 && categoryLabels.length > 0) {
    chips = categoryLabels.map((label, i) => ({
      label,
      emoji: '',
      action: 'OPEN_CATEGORY' as const,
      sortOrder: i + 1,
      active: true,
    }));
  }

  if (chipsRaw != null && !Array.isArray(chipsRaw) && typeof chipsRaw !== 'object') {
    logNormalize('chips', typeof chipsRaw);
  }

  return {
    id,
    title: String(o.title ?? ''),
    subtitle: String(o.subtitle ?? ''),
    imageUrl: o.imageUrl != null ? String(o.imageUrl).trim() : undefined,
    type: o.type as FeedCampaign['type'],
    ctaLabel: String(o.ctaLabel ?? 'اكتشف'),
    ctaAction: (o.ctaAction ?? 'NONE') as FeedCampaign['ctaAction'],
    targetId: o.targetId != null ? String(o.targetId).trim() : undefined,
    targetUrl: o.targetUrl != null ? String(o.targetUrl).trim() : undefined,
    popupBody: o.popupBody != null ? String(o.popupBody).trim() : undefined,
    active: o.active !== false,
    placement: (o.placement ?? 'AFTER_FIRST_SECTION') as FeedCampaign['placement'],
    manualAfterSection:
      typeof o.manualAfterSection === 'number' ? o.manualAfterSection : undefined,
    priority: typeof o.priority === 'number' ? o.priority : 0,
    sortOrder: typeof o.sortOrder === 'number' ? o.sortOrder : 0,
    startDate: o.startDate != null ? String(o.startDate) : undefined,
    endDate: o.endDate != null ? String(o.endDate) : undefined,
    participantCount:
      typeof o.participantCount === 'number' ? o.participantCount : undefined,
    countdownEndsAt: o.countdownEndsAt != null ? String(o.countdownEndsAt) : undefined,
    categoryLabels,
    chips,
    backgroundStyle: o.backgroundStyle != null ? String(o.backgroundStyle) : undefined,
    designVariant: o.designVariant as FeedCampaign['designVariant'],
    visualWeight: o.visualWeight as FeedCampaign['visualWeight'],
    afterEveryNSections:
      typeof o.afterEveryNSections === 'number' ? o.afterEveryNSections : undefined,
    allowAdjacentLargeVisual: o.allowAdjacentLargeVisual === true,
    titleColor: o.titleColor != null ? String(o.titleColor) : undefined,
    backgroundColor: o.backgroundColor != null ? String(o.backgroundColor) : undefined,
    iconEmoji: o.iconEmoji != null ? String(o.iconEmoji) : undefined,
  };
}

export function normalizeFeedCampaignListFromApi(raw: unknown): FeedCampaign[] {
  const list = asArray<unknown>(raw);
  if (raw != null && !Array.isArray(raw)) {
    logNormalize('feed-campaigns-root', typeof raw);
  }
  return list
    .map((row) => normalizeFeedCampaignFromApi(row))
    .filter((c): c is FeedCampaign => c != null);
}

export function normalizeMarketsList(raw: unknown): Array<{ slug: string; name?: string; nameAr?: string }> {
  return asArray<{ slug: string; name?: string; nameAr?: string }>(raw);
}

export function normalizeTenantsList(
  raw: unknown,
): Array<{ id: string; name?: string; slug?: string }> {
  return asArray<{ id: string; name?: string; slug?: string }>(raw);
}

export function normalizePillarsList(
  raw: unknown,
): Array<{ id: string; title?: string; nameAr?: string; name?: string }> {
  return asArray<{ id: string; title?: string; nameAr?: string; name?: string }>(raw);
}

const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ?? '';

/** Extract first image URL from upload API responses. */
export function firstUploadUrl(response: unknown): string | null {
  if (response == null) return null;
  if (typeof response === 'string') {
    const s = response.trim();
    return s || null;
  }
  if (Array.isArray(response)) {
    for (const item of response) {
      const u = firstUploadUrl(item);
      if (u) return u;
    }
    return null;
  }
  if (typeof response !== 'object') return null;

  const o = response as Record<string, unknown>;
  if (typeof o.url === 'string' && o.url.trim()) return absolutizeUploadUrl(o.url.trim());
  if (Array.isArray(o.urls)) {
    for (const item of o.urls) {
      const u = firstUploadUrl(item);
      if (u) return u;
    }
  }
  if (typeof o.path === 'string' && o.path.trim()) return absolutizeUploadUrl(o.path.trim());
  if (typeof o.relativePath === 'string' && o.relativePath.trim()) {
    return absolutizeUploadUrl(o.relativePath.trim());
  }
  return null;
}

function absolutizeUploadUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const base = MOCK_API_URL.replace(/\/$/, '');
  if (!base) return path;
  return path.startsWith('/') ? `${base}${path}` : `${base}/${path}`;
}
