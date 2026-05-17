import 'package:flutter/material.dart';

import '../tokens/nmd_colors.dart';
import '../tokens/nmd_spacing.dart';
import '../tokens/nmd_typography.dart';

enum NmdLoadingSize { small, medium, large }

/// Branded loading indicator with optional message.
class NmdLoading extends StatelessWidget {
  const NmdLoading({
    super.key,
    this.message,
    this.size = NmdLoadingSize.medium,
    this.fullscreen = false,
  });

  final String? message;
  final NmdLoadingSize size;
  final bool fullscreen;

  double get _stroke => switch (size) {
        NmdLoadingSize.small => 2,
        NmdLoadingSize.medium => 2.5,
        NmdLoadingSize.large => 3,
      };

  double get _dimension => switch (size) {
        NmdLoadingSize.small => 24,
        NmdLoadingSize.medium => 32,
        NmdLoadingSize.large => 44,
      };

  @override
  Widget build(BuildContext context) {
    final indicator = SizedBox(
      width: _dimension,
      height: _dimension,
      child: CircularProgressIndicator(
        strokeWidth: _stroke,
        color: NmdColors.brandPrimary,
      ),
    );

    final content = Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        indicator,
        if (message != null) ...[
          const SizedBox(height: NmdSpacing.sm),
          Text(
            message!,
            textAlign: TextAlign.center,
            style: NmdTypography.bodySmall,
          ),
        ],
      ],
    );

    if (fullscreen) {
      return ColoredBox(
        color: NmdColors.surfaceBase.withValues(alpha: 0.92),
        child: Center(child: content),
      );
    }
    return Center(child: content);
  }
}
