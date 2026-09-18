import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:customer_flutter/features/catalog/presentation/widgets/product_details/product_details_bottom_bar.dart';

void main() {
  testWidgets('dock is not a descendant of the product scroll view', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Column(
            children: [
              Expanded(
                child: CustomScrollView(
                  key: const Key('product_details_scroll'),
                  slivers: [
                    SliverList(
                      delegate: SliverChildBuilderDelegate(
                        (_, i) => Text('item-$i'),
                        childCount: 20,
                      ),
                    ),
                  ],
                ),
              ),
              const KeyedSubtree(
                key: Key('product_purchase_dock'),
                child: ProductDetailsBottomBar(
                  unitPrice: 12,
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

    final scroll = find.byKey(const Key('product_details_scroll'));
    final dock = find.byKey(const Key('product_purchase_dock'));
    expect(scroll, findsOneWidget);
    expect(dock, findsOneWidget);
    expect(
      find.descendant(of: scroll, matching: dock),
      findsNothing,
      reason: 'Purchase dock must not live inside scrollable product content',
    );
  });
}

void _noop() {}
void _noopInt(int _) {}
