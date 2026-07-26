/**
 * WhatsApp gateway (whatsapp-service) HTTP helpers.
 * Uses fetch + AbortSignal.timeout (Node 18+) — no axios in this codebase.
 */
const DEFAULT_MS = 30_000;

export function getWhatsAppHttpTimeoutMs(): number {
  const raw = process.env.WHATSAPP_HTTP_TIMEOUT_MS?.trim();
  const n = raw ? Number(raw) : DEFAULT_MS;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_MS;
}

/** fetch() to whatsapp-service with a 30s (configurable) abort — avoids hanging OTP when the peer is slow. */
export async function whatsAppFetch(url: string, init?: RequestInit): Promise<Response> {
  const ms = getWhatsAppHttpTimeoutMs();
  const t = AbortSignal.timeout(ms);
  const sig = init?.signal ? AbortSignal.any([init.signal, t]) : t;
  return fetch(url, { ...init, signal: sig });
}
