import 'package:flutter_test/flutter_test.dart';
import 'package:customer_flutter/core/support/support_route_policy.dart';
import 'package:customer_flutter/presentation/layouts/main_layout.dart';
import 'package:customer_flutter/widgets/nmd_bottom_nav.dart';

void main() {
  group('SupportRoutePolicy', () {
    test('home only', () {
      expect(
        SupportRoutePolicy.shouldShowFloatingSupport(path: '/market/dabburiyya'),
        isTrue,
      );
      expect(
        SupportRoutePolicy.shouldShowFloatingSupport(
          path: '/market/dabburiyya/store/x/product/y',
        ),
        isFalse,
      );
      expect(
        SupportRoutePolicy.shouldShowFloatingSupport(
          path: '/market/dabburiyya/cart',
        ),
        isFalse,
      );
      expect(
        SupportRoutePolicy.shouldShowFloatingSupport(
          path: '/market/dabburiyya',
          keyboardVisible: true,
        ),
        isFalse,
      );
      expect(
        SupportRoutePolicy.shouldShowFloatingSupport(
          path: '/market/dabburiyya',
          modalRouteActive: true,
        ),
        isFalse,
      );
    });
  });

  group('MainLayout.tabFromPath', () {
    test('maps shell destinations', () {
      expect(MainLayout.tabFromPath('/market/x'), MainTab.home);
      expect(MainLayout.tabFromPath('/market/x/rewards'), MainTab.rewards);
      expect(MainLayout.tabFromPath('/market/x/cart'), MainTab.cart);
      expect(MainLayout.tabFromPath('/market/x/orders'), MainTab.orders);
      expect(MainLayout.tabFromPath('/market/x/account'), MainTab.account);
      expect(
        MainLayout.tabFromPath('/market/x/account/help'),
        MainTab.account,
      );
    });
  });
}
