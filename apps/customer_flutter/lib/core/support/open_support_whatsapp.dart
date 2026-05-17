import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

/// Override via: `--dart-define=NMD_SUPPORT_WHATSAPP=9725XXXXXXX`
const String kNmdSupportWhatsAppDigits = String.fromEnvironment(
  'NMD_SUPPORT_WHATSAPP',
  defaultValue: '',
);

/// Voice support line (digits, country code without +). Example: 9725XXXXXXX
const String kNmdSupportPhoneDigits = String.fromEnvironment(
  'NMD_SUPPORT_PHONE',
  defaultValue: '',
);

const String _defaultSupportMessage = 'مرحباً، أحتاج مساعدة بخصوص تطبيق نمضي.';

Future<bool> launchNmdSupportWhatsApp({
  ScaffoldMessengerState? messenger,
}) async {
  final clean = kNmdSupportWhatsAppDigits.replaceAll(RegExp(r'\D'), '');
  if (clean.isEmpty) {
    messenger?.showSnackBar(
      const SnackBar(content: Text('قريباً')),
    );
    return false;
  }
  final enc = Uri.encodeComponent(_defaultSupportMessage);
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
  messenger?.showSnackBar(
    const SnackBar(content: Text('تعذر فتح واتساب')),
  );
  return false;
}

Future<bool> _launchExternal(Uri uri) async {
  var ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
  if (!ok) {
    ok = await launchUrl(uri, mode: LaunchMode.platformDefault);
  }
  return ok;
}

/// Opens the dialer with [kNmdSupportPhoneDigits]. Shows SnackBar if not configured.
Future<bool> launchNmdSupportPhoneCall({
  ScaffoldMessengerState? messenger,
}) async {
  final clean = kNmdSupportPhoneDigits.replaceAll(RegExp(r'\D'), '');
  if (clean.isEmpty) {
    messenger?.showSnackBar(
      const SnackBar(content: Text('قريباً')),
    );
    return false;
  }
  final uri = Uri(scheme: 'tel', path: clean);
  try {
    if (await _launchExternal(uri)) return true;
  } catch (e, st) {
    debugPrint('tel: failed: $e\n$st');
  }
  messenger?.showSnackBar(
    const SnackBar(content: Text('تعذر بدء الاتصال')),
  );
  return false;
}
