import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:customer_flutter/features/catalog/presentation/customization/pizza_topping_visual_resolver.dart';

void main() {
  group('PizzaToppingVisualResolver.normalize', () {
    test('handles null and empty', () {
      expect(PizzaToppingVisualResolver.normalize(null), '');
      expect(PizzaToppingVisualResolver.normalize('   '), '');
    });

    test('lowercases and trims', () {
      expect(PizzaToppingVisualResolver.normalize('  Olive  '), 'olive');
    });

    test('strips Arabic diacritics', () {
      expect(
        PizzaToppingVisualResolver.normalize('زِيتُون'),
        'زيتون',
      );
    });

    test('normalizes Arabic alef variants', () {
      expect(
        PizzaToppingVisualResolver.normalize('إضافة'),
        'اضافه',
      );
    });
  });

  group('PizzaToppingVisualResolver.resolve', () {
    test('maps olive variants', () {
      for (final name in ['زيتون', 'زيتون اسود', 'olive', 'olives', 'זיתים']) {
        final v = PizzaToppingVisualResolver.resolve(modifierName: name);
        expect(v.category, PizzaToppingVisualCategory.olive);
        expect(v.emojiFallback, '🫒');
        expect(v.assetPath, contains('toppings/olive.png'));
      }
    });

    test('maps mushroom variants', () {
      for (final name in ['فطر', 'مشروم', 'mushroom', 'פטריות']) {
        final v = PizzaToppingVisualResolver.resolve(modifierName: name);
        expect(v.category, PizzaToppingVisualCategory.mushroom);
      }
    });

    test('maps corn, onion, pepper', () {
      expect(
        PizzaToppingVisualResolver.resolve(modifierName: 'ذرة').category,
        PizzaToppingVisualCategory.corn,
      );
      expect(
        PizzaToppingVisualResolver.resolve(modifierName: 'corn').category,
        PizzaToppingVisualCategory.corn,
      );
      expect(
        PizzaToppingVisualResolver.resolve(modifierName: 'בצל').category,
        PizzaToppingVisualCategory.onion,
      );
      expect(
        PizzaToppingVisualResolver.resolve(modifierName: 'فلفل حار').category,
        PizzaToppingVisualCategory.pepper,
      );
    });

    test('maps cheese and meat', () {
      expect(
        PizzaToppingVisualResolver.resolve(modifierName: 'جبنة').category,
        PizzaToppingVisualCategory.cheese,
      );
      expect(
        PizzaToppingVisualResolver.resolve(modifierName: 'mozzarella').category,
        PizzaToppingVisualCategory.cheese,
      );
      expect(
        PizzaToppingVisualResolver.resolve(modifierName: 'גבינה').category,
        PizzaToppingVisualCategory.cheese,
      );
      expect(
        PizzaToppingVisualResolver.resolve(modifierName: 'كفتة').category,
        PizzaToppingVisualCategory.meat,
      );
      expect(
        PizzaToppingVisualResolver.resolve(modifierName: 'beef').category,
        PizzaToppingVisualCategory.meat,
      );
    });

    test('maps chicken, tuna, sauce', () {
      expect(
        PizzaToppingVisualResolver.resolve(modifierName: 'دجاج').category,
        PizzaToppingVisualCategory.chicken,
      );
      expect(
        PizzaToppingVisualResolver.resolve(modifierName: 'שווארמה').category,
        PizzaToppingVisualCategory.chicken,
      );
      expect(
        PizzaToppingVisualResolver.resolve(modifierName: 'tuna').category,
        PizzaToppingVisualCategory.tuna,
      );
      expect(
        PizzaToppingVisualResolver.resolve(modifierName: 'טונה').category,
        PizzaToppingVisualCategory.tuna,
      );
      expect(
        PizzaToppingVisualResolver.resolve(modifierName: 'ثوم').category,
        PizzaToppingVisualCategory.sauce,
      );
      expect(
        PizzaToppingVisualResolver.resolve(modifierName: 'ranch').category,
        PizzaToppingVisualCategory.sauce,
      );
    });

    test('maps vegetable group hint', () {
      expect(
        PizzaToppingVisualResolver.resolve(
          modifierName: 'طماطم',
          groupName: 'خضار',
        ).category,
        PizzaToppingVisualCategory.vegetable,
      );
    });

    test('unknown modifier returns default fallback', () {
      final v = PizzaToppingVisualResolver.resolve(modifierName: 'XYZ_UNKNOWN_999');
      expect(v.category, PizzaToppingVisualCategory.fallback);
      expect(v.categorySlug, 'default');
      expect(v.emojiFallback, '➕');
      expect(v.displayLabel, 'XYZ_UNKNOWN_999');
    });

    test('null name uses group name and still resolves', () {
      final v = PizzaToppingVisualResolver.resolve(groupName: 'زيتون');
      expect(v.category, PizzaToppingVisualCategory.olive);
      expect(v.displayLabel, 'زيتون');
    });

    test('placement suffix on display label', () {
      final v = PizzaToppingVisualResolver.resolve(
        modifierName: 'فطر',
        placement: 'LEFT',
      );
      expect(v.displayLabel, contains('يسار'));
    });

    test('never throws on empty input', () {
      expect(
        () => PizzaToppingVisualResolver.resolve(),
        returnsNormally,
      );
      final v = PizzaToppingVisualResolver.resolve();
      expect(v.category, PizzaToppingVisualCategory.fallback);
    });
  });
}
