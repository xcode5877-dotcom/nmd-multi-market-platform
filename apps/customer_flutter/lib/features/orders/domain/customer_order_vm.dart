import 'package:equatable/equatable.dart';

import '../../../api/api_base.dart';

/// One row from `GET /customer/orders` (enriched on the server).
final class CustomerOrderVm extends Equatable {
  const CustomerOrderVm({
    required this.id,
    required this.raw,
    required this.tenantId,
    this.tenantName,
    this.tenantLogoUrl,
    this.tenantWhatsappDigits,
    this.status,
    this.total,
    this.createdAtIso,
    this.fulfillmentType,
    this.orderGroupId,
    required this.itemCount,
    this.items,
    this.orderType,
    this.driverLat,
    this.driverLng,
    this.dropoffLat,
    this.dropoffLng,
  });

  final String id;
  final Map<String, dynamic> raw;
  final String tenantId;
  final String? tenantName;
  final String? tenantLogoUrl;
  final String? tenantWhatsappDigits;
  final String? status;
  final double? total;
  final String? createdAtIso;
  final String? fulfillmentType;
  final String? orderGroupId;
  final int itemCount;
  final List<dynamic>? items;

  /// `PRODUCT` | `FOOD` | `SERVICE` | … (mock-api `Order.orderType`).
  final String? orderType;

  /// Live courier position when provided by API (store delivery).
  final double? driverLat;
  final double? driverLng;
  final double? dropoffLat;
  final double? dropoffLng;

  factory CustomerOrderVm.fromJson(Map<String, dynamic> m) {
    final itemsRaw = m['items'];
    List<dynamic>? itemsList;
    if (itemsRaw is List) itemsList = itemsRaw;
    var count = (m['itemCount'] is num) ? (m['itemCount'] as num).toInt() : 0;
    if (count <= 0 && itemsList != null) count = itemsList.length;

    final dl = m['driverLocation'];
    double? dLat;
    double? dLng;
    if (dl is Map) {
      dLat = (dl['lat'] as num?)?.toDouble();
      dLng = (dl['lng'] as num?)?.toDouble();
    }
    dLat ??= (m['driverLat'] as num?)?.toDouble();
    dLng ??= (m['driverLng'] as num?)?.toDouble();

    final drop = m['dropoffLocation'];
    double? dropLat;
    double? dropLng;
    if (drop is Map) {
      dropLat = (drop['lat'] as num?)?.toDouble();
      dropLng = (drop['lng'] as num?)?.toDouble();
    }

    final vm = CustomerOrderVm(
      id: m['id']?.toString() ?? '',
      raw: m,
      tenantId: m['tenantId']?.toString() ?? '',
      tenantName: m['tenantName']?.toString(),
      tenantLogoUrl: m['tenantLogoUrl']?.toString(),
      tenantWhatsappDigits: m['tenantWhatsappDigits']?.toString(),
      status: m['status']?.toString(),
      total: m['total'] is num ? (m['total'] as num).toDouble() : null,
      createdAtIso: m['createdAt']?.toString(),
      fulfillmentType: m['fulfillmentType']?.toString(),
      orderGroupId: m['orderGroupId']?.toString(),
      itemCount: count,
      items: itemsList,
      orderType: (m['orderType'] ?? m['type'])?.toString(),
      driverLat: dLat,
      driverLng: dLng,
      dropoffLat: dropLat,
      dropoffLng: dropLng,
    );
    nmdDebugLog('DEBUG: Order ${vm.id} type is ${vm.orderType}');
    return vm;
  }

  DateTime? get createdAt => parseOrderCreatedAt(createdAtIso);

  /// Valid for display/sorting (excludes null and epoch/invalid timestamps).
  bool get hasReliableCreatedAt {
    final d = createdAt;
    if (d == null) return false;
    return hasReliableCreatedAtFor(d);
  }

  /// Strict: API may send `orderType` or `type` (handled in [fromJson]); re-check [raw] if needed.
  bool get isServiceOrder {
    String? t = orderType?.trim();
    t ??= raw['orderType']?.toString().trim();
    t ??= raw['type']?.toString().trim();
    return (t ?? '').toUpperCase() == 'SERVICE';
  }

