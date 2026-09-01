import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'order_window_log.dart';

bool _isMarketHomePath(String path) {
  final segs = Uri.tryParse(path)?.pathSegments ?? [];
  return segs.length == 2 && segs[0] == 'market';
}

/// Release-visible navigator + GoRouter tracing for post-checkout routing.
class OrderWindowNavigatorObserver extends NavigatorObserver {
  @override
  void didPush(Route<dynamic> route, Route<dynamic>? previousRoute) {
    orderWindowLog(
      '[ORDER_WINDOW] Navigator didPush name=${route.settings.name} '
      'prev=${previousRoute?.settings.name}',
    );
    _logHomeIfNeeded('Navigator.didPush', route.settings.name);
  }

  @override
  void didPop(Route<dynamic> route, Route<dynamic>? previousRoute) {
    orderWindowLog(
      '[ORDER_WINDOW] Navigator didPop name=${route.settings.name} '
      'prev=${previousRoute?.settings.name}',
    );
    _logHomeIfNeeded('Navigator.didPop', previousRoute?.settings.name);
  }

  @override
  void didReplace({Route<dynamic>? newRoute, Route<dynamic>? oldRoute}) {
    orderWindowLog(
      '[ORDER_WINDOW] Navigator didReplace new=${newRoute?.settings.name} '
      'old=${oldRoute?.settings.name}',
    );
    _logHomeIfNeeded('Navigator.didReplace', newRoute?.settings.name);
  }

  void _logHomeIfNeeded(String source, String? routeName) {
    final path = routeName ?? '';
    if (_isMarketHomePath(path)) {
      orderWindowLog(
        '[ORDER_WINDOW] HOME NAVIGATION CALLED from $source location=$path',
      );
    }
  }
}

/// Logs every GoRouter location change (release-visible).
class OrderWindowGoRouterObserver extends NavigatorObserver {
  OrderWindowGoRouterObserver(this._router);

  final GoRouter _router;
  String? _lastPath;

  void attach() {
    if (_attached) return;
    _attached = true;
    _lastPath = _router.state.uri.path;
    _router.routerDelegate.addListener(_onRouteChanged);
  }

  void detach() {
    if (!_attached) return;
    _attached = false;
    _router.routerDelegate.removeListener(_onRouteChanged);
  }

  bool _attached = false;

  void _onRouteChanged() {
    final path = _router.state.uri.path;
    if (path == _lastPath) return;
    final old = _lastPath ?? '';
    _lastPath = path;
    orderWindowLog('[ORDER_WINDOW] route changed old=$old new=$path');
    if (_isMarketHomePath(path)) {
      orderWindowLog(
        '[ORDER_WINDOW] HOME NAVIGATION CALLED from GoRouter.location location=$path',
      );
    }
  }
}
