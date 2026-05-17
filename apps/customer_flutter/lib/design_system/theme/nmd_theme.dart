import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../tokens/nmd_colors.dart';
import '../tokens/nmd_radius.dart';
import '../tokens/nmd_spacing.dart';
import '../tokens/nmd_typography.dart';

/// Now Market Material theme — Alive + Premium + Community-Driven.
abstract final class NmdTheme {
  NmdTheme._();

  static ThemeData get light {
    final base = ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      colorScheme: ColorScheme.fromSeed(
        seedColor: NmdColors.brandPrimary,
        primary: NmdColors.brandPrimary,
        onPrimary: NmdColors.textOnBrand,
        secondary: NmdColors.brandSecondary,
        onSecondary: NmdColors.textOnBrand,
        surface: NmdColors.surfaceBase,
        onSurface: NmdColors.textPrimary,
        error: NmdColors.error,
      ),
      scaffoldBackgroundColor: NmdColors.brandDeep,
      splashFactory: InkRipple.splashFactory,
      visualDensity: VisualDensity.standard,
    );

    final textTheme = GoogleFonts.cairoTextTheme(
      NmdTypography.textTheme(NmdColors.textPrimary),
    );

    return base.copyWith(
      textTheme: textTheme,
      primaryTextTheme: textTheme,
      appBarTheme: AppBarTheme(
        backgroundColor: NmdColors.brandPrimary,
        foregroundColor: NmdColors.textOnBrand,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: true,
        titleTextStyle: NmdTypography.appBarTitle,
        iconTheme: const IconThemeData(color: NmdColors.textOnBrand),
      ),
      dividerTheme: const DividerThemeData(
        color: NmdColors.divider,
        thickness: 1,
        space: 1,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: NmdColors.surfaceMuted,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: NmdSpacing.sm + 2,
          vertical: NmdSpacing.sm,
        ),
        labelStyle: NmdTypography.bodySmall.copyWith(fontSize: 13),
        hintStyle: NmdTypography.bodySmall.copyWith(color: NmdColors.textTertiary),
        border: OutlineInputBorder(
          borderRadius: NmdRadius.borderSm,
          borderSide: const BorderSide(color: NmdColors.borderSubtle),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: NmdRadius.borderSm,
          borderSide: const BorderSide(color: NmdColors.borderSubtle),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: NmdRadius.borderSm,
          borderSide: const BorderSide(color: NmdColors.brandPrimary, width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: NmdRadius.borderSm,
          borderSide: const BorderSide(color: NmdColors.error),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: NmdRadius.borderSm,
          borderSide: const BorderSide(color: NmdColors.error, width: 1.2),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: _primaryButtonStyle(),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: _primaryButtonStyle(),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: NmdColors.brandPrimary,
          textStyle: NmdTypography.bodyBold.copyWith(color: NmdColors.brandPrimary),
          shape: RoundedRectangleBorder(borderRadius: NmdRadius.borderPill),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: NmdColors.brandPrimary,
          side: const BorderSide(color: NmdColors.brandPrimary, width: 1.4),
          minimumSize: const Size.fromHeight(48),
          textStyle: NmdTypography.bodyBold.copyWith(color: NmdColors.brandPrimary),
          shape: RoundedRectangleBorder(borderRadius: NmdRadius.borderPill),
        ),
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        color: NmdColors.surfaceBase,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: NmdRadius.borderMd,
          side: const BorderSide(color: NmdColors.borderSubtle),
        ),
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: NmdRadius.borderSm),
        backgroundColor: NmdColors.surfaceCommunitySoft,
        contentTextStyle: NmdTypography.body.copyWith(color: NmdColors.textOnDark),
      ),
      progressIndicatorTheme: const ProgressIndicatorThemeData(
        color: NmdColors.brandPrimary,
      ),
      extensions: const [NmdThemeExtras()],
    );
  }

  static ButtonStyle _primaryButtonStyle() {
    return ElevatedButton.styleFrom(
      backgroundColor: NmdColors.brandPrimary,
      foregroundColor: NmdColors.textOnBrand,
      disabledBackgroundColor: NmdColors.brandPrimary.withValues(alpha: 0.4),
      disabledForegroundColor: NmdColors.textOnBrand.withValues(alpha: 0.7),
      minimumSize: const Size.fromHeight(52),
      textStyle: NmdTypography.button,
      shape: RoundedRectangleBorder(borderRadius: NmdRadius.borderPill),
      elevation: 0,
    );
  }
}

/// Theme extension for design-system extras (surface modes, etc.).
class NmdThemeExtras extends ThemeExtension<NmdThemeExtras> {
  const NmdThemeExtras({
    this.useCommunitySurface = false,
  });

  final bool useCommunitySurface;

  @override
  NmdThemeExtras copyWith({bool? useCommunitySurface}) {
    return NmdThemeExtras(
      useCommunitySurface: useCommunitySurface ?? this.useCommunitySurface,
    );
  }

  @override
  NmdThemeExtras lerp(ThemeExtension<NmdThemeExtras>? other, double t) {
    if (other is! NmdThemeExtras) return this;
    return t < 0.5 ? this : other;
  }
}

extension NmdThemeExtrasContext on BuildContext {
  NmdThemeExtras get nmdExtras =>
      Theme.of(this).extension<NmdThemeExtras>() ?? const NmdThemeExtras();
}
