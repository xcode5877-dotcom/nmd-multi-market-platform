import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';

import '../../api/resolve_image_url.dart';
import '../../core/visual_assets/shared_visual_asset.dart';
import '../tokens/nmd_colors.dart';
import '../tokens/nmd_typography.dart';
import 'premium_marketplace_design_system.dart';

/// Dynamic icon/image with shimmer, gradient well, and graceful fallback.
class PremiumAssetIcon extends StatelessWidget {
  const PremiumAssetIcon({
    super.key,
    this.asset,
    this.imageUrl,
    this.emojiFallback,
    this.size = PremiumMarketplaceDesignSystem.iconContainerMd,
    this.iconSize,
    this.tint,
    this.showGradientWell = true,
    this.borderRadius,
  });

  final SharedVisualAsset? asset;
  final String? imageUrl;
  final String? emojiFallback;
  final double size;
  final double? iconSize;
  final Color? tint;
  final bool showGradientWell;
  final BorderRadius? borderRadius;

  String? get _resolvedUrl {
    final fromAsset = asset?.resolveUrl(darkMode: false);
    if (fromAsset != null && fromAsset.isNotEmpty) return resolveImageUrl(fromAsset);
    final direct = imageUrl?.trim();
    if (direct != null && direct.isNotEmpty) return resolveImageUrl(direct);
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final r = borderRadius ?? BorderRadius.circular(size * 0.28);
    final url = _resolvedUrl;

    Widget inner;
    if (url != null) {
      inner = CachedNetworkImage(
        imageUrl: url,
        width: size,
        height: size,
        fit: BoxFit.contain,
        fadeInDuration: PremiumMarketplaceDesignSystem.micro,
        placeholder: (_, __) => _ShimmerBox(size: size, radius: r),
        errorWidget: (_, __, ___) => _FallbackContent(
          emoji: emojiFallback,
          size: size,
          iconSize: iconSize,
        ),
      );
    } else {
      inner = _FallbackContent(
        emoji: emojiFallback,
        size: size,
        iconSize: iconSize,
      );
    }

    return RepaintBoundary(
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          borderRadius: r,
          gradient: showGradientWell
              ? PremiumMarketplaceDesignSystem.iconWellGradient(tint)
              : null,
          color: showGradientWell ? null : NmdColors.surfaceMuted,
          boxShadow: PremiumMarketplaceDesignSystem.cardElevation(
            y: 2,
            blur: 8,
          ),
        ),
        clipBehavior: Clip.antiAlias,
        child: inner,
      ),
    );
  }
}

class PremiumCategoryBadge extends StatelessWidget {
  const PremiumCategoryBadge({
    super.key,
    required this.label,
    this.imageUrl,
    this.emojiFallback,
    this.selected = false,
    this.onTap,
  });

