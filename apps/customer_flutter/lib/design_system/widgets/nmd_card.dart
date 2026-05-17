import 'package:flutter/material.dart';

import '../tokens/nmd_colors.dart';
import '../tokens/nmd_radius.dart';
import '../tokens/nmd_shadows.dart';
import '../tokens/nmd_spacing.dart';

enum NmdCardVariant { elevated, outlined, flat, community }

/// Standard content card for commerce and community surfaces.
class NmdCard extends StatelessWidget {
  const NmdCard({
    super.key,
    required this.child,
    this.variant = NmdCardVariant.outlined,
    this.padding,
    this.margin,
    this.onTap,
    this.borderRadius,
  });

  final Widget child;
  final NmdCardVariant variant;
  final EdgeInsetsGeometry? padding;
  final EdgeInsetsGeometry? margin;
  final VoidCallback? onTap;
  final BorderRadius? borderRadius;

  @override
  Widget build(BuildContext context) {
    final radius = borderRadius ?? NmdRadius.borderMd;
    final decoration = BoxDecoration(
      color: _background,
      borderRadius: radius,
      border: _border,
      boxShadow: _shadow,
    );

    Widget content = Padding(
      padding: padding ?? const EdgeInsets.all(NmdSpacing.md),
      child: child,
    );

    if (onTap != null) {
      content = Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: radius,
          child: content,
        ),
      );
    }

    return Padding(
      padding: margin ?? EdgeInsets.zero,
      child: DecoratedBox(
        decoration: decoration,
        child: content,
      ),
    );
  }

  Color get _background => switch (variant) {
        NmdCardVariant.community => NmdColors.surfaceCommunitySoft,
        _ => NmdColors.surfaceBase,
      };

  Border? get _border => switch (variant) {
        NmdCardVariant.outlined || NmdCardVariant.elevated =>
          const Border.fromBorderSide(BorderSide(color: NmdColors.borderSubtle)),
        NmdCardVariant.community =>
          Border.all(color: NmdColors.accentGold.withValues(alpha: 0.2)),
        NmdCardVariant.flat => null,
      };

  List<BoxShadow> get _shadow => switch (variant) {
        NmdCardVariant.elevated => NmdShadows.md,
        _ => NmdShadows.none,
      };
}
