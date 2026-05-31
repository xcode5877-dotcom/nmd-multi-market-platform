import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/ensure_customer_auth.dart';
import '../../core/debug/nmd_post_login_trace.dart';
import '../../widgets/global_nmd_header.dart';
import '../../widgets/nmd_bottom_nav.dart';

/// Persistent bottom navigation for tenant routes (`/market/:slug/...`).
class MainLayout extends StatefulWidget {
  const MainLayout({
    super.key,
    required this.marketSlug,
    required this.child,
  });

  final String marketSlug;
  final Widget child;

  @override
  State<MainLayout> createState() => _MainLayoutState();

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

  static bool isSubRouteWithoutShellAppBar(String path) {
    return path.contains('/store/') || path.endsWith('/cart');
  }

  /// `/market/:slug/account/...` child routes use their own [AccountSubScaffold] AppBar.
  static bool isAccountSubRoute(String path) {
    final segs = Uri.tryParse(path)?.pathSegments ?? [];
    final i = segs.indexOf('account');
    return i >= 0 && i < segs.length - 1;
  }
}

class _MainLayoutState extends State<MainLayout> {
  bool _tabNavBusy = false;

  @override
  Widget build(BuildContext context) {
    final path = GoRouterState.of(context).uri.path;
    final tab = MainLayout.tabFromPath(path);
    final showShellAppBar = tab != MainTab.home &&
        tab != MainTab.rewards &&
        !MainLayout.isSubRouteWithoutShellAppBar(path) &&
        !MainLayout.isAccountSubRoute(path);

    return Scaffold(
      backgroundColor: Colors.white,
      body: Column(
        children: [
          if (showShellAppBar)
            GlobalNmdHeader(
              marketSlug: widget.marketSlug,
              title: 'Now Market',
              onLeadingPressed: () {
                if (context.canPop()) {
                  context.pop();
                } else {
                  context.go('/market/${widget.marketSlug}');
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
              child: widget.child,
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
    if (_tabNavBusy) return;
    _tabNavBusy = true;
    try {
      final base = '/market/${widget.marketSlug}';
      switch (tab) {
        case MainTab.home:
          context.go(base);
          return;
        case MainTab.rewards:
          context.go('$base/rewards');
          return;
        case MainTab.cart:
          context.go('$base/cart');
          return;
        case MainTab.account:
          await openCustomerAccount(context, widget.marketSlug);
          return;
        case MainTab.orders:
          final router = GoRouter.of(context);
          final ok = await ensureCustomerAuth(context);
          if (!context.mounted) {
            if (ok) {
              nmdPostLoginTrace('NAVIGATING_TO_ORDERS_ROUTER_FALLBACK', '$base/orders');
              router.go('$base/orders');
            }
            return;
          }
          if (ok) context.go('$base/orders');
          return;
      }
    } finally {
      _tabNavBusy = false;
    }
  }
}
