import 'support_config.dart';

/// Context for order-details WhatsApp prefill (customer may edit before send).
class SupportOrderContext {
  const SupportOrderContext({
    required this.orderId,
    this.orderGroupId,
    this.status,
    this.storeName,
    this.includeGroupId = false,
  });

  final String orderId;
  final String? orderGroupId;

  /// Prefer a localized / human-readable status label.
  final String? status;
  final String? storeName;

  /// Group id is operational; omit from the main human-readable message by default.
  final bool includeGroupId;

  String get shortOrderNumber => shortSupportOrderNumber(orderId);
}

/// Builds WhatsApp prefills. Never logs or persists the message body.
String buildSupportWhatsAppMessage({
  required SupportConfig config,
  SupportOrderContext? order,
}) {
  if (order == null) {
    final def = config.defaultWhatsappMessage.trim();
    if (def.isNotEmpty) return def;
    return 'مرحبًا،\n\nأحتاج إلى المساعدة في تطبيق Now Market.';
  }

  final buf = StringBuffer()
    ..writeln('مرحبًا')
    ..writeln()
    ..writeln('أحتاج إلى المساعدة بخصوص طلبي في Now Market')
    ..writeln()
    ..writeln('رقم الطلب: ${order.shortOrderNumber}');

  final store = order.storeName?.trim();
  if (store != null && store.isNotEmpty) {
    buf.writeln('المتجر: $store');
  }

  final status = order.status?.trim();
  if (status != null && status.isNotEmpty) {
    buf.writeln('حالة الطلب: $status');
  }

  if (order.includeGroupId) {
    final group = order.orderGroupId?.trim();
    if (group != null && group.isNotEmpty) {
      buf
        ..writeln()
        ..writeln('رقم المجموعة: $group');
    }
  }

  buf
    ..writeln()
    ..writeln('شكرًا لكم');
  return buf.toString();
}
