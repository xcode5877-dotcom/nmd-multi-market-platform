import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import 'open_support_whatsapp.dart';
import 'support_config.dart';

/// Fetches and caches Support Center config. Updates apply without app rebuild.
class SupportConfigRepository {
  SupportConfigRepository(this._dio);

  final Dio _dio;

  SupportConfig? _cache;
  DateTime? _fetchedAt;
  static const _ttl = Duration(seconds: 30);

  /// Process-wide cache so the floating hub and Help page share one TTL window.
  static SupportConfig? _sharedCache;
  static DateTime? _sharedFetchedAt;

  SupportConfig? get cached => _cache ?? _sharedCache;

  static SupportConfig? peekSharedCache() => _sharedCache;

  /// Merge API config with compile-time dart-define fallbacks when API empty.
  SupportConfig resolveWithDefines(SupportConfig api) {
    final wa = api.supportWhatsapp.trim().isNotEmpty
        ? api.supportWhatsapp
        : (kNmdSupportWhatsAppDigits.trim().isNotEmpty
            ? kNmdSupportWhatsAppDigits
            : SupportConfig.safeDefault.supportWhatsapp);
    final phone = api.supportPhone.trim().isNotEmpty
        ? api.supportPhone
        : (kNmdSupportPhoneDigits.trim().isNotEmpty
            ? kNmdSupportPhoneDigits
            : SupportConfig.safeDefault.supportPhone);
    return api.copyWith(
      supportPhone: phone,
      supportWhatsapp: wa,
      // Preserve explicit admin disable; fill empty numbers from defines/defaults.
      supportEnabled: api.supportEnabled,
      floatingSupportEnabled: api.floatingSupportEnabled,
    );
  }

  Future<SupportConfig> fetch({bool force = false}) async {
    final now = DateTime.now();
    if (!force &&
        _sharedCache != null &&
        _sharedFetchedAt != null &&
        now.difference(_sharedFetchedAt!) < _ttl) {
      _cache = _sharedCache;
      _fetchedAt = _sharedFetchedAt;
      return _sharedCache!;
    }
    if (!force &&
        _cache != null &&
        _fetchedAt != null &&
        now.difference(_fetchedAt!) < _ttl) {
      return _cache!;
    }
    try {
      final response = await _dio.get<dynamic>(
        '/config/support',
        options: Options(
          receiveTimeout: const Duration(seconds: 8),
          sendTimeout: const Duration(seconds: 8),
        ),
      );
      final data = response.data;
      Map<String, dynamic>? supportMap;
      if (data is Map) {
        final root = Map<String, dynamic>.from(data);
        final s = root['support'];
        if (s is Map) {
          supportMap = Map<String, dynamic>.from(s);
        } else {
          supportMap = root;
        }
      }
      final parsed = resolveWithDefines(SupportConfig.fromJson(supportMap));
      _cache = parsed;
      _fetchedAt = now;
      _sharedCache = parsed;
      _sharedFetchedAt = now;
      return parsed;
    } catch (e, st) {
      debugPrint('SupportConfigRepository.fetch: $e\n$st');
      if (_cache != null) return _cache!;
      if (_sharedCache != null) return _sharedCache!;
      // Network failure must not permanently hide support.
      final result = resolveWithDefines(SupportConfig.safeDefault);
      _cache = result;
      _fetchedAt = now;
      _sharedCache = result;
      _sharedFetchedAt = now;
      return result;
    }
  }

  void invalidate() {
    _cache = null;
    _fetchedAt = null;
    _sharedCache = null;
    _sharedFetchedAt = null;
  }

  @visibleForTesting
  static void resetSharedCacheForTest() {
    _sharedCache = null;
    _sharedFetchedAt = null;
  }

  @visibleForTesting
  static void seedSharedCacheForTest(SupportConfig config) {
    _sharedCache = config;
    _sharedFetchedAt = DateTime.now();
  }
}
