import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

/// Override via: `--dart-define=NMD_PRIVACY_POLICY_URL=https://your-domain/privacy`
const String kNmdPrivacyPolicyUrl = String.fromEnvironment(
  'NMD_PRIVACY_POLICY_URL',
  defaultValue: '',
);

Future<bool> launchNmdPrivacyPolicy({
  ScaffoldMessengerState? messenger,
}) async {
  final url = kNmdPrivacyPolicyUrl.trim();
  if (url.isEmpty) {
    messenger?.showSnackBar(
      const SnackBar(
          content: Text('Privacy Policy URL is not configured yet.')),
    );
    return false;
  }
  final uri = Uri.tryParse(url);
  if (uri == null || (!uri.isScheme('https') && !uri.isScheme('http'))) {
    messenger?.showSnackBar(
      const SnackBar(
          content: Text('Invalid Privacy Policy URL configuration.')),
    );
    return false;
  }
  try {
    var ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!ok) ok = await launchUrl(uri, mode: LaunchMode.platformDefault);
    if (!ok) {
      messenger?.showSnackBar(
        const SnackBar(content: Text('Unable to open Privacy Policy link.')),
      );
    }
    return ok;
  } catch (e, st) {
    debugPrint('privacy policy launch failed: $e\n$st');
    messenger?.showSnackBar(
      const SnackBar(content: Text('Unable to open Privacy Policy link.')),
    );
    return false;
  }
}
