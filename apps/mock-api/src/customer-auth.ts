/**
 * Customer OTP auth (dev-mode). In-memory store.
 * - phone -> { codeHash, expiresAt, attempts, lockedUntil }
 * - TTL 5 min, max 3 verify attempts, rate limit 5/hour, lock 10 min on abuse
 * - Store only hash, never plain code
 */

import { createHash, randomInt } from 'crypto';

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

function normalizePhone(phone: string): string {
  return String(phone ?? '').replace(/\D/g, '').slice(-10) || phone;
}

function hashCode(code: string): string {
  return createHash('sha256').update(String(code).trim()).digest('hex');
}

function generateOtp(): string {
  return String(randomInt(100000, 999999));
}

export function createOtp(phone: string): { ok: true } | { ok: false; error: string; code: string } {
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

  const code = generateOtp();
  otpStore.set(key, {
    codeHash: hashCode(code),
    expiresAt: now + OTP_TTL_MS,
    attempts: 0,
    lockedUntil: 0,
  });

  if (process.env.NODE_ENV !== 'production') {
    console.log(`[dev] OTP for ${phone}: ${code} (expires in 5 min)`);
  }

  return { ok: true };
}

export type VerifyResult =
  | { ok: true }
  | { ok: false; error: string; code: 'OTP_EXPIRED' | 'OTP_INVALID' | 'OTP_LOCKED' | 'RATE_LIMITED' };

export function verifyOtp(phone: string, code: string): VerifyResult {
  const key = normalizePhone(phone);
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
