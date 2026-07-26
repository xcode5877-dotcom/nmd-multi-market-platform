import 'package:flutter_test/flutter_test.dart';

import 'package:customer_flutter/api/models/product.dart';
import 'package:customer_flutter/features/cart/application/cart_cubit.dart';
import 'package:customer_flutter/features/cart/data/cart_persistence.dart';
import 'package:customer_flutter/measurement/measurement.dart';

CartCubit _cart() =>
    CartCubit(persistence: CartPersistence(store: MemoryCartStore()));

void main() {
  group('formatQuantity', () {
    test('formats 0.5 kg as 500 g without float residue', () {
      final s = formatQuantity(
        quantityBase: '0.5',
        baseUnitCode: 'kg',
        displayUnitCode: 'g',
      );
      expect(s, '500 غرام');
    });

    test('never shows 0.5 kg as 0 or 1 with precision 0', () {
      final s = formatQuantity(
        quantityBase: '0.5',
        baseUnitCode: 'kg',
        displayUnitCode: 'kg',
        displayPrecision: 0,
      );
      expect(s.contains('0.5'), isTrue);
      expect(s.startsWith('0 '), isFalse);
      expect(s.startsWith('1 '), isFalse);
    });

    test('0.333 not truncated to 0.33', () {
      final s = formatQuantity(
        quantityBase: '0.333',
        baseUnitCode: 'kg',
        displayUnitCode: 'kg',
        displayPrecision: 2,
      );
      expect(s.contains('0.333'), isTrue);
    });
  });

  group('pricing preview', () {
    test('40 × 0.25 = 10', () {
      expect(calculateLineSubtotal(40, '0.25'), 10);
    });
    test('40 × 0.5 = 20', () {
      expect(calculateLineSubtotal(40, '0.5'), 20);
    });
    test('12 × 0.5 = 6', () {
      expect(calculateLineSubtotal(12, '0.5'), 6);
    });
  });

  group('quantity options', () {
    test('WEIGHT chips follow server step', () {
      const m = ProductMeasurement(
        measurementType: measurementTypeWeight,
        baseUnitCode: 'kg',
        displayUnitCode: 'g',
        quantityStep: '0.25',
        minimumQuantity: '0.25',
      );
      final opts = buildQuantityOptions(m);
      expect(opts.first, '0.25');
      expect(opts.contains('0.5'), isTrue);
      expect(opts.contains('1'), isTrue);
      expect(quantityMatchesStep(m, '0.25'), isTrue);
      expect(quantityMatchesStep(m, '0.3'), isFalse);
    });
  });

  group('Product model', () {
    test('parses Measurement V2 fields without inference', () {
      final p = Product.fromJson({
        'id': 'w1',
        'name': 'لحم',
        'categoryId': 'c',
        'basePrice': 40,
        'measurementType': 'WEIGHT',
        'baseUnitCode': 'kg',
        'displayUnitCode': 'g',
        'quantityStep': '0.25',
        'minimumQuantity': '0.25',
        'priceBasis': 'PER_BASE_UNIT',
        'measurementVersion': 1,
        'optionGroups': [],
      });
      expect(p.measurementType, 'WEIGHT');
      expect(p.baseUnitCode, 'kg');
      expect(p.displayUnitCode, 'g');
      expect(p.quantityStep, '0.25');
      expect(p.minimumQuantity, '0.25');
      expect(priceUnitSuffixAr(p.measurementType), 'كغم');
    });

    test('legacy PIECE defaults', () {
      final p = Product.fromJson({
        'id': 'p1',
        'name': 'حليب',
        'categoryId': 'c',
        'basePrice': 8,
        'optionGroups': [],
      });
      expect(p.measurementType, 'PIECE');
      expect(p.quantityStep, '1');
    });
  });

  group('Cart', () {
    test('stores decimal quantity and formats label', () {
      final cubit = _cart();
      const m = ProductMeasurement(
        measurementType: measurementTypeWeight,
        baseUnitCode: 'kg',
        displayUnitCode: 'g',
        quantityStep: '0.25',
        minimumQuantity: '0.25',
      );
      cubit.addOrIncrement(
        tenantId: 't',
        productId: 'w',
        name: 'لحم',
        unitPrice: 40,
        merchantUnitPrice: 40,
        imageUrl: '',
        addQty: '0.5',
        measurement: m,
      );
      expect(cubit.state.single.quantity, '0.5');
      expect(cubit.state.single.quantityLabel, '500 غرام');
      expect(cubit.state.single.lineTotal, 20);
      expect(cubit.itemCount, 1);
    });

    test('PIECE badge sums quantity', () {
      final cubit = _cart();
      cubit.addOrIncrement(
        tenantId: 't',
        productId: 'p',
        name: 'حليب',
        unitPrice: 8,
        imageUrl: '',
        addQty: '2',
      );
      expect(cubit.itemCount, 2);
      expect(cubit.state.single.quantityLabel.contains('حبة'), isTrue);
    });
  });

  group('Reorder gate', () {
    test('blocks when measurementVersion changes', () {
      final check = evaluateReorderLine(
        orderItem: {
          'productId': 'w',
          'quantityDecimal': '0.5',
          'measurementTypeSnapshot': 'WEIGHT',
          'baseUnitCodeSnapshot': 'kg',
          'displayUnitCodeSnapshot': 'g',
          'quantityStepSnapshot': '0.25',
          'minimumQuantitySnapshot': '0.25',
          'measurementVersionSnapshot': 1,
        },
        currentCatalogMeasurement: const ProductMeasurement(
          measurementType: measurementTypeWeight,
          baseUnitCode: 'kg',
          displayUnitCode: 'g',
          quantityStep: '0.25',
          minimumQuantity: '0.25',
          measurementVersion: 2,
        ),
      );
      expect(check.blocked, isTrue);
      expect(check.messageAr, kReorderConfigChangedAr);
    });

    test('allows matching snapshot', () {
      const m = ProductMeasurement(
        measurementType: measurementTypeWeight,
        baseUnitCode: 'kg',
        displayUnitCode: 'g',
        quantityStep: '0.25',
        minimumQuantity: '0.25',
        measurementVersion: 1,
      );
      final check = evaluateReorderLine(
        orderItem: {
          'productId': 'w',
          'quantityDecimal': '0.5',
          'measurementTypeSnapshot': 'WEIGHT',
          'baseUnitCodeSnapshot': 'kg',
          'displayUnitCodeSnapshot': 'g',
          'quantityStepSnapshot': '0.25',
          'minimumQuantitySnapshot': '0.25',
          'measurementVersionSnapshot': 1,
        },
        currentCatalogMeasurement: m,
      );
      expect(check.blocked, isFalse);
      expect(check.quantity, '0.5');
    });
  });
}
