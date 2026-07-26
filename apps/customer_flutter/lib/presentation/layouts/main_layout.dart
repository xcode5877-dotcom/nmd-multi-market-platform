import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/protected_customer_navigation.dart';
import '../../core/debug/order_window_log.dart';
import '../../core/navigation/safe_back_navigation.dart';
import '../../features/account/presentation/widgets/default_delivery_town_setup_gate.dart';
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
    orderWindowLog(
      '[ORDER_WINDOW] MainLayout build path=$path shellTab=${tab.name}',
    );
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
              onLeadingPressed: () => safeNmdBack(
                context,
                marketSlug: widget.marketSlug,
              ),
            ),
          Expanded(
            child: DefaultDeliveryTownSetupGate(
              child: ColoredBox(
                color: showShellAppBar
                    ? (tab == MainTab.rewards
                        ? const Color(0xFF0A0E14)
                        : Colors.white)
                    : Colors.transparent,
                child: widget.child,
              ),
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
    if (kDebugMode) {
      debugPrint('[NAV-AUDIT] bottom tab tap tab=${tab.name}');
    }
    if (_tabNavBusy) {
      if (kDebugMode) debugPrint('[NAV-AUDIT] bottom tab blocked — tabNavBusy');
      return;
    }
    _tabNavBusy = true;
    try {
      if (!context.mounted) return;
      switch (tab) {
        case MainTab.home:
          orderWindowLogHomeNavigation(
            'MainLayout._onTabSelected:home',
            '/market/${widget.marketSlug}',
          );
          context.go('/market/${widget.marketSlug}');
        case MainTab.rewards:
          context.go('/market/${widget.marketSlug}/rewards');
        case MainTab.cart:
          context.go('/market/${widget.marketSlug}/cart');
        case MainTab.account:
          await navigateToProtectedCustomerDestination(
            context,
            marketSlug: widget.marketSlug,
            destination: ProtectedCustomerDestination.account,
          );
        case MainTab.orders:
          await navigateToProtectedCustomerDestination(
            context,
            marketSlug: widget.marketSlug,
            destination: ProtectedCustomerDestination.orders,
          );
      }
    } finally {
      _tabNavBusy = false;
    }
  }
}
