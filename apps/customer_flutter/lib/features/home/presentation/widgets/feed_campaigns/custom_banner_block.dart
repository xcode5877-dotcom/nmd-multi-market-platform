import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../../../../../design_system/design_system.dart';
import '../../../domain/feed/feed_campaign.dart';
import 'feed_editorial_tokens.dart';
import 'feed_promo_chrome.dart';

/// Admin-controlled custom banner — not the legacy carousel hero.
class CustomBannerBlock extends StatelessWidget {
  const CustomBannerBlock({
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
    final variant = campaign.designVariant;
    final height = variant == FeedCampaignDesignVariant.minimalText ? 72.0 : 108.0;

    return FeedPromoChrome(
      blockType: 'CUSTOM_BANNER',
      campaign: campaign,
      listIndex: listIndex,
      onTap: campaign.hasCta ? onTap : null,
      child: RepaintBoundary(
        child: ClipRRect(
          borderRadius: BorderRadius.circular(24),
          child: SizedBox(
            height: height,
            child: _buildBody(context, variant),
          ),
        ),
      ),
    );
  }

  Widget _buildBody(BuildContext context, FeedCampaignDesignVariant variant) {
    switch (variant) {
      case FeedCampaignDesignVariant.imageEditorial:
        return _imageEditorial();
      case FeedCampaignDesignVariant.darkTealStrip:
        return _gradientStrip(
          colors: const [Color(0xFF0B3D3A), Color(0xFF0E7C72)],
          lightText: true,
        );
      case FeedCampaignDesignVariant.whiteCard:
        return _gradientStrip(
          colors: const [Colors.white, Color(0xFFF8FAFC)],
          lightText: false,
        );
      case FeedCampaignDesignVariant.minimalText:
        return _minimalText();
      case FeedCampaignDesignVariant.softTeal:
        return _gradientStrip(
          colors: [
            FeedEditorialTokens.mintWash,
            Colors.white,
          ],
          lightText: false,
        );
    }
  }

  Widget _imageEditorial() {
    final url = campaign.imageUrl?.trim() ?? '';
    return Stack(
      fit: StackFit.expand,
      children: [
        if (url.isNotEmpty)
          CachedNetworkImage(
            imageUrl: url,
            fit: BoxFit.cover,
            memCacheWidth: 800,
          )
        else
          Container(color: FeedEditorialTokens.tealDeep),
        Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.centerRight,
              end: Alignment.centerLeft,
              colors: [
                Colors.black.withValues(alpha: 0.55),
                Colors.transparent,
              ],
            ),
          ),
        ),
        _textOverlay(Colors.white),
      ],
    );
  }

  Widget _gradientStrip({
    required List<Color> colors,
    required bool lightText,
  }) {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topRight,
          end: Alignment.bottomLeft,
          colors: colors,
        ),
      ),
      child: _textOverlay(lightText ? Colors.white : FeedEditorialTokens.navy),
    );
  }

  Widget _minimalText() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
      child: Align(
        alignment: Alignment.centerRight,
        child: Text(
          campaign.title,
          style: NmdTypography.bodyBold.copyWith(
            fontSize: 15,
            color: FeedEditorialTokens.navy,
          ),
        ),
      ),
    );
  }

  Widget _textOverlay(Color color) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 14, 18, 12),
      child: Directionality(
        textDirection: TextDirection.rtl,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              campaign.title,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: NmdTypography.h2.copyWith(
                fontSize: 17,
                fontWeight: FontWeight.w800,
                color: color,
                height: 1.2,
              ),
            ),
            if (campaign.subtitle.isNotEmpty) ...[
              const SizedBox(height: 4),
              Text(
                campaign.subtitle,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: NmdTypography.micro.copyWith(
                  color: color.withValues(alpha: 0.82),
                ),
              ),
            ],
            const Spacer(),
            if (campaign.ctaLabel.isNotEmpty)
              Text(
                campaign.ctaLabel,
                style: NmdTypography.label.copyWith(
                  color: color.withValues(alpha: 0.9),
                  fontSize: 12,
                ),
              ),
          ],
        ),
      ),
    );
  }
}
