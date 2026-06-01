import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../../../../../api/resolve_image_url.dart';
import '../../../../../design_system/design_system.dart';
import '../../../domain/feed/feed_campaign.dart';
import 'feed_editorial_tokens.dart';
import 'feed_promo_chrome.dart';

/// Featured new-store story — image-first editorial, not a full-bleed ad hero.
class NewStoreStoryCard extends StatelessWidget {
  const NewStoreStoryCard({
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
    final imageUrl = campaign.imageUrl?.trim() ?? '';

    return FeedPromoChrome(
      blockType: 'NEW_STORE_STORY',
      campaign: campaign,
      listIndex: listIndex,
      onTap: onTap,
      child: SizedBox(
        height: 172,
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            Container(
              decoration: FeedEditorialTokens.cardSurface(),
              clipBehavior: Clip.antiAlias,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  if (imageUrl.isNotEmpty)
                    Align(
                      alignment: Alignment.centerLeft,
                      child: FractionallySizedBox(
                        widthFactor: 0.52,
                        heightFactor: 1,
                        child: CachedNetworkImage(
                          imageUrl: resolveImageUrl(imageUrl),
                          fit: BoxFit.cover,
                          memCacheWidth: 600,
                        ),
                      ),
                    ),
                  DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.centerRight,
                        end: Alignment.centerLeft,
                        colors: [
                          Colors.white.withValues(alpha: 0.97),
                          Colors.white.withValues(alpha: 0.72),
                          Colors.white.withValues(alpha: 0.05),
                        ],
                        stops: const [0.35, 0.62, 1],
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
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 4,
                            ),
                            decoration: BoxDecoration(
                              color: FeedEditorialTokens.teal.withValues(
                                alpha: 0.12,
                              ),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Text(
                              'جديد',
                              style: NmdTypography.micro.copyWith(
                                color: FeedEditorialTokens.teal,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ),
                          const Spacer(),
                          Text(
                            campaign.title,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: NmdTypography.h2.copyWith(
                              fontSize: 19,
                              fontWeight: FontWeight.w800,
                              color: FeedEditorialTokens.navy,
                              height: 1.15,
                            ),
                          ),
                          if (campaign.subtitle.isNotEmpty) ...[
                            const SizedBox(height: 6),
                            Text(
                              campaign.subtitle,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: NmdTypography.body.copyWith(
                                fontSize: 13,
                                color: NmdColors.textSecondary,
                              ),
                            ),
                          ],
                          const SizedBox(height: 8),
                          Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                campaign.ctaLabel.isNotEmpty
                                    ? campaign.ctaLabel
                                    : 'اكتشف',
                                style: NmdTypography.label.copyWith(
                                  color: FeedEditorialTokens.teal,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                              const SizedBox(width: 4),
                              Icon(
                                Icons.arrow_back_ios_new_rounded,
                                size: 13,
                                color: FeedEditorialTokens.teal,
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
