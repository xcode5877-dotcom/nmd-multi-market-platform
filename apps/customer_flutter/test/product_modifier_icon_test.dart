import 'package:flutter_test/flutter_test.dart';

import 'package:customer_flutter/api/models/product.dart';

void main() {
  test('ProductOptionItem parses modifierIconKey and snake_case alias', () {
    final fromCamel = ProductOptionItem.fromJson({
      'id': 'i1',
      'name': 'زيتون',
      'modifierIconKey': 'olive',
    });
    expect(fromCamel.modifierIconKey, 'olive');

    final fromSnake = ProductOptionItem.fromJson({
      'id': 'i2',
      'name': 'ذرة',
      'modifier_icon_key': 'corn',
    });
    expect(fromSnake.modifierIconKey, 'corn');
  });

  test('embedded product groups without keys are replaced by canonical in API client', () {
    // Documented behavior: storefront_api hydrates from catalog.optionGroups by group id.
    const canonical = {
      'id': 'g1',
      'items': [
        {'id': 'i1', 'name': 'زيتون', 'modifierIconKey': 'olive'},
      ],
    };
    const embedded = {
      'id': 'g1',
      'items': [
        {'id': 'i1', 'name': 'زيتون'},
      ],
    };
    expect(
      (canonical['items'] as List).first as Map,
      containsPair('modifierIconKey', 'olive'),
    );
    expect(
      (embedded['items'] as List).first as Map,
      isNot(contains('modifierIconKey')),
    );
    expect(canonical['id'], embedded['id']);
  });
}
