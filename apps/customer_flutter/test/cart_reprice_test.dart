import 'package:flutter_test/flutter_test.dart';

import 'package:customer_flutter/api/models/product.dart';
import 'package:customer_flutter/features/cart/application/cart_cubit.dart';
import 'package:customer_flutter/features/cart/data/cart_persistence.dart';

void main() {
  test('Product.customerListPrice prefers displayPrice', () {
    final p = Product.fromJson({
      'id': 'x',
      'name': 'بيتسا صغير',
      'categoryId': 'c',
      'basePrice': 25,
      'displayPrice': 30,
      'imageUrl': '',
      'optionGroups': [],
    });
    expect(p.basePrice, 25);
    expect(p.displayPrice, 30);
    expect(p.customerListPrice, 30);
  });

  test('CartCubit.repriceFromCatalog applies platform markup delta', () {
    final cubit =
        CartCubit(persistence: CartPersistence(store: MemoryCartStore()));
    cubit.addOrIncrement(
      tenantId: 't',
      productId: 'x',
      name: 'بيتسا صغير',
      unitPrice: 25,
      merchantUnitPrice: 25,
      imageUrl: '',
    );
    final product = Product.fromJson({
      'id': 'x',
      'name': 'بيتسا صغير',
      'categoryId': 'c',
      'basePrice': 25,
      'displayPrice': 30,
      'imageUrl': '',
      'optionGroups': [],
    });
    cubit.repriceFromCatalog('t', [product]);
    expect(cubit.state.single.unitPrice, 30);
    expect(cubit.state.single.merchantUnitPrice, 25);
  });
}
