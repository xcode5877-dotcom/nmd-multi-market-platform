import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import 'delivery_town_parser.dart';

void townsAudit(String message) {
  if (kDebugMode) {
    debugPrint('[TOWNS-AUDIT] $message');
  }
}

/// Fetches supported delivery towns from `GET /public/delivery-towns`.
class DeliveryTownRepository {
  DeliveryTownRepository(this._dio);

  final Dio _dio;

  List<String>? _cache;

  Future<List<String>> fetchTowns({bool forceRefresh = false}) async {
    if (!forceRefresh && _cache != null) {
      townsAudit('cache hit count=${_cache!.length}');
      return _cache!;
    }

    const path = '/public/delivery-towns';
    townsAudit('request start endpoint=$path');
    final response = await _dio.get<dynamic>(path);
    townsAudit(
      'response status=${response.statusCode} '
      'shape=${describeDeliveryTownsResponseShape(response.data)}',
    );

    final towns = parseDeliveryTownsResponse(response.data);
    townsAudit('parsed count=${towns.length}');
    for (var i = 0; i < towns.length; i++) {
      townsAudit('town[$i] name=${towns[i]}');
    }

    _cache = towns;
    return towns;
  }

  void clearCache() => _cache = null;
}
