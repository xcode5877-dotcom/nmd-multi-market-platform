import 'package:flutter/material.dart';

import '../../../../../design_system/design_system.dart';
import '../../../domain/feed/feed_campaign.dart';
import 'feed_campaign_countdown.dart';
import 'feed_campaign_motion.dart';

/// Dynamic event / competition card with participants + countdown.
class InteractiveEventCard extends StatelessWidget {
  const InteractiveEventCard({
    super.key,
    required this.campaign,
    required this.onCta,
    this.listIndex = 0,
  });

  final FeedCampaign campaign;
  final VoidCallback onCta;
  final int listIndex;

  @override
  Widget build(BuildContext context) {
    final participants = campaign.participantCount;

    return RepaintBoundary(
      child: FeedCampaignFadeIn(
        index: listIndex,
        child: Padding(
          padding: const EdgeInsetsDirectional.fromSTEB(16, 4, 16, 12),
          child: FeedCampaignPressable(
            onTap: onCta,
            child: Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: NmdColors.surfaceBase,
                borderRadius: BorderRadius.circular(28),
                border: Border.all(
                  color: NmdColors.brandPrimary.withValues(alpha: 0.18),
                ),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF0F172A).withValues(alpha: 0.06),
                    blurRadius: 16,
                    offset: const Offset(0, 6),
                  ),
                ],
              ),
              child: Directionality(
                textDirection: TextDirection.rtl,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        if (campaign.countdownEndsAt != null)
                          FeedCampaignCountdownChip(
                            endsAt: campaign.countdownEndsAt!,
                            onDarkBackground: false,
                          ),
                        const Spacer(),
                        if (participants != null)
                          Row(
                            children: [
                              _AvatarStack(),
                              const SizedBox(width: 8),
                              Text(
                                '$participants مشارك',
                                style: NmdTypography.micro.copyWith(
                                  color: NmdColors.textSecondary,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Text(
                      campaign.title,
                      style: NmdTypography.h2.copyWith(
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        color: NmdColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      campaign.subtitle,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: NmdTypography.body.copyWith(
                        color: NmdColors.textSecondary,
                        fontSize: 13,
                        height: 1.45,
                      ),
                    ),
                    const SizedBox(height: 14),
                    Align(
                      alignment: Alignment.centerRight,
                      child: TextButton(
                        onPressed: onCta,
                        style: TextButton.styleFrom(
                          backgroundColor: NmdColors.brandPrimary,
                          foregroundColor: NmdColors.textOnBrand,
                          padding: const EdgeInsets.symmetric(
                            horizontal: 20,
                            vertical: 10,
                          ),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(20),
                          ),
                        ),
                        child: Text(
                          campaign.ctaLabel,
                          style: const TextStyle(fontWeight: FontWeight.w700),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _AvatarStack extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 52,
      height: 24,
      child: Stack(
        children: List.generate(3, (i) {
          return Positioned(
            right: i * 14.0,
            child: CircleAvatar(
              radius: 12,
              backgroundColor: NmdColors.tintAliveSoft,
              child: Icon(
                Icons.person,
                size: 14,
                color: NmdColors.brandPrimary.withValues(alpha: 0.7),
              ),
            ),
          );
        }),
      ),
    );
  }
}