  final String label;
  final String? imageUrl;
  final String? emojiFallback;
  final bool selected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: PremiumMarketplaceDesignSystem.borderSm,
        child: AnimatedContainer(
          duration: PremiumMarketplaceDesignSystem.micro,
          curve: PremiumMarketplaceDesignSystem.entranceCurve,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            borderRadius: PremiumMarketplaceDesignSystem.borderSm,
            gradient: selected
                ? LinearGradient(
                    colors: [
                      NmdColors.brandPrimary.withValues(alpha: 0.95),
                      NmdColors.brandPrimary.withValues(alpha: 0.75),
                    ],
                  )
                : PremiumMarketplaceDesignSystem.glassSurface,
            border: Border.all(
              color: selected
                  ? NmdColors.brandSecondary.withValues(alpha: 0.6)
                  : Colors.white.withValues(alpha: 0.12),
            ),
            boxShadow: selected
                ? PremiumMarketplaceDesignSystem.focusedCarouselGlow()
                : null,
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            textDirection: TextDirection.rtl,
            children: [
              PremiumAssetIcon(
                imageUrl: imageUrl,
                emojiFallback: emojiFallback,
                size: 28,
                showGradientWell: !selected,
              ),
              const SizedBox(width: 8),
              Text(
                label,
                style: NmdTypography.label.copyWith(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: selected ? NmdColors.textOnBrand : NmdColors.textOnDark,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

enum PremiumRewardStatusTone { available, soon, locked }

/// Cinematic reward artwork with edge-lit overlay.
class PremiumRewardArtwork extends StatelessWidget {
  const PremiumRewardArtwork({
    super.key,
    required this.imageUrl,
    this.height = 160,
    this.statusLabel,
    this.statusTone = PremiumRewardStatusTone.available,
  });

  factory PremiumRewardArtwork.available({required String? imageUrl, double height = 160}) =>
      PremiumRewardArtwork(
        imageUrl: imageUrl,
        height: height,
        statusLabel: 'متاح الآن',
        statusTone: PremiumRewardStatusTone.available,
      );

  factory PremiumRewardArtwork.comingSoon({required String? imageUrl, double height = 160}) =>
      PremiumRewardArtwork(
        imageUrl: imageUrl,
        height: height,
        statusLabel: 'قريباً',
        statusTone: PremiumRewardStatusTone.soon,
      );

  factory PremiumRewardArtwork.locked({
    required String? imageUrl,
    required String label,
    double height = 160,
  }) =>
      PremiumRewardArtwork(
        imageUrl: imageUrl,
        height: height,
        statusLabel: label,
        statusTone: PremiumRewardStatusTone.locked,
      );

  final String? imageUrl;
  final double height;
  final String? statusLabel;
  final PremiumRewardStatusTone statusTone;

  @override
  Widget build(BuildContext context) {
    final url = imageUrl?.trim();
    return RepaintBoundary(
      child: ClipRRect(
        borderRadius: const BorderRadius.vertical(
          top: Radius.circular(PremiumMarketplaceDesignSystem.radiusXl),
        ),
        child: SizedBox(
          height: height,
          width: double.infinity,
          child: Stack(
            fit: StackFit.expand,
            children: [
              if (url != null && url.isNotEmpty)
                CachedNetworkImage(
                  imageUrl: resolveImageUrl(url),
                  fit: BoxFit.cover,
                  placeholder: (_, __) =>
                      _ShimmerBox(size: height, radius: BorderRadius.zero),
                  errorWidget: (_, __, ___) => const _RewardArtFallback(),
                )
              else
                const _RewardArtFallback(),
              const DecoratedBox(
                decoration: BoxDecoration(
                  gradient: PremiumMarketplaceDesignSystem.rewardCardOverlay,
                ),
              ),
              Positioned(
                left: 0,
                top: 0,
                bottom: 0,
                width: 4,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [
                        PremiumMarketplaceDesignSystem.edgeLight(0.7),
                        NmdColors.accentGold.withValues(alpha: 0.85),
                        NmdColors.accentGold.withValues(alpha: 0.4),
                      ],
                    ),
                  ),
                ),
              ),
              if (statusLabel != null)
                Positioned(
                  top: 12,
                  right: 12,
                  child: _RewardStatusPill(
                    label: statusLabel!,
                    tone: statusTone,
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _RewardStatusPill extends StatelessWidget {
  const _RewardStatusPill({required this.label, required this.tone});

  final String label;
  final PremiumRewardStatusTone tone;

  @override
  Widget build(BuildContext context) {
    final colors = switch (tone) {
      PremiumRewardStatusTone.available => (
          NmdColors.success.withValues(alpha: 0.92),
          NmdColors.textOnBrand,
        ),
      PremiumRewardStatusTone.soon => (
          NmdColors.accentGold.withValues(alpha: 0.9),
          const Color(0xFF1A1200),
        ),
      PremiumRewardStatusTone.locked => (
          Colors.white.withValues(alpha: 0.16),
          Colors.white70,
        ),
    };
    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.$1,
        borderRadius: BorderRadius.circular(99),
        boxShadow: PremiumMarketplaceDesignSystem.cardElevation(y: 2, blur: 6),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        child: Text(
          label,
          style: NmdTypography.micro.copyWith(
            fontWeight: FontWeight.w800,
            color: colors.$2,
            fontSize: 10,
          ),
        ),
      ),
    );
  }
}

/// Edge-to-edge service showcase card artwork.
class PremiumServiceArtwork extends StatelessWidget {
  const PremiumServiceArtwork({
    super.key,
    required this.imageUrl,
    this.height = 168,
    this.fallbackLabel,
  });

  final String imageUrl;
  final double height;
  final String? fallbackLabel;

  @override
  Widget build(BuildContext context) {
    final url = imageUrl.trim();
    return RepaintBoundary(
      child: ClipRRect(
        borderRadius: PremiumMarketplaceDesignSystem.borderLg,
        child: SizedBox(
          height: height,
          width: double.infinity,
          child: Stack(
            fit: StackFit.expand,
            children: [
              if (url.isNotEmpty)
                CachedNetworkImage(
                  imageUrl: resolveImageUrl(url),
                  fit: BoxFit.cover,
                  placeholder: (_, __) => _ShimmerBox(
                    size: height,
                    radius: PremiumMarketplaceDesignSystem.borderLg,
                  ),
                  errorWidget: (_, __, ___) =>
                      _ServiceArtFallback(label: fallbackLabel),
                )
              else
                _ServiceArtFallback(label: fallbackLabel),
              DecoratedBox(
                decoration: BoxDecoration(
                  gradient: PremiumMarketplaceDesignSystem.serviceImageOverlay,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ShimmerBox extends StatelessWidget {
  const _ShimmerBox({required this.size, required this.radius});

  final double size;
  final BorderRadius radius;

  @override
  Widget build(BuildContext context) {
    return Shimmer.fromColors(
      period: PremiumMarketplaceDesignSystem.shimmer,
      baseColor: NmdColors.surfaceMuted.withValues(alpha: 0.35),
      highlightColor: Colors.white.withValues(alpha: 0.12),
      child: Container(
        width: size == double.infinity ? null : size,
        height: size,
        decoration: BoxDecoration(
          color: NmdColors.surfaceMuted,
          borderRadius: radius,
        ),
      ),
    );
  }
}

class _FallbackContent extends StatelessWidget {
  const _FallbackContent({
    required this.size,
    this.emoji,
    this.iconSize,
  });

  final double size;
  final String? emoji;
  final double? iconSize;

  @override
  Widget build(BuildContext context) {
    if (emoji != null && emoji!.trim().isNotEmpty) {
      return Center(
        child: Text(
          emoji!,
          style: TextStyle(fontSize: (iconSize ?? size * 0.5)),
        ),
      );
    }
    return Center(
      child: Icon(
        Icons.image_outlined,
        size: iconSize ?? size * 0.42,
        color: NmdColors.textTertiary,
      ),
    );
  }
}

class _RewardArtFallback extends StatelessWidget {
  const _RewardArtFallback();

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            NmdColors.brandPrimary.withValues(alpha: 0.55),
            NmdColors.surfaceCommunitySoft,
          ],
        ),
      ),
      child: Center(
        child: Icon(
          Icons.card_giftcard_rounded,
          size: 48,
          color: Colors.white.withValues(alpha: 0.25),
        ),
      ),
    );
  }
}

class _ServiceArtFallback extends StatelessWidget {
  const _ServiceArtFallback({this.label});

  final String? label;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            NmdColors.brandPrimary.withValues(alpha: 0.15),
            NmdColors.tintAliveSoft,
          ],
        ),
      ),
      child: Center(
        child: Text(
          label?.isNotEmpty == true ? label![0] : '✦',
          style: NmdTypography.h1.copyWith(
            color: NmdColors.brandPrimary.withValues(alpha: 0.35),
          ),
        ),
      ),
    );
  }
}
