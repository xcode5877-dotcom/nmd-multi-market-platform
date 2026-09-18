import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:customer_flutter/features/catalog/presentation/widgets/product_details/product_details_bottom_bar.dart';

void main() {
  testWidgets('modifiers remain visible above dock on small viewport', (tester) async {
    tester.view.physicalSize = const Size(360, 640);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Column(
            children: [
              Expanded(
                child: ListView(
                  key: const Key('product_details_scroll'),
                  children: const [
                    SizedBox(height: 120, child: Text('title')),
                    SizedBox(height: 80, child: Text('modifier-group-1')),
                    SizedBox(height: 80, child: Text('modifier-group-2')),
                    SizedBox(height: 80, child: Text('last-modifier')),
                    SizedBox(height: 72),
                  ],
                ),
              ),
              const KeyedSubtree(
                key: Key('product_purchase_dock'),
                child: ProductDetailsBottomBar(
                  unitPrice: 15,
                  quantity: 1,
                  onQuantityChanged: _noopInt,
                  onPressed: _noop,
                ),
              ),
            ],
          ),
        ),
      ),
    );

    await tester.drag(find.byKey(const Key('product_details_scroll')), const Offset(0, -300));
    await tester.pumpAndSettle();
    expect(find.text('last-modifier'), findsOneWidget);
    expect(find.byKey(const Key('product_purchase_dock')), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}

void _noop() {}
void _noopInt(int _) {}
