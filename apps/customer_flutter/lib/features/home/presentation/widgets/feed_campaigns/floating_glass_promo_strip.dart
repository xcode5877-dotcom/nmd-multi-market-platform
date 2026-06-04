import 'dart:math' as math;
import 'dart:ui';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../../../../../design_system/design_system.dart';
import '../../../domain/feed/feed_campaign.dart';
import 'editorial_subtle_motion.dart';
import 'feed_editorial_tokens.dart';
import 'feed_promo_chrome.dart';

/// Glassmorphism editorial strip — asymmetrical, tiny CTA only.
class FloatingGlassPromoStrip extends StatelessWidget {
  const FloatingGlassPromoStrip({
    super.key,
    required this.campaign,
    required this.onTap,
    this.listIndex = 0,
  });

  final FeedCampaign campaign;
  final VoidCallback onTap;
  final int listIndex;

  static const double _stripHeight = 96;

  @override
  Widget build(BuildContext context) {
    final emoji = _leadingEmoji(campaign);
    final imageUrl = campaign.imageUrl?.trim() ?? '';

    return FeedPromoChrome(
      blockType: 'FLOATING_GLASS_STRIP',
      campaign: campaign,
      listIndex: listIndex,
      onTap: campaign.hasCta ? onTap : null,
      child: RepaintBoundary(
        child: ClipRRect(
          borderRadius: BorderRadius.circular(24),
          child: SizedBox(
            height: _stripHeight,
            child: EditorialSubtleMotion(
              period: const Duration(seconds: 8),
              builder: (context, t) {
                final glow = 0.35 + math.sin(t * math.pi * 2) * 0.12;
                final driftX = math.sin(t * math.pi * 2 + 0.5) * 6;
                final driftY = math.cos(t * math.pi * 2) * 4;

                return Stack(
                  clipBehavior: Clip.none,
                  children: [
                    Positioned.fill(
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topRight,
                            end: Alignment.bottomLeft,
                            colors: [
                              FeedEditorialTokens.nightBase,
                              FeedEditorialTokens.tealDeep,
                              const Color(0xFF0E7C72),
                            ],
                          ),
                        ),
                      ),
                    ),
                    Positioned.fill(
                      child: BackdropFilter(
                        filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
                        child: const SizedBox.expand(),
                      ),
                    ),
                    Positioned(
                      right: -6,
                      top: -10 + driftY,
                      child: Container(
                        width: 72 + glow * 8,
                        height: 72 + glow * 8,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          boxShadow: [
                            BoxShadow(
                              color: FeedEditorialTokens.teal
                                  .withValues(alpha: glow * 0.45),
                              blurRadius: 28,
                              spreadRadius: 2,
                            ),
                          ],
                        ),
                      ),
                    ),
                    if (imageUrl.isNotEmpty)
                      Positioned(
                        left: 12 + driftX,
                        top: -14 + driftY,
                        child: Transform.rotate(
                          angle: -0.08,
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(14),
                            child: CachedNetworkImage(
                              imageUrl: imageUrl,
                              width: 56,
                              height: 56,
                              fit: BoxFit.cover,
                              memCacheWidth: 112,
                              memCacheHeight: 112,
                              errorWidget: (_, __, ___) =>
                                  _emojiBadge(emoji, 48),
                            ),
                          ),
                        ),
                      )
                    else
                      Positioned(
                        left: 14 + driftX,
                        top: 18 + driftY,
                        child: _emojiBadge(emoji, 36),
                      ),
                    Positioned(
                      left: 8,
                      bottom: 10,
                      child: IgnorePointer(
                        child: Row(
                          children: List.generate(3, (i) {
                            return Padding(
                              padding: const EdgeInsets.only(right: 6),
                              child: Container(
                                width: 4,
                                height: 4,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: Colors.white
                                      .withValues(alpha: 0.15 + i * 0.08),
                                ),
                              ),
                            );
                          }),
                        ),
                      ),
                    ),
                    Padding(
                      padding: EdgeInsets.fromLTRB(
                        imageUrl.isNotEmpty ? 78 : 58,
                        14,
                        16,
                        12,
                      ),
                      child: Directionality(
                        textDirection: TextDirection.rtl,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            _MarqueeLine(
                              text: campaign.title.isNotEmpty
                                  ? campaign.title
                                  : '🔥 عروض الليل',
                              t: t,
                              style: NmdTypography.bodyBold.copyWith(
                                color: Colors.white,
                                fontSize: 15.5,
                                fontWeight: FontWeight.w800,
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
                                  color: Colors.white.withValues(alpha: 0.78),
                                  fontSize: 11.5,
                                ),
                              ),
                            ],
                            const Spacer(),
                            Align(
                              alignment: Alignment.centerLeft,
                              child: Text(
                                campaign.ctaLabel.isNotEmpty
                                    ? campaign.ctaLabel
                                    : 'اكتشف',
                                style: NmdTypography.label.copyWith(
                                  color: Colors.white.withValues(alpha: 0.9),
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  letterSpacing: 0.2,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                );
              },
            ),
          ),
        ),
      ),
    );
  }

  static Widget _emojiBadge(String emoji, double size) {
    return Text(emoji, style: TextStyle(fontSize: size));
  }

  static String _leadingEmoji(FeedCampaign campaign) {
    switch (campaign.kind) {
      case FeedCampaignKind.rewardCard:
        return '🎁';
      case FeedCampaignKind.competitionCard:
        return '🏆';
      case FeedCampaignKind.offerStrip:
        return '🔥';
      default:
        break;
    }
    final t = campaign.title;
    if (t.contains('🎁')) return '🎁';
    if (t.contains('🔥')) return '🔥';
    if (t.contains('🏆')) return '🏆';
    return '✨';
  }
}

class _MarqueeLine extends StatelessWidget {
  const _MarqueeLine({
    required this.text,
    required this.t,
    required this.style,
  });

  final String text;
  final double t;
  final TextStyle style;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        return ClipRect(
          child: Transform.translate(
            offset: Offset((t - 0.5) * 8, 0),
            child: Text(
              text,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: style,
            ),
          ),
        );
      },
    );
  }
}
