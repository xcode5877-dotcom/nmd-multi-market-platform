import 'dart:ui' show PointerDeviceKind;

import 'package:flutter/material.dart';

/// Global scroll physics (iOS/macOS: [BouncingScrollPhysics], others:
/// [ClampingScrollPhysics]) and drag scrolling for **mouse** and **touch** on web/desktop.
class NmdAppScrollBehavior extends MaterialScrollBehavior {
  const NmdAppScrollBehavior();

  @override
  Set<PointerDeviceKind> get dragDevices => {
        PointerDeviceKind.touch,
        PointerDeviceKind.mouse,
        PointerDeviceKind.stylus,
        PointerDeviceKind.trackpad,
      };

  @override
  ScrollPhysics getScrollPhysics(BuildContext context) {
    switch (Theme.of(context).platform) {
      case TargetPlatform.iOS:
      case TargetPlatform.macOS:
        return const BouncingScrollPhysics();
      default:
        return const ClampingScrollPhysics();
    }
  }
}
