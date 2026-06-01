import 'package:flutter/material.dart';

import '../../../../../design_system/design_system.dart';
import '../../../domain/feed/feed_campaign.dart';
import 'feed_campaign_countdown.dart';
import 'feed_editorial_glow.dart';
import 'feed_editorial_tokens.dart';
import 'feed_promo_chrome.dart';

/// Challenge / event editorial interruption — glow + compact CTA link.
class ChallengeEventEditorialCard extends StatelessWidget {
  const ChallengeEventEditorialCard({
    super.key,
    required this.campaign,
    required this.onTap,
    this.listIndex = 0,
  });

  final FeedCampaign campaign;
  final VoidCallback onTap;
  final int listIndex;

  @override
  Widget build(BuildContext context) {
    final prize = _prizeLine(campaign.subtitle);
    final participants = campaign.participantCount;

    return FeedPromoChrome(
      blockType: 'CHALLENGE_EVENT',
      campaign: campaign,
      listIndex: listIndex,
      onTap: onTap,
      child: FeedEditorialGlow(
        color: const Color(0xFFF59E0B),
        child: Container(
          decoration: FeedEditorialTokens.cardSurface(
            fill: const Color(0xFFFFFBF5),
          ),
          padding: const EdgeInsets.fromLTRB(18, 16, 18, 16),
          child: Directionality(
            textDirection: TextDirection.rtl,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Text('🔥', style: TextStyle(fontSize: 18)),
                          const SizedBox(width: 6),
                          Text(
                            'تحدي',
                            style: NmdTypography.micro.copyWith(
                              fontWeight: FontWeight.w800,
                              color: const Color(0xFFB45309),
                            ),
                          ),
                          const Spacer(),
                          if (campaign.countdownEndsAt != null)
                            FeedCampaignCountdownChip(
                              endsAt: campaign.countdownEndsAt!,
                              onDarkBackground: false,
                            ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      Text(
                        campaign.title,
                        style: NmdTypography.h2.copyWith(
                          fontSize: 19,
                          fontWeight: FontWeight.w800,
                          color: FeedEditorialTokens.navy,
                          height: 1.15,
                        ),
                      ),
                      if (prize != null) ...[
                        const SizedBox(height: 8),
                        Text(
                          prize,
                          style: NmdTypography.price.copyWith(
                            fontSize: 26,
                            fontWeight: FontWeight.w900,
                            color: FeedEditorialTokens.teal,
                            height: 1,
                          ),
                        ),
                      ] else if (campaign.subtitle.isNotEmpty) ...[
                        const SizedBox(height: 6),
                        Text(
                          campaign.subtitle,
                          style: NmdTypography.body.copyWith(
                            fontSize: 13,
                            color: NmdColors.textSecondary,
                          ),
                        ),
                      ],
                      if (participants != null) ...[
                        const SizedBox(height: 8),
                        Text(
                          '$participants مشارك الآن',
                          style: NmdTypography.micro.copyWith(
                            color: NmdColors.textSecondary,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                      const SizedBox(height: 12),
                      _EditorialLinkCta(label: campaign.ctaLabel),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                const _ChallengeBadge(),
              ],
            ),
          ),
        ),
      ),
    );
  }

  static String? _prizeLine(String subtitle) {
    final s = subtitle.trim();
    if (s.isEmpty) return null;
    if (s.contains('₪') || s.contains('اربح') || s.contains('جائزة')) {
      return s;
    }
    return null;
  }
}

class _ChallengeBadge extends StatelessWidget {
  const _ChallengeBadge();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 72,
      height: 72,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(22),
        gradient: const LinearGradient(
          begin: Alignment.topRight,
          end: Alignment.bottomLeft,
          colors: [Color(0xFFFFE8C8), Color(0xFFFDE68A)],
        ),
        border: Border.all(color: const Color(0xFFF59E0B).withValues(alpha: 0.35)),
      ),
      alignment: Alignment.center,
      child: const Text('🏆', style: TextStyle(fontSize: 32)),
    );
  }
}

class _EditorialLinkCta extends StatelessWidget {
  const _EditorialLinkCta({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          label,
          style: NmdTypography.label.copyWith(
            color: FeedEditorialTokens.teal,
            fontWeight: FontWeight.w800,
            fontSize: 13,
          ),
        ),
        const SizedBox(width: 4),
        Icon(
          Icons.arrow_back_ios_new_rounded,
          size: 14,
          color: FeedEditorialTokens.teal.withValues(alpha: 0.9),
        ),
      ],
    );
  }
}
