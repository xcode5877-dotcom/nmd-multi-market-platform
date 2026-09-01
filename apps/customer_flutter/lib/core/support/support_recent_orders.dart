import 'package:dio/dio.dart';

import '../../api/storefront_api.dart';
import '../../features/orders/domain/customer_order_vm.dart';
import '../../features/orders/presentation/widgets/order_status_badge.dart';
import 'support_message_builder.dart';

/// Compact recent-order fetch for the Support Hub selector only.
///
/// Does not mutate order state or reuse the Orders page cubit.
class SupportRecentOrdersLoader {
  SupportRecentOrdersLoader(this._dio);

  final Dio _dio;

  /// Returns up to [limit] recent eligible orders (newest first).
  Future<List<CustomerOrderVm>> loadRecent({int limit = 8}) async {
    final api = StorefrontApi(_dio);
    final rows = await api.getCustomerOrders();
    final vms = rows
        .map(CustomerOrderVm.fromJson)
        .where((o) => o.id.isNotEmpty)
        .toList();
    vms.sort((a, b) {
      final at = a.createdAtIso ?? '';
      final bt = b.createdAtIso ?? '';
      return bt.compareTo(at);
    });
    if (vms.length <= limit) return vms;
    return vms.sublist(0, limit);
  }
}

SupportOrderContext supportOrderContextFromVm(CustomerOrderVm order) {
  final visual = orderStatusVisual(
    order.status,
    order.fulfillmentType,
    isServiceLead: order.suppressesDeliveryTracking,
  );
  return SupportOrderContext(
    orderId: order.id,
    orderGroupId: order.orderGroupId,
    status: visual.label,
    storeName: order.tenantName,
    includeGroupId: false,
  );
}
