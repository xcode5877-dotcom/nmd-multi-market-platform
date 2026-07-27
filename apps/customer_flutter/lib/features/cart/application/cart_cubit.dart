import 'dart:math';

import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../api/api_base.dart';
import '../../../api/models/product.dart';
import '../../../measurement/measurement.dart';
import '../domain/cart_selected_option.dart';
import '../data/cart_persistence.dart';

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
    required this.measurement,
    this.fixedModifierTotal = 0,
    this.selectedOptions = const [],
    this.optionGroupsJson = '[]',
  });

  /// Stable id for this row (supports multiple lines same product with different modifiers).
  final String lineKey;
  final String tenantId;
  final String productId;
  final String name;

  /// Customer-visible price per base unit.
  /// PIECE/PACKAGE: typically base + scaling modifiers.
  /// WEIGHT/VOLUME: base unit only; see [fixedModifierTotal].
  final double unitPrice;

  /// Merchant base unit price for order payout (unchanged by platform markup).
  final double merchantUnitPrice;
  final String imageUrl;

  /// Quantity in **base units** as a normalized decimal string (e.g. `"0.25"`).
  final String quantity;

  /// Snapshot of product measurement at add-to-cart time.
  final ProductMeasurement measurement;

  /// Fixed modifier shekels for WEIGHT/VOLUME (not multiplied by qty). Preview only.
  final double fixedModifierTotal;

  /// Web-shaped payload: `PizzaSelectedOption` / `SelectedOption` list.
  final List<CartSelectedOption> selectedOptions;

  /// JSON array string: `[{id,name,items:[{id,name}]}]` for receipts (Arabic option names).
  final String optionGroupsJson;

  /// Badge contribution: PIECE/PACKAGE use integer qty; WEIGHT/VOLUME count as 1 line.
  int get badgeUnits {
    if (measurement.isWeighted) return 1;
    final parsed = parseMeasurementDecimalStrict(quantity);
    if (!parsed.ok || !isIntegerMilli(parsed.milli)) return 1;
    return parsed.milli ~/ kMeasurementScale;
  }

  /// Preview line total. Server remains authoritative at checkout.
  double get lineTotal {
    final basePart = calculateLineSubtotal(unitPrice, quantity);
    if (!measurement.isWeighted || fixedModifierTotal == 0) return basePart;
    return agoraToShekels(
      (shekelsToAgora(basePart) ?? 0) + (shekelsToAgora(fixedModifierTotal) ?? 0),
    );
  }

  String get quantityLabel =>
      formatQuantityFromMeasurement(quantity, measurement);

  CartLine copyWith({String? quantity}) {
    return CartLine(
      lineKey: lineKey,
      tenantId: tenantId,
      productId: productId,
      name: name,
      unitPrice: unitPrice,
      merchantUnitPrice: merchantUnitPrice,
      imageUrl: imageUrl,
      quantity: quantity ?? this.quantity,
      measurement: measurement,
      fixedModifierTotal: fixedModifierTotal,
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
        measurement.measurementType,
        measurement.quantityStep,
        measurement.measurementVersion,
        fixedModifierTotal,
        selectedOptions,
        optionGroupsJson
      ];
}

final class CartCubit extends Cubit<List<CartLine>> {
  CartCubit({CartPersistence? persistence})
      : _persistence = persistence ?? CartPersistence(),
        super(const []);

  final CartPersistence _persistence;
  static final _rnd = Random();

  static String _newLineKey() =>
      '${DateTime.now().microsecondsSinceEpoch}-${_rnd.nextInt(1 << 30)}';

  /// Cart badge / subtitle count (PIECE sums qty; WEIGHT/VOLUME count as 1 each).
  int get itemCount => state.fold<int>(0, (s, e) => s + e.badgeUnits);
  String? get activeTenantId => state.isEmpty ? null : state.first.tenantId;

  bool hasDifferentTenant(String tenantId) {
    final active = activeTenantId;
    if (active == null) return false;
    return active != tenantId;
  }

  Future<void> restorePersisted() async {
    final lines = await _persistence.load();
    if (lines.isEmpty) return;
    emit(lines);
  }

  Future<void> _persist() => _persistence.save(state);

