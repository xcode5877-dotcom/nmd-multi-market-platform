import 'package:flutter/material.dart';

import '../tokens/nmd_colors.dart';
import '../tokens/nmd_radius.dart';
import '../tokens/nmd_typography.dart';

enum NmdButtonVariant { primary, secondary, ghost, destructive }

enum NmdButtonSize { large, medium, compact }

/// Pill-shaped action button aligned with Now Market identity.
class NmdButton extends StatelessWidget {
  const NmdButton({
    super.key,
    required this.label,
    this.onPressed,
    this.variant = NmdButtonVariant.primary,
    this.size = NmdButtonSize.large,
    this.icon,
    this.loading = false,
    this.expand = true,
  });

  final String label;
  final VoidCallback? onPressed;
  final NmdButtonVariant variant;
  final NmdButtonSize size;
  final Widget? icon;
  final bool loading;
  final bool expand;

  double get _height => switch (size) {
        NmdButtonSize.large => 52,
        NmdButtonSize.medium => 48,
        NmdButtonSize.compact => 40,
      };

  @override
  Widget build(BuildContext context) {
    final enabled = onPressed != null && !loading;
    final style = _style(enabled);
    final child = loading
        ? SizedBox(
            width: 22,
            height: 22,
            child: CircularProgressIndicator(
              strokeWidth: 2.2,
              color: style.foregroundColor,
            ),
          )
        : Row(
            mainAxisSize: MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (icon != null) ...[icon!, const SizedBox(width: 8)],
              Text(label, style: style.textStyle),
            ],
          );

    final button = Material(
      color: style.backgroundColor,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: NmdRadius.borderPill,
        side: style.borderSide,
      ),
      child: InkWell(
        onTap: enabled ? onPressed : null,
        borderRadius: NmdRadius.borderPill,
        child: SizedBox(
          height: _height,
          width: expand ? double.infinity : null,
          child: Center(child: child),
        ),
      ),
    );

    return Semantics(
      button: true,
      enabled: enabled,
      label: label,
      child: button,
    );
  }

  _NmdButtonStyle _style(bool enabled) {
    final opacity = enabled ? 1.0 : 0.45;
    return switch (variant) {
      NmdButtonVariant.primary => _NmdButtonStyle(
          backgroundColor: NmdColors.brandPrimary.withValues(alpha: opacity),
          foregroundColor: NmdColors.textOnBrand,
          textStyle: NmdTypography.button,
          borderSide: BorderSide.none,
        ),
      NmdButtonVariant.secondary => _NmdButtonStyle(
          backgroundColor: Colors.transparent,
          foregroundColor: NmdColors.brandPrimary.withValues(alpha: opacity),
          textStyle: NmdTypography.bodyBold.copyWith(color: NmdColors.brandPrimary),
          borderSide: BorderSide(
            color: NmdColors.brandPrimary.withValues(alpha: opacity),
            width: 1.4,
          ),
        ),
      NmdButtonVariant.ghost => _NmdButtonStyle(
          backgroundColor: Colors.transparent,
          foregroundColor: NmdColors.brandPrimary.withValues(alpha: opacity),
          textStyle: NmdTypography.bodyBold.copyWith(color: NmdColors.brandPrimary),
          borderSide: BorderSide.none,
        ),
      NmdButtonVariant.destructive => _NmdButtonStyle(
          backgroundColor: NmdColors.error.withValues(alpha: opacity),
          foregroundColor: NmdColors.textOnBrand,
          textStyle: NmdTypography.button,
          borderSide: BorderSide.none,
        ),
    };
  }
}

class _NmdButtonStyle {
  const _NmdButtonStyle({
    required this.backgroundColor,
    required this.foregroundColor,
    required this.textStyle,
    required this.borderSide,
  });

  final Color backgroundColor;
  final Color foregroundColor;
  final TextStyle textStyle;
  final BorderSide borderSide;
}
