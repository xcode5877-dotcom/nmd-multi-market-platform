import '../../../../api/models/product.dart';
import 'product_customization_tier.dart';

List<ProductOptionGroup> activeOptionGroups(Product product) {
  return product.optionGroups.where((g) => g.items.isNotEmpty).toList();
}

ProductCustomizationTier classifyProduct(Product product) {
  final groups = activeOptionGroups(product);
  if (groups.isEmpty) return ProductCustomizationTier.none;

  final totalItems = groups.fold<int>(0, (n, g) => n + g.items.length);
  final hasHalf = groups.any(productGroupHasHalfOptions);
  final requiredCount = groups.where((g) => g.required).length;

  // Single group never uses advanced stepper — inline/accordion instead.
  if (groups.length <= 1) {
    return ProductCustomizationTier.light;
  }

  if (hasHalf || groups.length >= 5 || totalItems >= 20) {
    return ProductCustomizationTier.advanced;
  }
  if (groups.length >= 3 || totalItems >= 10 || requiredCount >= 2) {
    return ProductCustomizationTier.standard;
  }
  return ProductCustomizationTier.light;
}

bool productHasOrderModifiers(Product product) {
  return activeOptionGroups(product).isNotEmpty;
}
