import 'package:flutter/foundation.dart';

/// **Release:** always uses strict certificate verification.
///
/// **Non-release:** relaxed TLS when [kDebugMode] is on, or when
/// `--dart-define=NMD_ALLOW_INSECURE_SSL=true` (e.g. profile builds against a dev host).
bool get kNmdRelaxSslVerification =>
    !kReleaseMode &&
    (kDebugMode ||
        const bool.fromEnvironment('NMD_ALLOW_INSECURE_SSL',
            defaultValue: false));

/// Returns true if [host] looks like an IPv4/IPv6 literal (not a DNS name).
bool nmdApiHostLooksLikeIp(String host) {
  if (host.isEmpty) return false;
  // IPv6 in brackets, e.g. [::1]
  if (host.startsWith('[')) return true;
  final ipv4 = RegExp(r'^\d{1,3}(\.\d{1,3}){3}$');
  if (ipv4.hasMatch(host)) return true;
  // Heuristic: numeric segments only → likely IPv4 mistyped or similar
  if (host.contains(':') && !host.contains('.')) return true;
  return false;
}

/// Mirrors storefront env (`VITE_MOCK_API_URL`):
/// - Production nginx serves the API at **`/api/*`** (see repo `nginx.conf`).
/// - Dio merges [baseUrl] + [path] by **string concatenation**. Use base **`https://nmd.marketing/api`**
///   (NO trailing slash) and paths **`/customer/coins`** (leading slash).
///
/// Override: `--dart-define=NMD_API_BASE=https://your-host/api` (no trailing slash).
/// Optional non-release TLS override: `--dart-define=NMD_ALLOW_INSECURE_SSL=true` (profile/staging
/// only; never for store release).
///
/// [kReleaseMode]: if `NMD_API_BASE` is empty, locks to production `https://nmd.marketing/api`.
const String _kNmdApiBaseFromEnv =
    String.fromEnvironment('NMD_API_BASE', defaultValue: '');

/// Production gateway (no trailing slash).
const String kNmdApiProductionBase = 'https://nmd.marketing/api';

/// Ensures `/api` when only a bare origin is configured.
String normalizeStorefrontApiBase(String raw) {
  var s = raw.trim();
  if (s.isEmpty) {
    return kNmdApiProductionBase;
  }
  while (s.endsWith('/')) {
    s = s.substring(0, s.length - 1);
  }
  final uri = Uri.parse(s);
  final path = uri.path;
  if (path.isEmpty || path == '/') {
    return '${uri.scheme}://${uri.host}${uri.hasPort ? ':${uri.port}' : ''}/api';
  }
  return s;
}

/// Production hostname (nginx + SSL at `/api`).
const String _kNmdProductionHost = 'nmd.marketing';

/// Forces [kNmdApiProductionBase] for any `nmd.marketing` URL that uses `http`, a non-443 port
/// (e.g. `:60588` from a bad `--dart-define`), or missing `/api` — so SSL and the gateway path match production.
String sanitizeNmdProductionApiBase(String normalized) {
  final uri = Uri.tryParse(normalized.trim());
  if (uri == null) return normalized;
  if (uri.host.toLowerCase() != _kNmdProductionHost) {
    return normalized;
  }
  return kNmdApiProductionBase;
}

/// Resolved API base for Dio and image URL helpers. Never ends with `/`.
String get kStorefrontApiBase {
  final raw = _kNmdApiBaseFromEnv.trim();
  if (kReleaseMode && raw.isEmpty) {
    return kNmdApiProductionBase;
  }
  if (raw.isEmpty) {
    return kNmdApiProductionBase;
  }
  return sanitizeNmdProductionApiBase(normalizeStorefrontApiBase(raw));
}

/// When `true` (or in debug mode), logs each request URI to the console (see [DioClient]).
const bool kNmdApiLog =
    bool.fromEnvironment('NMD_API_LOG', defaultValue: false);

/// No-ops in release to avoid I/O and accidental logging of payloads/tokens.
void nmdDebugLog(String message) {
  if (kDebugMode) {
    debugPrint(message);
  }
}

/// True when release build uses [kNmdApiProductionBase] because `NMD_API_BASE` was not set.
bool get kNmdApiLockedToProduction =>
    kReleaseMode && _kNmdApiBaseFromEnv.trim().isEmpty;
