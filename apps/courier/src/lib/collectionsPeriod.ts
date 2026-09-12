import type { CollectionsPeriod } from './collectionsSummary';

/** Persists last collections period across Courier routes/refreshes (not auth-sensitive). */
export const COLLECTIONS_PERIOD_STORAGE_KEY = 'courier-collections-period';

export function parseCollectionsPeriod(raw: string | null | undefined): CollectionsPeriod | null {
  if (raw === 'today' || raw === 'week' || raw === 'month' || raw === 'all') return raw;
  return null;
}

export function readStoredCollectionsPeriod(): CollectionsPeriod | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return parseCollectionsPeriod(localStorage.getItem(COLLECTIONS_PERIOD_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function writeStoredCollectionsPeriod(period: CollectionsPeriod): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(COLLECTIONS_PERIOD_STORAGE_KEY, period);
  } catch {
    /* ignore quota / private mode */
  }
}

/**
 * URL query wins when present; otherwise restore last courier selection; else today.
 * Never invent financial values — only restores which period filter is active.
 */
export function resolveCollectionsPeriod(urlRaw: string | null | undefined): CollectionsPeriod {
  return parseCollectionsPeriod(urlRaw) ?? readStoredCollectionsPeriod() ?? 'today';
}

/** Query string to append to internal nav links when the current location has no period. */
export function collectionsPeriodSearch(urlSearch: string): string {
  if (urlSearch && /(?:^|[?&])period=/.test(urlSearch)) return urlSearch.startsWith('?') ? urlSearch : `?${urlSearch}`;
  const stored = readStoredCollectionsPeriod();
  if (!stored || stored === 'today') return urlSearch || '';
  return `?period=${stored}`;
}
