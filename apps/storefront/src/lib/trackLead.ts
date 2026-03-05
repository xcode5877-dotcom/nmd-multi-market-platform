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

/** Payload for POST /leads (track-then-redirect). */
export interface LeadPayload {
  tenantId: string;
  professionalId: string;
  type: 'whatsapp' | 'call';
  timestamp: string;
  customerId?: string;
}

const getApiBase = (): string =>
  (typeof import.meta !== 'undefined' && (import.meta as { env?: Record<string, string> }).env?.VITE_MOCK_API_URL) || '';

/** POST lead to server. Returns a promise that resolves when the lead is sent (or no-op if no API). Use for track-then-redirect. */
export async function postProfessionalLead(
  tenantId: string,
  contactType: 'whatsapp' | 'call',
  customerId?: string,
  customerName?: string,
  customerPhone?: string
): Promise<void> {
  const base = getApiBase();
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const timestamp = new Date().toISOString();
  const metadata: Record<string, unknown> = {
    userAgent: userAgent || undefined,
    customerId: customerId || undefined,
  };
  if (customerName && String(customerName).trim()) {
    metadata.customerName = String(customerName).trim();
  }
  if (customerPhone && String(customerPhone).trim()) {
    metadata.customerPhone = String(customerPhone).trim();
  }
  const body = {
    tenantId,
    type: 'PROFESSIONAL_CONTACT' as const,
    status: 'NEW',
    contactType,
    metadata,
    timestamp,
  };
  if (import.meta.env?.DEV) console.log('[trackLead] SENDING LEAD...', body);
  if (!base) {
    if (import.meta.env?.DEV) console.warn('[trackLead] No VITE_MOCK_API_URL - lead not sent');
    return;
  }
  try {
    const res = await fetch(`${base}/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok && import.meta.env?.DEV) {
      console.warn('[trackLead] API error:', res.status, await res.text());
    }
  } catch (err) {
    if (import.meta.env?.DEV) console.warn('[trackLead] Fetch failed:', err);
  }
  await new Promise((r) => setTimeout(r, 100));
}

/** Track professional page contact (WhatsApp/Call). Awaits API call before redirect. */
export async function trackProfessionalContact(
  tenantId: string,
  contactType: 'whatsapp' | 'call',
  customerId?: string,
  customerName?: string,
  customerPhone?: string
): Promise<void> {
  await postProfessionalLead(tenantId, contactType, customerId, customerName, customerPhone);
}
