/**
 * Regression: /customer/auth/start must not claim success when all delivery channels fail.
 */
import assert from 'node:assert/strict';
import { buildOtpStartClientResponse } from '../src/otp-start-response.js';

function main() {
  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';

  const failed = buildOtpStartClientResponse({
    playReview: false,
    whatsAppSent: false,
    smsSent: false,
    whatsAppError: 'WHATSAPP_DEVICE_OFFLINE: WhatsApp is not connected.',
  });
  assert.equal(failed.httpStatus, 503);
  assert.equal(failed.body.ok, false);
  assert.equal(failed.body.error, 'OTP_DELIVERY_FAILED');
  assert.equal(failed.body.sentVia, 'none');
  assert.equal(failed.body.deliveryFailed, true);

  // Production must not treat leaked/logged codes as successful delivery.
  const leakedDev = buildOtpStartClientResponse({
    playReview: false,
    whatsAppSent: false,
    smsSent: false,
    devCode: '123456',
  });
  assert.equal(leakedDev.httpStatus, 503);
  assert.equal(leakedDev.body.ok, false);
  assert.equal(leakedDev.body.error, 'OTP_DELIVERY_FAILED');

  const waOk = buildOtpStartClientResponse({
    playReview: false,
    whatsAppSent: true,
    smsSent: false,
  });
  assert.equal(waOk.httpStatus, 200);
  assert.equal(waOk.body.ok, true);
  assert.equal(waOk.body.sentVia, 'whatsapp');
  assert.equal(waOk.body.deliveryFailed, undefined);

  const smsOk = buildOtpStartClientResponse({
    playReview: false,
    whatsAppSent: false,
    smsSent: true,
  });
  assert.equal(smsOk.httpStatus, 200);
  assert.equal(smsOk.body.ok, true);
  assert.equal(smsOk.body.sentVia, 'sms');

  process.env.NODE_ENV = 'development';
  const mockDev = buildOtpStartClientResponse({
    playReview: false,
    whatsAppSent: false,
    smsSent: false,
    devCode: '123456',
  });
  assert.equal(mockDev.httpStatus, 200);
  assert.equal(mockDev.body.ok, true);
  assert.equal(mockDev.body.devCode, '123456');

  process.env.NODE_ENV = 'production';
  const play = buildOtpStartClientResponse({
    playReview: true,
    whatsAppSent: false,
    smsSent: false,
  });
  assert.equal(play.httpStatus, 200);
  assert.equal(play.body.ok, true);
  assert.equal(play.body.sentVia, 'play_review');

  if (prev === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = prev;

  console.log('verify-otp-start-response: OK');
}

main();
