/**
 * Outbound WhatsApp OTP via external HTTP APIs (UltraMsg-compatible by default).
 * UltraMsg: POST {instanceBase}/messages/chat with application/x-www-form-urlencoded: token, to, body
 * @see https://docs.ultramsg.com/api/post/messages/chat
 */

export type ExternalWhatsAppSendResult = {
  sent: boolean;
  status?: number;
  /** Exact provider message for failures (e.g. Invalid Instance ID, Balance Low) */
  providerError?: string;
  rawResponse?: string;
};

function buildChatUrl(baseUrl: string): string {
  const b = baseUrl.replace(/\/$/, '');
  if (b.includes('/messages/chat')) return b;
  return `${b}/messages/chat`;
}

function extractProviderError(status: number, body: string): string {
  const trimmed = body.trim();
  try {
    const j = JSON.parse(trimmed) as {
      error?: string | { message?: string };
      message?: string;
      sent?: string | boolean;
    };
    if (typeof j.error === 'string' && j.error.length) return j.error;
    if (j.error && typeof j.error === 'object' && j.error.message) return String(j.error.message);
    if (typeof j.message === 'string' && j.message.length && j.message !== 'ok') return j.message;
  } catch {
    /* plain text */
  }
  if (trimmed.length) return trimmed.slice(0, 2000);
  return `HTTP ${status} (empty body)`;
}

function isUltraMsgSuccess(status: number, body: string): boolean {
  if (!status || status < 200 || status >= 300) return false;
  try {
    const j = JSON.parse(body) as { sent?: string | boolean; message?: string };
    if (j.sent === true || j.sent === 'true') return true;
    if (j.message === 'ok' || j.message === 'success') return true;
  } catch {
    return false;
  }
  return false;
}

/**
 * Sends OTP text via UltraMsg-style form API.
 * - WHATSAPP_API_URL: e.g. https://api.ultramsg.com/instance12345
 * - WHATSAPP_TOKEN: instance token (sent as form field `token`)
 * - phoneDigits: international digits only, no + (e.g. 972501234567)
 */
export async function sendOtpViaExternalWhatsAppApi(
  baseUrl: string,
  token: string,
  phoneDigits: string,
  code: string
): Promise<ExternalWhatsAppSendResult> {
  const url = buildChatUrl(baseUrl);
  const message = `رمز التحقق الخاص بك هو: ${String(code).trim()}`;
  const form = new URLSearchParams();
  form.set('token', token);
  form.set('to', phoneDigits);
  form.set('body', message);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body: form.toString(),
    });
    const responseText = await res.text();
    const sent = isUltraMsgSuccess(res.status, responseText);
    console.log('OTP-SEND-DEBUG:', {
      phone: phoneDigits,
      code,
      response: {
        status: res.status,
        ok: res.ok,
        sent,
        bodyPreview: responseText.length > 600 ? `${responseText.slice(0, 600)}…` : responseText,
      },
    });
    if (sent) return { sent: true };

    const providerError = extractProviderError(res.status, responseText);
    console.error('[OTP-EXTERNAL-WHATSAPP] Provider error (exact):', providerError);
    return {
      sent: false,
      status: res.status,
      providerError,
      rawResponse: responseText.slice(0, 2000),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[OTP-EXTERNAL-WHATSAPP] Network/fetch error (exact):', msg);
    console.log('OTP-SEND-DEBUG:', { phone: phoneDigits, code, response: { error: msg, network: true } });
    return { sent: false, providerError: msg };
  }
}
