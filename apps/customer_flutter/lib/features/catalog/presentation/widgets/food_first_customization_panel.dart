import 'package:flutter/material.dart';

import '../../../../api/models/product.dart';
import '../../../../design_system/design_system.dart';
import '../customization/customization_selection_summary.dart';
import '../customization/customization_step_plan.dart';
import '../customization/modifier_group_presentation.dart';
import '../customization/customization_tokens.dart';
import '../customization/product_complexity_classifier.dart';
import '../customization/product_customization_controller.dart';
import '../customization/product_customization_tier.dart';
import '../customization/widgets/categorized_modifier_sections.dart';
import '../customization/widgets/customization_summary_bar.dart';
import '../customization/widgets/half_placement_sheet.dart';
import '../customization/widgets/modifier_chip_grid.dart';
import '../customization/widgets/required_group_badge.dart';

/// Food-first customization: quick path + optional advanced controls.
class FoodFirstCustomizationPanel extends StatelessWidget {
  const FoodFirstCustomizationPanel({
    super.key,
    required this.product,
    required this.controller,
    required this.tier,
    required this.onOpenAdvancedBuilder,
  });

  final Product product;
  final ProductCustomizationController controller;
  final ProductCustomizationTier tier;
  final VoidCallback onOpenAdvancedBuilder;

  List<ProductOptionGroup> get _groups => activeOptionGroups(product);

  List<ProductOptionGroup> get _quickGroups {
    final essentials = _groups.where((g) => g.required || g.isSingle).toList();
    if (essentials.isNotEmpty) return essentials;
    if (_groups.length <= 2) return _groups;
    return _groups.take(2).toList();
  }

  List<ProductOptionGroup> get _categoryGroups {
    final quickIds = _quickGroups.map((g) => g.id).toSet();
    return _groups.where((g) => !quickIds.contains(g.id)).toList();
  }

  bool get _showAdvanced =>
      tier == ProductCustomizationTier.advanced ||
      shouldUseAdvancedStepper(product);

  @override
  Widget build(BuildContext context) {
    if (_groups.isEmpty) return const SizedBox.shrink();

    return ListenableBuilder(
      listenable: controller,
      builder: (context, _) {
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            CustomizationSummaryBar(controller: controller, compact: true),
            const SizedBox(height: CustomizationTokens.xs),
            _QuickSectionHeader(title: 'إضافات سريعة'),
            const SizedBox(height: CustomizationTokens.xxs),
            for (var i = 0; i < _quickGroups.length; i++) ...[
              _QuickGroupRow(
                group: _quickGroups[i],
                controller: controller,
              ),
              if (i < _quickGroups.length - 1)
                const SizedBox(height: CustomizationTokens.xxs),
            ],
            if (_categoryGroups.isNotEmpty) ...[
              const SizedBox(height: CustomizationTokens.xs),
              _QuickSectionHeader(title: 'خصّص حسب الفئة'),
              const SizedBox(height: CustomizationTokens.xxs),
              CategorizedModifierSections(
                product: product,
                controller: controller,
                groups: _categoryGroups,
              ),
            ],
            if (hasSelectedHalfCapableToppings(product, controller)) ...[
              const SizedBox(height: CustomizationTokens.xs),
              OutlinedButton.icon(
                onPressed: () => HalfPlacementSheet.show(
                  context,
                  product: product,
                  controller: controller,
                ),
                icon: const Icon(Icons.pie_chart_outline, size: 17),
                label: Text(
                  ModifierGroupPresentationResolver.pizzaSplitAction(),
                ),
                style: OutlinedButton.styleFrom(
                  foregroundColor: NmdColors.brandPrimary,
                  side: BorderSide(
                    color: NmdColors.brandPrimary.withValues(alpha: 0.3),
                  ),
                  padding: const EdgeInsets.symmetric(
                    horizontal: CustomizationTokens.sm,
                    vertical: CustomizationTokens.xxs + 2,
                  ),
                  visualDensity: VisualDensity.compact,
                ),
              ),
            ],
            if (_showAdvanced) ...[
              const SizedBox(height: CustomizationTokens.xs),
              TextButton.icon(
                onPressed: onOpenAdvancedBuilder,
                icon: const Icon(Icons.tune_rounded, size: 17),
                label: Text(
                  ModifierGroupPresentationResolver.advancedCustomization(),
                ),
                style: TextButton.styleFrom(
                  foregroundColor: NmdColors.textSecondary,
                  alignment: Alignment.centerRight,
                  visualDensity: VisualDensity.compact,
                ),
              ),
            ],
          ],
        );
      },
    );
  }
}

