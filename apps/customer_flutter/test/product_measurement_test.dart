import 'package:flutter_test/flutter_test.dart';

import 'package:customer_flutter/api/models/product.dart';
import 'package:customer_flutter/api/models/product_measurement.dart';
import 'package:customer_flutter/features/cart/application/cart_cubit.dart';
import 'package:customer_flutter/features/catalog/presentation/customization/product_customization_controller.dart';

const _qaProductJson = {
  'id': 'meas-pilot-qa-weight-250-500-1kg',
  'name': 'QA Weight Steps 250g/500g/1kg',
  'categoryId': 'meas-pilot-private-cat',
  'basePrice': 100,
  'displayPrice': 100,
  'imageUrl': '',
  'optionGroups': [],
  'measurementType': 'WEIGHT',
  'baseUnitCode': 'kg',
  'displayUnitCode': 'g',
  'quantityStep': '0.25',
  'minimumQuantity': '0.25',
  'maximumQuantity': '1',
  'priceBasis': 'PER_BASE_UNIT',
  'measurementVersion': 1,
  'displayPrecision': 0,
  'isWeightBased': true,
  'unitName': 'غرام',
};

Map<String, dynamic> _weightJson({
  String step = '0.25',
  String min = '0.25',
  Object? max = '1',
  String display = 'g',
}) {
  return {
    ..._qaProductJson,
    'quantityStep': step,
    'minimumQuantity': min,
    'maximumQuantity': max,
    'displayUnitCode': display,
  };
}

