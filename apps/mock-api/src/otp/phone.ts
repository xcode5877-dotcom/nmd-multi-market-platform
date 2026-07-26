/**
 * Canonical OTP phone: international digits, no +, country code present.
 * Accepts: 050..., +97250..., 97250...
 */

export function normalizeOtpPhone(phone: string): string | null {
  const digits = String(phone ?? '').replace(/\D/g, '');
  if (digits.length < 9) return null;
  if (digits.startsWith('0')) return `972${digits.slice(1)}`;
  if (digits.length <= 10) return `972${digits}`;
  return digits;
}

export function toE164(phoneCanonical: string): string | null {
  const d = normalizeOtpPhone(phoneCanonical);
  return d ? `+${d}` : null;
}

export function assertPhoneNormalizationExamples(): void {
  const cases: Array<[string, string]> = [
    ['0501234567', '972501234567'],
    ['+972501234567', '972501234567'],
    ['972501234567', '972501234567'],
    ['972 50-123-4567', '972501234567'],
  ];
  for (const [input, expected] of cases) {
    const got = normalizeOtpPhone(input);
    if (got !== expected) {
      throw new Error(`normalizeOtpPhone(${input}) → ${got}, expected ${expected}`);
    }
  }
}
