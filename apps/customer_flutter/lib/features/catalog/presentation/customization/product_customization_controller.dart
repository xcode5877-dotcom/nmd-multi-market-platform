import 'package:flutter/foundation.dart';

import '../../../../api/models/pizza_placement.dart';
import '../../../../api/models/product.dart';
import '../../../../features/cart/domain/cart_selected_option.dart';
import 'customization_pricing.dart';
import 'customization_selection_summary.dart';
import 'customization_validation.dart';

/// Holds modifier selection state and derived pricing (no UI).
class ProductCustomizationController extends ChangeNotifier {
  ProductCustomizationController(this.product);

  final Product product;
  int quantity = 1;

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

  double get lineTotal => customerUnitPrice * quantity;

  bool get isComplete =>
      isCustomizationComplete(product, _selectedByGroup);

  List<ProductOptionGroup> get missingRequired =>
      missingRequiredGroups(product, _selectedByGroup);

  int get selectedModifierCount => totalSelectedModifierCount(_selectedByGroup);

  String get summaryLine => customizationSummaryLine(
        product,
        _selectedByGroup,
        _placementByGroup,
      );

  void setQuantity(int value) {
    if (value < 1) return;
    quantity = value;
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
