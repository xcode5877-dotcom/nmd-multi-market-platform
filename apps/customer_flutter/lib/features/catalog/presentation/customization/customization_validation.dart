import '../../../../api/models/product.dart';

/// Groups with unmet required/min selection rules.
List<ProductOptionGroup> missingRequiredGroups(
  Product product,
  Map<String, Set<String>> selectedByGroup,
) {
  final missing = <ProductOptionGroup>[];
  for (final group in product.optionGroups) {
    if (group.items.isEmpty) continue;
    final selected = selectedByGroup[group.id]?.length ?? 0;
    final min = group.required
        ? (group.minSelected > 0 ? group.minSelected : 1)
        : group.minSelected;
    if (selected < min) {
      missing.add(group);
    }
  }
  return missing;
}

bool isCustomizationComplete(
  Product product,
  Map<String, Set<String>> selectedByGroup,
) {
  return missingRequiredGroups(product, selectedByGroup).isEmpty;
}

int totalSelectedModifierCount(Map<String, Set<String>> selectedByGroup) {
  return selectedByGroup.values.fold<int>(0, (n, set) => n + set.length);
}
