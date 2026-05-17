import 'package:flutter/material.dart';

import '../tokens/nmd_colors.dart';
import '../tokens/nmd_spacing.dart';
import '../tokens/nmd_typography.dart';
import 'nmd_button.dart';

/// Empty list / no-results presentation.
class NmdEmptyState extends StatelessWidget {
  const NmdEmptyState({
    super.key,
    required this.title,
    this.message,
    this.icon,
    this.actionLabel,
    this.onAction,
  });

  final String title;
  final String? message;
  final IconData? icon;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(NmdSpacing.xl),
      child: Directionality(
        textDirection: TextDirection.rtl,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (icon != null)
              Icon(icon, size: 56, color: NmdColors.textTertiary),
            if (icon != null) const SizedBox(height: NmdSpacing.md),
            Text(
              title,
              textAlign: TextAlign.center,
              style: NmdTypography.h2.copyWith(color: NmdColors.textPrimary),
            ),
            if (message != null) ...[
              const SizedBox(height: NmdSpacing.xs),
              Text(
                message!,
                textAlign: TextAlign.center,
                style: NmdTypography.bodySmall,
              ),
            ],
            if (actionLabel != null && onAction != null) ...[
              const SizedBox(height: NmdSpacing.lg),
              NmdButton(
                label: actionLabel!,
                onPressed: onAction,
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
