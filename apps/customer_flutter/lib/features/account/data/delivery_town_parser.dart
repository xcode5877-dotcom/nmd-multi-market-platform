/// Canonical parsing for `GET /public/delivery-towns` responses.
List<String> parseDeliveryTownsResponse(dynamic data) {
  if (!_isRecognizedDeliveryTownsShape(data)) {
    throw const FormatException('Invalid delivery-towns response');
  }
  return _extractTownRows(data)
      .map(_extractTownName)
      .where((t) => t.isNotEmpty)
      .toList();
}

bool _isRecognizedDeliveryTownsShape(dynamic data) {
  if (data is List) return true;
  if (data is Map) {
    return data['towns'] is List || data['data'] is List;
  }
  return false;
}

List<dynamic> _extractTownRows(dynamic data) {
  if (data is List) return data;
  if (data is Map) {
    final towns = data['towns'];
    if (towns is List) return towns;
    final nested = data['data'];
    if (nested is List) return nested;
  }
  return const [];
}

String _extractTownName(dynamic item) {
  if (item is String) return item.trim();
  if (item is Map) {
    for (final key in ['name', 'label', 'title', 'town']) {
      final value = item[key];
      if (value is String && value.trim().isNotEmpty) {
        return value.trim();
      }
    }
    final id = item['id'];
    if (id is String && id.trim().isNotEmpty) {
      return id.trim();
    }
  }
  return item?.toString().trim() ?? '';
}

/// Safe description of response shape for audit logs (no sensitive fields).
String describeDeliveryTownsResponseShape(dynamic data) {
  if (data is List) return 'raw_array(len=${data.length})';
  if (data is Map) {
    final keys = data.keys.map((k) => k.toString()).toList()..sort();
    final townsLen =
        data['towns'] is List ? (data['towns'] as List).length : null;
    final dataLen = data['data'] is List ? (data['data'] as List).length : null;
    return 'map(keys=$keys,townsLen=$townsLen,dataLen=$dataLen)';
  }
  return 'unknown(${data.runtimeType})';
}
