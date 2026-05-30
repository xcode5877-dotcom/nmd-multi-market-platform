import 'package:flutter/material.dart';

import '../tokens/nmd_colors.dart';
import '../tokens/nmd_spacing.dart';
import '../tokens/nmd_typography.dart';

/// Section title row with optional trailing action (RTL-aware).
class NmdSectionHeader extends StatelessWidget {
  const NmdSectionHeader({
    super.key,
    required this.title,
    this.subtitle,
    this.actionLabel,
    this.onAction,
    this.padding,
  });

  final String title;
  final String? subtitle;
  final String? actionLabel;
  final VoidCallback? onAction;
  final EdgeInsetsGeometry? padding;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: padding ??
          const EdgeInsetsDirectional.only(
            start: NmdSpacing.screenHorizontal,
            end: NmdSpacing.screenHorizontal,
            bottom: NmdSpacing.sm,
            top: NmdSpacing.xs,
          ),
      child: Directionality(
        textDirection: TextDirection.rtl,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                textDirection: TextDirection.rtl,
                children: [
                  Text(
                    title,
                    textAlign: TextAlign.right,
                    style: NmdTypography.sectionTitle,
                  ),
                  if (subtitle != null) ...[
                    const SizedBox(height: NmdSpacing.xxs),
                    Text(
                      subtitle!,
                      textAlign: TextAlign.right,
                      style: NmdTypography.bodySmall,
                    ),
                  ],
                ],
              ),
            ),
            if (actionLabel != null && onAction != null)
              TextButton(
                onPressed: onAction,
                child: Text(
                  actionLabel!,
                  style: NmdTypography.label.copyWith(color: NmdColors.brandPrimary),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
