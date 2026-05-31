import 'package:flutter/material.dart';

import '../../../../design_system/design_system.dart';

/// Minimal store profile block — retail / fallback only.
class ProfessionalStoreInfoSection extends StatelessWidget {
  const ProfessionalStoreInfoSection({
    super.key,
    required this.aboutPlain,
    required this.openTime,
    required this.closeTime,
    required this.operatingStatus,
    required this.isAdminClosed,
    required this.showPrimaryContact,
    required this.onPrimaryContact,
    this.subtitleTag,
  });

  final String aboutPlain;
  final String openTime;
  final String closeTime;
  final String operatingStatus;
  final bool isAdminClosed;
  final bool showPrimaryContact;
  final VoidCallback onPrimaryContact;
  final String? subtitleTag;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        CinematicStoreProfile(
          aboutPlain: aboutPlain,
          openTime: openTime,
          closeTime: closeTime,
          operatingStatus: operatingStatus,
          isAdminClosed: isAdminClosed,
        ),
        if (showPrimaryContact)
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 8),
            child: SizedBox(
              height: PremiumMarketplaceDesignSystem.dockHeight,
              child: FilledButton(
                onPressed: onPrimaryContact,
                style: FilledButton.styleFrom(
                  backgroundColor: NmdColors.brandPrimary,
                  shape: RoundedRectangleBorder(
                    borderRadius: PremiumMarketplaceDesignSystem.borderMd,
                  ),
                ),
                child: Text(
                  'احجز الآن',
                  style: NmdTypography.button.copyWith(fontSize: 14),
                ),
              ),
            ),
          ),
      ],
    );
  }
}

/// Compact profile snippet for non-cinematic contexts.
class CinematicStoreProfile extends StatelessWidget {
  const CinematicStoreProfile({
    super.key,
    required this.aboutPlain,
    required this.openTime,
    required this.closeTime,
    required this.operatingStatus,
    required this.isAdminClosed,
  });

  final String aboutPlain;
  final String openTime;
  final String closeTime;
  final String operatingStatus;
  final bool isAdminClosed;

  @override
  Widget build(BuildContext context) {
    final about = aboutPlain.trim();
    final preview = about.length > 100 ? '${about.substring(0, 98)}…' : about;
    final status = isAdminClosed
        ? 'مغلق مؤقتاً'
        : NmdSemantic.storeStatusLabelAr(
            NmdSemantic.storeStatusFromApi(operatingStatus),
          );

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 4),
      child: Directionality(
        textDirection: TextDirection.rtl,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '$status • $openTime - $closeTime',
              style: NmdTypography.micro.copyWith(
                color: NmdColors.textSecondary,
                fontSize: 11,
              ),
            ),
            if (preview.isNotEmpty) ...[
              const SizedBox(height: 12),
              Text(
                preview,
                style: NmdTypography.body.copyWith(
                  color: NmdColors.textPrimary.withValues(alpha: 0.75),
                  height: 1.65,
                  fontSize: 14,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
