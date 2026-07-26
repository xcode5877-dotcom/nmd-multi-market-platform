import 'package:customer_flutter/features/auth/domain/models.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('OtpStartResult.deliveredSuccessfully', () {
    test('rejects deliveryFailed / sentVia none even if ok was true (legacy)', () {
      expect(
        const OtpStartResult(
          ok: true,
          sentVia: 'none',
          deliveryFailed: true,
        ).deliveredSuccessfully,
        isFalse,
      );
      expect(
        const OtpStartResult(ok: true, sentVia: 'none').deliveredSuccessfully,
        isFalse,
      );
    });

    test('accepts whatsapp / sms / play_review', () {
      expect(
        const OtpStartResult(ok: true, sentVia: 'whatsapp')
            .deliveredSuccessfully,
        isTrue,
      );
      expect(
        const OtpStartResult(ok: true, sentVia: 'sms').deliveredSuccessfully,
        isTrue,
      );
      expect(
        const OtpStartResult(ok: true, sentVia: 'play_review')
            .deliveredSuccessfully,
        isTrue,
      );
      expect(
        const OtpStartResult(ok: true, sentVia: 'app_review')
            .deliveredSuccessfully,
        isTrue,
      );
    });

    test('rejects ok false', () {
      expect(
        const OtpStartResult(
          ok: false,
          sentVia: 'none',
          deliveryFailed: true,
          error: 'OTP delivery failed',
        ).deliveredSuccessfully,
        isFalse,
      );
    });
  });
}
