import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

/// Customer auth failure classification for guest-first browsing.
enum AuthFailureKind {
  none,
  loginRequired,
  sessionExpired,
}

/// How an API route treats customer JWTs.
enum EndpointAuthMode {
  /// No token attached; 401 must not surface as session expired.
  public,

  /// Token attached when present; 401 with stale token → clear and continue as guest.
  optionalAuth,

  /// Token required for the action; 401 without token → login; with token → session expired.
  protected,
}

const String kLoginRequiredMessage = 'سجّل الدخول للمتابعة';
const String kSessionExpiredMessage = 'انتهت الجلسة، سجّل الدخول من جديد';

/// Normalizes merged Dio paths (`/api/customer/...` or `customer/...`).
String normalizeApiPath(String path) {
  var p = path.trim();
  if (p.isEmpty) return '/';
  if (!p.startsWith('/')) p = '/$p';
  if (p.startsWith('/api/')) p = p.substring(4);
  if (!p.startsWith('/')) p = '/$p';
  return p;
}

String requestPath(RequestOptions options) =>
    options.uri.path.isNotEmpty ? options.uri.path : options.path;

bool _isRewardsRedeem(String normalized, String method) {
  if (method != 'POST') return false;
  return RegExp(r'^/customer/rewards/[^/]+/redeem$').hasMatch(normalized);
}

bool _isOptionalRewardsList(String normalized, String method) {
  if (method != 'GET') return false;
  return normalized == '/rewards' || normalized.endsWith('/rewards');
}

/// Guest-browsing routes that must never trigger session-expired UI or forced logout.
bool isPublicBrowseEndpoint(String path) {
  final normalized = normalizeApiPath(path);
  if (RegExp(r'^/markets/by-slug/[^/]+$').hasMatch(normalized)) return true;
  if (RegExp(r'^/markets/by-slug/[^/]+/layout$').hasMatch(normalized)) {
    return true;
  }
  if (RegExp(r'^/markets/by-slug/[^/]+/banners$').hasMatch(normalized)) {
    return true;
  }
  if (RegExp(r'^/markets/by-slug/[^/]+/feed-campaigns$').hasMatch(normalized)) {
    return true;
  }
  if (RegExp(r'^/markets/[^/]+/tenants$').hasMatch(normalized)) return true;
  if (normalized == '/rewards' || normalized.endsWith('/rewards')) return true;
  if (RegExp(r'^/catalog/[^/]+$').hasMatch(normalized)) return true;
  if (normalized == '/pillars' || normalized == '/sub-categories') return true;
  if (normalized == '/markets') return true;
  return classifyEndpointAuth(normalized) == EndpointAuthMode.public;
}

/// Protected customer APIs (auth required for the action).
bool isProtectedCustomerEndpoint(String path, {String method = 'GET'}) {
  return classifyEndpointAuth(path, method: method) == EndpointAuthMode.protected;
}

/// True only when stale JWT on a protected route should clear storage + session UX.
bool shouldForceLogout({
  required String path,
  required bool hadToken,
  required int? statusCode,
  String method = 'GET',
}) {
  if (statusCode != 401 || !hadToken) return false;
  if (isPublicBrowseEndpoint(path)) return false;
  return isProtectedCustomerEndpoint(path, method: method);
}

/// Classifies routes for token attachment and 401 handling.
EndpointAuthMode classifyEndpointAuth(
  String path, {
  String method = 'GET',
}) {
  final normalized = normalizeApiPath(path);
  final m = method.toUpperCase();

  if (_isRewardsRedeem(normalized, m)) {
    return EndpointAuthMode.protected;
  }
  if (_isOptionalRewardsList(normalized, m)) {
    return EndpointAuthMode.optionalAuth;
  }

  if (normalized.contains('/customer/auth/') ||
      normalized == '/auth/verify-otp') {
    return EndpointAuthMode.public;
  }

  if (normalized.contains('/customer/me') ||
      normalized.contains('/customer/orders') ||
      normalized.contains('/customer/profile') ||
      normalized.contains('/customer/coins') ||
      normalized.contains('/customer/addresses') ||
      normalized.contains('/customer/payments/')) {
    return EndpointAuthMode.protected;
  }

  if (m == 'GET' && normalized.contains('/contest/me')) {
    return EndpointAuthMode.optionalAuth;
  }
  if (normalized.contains('/contest/participate')) {
    return EndpointAuthMode.protected;
  }

  if (normalized.startsWith('/coupons/validate') ||
      normalized.endsWith('/coupons/validate')) {
    return EndpointAuthMode.optionalAuth;
  }

  if ((normalized == '/orders' || normalized.endsWith('/orders')) &&
      m == 'POST') {
    return EndpointAuthMode.protected;
  }

  if (normalized.contains('/markets/') ||
      normalized.contains('/banners') ||
      normalized.contains('/catalog') ||
      normalized.contains('/tenants') ||
      normalized.contains('/feed-campaigns') ||
      normalized.contains('/layout') ||
      normalized == '/pillars' ||
      normalized == '/sub-categories') {
    return EndpointAuthMode.public;
  }

  if (normalized.contains('/customer/')) {
    return EndpointAuthMode.protected;
  }

  return EndpointAuthMode.public;
}

