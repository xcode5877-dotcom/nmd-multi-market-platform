import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../api/api_base.dart';
import '../data/tenant_contact_info.dart';
import '../domain/service_inquiry_message.dart';

TenantContactInfo _effectiveContact(
    TenantContactInfo contact, TenantContactInfo? tenantContact) {
  final office = tenantContact ?? contact;
  return mergeContactWithOffice(contact, office);
}

/// Digits only — strip everything else (spaces, +, dashes, etc.).
String digitsOnly(String? raw) => (raw ?? '').replaceAll(RegExp(r'\D'), '');

/// Prefer WhatsApp field, then phone, then any tel fallback.
String digitsForWhatsApp(TenantContactInfo c) {
  var d = digitsOnly(c.whatsappDigits);
  if (d.isEmpty) d = digitsOnly(c.phoneDigits);
  if (d.isEmpty) d = digitsOnly(c.telDigits);
  return d;
}

/// Prefer voice line, then WhatsApp number.
String digitsForCall(TenantContactInfo c) {
  var d = digitsOnly(c.telDigits);
  if (d.isEmpty) d = digitsOnly(c.phoneDigits);
  if (d.isEmpty) d = digitsOnly(c.whatsappDigits);
  return d;
}

/// Fire-and-forget: POST `/leads` (web parity), then `whatsapp://` / `tel:`.
Future<void> postProfessionalLead(
  Dio dio, {
  required String tenantId,
  required String contactType,
  String? customerPhone,
}) async {
  try {
    await dio.post<dynamic>(
      '/leads',
      data: <String, dynamic>{
        'tenantId': tenantId,
        'type': 'PROFESSIONAL_CONTACT',
        'status': 'NEW',
        'contactType': contactType,
        'timestamp': DateTime.now().toUtc().toIso8601String(),
        'metadata': <String, dynamic>{
          if (customerPhone != null && customerPhone.trim().isNotEmpty)
            'customerPhone': customerPhone.trim(),
        },
      },
    );
  } catch (e, st) {
    debugPrint('postProfessionalLead: $e\n$st');
  }
  await Future<void>.delayed(const Duration(milliseconds: 80));
}

ScaffoldMessengerState? _snackbarMessenger(BuildContext? context) {
  if (context == null || !context.mounted) return null;
  return ScaffoldMessenger.maybeOf(context);
}

void _snack(ScaffoldMessengerState? m, String message) {
  m?.showSnackBar(SnackBar(content: Text(message)));
}

Future<bool> _launchExternal(Uri uri) async {
  try {
    var ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!ok) {
      ok = await launchUrl(uri, mode: LaunchMode.platformDefault);
    }
    return ok;
  } catch (e, st) {
    debugPrint('launchUrl $uri: $e\n$st');
    return false;
  }
}

Future<bool> _launchWhatsAppWithFallback(
  String clean,
  String text,
  ScaffoldMessengerState? messenger,
) async {
  final enc = Uri.encodeComponent(text);
  final direct = Uri.parse('whatsapp://send?phone=$clean&text=$enc');
  // ignore: avoid_print
  nmdDebugLog('launchWhatsApp direct: $direct');
  try {
    if (await _launchExternal(direct)) return true;
  } catch (e, st) {
    debugPrint('whatsapp:// failed: $e\n$st');
  }
  try {
    final waMe = Uri.parse('https://wa.me/$clean?text=$enc');
    // ignore: avoid_print
    nmdDebugLog('launchWhatsApp fallback wa.me: $waMe');
    if (await _launchExternal(waMe)) return true;
  } catch (e, st) {
    debugPrint('wa.me failed: $e\n$st');
  }
  _snack(messenger, 'تعذّر فتح الواتساب.\nالرقم: $clean');
  return false;
}

