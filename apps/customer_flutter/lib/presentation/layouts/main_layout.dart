import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/ensure_customer_auth.dart';
import '../../widgets/global_nmd_header.dart';
import '../../widgets/nmd_bottom_nav.dart';

/// Persistent bottom navigation for tenant routes (`/market/:slug/...`).
class MainLayout extends StatelessWidget {
  const MainLayout({
    super.key,
    required this.marketSlug,
    required this.child,
  });

  final String marketSlug;
  final Widget child;

  static MainTab tabFromPath(String path) {
    final segs = Uri.tryParse(path)?.pathSegments ?? [];
    if (segs.length >= 3) {
      final third = segs[2];
      switch (third) {
        case 'rewards':
          return MainTab.rewards;
        case 'orders':
          return MainTab.orders;
        case 'cart':
          return MainTab.cart;
        case 'account':
          return MainTab.account;
      }
    }
    return MainTab.home;
  }

  static bool _isSubRouteWithoutShellAppBar(String path) {
    return path.contains('/store/') || path.endsWith('/cart');
  }

  /// `/market/:slug/account/...` child routes use their own [AccountSubScaffold] AppBar.
  static bool _isAccountSubRoute(String path) {
    final segs = Uri.tryParse(path)?.pathSegments ?? [];
    final i = segs.indexOf('account');
    return i >= 0 && i < segs.length - 1;
  }

  @override
  Widget build(BuildContext context) {
    final path = GoRouterState.of(context).uri.path;
    final tab = tabFromPath(path);
    final showShellAppBar = tab != MainTab.home &&
        !_isSubRouteWithoutShellAppBar(path) &&
        !_isAccountSubRoute(path);

    return Scaffold(
      backgroundColor: Colors.white,
      body: Column(
        children: [
          if (showShellAppBar)
            GlobalNmdHeader(
              marketSlug: marketSlug,
              title: 'Now Market',
              onLeadingPressed: () {
                if (context.canPop()) {
                  context.pop();
                } else {
                  context.go('/market/$marketSlug');
                }
              },
            ),
          Expanded(
            child: ColoredBox(
              color: showShellAppBar
                  ? (tab == MainTab.rewards
                      ? const Color(0xFF0A0E14)
                      : Colors.white)
                  : Colors.transparent,
              child: child,
            ),
          ),
          NmdBottomNav(
            currentTab: tab,
            onTabSelected: (t) => _onTabSelected(context, t),
          ),
        ],
      ),
    );
  }

  Future<void> _onTabSelected(BuildContext context, MainTab tab) async {
    if (tab == MainTab.account || tab == MainTab.orders) {
      final ok = await ensureCustomerAuth(context);
      if (!context.mounted || !ok) return;
    }
    final base = '/market/$marketSlug';
    switch (tab) {
      case MainTab.home:
        context.go(base);
        break;
      case MainTab.rewards:
        context.go('$base/rewards');
        break;
      case MainTab.orders:
        context.go('$base/orders');
        break;
      case MainTab.cart:
        context.go('$base/cart');
        break;
      case MainTab.account:
        context.go('$base/account');
        break;
    }
  }
}
