import 'package:flutter/material.dart';

import '../tokens/nmd_radius.dart';
import '../tokens/nmd_semantic.dart';
import '../tokens/nmd_spacing.dart';
import '../tokens/nmd_typography.dart';

/// Compact status / count badge.
class NmdBadge extends StatelessWidget {
  const NmdBadge({
    super.key,
    required this.label,
    this.tone = NmdBadgeTone.brand,
    this.compact = false,
  });

  final String label;
  final NmdBadgeTone tone;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final bg = NmdSemantic.badgeBackground(tone);
    final fg = NmdSemantic.badgeForeground(tone);
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: compact ? NmdSpacing.xxs + 2 : NmdSpacing.xs,
        vertical: compact ? 2 : NmdSpacing.xxs,
      ),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: NmdRadius.borderPill,
      ),
      child: Text(
        label,
        style: (compact ? NmdTypography.micro : NmdTypography.label).copyWith(
          color: fg,
          fontSize: compact ? 9 : null,
        ),
      ),
    );
  }
}
