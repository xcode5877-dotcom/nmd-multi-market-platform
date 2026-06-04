import 'dart:io' show Platform;

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:package_info_plus/package_info_plus.dart';

const String kDefaultForceUpdateMessageAr = 'يرجى تحديث التطبيق للاستمرار';

/// Result of the startup force-update check (Android or iOS).
final class AppUpdateGateResult {
  const AppUpdateGateResult({
    required this.mustForceUpdate,
    this.messageAr = kDefaultForceUpdateMessageAr,
    this.iosAppStoreId,
  });

  final bool mustForceUpdate;
  final String messageAr;

  /// Set when iOS must force-update; used for App Store deep link.
  final String? iosAppStoreId;
}

bool isAndroidPlatform() {
  if (kIsWeb) return false;
  return Platform.isAndroid;
}

bool isIosPlatform() {
  if (kIsWeb) return false;
  return Platform.isIOS;
}

/// Pure comparison used by [AppUpdateGate] and tests.
bool mustForceAndroidUpdate({
  required int currentVersionCode,
  required int minimumVersionCode,
}) {
  return currentVersionCode < minimumVersionCode;
}

bool mustForceIosUpdate({
  required int currentBuildNumber,
  required int minimumBuildNumber,
}) {
  return currentBuildNumber < minimumBuildNumber;
}

int? _parseIntField(Object? raw) {
  if (raw is int) return raw;
  if (raw is num) return raw.toInt();
  return int.tryParse(raw?.toString() ?? '');
}

int? parseAndroidMinimumVersionCode(Map<String, dynamic>? json) {
  if (json == null) return null;
  final android = json['android'];
  if (android is! Map) return null;
  return _parseIntField(android['minimumVersionCode']);
}

int? parseIosMinimumBuildNumber(Map<String, dynamic>? json) {
  if (json == null) return null;
  final ios = json['ios'];
  if (ios is! Map) return null;
  return _parseIntField(ios['minimumBuildNumber']);
}

String? parseIosAppStoreId(Map<String, dynamic>? json) {
  if (json == null) return null;
  final ios = json['ios'];
  if (ios is! Map) return null;
  final raw = ios['appStoreId'];
  if (raw == null) return null;
  final id = raw.toString().trim();
  return id.isEmpty ? null : id;
}

String parseForceUpdateMessageAr(
  Map<String, dynamic>? json, {
  required String platformKey,
}) {
  if (json == null) return kDefaultForceUpdateMessageAr;
  final block = json[platformKey];
  if (block is! Map) return kDefaultForceUpdateMessageAr;
  final msg = block['forceUpdateMessageAr'];
  if (msg is String && msg.trim().isNotEmpty) return msg.trim();
  return kDefaultForceUpdateMessageAr;
}

/// Fetches `/app-config` and decides whether the app must block below server minimum.
final class AppUpdateGate {
  AppUpdateGate._();

  static Future<AppUpdateGateResult> check(Dio dio) async {
    if (!isAndroidPlatform() && !isIosPlatform()) {
      return const AppUpdateGateResult(mustForceUpdate: false);
    }

    try {
      final packageInfo = await PackageInfo.fromPlatform();
      final currentBuild = int.tryParse(packageInfo.buildNumber) ?? 0;

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

      if (isAndroidPlatform()) {
        final minimum = parseAndroidMinimumVersionCode(payload);
        if (minimum == null) {
          return const AppUpdateGateResult(mustForceUpdate: false);
        }
        if (mustForceAndroidUpdate(
          currentVersionCode: currentBuild,
          minimumVersionCode: minimum,
        )) {
          return AppUpdateGateResult(
            mustForceUpdate: true,
            messageAr: parseForceUpdateMessageAr(payload, platformKey: 'android'),
          );
        }
        return const AppUpdateGateResult(mustForceUpdate: false);
      }

      if (isIosPlatform()) {
        final appStoreId = parseIosAppStoreId(payload);
        if (appStoreId == null) {
          return const AppUpdateGateResult(mustForceUpdate: false);
        }
        final minimum = parseIosMinimumBuildNumber(payload);
        if (minimum == null) {
          return const AppUpdateGateResult(mustForceUpdate: false);
        }
        if (mustForceIosUpdate(
          currentBuildNumber: currentBuild,
          minimumBuildNumber: minimum,
        )) {
          return AppUpdateGateResult(
            mustForceUpdate: true,
            messageAr: parseForceUpdateMessageAr(payload, platformKey: 'ios'),
            iosAppStoreId: appStoreId,
          );
        }
      }
    } catch (_) {
      // Network / parse failures must not block the app.
    }

    return const AppUpdateGateResult(mustForceUpdate: false);
  }
}
