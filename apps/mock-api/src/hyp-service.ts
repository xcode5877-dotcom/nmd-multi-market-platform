/**
 * Hyp / CreditGuard hosted payment page (doDeal + TxnSetup).
 * Docs: https://developers.hyp.co.il/payment-page-integration
 * Relay POST: application/x-www-form-urlencoded — user, password, int_in (XML)
 */
import crypto from 'crypto';

function maskSecret(v: string): string {
  const s = String(v ?? '');
  if (!s) return '';
  if (s.length <= 4) return '****';
  return `${s.slice(0, 2)}***${s.slice(-2)}`;
}

export type HypConfig = {
  relayBaseUrl: string;
  apiUser: string;
  apiPassword: string;
  terminalNumber: string;
  mid: string;
  /** Merchant password — used for response MAC validation (not the same as API password in all setups). */
  macPassword: string;
};

export type HypConfigDiagnostics = {
  config: HypConfig;
  missingKeys: string[];
};

export function loadHypConfig(): HypConfig | null {
  const relayBaseUrl = process.env.HYP_RELAY_BASE_URL?.trim();
  if (!relayBaseUrl) return null;
  const apiUser = process.env.HYP_API_USER?.trim() || '';
  const apiPassword = process.env.HYP_TOKEN?.trim() || '';
  const terminalNumber = process.env.HYP_TERMINAL_NUMBER?.trim() || '';
  const mid = process.env.HYP_MID?.trim() || '';
  const macPassword = process.env.HYP_API_PASSWORD?.trim() || '';
  if (!apiUser || !apiPassword || !terminalNumber || !mid || !macPassword) return null;
  return { relayBaseUrl, apiUser, apiPassword, terminalNumber, mid, macPassword };
}

/** Load HYP config for relay-attempt mode (never null), and report exactly which keys are missing. */
export function loadHypConfigDiagnostics(): HypConfigDiagnostics {
  const relayBaseUrl = process.env.HYP_RELAY_BASE_URL?.trim() || '';
  const apiUser = process.env.HYP_API_USER?.trim() || '';
  const apiPassword = process.env.HYP_TOKEN?.trim() || '';
  const terminalNumber = process.env.HYP_TERMINAL_NUMBER?.trim() || '';
  const mid = process.env.HYP_MID?.trim() || '';
  const macPassword = process.env.HYP_API_PASSWORD?.trim() || '';
  const missingKeys: string[] = [];
  if (!process.env.HYP_TERMINAL_NUMBER?.trim()) missingKeys.push('HYP_TERMINAL_NUMBER');
  if (!process.env.HYP_TOKEN?.trim()) missingKeys.push('HYP_TOKEN');
  if (!process.env.HYP_MID?.trim()) missingKeys.push('HYP_MID');
  if (!process.env.HYP_API_PASSWORD?.trim()) missingKeys.push('HYP_API_PASSWORD');
  if (!process.env.HYP_API_USER?.trim()) missingKeys.push('HYP_API_USER');
  if (!process.env.HYP_RELAY_BASE_URL?.trim()) missingKeys.push('HYP_RELAY_BASE_URL');
  if (missingKeys.length > 0) {
    console.error('[Hyp] MISSING CONFIG KEYS:', missingKeys.join(', '));
    console.warn(`HYP CONFIG ERROR: Missing keys -> [${missingKeys.join(', ')}]`);
    if (!process.env.HYP_TOKEN?.trim() || !process.env.HYP_TERMINAL_NUMBER?.trim()) {
      console.warn('[PAYMENT-READY] Waiting for real credentials in .env file.');
    }
  }
  return {
    config: { relayBaseUrl, apiUser, apiPassword, terminalNumber, mid, macPassword },
    missingKeys,
  };
}

