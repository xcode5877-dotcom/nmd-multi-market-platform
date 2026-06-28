import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../../../../../design_system/tokens/nmd_colors.dart';
import '../../../../../design_system/tokens/nmd_motion.dart';
import 'product_image_preloader.dart';
import 'product_image_shimmer.dart';

/// Single gallery slide — always [BoxFit.contain], optional Hero for shared transition.
class ProductImageHero extends StatelessWidget {
  const ProductImageHero({
    super.key,
    required this.imageUrl,
    required this.layoutWidth,
    this.heroTag,
    this.enableHero = false,
    this.imageKey,
    this.onTap,
    this.semanticLabel,
    this.backgroundColor,
    this.borderRadius = BorderRadius.zero,
    this.padding = EdgeInsets.zero,
  });

  final String imageUrl;
  final double layoutWidth;
  final String? heroTag;
  final bool enableHero;
  final Key? imageKey;
  final VoidCallback? onTap;
  final String? semanticLabel;
  final Color? backgroundColor;
  final BorderRadius borderRadius;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    final memWidth = ProductImagePreloader.memCacheWidthForLayout(
      context,
      layoutWidth,
    );

    Widget image = imageUrl.isEmpty
        ? ProductImageShimmer(borderRadius: borderRadius)
        : CachedNetworkImage(
            imageUrl: imageUrl,
            fit: BoxFit.contain,
            memCacheWidth: memWidth,
            fadeInDuration: NmdMotion.normal,
            fadeOutDuration: NmdMotion.fast,
            placeholder: (_, __) => ProductImageShimmer(borderRadius: borderRadius),
            errorWidget: (_, __, ___) => ColoredBox(
              color: backgroundColor ?? NmdColors.tintAliveMuted,
              child: const Center(
                child: Icon(Icons.image_not_supported_outlined, size: 40),
              ),
            ),
          );

    image = Padding(padding: padding, child: image);

    if (borderRadius != BorderRadius.zero) {
      image = ClipRRect(borderRadius: borderRadius, child: image);
    }

    image = Semantics(
      label: semanticLabel ?? 'صورة المنتج',
      image: true,
      button: onTap != null,
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: image,
      ),
    );

    if (enableHero && heroTag != null && heroTag!.isNotEmpty) {
      image = Hero(
        tag: heroTag!,
        createRectTween: (begin, end) =>
            MaterialRectCenterArcTween(begin: begin, end: end),
        flightShuttleBuilder: (
          flightContext,
          animation,
          flightDirection,
          fromHeroContext,
          toHeroContext,
        ) {
          final target = flightDirection == HeroFlightDirection.push
              ? toHeroContext.widget
              : fromHeroContext.widget;
          return FadeTransition(
            opacity: animation.drive(
              Tween<double>(begin: 0.92, end: 1).chain(
                CurveTween(curve: Curves.easeOutCubic),
              ),
            ),
            child: target,
          );
        },
        child: Material(color: Colors.transparent, child: image),
      );
    }

    return KeyedSubtree(key: imageKey, child: image);
  }
}
