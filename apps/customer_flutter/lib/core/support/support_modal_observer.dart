import 'package:flutter/material.dart';

/// Tracks popup / modal routes so the floating capsule can hide safely.
class SupportModalRouteObserver extends NavigatorObserver {
  SupportModalRouteObserver(this.modalDepth);

  final ValueNotifier<int> modalDepth;

  void _bump(Route<dynamic> route, int delta) {
    if (route is PopupRoute) {
      final next = (modalDepth.value + delta).clamp(0, 100);
      if (next != modalDepth.value) modalDepth.value = next;
    }
  }

  @override
  void didPush(Route<dynamic> route, Route<dynamic>? previousRoute) {
    _bump(route, 1);
  }

  @override
  void didPop(Route<dynamic> route, Route<dynamic>? previousRoute) {
    _bump(route, -1);
  }

  @override
  void didRemove(Route<dynamic> route, Route<dynamic>? previousRoute) {
    _bump(route, -1);
  }

  @override
  void didReplace({Route<dynamic>? newRoute, Route<dynamic>? oldRoute}) {
    if (oldRoute is PopupRoute) _bump(oldRoute, -1);
    if (newRoute is PopupRoute) _bump(newRoute, 1);
  }
}
