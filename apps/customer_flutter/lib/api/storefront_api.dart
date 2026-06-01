import 'dart:convert';
import 'dart:math' as math;

import 'package:dio/dio.dart';

import '../features/catalog/data/pillar_nav_item.dart';
import '../features/catalog/data/sub_category_nav_item.dart';
import 'markets_picker_load_result.dart';
import 'models/market.dart';
import 'models/product.dart';
import 'api_base.dart';

/// HTTP client aligned with `apps/storefront` fetch usage (`/markets`, `/markets/by-slug/...`, etc.).
class StorefrontApi {
  StorefrontApi(this.dio);

  final Dio dio;

  /// Web parity: `MarketsPickerPage` → `fetch(\`\${MOCK_API_URL}/markets\`)` then `r.json()`.
  /// Uses `{ "data": [...] }` or a bare array; empty → `FALLBACK_MARKETS`.
  Future<List<Market>> fetchMarketsForPicker() async {
    final rows = await getMarkets();
    if (rows.isEmpty) {
      nmdDebugLog(
          'INFO fetchMarketsForPicker: empty API → FALLBACK_MARKETS (web parity)');
      return _fallbackMarketsWeb;
    }
    final list = rows
        .map(Market.fromJson)
        .where((m) => m.name.isNotEmpty && m.slug.isNotEmpty)
        .toList()
      ..sort((a, b) => a.sortOrder.compareTo(b.sortOrder));
    if (list.isEmpty) return _fallbackMarketsWeb;
    return list;
  }

