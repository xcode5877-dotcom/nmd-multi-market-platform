/**
 * Customer OTP auth (dev-mode). In-memory store.
 * - phone -> { codeHash, expiresAt, attempts, lockedUntil }
 * - TTL 5 min, max 3 verify attempts, rate limit 5/hour, lock 10 min on abuse
 * - Store only hash, never plain code
 */

import { createHash, randomInt } from 'crypto';
import { getGooglePlayReviewOtp, isGooglePlayReviewPhone } from './google-play-review.js';
import { normalizeInternationalPhoneDigits } from './utils/phone.js';

const OTP_TTL_MS = 5 * 60 * 1000; // 5 min
const MAX_ATTEMPTS = 3;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_START_MAX = 5; // max /start requests per phone per hour
const LOCK_MS = 10 * 60 * 1000; // 10 min lock on abuse

export const OTP_ERROR = {
  OTP_EXPIRED: 'OTP_EXPIRED',
  OTP_INVALID: 'OTP_INVALID',
  OTP_LOCKED: 'OTP_LOCKED',
  RATE_LIMITED: 'RATE_LIMITED',
} as const;

interface OtpEntry {
  codeHash: string;
  expiresAt: number;
  attempts: number;
  lockedUntil: number;
}

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const otpStore = new Map<string, OtpEntry>();
const rateLimitStore = new Map<string, RateLimitEntry>();

/** Canonical identity for OTP + rate limit; must match mock-api normalizePhoneForMatch / gateway delivery. */
function normalizePhone(phone: string): string {
  return normalizeInternationalPhoneDigits(phone) ?? '';
}

function hashCode(code: string): string {
  return createHash('sha256').update(String(code).trim()).digest('hex');
}

function generateOtp(): string {
  return String(randomInt(100000, 999999));
}

/**
 * MOCK_OTP=123456 (4–8 digits) → fixed OTP **only** for numbers listed in FAWAZ_PHONE / MOCK_OTP_FIXED_PHONES.
 * MOCK_OTP=1 or true → legacy “always log random code + devCode in response” in production.
 */
function getFixedMockOtpFromEnv(): string | null {
  const v = process.env.MOCK_OTP?.trim();
  if (!v) return null;
  if (v === '1' || v.toLowerCase() === 'true') return null;
  if (/^\d{4,8}$/.test(v)) return v;
  return null;
}

/** Only these canonical digit identities may use fixed MOCK_OTP (e.g. Fawaz testing). */
function isAllowedFixedMockOtpForPhone(canonicalDigits: string): boolean {
  const raw = (process.env.MOCK_OTP_FIXED_PHONES || process.env.FAWAZ_PHONE || '').trim();
  if (!raw) return false;
  const parts = raw.split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean);
  for (const p of parts) {
    const n = normalizeInternationalPhoneDigits(p) ?? p.replace(/\D/g, '');
    if (n && n === canonicalDigits) return true;
  }
  return false;
}

export function createOtp(
  phone: string,
): { ok: true; codeForSending: string; devCode?: string; playReview?: boolean } | { ok: false; error: string; code: string } {
  const key = normalizePhone(phone);
  if (!key || key.length < 9) return { ok: false, error: 'Invalid phone', code: 'INVALID_PHONE' };

  const now = Date.now();

  // Rate limit: 5 /start per hour per phone
  const rl = rateLimitStore.get(key);
  if (rl) {
    if (now - rl.windowStart > RATE_LIMIT_WINDOW_MS) {
      rateLimitStore.set(key, { count: 1, windowStart: now });
    } else if (rl.count >= RATE_LIMIT_START_MAX) {
      return { ok: false, error: 'Too many requests', code: 'RATE_LIMITED' };
    } else {
      rl.count++;
    }
  } else {
    rateLimitStore.set(key, { count: 1, windowStart: now });
  }

  // Google Play review: fixed OTP for allowlisted phone only; never expose devCode.
  if (isGooglePlayReviewPhone(key)) {
    const code = getGooglePlayReviewOtp();
    otpStore.set(key, {
      codeHash: hashCode(code),
      expiresAt: now + OTP_TTL_MS,
      attempts: 0,
      lockedUntil: 0,
    });
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[OTP-PLAY-REVIEW] ${phone} (normalized: ${key}) → reviewer OTP active`);
    } else {
      console.log(`[OTP-PLAY-REVIEW] ${phone} (normalized: ${key}) → reviewer login enabled`);
    }
    return { ok: true, codeForSending: code, playReview: true };
  }

  const fixedMock = getFixedMockOtpFromEnv();
  const applyFixed = !!fixedMock && isAllowedFixedMockOtpForPhone(key);
  const code = applyFixed ? fixedMock! : generateOtp();
  otpStore.set(key, {
    codeHash: hashCode(code),
    expiresAt: now + OTP_TTL_MS,
    attempts: 0,
    lockedUntil: 0,
  });

  // Debug: if fixed OTP is enabled but the fixed phone allowlist is empty,
  // explain why the fixed code won't apply.
  const fixedPhonesRaw = (process.env.MOCK_OTP_FIXED_PHONES || process.env.FAWAZ_PHONE || '').trim();
  if (fixedMock !== null && !applyFixed && !fixedPhonesRaw) {
    console.warn('[OTP-FIXED] MOCK_OTP is set but FAWAZ_PHONE / MOCK_OTP_FIXED_PHONES is empty. Normalized request phone:', key);
  }

  const isDevOrMock =
    process.env.NODE_ENV !== 'production' ||
    process.env.MOCK_OTP === '1' ||
    process.env.MOCK_OTP === 'true' ||
    (applyFixed && fixedMock !== null);
  if (isDevOrMock) {
    console.log(`[OTP] ${phone} (normalized: ${key}) → code: ${code} (expires in 5 min)`);
    return { ok: true, codeForSending: code, devCode: code };
  }

  return { ok: true, codeForSending: code };
}

export type VerifyResult =
  | { ok: true }
  | { ok: false; error: string; code: 'OTP_EXPIRED' | 'OTP_INVALID' | 'OTP_LOCKED' | 'RATE_LIMITED' };

export function verifyOtp(phone: string, code: string): VerifyResult {
  const key = normalizePhone(phone);
  // App Store / Play review line: accept fixed OTP without prior /start or outbound delivery.
  if (isGooglePlayReviewPhone(key) && String(code ?? '').trim() === getGooglePlayReviewOtp()) {
    return { ok: true };
  }

  const entry = otpStore.get(key);

  if (!entry) return { ok: false, error: 'Invalid or expired code', code: 'OTP_INVALID' };

  const now = Date.now();
  if (now < entry.lockedUntil) {
    return { ok: false, error: 'Too many failed attempts. Try again later.', code: 'OTP_LOCKED' };
  }
  if (now > entry.expiresAt) {
    otpStore.delete(key);
    return { ok: false, error: 'Code expired', code: 'OTP_EXPIRED' };
  }

  entry.attempts++;
  const inputHash = hashCode(code);
  if (inputHash !== entry.codeHash) {
    if (entry.attempts >= MAX_ATTEMPTS) {
      entry.lockedUntil = now + LOCK_MS;
      return { ok: false, error: 'Too many failed attempts. Locked for 10 minutes.', code: 'OTP_LOCKED' };
    }
    return { ok: false, error: 'Invalid code', code: 'OTP_INVALID' };
  }

  otpStore.delete(key);
  return { ok: true };
}