void main() {
  group('ProductMeasurement', () {
    test('parses QA weight product fields', () {
      final m = ProductMeasurement.fromProductJson(_qaProductJson)!;
      expect(m.measurementType, 'WEIGHT');
      expect(m.baseUnitCode, 'kg');
      expect(m.displayUnitCode, 'g');
      expect(m.quantityStep, 0.25);
      expect(m.minimumQuantity, 0.25);
      expect(m.maximumQuantity, 1);
      expect(m.isWeightProduct, isTrue);
    });

    test('selectable quantities are 250g–1000g', () {
      final m = ProductMeasurement.fromProductJson(_qaProductJson)!;
      final options = m.selectableQuantities();
      expect(options, [0.25, 0.5, 0.75, 1.0]);
      expect(
        options.map(m.formatQuantityLabel).toList(),
        ['250 غرام', '500 غرام', '750 غرام', '1000 غرام'],
      );
    });

    test('half-kilo step sequence 0.50 → 1.00 → 1.50 → 2.00', () {
      final m = ProductMeasurement.fromProductJson(
        _weightJson(step: '0.5', min: '0.5', max: '2', display: 'kg'),
      )!;
      expect(m.selectableQuantities(), [0.5, 1.0, 1.5, 2.0]);
    });

    test('null maximumQuantity (legacy) exposes only minimum', () {
      final m = ProductMeasurement.fromProductJson(
        _weightJson(step: '0.5', min: '0.5', max: null),
      )!;
      final options = m.selectableQuantities();
      expect(options, [0.5]);
      expect(m.canDecrementFrom(0.5), isFalse);
      expect(m.canIncrementFrom(0.5), isFalse);
    });

    test('decimal-safe options for 0.1 step through 1.5', () {
      final m = ProductMeasurement.fromProductJson(
        _weightJson(step: '0.1', min: '0.1', max: '1.5', display: 'kg'),
      )!;
      final options = m.selectableQuantities();
      expect(options.first, 0.1);
      expect(options.contains(0.5), isTrue);
      expect(options.contains(1.0), isTrue);
      expect(options.contains(1.5), isTrue);
      // No float duplicates / drift past max
      expect(options.toSet().length, options.length);
      expect(options.every((q) => q <= 1.5 + 1e-12), isTrue);
      // Milli-safe: 0.1+0.1+… never yields 0.30000000004-style ghosts
      expect(options[2], 0.3);
    });

    test('0.25 / 0.5 / 1.0 / 1.5 preserve exact decimal identity', () {
      final m = ProductMeasurement.fromProductJson(
        _weightJson(step: '0.25', min: '0.25', max: '1.5', display: 'kg'),
      )!;
      expect(m.selectableQuantities(), [0.25, 0.5, 0.75, 1.0, 1.25, 1.5]);
    });

    test('Arabic unitName does not change submitted base quantity', () {
      final m = ProductMeasurement.fromProductJson(_qaProductJson)!;
      expect(m.unitName, 'غرام');
      expect(m.selectableQuantities().first, 0.25);
      expect(m.formatQuantityLabel(0.25), '250 غرام');
    });

    test('invalid / zero step falls back safely', () {
      final m = ProductMeasurement.fromProductJson({
        ..._qaProductJson,
        'quantityStep': '0',
        'minimumQuantity': '0.25',
        'maximumQuantity': '1',
      })!;
      // Parser replaces non-positive step with 0.25 default.
      expect(m.quantityStep, 0.25);
      expect(m.selectableQuantities().isNotEmpty, isTrue);
    });

    test('duplicate-looking float steps stay unique via milli rounding', () {
      final m = ProductMeasurement.fromProductJson(
        _weightJson(step: '0.25', min: '0.25', max: '1'),
      )!;
      final options = m.selectableQuantities();
      expect(options.toSet().length, options.length);
    });

    test('line total uses per-kg price × base quantity', () {
      final m = ProductMeasurement.fromProductJson(_qaProductJson)!;
      expect(m.lineTotal(100, 0.25), 25);
      expect(m.lineTotal(100, 0.5), 50);
      expect(m.lineTotal(100, 1), 100);
    });

    test('legacy piece product has no measurement', () {
      final p = Product.fromJson({
        'id': 'x',
        'name': 'بيتسا',
        'categoryId': 'c',
        'basePrice': 25,
        'imageUrl': '',
        'optionGroups': [],
      });
      expect(p.measurement, isNull);
      expect(p.isWeightProduct, isFalse);
    });

    test('Admin-shaped WEIGHT product (any merchant) generates steps', () {
      final m = ProductMeasurement.fromProductJson({
        'id': 'merchant-weight-steak',
        'name': 'ستيك',
        'measurementType': 'WEIGHT',
        'baseUnitCode': 'kg',
        'displayUnitCode': 'g',
        'quantityStep': '0.25',
        'minimumQuantity': '0.25',
        'maximumQuantity': '1',
        'priceBasis': 'PER_BASE_UNIT',
        'measurementVersion': 1,
        'isWeightBased': true,
        'unitName': 'كيلو',
      })!;
      expect(m.selectableQuantities(), [0.25, 0.5, 0.75, 1.0]);
      expect(
        m.selectableQuantities().map(m.formatQuantityLabel).toList(),
        ['250 غرام', '500 غرام', '750 غرام', '1000 غرام'],
      );
      expect(m.lineTotal(40, 0.5), 20);
    });
  });

  group('ProductCustomizationController weight steps', () {
    late ProductCustomizationController ctrl;

    setUp(() {
      ctrl = ProductCustomizationController(Product.fromJson(_qaProductJson));
    });

    tearDown(() => ctrl.dispose());

    test('defaults to minimum configured option', () {
      expect(ctrl.orderQuantity, 0.25);
    });

    test('+ moves to next configured option', () {
      ctrl.stepWeightQuantity(1);
      expect(ctrl.orderQuantity, 0.5);
      ctrl.stepWeightQuantity(1);
      expect(ctrl.orderQuantity, 0.75);
      ctrl.stepWeightQuantity(1);
      expect(ctrl.orderQuantity, 1.0);
    });

    test('- moves to previous configured option', () {
      ctrl.setWeightQuantity(1.0);
      ctrl.stepWeightQuantity(-1);
      expect(ctrl.orderQuantity, 0.75);
    });

    test('cannot decrement below first option', () {
      expect(ctrl.orderQuantity, 0.25);
      expect(ctrl.canStepWeightDown, isFalse);
      ctrl.stepWeightQuantity(-1);
      expect(ctrl.orderQuantity, 0.25);
    });

    test('cannot increment beyond last option', () {
      ctrl.setWeightQuantity(1.0);
      expect(ctrl.canStepWeightUp, isFalse);
      ctrl.stepWeightQuantity(1);
      expect(ctrl.orderQuantity, 1.0);
    });

    test('mid-range enables both step directions', () {
      ctrl.setWeightQuantity(0.5);
      expect(ctrl.canStepWeightDown, isTrue);
      expect(ctrl.canStepWeightUp, isTrue);
    });

    test('legacy null-max product has no step room', () {
      final nullMax = ProductCustomizationController(
        Product.fromJson(_weightJson(step: '0.5', min: '0.5', max: null)),
      );
      expect(nullMax.orderQuantity, 0.5);
      expect(nullMax.canStepWeightDown, isFalse);
      expect(nullMax.canStepWeightUp, isFalse);
      nullMax.dispose();
    });

    test('rejects values outside configured options', () {
      ctrl.setWeightQuantity(0.3);
      expect(ctrl.orderQuantity, 0.25);
    });
  });

  group('CartCubit weight lines', () {
    test('stores fractional quantity and measurement snapshot', () {
      final cubit = CartCubit();
      final product = Product.fromJson(_qaProductJson);
      final m = product.measurement!;

      cubit.addOrIncrement(
        tenantId: 'meas-pilot-private',
        productId: product.id,
        name: product.name,
        unitPrice: 100,
        merchantUnitPrice: 100,
        imageUrl: '',
        addQty: 0.5,
        measurement: m,
      );

      final line = cubit.state.single;
      expect(line.quantity, 0.5);
      expect(line.lineTotal, 50);
      expect(line.quantityDisplayLabel, '500 غرام');
      expect(line.isWeightLine, isTrue);
      expect(line.badgeCount, 1);
      expect(cubit.itemCount, 1);
    });

    test('cart receives same underlying value selected by customer', () {
      final cubit = CartCubit();
      final product = Product.fromJson(_qaProductJson);
      final ctrl = ProductCustomizationController(product);
      ctrl.stepWeightQuantity(1);
      ctrl.stepWeightQuantity(1);
      expect(ctrl.orderQuantity, 0.75);

      cubit.addOrIncrement(
        tenantId: 't',
        productId: product.id,
        name: product.name,
        unitPrice: 100,
        imageUrl: '',
        addQty: ctrl.orderQuantity,
        measurement: product.measurement,
      );
      expect(cubit.state.single.quantity, 0.75);
      ctrl.dispose();
    });

    test('order snapshot includes measurement fields', () {
      final m = ProductMeasurement.fromProductJson(_qaProductJson)!;
      final snap = m.toOrderSnapshot();
      expect(snap['measurementType'], 'WEIGHT');
      expect(snap['isWeightBased'], isTrue);
      expect(snap['quantityStep'], 0.25);
    });

    test('non-weighted piece quantity remains integer +1', () {
      final cubit = CartCubit();
      cubit.addOrIncrement(
        tenantId: 't',
        productId: 'piece-1',
        name: 'بيتسا',
        unitPrice: 25,
        imageUrl: '',
        addQty: 1,
      );
      cubit.addOrIncrement(
        tenantId: 't',
        productId: 'piece-1',
        name: 'بيتسا',
        unitPrice: 25,
        imageUrl: '',
        addQty: 1,
      );
      expect(cubit.state.single.quantity, 2);
      expect(cubit.state.single.isWeightLine, isFalse);
    });
  });
}
