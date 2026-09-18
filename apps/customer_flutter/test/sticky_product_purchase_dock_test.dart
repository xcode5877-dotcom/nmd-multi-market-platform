import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:customer_flutter/features/catalog/presentation/widgets/product_details/product_details_bottom_bar.dart';

void main() {
  testWidgets('purchase dock stays fixed while sibling scroll moves', (tester) async {
    final scrollController = ScrollController();
    var quantity = 1;

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Column(
            children: [
              Expanded(
                child: ListView.builder(
                  key: const Key('product_details_scroll'),
                  controller: scrollController,
                  itemCount: 40,
                  itemBuilder: (_, i) => SizedBox(
                    height: 48,
                    child: Text('row-$i', textAlign: TextAlign.center),
                  ),
                ),
              ),
              KeyedSubtree(
                key: const Key('product_purchase_dock'),
                child: ProductDetailsBottomBar(
                  unitPrice: 10,
                  quantity: quantity,
                  onQuantityChanged: (q) => quantity = q,
                  onPressed: () {},
                ),
              ),
              const SizedBox(
                key: Key('bottom_nav_stub'),
                height: 64,
                child: ColoredBox(color: Colors.black12),
              ),
            ],
          ),
        ),
      ),
    );

    final dockBefore = tester.getTopLeft(find.byKey(const Key('product_purchase_dock')));
    await tester.drag(find.byKey(const Key('product_details_scroll')), const Offset(0, -400));
    await tester.pumpAndSettle();
    final dockAfter = tester.getTopLeft(find.byKey(const Key('product_purchase_dock')));

    expect(dockBefore.dy, dockAfter.dy);
    expect(
      tester.getTopLeft(find.byKey(const Key('product_purchase_dock'))).dy <
          tester.getTopLeft(find.byKey(const Key('bottom_nav_stub'))).dy,
      isTrue,
    );
  });
}
