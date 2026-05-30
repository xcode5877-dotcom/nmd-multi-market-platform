import 'dart:math';

import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../api/api_base.dart';
import '../../../api/models/product.dart';
import '../domain/cart_selected_option.dart';

final class CartLine extends Equatable {
  const CartLine({
    required this.lineKey,
    required this.tenantId,
    required this.productId,
    required this.name,
    required this.unitPrice,
    required this.merchantUnitPrice,
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
  /// Customer-visible unit price (includes marketplace markup when set).
  final double unitPrice;
  /// Merchant base unit price for order payout (unchanged by platform markup).
  final double merchantUnitPrice;
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
      merchantUnitPrice: merchantUnitPrice,
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
        merchantUnitPrice,
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
    double? merchantUnitPrice,
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
          merchantUnitPrice: merchantUnitPrice ?? unitPrice,
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

  /// Refresh customer [unitPrice] from fresh catalog (platform fee / displayPrice changes).
  /// Merchant [merchantUnitPrice] is unchanged; markup delta is applied on top.
  void repriceFromCatalog(String tenantId, List<Product> products) {
    if (state.isEmpty || products.isEmpty) return;
    final byId = {for (final p in products) p.id: p};
    var changed = false;
    final next = state.map((line) {
      if (line.tenantId != tenantId) return line;
      final product = byId[line.productId];
      if (product == null) return line;
      final markupDelta = product.customerListPrice - product.basePrice;
      if (markupDelta == 0 &&
          line.unitPrice >= product.customerListPrice &&
          line.merchantUnitPrice <= product.basePrice) {
        return line;
      }
      final newUnitPrice = line.merchantUnitPrice + markupDelta;
      if ((newUnitPrice - line.unitPrice).abs() < 0.001) return line;
      changed = true;
      nmdDebugLog(
        'INFO cart reprice ${product.name}: base=${product.basePrice} '
        'display=${product.displayPrice} customerList=${product.customerListPrice} '
        'line ${line.unitPrice}→$newUnitPrice',
      );
      return CartLine(
        lineKey: line.lineKey,
        tenantId: line.tenantId,
        productId: line.productId,
        name: line.name,
        unitPrice: newUnitPrice,
        merchantUnitPrice: line.merchantUnitPrice,
        imageUrl: line.imageUrl,
        quantity: line.quantity,
        selectedOptions: line.selectedOptions,
        optionGroupsJson: line.optionGroupsJson,
      );
    }).toList();
    if (changed) emit(next);
  }

  /// Reprice all tenants present in the cart (checkout bootstrap).
  Future<void> repriceFromCatalogForTenants(
    Map<String, List<Product>> productsByTenant,
  ) async {
    if (state.isEmpty || productsByTenant.isEmpty) return;
    for (final entry in productsByTenant.entries) {
      repriceFromCatalog(entry.key, entry.value);
    }
  }
}
