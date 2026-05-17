import 'package:flutter/material.dart';

import '../../design_system/tokens/nmd_colors.dart';

/// Legacy color aliases — prefer [NmdColors] in new code.
final class AppColors {
  AppColors._();

  // Shell keeps historical #00695C until screen migration unifies shell tokens.
  static const Color shellTeal = Color(0xFF00695C);

  static const Color primaryTeal = NmdColors.brandPrimary;
  static const Color secondaryTeal = NmdColors.brandSecondary;
  static const Color surface = NmdColors.surfaceBase;
  static const Color textPrimary = NmdColors.textPrimary;
  static const Color textOnTeal = NmdColors.textOnBrand;
}
