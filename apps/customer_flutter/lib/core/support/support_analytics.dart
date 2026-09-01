import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

/// Support Center analytics — event names only (no message content / PII).
abstract final class SupportAnalyticsEvents {
  static const pageOpened = 'support_page_opened';
  static const floatingImpression = 'floating_support_impression';
  static const hubOpened = 'support_hub_opened';
  static const whatsappClick = 'whatsapp_click';
  static const phoneClick = 'phone_click';
  static const orderSupportClick = 'order_support_click';
  static const copyOrderNumber = 'copy_order_number';
}

Future<void> trackSupportEvent(
  Dio? dio,
  String event, {
  String? source,
  bool? hasOrderContext,
}) async {
  if (dio == null) return;
  try {
    await dio.post<dynamic>(
      '/analytics/support',
      data: <String, dynamic>{
        'event': event,
        if (source != null && source.isNotEmpty) 'source': source,
        if (hasOrderContext != null) 'hasOrderContext': hasOrderContext,
      },
      options: Options(
        sendTimeout: const Duration(seconds: 4),
        receiveTimeout: const Duration(seconds: 4),
      ),
    );
  } catch (e, st) {
    debugPrint('trackSupportEvent($event): $e\n$st');
  }
}
