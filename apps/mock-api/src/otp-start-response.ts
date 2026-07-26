/**
 * Client-facing shape for POST /customer/auth/start.
 * Delivery failure must not be reported as a successful send.
 */

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
  whatsAppSent: boolean;
  smsSent: boolean;
  sentVia: 'play_review' | 'both' | 'whatsapp' | 'sms' | 'none';
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

  const sentVia: OtpStartClientBody['sentVia'] = input.playReview
    ? 'play_review'
    : input.whatsAppSent && input.smsSent
      ? 'both'
      : input.whatsAppSent
        ? 'whatsapp'
        : input.smsSent
          ? 'sms'
          : 'none';

  const body: OtpStartClientBody = {
    ok: clientSeesSuccess,
    // Keep legacy field meaning: "client may proceed as if a channel worked"
    // (includes mock/devCode / play-review). Prefer `sentVia` + `ok` for new clients.
    whatsAppSent: clientSeesSuccess,
    smsSent: input.smsSent,
    sentVia,
  };

  if (!deliveryOk && !mockOrDevCode) {
    body.deliveryFailed = true;
    body.deliveryError = input.whatsAppError || 'OTP delivery failed';
    body.hint = 'OTP logged to server console and otp-debug.log if configured';
  }
  if (input.devCode) {
    body.devCode = input.devCode;
  }

  return {
    httpStatus: clientSeesSuccess ? 200 : 503,
    body,
  };
}
