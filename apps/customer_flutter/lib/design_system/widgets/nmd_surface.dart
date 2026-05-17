import 'package:flutter/material.dart';

import '../tokens/nmd_colors.dart';
import '../tokens/nmd_radius.dart';
import '../tokens/nmd_spacing.dart';

enum NmdSurfaceMode { commerce, community, muted, alive }

/// Layered surface container (white card on teal shell, or community dark).
class NmdSurface extends StatelessWidget {
  const NmdSurface({
    super.key,
    required this.child,
    this.mode = NmdSurfaceMode.commerce,
    this.padding,
    this.margin,
    this.borderRadius,
    this.clip = false,
  });

  final Widget child;
  final NmdSurfaceMode mode;
  final EdgeInsetsGeometry? padding;
  final EdgeInsetsGeometry? margin;
  final BorderRadius? borderRadius;
  final bool clip;

  @override
  Widget build(BuildContext context) {
    final radius = borderRadius ?? NmdRadius.borderLg;
    final decoration = BoxDecoration(
      color: _color,
      borderRadius: radius,
      border: _border,
    );

    Widget content = Padding(
      padding: padding ?? const EdgeInsets.all(NmdSpacing.md),
      child: child,
    );

    if (clip) {
      content = ClipRRect(borderRadius: radius, child: content);
    }

    return Padding(
      padding: margin ?? EdgeInsets.zero,
      child: DecoratedBox(decoration: decoration, child: content),
    );
  }

  Color get _color => switch (mode) {
        NmdSurfaceMode.commerce => NmdColors.surfaceBase,
        NmdSurfaceMode.community => NmdColors.surfaceCommunity,
        NmdSurfaceMode.muted => NmdColors.surfaceMuted,
        NmdSurfaceMode.alive => NmdColors.tintAliveSoft,
      };

  Border? get _border => switch (mode) {
        NmdSurfaceMode.commerce =>
          const Border.fromBorderSide(BorderSide(color: NmdColors.borderSubtle)),
        NmdSurfaceMode.community => null,
        NmdSurfaceMode.muted => null,
        NmdSurfaceMode.alive =>
          Border.all(color: NmdColors.brandPrimary.withValues(alpha: 0.12)),
      };
}
