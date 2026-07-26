import { sendOtpViaExternalWhatsAppApi } from '../../services/externalWhatsAppOtp.js';
import type { OtpDeliveryProvider, OtpProviderSendResult } from '../types.js';

export function createExternalWhatsAppProvider(opts: {
  apiUrl: string;
  token: string;
}): OtpDeliveryProvider {
  return {
    name: 'external_whatsapp',
    isConfigured: () => Boolean(opts.apiUrl && opts.token),
    async health() {
      const configured = Boolean(opts.apiUrl && opts.token);
      return { configured, healthy: configured };
    },
    async send(phoneCanonical: string, code: string): Promise<OtpProviderSendResult> {
      const ext = await sendOtpViaExternalWhatsAppApi(opts.apiUrl, opts.token, phoneCanonical, code);
      if (ext.sent) {
        return { kind: 'SUCCESS', provider: 'external_whatsapp', accepted: true };
      }
      return {
        kind: 'TEMPORARY_FAILURE',
        provider: 'external_whatsapp',
        accepted: false,
        error: ext.providerError || 'External WhatsApp send failed',
      };
    },
  };
}
