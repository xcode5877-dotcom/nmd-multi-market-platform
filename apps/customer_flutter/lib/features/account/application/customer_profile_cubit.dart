import 'package:dio/dio.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../api/storefront_api.dart';

/// Canonical customer profile fields used across the app.
///
/// [defaultDeliveryTown] is the **only** source of truth for the customer's
/// primary delivery area. Checkout must never store a parallel selection.
class CustomerProfileState {
  const CustomerProfileState({
    this.defaultDeliveryTown,
    this.name,
    this.phone,
    this.loaded = false,
  });

  final String? defaultDeliveryTown;
  final String? name;
  final String? phone;
  final bool loaded;

  String get primaryDeliveryArea => defaultDeliveryTown?.trim() ?? '';

  bool get hasPrimaryDeliveryArea => primaryDeliveryArea.isNotEmpty;

  CustomerProfileState copyWith({
    String? defaultDeliveryTown,
    String? name,
    String? phone,
    bool? loaded,
    bool clearTown = false,
  }) {
    return CustomerProfileState(
      defaultDeliveryTown:
          clearTown ? null : (defaultDeliveryTown ?? this.defaultDeliveryTown),
      name: name ?? this.name,
      phone: phone ?? this.phone,
      loaded: loaded ?? this.loaded,
    );
  }
}

class CustomerProfileCubit extends Cubit<CustomerProfileState> {
  CustomerProfileCubit(this._dio) : super(const CustomerProfileState());

  final Dio _dio;

  StorefrontApi get _api => StorefrontApi(_dio);

  Future<void> refresh() async {
    final me = await _api.getCustomerMe();
    if (me == null) {
      emit(const CustomerProfileState(loaded: true));
      return;
    }
    emit(
      CustomerProfileState(
        defaultDeliveryTown: me['defaultDeliveryTown']?.toString().trim(),
        name: me['name']?.toString().trim(),
        phone: me['phone']?.toString().trim(),
        loaded: true,
      ),
    );
  }

  /// Persists primary area on the server, then updates local canonical state.
  Future<bool> savePrimaryDeliveryArea({
    required String town,
    required String name,
    String source = 'profile',
  }) async {
    final t = town.trim();
    if (t.isEmpty || name.trim().isEmpty) return false;
    final res = await _api.patchCustomerProfile(
      name: name.trim(),
      defaultDeliveryTown: t,
      source: source,
    );
    if (res == null) return false;
    final saved = res['defaultDeliveryTown']?.toString().trim();
    emit(
      state.copyWith(
        defaultDeliveryTown: (saved != null && saved.isNotEmpty) ? saved : t,
        name: name.trim(),
        loaded: true,
      ),
    );
    return true;
  }

  void applyFromMe(Map<String, dynamic> me) {
    emit(
      CustomerProfileState(
        defaultDeliveryTown: me['defaultDeliveryTown']?.toString().trim(),
        name: me['name']?.toString().trim(),
        phone: me['phone']?.toString().trim(),
        loaded: true,
      ),
    );
  }

  void clear() => emit(const CustomerProfileState());
}
