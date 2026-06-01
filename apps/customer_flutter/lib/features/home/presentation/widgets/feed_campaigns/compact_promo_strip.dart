import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../../../../../api/resolve_image_url.dart';
import '../../../../../design_system/design_system.dart';
import '../../../domain/feed/feed_campaign.dart';
import 'feed_promo_chrome.dart';

/// Horizontal offer strip (92–116px) with side visual + compact CTA.
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

  static const double _height = 104;

  @override
  Widget build(BuildContext context) {
    final imageUrl = campaign.imageUrl?.trim() ?? '';

    return FeedPromoChrome(
      blockType: 'OFFER_STRIP',
      campaign: campaign,
      listIndex: listIndex,
      onTap: onTap,
      child: Container(
        height: _height,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(24),
          gradient: const LinearGradient(
            begin: Alignment.centerRight,
            end: Alignment.centerLeft,
            colors: [Color(0xFF0E7C72), Color(0xFF0B5E58)],
          ),
          boxShadow: [
            BoxShadow(
              color: NmdColors.brandPrimary.withValues(alpha: 0.18),
              blurRadius: 16,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        clipBehavior: Clip.antiAlias,
        child: Row(
          children: [
            if (imageUrl.isNotEmpty)
              SizedBox(
                width: 104,
                height: _height,
                child: CachedNetworkImage(
                  imageUrl: resolveImageUrl(imageUrl),
                  fit: BoxFit.cover,
                  memCacheWidth: 220,
                ),
              )
            else
              SizedBox(
                width: 88,
                height: _height,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.12),
                  ),
                  child: Icon(
                    Icons.local_offer_rounded,
                    color: Colors.white.withValues(alpha: 0.9),
                    size: 36,
                  ),
                ),
              ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 14),
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
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        campaign.subtitle,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: NmdTypography.micro.copyWith(
                          color: Colors.white.withValues(alpha: 0.9),
                          fontSize: 12.5,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsetsDirectional.only(end: 14),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(18),
                ),
                child: Text(
                  campaign.ctaLabel,
                  style: NmdTypography.label.copyWith(
                    color: NmdColors.brandPrimary,
                    fontWeight: FontWeight.w800,
                    fontSize: 12,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
