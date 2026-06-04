import 'dart:async';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:go_router/go_router.dart';

import '../../firebase_options.dart';
import '../network/token_storage.dart';

/// Customer FCM: permissions, token upload, foreground display, tap routing.
final class PushNotificationService {
  PushNotificationService._();

  static final PushNotificationService instance = PushNotificationService._();

  final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();

  Future<void>? _bindFuture;
  bool _firebaseReady = false;
  GoRouter? _router;
  Dio? _dio;
  TokenStorage? _tokenStorage;

  bool get isReady => _firebaseReady;

  Future<void> bind({
    required GoRouter router,
    required Dio dio,
    required TokenStorage tokenStorage,
  }) {
    _router = router;
    _dio = dio;
    _tokenStorage = tokenStorage;
    _bindFuture ??= _bindInternal();
    return _bindFuture!;
  }

  Future<void> syncTokenAfterLogin() async {
    if (_bindFuture != null) {
      await _bindFuture;
    }
    if (!_firebaseReady) {
      debugPrint('[FCM_CLIENT] saveStatus=skipped firebaseNotReady');
      return;
    }
    try {
      final token = await FirebaseMessaging.instance.getToken();
      if (token == null || token.isEmpty) {
        debugPrint('[FCM_CLIENT] tokenPrefix=(null)');
        debugPrint('[FCM_CLIENT] saveStatus=skipped noToken');
        return;
      }
      debugPrint('[FCM_CLIENT] tokenPrefix=${token.substring(0, token.length.clamp(0, 12))}...');
      await _uploadToken(token);
    } catch (e, st) {
      debugPrint('[FCM_CLIENT] saveStatus=error getToken $e\n$st');
    }
  }

  Future<void> _bindInternal() async {
    try {
      await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
      _firebaseReady = true;
      debugPrint('[FCM_CLIENT] firebaseInitialized=true');
    } catch (e, st) {
      _firebaseReady = false;
      debugPrint('[FCM_CLIENT] firebaseInitialized=false $e\n$st');
      return;
    }

    await _setupLocalNotifications();
    final permission = await _requestPermissions();
    debugPrint('[FCM_CLIENT] permission=$permission');

    FirebaseMessaging.onMessage.listen(_onForegroundMessage);
    FirebaseMessaging.onMessageOpenedApp.listen(_onNotificationTap);
    final initial = await FirebaseMessaging.instance.getInitialMessage();
    if (initial != null) {
      _onNotificationTap(initial);
    }

    FirebaseMessaging.instance.onTokenRefresh.listen((token) {
      unawaited(_uploadToken(token));
    });

    final token = await FirebaseMessaging.instance.getToken();
    if (token != null && token.isNotEmpty) {
      debugPrint('[FCM_CLIENT] tokenPrefix=${token.substring(0, token.length.clamp(0, 12))}...');
      await _uploadToken(token);
    } else {
      debugPrint('[FCM_CLIENT] tokenPrefix=(null)');
    }
  }

  Future<void> _setupLocalNotifications() async {
    const android = AndroidInitializationSettings('@mipmap/ic_launcher');
    const ios = DarwinInitializationSettings();
    await _localNotifications.initialize(
      const InitializationSettings(android: android, iOS: ios),
      onDidReceiveNotificationResponse: (details) {
        final route = details.payload;
        if (route != null && route.isNotEmpty) {
          _navigate(route);
        }
      },
    );
    if (Platform.isAndroid) {
      const channel = AndroidNotificationChannel(
        'customer_notifications',
        'إشعارات Now Market',
        description: 'تحديثات الطلبات والعروض',
        importance: Importance.high,
      );
      await _localNotifications
          .resolvePlatformSpecificImplementation<
              AndroidFlutterLocalNotificationsPlugin>()
          ?.createNotificationChannel(channel);
    }
  }

  /// Returns a short permission summary for logs.
  Future<String> _requestPermissions() async {
    if (Platform.isIOS) {
      final settings = await FirebaseMessaging.instance.requestPermission(
        alert: true,
        badge: true,
        sound: true,
      );
      return 'ios:${settings.authorizationStatus.name}';
    }
    if (Platform.isAndroid) {
      final granted = await _localNotifications
              .resolvePlatformSpecificImplementation<
                  AndroidFlutterLocalNotificationsPlugin>()
              ?.requestNotificationsPermission() ??
          false;
      return 'android:${granted ? 'granted' : 'denied'}';
    }
    return 'other';
  }

  String _platformLabel() {
    if (Platform.isAndroid) return 'android';
    if (Platform.isIOS) return 'ios';
    return 'other';
  }

  Future<void> _uploadToken(String token) async {
    final dio = _dio;
    final storage = _tokenStorage;
    if (dio == null || storage == null) {
      debugPrint('[FCM_CLIENT] saveStatus=skipped noDioOrStorage');
      return;
    }
    final jwt = await storage.getCustomerToken();
    if (jwt == null || jwt.trim().isEmpty) {
      debugPrint('[FCM_CLIENT] saveStatus=skipped noCustomerJwt');
      return;
    }
    try {
      final response = await dio.post<void>(
        '/customer/save-fcm-token',
        data: {
          'token': token,
          'fcmToken': token,
          'platform': _platformLabel(),
        },
        options: Options(
          headers: {
            'Authorization': 'Bearer $jwt',
            'X-Client': 'NMD-Flutter-Customer',
          },
          validateStatus: (status) => status != null && status >= 200 && status < 300,
        ),
      );
      debugPrint('[FCM_CLIENT] saveStatus=ok http=${response.statusCode}');
    } on DioException catch (e) {
      debugPrint(
        '[FCM_CLIENT] saveStatus=fail http=${e.response?.statusCode} '
        '${e.response?.data ?? e.message}',
      );
    } catch (e) {
      debugPrint('[FCM_CLIENT] saveStatus=error $e');
    }
  }

  void _onForegroundMessage(RemoteMessage message) {
    final notification = message.notification;
    final title = notification?.title ?? message.data['title']?.toString() ?? 'Now Market';
    final body = notification?.body ?? message.data['body']?.toString() ?? '';
    final route = message.data['route']?.toString() ?? '';

    _localNotifications.show(
      message.hashCode,
      title,
      body,
      NotificationDetails(
        android: AndroidNotificationDetails(
          'customer_notifications',
          'إشعارات Now Market',
          channelDescription: 'تحديثات الطلبات والعروض',
          importance: Importance.high,
          priority: Priority.high,
        ),
        iOS: const DarwinNotificationDetails(),
      ),
      payload: route.isNotEmpty ? route : null,
    );
  }

  void _onNotificationTap(RemoteMessage message) {
    final route = message.data['route']?.toString();
    final orderId = message.data['orderId']?.toString();
    if (route != null && route.isNotEmpty) {
      _navigate(route);
      return;
    }
    if (orderId != null && orderId.isNotEmpty) {
      _navigateToOrders();
      return;
    }
    _navigate('/main');
  }

  void _navigate(String path) {
    final router = _router;
    if (router == null) return;
    try {
      if (path.startsWith('/')) {
        router.go(path);
      } else {
        router.go('/$path');
      }
    } catch (e) {
      debugPrint('[Push] navigate failed for $path: $e');
      _navigate('/main');
    }
  }

  void _navigateToOrders() {
    final router = _router;
    if (router == null) return;
    final location = router.routerDelegate.currentConfiguration.uri.path;
    final match = RegExp(r'^/market/([^/]+)').firstMatch(location);
    final slug = match?.group(1) ?? 'dabburiyya';
    router.go('/market/$slug/orders');
  }
}