export function buildDoDealPaymentPageXml(opts: {
  terminalNumber: string;
  mid: string;
  /** Amount in agorot (e.g. 5000 = ₪50.00). */
  totalAgorot: number;
  /** Unique per transaction (≤64 chars); we use orderGroupId. */
  uniqueId: string;
  successUrl: string;
  errorUrl: string;
  cancelUrl: string;
  language: 'HEB' | 'ENG';
  installmentOptions?: number[];
}): string {
  const {
    terminalNumber,
    mid,
    totalAgorot,
    uniqueId,
    successUrl,
    errorUrl,
    cancelUrl,
    language,
    installmentOptions,
  } = opts;
  const installments = Array.isArray(installmentOptions)
    ? [...new Set(installmentOptions.map((n) => Math.floor(Number(n))).filter((n) => n >= 2 && n <= 36))].sort((a, b) => a - b)
    : [];
  const minInstallments = installments[0];
  const maxInstallments = installments[installments.length - 1];
  const creditType = installments.length > 0 ? 'Payments' : 'RegularCredit';
  const installmentsXml =
    installments.length > 0
      ? `
      <minNumOfPayments>${minInstallments}</minNumOfPayments>
      <maxNumOfPayments>${maxInstallments}</maxNumOfPayments>`
      : '';
  return `<?xml version="1.0" encoding="UTF-8"?>
<ashrait>
  <request>
    <version>2000</version>
    <language>${language}</language>
    <command>doDeal</command>
    <doDeal>
      <terminalNumber>${escapeXml(terminalNumber)}</terminalNumber>
      <cardNo>CGMPI</cardNo>
      <total>${Math.max(0, Math.floor(totalAgorot))}</total>
      <transactionType>Debit</transactionType>
      <creditType>${creditType}</creditType>
      <currency>ILS</currency>
      <transactionCode>Internet</transactionCode>
      <validation>TxnSetup</validation>
      <mid>${escapeXml(mid)}</mid>
      <uniqueid>${escapeXml(uniqueId)}</uniqueid>
      <mpiValidation>AutoComm</mpiValidation>
${installmentsXml}
      <successUrl>${escapeXml(successUrl)}</successUrl>
      <errorUrl>${escapeXml(errorUrl)}</errorUrl>
      <cancelUrl>${escapeXml(cancelUrl)}</cancelUrl>
    </doDeal>
  </request>
</ashrait>`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Parse Relay XML response: result code + hosted page URL. */
export function parseDoDealResponse(xml: string): { result: string; paymentUrl?: string; message?: string } {
  const resultM = xml.match(/<result>\s*(\d{3})\s*<\/result>/i);
  const result = resultM?.[1] ?? '';
  const urlM = xml.match(/<mpiHostedPageUrl>\s*([^<]+?)\s*<\/mpiHostedPageUrl>/i);
  const paymentUrl = urlM?.[1]?.trim();
  const msgM = xml.match(/<message>\s*([^<]*)\s*<\/message>/i);
  const errCodeM = xml.match(/<errorCode>\s*([^<]*)\s*<\/errorCode>/i);
  const errDescM = xml.match(/<errorDescription>\s*([^<]*)\s*<\/errorDescription>/i);
  const msgFromMessage = msgM?.[1]?.trim();
  const msgFromErr = errDescM?.[1]?.trim() || errCodeM?.[1]?.trim();
  return {
    result,
    paymentUrl: paymentUrl || undefined,
    message: msgFromMessage || msgFromErr,
  };
}

function extractRelayErrorFromBody(bodyText: string): { errorCode?: string; errorDescription?: string } {
  const code = bodyText.match(/<errorCode>\s*([^<]*)\s*<\/errorCode>/i)?.[1]?.trim();
  const desc = bodyText.match(/<errorDescription>\s*([^<]*)\s*<\/errorDescription>/i)?.[1]?.trim();
  return {
    errorCode: code || undefined,
    errorDescription: desc || undefined,
  };
}

/**
 * POST to CreditGuard Relay (user + password + int_in XML). Not MAC-signed — auth is HTTP form fields.
 * @see https://developers.hyp.co.il/payment-page-integration
 */
export async function requestHypHostedPage(
  cfg: HypConfig,
  intInXml: string
): Promise<{ ok: boolean; status: number; bodyText: string }> {
  const body = new URLSearchParams();
  body.set('user', cfg.apiUser);
  body.set('password', cfg.apiPassword);
  body.set('int_in', intInXml);
  // Deep debug: outbound request details (mask secrets, keep terminal/mid in XML visible).
  console.error(
    `[DEBUG-PAY] Endpoint: ${cfg.relayBaseUrl} | Terminal: ${String(cfg.terminalNumber || '').slice(0, 3)}... | HasToken: ${Boolean(cfg.apiPassword)}`
  );
  console.log('[Hyp] Relay request', {
    method: 'POST',
    url: cfg.relayBaseUrl,
    userMasked: maskSecret(cfg.apiUser),
    passwordMasked: maskSecret(cfg.apiPassword),
  });
  console.log('[Hyp] Relay XML payload (int_in):\n' + intInXml);
  try {
    const res = await fetch(cfg.relayBaseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body: body.toString(),
    });
    const bodyText = await res.text();
    const safeHeaderNames = new Set([
      'content-type',
      'content-length',
      'location',
      'server',
      'cache-control',
      'pragma',
      'expires',
      'date',
    ]);
    const headersObj = Object.fromEntries(
      [...res.headers.entries()].filter(([k]) => safeHeaderNames.has(String(k).toLowerCase()))
    );
    const relayError = extractRelayErrorFromBody(bodyText);
    console.log('[Hyp] Relay response', {
      status: res.status,
      ok: res.ok,
      headers: headersObj,
      errorCode: relayError.errorCode ?? null,
      errorDescription: relayError.errorDescription ?? null,
      bodyPreview: bodyText.slice(0, 300),
    });
    if (/action=login|errorCode/i.test(bodyText)) {
      console.error('[DEBUG-PAY] Provider login/error response snippet:', bodyText.slice(0, 500));
    }
    return { ok: res.ok, status: res.status, bodyText };
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    console.error('[Hyp] Relay request failed', {
      method: 'POST',
      url: cfg.relayBaseUrl,
      error: err,
    });
    return { ok: false, status: 0, bodyText: `[fetch] ${err}` };
  }
}

