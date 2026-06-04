import 'dart:io' show Platform;

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:package_info_plus/package_info_plus.dart';

const String kDefaultForceUpdateMessageAr = 'يرجى تحديث التطبيق للاستمرار';

/// Result of the startup Android force-update check.
final class AppUpdateGateResult {
  const AppUpdateGateResult({
    required this.mustForceUpdate,
    this.messageAr = kDefaultForceUpdateMessageAr,
  });

  final bool mustForceUpdate;
  final String messageAr;
}

bool isAndroidPlatform() {
  if (kIsWeb) return false;
  return Platform.isAndroid;
}

/// Pure comparison used by [AppUpdateGate] and tests.
bool mustForceAndroidUpdate({
  required int currentVersionCode,
  required int minimumVersionCode,
}) {
  return currentVersionCode < minimumVersionCode;
}

int? parseAndroidMinimumVersionCode(Map<String, dynamic>? json) {
  if (json == null) return null;
  final android = json['android'];
  if (android is! Map) return null;
  final raw = android['minimumVersionCode'];
  if (raw is int) return raw;
  if (raw is num) return raw.toInt();
  return int.tryParse(raw?.toString() ?? '');
}

String parseForceUpdateMessageAr(Map<String, dynamic>? json) {
  if (json == null) return kDefaultForceUpdateMessageAr;
  final android = json['android'];
  if (android is! Map) return kDefaultForceUpdateMessageAr;
  final msg = android['forceUpdateMessageAr'];
  if (msg is String && msg.trim().isNotEmpty) return msg.trim();
  return kDefaultForceUpdateMessageAr;
}

/// Fetches `/app-config` and decides whether Android must block below [minimumVersionCode].
final class AppUpdateGate {
  AppUpdateGate._();

  static Future<AppUpdateGateResult> check(Dio dio) async {
    if (!isAndroidPlatform()) {
      return const AppUpdateGateResult(mustForceUpdate: false);
    }

    try {
      final packageInfo = await PackageInfo.fromPlatform();
      final currentCode = int.tryParse(packageInfo.buildNumber) ?? 0;

      final response = await dio.get<dynamic>(
        '/app-config',
        options: Options(
          receiveTimeout: const Duration(seconds: 8),
          sendTimeout: const Duration(seconds: 8),
        ),
      );

      final data = response.data;
      if (data is! Map) {
        return const AppUpdateGateResult(mustForceUpdate: false);
      }
      final payload = Map<String, dynamic>.from(data);
      final minimum = parseAndroidMinimumVersionCode(payload);
      if (minimum == null) {
        return const AppUpdateGateResult(mustForceUpdate: false);
      }

      if (mustForceAndroidUpdate(
        currentVersionCode: currentCode,
        minimumVersionCode: minimum,
      )) {
        return AppUpdateGateResult(
          mustForceUpdate: true,
          messageAr: parseForceUpdateMessageAr(payload),
        );
      }
    } catch (_) {
      // Network / parse failures must not block the app.
    }

    return const AppUpdateGateResult(mustForceUpdate: false);
  }
}
