import 'package:flutter/material.dart';

import '../tokens/nmd_colors.dart';
import '../tokens/nmd_radius.dart';
import '../tokens/nmd_spacing.dart';
import '../tokens/nmd_typography.dart';

enum NmdChipVariant { filter, choice, status }

/// Pill chip for filters, categories, and light status tags.
class NmdChip extends StatelessWidget {
  const NmdChip({
    super.key,
    required this.label,
    this.selected = false,
    this.variant = NmdChipVariant.filter,
    this.onTap,
    this.leading,
    this.backgroundColor,
    this.foregroundColor,
  });

  final String label;
  final bool selected;
  final NmdChipVariant variant;
  final VoidCallback? onTap;
  final Widget? leading;
  final Color? backgroundColor;
  final Color? foregroundColor;

  @override
  Widget build(BuildContext context) {
    final bg = backgroundColor ?? _defaultBackground;
    final fg = foregroundColor ?? _defaultForeground;

    return Material(
      color: bg,
      shape: RoundedRectangleBorder(
        borderRadius: NmdRadius.borderPill,
        side: BorderSide(
          color: selected ? NmdColors.brandPrimary : NmdColors.borderSubtle,
          width: selected ? 1.5 : 1,
        ),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: NmdRadius.borderPill,
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: NmdSpacing.sm + 2,
            vertical: NmdSpacing.xxs + 2,
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (leading != null) ...[leading!, const SizedBox(width: 6)],
              Text(label, style: NmdTypography.label.copyWith(color: fg)),
            ],
          ),
        ),
      ),
    );
  }

  Color get _defaultBackground {
    if (backgroundColor != null) return backgroundColor!;
    return switch (variant) {
      NmdChipVariant.filter => selected ? NmdColors.tintAlive : NmdColors.surfaceMuted,
      NmdChipVariant.choice => selected ? NmdColors.brandPrimary : NmdColors.surfaceBase,
      NmdChipVariant.status => NmdColors.surfaceMuted,
    };
  }

  Color get _defaultForeground {
    if (foregroundColor != null) return foregroundColor!;
    return switch (variant) {
      NmdChipVariant.filter => selected ? NmdColors.brandPrimary : NmdColors.textSecondary,
      NmdChipVariant.choice =>
        selected ? NmdColors.textOnBrand : NmdColors.textPrimary,
      NmdChipVariant.status => NmdColors.textSecondary,
    };
  }
}
