import type { OperationalStatus } from '../types/tenant.js';

const STATUS_RANK: Record<OperationalStatus, number> = {
  open: 0,
  busy: 1,
  closed: 2,
};

/** Stable sort: open → busy → closed; preserves original order within each group. */
export function sortByOperationalStatus<T>(
  items: T[],
  getStatus: (item: T) => OperationalStatus | string | undefined | null
): T[] {
  return items
    .map((item, index) => ({ item, index, rank: rankStatus(getStatus(item)) }))
    .sort((a, b) => (a.rank !== b.rank ? a.rank - b.rank : a.index - b.index))
    .map(({ item }) => item);
}

function rankStatus(raw: OperationalStatus | string | undefined | null): number {
  const s = String(raw ?? 'closed').toLowerCase();
  if (s === 'open') return STATUS_RANK.open;
  if (s === 'busy') return STATUS_RANK.busy;
  return STATUS_RANK.closed;
}