class _QuickSectionHeader extends StatelessWidget {
  const _QuickSectionHeader({required this.title});

  final String title;

  @override
  Widget build(BuildContext context) {
    return Text(
      title,
      textAlign: TextAlign.right,
      style: NmdTypography.label.copyWith(
        fontSize: 13,
        fontWeight: FontWeight.w700,
        color: NmdColors.textPrimary,
      ),
    );
  }
}

class _QuickGroupRow extends StatefulWidget {
  const _QuickGroupRow({
    required this.group,
    required this.controller,
  });

  final ProductOptionGroup group;
  final ProductCustomizationController controller;

  @override
  State<_QuickGroupRow> createState() => _QuickGroupRowState();
}

class _QuickGroupRowState extends State<_QuickGroupRow> {
  bool _manuallyExpanded = false;

  Set<String> get _selected =>
      widget.controller.selectedIdsFor(widget.group.id);

  bool get _hasSelection => _selected.isNotEmpty;

  bool get _autoCollapsed =>
      _hasSelection && widget.group.isSingle && !_manuallyExpanded;

  String get _preview => groupSelectionPreview(
        widget.group,
        _selected,
        widget.controller.placementsFor(widget.group.id),
      );

  @override
  Widget build(BuildContext context) {
    if (_autoCollapsed) {
      return _CollapsedQuickRow(
                      groupName: ModifierGroupPresentationResolver.groupTitle(
                        widget.group,
                      ),
        preview: _preview,
        required: widget.group.required,
        onTap: () => setState(() => _manuallyExpanded = true),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.end,
          children: [
            RequiredGroupBadge(
              required: widget.group.required,
              missing: widget.controller.missingRequired
                  .any((g) => g.id == widget.group.id),
            ),
            const SizedBox(width: CustomizationTokens.xxs),
            Text(
              ModifierGroupPresentationResolver.groupTitle(widget.group),
              style: NmdTypography.micro.copyWith(
                color: NmdColors.brandPrimary,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ),
        const SizedBox(height: CustomizationTokens.xxs),
        ModifierChipGrid(
          group: widget.group,
          selectedItemIds: _selected,
          placements: widget.controller.placementsFor(widget.group.id),
          inlineHalfPlacement: false,
          onSelectionChanged: (next) {
            widget.controller.setGroupSelection(widget.group.id, next);
            if (widget.group.isSingle && next.isNotEmpty) {
              setState(() => _manuallyExpanded = false);
            } else if (next.isEmpty) {
              setState(() => _manuallyExpanded = false);
            }
          },
          onPlacement: (itemId, p) {
            widget.controller.setItemPlacement(widget.group.id, itemId, p);
            if (widget.group.isSingle) {
              setState(() => _manuallyExpanded = false);
            }
          },
          onRemoveHalf: (itemId) {
            widget.controller.removeHalfItem(widget.group.id, itemId);
            setState(() => _manuallyExpanded = true);
          },
        ),
      ],
    );
  }
}

class _CollapsedQuickRow extends StatelessWidget {
  const _CollapsedQuickRow({
    required this.groupName,
    required this.preview,
    required this.required,
    required this.onTap,
  });

  final String groupName;
  final String preview;
  final bool required;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(CustomizationTokens.cardRadius),
        child: AnimatedContainer(
          duration: NmdMotion.fast,
          curve: NmdMotion.standard,
          padding: const EdgeInsets.symmetric(
            horizontal: CustomizationTokens.sm,
            vertical: CustomizationTokens.xxs + 2,
          ),
          decoration: BoxDecoration(
            color: NmdColors.tintAliveSoft.withValues(alpha: 0.55),
            borderRadius: BorderRadius.circular(CustomizationTokens.cardRadius),
            border: Border.all(
              color: NmdColors.brandPrimary.withValues(alpha: 0.18),
            ),
          ),
          child: Row(
            textDirection: TextDirection.rtl,
            children: [
              Icon(
                Icons.check_circle_rounded,
                size: 16,
                color: NmdColors.brandPrimary.withValues(alpha: 0.85),
              ),
              const SizedBox(width: CustomizationTokens.xxs),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      groupName,
                      style: NmdTypography.micro.copyWith(
                        color: NmdColors.brandPrimary,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    Text(
                      preview,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: NmdTypography.label.copyWith(fontSize: 12),
                    ),
                  ],
                ),
              ),
              Icon(
                Icons.edit_outlined,
                size: 15,
                color: NmdColors.textTertiary,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
