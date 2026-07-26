/**
 * Google Play reviewer test login — server-side only.
 * Fixed OTP applies only to allowlisted phones; never returned as devCode to clients.
 */
import { normalizeInternationalPhoneDigits } from './utils/phone.js';

/** Default reviewer line: 050-000-0000 → 972500000000 */
const DEFAULT_REVIEW_PHONES = ['0500000000', '972500000000'];
const DEFAULT_REVIEW_OTP = '123456';

export function getGooglePlayReviewOtp(): string {
  const v = process.env.GOOGLE_PLAY_REVIEW_OTP?.trim();
  if (v && /^\d{4,8}$/.test(v)) return v;
  return DEFAULT_REVIEW_OTP;
}

function reviewPhoneAllowlist(): string[] {
  const raw = process.env.GOOGLE_PLAY_REVIEW_PHONES?.trim();
  const parts = raw
    ? raw.split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean)
    : [...DEFAULT_REVIEW_PHONES];
  const out = new Set<string>();
  for (const p of parts) {
    const n = normalizeInternationalPhoneDigits(p) ?? p.replace(/\D/g, '');
    if (n.length >= 9) out.add(n);
  }
  return [...out];
}

/** True when canonical digits match the Play review allowlist. */
export function isGooglePlayReviewPhone(phoneOrCanonical: string): boolean {
  const key =
    normalizeInternationalPhoneDigits(phoneOrCanonical) ??
    phoneOrCanonical.replace(/\D/g, '');
  if (!key || key.length < 9) return false;
  return reviewPhoneAllowlist().includes(key);
}
