import 'dart:math';

import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../domain/cart_selected_option.dart';

final class CartLine extends Equatable {
  const CartLine({
    required this.lineKey,
    required this.tenantId,
    required this.productId,
    required this.name,
    required this.unitPrice,
    required this.imageUrl,
    required this.quantity,
    this.selectedOptions = const [],
    this.optionGroupsJson = '[]',
  });

  /// Stable id for this row (supports multiple lines same product with different modifiers).
  final String lineKey;
  final String tenantId;
  final String productId;
  final String name;
  final double unitPrice;
  final String imageUrl;
  final int quantity;

  /// Web-shaped payload: `PizzaSelectedOption` / `SelectedOption` list.
  final List<CartSelectedOption> selectedOptions;

  /// JSON array string: `[{id,name,items:[{id,name}]}]` for receipts (Arabic option names).
  final String optionGroupsJson;

  double get lineTotal => unitPrice * quantity;

  CartLine copyWith({int? quantity}) {
    return CartLine(
      lineKey: lineKey,
      tenantId: tenantId,
      productId: productId,
      name: name,
      unitPrice: unitPrice,
      imageUrl: imageUrl,
      quantity: quantity ?? this.quantity,
      selectedOptions: selectedOptions,
      optionGroupsJson: optionGroupsJson,
    );
  }

  @override
  List<Object?> get props => [
        lineKey,
        tenantId,
        productId,
        name,
        unitPrice,
        imageUrl,
        quantity,
        selectedOptions,
        optionGroupsJson
      ];
}

final class CartCubit extends Cubit<List<CartLine>> {
  CartCubit() : super(const []);

  static final _rnd = Random();

  static String _newLineKey() =>
      '${DateTime.now().microsecondsSinceEpoch}-${_rnd.nextInt(1 << 30)}';

  int get itemCount => state.fold<int>(0, (s, e) => s + e.quantity);
  String? get activeTenantId => state.isEmpty ? null : state.first.tenantId;

  bool hasDifferentTenant(String tenantId) {
    final active = activeTenantId;
    if (active == null) return false;
    return active != tenantId;
  }

  void addOrIncrement({
    required String tenantId,
    required String productId,
    required String name,
    required double unitPrice,
    required String imageUrl,
    int addQty = 1,
    List<CartSelectedOption> selectedOptions = const [],
    String optionGroupsJson = '[]',
  }) {
    final list = [...state];
    final i = list.indexWhere(
      (e) =>
          e.tenantId == tenantId &&
          e.productId == productId &&
          cartSelectedOptionsListsEqual(e.selectedOptions, selectedOptions) &&
          e.optionGroupsJson == optionGroupsJson,
    );
    if (i >= 0) {
      final line = list[i];
      list[i] = line.copyWith(quantity: line.quantity + addQty);
    } else {
      list.add(
        CartLine(
          lineKey: _newLineKey(),
          tenantId: tenantId,
          productId: productId,
          name: name,
          unitPrice: unitPrice,
          imageUrl: imageUrl,
          quantity: addQty,
          selectedOptions: selectedOptions,
          optionGroupsJson: optionGroupsJson,
        ),
      );
    }
    emit(list);
  }

  void setQuantity(String lineKey, int qty) {
    if (qty < 1) {
      removeLine(lineKey);
      return;
    }
    final list = [...state];
    final i = list.indexWhere((e) => e.lineKey == lineKey);
    if (i < 0) return;
    list[i] = list[i].copyWith(quantity: qty);
    emit(list);
  }

  void removeLine(String lineKey) {
    emit(
      state.where((e) => e.lineKey != lineKey).toList(),
    );
  }

  void clear() => emit(const []);
}
