/**
 * OTP reliability regression suite (offline, no live WhatsApp required).
 */
import assert from 'node:assert/strict';
import { buildOtpStartClientResponse } from '../src/otp-start-response.js';
import { assertPhoneNormalizationExamples, normalizeOtpPhone } from '../src/otp/phone.js';
import { OtpDeliveryQueue } from '../src/otp/delivery-queue.js';
import { deliverOtpViaPipeline, shouldRetryProviderResult } from '../src/otp/pipeline.js';
import type { OtpDeliveryProvider, OtpProviderSendResult } from '../src/otp/types.js';
import { OTP_DELIVERY_FAILED } from '../src/otp/types.js';

function mockProvider(
  name: OtpDeliveryProvider['name'],
  handler: () => Promise<OtpProviderSendResult> | OtpProviderSendResult,
  configured = true,
): OtpDeliveryProvider {
  return {
    name,
    isConfigured: () => configured,
    health: async () => ({ configured, healthy: configured }),
    send: async () => Promise.resolve(handler()),
  };
}

async function main() {
  // Phone normalization
  assertPhoneNormalizationExamples();
  assert.equal(normalizeOtpPhone('0504891822'), '972504891822');
  assert.equal(normalizeOtpPhone('+972504891822'), '972504891822');
  assert.equal(normalizeOtpPhone('972504891822'), '972504891822');

  // 503 contract
  const failed = buildOtpStartClientResponse({
    playReview: false,
    whatsAppSent: false,
    smsSent: false,
    whatsAppError: 'offline',
  });
  assert.equal(failed.httpStatus, 503);
  assert.equal(failed.body.ok, false);
  assert.equal(failed.body.error, OTP_DELIVERY_FAILED);

  const okWa = buildOtpStartClientResponse({
    playReview: false,
    whatsAppSent: true,
    smsSent: false,
  });
  assert.equal(okWa.httpStatus, 200);
  assert.equal(okWa.body.ok, true);

  // Retry policy
  assert.equal(shouldRetryProviderResult('TEMPORARY_FAILURE'), true);
  assert.equal(shouldRetryProviderResult('PERMANENT_FAILURE'), false);
  assert.equal(shouldRetryProviderResult('SUCCESS'), false);

  // Provider success
  {
    const out = await deliverOtpViaPipeline({
      phoneCanonical: '972501234567',
      code: '123456',
      providers: [
        mockProvider('whatsapp', () => ({
          kind: 'SUCCESS',
          provider: 'whatsapp',
          accepted: true,
        })),
      ],
      ackTimeoutMs: 5_000,
    });
    assert.equal(out.ok, true);
    assert.equal(out.sentVia, 'whatsapp');
  }

  // WhatsApp offline → SMS success
  {
    const out = await deliverOtpViaPipeline({
      phoneCanonical: '972501234567',
      code: '123456',
      providers: [
        mockProvider('whatsapp', () => ({
          kind: 'TEMPORARY_FAILURE',
          provider: 'whatsapp',
          accepted: false,
          error: 'WhatsApp client not ready',
        })),
        mockProvider('sms', () => ({
          kind: 'SUCCESS',
          provider: 'sms',
          accepted: true,
        })),
      ],
      ackTimeoutMs: 5_000,
    });
    assert.equal(out.ok, true);
    assert.equal(out.smsSent, true);
  }

  // WhatsApp timeout / permanent → fail
  {
    const out = await deliverOtpViaPipeline({
      phoneCanonical: '972501234567',
      code: '123456',
      providers: [
        mockProvider('whatsapp', () => ({
          kind: 'TEMPORARY_FAILURE',
          provider: 'whatsapp',
          accepted: false,
          error: 'timeout',
        })),
      ],
      ackTimeoutMs: 5_000,
    });
    assert.equal(out.ok, false);
    assert.equal(out.sentVia, 'none');
  }

  // Permanent failure skips retry path to next
  {
    let calls = 0;
    const out = await deliverOtpViaPipeline({
      phoneCanonical: '972501234567',
      code: '123456',
      providers: [
        mockProvider('whatsapp', () => {
          calls += 1;
          return {
            kind: 'PERMANENT_FAILURE',
            provider: 'whatsapp',
            accepted: false,
            error: 'unauthorized',
          };
        }),
        mockProvider('sms', () => ({
          kind: 'SUCCESS',
          provider: 'sms',
          accepted: true,
        })),
      ],
      ackTimeoutMs: 5_000,
    });
    assert.equal(calls, 1); // no temp retry
    assert.equal(out.ok, true);
    assert.equal(out.smsSent, true);
  }

  // Temporary failure retries once
  {
    let calls = 0;
    const out = await deliverOtpViaPipeline({
      phoneCanonical: '972501234567',
      code: '123456',
      providers: [
        mockProvider('whatsapp', () => {
          calls += 1;
          if (calls === 1) {
            return {
              kind: 'TEMPORARY_FAILURE',
              provider: 'whatsapp',
              accepted: false,
              error: 'No LID for user',
            };
          }
          return { kind: 'SUCCESS', provider: 'whatsapp', accepted: true };
        }),
      ],
      ackTimeoutMs: 8_000,
    });
    assert.equal(calls, 2);
    assert.equal(out.ok, true);
  }

  // Queue timeout
  {
    const q = new OtpDeliveryQueue();
    await assert.rejects(
      () =>
        q.enqueueAndAwait(async () => {
          await new Promise((r) => setTimeout(r, 200));
          return true;
        }, 50),
      /OTP_DELIVERY_TIMEOUT/,
    );
    const st = q.stats();
    assert.equal(st.failed, 1);
  }

  // Pipeline timeout maps to failure
  {
    const out = await deliverOtpViaPipeline({
      phoneCanonical: '972501234567',
      code: '123456',
      providers: [
        mockProvider('whatsapp', async () => {
          await new Promise((r) => setTimeout(r, 300));
          return { kind: 'SUCCESS', provider: 'whatsapp', accepted: true };
        }),
      ],
      ackTimeoutMs: 50,
    });
    assert.equal(out.ok, false);
  }

  console.log('verify-otp-reliability: OK');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
