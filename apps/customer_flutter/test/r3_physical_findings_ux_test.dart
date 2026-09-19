import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:customer_flutter/core/support/header_support_action.dart';
import 'package:customer_flutter/design_system/design_system.dart';
import 'package:customer_flutter/features/cart/application/cart_cubit.dart';
import 'package:customer_flutter/features/cart/presentation/widgets/global_cart_icon.dart';
import 'package:customer_flutter/features/catalog/presentation/widgets/product_details/product_details_bottom_bar.dart';
import 'package:customer_flutter/features/catalog/presentation/widgets/weight_quantity_selector.dart';
import 'package:customer_flutter/features/support/presentation/widgets/support_floating_capsule.dart';
import 'package:customer_flutter/widgets/global_nmd_header.dart';

void main() {
  testWidgets('home-style header has Help and no back arrow', (tester) async {
    await tester.pumpWidget(
      BlocProvider(
        create: (_) => CartCubit(),
        child: MaterialApp(
          home: Scaffold(
            body: Column(
              children: [
                NmdAppHeader(
                  center: const Text('logo'),
                  actions: [
                    const HeaderSupportAction(source: 'home_header'),
                    GlobalCartIcon(
                      marketSlug: 'aljabal',
                      iconColor: NmdColors.textOnBrand,
                      style: NmdAppHeader.plainIconStyle(),
                    ),
                  ],
                ),
                const Expanded(child: SizedBox()),
              ],
            ),
          ),
        ),
      ),
    );

    expect(find.byKey(const Key('header_support_action')), findsOneWidget);
    expect(find.byIcon(Icons.arrow_back_ios_new), findsNothing);
    expect(find.byType(SupportFloatingCapsule), findsNothing);
  });

  testWidgets('shell header Help is tappable and not a floating overlay',
      (tester) async {
    await tester.pumpWidget(
      BlocProvider(
        create: (_) => CartCubit(),
        child: MaterialApp(
          home: Scaffold(
            body: Column(
              children: [
                GlobalNmdHeader(
                  marketSlug: 'aljabal',
                  title: 'Now Market',
                  onLeadingPressed: () {},
                ),
                const Expanded(child: ColoredBox(color: Colors.white)),
              ],
            ),
          ),
        ),
      ),
    );

    expect(find.byKey(const Key('header_support_action')), findsOneWidget);
    await tester.tap(find.byKey(const Key('header_support_action')));
    await tester.pump();
    expect(find.byType(SupportFloatingCapsule), findsNothing);
  });

  testWidgets('weight product uses dock only — no chip grid in same scaffold',
      (tester) async {
    const labels = ['0.25 كغم', '0.5 كغم', '7 كغم'];
    var index = 0;

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Column(
            children: [
              const Expanded(
                child: Center(child: Text('product-body-no-weight-grid')),
              ),
              StatefulBuilder(
                builder: (context, setState) {
                  return ProductDetailsBottomBar(
                    unitPrice: 88,
                    quantity: 1,
                    isWeightProduct: true,
                    weightQuantityLabel: labels[index],
                    lineTotal: 88 *
                        (index == 0
                            ? 0.25
                            : index == 1
                                ? 0.5
                                : 7.0),
                    canWeightDecrement: index > 0,
                    canWeightIncrement: index < labels.length - 1,
                    onWeightStep: (dir) => setState(() => index += dir),
                    onQuantityChanged: (_) {},
                    onPressed: () {},
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );

    expect(find.byType(WeightQuantitySelector), findsNothing);
    expect(find.text('product-body-no-weight-grid'), findsOneWidget);
    expect(find.text('0.25 كغم'), findsOneWidget);

    await tester.tap(find.byKey(const Key('purchase_dock_qty_decrement')));
    await tester.pumpAndSettle();
    expect(find.text('0.25 كغم'), findsOneWidget);

    await tester.tap(find.byKey(const Key('purchase_dock_qty_increment')));
    await tester.pumpAndSettle();
    expect(find.text('0.5 كغم'), findsOneWidget);

    await tester.tap(find.byKey(const Key('purchase_dock_qty_increment')));
    await tester.pumpAndSettle();
    expect(find.text('7 كغم'), findsOneWidget);

    await tester.tap(find.byKey(const Key('purchase_dock_qty_increment')));
    await tester.pumpAndSettle();
    expect(find.text('7 كغم'), findsOneWidget);
  });
}
