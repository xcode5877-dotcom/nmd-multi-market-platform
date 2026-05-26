import 'dart:io' show Platform;

import 'package:flutter/foundation.dart' show debugPrint, kIsWeb;

/// Apple App Review demo access only — iOS, reviewer phone variants, OTP `123456`.
/// Remove this module after App Store approval if no longer needed.

/// Apple App Review demo access only — canonical phone sent to the API.
const String kAppReviewDemoPhoneApi = '0500000000';

/// Apple App Review demo access only
const String kAppReviewDemoPhoneDisplay = '0500000000';

/// Apple App Review demo access only
const String kAppReviewDemoOtp = '123456';

/// Apple App Review demo access only
bool get isIosAppReviewPlatform => !kIsWeb && Platform.isIOS;

String _digitsOnly(String phone) => phone.replaceAll(RegExp(r'\D'), '');

/// Apple App Review demo access only
bool isAppReviewDemoDigits(String digits) {
  return digits == '0500000000' || digits == '972500000000';
}

/// Apple App Review demo access only — true on iOS for allowlisted reviewer phones.
bool isAppReviewDemoAccount(String phone) {
  if (!isIosAppReviewPlatform) return false;
  return isAppReviewDemoDigits(_digitsOnly(phone));
}

/// Apple App Review demo access only — accepts `0500000000`, `+972500000000`, etc.
bool isAppReviewDemoPhoneInput(String phone) => isAppReviewDemoAccount(phone);

/// Apple App Review demo access only
String normalizeAppReviewDemoPhone(String phone) => kAppReviewDemoPhoneApi;

/// Apple App Review demo access only — fixed OTP for the reviewer account.
bool isAppReviewDemoOtp(String code) => code.trim() == kAppReviewDemoOtp;

/// Apple App Review demo access only — local OTP gate before server verify.
bool acceptsAppReviewDemoOtpLocally(String phone, String code) {
  return isAppReviewDemoAccount(phone) && isAppReviewDemoOtp(code);
}

/// Apple App Review demo access only — temporary trace for review hotfix verification.
void logAppleReviewAuthBypass([String detail = '']) {
  debugPrint('APPLE_REVIEW_BYPASS_TRIGGERED${detail.isEmpty ? '' : ' $detail'}');
  debugPrint('SKIPPING_WHATSAPP_AUTH');
}
