import 'package:flutter/material.dart';

import '../../../../../design_system/design_system.dart';
import '../../../domain/feed/feed_campaign.dart';
import 'feed_campaign_motion.dart';

/// Rewards / coins promo card.
class RewardCardCampaign extends StatelessWidget {
  const RewardCardCampaign({
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
                borderRadius: BorderRadius.circular(26),
                gradient: const LinearGradient(
                  begin: Alignment.topRight,
                  end: Alignment.bottomLeft,
                  colors: [Color(0xFF0E7C72), Color(0xFF134E4A)],
                ),
                boxShadow: [
                  BoxShadow(
                    color: NmdColors.brandPrimary.withValues(alpha: 0.18),
                    blurRadius: 14,
                    offset: const Offset(0, 6),
                  ),
                ],
              ),
              child: Directionality(
                textDirection: TextDirection.rtl,
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            campaign.title,
                            style: NmdTypography.bodyBold.copyWith(
                              color: Colors.white,
                              fontSize: 17,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            campaign.subtitle,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: NmdTypography.body.copyWith(
                              color: Colors.white.withValues(alpha: 0.9),
                              fontSize: 13,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    Icon(
                      Icons.card_giftcard_rounded,
                      color: Colors.white.withValues(alpha: 0.9),
                      size: 36,
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
