import { otpDeliveryQueue } from './delivery-queue.js';
import type {
  OtpDeliveryOutcome,
  OtpDeliveryProvider,
  OtpProviderName,
  OtpProviderResultKind,
  OtpProviderSendResult,
} from './types.js';
import { OTP_DELIVERY_FAILED } from './types.js';

const DEFAULT_ACK_TIMEOUT_MS = Number(process.env.OTP_DELIVERY_ACK_TIMEOUT_MS) || 25_000;
const TEMP_RETRY_DELAY_MS = Number(process.env.OTP_TEMP_RETRY_DELAY_MS) || 1_200;

async function sendWithTempRetry(provider: OtpDeliveryProvider, phone: string, code: string): Promise<OtpProviderSendResult> {
  const first = await provider.send(phone, code);
  if (first.kind !== 'TEMPORARY_FAILURE') return first;
  await new Promise((r) => setTimeout(r, TEMP_RETRY_DELAY_MS));
  return provider.send(phone, code);
}

export type DeliverOtpInput = {
  phoneCanonical: string;
  code: string;
  providers: OtpDeliveryProvider[];
  /** Skip outbound delivery (Play review). */
  playReview?: boolean;
  ackTimeoutMs?: number;
};

export async function deliverOtpViaPipeline(input: DeliverOtpInput): Promise<OtpDeliveryOutcome> {
  if (input.playReview) {
    return {
      ok: true,
      provider: 'play_review',
      sentVia: 'play_review',
      whatsAppSent: false,
      smsSent: false,
      attempts: [],
    };
  }

  const configured = input.providers.filter((p) => p.isConfigured());
  const attempts: OtpDeliveryOutcome['attempts'] = [];

  try {
    return await otpDeliveryQueue.enqueueAndAwait(async () => {
      let whatsAppSent = false;
      let smsSent = false;
      let lastError: string | undefined;

      for (const provider of configured) {
        const result = await sendWithTempRetry(provider, input.phoneCanonical, input.code);
        attempts.push({
          provider: result.provider,
          kind: result.kind,
          error: result.error,
        });
        if (result.kind === 'SUCCESS' && result.accepted) {
          if (provider.name === 'whatsapp' || provider.name === 'external_whatsapp') {
            whatsAppSent = true;
          }
          if (provider.name === 'sms' || provider.name === 'twilio') {
            smsSent = true;
          }
          const sentVia =
            whatsAppSent && smsSent ? 'both' : whatsAppSent ? 'whatsapp' : smsSent ? 'sms' : 'none';
          return {
            ok: true,
            provider: provider.name,
            sentVia,
            whatsAppSent,
            smsSent,
            attempts,
          };
        }
        lastError = result.error;
        // PERMANENT / FAILED → try next provider. TEMPORARY already retried once.
      }

      return {
        ok: false,
        provider: 'none',
        sentVia: 'none',
        whatsAppSent: false,
        smsSent: false,
        error: lastError || OTP_DELIVERY_FAILED,
        attempts,
      };
    }, input.ackTimeoutMs ?? DEFAULT_ACK_TIMEOUT_MS);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    attempts.push({ provider: 'none', kind: 'TEMPORARY_FAILURE' as OtpProviderResultKind, error: msg });
    return {
      ok: false,
      provider: 'none' as OtpProviderName,
      sentVia: 'none',
      whatsAppSent: false,
      smsSent: false,
      error: msg.includes('TIMEOUT') ? msg : OTP_DELIVERY_FAILED,
      attempts,
    };
  }
}

/** Test helper: classify whether a provider result should be retried. */
export function shouldRetryProviderResult(kind: OtpProviderResultKind): boolean {
  return kind === 'TEMPORARY_FAILURE';
}
