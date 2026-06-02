import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

import 'app/app.dart';
import 'app/app_scroll_behavior.dart';
import 'core/debug/nmd_post_login_trace.dart';
import 'firebase_options.dart';

void _installNmdGlobalErrorSurfaces() {
  FlutterError.onError = (details) {
    nmdPostLoginTrace(
      'FLUTTER_ERROR',
      '${details.exceptionAsString()}\n${details.stack}',
    );
    FlutterError.presentError(details);
  };

  ErrorWidget.builder = (FlutterErrorDetails details) {
    nmdPostLoginTrace(
      'WIDGET_BUILD_FAILED',
      details.exceptionAsString(),
    );
    return Material(
      color: Colors.white,
      child: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(
                  Icons.error_outline_rounded,
                  size: 48,
                  color: Color(0xFF0F6F6B),
                ),
                const SizedBox(height: 16),
                Text(
                  'تعذر عرض الشاشة',
                  textAlign: TextAlign.center,
                  style: GoogleFonts.cairo(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    color: const Color(0xFF0F172A),
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  kDebugMode
                      ? details.exceptionAsString()
                      : 'حاول إغلاق التطبيق وفتحه من جديد، أو العودة للخلف.',
                  textAlign: TextAlign.center,
                  style: GoogleFonts.cairo(
                    fontSize: 13,
                    color: const Color(0xFF64748B),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  };
}

@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
}

void main() {
  final widgetsBinding = WidgetsFlutterBinding.ensureInitialized();
  FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);
  _installNmdGlobalErrorSurfaces();
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
