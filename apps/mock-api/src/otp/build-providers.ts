import { createExternalWhatsAppProvider } from './providers/external-whatsapp.js';
import { createSmsGatewayProvider, createTwilioSmsProvider } from './providers/sms.js';
import { createWhatsAppGatewayProvider } from './providers/whatsapp-gateway.js';
import type { OtpDeliveryProvider } from './types.js';

/** Build ordered OTP providers from env (WhatsApp first, then SMS). */
export function buildOtpProvidersFromEnv(env: NodeJS.ProcessEnv = process.env): OtpDeliveryProvider[] {
  const providers: OtpDeliveryProvider[] = [];

  const externalApiUrl = (env.WHATSAPP_API_URL || '').trim().replace(/\/$/, '');
  const externalToken = (env.WHATSAPP_TOKEN || '').trim();
  if (externalApiUrl && externalToken) {
    providers.push(createExternalWhatsAppProvider({ apiUrl: externalApiUrl, token: externalToken }));
  }

  let gatewayUrl = (env.WHATSAPP_GATEWAY_URL || env.WHATSAPP_SERVICE_URL || '').trim().replace(/\/$/, '');
  const waApiKey = env.WA_API_KEY || '';
  const useLegacy =
    env.USE_LEGACY_WHATSAPP_GATEWAY === '1' || env.USE_LEGACY_WHATSAPP_GATEWAY === 'true';
  if (useLegacy && !gatewayUrl) gatewayUrl = 'http://whatsapp-service:3000';
  if (gatewayUrl && waApiKey) {
    providers.push(createWhatsAppGatewayProvider({ gatewayUrl, apiKey: waApiKey }));
  }

  const smsGatewayUrl = (env.SMS_GATEWAY_URL || '').replace(/\/$/, '');
  const smsApiKey = env.SMS_API_KEY ?? '';
  if (smsGatewayUrl && smsApiKey) {
    providers.push(createSmsGatewayProvider({ gatewayUrl: smsGatewayUrl, apiKey: smsApiKey }));
  }

  const twilioSid = env.TWILIO_ACCOUNT_SID ?? '';
  const twilioToken = env.TWILIO_AUTH_TOKEN ?? '';
  const twilioFrom = env.TWILIO_FROM_NUMBER ?? '';
  if (twilioSid && twilioToken && twilioFrom) {
    providers.push(
      createTwilioSmsProvider({
        accountSid: twilioSid,
        authToken: twilioToken,
        fromNumber: twilioFrom,
      }),
    );
  }

  return providers;
}
