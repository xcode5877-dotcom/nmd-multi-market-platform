import 'package:flutter/material.dart';

import '../tokens/nmd_colors.dart';

/// Unified premium marketplace tokens — radii, shadows, glow, gradients, motion.
abstract final class PremiumMarketplaceDesignSystem {
  // Spacing
  static const double sectionGap = 28;
  static const double cardGap = 18;
  static const double chipGap = 6;
  static const double heroInset = 22;
  static const double heroSpacingLg = 36;
  static const double immersivePadding = 20;

  // Layout ratios
  static const double rewardCarouselAspect = 16 / 9;
  static const double serviceTileHeightBase = 252;
  static const double carouselViewportFraction = 0.82;

  // Radii
  static const double radiusSm = 14;
  static const double radiusMd = 18;
  static const double radiusLg = 22;
  static const double radiusXl = 28;
  static const double radiusHero = 32;

  static BorderRadius get borderSm => BorderRadius.circular(radiusSm);
  static BorderRadius get borderMd => BorderRadius.circular(radiusMd);
  static BorderRadius get borderLg => BorderRadius.circular(radiusLg);
  static BorderRadius get borderXl => BorderRadius.circular(radiusXl);

  // CTA
  static const double ctaHeight = 44;
  static const double dockHeight = 50;
  static const double iconContainerMd = 40;

  // Motion — slower, calmer luxury
  static const Duration entrance = Duration(milliseconds: 680);
  static const Duration micro = Duration(milliseconds: 360);
  static const Duration shimmer = Duration(milliseconds: 1800);
  static const Duration ambientDrift = Duration(milliseconds: 6200);
  static const Duration glowBreath = Duration(milliseconds: 3400);
  static const Curve entranceCurve = Curves.easeOutQuart;
  static const Curve pressCurve = Curves.easeOutCubic;
  static const Curve cinematicCurve = Curves.easeInOutCubic;
  static const ScrollPhysics carouselPhysics =
      BouncingScrollPhysics(parent: PageScrollPhysics());

  // Glow — reduced intensity
  static const double glowSoft = 0.07;
  static const double glowMedium = 0.16;
  static const double glowStrong = 0.28;

  static Color brandGlow([double alpha = glowMedium]) =>
      const Color(0xFF134E4A).withValues(alpha: alpha);
  static Color goldGlow([double alpha = 0.22]) =>
      NmdColors.accentGold.withValues(alpha: alpha);
  static Color edgeLight([double alpha = 0.45]) =>
      Colors.white.withValues(alpha: alpha);

  static List<BoxShadow> cardElevation({double y = 8, double blur = 24}) => [
        BoxShadow(
          color: Colors.black.withValues(alpha: 0.14),
          blurRadius: blur,
          offset: Offset(0, y),
          spreadRadius: -8,
        ),
      ];

  static LinearGradient iconWellGradient([Color? tint]) {
    final c = tint ?? const Color(0xFF134E4A);
    return LinearGradient(
      colors: [c.withValues(alpha: 0.14), c.withValues(alpha: 0.04)],
    );
  }

  static List<BoxShadow> focusedCarouselGlow() => [
        BoxShadow(
          color: brandGlow(glowMedium),
          blurRadius: 24,
          spreadRadius: -8,
          offset: const Offset(0, 8),
        ),
      ];

  static List<BoxShadow> cinematicCard({Color? accent, double intensity = glowMedium}) => [
        BoxShadow(
          color: (accent ?? const Color(0xFF134E4A)).withValues(alpha: intensity),
          blurRadius: 28,
          offset: const Offset(0, 12),
          spreadRadius: -10,
        ),
        BoxShadow(
          color: Colors.black.withValues(alpha: 0.35),
          blurRadius: 20,
          offset: const Offset(0, 8),
        ),
      ];

  // Luxury dark palette — less teal saturation
  static const LinearGradient cinematicHeroAmbient = LinearGradient(
    begin: Alignment.topRight,
    end: Alignment.bottomLeft,
    colors: [Color(0xFF111827), Color(0xFF0B0F14), Color(0xFF000000)],
    stops: [0.0, 0.55, 1.0],
  );

  static const LinearGradient rewardCardOverlay = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [Colors.transparent, Color(0x66000000), Color(0xF0050508)],
    stops: [0.15, 0.55, 1.0],
  );

  static const LinearGradient cinematicDarkOverlay = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [Color(0x55000000), Color(0xAA000000), Color(0xEE000000)],
    stops: [0.0, 0.48, 1.0],
  );

  static const LinearGradient storeHeroOverlay = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [
      Color(0x44000000),
      Color(0x88000000),
      Color(0xE6000000),
    ],
    stops: [0.0, 0.42, 1.0],
  );

  static const LinearGradient businessHeroOverlay = storeHeroOverlay;

  static const RadialGradient storeHeroVignette = RadialGradient(
    center: Alignment.center,
    radius: 1.1,
    colors: [Colors.transparent, Color(0x66000000)],
    stops: [0.55, 1.0],
  );

  static LinearGradient serviceImageOverlay = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [
      Colors.black.withValues(alpha: 0.08),
      Colors.black.withValues(alpha: 0.35),
      Colors.black.withValues(alpha: 0.88),
    ],
    stops: const [0.0, 0.55, 1.0],
  );

  static LinearGradient glassSurface = LinearGradient(
    colors: [
      Colors.white.withValues(alpha: 0.08),
      Colors.white.withValues(alpha: 0.02),
    ],
  );

  static LinearGradient glassTabActive = LinearGradient(
    colors: [
      const Color(0xFF1F2937).withValues(alpha: 0.92),
      const Color(0xFF134E4A).withValues(alpha: 0.55),
    ],
  );

  static LinearGradient carouselEdgeFadeRtl = LinearGradient(
    begin: Alignment.centerRight,
    end: Alignment.centerLeft,
    colors: [
      Colors.transparent,
      Colors.white,
      Colors.white,
      Colors.transparent,
    ],
    stops: const [0.0, 0.06, 0.94, 1.0],
  );
}
