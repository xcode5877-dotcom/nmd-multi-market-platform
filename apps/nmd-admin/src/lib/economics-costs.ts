/**
 * Manual operational cost inputs — admin-side only, localStorage.
 * Not accounting; used for burn/contribution estimates in economics dashboard.
 */

export type OperationalCostCategory =
  | 'vps'
  | 'cursor'
  | 'gemini'
  | 'chatgpt'
  | 'ads'
  | 'drivers'
  | 'fuel'
  | 'employees'
  | 'support'
  | 'misc';

export type OperationalCostEntry = {
  id: string;
  category: OperationalCostCategory;
  label: string;
  amountMonthly: number;
};

export const OPERATIONAL_COST_PRESETS: { category: OperationalCostCategory; label: string; defaultAmount: number }[] = [
  { category: 'vps', label: 'VPS / استضافة', defaultAmount: 200 },
  { category: 'cursor', label: 'Cursor', defaultAmount: 80 },
  { category: 'gemini', label: 'Gemini API', defaultAmount: 50 },
  { category: 'chatgpt', label: 'ChatGPT', defaultAmount: 80 },
  { category: 'ads', label: 'إعلانات Meta', defaultAmount: 3000 },
  { category: 'drivers', label: 'سائقون', defaultAmount: 8000 },
  { category: 'fuel', label: 'وقود', defaultAmount: 1500 },
  { category: 'employees', label: 'موظفون', defaultAmount: 12000 },
  { category: 'support', label: 'دعم فني', defaultAmount: 2000 },
  { category: 'misc', label: 'متفرقات', defaultAmount: 500 },
];

const STORAGE_KEY = 'nmd-economics-operational-costs-v1';

function newId(): string {
  return `cost-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function defaultOperationalCosts(): OperationalCostEntry[] {
  return OPERATIONAL_COST_PRESETS.map((p) => ({
    id: newId(),
    category: p.category,
    label: p.label,
    amountMonthly: p.defaultAmount,
  }));
}

export function loadOperationalCosts(): OperationalCostEntry[] {
  if (typeof localStorage === 'undefined') return defaultOperationalCosts();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultOperationalCosts();
    const parsed = JSON.parse(raw) as OperationalCostEntry[];
    if (!Array.isArray(parsed) || parsed.length === 0) return defaultOperationalCosts();
    return parsed.map((e) => ({
      id: e.id || newId(),
      category: e.category || 'misc',
      label: e.label || '—',
      amountMonthly: Number(e.amountMonthly) || 0,
    }));
  } catch {
    return defaultOperationalCosts();
  }
}

export function saveOperationalCosts(entries: OperationalCostEntry[]): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export function monthlyOperationalTotal(entries: OperationalCostEntry[]): number {
  return entries.reduce((s, e) => s + Math.max(0, e.amountMonthly), 0);
}
