/**
 * International digits for OTP delivery (WhatsApp gateway + SMS).
 * Aligns with apps/whatsapp-service `normalizePhone` / `phoneKey`: digits only, country code, no leading +.
 * Example: 0501234567 → 972501234567; +972 50-123-4567 → 972501234567
 */
export function normalizeInternationalPhoneDigits(phone: string): string | null {
  const digits = String(phone ?? '').replace(/\D/g, '');
  if (digits.length < 9) return null;
  const withCountry = digits.startsWith('0')
    ? '972' + digits.slice(1)
    : digits.length <= 10
      ? '972' + digits
      : digits;
  return withCountry;
}

/** Canonical wallet / coupon phone key (international digits, e.g. 972546111668). */
export function normalizeCustomerPhoneKey(phone: string | undefined): string {
  const trimmed = String(phone ?? '').trim();
  if (!trimmed) return '';
  return normalizeInternationalPhoneDigits(trimmed) ?? trimmed.replace(/\D/g, '');
}

/** Legacy storage variants for the same handset (local 0-prefix, bare national, intl). */
export function customerPhoneLookupVariants(phone: string | undefined): string[] {
  const digits = String(phone ?? '').replace(/\D/g, '').trim();
  if (digits.length < 9) return [];
  const canonical = normalizeCustomerPhoneKey(phone);
  const variants = new Set<string>();
  if (canonical) variants.add(canonical);
  variants.add(digits);
  if (digits.startsWith('0')) variants.add('972' + digits.slice(1));
  if (digits.startsWith('972')) variants.add('0' + digits.slice(3));
  return [...variants].filter(Boolean);
}
