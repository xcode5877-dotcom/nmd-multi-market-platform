import 'package:flutter_test/flutter_test.dart';

import 'package:customer_flutter/api/models/pizza_placement.dart';
import 'package:customer_flutter/features/catalog/presentation/customization/pizza_topping_positioner.dart';
import 'package:customer_flutter/features/catalog/presentation/customization/pizza_topping_visual_resolver.dart';

void main() {
  const pizzaSize = 148.0;

  PizzaToppingLayoutItem item({
    required String name,
    required String placement,
    PizzaToppingVisualCategory category = PizzaToppingVisualCategory.olive,
  }) {
    return PizzaToppingLayoutItem(
      modifierKey: name,
      modifierName: name,
      placement: placement,
      category: category,
    );
  }

  group('PizzaToppingPositioner organic samples', () {
    test('whole samples inside circle', () {
      final samples = PizzaToppingPositioner.sampleRing(
        placement: PizzaPlacement.whole,
        seed: 7,
      );
      expect(samples, isNotEmpty);
      for (final p in samples) {
        expect(PizzaToppingPositioner.isInsideCircle(p), isTrue);
      }
    });

    test('left samples on left half', () {
      final samples = PizzaToppingPositioner.sampleRing(
        placement: PizzaPlacement.left,
        seed: 3,
      );
      for (final p in samples) {
        expect(PizzaToppingPositioner.isOnLeftHalf(p), isTrue);
      }
    });

    test('right samples on right half', () {
      final samples = PizzaToppingPositioner.sampleRing(
        placement: PizzaPlacement.right,
        seed: 5,
      );
      for (final p in samples) {
        expect(PizzaToppingPositioner.isOnRightHalf(p), isTrue);
      }
    });
  });

  group('PizzaToppingPositioner.layoutScene', () {
    test('returns glyphs with adaptive size range', () {
      final items = [
        item(name: 'زيتون', placement: PizzaPlacement.whole),
        item(name: 'فطر', placement: PizzaPlacement.left),
      ];
      final glyphs = PizzaToppingPositioner.layoutScene(
        pizzaSize: pizzaSize,
        items: items,
        groupName: null,
        visualFor: (i) => PizzaToppingVisualResolver.resolve(
          modifierName: i.modifierName,
          placement: i.placement,
        ),
      );
      expect(glyphs, isNotEmpty);
      for (final g in glyphs) {
        expect(g.size, inInclusiveRange(14.0, 22.0));
        expect(g.rotationRadians, isNotNull);
        expect(g.scaleFactor, inInclusiveRange(0.88, 1.01));
      }
    });

    test('left glyphs clustered left', () {
      final items = [item(name: 'pepper', placement: PizzaPlacement.left)];
      final glyphs = PizzaToppingPositioner.layoutScene(
        pizzaSize: pizzaSize,
        items: items,
        groupName: null,
        visualFor: (i) => PizzaToppingVisualResolver.resolve(
          modifierName: i.modifierName,
          placement: i.placement,
        ),
      );
      final avgX = glyphs.map((g) => g.position.dx).reduce((a, b) => a + b) /
          glyphs.length;
      expect(avgX, lessThan(pizzaSize * 0.52));
    });

    test('whole glyphs span both sides', () {
      final items = [item(name: 'corn', placement: PizzaPlacement.whole)];
      final glyphs = PizzaToppingPositioner.layoutScene(
        pizzaSize: pizzaSize,
        items: items,
        groupName: null,
        visualFor: (i) => PizzaToppingVisualResolver.resolve(
          modifierName: i.modifierName,
          placement: i.placement,
        ),
      );
      expect(glyphs.length, greaterThanOrEqualTo(2));
      final centerXs = glyphs
          .map((g) => g.position.dx + g.size / 2)
          .toList();
      expect(centerXs.any((x) => x < pizzaSize * 0.5), isTrue);
      expect(centerXs.any((x) => x > pizzaSize * 0.5), isTrue);
    });

    test('deterministic cached layout', () {
      final items = [
        item(name: 'tuna', placement: PizzaPlacement.whole),
        item(name: 'cheese', placement: PizzaPlacement.right),
      ];
      final a = PizzaToppingPositioner.layoutScene(
        pizzaSize: pizzaSize,
        items: items,
        groupName: 'g',
        visualFor: (i) => PizzaToppingVisualResolver.resolve(
          modifierName: i.modifierName,
          placement: i.placement,
        ),
      );
      final b = PizzaToppingPositioner.layoutScene(
        pizzaSize: pizzaSize,
        items: items,
        groupName: 'g',
        visualFor: (i) => PizzaToppingVisualResolver.resolve(
          modifierName: i.modifierName,
          placement: i.placement,
        ),
      );
      expect(a.map((g) => g.position), equals(b.map((g) => g.position)));
    });

    test('unknown category still lays out safely', () {
      final glyphs = PizzaToppingPositioner.layoutScene(
        pizzaSize: pizzaSize,
        items: [
          item(
            name: 'unknown xyz',
            placement: PizzaPlacement.whole,
            category: PizzaToppingVisualCategory.fallback,
          ),
        ],
        groupName: null,
        visualFor: (i) => PizzaToppingVisualResolver.resolve(
          modifierName: i.modifierName,
          placement: i.placement,
        ),
      );
      expect(glyphs, isNotEmpty);
    });
  });

  group('PizzaToppingVisualResolver assets', () {
    test('returns asset path per category', () {
      final v = PizzaToppingVisualResolver.resolve(modifierName: 'زيتون');
      expect(v.assetPath, 'assets/images/pizza_builder/toppings/olive.png');
      expect(v.emojiFallback, isNotEmpty);
    });

    test('icon size stays within premium bounds', () {
      expect(
        PizzaToppingPositioner.iconSizeFor(totalIconCount: 8, localIndex: 0),
        lessThanOrEqualTo(22),
      );
      expect(
        PizzaToppingPositioner.iconSizeFor(totalIconCount: 30, localIndex: 0),
        greaterThanOrEqualTo(14),
      );
    });
  });
}
