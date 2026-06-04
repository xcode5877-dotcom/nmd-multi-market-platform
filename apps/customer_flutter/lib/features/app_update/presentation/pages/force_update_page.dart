import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../core/app_update/app_update_gate.dart';

const String _playStorePackageId = 'com.nowmarket.app';

/// Full-screen blocking update prompt (force-update gate).
class ForceUpdatePage extends StatelessWidget {
  const ForceUpdatePage({
    super.key,
    required this.messageAr,
    this.iosAppStoreId,
  });

  final String messageAr;

  /// Required on iOS to open the App Store; ignored on Android.
  final String? iosAppStoreId;

  Future<void> _openStore() async {
    if (!kIsWeb && Platform.isIOS) {
      final id = iosAppStoreId?.trim();
      if (id == null || id.isEmpty) return;
      final itmsUri = Uri.parse('itms-apps://itunes.apple.com/app/id$id');
      if (await canLaunchUrl(itmsUri)) {
        await launchUrl(itmsUri, mode: LaunchMode.externalApplication);
        return;
      }
      final webUri = Uri.parse('https://apps.apple.com/app/id$id');
      await launchUrl(webUri, mode: LaunchMode.externalApplication);
      return;
    }

    final marketUri = Uri.parse('market://details?id=$_playStorePackageId');
    if (await canLaunchUrl(marketUri)) {
      await launchUrl(marketUri, mode: LaunchMode.externalApplication);
      return;
    }
    final webUri = Uri.parse(
      'https://play.google.com/store/apps/details?id=$_playStorePackageId',
    );
    await launchUrl(webUri, mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      child: Scaffold(
        backgroundColor: const Color(0xFF0F6F6B),
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 28),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(
                  Icons.system_update_alt_rounded,
                  size: 72,
                  color: Colors.white,
                ),
                const SizedBox(height: 28),
                Text(
                  'تحديث مطلوب',
                  textAlign: TextAlign.center,
                  style: GoogleFonts.cairo(
                    fontSize: 26,
                    fontWeight: FontWeight.w800,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  messageAr.trim().isNotEmpty
                      ? messageAr.trim()
                      : kDefaultForceUpdateMessageAr,
                  textAlign: TextAlign.center,
                  style: GoogleFonts.cairo(
                    fontSize: 16,
                    height: 1.5,
                    fontWeight: FontWeight.w600,
                    color: Colors.white.withValues(alpha: 0.92),
                  ),
                ),
                const SizedBox(height: 40),
                SizedBox(
                  width: double.infinity,
                  height: 52,
                  child: FilledButton(
                    onPressed: _openStore,
                    style: FilledButton.styleFrom(
                      backgroundColor: Colors.white,
                      foregroundColor: const Color(0xFF0F6F6B),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                    ),
                    child: Text(
                      'تحديث التطبيق',
                      style: GoogleFonts.cairo(
                        fontSize: 17,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
