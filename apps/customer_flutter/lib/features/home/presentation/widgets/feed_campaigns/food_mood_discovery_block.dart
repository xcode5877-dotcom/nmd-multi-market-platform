import 'dart:math' as math;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../../../../../design_system/design_system.dart';
import '../../../domain/feed/feed_campaign.dart';
import '../../../domain/feed/feed_campaign_chip.dart';
import 'editorial_subtle_motion.dart';
import 'feed_editorial_tokens.dart';
import 'feed_promo_chrome.dart';

/// Editorial mood discovery — interactive chips, not a banner ad.
class FoodMoodDiscoveryBlock extends StatelessWidget {
  const FoodMoodDiscoveryBlock({
    super.key,
    required this.campaign,
    required this.onChipTap,
    this.listIndex = 0,
  });

  final FeedCampaign campaign;
  final void Function(FeedCampaignChip chip) onChipTap;
  final int listIndex;

  static const double _blockHeight = 124;

  @override
  Widget build(BuildContext context) {
    final chipList = campaign.moodChips;
    if (chipList.isEmpty) {
      return const SizedBox.shrink();
    }

    return FeedPromoChrome(
      blockType: 'FOOD_MOOD_BLOCK',
      campaign: campaign,
      listIndex: listIndex,
      child: RepaintBoundary(
        child: ClipRRect(
          borderRadius: BorderRadius.circular(28),
          child: SizedBox(
            height: _blockHeight,
            child: EditorialSubtleMotion(
              period: const Duration(seconds: 9),
              builder: (context, t) {
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
                              const Color(0xFFFFFBF7),
                              FeedEditorialTokens.mintWash,
                              Colors.white.withValues(alpha: 0.95),
                            ],
                          ),
                          boxShadow: FeedEditorialTokens.softLift,
                        ),
                      ),
                    ),
                    Positioned(
                      right: -18 + t * 12,
                      top: -22 + math.sin(t * math.pi * 2) * 6,
                      child: _floatingEmoji('🍕', 26),
                    ),
                    Positioned(
                      left: -8 - t * 10,
                      bottom: 8 + math.sin(t * math.pi * 2 + 1) * 5,
                      child: _floatingEmoji('☕', 22),
                    ),
                    Positioned(
                      left: 48,
                      top: 6 + math.sin(t * math.pi * 2 + 2.2) * 4,
                      child: _floatingEmoji('🥗', 18),
                    ),
                    Positioned.fill(
                      child: IgnorePointer(
                        child: DecoratedBox(
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              begin: Alignment(-1.2 + t * 2.4, 0),
                              end: Alignment(-0.4 + t * 2.4, 0),
                              colors: [
                                Colors.white.withValues(alpha: 0),
                                Colors.white.withValues(alpha: 0.35),
                                Colors.white.withValues(alpha: 0),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(18, 14, 18, 12),
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
                                fontSize: 18,
                                fontWeight: FontWeight.w800,
                                color: FeedEditorialTokens.navy,
                                height: 1.15,
                                letterSpacing: -0.2,
                              ),
                            ),
                            const SizedBox(height: 12),
                            Expanded(
                              child: ListView.separated(
                                scrollDirection: Axis.horizontal,
                                physics: const BouncingScrollPhysics(
                                  parent: AlwaysScrollableScrollPhysics(),
                                ),
                                itemCount: chipList.length,
                                separatorBuilder: (_, __) =>
                                    const SizedBox(width: 10),
                                itemBuilder: (context, i) {
                                  final chip = chipList[i];
                                  final emoji = chip.emoji.isNotEmpty
                                      ? chip.emoji
                                      : _emojiFor(chip.label);
                                  return EditorialFloatDrift(
                                    phase: i * 0.9,
                                    amplitude: 3,
                                    t: t,
                                    child: _MoodChip(
                                      emoji: emoji,
                                      iconUrl: chip.iconUrl,
                                      label: chip.label,
                                      enabled: chip.isActionable,
                                      onTap: chip.isActionable
                                          ? () => onChipTap(chip)
                                          : null,
                                    ),
                                  );
                                },
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

  static Widget _floatingEmoji(String emoji, double size) {
    return Opacity(
      opacity: 0.55,
      child: Text(emoji, style: TextStyle(fontSize: size)),
    );
  }

  static String _emojiFor(String label) {
    final l = label.toLowerCase();
    if (l.contains('بيتز')) return '🍕';
    if (l.contains('برغر') || l.contains('برجر')) return '🍔';
    if (l.contains('شاور')) return '🌯';
    if (l.contains('قهو') || l.contains('كوفي')) return '☕';
    if (l.contains('سوشي') || l.contains('آسيو')) return '🍣';
    if (l.contains('صحي') || l.contains('سلط')) return '🥗';
    if (l.contains('حلو')) return '🍰';
    return '✨';
  }
}

class _MoodChip extends StatefulWidget {
  const _MoodChip({
    required this.emoji,
    required this.label,
    this.iconUrl,
    this.enabled = true,
    this.onTap,
  });

  final String emoji;
  final String? iconUrl;
  final String label;
  final bool enabled;
  final VoidCallback? onTap;

  @override
  State<_MoodChip> createState() => _MoodChipState();
}

class _MoodChipState extends State<_MoodChip> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final iconUrl = widget.iconUrl?.trim();
    final hasImage = iconUrl != null && iconUrl.isNotEmpty;

    Widget iconChild;
    if (hasImage) {
      iconChild = ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: CachedNetworkImage(
          imageUrl: iconUrl,
          width: 32,
          height: 32,
          fit: BoxFit.cover,
          errorWidget: (_, __, ___) =>
              Text(widget.emoji, style: const TextStyle(fontSize: 24)),
        ),
      );
    } else {
      iconChild = Text(widget.emoji, style: const TextStyle(fontSize: 24));
    }

    final child = Container(
      width: 72,
      padding: const EdgeInsets.symmetric(vertical: 8),
      decoration: BoxDecoration(
        color: widget.enabled
            ? Colors.white.withValues(alpha: 0.92)
            : Colors.white.withValues(alpha: 0.55),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: widget.enabled
              ? FeedEditorialTokens.teal.withValues(alpha: 0.12)
              : NmdColors.borderSubtle.withValues(alpha: 0.5),
        ),
        boxShadow: widget.enabled
            ? [
                BoxShadow(
                  color: FeedEditorialTokens.teal.withValues(alpha: 0.07),
                  blurRadius: 8,
                  offset: const Offset(0, 3),
                ),
              ]
            : null,
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          iconChild,
          const SizedBox(height: 4),
          Text(
            widget.label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
            style: NmdTypography.label.copyWith(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: widget.enabled
                  ? FeedEditorialTokens.navy
                  : NmdColors.textTertiary,
            ),
          ),
        ],
      ),
    );

    if (!widget.enabled || widget.onTap == null) {
      return Opacity(opacity: 0.72, child: child);
    }

    return GestureDetector(
      onTap: widget.onTap,
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      child: AnimatedScale(
        scale: _pressed ? 0.94 : 1,
        duration: const Duration(milliseconds: 110),
        curve: Curves.easeOut,
        child: child,
      ),
    );
  }
}
