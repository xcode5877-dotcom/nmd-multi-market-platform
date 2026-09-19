import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:customer_flutter/api/models/product.dart';
import 'package:customer_flutter/api/models/product_measurement.dart';
import 'package:customer_flutter/features/cart/application/cart_cubit.dart';
import 'package:customer_flutter/features/catalog/presentation/customization/product_customization_controller.dart';
import 'package:customer_flutter/features/catalog/presentation/widgets/product_details/product_details_bottom_bar.dart';

/// بندورة @ سوق طلعت للخضار والفوكه — local catalog row (read-only reference).
const _bandoraPieceJson = {
  'id': '1b56b00f-474b-4089-aee6-77b1d1e08090',
  'name': 'بندورة',
  'categoryId': 'cat',
  'basePrice': 7,
  'imageUrl': '',
  'optionGroups': [],
  'measurementType': 'PIECE',
  'baseUnitCode': 'PIECE',
  'displayUnitCode': 'PIECE',
  'quantityStep': '1',
  'minimumQuantity': '1',
  'maximumQuantity': null,
};

Map<String, dynamic> _bandoraWeightNullMaxJson() => {
      ..._bandoraPieceJson,
      'measurementType': 'WEIGHT',
      'baseUnitCode': 'KG',
      'displayUnitCode': 'G',
      'quantityStep': '0.25',
      'minimumQuantity': '0.25',
      'maximumQuantity': null,
      'isWeightBased': true,
      'unitName': 'غرام',
    };

Map<String, dynamic> _bandoraWeightConfiguredJson() => {
      ..._bandoraWeightNullMaxJson(),
      'maximumQuantity': '2',
    };

void main() {
  group('Device QA weight — بندورة', () {
    test('PIECE catalog row does not activate weight UI', () {
      final product = Product.fromJson(_bandoraPieceJson);
      expect(product.isWeightProduct, isFalse);
      expect(product.measurement, isNull);
    });

    test('legacy WEIGHT null max exposes only 250g (0.25 kg base)', () {
      final m = ProductMeasurement.fromProductJson(_bandoraWeightNullMaxJson())!;
      expect(m.selectableQuantities(), [0.25]);
      expect(m.formatQuantityLabel(0.25), '250 غرام');
      expect(m.canIncrementFrom(0.25), isFalse);
    });

    test('configured WEIGHT steps 250g–2000g and cart stores base qty', () {
      final product = Product.fromJson(_bandoraWeightConfiguredJson());
      final m = product.measurement!;
      expect(
        m.selectableQuantities(),
        [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0],
      );
      expect(m.formatQuantityLabel(0.5), '500 غرام');

      final ctrl = ProductCustomizationController(product);
      expect(ctrl.orderQuantity, 0.25);
      ctrl.setWeightQuantity(0.5);
      expect(ctrl.orderQuantity, 0.5);

      final cart = CartCubit();
      cart.addOrIncrement(
        tenantId: 'f741d517-e7e6-48c9-a046-18d85acf1d25',
        productId: product.id,
        name: product.name,
        unitPrice: product.customerListPrice,
        imageUrl: '',
        addQty: ctrl.orderQuantity,
        measurement: m,
      );
      expect(cart.state.single.quantity, 0.5);
      cart.close();
    });

    testWidgets('closed merchant keeps dock steppable but CTA disabled',
        (tester) async {
      var index = 0;
      const labels = ['0.25 كغم', '0.5 كغم'];
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: StatefulBuilder(
              builder: (context, setState) {
                return ProductDetailsBottomBar(
                  unitPrice: 88,
                  quantity: 1,
                  isWeightProduct: true,
                  weightQuantityLabel: labels[index],
                  disabled: true,
                  disabledCtaLabel: 'المحل مغلق',
                  quantityInteractionEnabled: true,
                  canWeightDecrement: index > 0,
                  canWeightIncrement: index < labels.length - 1,
                  onWeightStep: (dir) => setState(() => index += dir),
                  onQuantityChanged: (_) {},
                  onPressed: () {},
                );
              },
            ),
          ),
        ),
      );

      expect(find.text('المحل مغلق'), findsOneWidget);
      await tester.tap(find.byKey(const Key('purchase_dock_qty_increment')));
      await tester.pumpAndSettle();
      expect(find.text('0.5 كغم'), findsOneWidget);
    });

    test('piece product keeps integer quantity', () {
      final product = Product.fromJson(_bandoraPieceJson);
      final ctrl = ProductCustomizationController(product);
      expect(ctrl.isWeightProduct, isFalse);
      ctrl.setQuantity(3);
      expect(ctrl.quantity, 3);
      expect(ctrl.orderQuantity, 3);
    });
  });
}
