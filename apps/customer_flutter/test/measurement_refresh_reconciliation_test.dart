import 'package:flutter_test/flutter_test.dart';

import 'package:customer_flutter/api/models/product.dart';
import 'package:customer_flutter/api/models/product_measurement.dart';
import 'package:customer_flutter/features/catalog/presentation/customization/product_customization_controller.dart';

Product _product({double? max}) {
  return Product.fromJson({
    'id': 'p1',
    'name': 'وزن',
    'basePrice': 40,
    'displayPrice': 40,
    'imageUrl': '',
    'isAvailable': true,
    'measurementType': 'WEIGHT',
    'baseUnitCode': 'kg',
    'displayUnitCode': 'kg',
    'quantityStep': 0.25,
    'minimumQuantity': 0.25,
    'maximumQuantity': max,
    'priceBasis': 'PER_BASE_UNIT',
    'measurementVersion': 1,
    'isWeightBased': true,
    'unitName': 'كغم',
    'optionGroups': [],
  });
}

void main() {
  test('reconcile clamps selection when max appears after refresh', () {
    final initial = _product(max: null);
    final controller = ProductCustomizationController(initial);
    expect(controller.orderQuantity, 0.25);

    final refreshed = ProductMeasurement.fromProductJson({
      'measurementType': 'WEIGHT',
      'baseUnitCode': 'kg',
      'displayUnitCode': 'kg',
      'quantityStep': 0.25,
      'minimumQuantity': 0.25,
      'maximumQuantity': 2,
      'priceBasis': 'PER_BASE_UNIT',
      'measurementVersion': 1,
      'isWeightBased': true,
      'unitName': 'كغم',
    });
    controller.reconcileWithMeasurement(refreshed);
    expect(controller.orderQuantity, 0.25);
    expect(controller.canStepWeightUp, isTrue);
  });
}
