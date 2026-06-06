import type { ModifierIcon } from '@nmd/core';

const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ?? '';

export async function fetchMarketModifierIcons(marketSlug: string): Promise<ModifierIcon[]> {
  if (!MOCK_API_URL || !marketSlug.trim()) return [];
  const slug = encodeURIComponent(marketSlug.trim());
  const res = await fetch(`${MOCK_API_URL}/markets/by-slug/${slug}/modifier-icons`);
  if (!res.ok) return [];
  const raw = await res.json();
  if (!Array.isArray(raw)) return [];
  return raw as ModifierIcon[];
}

export async function resolveMarketSlugFromId(marketId: string | undefined): Promise<string> {
  if (!MOCK_API_URL || !marketId?.trim()) return 'dabburiyya';
  try {
    const res = await fetch(`${MOCK_API_URL}/markets/${encodeURIComponent(marketId)}`);
    if (!res.ok) return 'dabburiyya';
    const m = (await res.json()) as { slug?: string };
    return (m.slug ?? 'dabburiyya').trim() || 'dabburiyya';
  } catch {
    return 'dabburiyya';
  }
}