/**
 * Validates redirect MAC per Hyp "Basic Integration" sample (SHA-256 hex).
 * Query uses uniqueID / txId / responseMac (case variants).
 */
export function normalizeHypQuery(q: Record<string, string | string[] | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(q)) {
    const val = Array.isArray(v) ? v[0] : v;
    if (val == null) continue;
    out[k] = String(val);
  }
  const lower = (key: string) => {
    const found = Object.keys(out).find((x) => x.toLowerCase() === key.toLowerCase());
    return found ? out[found] : '';
  };
  return {
    txId: lower('txId'),
    errorCode: lower('errorCode'),
    cardToken: lower('cardToken'),
    cardExp: lower('cardExp'),
    cardMask: lower('cardMask') || lower('mask') || lower('cardNumberMask'),
    cardBrand: lower('cardBrand') || lower('brand') || lower('issuer'),
    personalId: lower('personalId'),
    uniqueID: lower('uniqueID') || lower('uniqueid'),
    responseMac: lower('responseMac'),
  };
}

export function computeHypResponseMac(macPassword: string, q: Record<string, string>): string {
  const txId = q.txId ?? '';
  const errorCode = q.errorCode && q.errorCode !== '' ? q.errorCode : '000';
  const cardToken = q.cardToken ?? '';
  const cardExp = q.cardExp ?? '';
  const personalId = q.personalId ?? '';
  const uniqueID = q.uniqueID ?? '';
  const base = `${macPassword}${txId}${errorCode}${cardToken}${cardExp}${personalId}${uniqueID}`;
  return crypto.createHash('sha256').update(base, 'utf8').digest('hex');
}

export function verifyHypResponseMac(macPassword: string, q: Record<string, string>): boolean {
  const received = (q.responseMac ?? '').trim().toLowerCase();
  if (!received) return false;
  const calc = computeHypResponseMac(macPassword, q);
  return calc.toLowerCase() === received.toLowerCase();
}
