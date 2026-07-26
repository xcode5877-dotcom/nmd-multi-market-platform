/** OTP delivery provider result classification. */

export type OtpProviderResultKind =
  | 'SUCCESS'
  | 'FAILED'
  | 'TEMPORARY_FAILURE'
  | 'PERMANENT_FAILURE';

export type OtpProviderName = 'whatsapp' | 'sms' | 'twilio' | 'external_whatsapp' | 'play_review' | 'none';

export type OtpProviderSendResult = {
  kind: OtpProviderResultKind;
  provider: OtpProviderName;
  error?: string;
  /** True when the remote provider confirmed acceptance. */
  accepted: boolean;
};

export type OtpDeliveryOutcome = {
  ok: boolean;
  provider: OtpProviderName;
  sentVia: 'play_review' | 'whatsapp' | 'sms' | 'both' | 'none';
  whatsAppSent: boolean;
  smsSent: boolean;
  error?: string;
  attempts: Array<{ provider: OtpProviderName; kind: OtpProviderResultKind; error?: string }>;
};

export interface OtpDeliveryProvider {
  readonly name: OtpProviderName;
  isConfigured(): boolean;
  send(phoneCanonical: string, code: string): Promise<OtpProviderSendResult>;
  health(): Promise<{
    configured: boolean;
    healthy: boolean;
    detail?: Record<string, unknown>;
  }>;
}

export const OTP_DELIVERY_FAILED = 'OTP_DELIVERY_FAILED' as const;
