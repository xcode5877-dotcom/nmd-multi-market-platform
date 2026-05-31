import 'package:flutter/material.dart';

import '../../../../../api/models/product.dart';
import '../../../../../design_system/design_system.dart';
import '../customization_selection_summary.dart';
import '../modifier_group_presentation.dart';
import '../customization_tokens.dart';
import '../modifier_food_category.dart';
import '../product_customization_controller.dart';
import 'modifier_chip_grid.dart';
import 'required_group_badge.dart';

/// Collapsible food-category sections — one expanded at a time.
class CategorizedModifierSections extends StatefulWidget {
  const CategorizedModifierSections({
    super.key,
    required this.product,
    required this.controller,
    required this.groups,
    this.inlineHalfPlacement = false,
  });

  final Product product;
  final ProductCustomizationController controller;
  final List<ProductOptionGroup> groups;
  final bool inlineHalfPlacement;

  @override
  State<CategorizedModifierSections> createState() =>
      _CategorizedModifierSectionsState();
}

class _CategorizedModifierSectionsState
    extends State<CategorizedModifierSections> {
  ModifierFoodCategory? _expanded;

  @override
  void initState() {
    super.initState();
    final grouped = groupByFoodCategory(widget.groups);
    final order = orderedFoodCategories(grouped);
    _expanded = order.isNotEmpty ? order.first : null;
  }

  void _toggle(ModifierFoodCategory cat) {
    setState(() {
      _expanded = _expanded == cat ? null : cat;
    });
  }

  bool _categoryComplete(List<ProductOptionGroup> groups) {
    for (final group in groups) {
      final min = group.required
          ? (group.minSelected > 0 ? group.minSelected : 1)
          : group.minSelected;
      if (widget.controller.selectedIdsFor(group.id).length < min) {
        return false;
      }
    }
    return groups.isNotEmpty;
  }

  void _syncExpandedCategory(Map<ModifierFoodCategory, List<ProductOptionGroup>> grouped) {
    final order = orderedFoodCategories(grouped);
    if (_expanded == null) return;
    final currentGroups = grouped[_expanded];
    if (currentGroups == null || !_categoryComplete(currentGroups)) return;

    for (final cat in order) {
      if (!_categoryComplete(grouped[cat]!)) {
        if (_expanded != cat) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted) setState(() => _expanded = cat);
          });
        }
        return;
      }
    }
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) setState(() => _expanded = null);
    });
  }

  String _categorySummary(List<ProductOptionGroup> groups) {
    final parts = <String>[];
    for (final group in groups) {
      final ids = widget.controller.selectedIdsFor(group.id);
      if (ids.isEmpty) continue;
      parts.add(
        groupSelectionPreview(
          group,
          ids,
          widget.controller.placementsFor(group.id),
        ),
      );
    }
    if (parts.isEmpty) return 'لم يُحدد';
    if (parts.length == 1) return parts.first;
    return '${parts.first} +${parts.length - 1}';
  }

  @override
  Widget build(BuildContext context) {
    final grouped = groupByFoodCategory(widget.groups);
    final order = orderedFoodCategories(grouped);

    return ListenableBuilder(
      listenable: widget.controller,
      builder: (context, _) {
        _syncExpandedCategory(grouped);

        return Column(
          children: [
            for (var i = 0; i < order.length; i++) ...[
              _CategorySection(
                meta: metaForCategory(order[i]),
                expanded: _expanded == order[i],
                complete: _categoryComplete(grouped[order[i]]!),
                summary: _categorySummary(grouped[order[i]]!),
                onTap: () => _toggle(order[i]),
                child: Column(
                  children: [
                    for (var gi = 0; gi < grouped[order[i]]!.length; gi++) ...[
                      if (grouped[order[i]]!.length > 1) ...[
                        Row(
                          mainAxisAlignment: MainAxisAlignment.end,
                          children: [
                            RequiredGroupBadge(
                              required: grouped[order[i]]![gi].required,
                              missing: widget.controller.missingRequired.any(
                                (g) => g.id == grouped[order[i]]![gi].id,
                              ),
                            ),
                            const SizedBox(width: CustomizationTokens.xxs),
                            Text(
                              ModifierGroupPresentationResolver.groupTitle(
                                grouped[order[i]]![gi],
                              ),
                              style: NmdTypography.micro.copyWith(
                                color: NmdColors.brandPrimary,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: CustomizationTokens.xxs),
                      ],
                      ModifierChipGrid(
                        group: grouped[order[i]]![gi],
                        selectedItemIds: widget.controller
                            .selectedIdsFor(grouped[order[i]]![gi].id),
                        placements: widget.controller
                            .placementsFor(grouped[order[i]]![gi].id),
                        inlineHalfPlacement: widget.inlineHalfPlacement,
                        onSelectionChanged: (next) {
                          widget.controller.setGroupSelection(
                            grouped[order[i]]![gi].id,
                            next,
                          );
                        },
                        onPlacement: (itemId, p) {
                          widget.controller.setItemPlacement(
                            grouped[order[i]]![gi].id,
                            itemId,
                            p,
                          );
                        },
                        onRemoveHalf: (itemId) {
                          widget.controller.removeHalfItem(
                            grouped[order[i]]![gi].id,
                            itemId,
                          );
                        },
                      ),
                      if (gi < grouped[order[i]]!.length - 1)
                        const SizedBox(height: CustomizationTokens.xs),
                    ],
                  ],
                ),
              ),
              if (i < order.length - 1)
                const SizedBox(height: CustomizationTokens.xxs),
            ],
          ],
        );
      },
    );
  }
}

class _CategorySection extends StatelessWidget {
  const _CategorySection({
    required this.meta,
    required this.expanded,
    required this.complete,
    required this.summary,
    required this.onTap,
    required this.child,
  });

  final ModifierFoodCategoryMeta meta;
  final bool expanded;
  final bool complete;
  final String summary;
  final VoidCallback onTap;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: complete && !expanded
            ? NmdColors.tintAliveSoft.withValues(alpha: 0.35)
            : NmdColors.surfaceBase,
        borderRadius: BorderRadius.circular(CustomizationTokens.cardRadius),
        border: Border.all(
          color: expanded
              ? NmdColors.brandPrimary.withValues(alpha: 0.22)
              : (complete
                  ? NmdColors.brandPrimary.withValues(alpha: 0.14)
                  : NmdColors.borderSubtle.withValues(alpha: 0.55)),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          InkWell(
            onTap: onTap,
            borderRadius:
                BorderRadius.circular(CustomizationTokens.cardRadius),
            child: Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: CustomizationTokens.sm,
                vertical: CustomizationTokens.xs,
              ),
              child: Row(
                textDirection: TextDirection.rtl,
                children: [
                  AnimatedRotation(
                    turns: expanded ? 0.5 : 0,
                    duration: NmdMotion.fast,
                    curve: NmdMotion.standard,
                    child: Icon(
                      Icons.expand_more,
                      size: 18,
                      color: NmdColors.brandPrimary.withValues(alpha: 0.85),
                    ),
                  ),
                  const SizedBox(width: CustomizationTokens.xxs),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.end,
                          children: [
                            if (complete)
                              Icon(
                                Icons.check_circle_rounded,
                                size: 14,
                                color: NmdColors.brandPrimary
                                    .withValues(alpha: 0.85),
                              ),
                            if (complete) const SizedBox(width: 4),
                            Text(
                              '${meta.emoji} ${meta.labelAr}',
                              style: NmdTypography.label.copyWith(
                                fontWeight: FontWeight.w700,
                                fontSize: 13,
                              ),
                            ),
                          ],
                        ),
                        Text(
                          summary,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: NmdTypography.micro.copyWith(
                            color: NmdColors.textSecondary
                                .withValues(alpha: 0.95),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          AnimatedSize(
            duration: NmdMotion.fast,
            curve: NmdMotion.standard,
            alignment: Alignment.topCenter,
            child: expanded
                ? Padding(
                    padding: const EdgeInsets.fromLTRB(
                      CustomizationTokens.sm,
                      0,
                      CustomizationTokens.sm,
                      CustomizationTokens.sm,
                    ),
                    child: child,
                  )
                : const SizedBox.shrink(),
          ),
        ],
      ),
    );
  }
}
