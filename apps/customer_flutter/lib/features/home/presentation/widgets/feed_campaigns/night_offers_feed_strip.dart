import 'package:flutter/material.dart';

import '../../../../../design_system/design_system.dart';
import '../../../domain/feed/feed_campaign.dart';
import 'feed_promo_chrome.dart';

/// Night offers / live feed — dark-teal editorial strip with mini cards.
class NightOffersFeedStrip extends StatelessWidget {
  const NightOffersFeedStrip({
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
    final chips = _offerChips(campaign);

    return FeedPromoChrome(
      blockType: 'NIGHT_OFFERS',
      campaign: campaign,
      listIndex: listIndex,
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(24),
          gradient: const LinearGradient(
            begin: Alignment.topRight,
            end: Alignment.bottomLeft,
            colors: [Color(0xFF0B3D3A), Color(0xFF0E7C72)],
          ),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF0E7C72).withValues(alpha: 0.2),
              blurRadius: 18,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
        child: Directionality(
          textDirection: TextDirection.rtl,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Text('🌙', style: TextStyle(fontSize: 16)),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      campaign.title.isNotEmpty
                          ? campaign.title
                          : 'عروض الليلة',
                      style: NmdTypography.bodyBold.copyWith(
                        color: Colors.white,
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  Icon(
                    Icons.arrow_back_ios_new_rounded,
                    size: 14,
                    color: Colors.white.withValues(alpha: 0.85),
                  ),
                ],
              ),
              if (campaign.subtitle.isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(
                  campaign.subtitle,
                  style: NmdTypography.micro.copyWith(
                    color: Colors.white.withValues(alpha: 0.82),
                    fontSize: 12,
                  ),
                ),
              ],
              const SizedBox(height: 12),
              SizedBox(
                height: 56,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: chips.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 8),
                  itemBuilder: (context, i) {
                    return Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 10,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.14),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                          color: Colors.white.withValues(alpha: 0.2),
                        ),
                      ),
                      child: Text(
                        chips[i],
                        style: NmdTypography.label.copyWith(
                          color: Colors.white,
                          fontWeight: FontWeight.w700,
                          fontSize: 12,
                        ),
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  List<String> _offerChips(FeedCampaign campaign) {
    if (campaign.categoryLabels.isNotEmpty) {
      return campaign.categoryLabels.take(4).toList();
    }
    final parts = campaign.subtitle
        .split(RegExp(r'[·•|،]'))
        .map((e) => e.trim())
        .where((e) => e.isNotEmpty)
        .toList();
    if (parts.length >= 2) return parts.take(3).toList();
    return [
      campaign.ctaLabel.isNotEmpty ? campaign.ctaLabel : 'عرض 1',
      'توصيل سريع',
      'خصم الليلة',
    ];
  }
}
