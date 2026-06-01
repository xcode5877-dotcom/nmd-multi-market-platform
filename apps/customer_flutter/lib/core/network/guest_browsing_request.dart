import 'package:dio/dio.dart';

import '../auth/auth_failure.dart';

/// Runs [fn]; on guest-safe 401 (public/optional browse) retries once after interceptor clears JWT.
Future<T> withGuestBrowsingRetry<T>(Future<T> Function() fn) async {
  try {
    return await fn();
  } on DioException catch (e) {
    if (!isGuestSafe401(e)) rethrow;
    return fn();
  }
}

/// Swallows guest-safe 401 and returns [fallback]; rethrows other errors.
Future<T> withGuestBrowsingFallback<T>(
  Future<T> Function() fn,
  T fallback,
) async {
  try {
    return await withGuestBrowsingRetry(fn);
  } on DioException catch (e) {
    if (isGuestSafe401(e)) return fallback;
    rethrow;
  }
}