  bool get isRoyalDripTenant {
    final n = (tenantName ?? '').toLowerCase();
    return n.contains('royal drip');
  }

  /// No map / timeline / pulsing chip: SERVICE leads or Royal Drip store name (forced in UI).
  bool get suppressesDeliveryTracking => isServiceOrder || isRoyalDripTenant;

  bool get hasDriverLocation => driverLat != null && driverLng != null;

  @override
  List<Object?> get props => [
        id,
        status,
        total,
        createdAtIso,
        tenantId,
        orderGroupId,
        orderType,
        driverLat,
        driverLng,
      ];
}

/// Groups multi-store checkout (`orderGroupId`) for display.
final class CustomerOrderGroup extends Equatable {
  const CustomerOrderGroup({
    required this.groupKey,
    required this.orders,
  });

  final String groupKey;
  final List<CustomerOrderVm> orders;

  /// Latest reliable creation time among lines, or `null` if none (no 1970 fallback).
  DateTime? get sortDate {
    final dates = orders
        .where((o) => o.hasReliableCreatedAt)
        .map((o) => o.createdAt!)
        .toList();
    if (dates.isEmpty) return null;
    return dates.reduce((a, b) => a.isAfter(b) ? a : b);
  }

  double get combinedTotal =>
      orders.fold<double>(0, (s, o) => s + (o.total ?? 0));

  bool get isMultiStore => orders.length > 1;

  String get primaryLabel {
    if (orders.isEmpty) return '';
    if (orders.length == 1) return orders.single.tenantName ?? 'متجر';
    return '${orders.length} محلات';
  }

  /// All lines are service bookings — UI skips live map/timeline tracking.
  bool get isServiceOnlyGroup =>
      orders.isNotEmpty && orders.every((o) => o.isServiceOrder);

  @override
  List<Object?> get props => [groupKey, orders];
}

List<CustomerOrderGroup> groupCustomerOrders(List<CustomerOrderVm> list) {
  final map = <String, List<CustomerOrderVm>>{};
  for (final o in list) {
    final gid = o.orderGroupId?.trim();
    final key = (gid != null && gid.isNotEmpty) ? gid : 'single-${o.id}';
    map.putIfAbsent(key, () => []).add(o);
  }
  final groups = map.entries
      .map((e) => CustomerOrderGroup(groupKey: e.key, orders: e.value))
      .toList();
  groups.sort((a, b) {
    final ad = a.sortDate;
    final bd = b.sortDate;
    if (ad == null && bd == null) return a.groupKey.compareTo(b.groupKey);
    if (ad == null) return 1;
    if (bd == null) return -1;
    return bd.compareTo(ad);
  });
  for (final g in groups) {
    g.orders.sort((a, b) {
      final av = a.hasReliableCreatedAt ? a.createdAt! : null;
      final bv = b.hasReliableCreatedAt ? b.createdAt! : null;
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return bv.compareTo(av);
    });
  }
  return groups;
}

/// Shared rule: epoch / invalid API dates must not drive UI headers.
bool hasReliableCreatedAtFor(DateTime d) => d.year > 1970;

/// Parses API `createdAt` (ISO-8601, unix seconds, or millis) and filters epoch garbage.
DateTime? parseOrderCreatedAt(String? iso) {
  if (iso == null || iso.trim().isEmpty) return null;
  final s = iso.trim();
  final direct = DateTime.tryParse(s);
  if (direct != null && direct.year > 1970) {
    return direct.toLocal();
  }
  final n = int.tryParse(s);
  if (n != null) {
    if (n > 100000000000) {
      final d = DateTime.fromMillisecondsSinceEpoch(n, isUtc: true).toLocal();
      if (d.year > 1970) return d;
    } else if (n > 1000000000) {
      final d =
          DateTime.fromMillisecondsSinceEpoch(n * 1000, isUtc: true).toLocal();
      if (d.year > 1970) return d;
    }
  }
  if (direct != null && direct.year > 1970) return direct.toLocal();
  return null;
}
