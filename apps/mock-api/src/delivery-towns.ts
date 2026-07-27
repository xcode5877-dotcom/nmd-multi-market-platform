/** Central list of supported delivery towns/villages for customer profile default. */
export const SUPPORTED_DELIVERY_TOWNS = [
  'دبورية',
  'إكسال',
  'شبلي',
  'أم الغنم',
  'طمرة',
  'الناعورة',
  'نين',
  'الطيبة',
  'كفر مصر',
] as const;

export type SupportedDeliveryTown = (typeof SUPPORTED_DELIVERY_TOWNS)[number];

const SUPPORTED_DELIVERY_TOWN_SET = new Set<string>(SUPPORTED_DELIVERY_TOWNS);

/** Returns true when [town] is an exact supported delivery area name. */
export function isSupportedDeliveryTown(town: string | undefined | null): boolean {
  const t = String(town ?? '').trim();
  if (!t) return false;
  return SUPPORTED_DELIVERY_TOWN_SET.has(t);
}

/** Match a tenant delivery zone to the customer's default town (exact or partial). */
export function matchDeliveryZoneForTown<T extends { id: string; name: string }>(
  zones: T[],
  town: string | undefined | null
): T | undefined {
  const t = String(town ?? '').trim();
  if (!t || zones.length === 0) return undefined;
  const exact = zones.find((z) => z.name.trim() === t);
  if (exact) return exact;
  const partial = zones.find((z) => z.name.includes(t) || t.includes(z.name.split('/')[0]?.trim() ?? ''));
  if (partial) return partial;
  const aliases: Record<string, string[]> = {
    شبلي: ['الشبلي', 'شبلي'],
    'أم الغنم': ['أم الغنم', 'الغنم'],
  };
  for (const [key, parts] of Object.entries(aliases)) {
    if (t.includes(key) || key.includes(t)) {
      const hit = zones.find((z) => parts.some((p) => z.name.includes(p)));
      if (hit) return hit;
    }
  }
  return undefined;
}
