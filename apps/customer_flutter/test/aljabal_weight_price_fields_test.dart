import 'package:flutter_test/flutter_test.dart';

import 'package:customer_flutter/api/models/product.dart';
import 'package:customer_flutter/features/catalog/presentation/customization/product_customization_controller.dart';

/// Live aljabal WEIGHT product (لحمة عجل مطحونه) — fields from CatalogProduct +
/// storefront catalog enrich (read-only snapshot for R3).
const _aljabalMincedBeefJson = {
  'id': '17e97d09-2d23-4b21-8d7f-ebc340abd1c2',
  'name': 'لحمة عجل مطحونه',
  'categoryId': 'cat',
  'basePrice': 85,
  'displayPrice': 88,
  'imageUrl': '',
  'optionGroups': [],
  'measurementType': 'WEIGHT',
  'baseUnitCode': 'KG',
  'displayUnitCode': 'KG',
  'quantityStep': '0.25',
  'minimumQuantity': '0.25',
  'maximumQuantity': '7',
  'isWeightBased': true,
  'priceBasis': 'PER_BASE_UNIT',
};

void main() {
  test('aljabal WEIGHT 0.25–7 kg steps; dock prices use displayPrice', () {
    final product = Product.fromJson(_aljabalMincedBeefJson);
    final m = product.measurement!;
    expect(product.basePrice, 85);
    expect(product.displayPrice, 88);
    expect(product.customerListPrice, 88);

    final qty = m.selectableQuantities();
    expect(qty.first, 0.25);
    expect(qty.last, 7.0);
    expect(qty.length, 28); // 0.25 .. 7.00 inclusive

    final ctrl = ProductCustomizationController(product);
    expect(ctrl.orderQuantity, 0.25);
    expect(m.canDecrementFrom(0.25), isFalse);
    expect(m.canIncrementFrom(0.25), isTrue);

    ctrl.setWeightQuantity(7.0);
    expect(ctrl.orderQuantity, 7.0);
    expect(m.canIncrementFrom(7.0), isFalse);
    expect(m.canDecrementFrom(7.0), isTrue);

    // Line totals at customer list price (do not alter fee formulas).
    expect(88 * 0.25, 22.0);
    expect(88 * 7.0, 616.0);
  });
}