/// [messageOverride] wins; else builds from [serviceName].
/// [tenantContact] = store/office — used when [contact] is product-scoped and missing digits.
Future<void> launchWhatsAppInquiry({
  required Dio dio,
  required String tenantId,
  required TenantContactInfo contact,
  TenantContactInfo? tenantContact,
  String serviceName = '',
  String? messageOverride,
  String? customerPhone,
  BuildContext? context,
}) async {
  final messenger = _snackbarMessenger(context);
  final effective = _effectiveContact(contact, tenantContact);
  final clean = digitsForWhatsApp(effective);
  if (clean.isEmpty) {
    debugPrint('launchWhatsAppInquiry: no digits after tenant merge');
    return;
  }

  await postProfessionalLead(dio,
      tenantId: tenantId,
      contactType: 'whatsapp',
      customerPhone: customerPhone);
  final text = (messageOverride != null && messageOverride.trim().isNotEmpty)
      ? messageOverride.trim()
      : serviceInquiryWhatsAppMessage(serviceName);

  final ok = await _launchWhatsAppWithFallback(clean, text, messenger);
  if (!ok && kDebugMode)
    debugPrint('launchWhatsAppInquiry: all attempts failed clean=$clean');
}

Future<void> launchPhoneCall({
  required Dio dio,
  required String tenantId,
  required TenantContactInfo contact,
  TenantContactInfo? tenantContact,
  String? customerPhone,
  BuildContext? context,
}) async {
  final messenger = _snackbarMessenger(context);
  final effective = _effectiveContact(contact, tenantContact);
  final clean = digitsForCall(effective);
  if (clean.isEmpty) {
    debugPrint('launchPhoneCall: no digits after tenant merge');
    return;
  }

  await postProfessionalLead(dio,
      tenantId: tenantId, contactType: 'call', customerPhone: customerPhone);
  final uri = Uri.parse('tel:$clean');
  // ignore: avoid_print
  nmdDebugLog('launchPhoneCall: $uri');

  final ok = await _launchExternal(uri);
  if (!ok) {
    _snack(messenger, 'تعذّر فتح الاتصال.\nالرقم: $clean');
    if (kDebugMode) debugPrint('launchPhoneCall failed uri=$uri');
  }
}

/// Checkout: track lead then open WhatsApp with full order text (store office contact).
Future<bool> launchWhatsAppCheckoutOrder({
  required Dio dio,
  required String tenantId,
  required TenantContactInfo office,
  required String message,
  String? customerPhone,
  BuildContext? context,
  ScaffoldMessengerState? scaffoldMessenger,
}) async {
  final messenger = scaffoldMessenger ?? _snackbarMessenger(context);
  final effective = mergeContactWithOffice(null, office);
  final clean = digitsForWhatsApp(effective);
  if (clean.isEmpty) {
    debugPrint('launchWhatsAppCheckoutOrder: no store WhatsApp/phone');
    return false;
  }
  try {
    await dio.post<dynamic>(
      '/leads',
      data: <String, dynamic>{
        'tenantId': tenantId,
        'type': 'PROFESSIONAL_CONTACT',
        'status': 'NEW',
        'contactType': 'whatsapp_order',
        'timestamp': DateTime.now().toUtc().toIso8601String(),
        'metadata': <String, dynamic>{
          'channel': 'native_checkout',
          'orderPreview': message.length > 2000
              ? '${message.substring(0, 2000)}…'
              : message,
          if (customerPhone != null && customerPhone.trim().isNotEmpty)
            'customerPhone': customerPhone.trim(),
        },
      },
    );
  } catch (e, st) {
    debugPrint('post checkout lead: $e\n$st');
  }
  await Future<void>.delayed(const Duration(milliseconds: 80));
  final ok = await _launchWhatsAppWithFallback(clean, message, messenger);
  if (!ok && kDebugMode)
    debugPrint('launchWhatsAppCheckoutOrder failed clean=$clean');
  return ok;
}

/// Open Maps (Google) from address text or lat/lng — used by service provider profile.
Future<void> launchMapsLocation({
  String? address,
  double? lat,
  double? lng,
  BuildContext? context,
}) async {
  final messenger = _snackbarMessenger(context);
  Uri? uri;
  if (lat != null && lng != null) {
    uri = Uri.parse(
      'https://www.google.com/maps/search/?api=1&query=${Uri.encodeComponent('$lat,$lng')}',
    );
  } else if (address != null && address.trim().isNotEmpty) {
    uri = Uri.parse(
      'https://www.google.com/maps/search/?api=1&query=${Uri.encodeComponent(address.trim())}',
    );
  }
  if (uri == null) {
    _snack(messenger, 'لا يوجد عنوان أو موقع على الخريطة');
    return;
  }
  final ok = await _launchExternal(uri);
  if (!ok) {
    _snack(messenger, 'تعذّر فتح الخرائط');
    if (kDebugMode) debugPrint('launchMapsLocation failed uri=$uri');
  }
}
