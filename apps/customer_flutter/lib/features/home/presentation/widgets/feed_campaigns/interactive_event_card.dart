import 'package:flutter/material.dart';

import '../../../../../design_system/design_system.dart';
import '../../../domain/feed/feed_campaign.dart';
import 'feed_campaign_countdown.dart';
import 'feed_promo_chrome.dart';

/// Premium competition / event card with prize emphasis.
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
    final prize = _extractPrize(campaign.subtitle);

    return FeedPromoChrome(
      blockType: 'COMPETITION_CARD',
      campaign: campaign,
      listIndex: listIndex,
      onTap: onCta,
      child: Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(28),
          gradient: const LinearGradient(
            begin: Alignment.topRight,
            end: Alignment.bottomLeft,
            colors: [Color(0xFFF8FAFC), Color(0xFFE8F5F3)],
          ),
          border: Border.all(
            color: NmdColors.brandPrimary.withValues(alpha: 0.22),
            width: 1.2,
          ),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF0E7C72).withValues(alpha: 0.1),
              blurRadius: 20,
              offset: const Offset(0, 8),
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
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 5,
                    ),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFF7ED),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: const Color(0xFFF59E0B).withValues(alpha: 0.35),
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(
                          Icons.emoji_events_rounded,
                          size: 16,
                          color: Color(0xFFD97706),
                        ),
                        const SizedBox(width: 6),
                        Text(
                          'مسابقة',
                          style: NmdTypography.micro.copyWith(
                            color: const Color(0xFFB45309),
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ],
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
              const SizedBox(height: 12),
              Text(
                campaign.title,
                style: NmdTypography.h2.copyWith(
                  fontSize: 20,
                  fontWeight: FontWeight.w800,
                  color: const Color(0xFF0F172A),
                ),
              ),
              const SizedBox(height: 8),
              if (prize != null)
                Text(
                  prize,
                  style: NmdTypography.price.copyWith(
                    fontSize: 22,
                    fontWeight: FontWeight.w900,
                    color: NmdColors.brandPrimary,
                  ),
                )
              else if (campaign.subtitle.isNotEmpty)
                Text(
                  campaign.subtitle,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: NmdTypography.body.copyWith(
                    color: NmdColors.textSecondary,
                    fontSize: 13.5,
                    height: 1.45,
                  ),
                ),
              if (participants != null) ...[
                const SizedBox(height: 10),
                Text(
                  '$participants مشارك',
                  style: NmdTypography.micro.copyWith(
                    color: NmdColors.textSecondary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
              const SizedBox(height: 14),
              Align(
                alignment: Alignment.centerRight,
                child: FilledButton(
                  onPressed: onCta,
                  style: FilledButton.styleFrom(
                    backgroundColor: NmdColors.brandPrimary,
                    foregroundColor: NmdColors.textOnBrand,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 22,
                      vertical: 11,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(22),
                    ),
                  ),
                  child: Text(
                    campaign.ctaLabel,
                    style: const TextStyle(fontWeight: FontWeight.w800),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  static String? _extractPrize(String subtitle) {
    final s = subtitle.trim();
    if (s.isEmpty) return null;
    if (s.contains('₪') || s.contains('جائزة') || s.contains('اربح')) {
      return s;
    }
    return null;
  }
}
