import 'package:flutter_test/flutter_test.dart';

import 'package:customer_flutter/api/models/pizza_placement.dart';
import 'package:customer_flutter/api/models/product.dart';
import 'package:customer_flutter/features/catalog/presentation/customization/customization_pricing.dart';
import 'package:customer_flutter/features/catalog/presentation/customization/customization_validation.dart';
import 'package:customer_flutter/features/catalog/presentation/customization/product_complexity_classifier.dart';
import 'package:customer_flutter/features/catalog/presentation/customization/customization_step_plan.dart';
import 'package:customer_flutter/features/catalog/presentation/customization/product_customization_controller.dart';
import 'package:customer_flutter/features/catalog/presentation/customization/modifier_group_presentation.dart';
import 'package:customer_flutter/features/catalog/presentation/customization/product_customization_tier.dart';

Product _product({
  required List<ProductOptionGroup> groups,
  double base = 10,
  double customer = 12,
}) {
  return Product(
    id: 'p1',
    name: 'Test',
    description: '',
    imageUrl: '',
    categoryId: 'c1',
    basePrice: base,
    displayPrice: customer,
    optionGroups: groups,
    isAvailable: true,
    stockQuantity: 1,
  );
}

ProductOptionGroup _group({
  required String id,
  String? name,
  bool required = false,
  bool allowHalf = false,
  bool single = false,
  int max = 99,
  List<ProductOptionItem>? items,
}) {
  return ProductOptionGroup(
    id: id,
    name: name ?? id,
    required: required,
    selectionType: single ? 'single' : 'multiple',
    minSelected: required ? 1 : 0,
    maxSelected: single ? 1 : max,
    allowSplitting: allowHalf,
    allowHalfPlacement: allowHalf,
    items: items ??
        [
          ProductOptionItem(
            id: '${id}_a',
            name: 'A',
            priceDelta: 4,
            displayPriceDelta: 5,
          ),
          ProductOptionItem(
            id: '${id}_b',
            name: 'B',
            priceDelta: 6,
            displayPriceDelta: 7,
          ),
        ],
  );
}

void main() {
  group('classifyProduct', () {
    test('none when no active groups', () {
      final p = _product(groups: const []);
      expect(classifyProduct(p), ProductCustomizationTier.none);
    });

    test('light for small modifier sets', () {
      final p = _product(groups: [_group(id: 'g1')]);
      expect(classifyProduct(p), ProductCustomizationTier.light);
    });

    test('advanced for half placement with many groups', () {
      final p = _product(
        groups: [
          _group(id: 'toppings', allowHalf: true),
          _group(id: 'size', single: true),
          _group(id: 'extras'),
        ],
      );
      expect(classifyProduct(p), ProductCustomizationTier.advanced);
    });

    test('single half group uses light not advanced stepper', () {
      final p = _product(groups: [_group(id: 'toppings', allowHalf: true)]);
      expect(classifyProduct(p), ProductCustomizationTier.light);
      expect(shouldUseAdvancedStepper(p), isFalse);
    });

    test('standard for many groups', () {
      final p = _product(
        groups: [
          _group(id: 'g1'),
          _group(id: 'g2'),
          _group(id: 'g3'),
        ],
      );
      expect(classifyProduct(p), ProductCustomizationTier.standard);
    });
  });

  group('pricing parity', () {
    test('half-left/right averages pair delta once', () {
      final group = _group(id: 'half', allowHalf: true, max: 2);
      final product = _product(groups: [group]);
      final selected = {
        'half': {'half_a', 'half_b'},
      };
      final placements = {
        'half': {
          'half_a': PizzaPlacement.left,
          'half_b': PizzaPlacement.right,
        },
      };

      expect(
        computeMerchantUnitPrice(product, selected, placements),
        10 + (4 + 6) / 2,
      );
      expect(
        computeCustomerUnitPrice(product, selected, placements),
        12 + (5 + 7) / 2,
      );
    });

    test('controller builds cart payload with placements', () {
      final group = _group(id: 'size', single: true, required: true);
      final product = _product(groups: [group]);
      final controller = ProductCustomizationController(product);
      controller.setGroupSelection('size', {'size_a'});

      final options = controller.buildCartSelectedOptions();
      expect(options, hasLength(1));
      expect(options.first.optionGroupId, 'size');
      expect(options.first.optionItemIds, ['size_a']);
      expect(options.first.optionPlacements['size_a'], PizzaPlacement.whole);
    });
  });

  group('validation', () {
    test('missing required groups', () {
      final product = _product(
        groups: [_group(id: 'size', single: true, required: true)],
      );
      expect(isCustomizationComplete(product, const {}), isFalse);
      expect(
        missingRequiredGroups(product, const {}).map((g) => g.id),
        ['size'],
      );
    });
  });

  group('modifier presentation', () {
    test('maps technical group names to friendly labels', () {
      final group = _group(
        id: 'g1',
        name: 'خيار واحد',
        single: true,
        items: const [
          ProductOptionItem(id: 'i1', name: 'جبنة', priceDelta: 0),
        ],
      );
      expect(
        ModifierGroupPresentationResolver.groupTitle(group),
        isNot('خيار واحد'),
      );
      expect(
        ModifierGroupPresentationResolver.optionalBadge(),
        'لمسة إضافية',
      );
    });
  });
}
