import 'package:flutter/material.dart';

import '../../../../../design_system/design_system.dart';
import '../../../domain/feed/feed_campaign.dart';
import 'feed_editorial_tokens.dart';
import 'feed_promo_chrome.dart';

/// Editorial food-mood discovery — playful horizontal chips, not a banner ad.
class FoodMoodDiscoveryCard extends StatelessWidget {
  const FoodMoodDiscoveryCard({
    super.key,
    required this.campaign,
    required this.onCategoryTap,
    this.listIndex = 0,
  });

  final FeedCampaign campaign;
  final void Function(String label) onCategoryTap;
  final int listIndex;

  static const _defaultMoods = <(String emoji, String label)>[
    ('🍕', 'بيتزا'),
    ('🍔', 'برغر'),
    ('🍣', 'آسيوي'),
    ('☕', 'قهوة'),
    ('🍰', 'حلويات'),
    ('🛠️', 'خدمات'),
  ];

  @override
  Widget build(BuildContext context) {
    final labels = campaign.categoryLabels;
    final moods = labels.isNotEmpty
        ? labels.map((l) => (_emojiFor(l), l)).toList()
        : _defaultMoods;

    return FeedPromoChrome(
      blockType: 'FOOD_MOOD',
      campaign: campaign,
      listIndex: listIndex,
      child: Container(
        decoration: FeedEditorialTokens.cardSurface(),
        clipBehavior: Clip.antiAlias,
        child: Stack(
          children: [
            Positioned(
              top: -40,
              left: -30,
              child: Container(
                width: 140,
                height: 140,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: FeedEditorialTokens.mintWash.withValues(alpha: 0.9),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 18, 18, 16),
              child: Directionality(
                textDirection: TextDirection.rtl,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      campaign.title.isNotEmpty
                          ? campaign.title
                          : 'شو جاي عبالك اليوم؟',
                      style: NmdTypography.h2.copyWith(
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                        color: FeedEditorialTokens.navy,
                        height: 1.2,
                      ),
                    ),
                    if (campaign.subtitle.isNotEmpty) ...[
                      const SizedBox(height: 6),
                      Text(
                        campaign.subtitle,
                        style: NmdTypography.body.copyWith(
                          fontSize: 13.5,
                          color: NmdColors.textSecondary,
                          height: 1.35,
                        ),
                      ),
                    ],
                    const SizedBox(height: 16),
                    SizedBox(
                      height: 92,
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        physics: const BouncingScrollPhysics(
                          parent: AlwaysScrollableScrollPhysics(),
                        ),
                        itemCount: moods.length,
                        separatorBuilder: (_, __) => const SizedBox(width: 10),
                        itemBuilder: (context, i) {
                          final (emoji, label) = moods[i];
                          return _MoodChip(
                            emoji: emoji,
                            label: label,
                            onTap: () => onCategoryTap(label),
                          );
                        },
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  static String _emojiFor(String label) {
    final l = label.toLowerCase();
    if (l.contains('بيتز')) return '🍕';
    if (l.contains('برغر') || l.contains('برجر')) return '🍔';
    if (l.contains('آسيو') || l.contains('سوشي')) return '🍣';
    if (l.contains('قهو')) return '☕';
    if (l.contains('حلو')) return '🍰';
    if (l.contains('خدم')) return '🛠️';
    return '✨';
  }
}

class _MoodChip extends StatelessWidget {
  const _MoodChip({
    required this.emoji,
    required this.label,
    required this.onTap,
  });

  final String emoji;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 76,
        padding: const EdgeInsets.only(top: 8, bottom: 10),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(FeedEditorialTokens.radiusMd),
          border: Border.all(
            color: FeedEditorialTokens.teal.withValues(alpha: 0.14),
          ),
          boxShadow: [
            BoxShadow(
              color: FeedEditorialTokens.teal.withValues(alpha: 0.08),
              blurRadius: 10,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(emoji, style: const TextStyle(fontSize: 28)),
            const SizedBox(height: 6),
            Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: NmdTypography.label.copyWith(
                fontSize: 11.5,
                fontWeight: FontWeight.w700,
                color: FeedEditorialTokens.navy,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
