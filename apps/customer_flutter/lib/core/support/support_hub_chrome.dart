import 'package:flutter/material.dart';

import 'support_modal_observer.dart';

/// Process-wide chrome for the floating Support Hub (single observer + depth).
abstract final class SupportHubChrome {
  /// Root navigator — required because the hub host mounts in
  /// [MaterialApp.builder] (above the navigator).
  static final GlobalKey<NavigatorState> rootNavigatorKey =
      GlobalKey<NavigatorState>(debugLabel: 'nmd-root-nav');

  static final ValueNotifier<int> modalDepth = ValueNotifier<int>(0);

  static final SupportModalRouteObserver modalObserver =
      SupportModalRouteObserver(modalDepth);

  static BuildContext? get navigatorContext =>
      rootNavigatorKey.currentContext;

  @visibleForTesting
  static void resetForTest() {
    modalDepth.value = 0;
  }
}
