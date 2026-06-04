import 'dart:developer' as developer;

import 'package:flutter/foundation.dart';

/// Feed/home promo diagnostics (`adb logcat -s NMD_FEED`).
/// Pass [verbose: true] for per-block/per-campaign lines (debug only).
void nmdFeedTrace(String message, {bool verbose = false}) {
  if (verbose && !kDebugMode) return;
  developer.log(message, name: 'NMD_FEED');
}
