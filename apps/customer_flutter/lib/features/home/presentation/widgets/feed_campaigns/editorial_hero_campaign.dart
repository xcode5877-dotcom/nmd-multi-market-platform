import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../../../../../api/resolve_image_url.dart';
import '../../../../../design_system/design_system.dart';
import '../../../domain/feed/feed_campaign.dart';
import 'feed_campaign_countdown.dart';
import 'feed_promo_chrome.dart';

/// Full-width hero promo between store sections (Now Market editorial).
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

  static const double _height = 196;

  @override
  Widget build(BuildContext context) {
    final imageUrl = campaign.imageUrl?.trim() ?? '';
    final onLight =
        campaign.backgroundStyle == FeedCampaignBackgroundStyle.whiteCard;

    return FeedPromoChrome(
      blockType: 'HERO_BANNER',
      campaign: campaign,
      listIndex: listIndex,
      onTap: onCta,
      child: Container(
        height: _height,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(28),
          border: Border.all(
            color: NmdColors.brandPrimary.withValues(alpha: 0.14),
            width: 1.2,
          ),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF0E7C72).withValues(alpha: 0.14),
              blurRadius: 24,
              offset: const Offset(0, 10),
            ),
            BoxShadow(
              color: const Color(0xFF0F172A).withValues(alpha: 0.06),
              blurRadius: 12,
              offset: const Offset(0, 4),
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
                memCacheWidth: 900,
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
                  colors: onLight
                      ? [
                          Colors.white.withValues(alpha: 0.05),
                          Colors.white.withValues(alpha: 0.88),
                        ]
                      : [
                          Colors.black.withValues(alpha: 0.08),
                          Colors.black.withValues(alpha: 0.58),
                        ],
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 18, 20, 16),
              child: Directionality(
                textDirection: TextDirection.rtl,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (campaign.countdownEndsAt != null)
                      FeedCampaignCountdownChip(
                        endsAt: campaign.countdownEndsAt!,
                        onDarkBackground: !onLight,
                      ),
                    const Spacer(),
                    Text(
                      campaign.title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: NmdTypography.h2.copyWith(
                        color: onLight
                            ? const Color(0xFF0F172A)
                            : Colors.white,
                        fontSize: 21,
                        fontWeight: FontWeight.w800,
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
                          color: onLight
                              ? const Color(0xFF475569)
                              : Colors.white.withValues(alpha: 0.92),
                          fontSize: 13.5,
                          height: 1.4,
                        ),
                      ),
                    ],
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        _CtaPill(
                          label: campaign.ctaLabel,
                          onLight: onLight,
                        ),
                        const Spacer(),
                        _BrandMark(onLight: onLight),
                      ],
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

  Widget _bgFallback(FeedCampaign campaign) {
    final colors = switch (campaign.backgroundStyle) {
      FeedCampaignBackgroundStyle.tealGradient => const [
          Color(0xFF0E7C72),
          Color(0xFF0B5E58),
          Color(0xFF134E4A),
        ],
      FeedCampaignBackgroundStyle.navySoft => const [
          Color(0xFF1E3A5F),
          Color(0xFF0F172A),
        ],
      FeedCampaignBackgroundStyle.whiteCard => const [
          Color(0xFFF8FAFC),
          Color(0xFFE0F2F1),
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

class _CtaPill extends StatelessWidget {
  const _CtaPill({required this.label, required this.onLight});

  final String label;
  final bool onLight;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 9),
      decoration: BoxDecoration(
        color: onLight ? NmdColors.brandPrimary : Colors.white,
        borderRadius: BorderRadius.circular(22),
        boxShadow: [
          BoxShadow(
            color: NmdColors.brandPrimary.withValues(alpha: 0.2),
            blurRadius: 8,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Text(
        label,
        style: NmdTypography.button.copyWith(
          color: onLight ? NmdColors.textOnBrand : NmdColors.brandPrimary,
          fontSize: 13,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

class _BrandMark extends StatelessWidget {
  const _BrandMark({required this.onLight});

  final bool onLight;

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: 0.85,
      child: SvgPicture.asset(
        'assets/branding/logo-nowmarket.svg',
        width: 72,
        height: 22,
        colorFilter: ColorFilter.mode(
          onLight ? NmdColors.brandPrimary : Colors.white,
          BlendMode.srcIn,
        ),
      ),
    );
  }
}
