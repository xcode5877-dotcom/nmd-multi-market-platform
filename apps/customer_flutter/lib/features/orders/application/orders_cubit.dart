import 'package:dio/dio.dart';
import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../api/api_base.dart';
import '../../../api/storefront_api.dart';
import '../../../core/network/token_storage.dart';
import '../domain/customer_order_vm.dart';

enum OrdersStatus { initial, loading, success, empty, error, unauthorized }

final class OrdersState extends Equatable {
  const OrdersState({
    required this.status,
    this.groups = const [],
    this.message,
  });

  const OrdersState.initial()
      : this(status: OrdersStatus.initial, groups: const [], message: null);
  const OrdersState.loading()
      : this(status: OrdersStatus.loading, groups: const [], message: null);
  const OrdersState.success(this.groups)
      : status = OrdersStatus.success,
        message = null;
  const OrdersState.empty()
      : this(status: OrdersStatus.empty, groups: const [], message: null);
  const OrdersState.error(this.message)
      : status = OrdersStatus.error,
        groups = const [];
  const OrdersState.unauthorized()
      : this(
            status: OrdersStatus.unauthorized, groups: const [], message: null);

  final OrdersStatus status;
  final List<CustomerOrderGroup> groups;
  final String? message;

  @override
  List<Object?> get props => [status, groups, message];
}

class OrdersCubit extends Cubit<OrdersState> {
  OrdersCubit(this._dio, this._tokenStorage)
      : super(const OrdersState.initial());

  final Dio _dio;
  final TokenStorage _tokenStorage;

  void reportUnauthorized() => emit(const OrdersState.unauthorized());

  /// Does not call the network unless a customer JWT is present.
  Future<void> load() async {
    final token = await _tokenStorage.getCustomerToken();
    if (token == null || token.trim().isEmpty) {
      emit(const OrdersState.unauthorized());
      return;
    }

    emit(const OrdersState.loading());
    try {
      final api = StorefrontApi(_dio);
      final rows = await api.getCustomerOrders(bearerTokenForLogging: token);
      nmdDebugLog(
        '[OrdersCubit] GET /customer/orders → parsed row count=${rows.length}',
      );
      var vms = rows
          .map(CustomerOrderVm.fromJson)
          .where((o) => o.id.isNotEmpty)
          .toList();
      if (vms.length != rows.length) {
        nmdDebugLog(
          '[OrdersCubit] dropped ${rows.length - vms.length} row(s) missing id '
          '(raw ids: ${rows.map((r) => r['id']).toList()})',
        );
      }
      if (vms.isEmpty) {
        nmdDebugLog(
          '[OrdersCubit] empty after parse: API returned ${rows.length} map(s), '
          '0 valid VMs (no static fallback — live data only)',
        );
        emit(const OrdersState.empty());
        return;
      }
      final groups = groupCustomerOrders(vms);
      nmdDebugLog(
        '[OrdersCubit] success: ${vms.length} order(s) → ${groups.length} group(s)',
      );
      emit(OrdersState.success(groups));
    } on DioException catch (e) {
      final code = e.response?.statusCode;
      if (code == 401) {
        emit(const OrdersState.unauthorized());
        return;
      }
      // Missing route / proxy typo: treat like "no orders" instead of a technical error screen.
      if (code == 404) {
        emit(const OrdersState.empty());
        return;
      }
      emit(OrdersState.error(_extractError(e)));
    } catch (e) {
      emit(OrdersState.error(e.toString()));
    }
  }

  static String _extractError(DioException e) {
    final d = e.response?.data;
    if (d is Map && d['error'] != null) return d['error'].toString();
    return e.message ?? 'تعذّر تحميل الطلبات';
  }
}
