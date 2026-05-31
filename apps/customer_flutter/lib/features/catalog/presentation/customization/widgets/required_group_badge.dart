import 'package:flutter/material.dart';

import '../../../../../design_system/design_system.dart';
import '../modifier_group_presentation.dart';

/// Required / optional indicator for modifier group headers.
class RequiredGroupBadge extends StatelessWidget {
  const RequiredGroupBadge({
    super.key,
    required this.required,
    this.missing = false,
  });

  final bool required;
  final bool missing;

  @override
  Widget build(BuildContext context) {
    if (!required) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(
          color: NmdColors.surfaceMuted.withValues(alpha: 0.85),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Text(
          ModifierGroupPresentationResolver.optionalBadge(),
          style: NmdTypography.micro.copyWith(
            color: NmdColors.textSecondary,
            fontWeight: FontWeight.w700,
          ),
        ),
      );
    }

    final color = missing ? NmdColors.error : NmdColors.success;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        ModifierGroupPresentationResolver.requiredBadge(missing: missing),
        style: NmdTypography.micro.copyWith(
          color: color,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}
