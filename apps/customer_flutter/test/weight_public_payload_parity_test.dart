import 'package:flutter_test/flutter_test.dart';

import 'package:customer_flutter/api/models/product_measurement.dart';

void main() {
  test('public payload with valid max removes incomplete single-option behavior', () {
    final withMax = ProductMeasurement.fromProductJson({
      'measurementType': 'WEIGHT',
      'baseUnitCode': 'kg',
      'displayUnitCode': 'kg',
      'quantityStep': '0.25',
      'minimumQuantity': '0.25',
      'maximumQuantity': '2',
      'priceBasis': 'PER_BASE_UNIT',
      'measurementVersion': 1,
      'isWeightBased': true,
      'unitName': 'كغم',
    })!;
    expect(
      withMax.selectableQuantities(),
      [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0],
    );
    expect(withMax.maximumQuantity, 2);

    final nullMax = ProductMeasurement.fromProductJson({
      'measurementType': 'WEIGHT',
      'baseUnitCode': 'kg',
      'displayUnitCode': 'kg',
      'quantityStep': '0.25',
      'minimumQuantity': '0.25',
      'maximumQuantity': null,
      'priceBasis': 'PER_BASE_UNIT',
      'measurementVersion': 1,
      'isWeightBased': true,
      'unitName': 'كغم',
    })!;
    expect(nullMax.selectableQuantities(), [0.25]);
    expect(nullMax.maximumQuantity, isNull);
  });
}
