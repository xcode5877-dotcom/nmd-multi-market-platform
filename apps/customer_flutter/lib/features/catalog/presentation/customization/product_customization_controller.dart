import 'package:flutter/foundation.dart';

import '../../../../api/models/pizza_placement.dart';
import '../../../../api/models/product.dart';
import '../../../../api/models/product_measurement.dart';
import '../../../../features/cart/domain/cart_selected_option.dart';
import 'customization_pricing.dart';
import 'customization_selection_summary.dart';
import 'customization_validation.dart';

/// Holds modifier selection state and derived pricing (no UI).
class ProductCustomizationController extends ChangeNotifier {
  ProductCustomizationController(this.product) {
    initOrderQuantity();
  }

  final Product product;
  double orderQuantity = 1;
  ProductMeasurement? _measurementOverride;

  ProductMeasurement? get effectiveMeasurement =>
      _measurementOverride ?? product.measurement;

  bool get isWeightProduct =>
      effectiveMeasurement?.isWeightProduct == true || product.isWeightProduct;

  /// Piece count for legacy UI; weight products use [orderQuantity] in base units.
  int get quantity => isWeightProduct ? 1 : orderQuantity.round().clamp(1, 99);

  void initOrderQuantity() {
    final m = product.measurement;
    if (m != null && m.isWeightProduct) {
      orderQuantity = m.minimumQuantity > 0 ? m.minimumQuantity : m.quantityStep;
    } else {
      orderQuantity = 1;
    }
  }

  final Map<String, Set<String>> _selectedByGroup = {};
  final Map<String, Map<String, String>> _placementByGroup = {};

  Map<String, Set<String>> get selectedByGroup => Map.unmodifiable(
        _selectedByGroup.map(
          (k, v) => MapEntry(k, Set<String>.from(v)),
        ),
      );

  Map<String, Map<String, String>> get placementByGroup => Map.unmodifiable(
        _placementByGroup.map(
          (k, v) => MapEntry(k, Map<String, String>.from(v)),
        ),
      );

  Set<String> selectedIdsFor(String groupId) =>
      Set<String>.from(_selectedByGroup[groupId] ?? const {});

  Map<String, String> placementsFor(String groupId) =>
      Map<String, String>.from(_placementByGroup[groupId] ?? const {});

  double get customerUnitPrice => computeCustomerUnitPrice(
        product,
        _selectedByGroup,
        _placementByGroup,
      );

  double get merchantUnitPrice => computeMerchantUnitPrice(
        product,
        _selectedByGroup,
        _placementByGroup,
      );

  double get lineTotal => isWeightProduct
      ? customerUnitPrice * orderQuantity
      : customerUnitPrice * orderQuantity;

  bool get isComplete => isCustomizationComplete(product, _selectedByGroup);

  List<ProductOptionGroup> get missingRequired =>
      missingRequiredGroups(product, _selectedByGroup);

  int get selectedModifierCount => totalSelectedModifierCount(_selectedByGroup);

  String get summaryLine => customizationSummaryLine(
        product,
        _selectedByGroup,
        _placementByGroup,
      );

  void setQuantity(int value) {
    if (isWeightProduct) return;
    if (value < 1) return;
    orderQuantity = value.toDouble();
    notifyListeners();
  }

  /// Reconcile quantity after a refreshed measurement payload (same product id).
  void reconcileWithMeasurement(ProductMeasurement? m) {
    _measurementOverride = m;
    if (m != null && m.isWeightProduct) {
      final options = m.selectableQuantities();
      if (options.isEmpty) {
        orderQuantity =
            m.minimumQuantity > 0 ? m.minimumQuantity : m.quantityStep;
      } else {
        final idx =
            options.indexWhere((q) => (q - orderQuantity).abs() < 0.0001);
        orderQuantity = idx >= 0 ? options[idx] : options.first;
      }
    } else {
      orderQuantity = orderQuantity.round().clamp(1, 99).toDouble();
    }
    notifyListeners();
  }

  void setWeightQuantity(double value) {
    final m = effectiveMeasurement;
    if (m == null || !m.isWeightProduct) return;
    final options = m.selectableQuantities();
    final match = options.cast<double?>().firstWhere(
          (q) => q != null && (q - value).abs() < 0.0001,
          orElse: () => null,
        );
    if (match == null) return;
    orderQuantity = match;
    notifyListeners();
  }

  bool get canStepWeightDown {
    final m = effectiveMeasurement;
    if (m == null || !m.isWeightProduct) return false;
    return m.canDecrementFrom(orderQuantity);
  }

  bool get canStepWeightUp {
    final m = effectiveMeasurement;
    if (m == null || !m.isWeightProduct) return false;
    return m.canIncrementFrom(orderQuantity);
  }

  void stepWeightQuantity(int direction) {
    final m = effectiveMeasurement;
    if (m == null || !m.isWeightProduct) return;
    final options = m.selectableQuantities();
    if (options.isEmpty) return;
    final idx = options.indexWhere((q) => (q - orderQuantity).abs() < 0.0001);
    final nextIdx = (idx < 0 ? 0 : idx) + direction;
    if (nextIdx < 0 || nextIdx >= options.length) return;
    orderQuantity = options[nextIdx];
    notifyListeners();
  }

  void setGroupSelection(String groupId, Set<String> next) {
    if (next.isEmpty) {
      _selectedByGroup.remove(groupId);
      _placementByGroup.remove(groupId);
    } else {
      _selectedByGroup[groupId] = Set<String>.from(next);
      final prev = _placementByGroup[groupId] ?? {};
      final pl = <String, String>{};
      for (final id in next) {
        pl[id] = prev[id] ?? PizzaPlacement.defaultPlacement;
      }
      _placementByGroup[groupId] = pl;
    }
    notifyListeners();
  }

  void setItemPlacement(String groupId, String itemId, String placement) {
    final sel = Set<String>.from(_selectedByGroup[groupId] ?? {});
    sel.add(itemId);
    _selectedByGroup[groupId] = sel;
    final pl = Map<String, String>.from(_placementByGroup[groupId] ?? {});
    pl[itemId] = placement.toUpperCase();
    _placementByGroup[groupId] = pl;
    notifyListeners();
  }

  void removeHalfItem(String groupId, String itemId) {
    final sel = Set<String>.from(_selectedByGroup[groupId] ?? {});
    sel.remove(itemId);
    _placementByGroup[groupId]?.remove(itemId);
    if (sel.isEmpty) {
      _selectedByGroup.remove(groupId);
      _placementByGroup.remove(groupId);
    } else {
      _selectedByGroup[groupId] = sel;
    }
    notifyListeners();
  }

  List<CartSelectedOption> buildCartSelectedOptions() {
    final out = <CartSelectedOption>[];
    for (final group in product.optionGroups) {
      final ids = _selectedByGroup[group.id];
      if (ids == null || ids.isEmpty) continue;
      final pl = <String, String>{};
      for (final id in ids) {
        pl[id] = (_placementByGroup[group.id]?[id] ??
                PizzaPlacement.defaultPlacement)
            .toUpperCase();
      }
      final half = productGroupHasHalfOptions(group);
      out.add(
        CartSelectedOption(
          optionGroupId: group.id,
          optionItemIds: ids.toList(),
          sliceSelection: half ? PizzaPlacement.defaultPlacement : null,
          optionPlacements: pl,
        ),
      );
    }
    return out;
  }
}
