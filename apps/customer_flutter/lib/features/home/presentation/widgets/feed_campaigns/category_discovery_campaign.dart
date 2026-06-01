import 'package:flutter/material.dart';

import '../../../../../design_system/design_system.dart';
import '../../../domain/feed/feed_campaign.dart';
import 'feed_campaign_motion.dart';

/// Food / category discovery card with chips (شو عبالك اليوم؟).
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

  @override
  Widget build(BuildContext context) {
    final labels = campaign.categoryLabels;

    return RepaintBoundary(
      child: FeedCampaignFadeIn(
        index: listIndex,
        child: Padding(
          padding: const EdgeInsetsDirectional.fromSTEB(16, 4, 16, 12),
          child: Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: NmdColors.surfaceBase,
              borderRadius: BorderRadius.circular(26),
              border: Border.all(color: NmdColors.borderSubtle.withValues(alpha: 0.9)),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFF0F172A).withValues(alpha: 0.05),
                  blurRadius: 14,
                  offset: const Offset(0, 4),
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
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: NmdColors.textPrimary,
                    ),
                  ),
                  if (campaign.subtitle.isNotEmpty) ...[
                    const SizedBox(height: 6),
                    Text(
                      campaign.subtitle,
                      style: NmdTypography.body.copyWith(
                        color: NmdColors.textSecondary,
                        fontSize: 13,
                        height: 1.4,
                      ),
                    ),
                  ],
                  if (labels.isNotEmpty) ...[
                    const SizedBox(height: 14),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: labels.map((label) {
                        return GestureDetector(
                          onTap: () => onCategoryTap(label),
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 14,
                              vertical: 8,
                            ),
                            decoration: BoxDecoration(
                              color: NmdColors.tintAliveSoft,
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(
                                color: NmdColors.brandPrimary.withValues(alpha: 0.2),
                              ),
                            ),
                            child: Text(
                              label,
                              style: NmdTypography.label.copyWith(
                                color: NmdColors.brandPrimary,
                                fontWeight: FontWeight.w700,
                                fontSize: 13,
                              ),
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
