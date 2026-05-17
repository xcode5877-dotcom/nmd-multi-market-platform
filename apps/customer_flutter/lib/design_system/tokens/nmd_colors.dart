import 'package:flutter/material.dart';

/// Canonical Now Market color tokens.
///
/// Alive + Premium + Community-Driven: teal community shell, white commerce
/// surfaces, optional dark rewards zone, gold reserved for coins/achievements.
abstract final class NmdColors {
  // Brand
  static const Color brandPrimary = Color(0xFF0F766E);
  static const Color brandDeep = Color(0xFF0F6F6B);
  static const Color brandSecondary = Color(0xFF14B8A6);
  static const Color brandLight = Color(0xFF0D9488);

  // Alive backgrounds (community warmth)
  static const Color tintAlive = Color(0xFFE6FFFA);
  static const Color tintAliveSoft = Color(0xFFF0FDFA);
  static const Color tintAliveMuted = Color(0xFFF8FAFC);

  // Surfaces
  static const Color surfaceBase = Color(0xFFFFFFFF);
  static const Color surfaceMuted = Color(0xFFF8FAFC);
  static const Color surfaceElevated = Color(0xFFFFFFFF);
  static const Color surfaceCommunity = Color(0xFF0A0E14);
  static const Color surfaceCommunitySoft = Color(0xFF0F172A);

  // Text
  static const Color textPrimary = Color(0xFF0F172A);
  static const Color textSecondary = Color(0xFF64748B);
  static const Color textTertiary = Color(0xFF94A3B8);
  static const Color textOnBrand = Color(0xFFFFFFFF);
  static const Color textOnDark = Color(0xFFF8FAFC);

  // Borders & dividers
  static const Color borderSubtle = Color(0xFFE2E8F0);
  static const Color borderBrand = Color(0x330F766E);
  static const Color divider = Color(0xFFE5E7EB);

  // Rewards / coins (premium accent — use sparingly)
  static const Color accentGold = Color(0xFFD4AF37);
  static const Color accentGoldSoft = Color(0x33D4AF37);
  static const Color accentGoldDeep = Color(0xFFB8941F);

  // Semantic
  static const Color success = Color(0xFF059669);
  static const Color successSoft = Color(0xFFD1FAE5);
  static const Color warning = Color(0xFFD97706);
  static const Color warningSoft = Color(0xFFFEF3C7);
  static const Color error = Color(0xFFDC2626);
  static const Color errorSoft = Color(0xFFFEE2E2);
  static const Color info = Color(0xFF0284C7);
  static const Color infoSoft = Color(0xFFE0F2FE);

  // Legacy aliases (backward compatibility with [AppColors])
  static const Color shellTeal = brandDeep;
  static const Color primaryTeal = brandPrimary;
  static const Color secondaryTeal = brandSecondary;
  static const Color surface = surfaceBase;
}
