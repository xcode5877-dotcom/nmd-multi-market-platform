import 'dart:io' show Platform;

import 'package:flutter/foundation.dart' show kIsWeb;

/// Apple App Review demo access only — iOS, phone `0500000000`, OTP `123456`.
/// Remove this module after App Store approval if no longer needed.

const String kAppReviewDemoPhoneDisplay = '0500000000';

/// Apple App Review demo access only
const String kAppReviewDemoOtp = '123456';

/// Apple App Review demo access only
bool get isIosAppReviewPlatform => !kIsWeb && Platform.isIOS;

String _digitsOnly(String phone) => phone.replaceAll(RegExp(r'\D'), '');

/// Apple App Review demo access only — true on iOS for the allowlisted reviewer phone.
bool isAppReviewDemoAccount(String phone) {
  if (!isIosAppReviewPlatform) return false;
  final digits = _digitsOnly(phone);
  return digits == '0500000000' || digits == '972500000000';
}

/// Apple App Review demo access only — fixed OTP for the reviewer account.
bool isAppReviewDemoOtp(String code) {
  return code.trim() == kAppReviewDemoOtp;
}

/// Apple App Review demo access only — local OTP gate before server verify.
bool acceptsAppReviewDemoOtpLocally(String phone, String code) {
  return isAppReviewDemoAccount(phone) && isAppReviewDemoOtp(code);
}