  /// For [MarketSelectionPage]: includes HTTP status + raw body for on-device screenshots.
  Future<MarketsPickerLoadResult> loadMarketsForPickerScreen() async {
    try {
      final response = await dio.get<dynamic>(
        '/markets',
        options: Options(
          headers: const {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Linux; Android 10)',
            'Origin': 'https://nmd.marketing',
            'Referer': 'https://nmd.marketing/',
          },
        ),
      );
      nmdDebugLog('RAW_RESPONSE: ${response.data}');
      final rawStr = response.data is String
          ? response.data as String
          : jsonEncode(response.data);
      nmdDebugLog(
          'INFO loadMarketsForPickerScreen url=${response.requestOptions.uri} status=${response.statusCode}');

      final dynamic decoded = response.data is String
          ? json.decode(response.data as String)
          : response.data;
      final List<dynamic> rows = _extractMarketsRows(decoded);
      final normalized = rows
          .whereType<Map>()
          .map((e) => _normalizeMarketMap(Map<String, dynamic>.from(e)))
          .toList();
      var list = normalized
          .map(Market.fromJson)
          .where((m) => m.name.isNotEmpty && m.slug.isNotEmpty)
          .toList()
        ..sort((a, b) => a.sortOrder.compareTo(b.sortOrder));

      final hadApiRows = normalized.isNotEmpty;
      final hadValidMarkets = list.isNotEmpty;

      if (!hadValidMarkets) {
        return MarketsPickerLoadResult(
          markets: List<Market>.from(_fallbackMarketsWeb),
          showDiagnostics: true,
          statusCode: response.statusCode,
          rawResponse: rawStr,
          errorMessage: hadApiRows
              ? 'Parsed rows but none passed name/slug filter'
              : 'Empty list from API (or unparseable shape)',
        );
      }

      return MarketsPickerLoadResult(
        markets: list,
        showDiagnostics: false,
        statusCode: response.statusCode,
      );
    } catch (e, stackTrace) {
      nmdDebugLog('ERROR loadMarketsForPickerScreen: $e');
      nmdDebugLog('$stackTrace');
      int? code;
      String? raw;
      if (e is DioException) {
        code = e.response?.statusCode;
        final d = e.response?.data;
        if (d == null) {
          raw = e.message;
        } else if (d is String) {
          raw = d;
        } else {
          try {
            raw = jsonEncode(d);
          } catch (_) {
            raw = d.toString();
          }
        }
      } else {
        raw = e.toString();
      }
      return MarketsPickerLoadResult(
        markets: const [],
        showDiagnostics: true,
        statusCode: code,
        rawResponse: raw,
        errorMessage: e.toString(),
      );
    }
  }

  /// Same as `FALLBACK_MARKETS` in `MarketsPickerPage.tsx`.
  static const List<Market> _fallbackMarketsWeb = [
    Market(
      id: 'market-dabburiyya',
      name: 'سوق دبورية الرقمي',
      slug: 'daburiyya',
      imageUrl: null,
      isActive: true,
      sortOrder: 0,
    ),
    Market(
      id: 'market-iksal',
      name: 'سوق إكسال الرقمي',
      slug: 'iksal',
      imageUrl: null,
      isActive: true,
      sortOrder: 1,
    ),
  ];

  Future<List<Map<String, dynamic>>> getMarkets() async {
    try {
      final response = await dio.get<dynamic>(
        '/markets',
        options: Options(
          headers: const {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Linux; Android 10)',
            'Origin': 'https://nmd.marketing',
            'Referer': 'https://nmd.marketing/',
          },
        ),
      );
      nmdDebugLog('RAW_RESPONSE: ${response.data}');
      final rawBody = response.data is String
          ? response.data as String
          : jsonEncode(response.data);
      nmdDebugLog(
          'INFO StorefrontApi.getMarkets url=${response.requestOptions.uri} status=${response.statusCode}');
      nmdDebugLog('INFO StorefrontApi.getMarkets raw_body=$rawBody');

      final dynamic decoded = response.data is String
          ? json.decode(response.data as String)
          : response.data;
      final List<dynamic> rows = _extractMarketsRows(decoded);
      nmdDebugLog(
          'INFO StorefrontApi.getMarkets markets count: ${rows.length}');
      return rows
          .whereType<Map>()
          .map((e) => _normalizeMarketMap(Map<String, dynamic>.from(e)))
          .toList();
    } catch (error, stackTrace) {
      nmdDebugLog('ERROR StorefrontApi.getMarkets failed: $error');
      nmdDebugLog('$stackTrace');
      return const <Map<String, dynamic>>[];
    }
  }

  List<dynamic> _extractMarketsRows(dynamic decoded) {
    if (decoded is List) return decoded;
    if (decoded is String && decoded.trim().isNotEmpty) {
      try {
        final parsed = json.decode(decoded);
        return _extractMarketsRows(parsed);
      } catch (_) {
        return const <dynamic>[];
      }
    }
    if (decoded is! Map) return const <dynamic>[];
    final map = Map<String, dynamic>.from(decoded);

    dynamic data = map['data'] ?? map['Data'];
    if (data is String && data.trim().isNotEmpty) {
      try {
        data = json.decode(data);
      } catch (_) {
        data = null;
      }
    }
    if (data is List) return data;
    if (data is Map) {
      final inner = Map<String, dynamic>.from(data);
      if (inner['data'] is List) return inner['data'] as List<dynamic>;
      if (inner['items'] is List) return inner['items'] as List<dynamic>;
      if (inner['markets'] is List) return inner['markets'] as List<dynamic>;
    }

    if (map['markets'] is List) return map['markets'] as List<dynamic>;
    if (map['items'] is List) return map['items'] as List<dynamic>;
    if (map['results'] is List) return map['results'] as List<dynamic>;
    if (map['tenants'] is List) return map['tenants'] as List<dynamic>;

    return const <dynamic>[];
  }

  Map<String, dynamic> _normalizeMarketMap(Map<String, dynamic> raw) {
    final brandingRaw = raw['branding'];
    final branding = brandingRaw is Map
        ? Map<String, dynamic>.from(brandingRaw)
        : const <String, dynamic>{};
    final imageUrl = (raw['imageUrl']?.toString() ??
            raw['logoUrl']?.toString() ??
            raw['iconUrl']?.toString() ??
            branding['logoUrl']?.toString() ??
            branding['imageUrl']?.toString() ??
            '')
        .trim();
    return {
      ...raw,
      'name': (raw['name']?.toString() ?? '').trim(),
      'slug': (raw['slug']?.toString() ?? '').trim(),
      'imageUrl': imageUrl,
      'isActive': raw['isActive'] == true,
      'sortOrder':
          raw['sortOrder'] is num ? (raw['sortOrder'] as num).toInt() : 999,
    };
  }

  Future<Map<String, dynamic>> getMarketBySlug(String slug) async {
    final response = await dio.get<dynamic>('/markets/by-slug/$slug');
    final data = response.data;
    if (data is Map) return Map<String, dynamic>.from(data);
    throw Exception('Invalid market payload for slug=$slug');
  }

  /// All tenants for a market (no server-side pillar filter).
  Future<List<Map<String, dynamic>>> getTenants(String marketId) async {
    final response = await dio
        .get<dynamic>('/markets/${Uri.encodeComponent(marketId)}/tenants');
    final rows = _extractMarketsRows(response.data);
    return rows
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }

  /// `GET /markets/{marketId}/tenants` with `pillar_id` and optional `sub_category_id` (exact IDs from `/pillars` and `/sub-categories`).
  Future<List<Map<String, dynamic>>> getMarketTenants(
    String marketId, {
    String? pillarId,
    String? subCategoryId,
    String? subCategoryName,
  }) async {
    final query = <String, String>{};
    final p = pillarId?.trim();
    if (p != null && p.isNotEmpty) query['pillar_id'] = p;
    final sid = subCategoryId?.trim();
    if (sid != null && sid.isNotEmpty) query['sub_category_id'] = sid;
    final sn = subCategoryName?.trim();
    if (sn != null && sn.isNotEmpty) query['sub_category'] = sn;

    final path = '/markets/${Uri.encodeComponent(marketId)}/tenants';
    final q = query.isEmpty ? '' : '?${Uri(queryParameters: query).query}';
    final fullUrl = '${dio.options.baseUrl}$path$q';
    nmdDebugLog('[NMD] getMarketTenants FULL URL: $fullUrl');

    final response = await dio.get<dynamic>(
      path,
      queryParameters: query.isEmpty ? null : Map<String, dynamic>.from(query),
    );
    final rows = _extractMarketsRows(response.data);
    final out =
        rows.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
    nmdDebugLog('[NMD] getMarketTenants rowCount=${out.length}');
    return out;
  }

  /// Admin parity: `GET /sub-categories?pillarId=`
  Future<List<SubCategoryNavItem>> getSubCategories(
      {required String pillarId}) async {
    final response = await dio.get<dynamic>(
      '/sub-categories',
      queryParameters: {
        'pillarId': pillarId.trim(),
        '_t': DateTime.now().millisecondsSinceEpoch.toString(),
      },
    );
    final raw = response.data;
    final List<dynamic> list;
    if (raw is List) {
      list = raw;
    } else if (raw is Map && raw['data'] is List) {
      list = raw['data'] as List<dynamic>;
    } else {
      list = const [];
    }
    final rows =
        list.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
    rows.sort((a, b) {
      final sa = a['sortOrder'] ?? a['sort_order'];
      final sb = b['sortOrder'] ?? b['sort_order'];
      return (sa is num ? sa.toInt() : 0).compareTo(sb is num ? sb.toInt() : 0);
    });
    return rows
        .map(SubCategoryNavItem.fromJson)
        .where((s) => s.id.isNotEmpty && s.titleAr.isNotEmpty)
        .toList();
  }

  /// `GET /pillars` — same list as Super Admin / home pillar row.
  Future<List<PillarNavItem>> getPillars() async {
    final response = await dio.get<dynamic>(
      '/pillars',
      queryParameters: {'_t': DateTime.now().millisecondsSinceEpoch.toString()},
    );
    final raw = response.data;
    final List<dynamic> list;
    if (raw is List) {
      list = raw;
    } else if (raw is Map && raw['data'] is List) {
      list = raw['data'] as List<dynamic>;
    } else {
      list = const [];
    }
    final rows =
        list.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
    rows.sort((a, b) {
      final sa = a['sortOrder'] ?? a['sort_order'];
      final sb = b['sortOrder'] ?? b['sort_order'];
      final ia = sa is num ? sa.toInt() : 999;
      final ib = sb is num ? sb.toInt() : 999;
      return ia.compareTo(ib);
    });
    return rows
        .map(PillarNavItem.fromJson)
        .where((p) => p.id.isNotEmpty && p.titleAr.isNotEmpty)
        .toList();
  }

  /// Tenant details used by store pages.
  /// Web parity: `StoreHero` needs `bannerUrl` (or `coverImage`) to render images.
  Future<Map<String, dynamic>> getTenantDetails(
      String marketId, String tenantId) async {
    final tenants = await getTenants(marketId);
    final tenant = tenants.firstWhere(
      (t) =>
          t['id']?.toString() == tenantId || t['slug']?.toString() == tenantId,
      orElse: () => const <String, dynamic>{},
    );

    if (tenant.isEmpty) {
      throw Exception(
          'Tenant not found for tenantId=$tenantId marketId=$marketId');
    }

    final brandingRaw = tenant['branding'];
    final branding = brandingRaw is Map
        ? Map<String, dynamic>.from(brandingRaw)
        : const <String, dynamic>{};

    String? heroImageUrl;
    final heroRaw = tenant['hero'] ?? branding['hero'];
    if (heroRaw is Map) {
      heroImageUrl = heroRaw['imageUrl']?.toString();
    }

    String? firstBannerImageUrl;
    final bannersRaw = tenant['banners'] ?? branding['banners'];
    if (bannersRaw is List) {
      final mapped = bannersRaw
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList();
      if (mapped.isNotEmpty) {
        final first = mapped.firstWhere(
          (b) => (b['enabled'] ?? b['isActive'] ?? true) == true,
          orElse: () => mapped.first,
        );
        firstBannerImageUrl =
            first['imageUrl']?.toString() ?? first['coverImage']?.toString();
      }
    }

    final candidates = <String?>[
      tenant['coverImage']?.toString(),
      tenant['bannerUrl']?.toString(),
      tenant['imageUrl']?.toString(),
      heroImageUrl,
      firstBannerImageUrl,
      branding['coverImage']?.toString(),
      branding['bannerUrl']?.toString(),
      branding['imageUrl']?.toString(),
    ];
    final bannerUrl = candidates
        .map((v) => (v ?? '').trim())
        .firstWhere((v) => v.isNotEmpty, orElse: () => '');

    final resolvedId = (tenant['id'] ?? tenantId).toString().trim();
    var merged = <String, dynamic>{
      ...tenant,
      'bannerUrl': bannerUrl,
      'coverImage': bannerUrl,
    };

    // `GET /markets/:id/tenants` omits branding.whatsappPhone / branding.phone — merge full tenant for leads.
    try {
      final response = await dio
          .get<dynamic>('/tenants/by-id/${Uri.encodeComponent(resolvedId)}');
      final data = response.data;
      if (data is Map) {
        final full = Map<String, dynamic>.from(data);
        merged = {
          ...full,
          ...merged,
          'bannerUrl': bannerUrl,
          'coverImage': bannerUrl,
        };
      }
    } catch (e) {
      nmdDebugLog(
          'getTenantDetails: GET /tenants/by-id skipped ($resolvedId): $e');
    }

    return merged;
  }

  Future<List<Map<String, dynamic>>> getCampaigns(String tenantId) async {
    final response = await dio
        .get<dynamic>('/campaigns', queryParameters: {'tenantId': tenantId});
    final rows = _extractMarketsRows(response.data);
    return rows
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }

  Future<List<Map<String, dynamic>>> getMarketLayout(String slug) async {
    final response = await dio.get<dynamic>('/markets/by-slug/$slug/layout');
    final rows = _extractMarketsRows(response.data);
    return rows
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }

  Future<List<Map<String, dynamic>>> getMarketBanners(String slug) async {
    final response = await dio.get<dynamic>('/markets/by-slug/$slug/banners');
    final rows = _extractMarketsRows(response.data);
    return rows
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }

  /// GET `/markets/by-slug/:slug/feed-campaigns` — home discovery promo blocks.
  Future<List<Map<String, dynamic>>> getMarketFeedCampaigns(String slug) async {
    final response =
        await dio.get<dynamic>('/markets/by-slug/$slug/feed-campaigns');
    final rows = _extractMarketsRows(response.data);
    return rows
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }

  /// GET `/catalog/:tenantId` — products, categories, optionGroups (mock-api parity).
  Future<Map<String, dynamic>> getCatalog(String tenantId) async {
    final response = await dio.get<dynamic>(
      '/catalog/$tenantId',
      options: Options(
        headers: const {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        },
      ),
    );
    final data = response.data;
    if (data is Map) return Map<String, dynamic>.from(data);
    throw Exception('Invalid catalog for tenant=$tenantId');
  }

  Future<List<ProductCategory>> getCatalogCategories(String tenantId) async {
    final catalog = await getCatalog(tenantId);
    final rows = (catalog['categories'] as List<dynamic>? ?? const <dynamic>[])
        .whereType<Map>()
        .where((row) => row['isVisible'] != false)
        .map((e) => ProductCategory.fromJson(Map<String, dynamic>.from(e)))
        .where((c) => c.id.isNotEmpty && c.title.isNotEmpty)
        .toList();
    return rows;
  }

  /// Real-price parser parity with web product shape (`basePrice` first, then price fallbacks).
  /// `GET /delivery/:tenantId` — modes + default delivery fee (mock-api parity).
  Future<Map<String, dynamic>> getDeliverySettings(String tenantId) async {
    final response =
        await dio.get<dynamic>('/delivery/${Uri.encodeComponent(tenantId)}');
    final data = response.data;
    if (data is Map) return Map<String, dynamic>.from(data);
    return const <String, dynamic>{};
  }

  /// `GET /tenants/:tenantId/delivery-zones` — active zones with fees.
  Future<List<Map<String, dynamic>>> getDeliveryZones(String tenantId) async {
    final response = await dio.get<dynamic>(
        '/tenants/${Uri.encodeComponent(tenantId)}/delivery-zones');
    final raw = response.data;
    if (raw is! List) return const <Map<String, dynamic>>[];
    return raw
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }

  /// `GET /customer/me` — requires customer JWT.
  Future<Map<String, dynamic>?> getCustomerMe() async {
    try {
      final response = await dio.get<dynamic>('/customer/me');
      final data = response.data;
      if (data is Map) return Map<String, dynamic>.from(data);
    } catch (_) {}
    return null;
  }

  /// `GET /customer/addresses`
  Future<List<Map<String, dynamic>>> getCustomerAddresses() async {
    try {
      final response = await dio.get<dynamic>('/customer/addresses');
      final data = response.data;
      if (data is Map && data['addresses'] is List) {
        return (data['addresses'] as List)
            .whereType<Map>()
            .map((e) => Map<String, dynamic>.from(e))
            .toList();
      }
    } catch (e, st) {
      nmdDebugLog('getCustomerAddresses: $e\n$st');
    }
    return const <Map<String, dynamic>>[];
  }

  Future<Map<String, dynamic>?> postCustomerAddress({
    String? label,
    required String line1,
    required String city,
    String? notes,
    bool isDefault = false,
  }) async {
    try {
      final response = await dio.post<dynamic>(
        '/customer/addresses',
        data: <String, dynamic>{
          'line1': line1,
          'city': city,
          if (label != null) 'label': label,
          if (notes != null) 'notes': notes,
          'isDefault': isDefault,
        },
      );
      final data = response.data;
      if (data is Map) return Map<String, dynamic>.from(data);
    } catch (e, st) {
      nmdDebugLog('postCustomerAddress: $e\n$st');
    }
    return null;
  }

  Future<Map<String, dynamic>?> patchCustomerAddress(
    String id, {
    String? label,
    String? line1,
    String? city,
    String? notes,
    bool? isDefault,
  }) async {
    try {
      final response = await dio.patch<dynamic>(
        '/customer/addresses/${Uri.encodeComponent(id)}',
        data: <String, dynamic>{
          if (label != null) 'label': label,
          if (line1 != null) 'line1': line1,
          if (city != null) 'city': city,
          if (notes != null) 'notes': notes,
          if (isDefault != null) 'isDefault': isDefault,
        },
      );
      final data = response.data;
      if (data is Map) return Map<String, dynamic>.from(data);
    } catch (e, st) {
      nmdDebugLog('patchCustomerAddress: $e\n$st');
    }
    return null;
  }

  Future<bool> deleteCustomerAddress(String id) async {
    try {
      await dio.delete<void>('/customer/addresses/${Uri.encodeComponent(id)}');
      return true;
    } catch (e, st) {
      nmdDebugLog('deleteCustomerAddress: $e\n$st');
    }
    return false;
  }

  Future<List<Map<String, dynamic>>> getCustomerPaymentMethods() async {
    try {
      final response = await dio.get<dynamic>('/customer/payment-methods');
      final data = response.data;
      if (data is Map && data['paymentMethods'] is List) {
        return (data['paymentMethods'] as List)
            .whereType<Map>()
            .map((e) => Map<String, dynamic>.from(e))
            .toList();
      }
    } catch (e, st) {
      nmdDebugLog('getCustomerPaymentMethods: $e\n$st');
    }
    return const <Map<String, dynamic>>[];
  }

  Future<Map<String, dynamic>?> postCustomerPaymentMethod({
    required String cardNumber,
    required String holderName,
    required int expiryMonth,
    required int expiryYear,
    required String cvv,
  }) async {
    try {
      final response = await dio.post<dynamic>(
        '/customer/payment-methods',
        data: <String, dynamic>{
          'cardNumber': cardNumber,
          'holderName': holderName,
          'expiryMonth': expiryMonth,
          'expiryYear': expiryYear,
          'cvv': cvv,
        },
      );
      final data = response.data;
      if (data is Map) return Map<String, dynamic>.from(data);
    } catch (e, st) {
      nmdDebugLog('postCustomerPaymentMethod: $e\n$st');
    }
    return null;
  }

  Future<bool> deleteCustomerPaymentMethod(String id) async {
    try {
      await dio.delete<void>(
        '/customer/payment-methods/${Uri.encodeComponent(id)}',
      );
      return true;
    } catch (e, st) {
      nmdDebugLog('deleteCustomerPaymentMethod: $e\n$st');
    }
    return false;
  }

  Future<Map<String, dynamic>?> getCustomerNotificationSettings() async {
    try {
      final response =
          await dio.get<dynamic>('/customer/notification-settings');
      final data = response.data;
      if (data is Map) return Map<String, dynamic>.from(data);
    } catch (e, st) {
      nmdDebugLog('getCustomerNotificationSettings: $e\n$st');
    }
    return null;
  }

  Future<Map<String, dynamic>?> patchCustomerNotificationSettings({
    bool? orderUpdates,
    bool? promotions,
    bool? news,
  }) async {
    try {
      final response = await dio.patch<dynamic>(
        '/customer/notification-settings',
        data: <String, dynamic>{
          if (orderUpdates != null) 'orderUpdates': orderUpdates,
          if (promotions != null) 'promotions': promotions,
          if (news != null) 'news': news,
        },
      );
      final data = response.data;
      if (data is Map) return Map<String, dynamic>.from(data);
    } catch (e, st) {
      nmdDebugLog('patchCustomerNotificationSettings: $e\n$st');
    }
    return null;
  }

  /// `PATCH /customer/profile` — name (required for save); email, city, avatarUrl optional.
  Future<Map<String, dynamic>?> patchCustomerProfile({
    required String name,
    String? email,
    String? city,
    String? avatarUrl,
  }) async {
    try {
      final response = await dio.patch<dynamic>(
        '/customer/profile',
        data: <String, dynamic>{
          'name': name.trim(),
          'email': email?.trim() ?? '',
          'city': city?.trim() ?? '',
          if (avatarUrl != null && avatarUrl.trim().isNotEmpty)
            'avatarUrl': avatarUrl.trim(),
        },
      );
      final data = response.data;
      if (data is Map) return Map<String, dynamic>.from(data);
    } catch (e, st) {
      nmdDebugLog('patchCustomerProfile: $e\n$st');
    }
    return null;
  }

  /// `GET /coupons/validate?...` — uses customer token when available (see [AuthInterceptor]).
  Future<Map<String, dynamic>> validateCoupon({
    required String code,
    String? tenantId,
    List<String>? cartStoreIds,
    required double subtotal,
    String? customerPhone,
  }) async {
    final q = <String, dynamic>{
      'code': code.trim(),
      'subtotal': subtotal.toString(),
    };
    if (tenantId != null && tenantId.isNotEmpty) {
      q['tenantId'] = tenantId;
    }
    if (cartStoreIds != null && cartStoreIds.isNotEmpty) {
      q['cartStoreIds'] = cartStoreIds.join(',');
    }
    if (customerPhone != null && customerPhone.trim().isNotEmpty) {
      q['customerPhone'] = customerPhone.trim();
    }

    final response = await dio.get<Map<String, dynamic>>(
      '/coupons/validate',
      queryParameters: q,
    );
    return Map<String, dynamic>.from(response.data ?? const {});
  }

  /// Winner / suggested coupons — `GET /customer/rewards` (requires auth).
  Future<List<Map<String, dynamic>>> getCustomerRewards() async {
    try {
      final response = await dio.get<dynamic>('/customer/rewards');
      final raw = response.data;
      if (raw is! List) return const <Map<String, dynamic>>[];
      return raw
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList();
    } catch (_) {
      return const <Map<String, dynamic>>[];
    }
  }

  /// `POST /orders` — marketplace order (public route; customer token attaches [customerId] when present).
  Future<Map<String, dynamic>> postOrder(Map<String, dynamic> body) async {
    final response = await dio.post<dynamic>('/orders', data: body);
    final data = response.data;
    if (data is Map) return Map<String, dynamic>.from(data);
    throw Exception('Invalid order response');
  }

  /// Server-authoritative checkout totals (platform fee hidden in merchandise amount).
  Future<Map<String, dynamic>> quoteCheckoutPricing({
    required List<Map<String, dynamic>> stores,
    double deliveryFee = 0,
  }) async {
    try {
      final response = await dio.post<dynamic>(
        '/customer/pricing/quote',
        data: <String, dynamic>{
          'stores': stores,
          'deliveryFee': deliveryFee,
        },
      );
      final data = response.data;
      if (data is Map) return Map<String, dynamic>.from(data);
    } catch (e, st) {
      nmdDebugLog('quoteCheckoutPricing: $e\n$st');
    }
    final itemsSubtotal = stores.fold<double>(
      0,
      (s, st) => s + ((st['itemsSubtotal'] as num?)?.toDouble() ?? 0),
    );
    final discountAmount = stores.fold<double>(
      0,
      (s, st) => s + ((st['discountAmount'] as num?)?.toDouble() ?? 0),
    );
    final legacyMerchandise = math.max(0, itemsSubtotal - discountAmount);
    return {
      'customerTotal': legacyMerchandise + deliveryFee,
      'deliveryFee': deliveryFee,
      'displayMerchandiseTotal': legacyMerchandise,
      'discountAmount': discountAmount,
      'itemsSubtotal': itemsSubtotal,
      'platformFeeApplied': false,
    };
  }

  /// Hyp hosted payment: `POST /customer/payments/hyp/session` → `{ paymentUrl, orderGroupId, amountAgorot, currency }`.
  Future<Map<String, dynamic>> postHypPaymentSession(
      {required String orderGroupId}) async {
    final response = await dio.post<dynamic>(
      '/customer/payments/hyp/session',
      data: <String, dynamic>{'orderGroupId': orderGroupId},
    );
    final data = response.data;
    if (data is Map) return Map<String, dynamic>.from(data);
    throw Exception('Invalid Hyp session response');
  }

  /// Storefront parity: `GET /contest/active?t=...` (see `ContestPopUp.tsx`).
  /// Fallback only if some deployments expose plural `/contests/active`.
  Future<Map<String, dynamic>?> getActiveContest() async {
    const candidates = <String>['/contest/active', '/contests/active'];
    for (final path in candidates) {
      try {
        final response = await dio.get<dynamic>(
          path,
          queryParameters: {
            't': DateTime.now().millisecondsSinceEpoch.toString()
          },
          options: Options(
            headers: const {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0',
            },
          ),
        );
        final data = response.data;
        nmdDebugLog(
          '[getActiveContest] $path status=${response.statusCode} type=${data.runtimeType}',
        );
        // Web: `res.json()` can be `null` when no active contest.
        if (data == null) continue;
        if (data is Map) {
          final map = Map<String, dynamic>.from(data);
          if (map.isEmpty) continue;
          return map;
        }
      } on DioException catch (e) {
        final code = e.response?.statusCode;
        nmdDebugLog(
            '[getActiveContest] $path DioException status=$code ${e.message}');
        if (code == 404) continue;
        rethrow;
      }
    }
    return null;
  }

  /// Participate in contest (`QUESTION` / `PREDICTION` / quick-join style answer).
  /// Body matches web `ContestPopUp`: `{ contestId, ...payload }` with
  /// `userAnswer` or `scoreA` / `scoreB`.
  Future<(int httpStatus, Map<String, dynamic> body)> participateInContest({
    required String contestId,
    String? userAnswer,
    int? scoreA,
    int? scoreB,
  }) async {
    final body = <String, dynamic>{'contestId': contestId};
    if (userAnswer != null && userAnswer.trim().isNotEmpty) {
      body['userAnswer'] = userAnswer.trim();
    }
    if (scoreA != null) body['scoreA'] = scoreA;
    if (scoreB != null) body['scoreB'] = scoreB;
    nmdDebugLog('[participateInContest] PAYLOAD: ${jsonEncode(body)}');
    try {
      final response =
          await dio.post<dynamic>('/contest/participate', data: body);
      final httpStatus = response.statusCode ?? 201;
      nmdDebugLog('[participateInContest] OK HTTP $httpStatus');
      final data = response.data;
      if (data is Map) return (httpStatus, Map<String, dynamic>.from(data));
      return (httpStatus, const <String, dynamic>{});
    } on DioException catch (e) {
      final status = e.response?.statusCode;
      final raw = _stringifyContestErrorBody(e.response?.data);
      nmdDebugLog('[participateInContest] FAIL HTTP $status body=$raw');
      rethrow;
    }
  }

  static String _stringifyContestErrorBody(dynamic data) {
    if (data == null) return '(empty body)';
    try {
      if (data is Map || data is List) return jsonEncode(data);
      return data.toString();
    } catch (_) {
      return data.toString();
    }
  }

  /// Web parity: storefront uses `GET /contest/me` to hide pop-up when already participated.
  Future<List<Map<String, dynamic>>> getMyContestParticipations() async {
    final response = await dio.get<dynamic>('/contest/me');
    final data = response.data;
    if (data is! List) return const <Map<String, dynamic>>[];
    return data
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }

  /// Authenticated customer order history.
  /// Web parity: first call `GET /customer/activity` and read `orders`.
  /// Fallback to legacy `GET /customer/orders` envelope.
  Future<List<Map<String, dynamic>>> getCustomerOrders(
      {String? bearerTokenForLogging}) async {
    const primaryPath = '/customer/activity';
    const fallbackPath = '/customer/orders';
    final base = dio.options.baseUrl;
    final normalizedBase =
        base.endsWith('/') ? base.substring(0, base.length - 1) : base;
    final primaryUrl = '$normalizedBase$primaryPath';
    final fallbackUrl = '$normalizedBase$fallbackPath';
    nmdDebugLog('[getCustomerOrders] resolved primary URL: $primaryUrl');
    nmdDebugLog('[getCustomerOrders] resolved fallback URL: $fallbackUrl');

    final token = bearerTokenForLogging?.trim();
    if (token != null && token.isNotEmpty) {
      nmdDebugLog('[getCustomerOrders] JWT TOKEN (full): $token');
      final payload = _decodeJwtPayloadUnverified(token);
      final cid = payload != null ? _customerIdFromJwtPayload(payload) : null;
      nmdDebugLog(
        '[getCustomerOrders] customerId from JWT payload (unverified): '
        '${cid ?? "<could not decode sub/customerId>"} rawClaims=${payload ?? {}}',
      );
    } else {
      nmdDebugLog(
          '[getCustomerOrders] JWT TOKEN: <missing — not passed from caller>');
    }

    Response<dynamic> response;
    dynamic data;
    var usedPath = primaryPath;
    try {
      response = await dio.get<dynamic>(primaryPath);
      data = response.data;
    } on DioException catch (e) {
      // If activity endpoint is unavailable, keep old behavior.
      if (e.response?.statusCode != 404) rethrow;
      usedPath = fallbackPath;
      response = await dio.get<dynamic>(fallbackPath);
      data = response.data;
    }

    final rawFull = data is String
        ? response.data as String
        : (() {
            try {
              return jsonEncode(data);
            } catch (_) {
              return data.toString();
            }
          })();
    nmdDebugLog(
        '[getCustomerOrders] FULL RAW RESPONSE START endpoint=$usedPath len=${rawFull.length}');
    nmdDebugLog(rawFull);
    nmdDebugLog(
      '[getCustomerOrders] FULL RAW RESPONSE END status=${response.statusCode} '
      'uri=${response.requestOptions.uri} endpoint=$usedPath',
    );

    if (data is String && data.trim().isNotEmpty) {
      try {
        data = json.decode(data);
      } catch (_) {
        nmdDebugLog(
          'WARN getCustomerOrders: body is non-JSON string status=${response.statusCode}',
        );
        return const <Map<String, dynamic>>[];
      }
    }

    var rows = _parseCustomerOrdersFromActivityOrOrders(data);
    if (rows.isEmpty) {
      final recovered = _recursiveFindOrderLikeMapLists(data);
      if (recovered.isNotEmpty) {
        nmdDebugLog(
          '[getCustomerOrders] recovered ${recovered.length} row(s) via recursive JSON search',
        );
        rows = recovered;
      }
    }

    if (response.statusCode == 200 && rows.isEmpty) {
      final payload = token != null && token.isNotEmpty
          ? _decodeJwtPayloadUnverified(token)
          : null;
      final cid = payload != null ? _customerIdFromJwtPayload(payload) : null;
      nmdDebugLog(
        '[getCustomerOrders] HTTP 200 but 0 orders — customerId from JWT payload (unverified): '
        '${cid ?? "<could not decode sub/customerId>"} rawClaims=${payload ?? {}}',
      );
    }

    if (rows.isEmpty && data is Map) {
      nmdDebugLog(
        'WARN getCustomerOrders: empty after standard + recursive parse status=${response.statusCode} '
        'keys=${data.keys.toList()}',
      );
    } else if (rows.isEmpty) {
      nmdDebugLog(
        'WARN getCustomerOrders: empty after standard + recursive parse status=${response.statusCode} '
        'type=${data.runtimeType}',
      );
    }

    return rows;
  }

  List<Map<String, dynamic>> _parseCustomerOrdersFromActivityOrOrders(
      dynamic data) {
    if (data is List) {
      return data
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList();
    }
    if (data is Map) {
      final m = Map<String, dynamic>.from(data);
      // Web path returns `{ orders, leads }` from `/customer/activity`.
      dynamic orders = m['orders'] ?? m['Orders'] ?? m['data'];
      if (orders is String && orders.trim().isNotEmpty) {
        try {
          orders = json.decode(orders);
        } catch (_) {
          orders = null;
        }
      }
      if (orders is List) {
        return orders
            .whereType<Map>()
            .map((e) => Map<String, dynamic>.from(e))
            .toList();
      }
      if (orders is Map && orders['orders'] is List) {
        return (orders['orders'] as List<dynamic>)
            .whereType<Map>()
            .map((e) => Map<String, dynamic>.from(e))
            .toList();
      }
    }
    return const <Map<String, dynamic>>[];
  }

  /// When the envelope shape changes, depth-first search for a [List] of [Map] that look like orders.
  List<Map<String, dynamic>> _recursiveFindOrderLikeMapLists(dynamic node,
      [int depth = 0]) {
    if (depth > 24) return const <Map<String, dynamic>>[];
    if (node is List) {
      final maps = node
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList();
      if (maps.length == node.length &&
          maps.isNotEmpty &&
          _listLooksLikeOrderRows(maps)) {
        return maps;
      }
      for (final item in node) {
        final sub = _recursiveFindOrderLikeMapLists(item, depth + 1);
        if (sub.isNotEmpty) return sub;
      }
    } else if (node is Map) {
      for (final v in node.values) {
        final sub = _recursiveFindOrderLikeMapLists(v, depth + 1);
        if (sub.isNotEmpty) return sub;
      }
    }
    return const <Map<String, dynamic>>[];
  }

  bool _listLooksLikeOrderRows(List<Map<String, dynamic>> maps) {
    var score = 0;
    for (final m in maps.take(5)) {
      if (m.containsKey('id') || m.containsKey('orderId')) {
        score += 2;
      }
      if (m.containsKey('status') ||
          m.containsKey('tenantId') ||
          m.containsKey('total')) {
        score += 1;
      }
    }
    return score >= 2;
  }

  Future<List<Product>> getCatalogProducts(String tenantId) async {
    final catalog = await getCatalog(tenantId);
    final groupRows =
        (catalog['optionGroups'] as List<dynamic>? ?? const <dynamic>[])
            .whereType<Map>()
            .map((e) => Map<String, dynamic>.from(e))
            .toList();
    final groupsById = <String, Map<String, dynamic>>{
      for (final g in groupRows)
        if ((g['id']?.toString() ?? '').trim().isNotEmpty)
          (g['id']?.toString() ?? '').trim(): g,
    };

    final rows = (catalog['products'] as List<dynamic>? ?? const <dynamic>[])
        .whereType<Map>()
        .where((row) {
          final isArchived = row['isArchived'] == true;
          final isAvailable = row['isAvailable'] != false;
          final inStock = row['inStock'] != false;
          return !isArchived && isAvailable && inStock;
        })
        .map((e) {
          final productMap = Map<String, dynamic>.from(e);
          final optionGroupIds =
              (productMap['optionGroupIds'] as List<dynamic>? ??
                      const <dynamic>[])
                  .map((id) => id.toString())
                  .toList();

          if ((productMap['optionGroups'] as List?) == null ||
              (productMap['optionGroups'] as List).isEmpty) {
            final resolvedGroups = optionGroupIds
                .map((id) => groupsById[id])
                .whereType<Map<String, dynamic>>()
                .toList();
            if (resolvedGroups.isNotEmpty) {
              productMap['optionGroups'] = resolvedGroups;
            }
          }

          return Product.fromJson(productMap);
        })
        .where((p) => p.id.isNotEmpty && p.name.isNotEmpty)
        .toList();
    return rows;
  }
}

String _padJwtBase64Url(String s) {
  var out = s.replaceAll('-', '+').replaceAll('_', '/');
  final mod = out.length % 4;
  if (mod == 2) {
    out += '==';
  } else if (mod == 3) {
    out += '=';
  }
  return out;
}

Map<String, dynamic>? _decodeJwtPayloadUnverified(String jwt) {
  final parts = jwt.trim().split('.');
  if (parts.length < 2) return null;
  try {
    final bytes = base64Decode(_padJwtBase64Url(parts[1]));
    final o = jsonDecode(utf8.decode(bytes));
    if (o is Map<String, dynamic>) return o;
    if (o is Map) return Map<String, dynamic>.from(o);
  } catch (_) {}
  return null;
}

String? _customerIdFromJwtPayload(Map<String, dynamic> p) {
  final c = p['sub'] ?? p['customerId'] ?? p['id'];
  return c?.toString();
}
