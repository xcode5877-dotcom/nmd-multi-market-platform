import 'package:flutter/foundation.dart';

import '../../../../api/models/product.dart';
import 'product_complexity_classifier.dart';
import 'product_customization_tier.dart';
import 'product_customization_controller.dart';

enum CustomizationStepKind { groups, placement, review }

class CustomizationStepDefinition {
  const CustomizationStepDefinition({
    required this.kind,
    required this.title,
    this.groups = const [],
  });

  final CustomizationStepKind kind;
  final String title;
  final List<ProductOptionGroup> groups;
}

/// Dynamic step list — empty buckets are never included.
class CustomizationStepPlan {
  const CustomizationStepPlan({
    required this.groupSteps,
    required this.halfCapableGroups,
  });

  final List<CustomizationStepDefinition> groupSteps;
  final List<ProductOptionGroup> halfCapableGroups;

  static const placementStep = CustomizationStepDefinition(
    kind: CustomizationStepKind.placement,
    title: 'نصفين بطريقتك',
  );

  static const reviewStep = CustomizationStepDefinition(
    kind: CustomizationStepKind.review,
    title: 'مراجعة الطلب',
  );

  bool get shouldUseStepper =>
      groupSteps.length >= 2 ||
      (halfCapableGroups.isNotEmpty && groupSteps.isNotEmpty);

  List<CustomizationStepDefinition> resolveSteps(
    ProductCustomizationController controller,
  ) {
    final steps = <CustomizationStepDefinition>[...groupSteps];
    if (needsPlacementStep(controller)) {
      steps.add(placementStep);
    }
    steps.add(reviewStep);
    return steps;
  }

  bool needsPlacementStep(ProductCustomizationController controller) {
    for (final group in halfCapableGroups) {
      for (final id in controller.selectedIdsFor(group.id)) {
        ProductOptionItem? item;
        for (final i in group.items) {
          if (i.id == id) {
            item = i;
            break;
          }
        }
        if (item != null && productOptionSupportsHalf(item, group)) {
          return true;
        }
      }
    }
    return false;
  }
}

CustomizationStepPlan planCustomizationSteps(Product product) {
  final groups = activeOptionGroups(product);
  final assigned = <String>{};
  final sizeGroups = <ProductOptionGroup>[];
  final toppingGroups = <ProductOptionGroup>[];
  final extrasGroups = <ProductOptionGroup>[];

  for (final group in groups) {
    final name = group.name.toLowerCase();
    final isSizeLike = group.isSingle &&
        (group.required ||
            name.contains('حجم') ||
            name.contains('size') ||
            name.contains('عجين') ||
            name.contains('crust'));
    if (isSizeLike) {
      sizeGroups.add(group);
      assigned.add(group.id);
    }
  }

  for (final group in groups) {
    if (assigned.contains(group.id)) continue;
    if (productGroupHasHalfOptions(group) || group.items.length >= 6) {
      toppingGroups.add(group);
      assigned.add(group.id);
    }
  }

  for (final group in groups) {
    if (!assigned.contains(group.id)) {
      extrasGroups.add(group);
    }
  }

  if (sizeGroups.isEmpty && groups.isNotEmpty && groups.first.isSingle) {
    final first = groups.first;
    sizeGroups.add(first);
    toppingGroups.removeWhere((g) => g.id == first.id);
    extrasGroups.removeWhere((g) => g.id == first.id);
  }

  final groupSteps = <CustomizationStepDefinition>[];
  if (sizeGroups.isNotEmpty) {
    groupSteps.add(
      CustomizationStepDefinition(
        kind: CustomizationStepKind.groups,
        title: _titleForBucket(sizeGroups, 'الحجم والعجين'),
        groups: sizeGroups,
      ),
    );
  }
  if (toppingGroups.isNotEmpty) {
    groupSteps.add(
      CustomizationStepDefinition(
        kind: CustomizationStepKind.groups,
        title: _titleForBucket(toppingGroups, 'الإضافات الرئيسية'),
        groups: toppingGroups,
      ),
    );
  }
  if (extrasGroups.isNotEmpty) {
    groupSteps.add(
      CustomizationStepDefinition(
        kind: CustomizationStepKind.groups,
        title: _titleForBucket(extrasGroups, 'صلصات ومشروبات'),
        groups: extrasGroups,
      ),
    );
  }

  if (groupSteps.isEmpty && groups.isNotEmpty) {
    groupSteps.add(
      CustomizationStepDefinition(
        kind: CustomizationStepKind.groups,
        title: _titleForBucket(groups, 'اختر الخيارات'),
        groups: groups,
      ),
    );
  }

  final halfCapable = groups.where(productGroupHasHalfOptions).toList();

  return CustomizationStepPlan(
    groupSteps: groupSteps,
    halfCapableGroups: halfCapable,
  );
}

String _titleForBucket(List<ProductOptionGroup> groups, String fallback) {
  if (groups.length == 1) return groups.first.name;
  return fallback;
}

/// Dev-only trace for tier + step buckets.
void logCustomizationPlan(
  Product product,
  String tierLabel,
  CustomizationStepPlan plan,
) {
  assert(() {
    final buckets = plan.groupSteps
        .map(
          (s) =>
              '${s.title}[${s.groups.map((g) => g.name).join(', ')}]',
        )
        .join(' | ');
    debugPrint(
      '[NMD customization] product=${product.id} tier=$tierLabel '
      'groupSteps=${plan.groupSteps.length} halfGroups=${plan.halfCapableGroups.length} '
      'buckets=$buckets stepper=${plan.shouldUseStepper}',
    );
    return true;
  }());
}

bool shouldUseAdvancedStepper(Product product) {
  final groups = activeOptionGroups(product);
  if (groups.length <= 1) return false;
  final plan = planCustomizationSteps(product);
  return plan.shouldUseStepper && plan.groupSteps.length >= 2;
}

ProductCustomizationTier effectiveCustomizationTier(Product product) {
  final tier = classifyProduct(product);
  if (tier != ProductCustomizationTier.advanced) return tier;
  if (!shouldUseAdvancedStepper(product)) {
    final groups = activeOptionGroups(product);
    if (groups.isEmpty) return ProductCustomizationTier.none;
    if (groups.length <= 2 &&
        groups.fold<int>(0, (n, g) => n + g.items.length) < 10) {
      return ProductCustomizationTier.light;
    }
    return ProductCustomizationTier.standard;
  }
  return tier;
}
