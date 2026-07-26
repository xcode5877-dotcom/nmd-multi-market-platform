import { toE164 } from '../phone.js';
import type { OtpDeliveryProvider, OtpProviderSendResult } from '../types.js';

export function createSmsGatewayProvider(opts: {
  gatewayUrl: string;
  apiKey: string;
}): OtpDeliveryProvider {
  const base = opts.gatewayUrl.replace(/\/$/, '');
  return {
    name: 'sms',
    isConfigured: () => Boolean(base && opts.apiKey),
    async health() {
      return { configured: Boolean(base && opts.apiKey), healthy: Boolean(base && opts.apiKey) };
    },
    async send(phoneCanonical: string, code: string): Promise<OtpProviderSendResult> {
      const phoneTo = toE164(phoneCanonical);
      if (!phoneTo) {
        return { kind: 'PERMANENT_FAILURE', provider: 'sms', accepted: false, error: 'Invalid phone for SMS' };
      }
      const message = `رمز التحقق الخاص بك هو: ${String(code).trim()}`;
      try {
        const res = await fetch(`${base}/send-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': opts.apiKey },
          body: JSON.stringify({ phone: phoneTo, code, message }),
        });
        if (res.ok) return { kind: 'SUCCESS', provider: 'sms', accepted: true };
        const errText = await res.text().catch(() => '');
        const kind = res.status >= 500 ? 'TEMPORARY_FAILURE' : 'PERMANENT_FAILURE';
        return {
          kind,
          provider: 'sms',
          accepted: false,
          error: errText.slice(0, 200) || `HTTP ${res.status}`,
        };
      } catch (e) {
        return {
          kind: 'TEMPORARY_FAILURE',
          provider: 'sms',
          accepted: false,
          error: e instanceof Error ? e.message : String(e),
        };
      }
    },
  };
}

export function createTwilioSmsProvider(opts: {
  accountSid: string;
  authToken: string;
  fromNumber: string;
}): OtpDeliveryProvider {
  return {
    name: 'twilio',
    isConfigured: () => Boolean(opts.accountSid && opts.authToken && opts.fromNumber),
    async health() {
      const configured = Boolean(opts.accountSid && opts.authToken && opts.fromNumber);
      return { configured, healthy: configured };
    },
    async send(phoneCanonical: string, code: string): Promise<OtpProviderSendResult> {
      const phoneTo = toE164(phoneCanonical);
      if (!phoneTo) {
        return { kind: 'PERMANENT_FAILURE', provider: 'twilio', accepted: false, error: 'Invalid phone for SMS' };
      }
      if (!opts.fromNumber) {
        return { kind: 'PERMANENT_FAILURE', provider: 'twilio', accepted: false, error: 'Missing TWILIO_FROM_NUMBER' };
      }
      const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(opts.accountSid)}/Messages.json`;
      const message = `رمز التحقق الخاص بك هو: ${String(code).trim()}`;
      const basicAuth = Buffer.from(`${opts.accountSid}:${opts.authToken}`).toString('base64');
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${basicAuth}`,
          },
          body: new URLSearchParams({ To: phoneTo, From: opts.fromNumber, Body: message }),
        });
        if (res.ok) return { kind: 'SUCCESS', provider: 'twilio', accepted: true };
        const errText = await res.text().catch(() => '');
        const kind = res.status >= 500 ? 'TEMPORARY_FAILURE' : 'PERMANENT_FAILURE';
        return {
          kind,
          provider: 'twilio',
          accepted: false,
          error: errText.slice(0, 200) || `Twilio HTTP ${res.status}`,
        };
      } catch (e) {
        return {
          kind: 'TEMPORARY_FAILURE',
          provider: 'twilio',
          accepted: false,
          error: e instanceof Error ? e.message : String(e),
        };
      }
    },
  };
}
