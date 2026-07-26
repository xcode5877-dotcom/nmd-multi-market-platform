import { whatsAppFetch } from '../../utils/whatsapp-http.js';
import type { OtpDeliveryProvider, OtpProviderSendResult } from '../types.js';

function classifyWhatsAppError(rawError: string, status?: number): OtpProviderSendResult['kind'] {
  const e = (rawError || '').toLowerCase();
  if (status === 503 || e.includes('not ready') || e.includes('offline') || e.includes('soft_restart')) {
    return 'TEMPORARY_FAILURE';
  }
  if (e.includes('no lid')) return 'TEMPORARY_FAILURE';
  if (e.includes('timeout')) return 'TEMPORARY_FAILURE';
  if (status === 401 || e.includes('unauthorized')) return 'PERMANENT_FAILURE';
  if (status === 400) return 'PERMANENT_FAILURE';
  return 'FAILED';
}

export function createWhatsAppGatewayProvider(opts: {
  gatewayUrl: string;
  apiKey: string;
}): OtpDeliveryProvider {
  const base = opts.gatewayUrl.replace(/\/$/, '');
  return {
    name: 'whatsapp',
    isConfigured: () => Boolean(base && opts.apiKey),
    async health() {
      if (!base || !opts.apiKey) {
        return { configured: false, healthy: false };
      }
      try {
        const res = await whatsAppFetch(`${base}/health`, {
          headers: { 'x-api-key': opts.apiKey },
        });
        const data = (await res.json()) as {
          ready?: boolean;
          operational?: boolean;
          connectionState?: string;
          lastSendOkAt?: string | null;
          restartCount?: number;
        };
        const healthy = res.ok && data.ready === true && data.operational === true;
        return {
          configured: true,
          healthy,
          detail: data as Record<string, unknown>,
        };
      } catch (e) {
        return {
          configured: true,
          healthy: false,
          detail: { error: e instanceof Error ? e.message : String(e) },
        };
      }
    },
    async send(phoneCanonical: string, code: string): Promise<OtpProviderSendResult> {
      const url = `${base}/send-otp`;
      try {
        const sendRes = await whatsAppFetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': opts.apiKey,
          },
          body: JSON.stringify({ phone: phoneCanonical, code }),
        });
        const responseText = await sendRes.text();
        let parsed: { success?: boolean; error?: string; message?: string } = {};
        try {
          parsed = JSON.parse(responseText) as typeof parsed;
        } catch {
          /* ignore */
        }
        if (sendRes.ok && parsed.success === true) {
          return { kind: 'SUCCESS', provider: 'whatsapp', accepted: true };
        }
        const raw = ((parsed.error ?? parsed.message ?? responseText.slice(0, 200)) || '').trim();
        const kind = classifyWhatsAppError(raw, sendRes.status);
        return { kind, provider: 'whatsapp', accepted: false, error: raw || `HTTP ${sendRes.status}` };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          kind: classifyWhatsAppError(msg),
          provider: 'whatsapp',
          accepted: false,
          error: msg,
        };
      }
    },
  };
}
