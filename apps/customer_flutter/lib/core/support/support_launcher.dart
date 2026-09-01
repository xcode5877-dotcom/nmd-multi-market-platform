import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import 'support_analytics.dart';
import 'support_config.dart';
import 'support_config_repository.dart';
import 'support_message_builder.dart';

bool _launchInFlight = false;

@visibleForTesting
void resetSupportLaunchGuardForTest() => _launchInFlight = false;

Future<bool> _launchExternal(Uri uri) async {
  var ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
  if (!ok) {
    ok = await launchUrl(uri, mode: LaunchMode.platformDefault);
  }
  return ok;
}

void _snack(ScaffoldMessengerState? messenger, String message) {
  messenger?.showSnackBar(SnackBar(content: Text(message)));
}

Future<T?> _withLaunchGuard<T>(Future<T> Function() action) async {
  if (_launchInFlight) return null;
  _launchInFlight = true;
  try {
    return await action();
  } finally {
    _launchInFlight = false;
  }
}

/// Opens WhatsApp with configured number + prefilled message (editable by user).
Future<bool> launchSupportWhatsApp({
  required SupportConfig config,
  ScaffoldMessengerState? messenger,
  Dio? dio,
  SupportOrderContext? order,
  String analyticsSource = 'support_page',
}) async {
  final result = await _withLaunchGuard(() async {
    if (!config.supportEnabled || !config.whatsappEnabled) {
      _snack(messenger, 'الدعم غير متاح حالياً');
      return false;
    }
    final clean = digitsForWhatsApp(config.supportWhatsapp);
    if (clean.isEmpty) {
      _snack(messenger, 'الدعم غير متاح حالياً');
      return false;
    }

    final event = order != null
        ? SupportAnalyticsEvents.orderSupportClick
        : SupportAnalyticsEvents.whatsappClick;
    // Fire-and-forget — never await analytics before opening the channel.
    // ignore: unawaited_futures
    trackSupportEvent(
      dio,
      event,
      source: analyticsSource,
      hasOrderContext: order != null,
    );

    final text = buildSupportWhatsAppMessage(config: config, order: order);
    final enc = Uri.encodeComponent(text);
    final direct = Uri.parse('whatsapp://send?phone=$clean&text=$enc');
    try {
      if (await _launchExternal(direct)) return true;
    } catch (e, st) {
      debugPrint('whatsapp:// failed: $e\n$st');
    }
    try {
      final waMe = Uri.parse('https://wa.me/$clean?text=$enc');
      if (await _launchExternal(waMe)) return true;
    } catch (e, st) {
      debugPrint('wa.me failed: $e\n$st');
    }
    _snack(messenger, 'تعذر فتح واتساب');
    return false;
  });
  return result ?? false;
}

/// Opens the system dialer with the configured support line.
Future<bool> launchSupportPhoneCall({
  required SupportConfig config,
  ScaffoldMessengerState? messenger,
  Dio? dio,
  String analyticsSource = 'support_page',
  bool hasOrderContext = false,
}) async {
  final result = await _withLaunchGuard(() async {
    if (!config.supportEnabled || !config.phoneEnabled) {
      _snack(messenger, 'الدعم غير متاح حالياً');
      return false;
    }
    final clean = digitsForDial(config.supportPhone);
    if (clean.isEmpty) {
      _snack(messenger, 'الدعم غير متاح حالياً');
      return false;
    }

    // ignore: unawaited_futures
    trackSupportEvent(
      dio,
      SupportAnalyticsEvents.phoneClick,
      source: analyticsSource,
      hasOrderContext: hasOrderContext,
    );

    final uri = Uri(scheme: 'tel', path: clean);
    try {
      if (await _launchExternal(uri)) return true;
    } catch (e, st) {
      debugPrint('tel: failed: $e\n$st');
    }
    _snack(messenger, 'تعذر بدء الاتصال. تأكد أن جهازك يدعم المكالمات.');
    return false;
  });
  return result ?? false;
}

/// Convenience: fetch latest config then launch WhatsApp.
Future<bool> launchSupportWhatsAppLive({
  required Dio dio,
  ScaffoldMessengerState? messenger,
  SupportOrderContext? order,
  String analyticsSource = 'support_page',
}) async {
  final repo = SupportConfigRepository(dio);
  final config = await repo.fetch();
  return launchSupportWhatsApp(
    config: config,
    messenger: messenger,
    dio: dio,
    order: order,
    analyticsSource: analyticsSource,
  );
}

/// Convenience: fetch latest config then launch phone dialer.
Future<bool> launchSupportPhoneCallLive({
  required Dio dio,
  ScaffoldMessengerState? messenger,
  String analyticsSource = 'support_page',
  bool hasOrderContext = false,
}) async {
  final repo = SupportConfigRepository(dio);
  final config = await repo.fetch();
  return launchSupportPhoneCall(
    config: config,
    messenger: messenger,
    dio: dio,
    analyticsSource: analyticsSource,
    hasOrderContext: hasOrderContext,
  );
}
