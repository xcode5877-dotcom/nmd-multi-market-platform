import 'dart:async';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:go_router/go_router.dart';

import '../network/token_storage.dart';

/// Customer FCM: permissions, token upload, foreground display, tap routing.
final class PushNotificationService {
  PushNotificationService._();

  static final PushNotificationService instance = PushNotificationService._();

  final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();

  bool _initialized = false;
  bool _firebaseReady = false;
  GoRouter? _router;
  Dio? _dio;
  TokenStorage? _tokenStorage;

  bool get isReady => _firebaseReady;

  Future<void> bind({
    required GoRouter router,
    required Dio dio,
    required TokenStorage tokenStorage,
  }) async {
    _router = router;
    _dio = dio;
    _tokenStorage = tokenStorage;
    if (_initialized) return;
    _initialized = true;

    try {
      await Firebase.initializeApp();
      _firebaseReady = true;
    } catch (e, st) {
      debugPrint('[Push] Firebase init skipped (add google-services / GoogleService-Info): $e\n$st');
      return;
    }

    await _setupLocalNotifications();
    await _requestPermissions();

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
    if (token != null) {
      await _uploadToken(token);
    }
  }

  Future<void> syncTokenAfterLogin() async {
    if (!_firebaseReady) return;
    final token = await FirebaseMessaging.instance.getToken();
    if (token != null) {
      await _uploadToken(token);
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

  Future<void> _requestPermissions() async {
    if (Platform.isIOS) {
      await FirebaseMessaging.instance.requestPermission(
        alert: true,
        badge: true,
        sound: true,
      );
    } else if (Platform.isAndroid) {
      await _localNotifications
          .resolvePlatformSpecificImplementation<
              AndroidFlutterLocalNotificationsPlugin>()
          ?.requestNotificationsPermission();
    }
  }

  Future<void> _uploadToken(String token) async {
    final dio = _dio;
    final storage = _tokenStorage;
    if (dio == null || storage == null) return;
    final jwt = await storage.getCustomerToken();
    if (jwt == null || jwt.trim().isEmpty) return;
    try {
      await dio.post<void>(
        '/customer/save-fcm-token',
        data: {'fcmToken': token},
        options: Options(
          headers: {
            'Authorization': 'Bearer $jwt',
            'X-Client': 'NMD-Flutter-Customer',
          },
        ),
      );
      if (kDebugMode) debugPrint('[Push] FCM token saved');
    } on DioException catch (e) {
      debugPrint('[Push] token upload failed: ${e.response?.statusCode} ${e.message}');
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
