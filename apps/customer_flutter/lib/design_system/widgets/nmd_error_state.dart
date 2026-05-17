import 'package:flutter/material.dart';

import '../tokens/nmd_colors.dart';
import '../tokens/nmd_spacing.dart';
import '../tokens/nmd_typography.dart';
import 'nmd_button.dart';

/// Recoverable error presentation with retry.
class NmdErrorState extends StatelessWidget {
  const NmdErrorState({
    super.key,
    required this.title,
    this.message,
    this.onRetry,
    this.retryLabel = 'إعادة المحاولة',
  });

  final String title;
  final String? message;
  final VoidCallback? onRetry;
  final String retryLabel;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(NmdSpacing.xl),
      child: Directionality(
        textDirection: TextDirection.rtl,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline_rounded, size: 56, color: NmdColors.error),
            const SizedBox(height: NmdSpacing.md),
            Text(
              title,
              textAlign: TextAlign.center,
              style: NmdTypography.h2,
            ),
            if (message != null) ...[
              const SizedBox(height: NmdSpacing.xs),
              Text(
                message!,
                textAlign: TextAlign.center,
                style: NmdTypography.bodySmall,
              ),
            ],
            if (onRetry != null) ...[
              const SizedBox(height: NmdSpacing.lg),
              NmdButton(
                label: retryLabel,
                onPressed: onRetry,
                variant: NmdButtonVariant.secondary,
                expand: false,
                size: NmdButtonSize.medium,
              ),
            ],
          ],
        ),
      ),
    );
  }
}
