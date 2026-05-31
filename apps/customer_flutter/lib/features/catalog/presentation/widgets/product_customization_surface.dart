import 'package:flutter/material.dart';

import '../../../../api/models/product.dart';
import '../customization/customization_step_plan.dart';
import '../customization/product_complexity_classifier.dart';
import '../customization/product_customization_controller.dart';
import '../customization/product_customization_tier.dart';
import '../customization/widgets/customization_stepper_sheet.dart';
import 'food_first_customization_panel.dart';

/// Tier-aware food-first customization surface.
class ProductCustomizationSurface extends StatelessWidget {
  const ProductCustomizationSurface({
    super.key,
    required this.product,
    required this.controller,
    required this.tier,
    required this.onOpenAdvancedBuilder,
    required this.onAddToCart,
    required this.storeClosed,
  });

  final Product product;
  final ProductCustomizationController controller;
  final ProductCustomizationTier tier;
  final VoidCallback onOpenAdvancedBuilder;
  final VoidCallback onAddToCart;
  final bool storeClosed;

  @override
  Widget build(BuildContext context) {
    final groups = activeOptionGroups(product);
    if (groups.isEmpty) return const SizedBox.shrink();

    final effectiveTier = effectiveCustomizationTier(product);
    logCustomizationPlan(
      product,
      effectiveTier.name,
      planCustomizationSteps(product),
    );

    return FoodFirstCustomizationPanel(
      product: product,
      controller: controller,
      tier: effectiveTier,
      onOpenAdvancedBuilder: onOpenAdvancedBuilder,
    );
  }
}

void openAdvancedCustomizationSheet(
  BuildContext context, {
  required Product product,
  required ProductCustomizationController controller,
  required VoidCallback onAddToCart,
  required bool storeClosed,
}) {
  CustomizationStepperSheet.show(
    context,
    product: product,
    controller: controller,
    onAddToCart: onAddToCart,
    storeClosed: storeClosed,
  );
}
