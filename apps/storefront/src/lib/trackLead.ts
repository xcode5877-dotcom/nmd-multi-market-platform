/** Fire-and-forget lead tracking. Does not block or delay the user. */
export function trackLead(
  tenantId: string,
  type: 'whatsapp' | 'call' | 'cta' | 'PROFESSIONAL_CONTACT',
  metadata?: Record<string, unknown>
): void {
  const base = (typeof import.meta !== 'undefined' && (import.meta as { env?: Record<string, string> }).env?.VITE_MOCK_API_URL) || '';
  if (!base) return;
  const payload: Record<string, unknown> = {
    tenantId,
    type,
    metadata: metadata ?? {},
  };
  if (type === 'PROFESSIONAL_CONTACT') {
    payload.status = 'NEW';
    payload.contactType = (metadata?.contactType as string) ?? 'whatsapp';
  }
  fetch(`${base}/leads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {});
}

/** Track professional page contact (WhatsApp/Call). Awaits API call before redirect. */
export async function trackProfessionalContact(
  tenantId: string,
  contactType: 'whatsapp' | 'call'
): Promise<void> {
  const base = (typeof import.meta !== 'undefined' && (import.meta as { env?: Record<string, string> }).env?.VITE_MOCK_API_URL) || '';
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const phone = typeof window !== 'undefined' ? window.prompt('أدخل رقم هاتفك (اختياري)') : null;
  const metadata: Record<string, unknown> = {
    userAgent: userAgent || undefined,
    phone: phone && String(phone).trim() ? String(phone).trim() : undefined,
  };
  const payload = {
    tenantId,
    type: 'PROFESSIONAL_CONTACT' as const,
    status: 'NEW',
    contactType,
    metadata,
  };
  if (import.meta.env?.DEV) {
    console.log('SENDING LEAD...', payload);
  }
  if (!base) {
    if (import.meta.env?.DEV) console.warn('[trackLead] No VITE_MOCK_API_URL - lead not sent');
    return;
  }
  try {
    const res = await fetch(`${base}/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok && import.meta.env?.DEV) {
      console.warn('[trackLead] API error:', res.status, await res.text());
    }
  } catch (err) {
    if (import.meta.env?.DEV) console.warn('[trackLead] Fetch failed:', err);
  }
  await new Promise((r) => setTimeout(r, 100));
}
