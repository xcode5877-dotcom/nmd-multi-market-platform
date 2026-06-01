import 'package:flutter/material.dart';

import '../../../../../design_system/design_system.dart';
import '../../../domain/feed/feed_campaign.dart';
import 'feed_promo_chrome.dart';

/// Category discovery — playful horizontal tiles (شو عبالك اليوم؟).
class CategoryDiscoveryCampaign extends StatelessWidget {
  const CategoryDiscoveryCampaign({
    super.key,
    required this.campaign,
    required this.onCategoryTap,
    this.listIndex = 0,
  });

  final FeedCampaign campaign;
  final void Function(String label) onCategoryTap;
  final int listIndex;

  static const _tileIcons = [
    Icons.local_pizza_rounded,
    Icons.lunch_dining_rounded,
    Icons.cake_rounded,
    Icons.handyman_rounded,
    Icons.coffee_rounded,
    Icons.shopping_bag_rounded,
  ];

  @override
  Widget build(BuildContext context) {
    final labels = campaign.categoryLabels;

    return FeedPromoChrome(
      blockType: 'CATEGORY_DISCOVERY',
      campaign: campaign,
      listIndex: listIndex,
      child: Container(
        padding: const EdgeInsets.fromLTRB(18, 18, 18, 16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(26),
          border: Border.all(
            color: NmdColors.brandPrimary.withValues(alpha: 0.12),
          ),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF0E7C72).withValues(alpha: 0.08),
              blurRadius: 18,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        child: Directionality(
          textDirection: TextDirection.rtl,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                campaign.title,
                style: NmdTypography.h2.copyWith(
                  fontSize: 19,
                  fontWeight: FontWeight.w800,
                  color: const Color(0xFF0F172A),
                ),
              ),
              if (campaign.subtitle.isNotEmpty) ...[
                const SizedBox(height: 6),
                Text(
                  campaign.subtitle,
                  style: NmdTypography.body.copyWith(
                    color: NmdColors.textSecondary,
                    fontSize: 13.5,
                    height: 1.4,
                  ),
                ),
              ],
              if (labels.isNotEmpty) ...[
                const SizedBox(height: 14),
                SizedBox(
                  height: 88,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: labels.length,
                    separatorBuilder: (_, __) => const SizedBox(width: 10),
                    itemBuilder: (context, i) {
                      final label = labels[i];
                      final icon = _tileIcons[i % _tileIcons.length];
                      return GestureDetector(
                        onTap: () => onCategoryTap(label),
                        child: SizedBox(
                          width: 76,
                          child: Column(
                            children: [
                              Container(
                                width: 58,
                                height: 58,
                                decoration: BoxDecoration(
                                  gradient: LinearGradient(
                                    begin: Alignment.topRight,
                                    end: Alignment.bottomLeft,
                                    colors: [
                                      NmdColors.tintAliveSoft,
                                      NmdColors.brandPrimary
                                          .withValues(alpha: 0.12),
                                    ],
                                  ),
                                  borderRadius: BorderRadius.circular(20),
                                  border: Border.all(
                                    color: NmdColors.brandPrimary
                                        .withValues(alpha: 0.15),
                                  ),
                                ),
                                child: Icon(
                                  icon,
                                  color: NmdColors.brandPrimary,
                                  size: 28,
                                ),
                              ),
                              const SizedBox(height: 6),
                              Text(
                                label,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                textAlign: TextAlign.center,
                                style: NmdTypography.label.copyWith(
                                  color: const Color(0xFF334155),
                                  fontWeight: FontWeight.w700,
                                  fontSize: 11.5,
                                ),
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
