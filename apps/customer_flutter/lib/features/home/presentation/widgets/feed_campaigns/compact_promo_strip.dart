import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../../../../../api/resolve_image_url.dart';
import '../../../../../design_system/design_system.dart';
import '../../../domain/feed/feed_campaign.dart';
import 'feed_campaign_motion.dart';

/// Slim horizontal promo strip (flash sale / announcement).
class CompactPromoStrip extends StatelessWidget {
  const CompactPromoStrip({
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

    return RepaintBoundary(
      child: FeedCampaignFadeIn(
        index: listIndex,
        child: Padding(
          padding: const EdgeInsetsDirectional.fromSTEB(16, 4, 16, 12),
          child: FeedCampaignPressable(
            onTap: onTap,
            child: Container(
              height: 96,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(22),
                gradient: const LinearGradient(
                  begin: Alignment.centerRight,
                  end: Alignment.centerLeft,
                  colors: [Color(0xFF0E7C72), Color(0xFF0F766E)],
                ),
                boxShadow: [
                  BoxShadow(
                    color: NmdColors.brandPrimary.withValues(alpha: 0.12),
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              clipBehavior: Clip.antiAlias,
              child: Row(
                children: [
                  if (imageUrl.isNotEmpty)
                    SizedBox(
                      width: 96,
                      height: 96,
                      child: CachedNetworkImage(
                        imageUrl: resolveImageUrl(imageUrl),
                        fit: BoxFit.cover,
                        memCacheWidth: 200,
                      ),
                    ),
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: Directionality(
                        textDirection: TextDirection.rtl,
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              campaign.title,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: NmdTypography.bodyBold.copyWith(
                                color: Colors.white,
                                fontSize: 15,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              campaign.subtitle,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: NmdTypography.micro.copyWith(
                                color: Colors.white.withValues(alpha: 0.88),
                                fontSize: 12,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsetsDirectional.only(end: 14),
                    child: Icon(
                      Icons.arrow_back_ios_new_rounded,
                      size: 16,
                      color: Colors.white.withValues(alpha: 0.9),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
