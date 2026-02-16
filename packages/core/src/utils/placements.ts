import type { PizzaPlacement } from '../types/cart.js';

/** Re-export for addon placement (WHOLE/LEFT/RIGHT). */
export type Placement = PizzaPlacement;

/** Arabic labels for addon placement. Single source of truth. */
export const PLACEMENT_LABELS_AR = {
  WHOLE: 'كامل',
  LEFT: 'يسار',
  RIGHT: 'يمين',
} as const;

/** Options for placement selector (value + Arabic label). */
export const PLACEMENT_OPTIONS_AR: { value: Placement; label: string }[] = [
  { value: 'WHOLE', label: PLACEMENT_LABELS_AR.WHOLE },
  { value: 'RIGHT', label: PLACEMENT_LABELS_AR.RIGHT },
  { value: 'LEFT', label: PLACEMENT_LABELS_AR.LEFT },
];

/** Format placement to Arabic label, or undefined if no placement. */
export function formatPlacementAr(p?: Placement | null): string | undefined {
  if (!p) return undefined;
  return PLACEMENT_LABELS_AR[p as keyof typeof PLACEMENT_LABELS_AR] ?? p;
}

/** Format addon name with optional placement. Returns "name" or "name (label)". */
export function formatAddonNameWithPlacement(name: string, p?: Placement | null): string {
  const label = formatPlacementAr(p);
  return label ? `${name} (${label})` : name;
}
