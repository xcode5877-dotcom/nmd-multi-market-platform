import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'app/app.dart';
import 'app/app_scroll_behavior.dart';

void main() {
  final widgetsBinding = WidgetsFlutterBinding.ensureInitialized();
  // Hold LaunchScreen until SplashPage calls allowFirstFrame (same as flutter_native_splash on iOS).
  widgetsBinding.deferFirstFrame();
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.light,
    statusBarBrightness: Brightness.dark,
    systemNavigationBarColor: Color(0xFF0F6F6B),
    systemNavigationBarIconBrightness: Brightness.light,
  ));
  runApp(
    ScrollConfiguration(
      behavior: const NmdAppScrollBehavior(),
      child: const NowMarketApp(),
    ),
  );
}
