import '../../../../api/models/pizza_placement.dart';
import '../../../../api/models/product.dart';

/// Merchant-side unit price with modifiers (unchanged business logic).
double computeMerchantUnitPrice(
  Product product,
  Map<String, Set<String>> selectedByGroup,
  Map<String, Map<String, String>> placementByGroup,
) {
  var total = product.basePrice;
  for (final group in product.optionGroups) {
    final selected = selectedByGroup[group.id];
    if (selected == null || selected.isEmpty) continue;
    final placements = placementByGroup[group.id] ?? {};

    if ((group.allowHalfPlacement || group.allowSplitting) &&
        selected.length == 2) {
      String? leftId;
      String? rightId;
      for (final id in selected) {
        final p =
            (placements[id] ?? PizzaPlacement.defaultPlacement).toUpperCase();
        if (p == PizzaPlacement.left) leftId = id;
        if (p == PizzaPlacement.right) rightId = id;
      }
      if (leftId != null && rightId != null) {
        ProductOptionItem? i1;
        ProductOptionItem? i2;
        for (final i in group.items) {
          if (i.id == leftId) i1 = i;
          if (i.id == rightId) i2 = i;
        }
        if (i1 != null && i2 != null) {
          total += (i1.priceDelta + i2.priceDelta) / 2;
          continue;
        }
      }
    }

    for (final itemId in selected) {
      ProductOptionItem? found;
      for (final i in group.items) {
        if (i.id == itemId) {
          found = i;
          break;
        }
      }
      if (found == null) continue;
      final p = (placements[itemId] ?? PizzaPlacement.defaultPlacement)
          .toUpperCase();
      final delta = found.priceDelta;
      if (p == PizzaPlacement.left || p == PizzaPlacement.right) {
        total += delta / 2;
      } else {
        total += delta;
      }
    }
  }
  return total;
}

/// Customer-visible unit price with modifiers (unchanged business logic).
double computeCustomerUnitPrice(
  Product product,
  Map<String, Set<String>> selectedByGroup,
  Map<String, Map<String, String>> placementByGroup,
) {
  var total = product.customerListPrice;
  for (final group in product.optionGroups) {
    final selected = selectedByGroup[group.id];
    if (selected == null || selected.isEmpty) continue;
    final placements = placementByGroup[group.id] ?? {};

    if ((group.allowHalfPlacement || group.allowSplitting) &&
        selected.length == 2) {
      String? leftId;
      String? rightId;
      for (final id in selected) {
        final p =
            (placements[id] ?? PizzaPlacement.defaultPlacement).toUpperCase();
        if (p == PizzaPlacement.left) leftId = id;
        if (p == PizzaPlacement.right) rightId = id;
      }
      if (leftId != null && rightId != null) {
        ProductOptionItem? i1;
        ProductOptionItem? i2;
        for (final i in group.items) {
          if (i.id == leftId) i1 = i;
          if (i.id == rightId) i2 = i;
        }
        if (i1 != null && i2 != null) {
          total += (i1.customerPriceDelta + i2.customerPriceDelta) / 2;
          continue;
        }
      }
    }

    for (final itemId in selected) {
      ProductOptionItem? found;
      for (final i in group.items) {
        if (i.id == itemId) {
          found = i;
          break;
        }
      }
      if (found == null) continue;
      final p = (placements[itemId] ?? PizzaPlacement.defaultPlacement)
          .toUpperCase();
      final delta = found.customerPriceDelta;
      if (p == PizzaPlacement.left || p == PizzaPlacement.right) {
        total += delta / 2;
      } else {
        total += delta;
      }
    }
  }
  return total;
}
