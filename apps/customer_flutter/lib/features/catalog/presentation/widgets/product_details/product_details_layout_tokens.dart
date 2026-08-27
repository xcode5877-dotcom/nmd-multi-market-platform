import 'package:flutter/material.dart';

import '../../../../../design_system/tokens/nmd_colors.dart';
import '../../../../../design_system/tokens/nmd_motion.dart';

/// Single source of truth — Product Details design system.
abstract final class ProductDetailsLayoutTokens {
  // ── 8pt grid ──────────────────────────────────────────────────────────────
  static const double grid = 8;

  static const double pageHorizontal = 16;
  static const double sectionGap = 16;
  static const double blockGap = 16;
  static const double itemGap = 8;
  static const double titleGap = 8;
  static const double heroToTitleGap = 12;
  static const double descGap = 4;

  // ── Radius ────────────────────────────────────────────────────────────────
  static const double radiusSm = 12;
  static const double radiusMd = 16;
  static const double radiusLg = 20;
  static const double radiusPill = 20;

  static const double heroRadius = 0;
  static const double bottomBarRadius = radiusLg;
  static const double chipRadius = radiusSm;

  static double innerRadius(double outer) => (outer - 2).clamp(8, outer);

  // ── Component heights ─────────────────────────────────────────────────────
  static const double bottomBarHeight = 56;
  static const double ctaHeight = 48;
  static const double stepperHeight = 48;
  static const double thumbSize = 60;
  static const double thumbGap = 10;

  // ── Hero shell (fixed frame — reference ~45% viewport) ────────────────────
  static const double heroShellMin = 300;
  static const double heroShellMax = 430;
  static const double heroShellFactor = 0.45;
  static const double heroShellFactorSmall = 0.43;
  static const double heroShellFactorLarge = 0.46;
  static const double heroShellSmallScreenCutoff = 680;
  static const double heroShellLargeScreenCutoff = 880;

  // ── Icons ─────────────────────────────────────────────────────────────────
  static const double iconSm = 20;
  static const double iconMd = 24;
  static const double iconCheck = 16;

  // ── Typography ────────────────────────────────────────────────────────────
  static const double typeTitle = 20;
  static const double typePrice = 18;
  static const double typeBody = 15;
  static const double typeLabel = 13;
  static const double typeMicro = 11;
  static const double typeCaption = 12;

  // ── Motion ────────────────────────────────────────────────────────────────
  static const Duration motionMicro = NmdMotion.instant;
  static const Duration motionFast = NmdMotion.fast;
  static const Curve motionCurve = NmdMotion.standard;
  static const Curve motionCurveIn = NmdMotion.exit;

  // ── Elevation ─────────────────────────────────────────────────────────────
  static List<BoxShadow> get shadowSoft => [
        BoxShadow(
          color: NmdColors.brandPrimary.withValues(alpha: 0.04),
          blurRadius: 12,
          offset: const Offset(0, 3),
        ),
      ];

  static List<BoxShadow> get shadowLift => shadowSoft;

  static List<BoxShadow> get shadowDock => [
        BoxShadow(
          color: Colors.black.withValues(alpha: 0.04),
          blurRadius: 12,
          offset: const Offset(0, -2),
        ),
      ];

  static List<BoxShadow> shadowChipSelected(double t) => [
        BoxShadow(
          color: NmdColors.brandPrimary.withValues(alpha: 0.10 * t),
          blurRadius: 8,
          offset: const Offset(0, 2),
        ),
      ];

  static List<BoxShadow> get shadowCta => const [];
}
