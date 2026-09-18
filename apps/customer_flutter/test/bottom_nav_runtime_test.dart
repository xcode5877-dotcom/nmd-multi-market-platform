import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:customer_flutter/core/auth/protected_customer_navigation.dart';
import 'package:customer_flutter/features/cart/application/cart_cubit.dart';
import 'package:customer_flutter/widgets/nmd_bottom_nav.dart';

void main() {
  testWidgets('bottom nav labels are tappable and report selected tab', (tester) async {
    MainTab current = MainTab.home;
    final taps = <MainTab>[];

    await tester.pumpWidget(
      BlocProvider(
        create: (_) => CartCubit(),
        child: MaterialApp(
          home: Scaffold(
            body: const SizedBox.expand(),
            bottomNavigationBar: StatefulBuilder(
              builder: (context, setState) {
                return NmdBottomNav(
                  currentTab: current,
                  onTabSelected: (t) {
                    taps.add(t);
                    setState(() => current = t);
                  },
                );
              },
            ),
          ),
        ),
      ),
    );

    for (final label in ['الرئيسية', 'المكافآت', 'طلباتي', 'حسابي']) {
      expect(find.text(label), findsWidgets);
    }
    // Cart uses FAB-like icon; assert by icon.
    expect(find.byIcon(Icons.shopping_cart_rounded), findsOneWidget);

    await tester.tap(find.text('طلباتي'));
    await tester.pump();
    await tester.tap(find.text('حسابي'));
    await tester.pump();
    await tester.tap(find.text('الرئيسية'));
    await tester.pump();
    await tester.tap(find.text('المكافآت'));
    await tester.pump();
    await tester.tap(find.byIcon(Icons.shopping_cart_rounded));
    await tester.pump();

    expect(taps, [
      MainTab.orders,
      MainTab.account,
      MainTab.home,
      MainTab.rewards,
      MainTab.cart,
    ]);
  });

  test('protected routes for orders and account', () {
    expect(
      protectedCustomerRoute('aljabal', ProtectedCustomerDestination.orders),
      '/market/aljabal/orders',
    );
    expect(
      protectedCustomerRoute('aljabal', ProtectedCustomerDestination.account),
      '/market/aljabal/account',
    );
  });
}
