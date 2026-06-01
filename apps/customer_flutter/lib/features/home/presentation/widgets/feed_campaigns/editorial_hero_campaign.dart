import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../../../../../api/resolve_image_url.dart';
import '../../../../../design_system/design_system.dart';
import '../../../domain/feed/feed_campaign.dart';
import 'feed_campaign_countdown.dart';
import 'feed_campaign_motion.dart';

/// Large editorial card between store sections (App Store / Today style).
class EditorialHeroCampaign extends StatelessWidget {
  const EditorialHeroCampaign({
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
    final imageUrl = campaign.imageUrl?.trim() ?? '';

    return RepaintBoundary(
      child: FeedCampaignFadeIn(
        index: listIndex,
        child: Padding(
          padding: const EdgeInsetsDirectional.fromSTEB(16, 4, 16, 12),
          child: FeedCampaignPressable(
            onTap: onCta,
            child: Container(
              height: 210,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(28),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF0F172A).withValues(alpha: 0.08),
                    blurRadius: 20,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              clipBehavior: Clip.antiAlias,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  if (imageUrl.isNotEmpty)
                    CachedNetworkImage(
                      imageUrl: resolveImageUrl(imageUrl),
                      fit: BoxFit.cover,
                      memCacheWidth: 800,
                      placeholder: (_, __) => _bgFallback(campaign),
                      errorWidget: (_, __, ___) => _bgFallback(campaign),
                    )
                  else
                    _bgFallback(campaign),
                  DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          Colors.black.withValues(alpha: 0.12),
                          Colors.black.withValues(alpha: 0.55),
                        ],
                      ),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(20, 20, 20, 18),
                    child: Directionality(
                      textDirection: TextDirection.rtl,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (campaign.countdownEndsAt != null)
                            FeedCampaignCountdownChip(
                              endsAt: campaign.countdownEndsAt!,
                            ),
                          const Spacer(),
                          Text(
                            campaign.title,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: NmdTypography.h2.copyWith(
                              color: Colors.white,
                              fontSize: 22,
                              fontWeight: FontWeight.w800,
                              height: 1.15,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            campaign.subtitle,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: NmdTypography.body.copyWith(
                              color: Colors.white.withValues(alpha: 0.9),
                              fontSize: 13,
                              height: 1.4,
                            ),
                          ),
                          const SizedBox(height: 12),
                          Align(
                            alignment: Alignment.centerRight,
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 16,
                                vertical: 8,
                              ),
                              decoration: BoxDecoration(
                                color: NmdColors.brandPrimary,
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: Text(
                                campaign.ctaLabel,
                                style: NmdTypography.button.copyWith(
                                  color: NmdColors.textOnBrand,
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
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

  Widget _bgFallback(FeedCampaign campaign) {
    final colors = switch (campaign.backgroundStyle) {
      FeedCampaignBackgroundStyle.tealGradient => const [
          Color(0xFF0E7C72),
          Color(0xFF134E4A),
        ],
      FeedCampaignBackgroundStyle.navySoft => const [
          Color(0xFF1E293B),
          Color(0xFF0F172A),
        ],
      FeedCampaignBackgroundStyle.whiteCard => const [
          Color(0xFFF8FAFC),
          Color(0xFFE2E8F0),
        ],
    };
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topRight,
          end: Alignment.bottomLeft,
          colors: colors,
        ),
      ),
    );
  }
}
