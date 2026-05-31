import 'package:flutter/material.dart';

import '../../../../../api/models/product.dart';
import '../../../../../design_system/design_system.dart';
import '../customization_tokens.dart';
import '../modifier_group_presentation.dart';
import '../product_customization_controller.dart';

/// Compact group pills + jump to next incomplete required group.
class ModifierGroupNavigator extends StatelessWidget {
  const ModifierGroupNavigator({
    super.key,
    required this.controller,
    required this.groups,
    required this.selectedGroupId,
    required this.onSelectGroup,
    required this.onNextIncomplete,
  });

  final ProductCustomizationController controller;
  final List<ProductOptionGroup> groups;
  final String? selectedGroupId;
  final ValueChanged<String> onSelectGroup;
  final VoidCallback onNextIncomplete;

  bool _isComplete(ProductOptionGroup group) {
    final min = group.required
        ? (group.minSelected > 0 ? group.minSelected : 1)
        : group.minSelected;
    return controller.selectedIdsFor(group.id).length >= min;
  }

  String? _nextIncompleteId() {
    for (final group in groups) {
      if (!_isComplete(group) && group.required) return group.id;
    }
    for (final group in groups) {
      if (!_isComplete(group)) return group.id;
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: controller,
      builder: (context, _) {
        final nextId = _nextIncompleteId();
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SizedBox(
              height: 36,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                reverse: true,
                itemCount: groups.length,
                separatorBuilder: (_, __) =>
                    const SizedBox(width: CustomizationTokens.xxs),
                itemBuilder: (context, index) {
                  final group = groups[index];
                  final selected = selectedGroupId == group.id;
                  final complete = _isComplete(group);
                  return _GroupPill(
                    label: group.name,
                    selected: selected,
                    complete: complete,
                    required: group.required,
                    onTap: () => onSelectGroup(group.id),
                  );
                },
              ),
            ),
            if (nextId != null) ...[
              const SizedBox(height: CustomizationTokens.xs),
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton.icon(
                  onPressed: onNextIncomplete,
                  icon: const Icon(Icons.arrow_back_ios_new, size: 14),
                  label: const Text('المجموعة التالية'),
                  style: TextButton.styleFrom(
                    padding: const EdgeInsets.symmetric(horizontal: 8),
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    foregroundColor: NmdColors.brandPrimary,
                    textStyle: NmdTypography.micro.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
            ],
          ],
        );
      },
    );
  }
}

class _GroupPill extends StatelessWidget {
  const _GroupPill({
    required this.label,
    required this.selected,
    required this.complete,
    required this.required,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final bool complete;
  final bool required;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final bg = selected
        ? NmdColors.brandPrimary
        : (complete ? NmdColors.tintAliveSoft : NmdColors.surfaceMuted);
    final fg = selected
        ? NmdColors.textOnBrand
        : (complete ? NmdColors.brandPrimary : NmdColors.textPrimary);

    String status;
    if (complete) {
      status = '✓ تم';
    } else if (required) {
      status = 'مطلوب';
    } else {
      status = ModifierGroupPresentationResolver.optionalBadge();
    }

    return Material(
      color: bg,
      borderRadius: BorderRadius.circular(CustomizationTokens.chipRadius),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(CustomizationTokens.chipRadius),
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: CustomizationTokens.sm,
            vertical: CustomizationTokens.xxs + 2,
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                label,
                style: NmdTypography.micro.copyWith(
                  color: fg,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(width: 6),
              Text(
                status,
                style: NmdTypography.micro.copyWith(
                  color: fg.withValues(alpha: 0.85),
                  fontSize: 10,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

String? nextIncompleteGroupId(
  List<ProductOptionGroup> groups,
  ProductCustomizationController controller,
) {
  for (final group in groups) {
    final min = group.required
        ? (group.minSelected > 0 ? group.minSelected : 1)
        : group.minSelected;
    if (controller.selectedIdsFor(group.id).length < min) {
      return group.id;
    }
  }
  return null;
}
