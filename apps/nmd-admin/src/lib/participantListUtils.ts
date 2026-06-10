/** Digits-only phone for loose matching (0546… vs +972546…). */
export function normalizePhoneDigits(phone: string | undefined | null): string {
  return String(phone ?? '').replace(/\D/g, '');
}

type ParticipantDateFields = {
  redeemedAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

/** Newest first: redeemedAt → createdAt → updatedAt. */
export function participantSortTimestamp(row: ParticipantDateFields): number {
  const iso = row.redeemedAt ?? row.createdAt ?? row.updatedAt ?? '';
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : 0;
}

export function sortParticipantsByDateDesc<T extends ParticipantDateFields>(rows: T[]): T[] {
  return [...rows].sort((a, b) => participantSortTimestamp(b) - participantSortTimestamp(a));
}

export type ParticipantSearchFields = {
  name?: string | null;
  phone?: string | null;
  normalizedPhone?: string | null;
};

export function matchesParticipantSearch(query: string, fields: ParticipantSearchFields): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const name = String(fields.name ?? '').trim().toLowerCase();
  if (name && name.includes(q)) return true;

  const phone = String(fields.phone ?? '').trim();
  const phoneLower = phone.toLowerCase();
  if (phoneLower && phoneLower.includes(q)) return true;

  const qDigits = normalizePhoneDigits(q);
  if (qDigits.length >= 2) {
    const phoneDigits = normalizePhoneDigits(phone);
    if (phoneDigits.includes(qDigits)) return true;

    const normalizedDigits = normalizePhoneDigits(fields.normalizedPhone);
    if (normalizedDigits.includes(qDigits)) return true;

    // Match local vs international (972… vs 0…)
    if (qDigits.startsWith('0') && phoneDigits.endsWith(qDigits.slice(1))) return true;
    if (phoneDigits.startsWith('972') && qDigits.startsWith('0') && phoneDigits.endsWith(qDigits.slice(1))) {
      return true;
    }
  }

  return false;
}

export type CustomerSearchFields = ParticipantSearchFields & {
  email?: string | null;
};

export function matchesCustomerSearch(query: string, fields: CustomerSearchFields): boolean {
  if (matchesParticipantSearch(query, fields)) return true;
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const email = String(fields.email ?? '').trim().toLowerCase();
  return email.length > 0 && email.includes(q);
}

/** Newest registered first (createdAt, then updatedAt fallback). */
export function sortCustomersByRegisteredDesc<T extends { createdAt?: string; updatedAt?: string }>(
  rows: T[],
): T[] {
  return [...rows].sort((a, b) => customerRegisteredTimestamp(b) - customerRegisteredTimestamp(a));
}

function customerRegisteredTimestamp(row: { createdAt?: string; updatedAt?: string }): number {
  const iso = row.createdAt ?? row.updatedAt ?? '';
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : 0;
}
