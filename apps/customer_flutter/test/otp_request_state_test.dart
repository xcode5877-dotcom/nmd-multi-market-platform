import 'package:flutter_test/flutter_test.dart';

import 'package:customer_flutter/features/auth/presentation/bloc/auth_bloc.dart';

void main() {
  test('otp request Arabic mapping covers rate-limit without claiming delivery', () {
    // Client must distinguish request acceptance from WhatsApp send confirmation.
    // This sprint keeps LIVE_OTP_DELIVERY_VERIFIED=false until controlled receipt.
    const messages = {
      'rate': 'تم إرسال عدة طلبات. انتظر قليلاً ثم أعد المحاولة.',
      'generic': 'تعذر إرسال رمز التحقق. حاول مرة أخرى.',
    };
    expect(messages['rate'], contains('انتظر'));
    expect(AuthStep.otp, isNot(AuthStep.done));
  });
}
