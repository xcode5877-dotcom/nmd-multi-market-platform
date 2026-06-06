import type { PizzaPlacement } from '../types/cart.js';

/** Re-export for addon placement (WHOLE/LEFT/RIGHT). */
export type Placement = PizzaPlacement;

/** Arabic labels for addon placement (pizza half-and-half). */
export const PLACEMENT_LABELS_AR = {
  WHOLE: 'كاملة',
  LEFT: 'نصف يسار',
  RIGHT: 'نصف يمين',
} as const;

/** Options for placement selector (value + Arabic label). */
export const PLACEMENT_OPTIONS_AR: { value: Placement; label: string }[] = [
  { value: 'WHOLE', label: PLACEMENT_LABELS_AR.WHOLE },
  { value: 'RIGHT', label: PLACEMENT_LABELS_AR.RIGHT },
  { value: 'LEFT', label: PLACEMENT_LABELS_AR.LEFT },
];

/** Format placement to Arabic label, or undefined if no placement / whole. */
export function formatPlacementAr(p?: Placement | null): string | undefined {
  if (!p) return undefined;
  const u = p as Placement;
  if (u === 'WHOLE') return undefined;
  return PLACEMENT_LABELS_AR[u as keyof typeof PLACEMENT_LABELS_AR] ?? p;
}

/**
 * Format addon name with optional placement.
 * Whole pizza: name only; left/right: `name (نصف …)`.
 */
export function formatAddonNameWithPlacement(name: string, p?: Placement | null): string {
  const label = formatPlacementAr(p);
  return label ? `${name} (${label})` : name;
}

/** Format a single option group selection for display. When two options with LEFT and RIGHT (half & half), returns "نصف X / نصف Y". */
export function formatHalfAndHalfOptionDisplay(
  ids: string[],
  placements: Record<string, Placement>,
  getOptionName: (id: string) => string | undefined
): string {
  if (ids.length !== 2) {
    return ids.map((id) => formatAddonNameWithPlacement(getOptionName(id) ?? id, placements[id])).filter(Boolean).join('، ');
  }
  const leftId = ids.find((id) => placements[id] === 'LEFT');
  const rightId = ids.find((id) => placements[id] === 'RIGHT');
  if (leftId != null && rightId != null) {
    const leftName = getOptionName(leftId) ?? leftId;
    const rightName = getOptionName(rightId) ?? rightId;
    return `نصف ${rightName} / نصف ${leftName}`;
  }
  return ids.map((id) => formatAddonNameWithPlacement(getOptionName(id) ?? id, placements[id])).filter(Boolean).join('، ');
}
