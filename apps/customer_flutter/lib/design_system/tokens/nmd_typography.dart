import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'nmd_colors.dart';

/// Cairo typography scale for Now Market.
abstract final class NmdTypography {
  static TextStyle _base({
    required double size,
    required FontWeight weight,
    double height = 1.35,
    Color color = NmdColors.textPrimary,
    double? letterSpacing,
  }) {
    return GoogleFonts.cairo(
      fontSize: size,
      fontWeight: weight,
      height: height,
      color: color,
      letterSpacing: letterSpacing,
    );
  }

  static TextStyle get display => _base(
        size: 28,
        weight: FontWeight.w800,
        height: 1.2,
        letterSpacing: -0.4,
      );

  static TextStyle get h1 => _base(
        size: 22,
        weight: FontWeight.w800,
        height: 1.25,
        letterSpacing: -0.3,
      );

  static TextStyle get h2 => _base(
        size: 18,
        weight: FontWeight.w800,
        height: 1.3,
        letterSpacing: -0.2,
      );

  static TextStyle get h3 => _base(size: 16, weight: FontWeight.w700, height: 1.35);

  static TextStyle get body => _base(size: 15, weight: FontWeight.w600);

  static TextStyle get bodyBold => _base(size: 15, weight: FontWeight.w700);

  static TextStyle get bodySmall => _base(
        size: 13,
        weight: FontWeight.w600,
        color: NmdColors.textSecondary,
      );

  static TextStyle get label => _base(size: 12, weight: FontWeight.w700);

  static TextStyle get micro => _base(
        size: 10,
        weight: FontWeight.w700,
        color: NmdColors.textSecondary.withValues(alpha: 0.92),
      );

  static TextStyle get button =>
      _base(size: 15, weight: FontWeight.w700, color: NmdColors.textOnBrand, height: 1.1);

  static TextStyle get appBarTitle => _base(
        size: 17,
        weight: FontWeight.w700,
        color: NmdColors.textOnBrand,
        height: 1.0,
        letterSpacing: 0.2,
      );

  /// Customer-visible product / line price.
  static TextStyle get price => _base(
        size: 16,
        weight: FontWeight.w800,
        color: NmdColors.brandPrimary,
        height: 1.1,
      );

  /// Cart/checkout totals.
  static TextStyle get priceTotal => _base(
        size: 22,
        weight: FontWeight.w800,
        color: NmdColors.brandPrimary,
        height: 1.1,
      );

  /// Section headings on home and store pages.
  static TextStyle get sectionTitle => h2;

  /// Build Material [TextTheme] from scale.
  static TextTheme textTheme(Color bodyColor) {
    return TextTheme(
      displayLarge: display.copyWith(color: bodyColor),
      displayMedium: h1.copyWith(color: bodyColor),
      displaySmall: h2.copyWith(color: bodyColor),
      headlineMedium: h2.copyWith(color: bodyColor),
      headlineSmall: h3.copyWith(color: bodyColor),
      titleLarge: h3.copyWith(color: bodyColor),
      titleMedium: bodyBold.copyWith(color: bodyColor),
      titleSmall: bodyBold.copyWith(fontSize: 14, color: bodyColor),
      bodyLarge: body.copyWith(color: bodyColor),
      bodyMedium: body.copyWith(color: bodyColor),
      bodySmall: bodySmall.copyWith(color: NmdColors.textSecondary),
      labelLarge: label.copyWith(color: bodyColor),
      labelMedium: label.copyWith(fontSize: 11, color: NmdColors.textSecondary),
      labelSmall: micro.copyWith(color: NmdColors.textSecondary),
    );
  }
}

/// Convenient access via `context.nmdText`.
extension NmdTypographyContext on BuildContext {
  TextTheme get nmdText => Theme.of(this).textTheme;
}
