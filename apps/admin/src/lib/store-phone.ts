/**
 * Store phone (Israel +972) normalization and validation for admin settings.
 * Display: user sees +972 prefix and types from 5 (e.g. 541234567).
 * Save: value is normalized to 972xxxxxxxxx (strip spaces/dashes/+, remove leading 0).
 */

const STORE_PHONE_COUNTRY = '972';
const STORE_PHONE_MIN_LENGTH = 9;

/** Normalize for save: strip non-digits, remove leading 0, ensure saved value starts with 972. */
export function normalizeStorePhoneForSave(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  let rest = digits.startsWith('0') ? digits.slice(1) : digits;
  if (rest.startsWith(STORE_PHONE_COUNTRY)) return rest;
  return STORE_PHONE_COUNTRY + rest;
}

/** Validate: no letters (after strip only digits), and after normalization length is 972 + 9 digits. */
export function validateStorePhone(raw: string): { ok: boolean; error?: string } {
  if (/[^\d\s\-+]/.test(raw)) return { ok: false, error: 'يُسمح بالأرقام فقط' };
  const normalized = normalizeStorePhoneForSave(raw);
  if (normalized.length < STORE_PHONE_COUNTRY.length + STORE_PHONE_MIN_LENGTH) return { ok: false, error: 'الرقم قصير جداً (أدخل الرقم ابتداءً من 5)' };
  return { ok: true };
}

/** Display value from stored phone (972541234567 -> 541234567 for input). */
export function storedPhoneToDisplay(stored: string): string {
  const digits = (stored ?? '').replace(/\D/g, '');
  if (digits.startsWith('0')) return digits.slice(1);
  if (digits.startsWith(STORE_PHONE_COUNTRY)) return digits.slice(STORE_PHONE_COUNTRY.length);
  return digits;
}

export const STORE_PHONE_HELPER_TEXT = 'أدخل الرقم ابتداءً من 5 (مثال: 541234567). سيقوم النظام بإضافة مفتاح الدولة تلقائياً.';
