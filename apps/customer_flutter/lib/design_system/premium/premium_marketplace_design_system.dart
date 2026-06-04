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
  static const double storeHeroHeightRatio = 0.36;
  static const double immersiveHeroHeightRatio = 0.88;
  static const double experienceSectionRatio = 0.72;
  static const double serviceTileHeightBase = 228;
  static const double serviceCarouselViewportFraction = 0.86;
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
  static const double heroBookPillHeight = 44;
  static const double iconContainerMd = 40;

  // Motion — luxury restraint
  static const Duration entrance = Duration(milliseconds: 580);
  static const Duration micro = Duration(milliseconds: 420);
  static const Duration snapDuration = Duration(milliseconds: 480);
  static const Duration chapterReveal = Duration(milliseconds: 680);
  static const Duration shimmer = Duration(milliseconds: 1800);
  static const Duration ambientDrift = Duration(milliseconds: 6800);
  static const Duration glowBreath = Duration(milliseconds: 3600);
  static const Curve entranceCurve = Curves.easeInOutQuart;
  static const Curve pressCurve = Curves.easeOutCubic;
  static const Curve cinematicCurve = Curves.easeInOutCubic;
  static const Curve snapCurve = Curves.easeOutCubic;
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
      Color(0x22000000),
      Color(0x44000000),
      Color(0x88000000),
    ],
    stops: [0.0, 0.45, 1.0],
  );

  static const LinearGradient immersiveHeroScrim = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [
      Color(0x12000000),
      Color(0x28000000),
      Color(0x55000000),
      Color(0x78000000),
    ],
    stops: [0.0, 0.35, 0.72, 1.0],
  );

  static const LinearGradient storeHeroLightOverlay = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [
      Color(0x18000000),
      Color(0x28000000),
      Color(0x52000000),
    ],
    stops: [0.0, 0.55, 1.0],
  );

  static const RadialGradient storeHeroWarmVignette = RadialGradient(
    center: Alignment(0.2, 0.35),
    radius: 1.15,
    colors: [
      Color(0x18D4A574),
      Colors.transparent,
      Color(0x33000000),
    ],
    stops: [0.0, 0.45, 1.0],
  );

  static const LinearGradient businessHeroOverlay = storeHeroOverlay;

  static const RadialGradient storeHeroVignette = RadialGradient(
    center: Alignment.center,
    radius: 1.1,
    colors: [Colors.transparent, Color(0x44000000)],
    stops: [0.6, 1.0],
  );

  static LinearGradient serviceImageOverlay = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [
      Colors.black.withValues(alpha: 0.04),
      Colors.black.withValues(alpha: 0.22),
      const Color(0xFF1A1F26).withValues(alpha: 0.62),
    ],
    stops: const [0.0, 0.58, 1.0],
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

  // ---------------------------------------------------------------------------
  // Services storefront — premium wellness (Now Market DNA)
  // ---------------------------------------------------------------------------

  static const double serviceHeroHeightMin = 300;
  static const double serviceHeroHeightMax = 340;
  static const double heroRadius = 32;
  static const double serviceBottomSheetRadius = 28;
  static const double serviceHeroVisualSize = 172;
  static const double serviceCardRadius = 28;
  static const double serviceCardMinHeight = 198;
  static const double serviceCardImageSize = 132;
  static const double serviceCardCtaHeight = 36;
  static const double sectionSpacing = 32;
  static const double heroTitleSize = 24;
  static const double cardTitleSize = 19;
  static const double sectionTitleSize = 18;
  static const double bodySize = 13;
  static const double microChipHeight = 28;

  static const Duration serviceMotionEntrance = Duration(milliseconds: 380);
  static const Duration serviceMotionScroll = Duration(milliseconds: 400);

  /// Back-compat aliases used elsewhere in the monorepo widget tree.
  static const double wellnessHeroHeightMin = serviceHeroHeightMin;
  static const double wellnessHeroHeightMax = serviceHeroHeightMax;
  static const double wellnessSectionRadius = heroRadius;
  static const double wellnessServiceCardRadius = serviceCardRadius;
  static const Duration wellnessEntrance = serviceMotionEntrance;
  static const Duration wellnessScroll = serviceMotionScroll;

  static double serviceHeroHeight(BuildContext context) {
    final h = MediaQuery.sizeOf(context).height * 0.34;
    return h.clamp(serviceHeroHeightMin, serviceHeroHeightMax);
  }

  static double wellnessHeroHeight(BuildContext context) =>
      serviceHeroHeight(context);

  static List<BoxShadow> serviceCardShadow() => [
        BoxShadow(
          color: const Color(0xFF0F172A).withValues(alpha: 0.04),
          blurRadius: 16,
          offset: const Offset(0, 4),
          spreadRadius: -2,
        ),
      ];

  static List<BoxShadow> wellnessCardShadow() => serviceCardShadow();

  static const LinearGradient serviceHeroGradient = LinearGradient(
    begin: Alignment.topRight,
    end: Alignment.bottomLeft,
    colors: [
      NmdColors.surfaceBase,
      NmdColors.tintAliveSoft,
      Color(0xFFF4FAF9),
    ],
    stops: [0.0, 0.55, 1.0],
  );

  static const LinearGradient wellnessHeroBackdrop = serviceHeroGradient;

  static const RadialGradient serviceImageGlow = RadialGradient(
    colors: [
      Color(0x1A0E7C72),
      Color(0x080E7C72),
      Colors.transparent,
    ],
    stops: [0.0, 0.55, 1.0],
  );

  static const RadialGradient wellnessImageGlow = serviceImageGlow;
}
