import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import '../../models/merchant_catalog.dart';
import '../../models/merchant_order.dart';
import '../../models/merchant_session.dart';
import '../session/merchant_session_store.dart';
import 'api_base.dart';

const bool _releaseDebugLogsEnabled =
    bool.fromEnvironment('NMD_POS_DEBUG_LOGS');

class MerchantApiClient {
  MerchantApiClient(this._sessionStore)
      : _dio = Dio(
          BaseOptions(
            baseUrl: kMerchantApiBaseUrl,
            connectTimeout: const Duration(seconds: 15),
            receiveTimeout: const Duration(seconds: 20),
            headers: const {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
          ),
        ) {
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await _sessionStore.readAccessToken();
          final hasExplicitAuth =
              (options.headers['Authorization'] ?? '').toString().isNotEmpty;
          if (!hasExplicitAuth && token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          final authHeader =
              (options.headers['Authorization'] ?? '').toString();
          _debugLog(
            'request ${options.method} ${options.path} '
            'auth=${authHeader.isEmpty ? 'none' : _maskToken(authHeader.replaceFirst('Bearer ', ''))}',
          );
          handler.next(options);
        },
        onResponse: (response, handler) {
          _debugLog(
            'response ${response.statusCode} '
            '${response.requestOptions.method} ${response.requestOptions.path}',
          );
          handler.next(response);
        },
        onError: (error, handler) {
          _debugLog(
            'error ${error.response?.statusCode ?? 'network'} '
            '${error.requestOptions.method} ${error.requestOptions.path}: '
            '${error.message}',
          );
          handler.next(error);
        },
      ),
    );
  }

  final MerchantSessionStore _sessionStore;
  final Dio _dio;

  Future<MerchantSession> loginWithEmailPassword({
    required String email,
    required String password,
  }) async {
    final login = await _dio.post<Map<String, dynamic>>(
      '/auth/login',
      data: {'email': email, 'password': password},
    );
    final data = login.data ?? const <String, dynamic>{};
    final token = (data['accessToken'] ?? data['token'] ?? '').toString();
    if (token.isEmpty) {
      throw StateError('Login did not return nmd-access-token');
    }

    final authUser = data['user'] is Map
        ? Map<String, dynamic>.from(data['user'] as Map)
        : const <String, dynamic>{};
    _debugLog(
      'auth response role=${authUser['role']} '
      'tenantId=${authUser['tenantId']} token=${_maskToken(token)}',
    );

    final me = await getMe(tokenOverride: token);
    final role = (me['role'] ?? '').toString();
    final tenantId = (me['tenantId'] ?? '').toString();
    _debugLog(
      'tenant resolution /auth/me role=$role tenantId=$tenantId '
      'tenantSlug=${me['tenantSlug']} mustChangePassword=${me['mustChangePassword']}',
    );
    if (role != 'TENANT_ADMIN') {
      throw StateError(
        'This account is not a merchant store admin. Use a TENANT_ADMIN account.',
      );
    }
    if (me['mustChangePassword'] == true) {
      throw StateError(
        'Password change is required. Open the web merchant dashboard first.',
      );
    }
    if (tenantId.isEmpty) {
      throw StateError('This staff account is not linked to a tenant');
    }

    final marketId = (me['marketId'] ?? '').toString();
    final tenant = await getTenant(tenantId, tokenOverride: token);
    _debugLog(
      'tenant resolved id=${tenant['id']} slug=${tenant['slug']} '
      'name=${tenant['name']} operationalStatus=${tenant['operationalStatus']}',
    );
    final marketSlug = await _resolveMarketSlug(marketId, token);

    final session = MerchantSession(
      accessToken: token,
      tenantId: tenantId,
      marketSlug: marketSlug,
      tenantSlug: (tenant['slug'] ?? '').toString(),
      userEmail: (me['email'] ?? authUser['email'] ?? '').toString(),
    );
    await _sessionStore.saveSession(session);
    return session;
  }

  Future<Map<String, dynamic>> getMe({String? tokenOverride}) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/auth/me',
      options: tokenOverride == null
          ? null
          : Options(headers: {'Authorization': 'Bearer $tokenOverride'}),
    );
    return response.data ?? const <String, dynamic>{};
  }

  Future<Map<String, dynamic>> getTenant(
    String tenantId, {
    String? tokenOverride,
  }) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/tenants/by-id/$tenantId',
      options: tokenOverride == null
          ? null
          : Options(headers: {'Authorization': 'Bearer $tokenOverride'}),
    );
    return response.data ?? const <String, dynamic>{};
  }

  Future<TenantSettings> getTenantSettings(String tenantId) async {
    return TenantSettings.fromJson(await getTenant(tenantId));
  }

  Future<void> debugLoadCatalog(String tenantId) async {
    if (!_shouldLog) return;
    final response = await _dio.get<Map<String, dynamic>>('/catalog/$tenantId');
    final catalog = response.data ?? const <String, dynamic>{};
    final categories = catalog['categories'] is List
        ? catalog['categories'] as List
        : const <dynamic>[];
    final products = catalog['products'] is List
        ? catalog['products'] as List
        : const <dynamic>[];
    final optionGroups = catalog['optionGroups'] is List
        ? catalog['optionGroups'] as List
        : const <dynamic>[];
    final outOfStock = products.where((product) {
      if (product is! Map) return false;
      return product['isAvailable'] == false || product['inStock'] == false;
    }).length;
    _debugLog(
      'catalog loaded tenantId=$tenantId categories=${categories.length} '
      'products=${products.length} optionGroups=${optionGroups.length} '
      'unavailableProducts=$outOfStock',
    );
  }

  Future<MerchantCatalog> getCatalog(String tenantId) async {
    final response = await _dio.get<Map<String, dynamic>>('/catalog/$tenantId');
    return MerchantCatalog.fromJson(response.data ?? const <String, dynamic>{});
  }

  Future<MerchantCatalog> saveCatalog(
    String tenantId,
    MerchantCatalog catalog,
  ) async {
    final response = await _dio.put<Map<String, dynamic>>(
      '/catalog/$tenantId',
      data: catalog.toJson(),
    );
    return MerchantCatalog.fromJson(response.data ?? const <String, dynamic>{});
  }

  Future<MerchantCatalog> patchCatalogSafely(
    String tenantId,
    MerchantCatalog Function(MerchantCatalog latest) patch,
  ) async {
    final latest = await getCatalog(tenantId);
    return saveCatalog(tenantId, patch(latest));
  }

  Future<List<MerchantOrder>> getTenantOrders(String tenantId) async {
    final response = await _dio.get<List<dynamic>>(
      '/tenants/$tenantId/orders',
    );
    final data = response.data ?? const <dynamic>[];
    final orders = data
        .whereType<Map>()
        .map((row) => MerchantOrder.fromJson(Map<String, dynamic>.from(row)))
        .toList(growable: false);
    _debugLog(
      'order polling tenantId=$tenantId total=${orders.length} '
      'printable=${orders.where((order) => order.shouldAutoPrint).length}',
    );
    return orders;
  }

  Future<void> updateOrderStatus(String orderId, String status) async {
    await _dio.patch<void>(
      '/orders/$orderId/status',
      data: {'status': status},
    );
  }

  Future<TenantSettings> updateOperationalStatus(
    String tenantId,
    String status,
  ) async {
    final response = await _dio.put<Map<String, dynamic>>(
      '/tenants/$tenantId/operational-settings',
      data: {'operationalStatus': status},
    );
    return TenantSettings.fromJson(response.data ?? const <String, dynamic>{});
  }

  Future<MerchantStats> getMerchantStats(String timeRange) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/merchant/stats',
      queryParameters: {'timeRange': timeRange},
    );
    return MerchantStats.fromJson(response.data ?? const <String, dynamic>{});
  }

  bool isUnauthorized(Object error) =>
      error is DioException && error.response?.statusCode == 401;

  Future<String> _resolveMarketSlug(String marketId, String token) async {
    if (marketId.isEmpty) return '';
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/markets/$marketId',
        options: Options(headers: {'Authorization': 'Bearer $token'}),
      );
      return (response.data?['slug'] ?? '').toString();
    } catch (_) {
      return '';
    }
  }

  static bool get _shouldLog =>
      kDebugMode || kProfileMode || _releaseDebugLogsEnabled;

  static void _debugLog(String message) {
    if (_shouldLog) debugPrint('[MerchantPOS] $message');
  }

  static String _maskToken(String token) {
    if (token.length <= 12) return '***';
    return '${token.substring(0, 6)}...${token.substring(token.length - 4)}';
  }
}
