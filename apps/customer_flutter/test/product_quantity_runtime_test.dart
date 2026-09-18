import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:customer_flutter/features/catalog/presentation/widgets/product_details/product_details_bottom_bar.dart';

void main() {
  testWidgets('piece +/- changes displayed quantity', (tester) async {
    var quantity = 1;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: StatefulBuilder(
            builder: (context, setState) {
              return ProductDetailsBottomBar(
                unitPrice: 20,
                quantity: quantity,
                onQuantityChanged: (q) => setState(() => quantity = q),
                onPressed: () {},
              );
            },
          ),
        ),
      ),
    );

    expect(find.byKey(const ValueKey('purchase_dock_qty_label_1')), findsOneWidget);
    await tester.tap(find.byKey(const Key('purchase_dock_qty_increment')));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('purchase_dock_qty_label_2')), findsOneWidget);
    await tester.tap(find.byKey(const Key('purchase_dock_qty_decrement')));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('purchase_dock_qty_label_1')), findsOneWidget);
  });

  testWidgets('weight +/- walks selectable labels', (tester) async {
    const labels = ['0.25 كغم', '0.5 كغم', '0.75 كغم', '1 كغم'];
    var index = 0;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: StatefulBuilder(
            builder: (context, setState) {
              return ProductDetailsBottomBar(
                unitPrice: 40,
                quantity: 1,
                isWeightProduct: true,
                weightQuantityLabel: labels[index],
                lineTotal: 40 * (0.25 * (index + 1)),
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

    expect(find.text('0.25 كغم'), findsOneWidget);
    await tester.tap(find.byKey(const Key('purchase_dock_qty_increment')));
    await tester.pumpAndSettle();
    expect(find.text('0.5 كغم'), findsOneWidget);
  });
}
