/**
 * Client-facing shape for POST /customer/auth/start.
 * Never HTTP 200 unless a provider accepted delivery (or approved bypass).
 */

import { OTP_DELIVERY_FAILED } from './otp/types.js';

export type OtpStartDeliveryInput = {
  playReview: boolean;
  whatsAppSent: boolean;
  smsSent: boolean;
  /** Present when MOCK_OTP / fixed-dev path exposes a code to the client. */
  devCode?: string;
  whatsAppError?: string;
};

export type OtpStartClientBody = {
  ok: boolean;
  error?: typeof OTP_DELIVERY_FAILED | string;
  whatsAppSent?: boolean;
  smsSent?: boolean;
  sentVia?: 'play_review' | 'both' | 'whatsapp' | 'sms' | 'none';
  deliveryFailed?: boolean;
  deliveryError?: string;
  hint?: string;
  devCode?: string;
};

export function buildOtpStartClientResponse(input: OtpStartDeliveryInput): {
  httpStatus: number;
  body: OtpStartClientBody;
} {
  const deliveryOk = input.whatsAppSent || input.smsSent;
  const mockOrDevCode = Boolean(input.devCode);
  const clientSeesSuccess = deliveryOk || mockOrDevCode || input.playReview;

  if (!clientSeesSuccess) {
    return {
      httpStatus: 503,
      body: {
        ok: false,
        error: OTP_DELIVERY_FAILED,
        deliveryFailed: true,
        deliveryError: input.whatsAppError || OTP_DELIVERY_FAILED,
        sentVia: 'none',
        whatsAppSent: false,
        smsSent: false,
        hint: 'OTP logged to server console and otp-debug.log if configured',
      },
    };
  }

  const sentVia: NonNullable<OtpStartClientBody['sentVia']> = input.playReview
    ? 'play_review'
    : input.whatsAppSent && input.smsSent
      ? 'both'
      : input.whatsAppSent
        ? 'whatsapp'
        : input.smsSent
          ? 'sms'
          : 'none';

  const body: OtpStartClientBody = {
    ok: true,
    whatsAppSent: true,
    smsSent: input.smsSent,
    sentVia,
  };
  if (input.devCode) body.devCode = input.devCode;

  return { httpStatus: 200, body };
}