/// Whether a customer JWT should be sent when one is stored.
bool shouldAttachCustomerToken(String path, {String method = 'GET'}) {
  if (isPublicBrowseEndpoint(path)) return false;
  final mode = classifyEndpointAuth(path, method: method);
  return mode == EndpointAuthMode.optionalAuth ||
      mode == EndpointAuthMode.protected;
}

AuthFailureKind classifyAuthFailure({
  required String path,
  required bool hadToken,
  required int? statusCode,
  String method = 'GET',
}) {
  if (statusCode != 401) return AuthFailureKind.none;

  if (isPublicBrowseEndpoint(path) ||
      classifyEndpointAuth(path, method: method) ==
          EndpointAuthMode.optionalAuth) {
    return AuthFailureKind.none;
  }

  if (!isProtectedCustomerEndpoint(path, method: method)) {
    return AuthFailureKind.none;
  }

  if (!hadToken) return AuthFailureKind.loginRequired;
  return AuthFailureKind.sessionExpired;
}

bool requestHadBearerToken(RequestOptions options) {
  final auth =
      options.headers['Authorization'] ?? options.headers['authorization'];
  if (auth == null) return false;
  final s = auth.toString().trim();
  return s.isNotEmpty && s.toLowerCase().startsWith('bearer ');
}

AuthFailureKind authFailureKindFromDio(DioException error) {
  final extra = error.requestOptions.extra['authFailureKind'];
  if (extra is AuthFailureKind) return extra;
  if (extra is String) {
    return AuthFailureKind.values.firstWhere(
      (k) => k.name == extra,
      orElse: () => AuthFailureKind.none,
    );
  }
  return classifyAuthFailure(
    path: requestPath(error.requestOptions),
    hadToken: requestHadBearerToken(error.requestOptions),
    statusCode: error.response?.statusCode,
    method: error.requestOptions.method,
  );
}

/// Clears stale JWT on optional-auth GET or protected session expiry (not public browse).
bool shouldClearTokenOn401({
  required String path,
  required bool hadToken,
  required int? statusCode,
  String method = 'GET',
}) {
  if (statusCode != 401 || !hadToken) return false;
  if (shouldForceLogout(
    path: path,
    hadToken: hadToken,
    statusCode: statusCode,
    method: method,
  )) {
    return true;
  }
  final mode = classifyEndpointAuth(path, method: method);
  return mode == EndpointAuthMode.optionalAuth;
}

void log401Intercept({
  required String path,
  required bool hadToken,
  required int? statusCode,
  String method = 'GET',
}) {
  final protected = isProtectedCustomerEndpoint(path, method: method);
  final willLogout = shouldForceLogout(
    path: path,
    hadToken: hadToken,
    statusCode: statusCode,
    method: method,
  );
  final line =
      '[401_INTERCEPT] path=$path hadToken=$hadToken protected=$protected '
      'willLogout=$willLogout method=$method status=$statusCode';
  if (kDebugMode) {
    debugPrint(line);
  }
}

/// True when a 401 should not surface session-expired UI (guest / public / optional).
bool isGuestSafe401(DioException error) {
  if (error.response?.statusCode != 401) return false;
  final path = requestPath(error.requestOptions);
  return !shouldForceLogout(
    path: path,
    hadToken: requestHadBearerToken(error.requestOptions),
    statusCode: 401,
    method: error.requestOptions.method,
  );
}