  bool _sameLineIdentity(CartLine e, {
    required String tenantId,
    required String productId,
    required ProductMeasurement m,
    required List<CartSelectedOption> selectedOptions,
    required String optionGroupsJson,
    required double fixedModifierTotal,
  }) {
    return e.tenantId == tenantId &&
        e.productId == productId &&
        e.measurement.measurementType == m.measurementType &&
        e.measurement.quantityStep == m.quantityStep &&
        e.measurement.measurementVersion == m.measurementVersion &&
        e.fixedModifierTotal == fixedModifierTotal &&
        cartSelectedOptionsListsEqual(e.selectedOptions, selectedOptions) &&
        e.optionGroupsJson == optionGroupsJson;
  }

  /// Returns null when [qty] is invalid for [m].
  String? _normalizeAcceptedQuantity(ProductMeasurement m, String qty) {
    if (!quantityMatchesStep(m, qty)) return null;
    return parseMeasurementDecimalStrict(qty).normalized;
  }

  void addOrIncrement({
    required String tenantId,
    required String productId,
    required String name,
    required double unitPrice,
    double? merchantUnitPrice,
    required String imageUrl,
    String? addQty,
    ProductMeasurement? measurement,
    double fixedModifierTotal = 0,
    List<CartSelectedOption> selectedOptions = const [],
    String optionGroupsJson = '[]',
  }) {
    final m = measurement ?? defaultPieceMeasurement();
    final qtyRaw = coerceMeasurementDecimalString(
      addQty ?? m.minimumQuantity,
      m.minimumQuantity,
    );
    final qty = _normalizeAcceptedQuantity(m, qtyRaw);
    if (qty == null) return;

    final list = [...state];
    final i = list.indexWhere(
      (e) => _sameLineIdentity(
        e,
        tenantId: tenantId,
        productId: productId,
        m: m,
        selectedOptions: selectedOptions,
        optionGroupsJson: optionGroupsJson,
        fixedModifierTotal: fixedModifierTotal,
      ),
    );
    if (i >= 0) {
      final line = list[i];
      // Weighted + non-zero fixed mods: keep separate lines (mods don't scale).
      if (m.isWeighted && fixedModifierTotal != 0) {
        list.add(
          CartLine(
            lineKey: _newLineKey(),
            tenantId: tenantId,
            productId: productId,
            name: name,
            unitPrice: unitPrice,
            merchantUnitPrice: merchantUnitPrice ?? unitPrice,
            imageUrl: imageUrl,
            quantity: qty,
            measurement: m,
            fixedModifierTotal: fixedModifierTotal,
            selectedOptions: selectedOptions,
            optionGroupsJson: optionGroupsJson,
          ),
        );
      } else {
        final next = addQuantityDecimals(line.quantity, qty);
        final accepted = _normalizeAcceptedQuantity(m, next);
        if (accepted == null) {
          // Exceeds max or step — keep existing line; never silent-round.
          return;
        }
        list[i] = line.copyWith(quantity: accepted);
      }
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
          quantity: qty,
          measurement: m,
          fixedModifierTotal: fixedModifierTotal,
          selectedOptions: selectedOptions,
          optionGroupsJson: optionGroupsJson,
        ),
      );
    }
    emit(list);
    // ignore: unawaited_futures
    _persist();
  }

  void setQuantity(String lineKey, String qty) {
    final list = [...state];
    final i = list.indexWhere((e) => e.lineKey == lineKey);
    if (i < 0) return;
    final line = list[i];
    final parsed = parseMeasurementDecimalStrict(qty);
    if (!parsed.ok || parsed.milli <= 0) {
      removeLine(lineKey);
      return;
    }
    final min = parseMeasurementDecimalStrict(line.measurement.minimumQuantity);
    if (min.ok && parsed.milli < min.milli) {
      removeLine(lineKey);
      return;
    }
    final accepted = _normalizeAcceptedQuantity(line.measurement, parsed.normalized);
    if (accepted == null) {
      // Invalid step/max — keep previous quantity (no silent round).
      return;
    }
    list[i] = line.copyWith(quantity: accepted);
    emit(list);
    // ignore: unawaited_futures
    _persist();
  }

  void removeLine(String lineKey) {
    emit(state.where((e) => e.lineKey != lineKey).toList());
    // ignore: unawaited_futures
    _persist();
  }

  void clear() {
    emit(const []);
    // ignore: unawaited_futures
    _persistence.clear();
  }

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
        measurement: product.measurement,
        fixedModifierTotal: line.fixedModifierTotal,
        selectedOptions: line.selectedOptions,
        optionGroupsJson: line.optionGroupsJson,
      );
    }).toList();
    if (changed) {
      emit(next);
      // ignore: unawaited_futures
      _persist();
    }
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
