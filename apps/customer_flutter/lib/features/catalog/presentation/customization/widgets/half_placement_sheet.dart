import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../../api/models/pizza_placement.dart';
import '../../../../../api/models/product.dart';
import '../../../../../design_system/design_system.dart';
import '../customization_tokens.dart';
import '../modifier_group_presentation.dart';
import '../product_complexity_classifier.dart';
import '../product_customization_controller.dart';
import '../pizza_topping_visual_resolver.dart';
import 'pizza_split_visual.dart';
import 'pizza_topping_glyph.dart';

/// Premium pizza half/half builder sheet.
class HalfPlacementSheet {
  static Future<void> show(
    BuildContext context, {
    required Product product,
    required ProductCustomizationController controller,
  }) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (context) => _HalfPlacementSheetBody(
        product: product,
        controller: controller,
      ),
    );
  }
}

class _HalfPlacementSheetBody extends StatelessWidget {
  const _HalfPlacementSheetBody({
    required this.product,
    required this.controller,
  });

  final Product product;
  final ProductCustomizationController controller;

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).padding.bottom;
    final halfGroups =
        activeOptionGroups(product).where(productGroupHasHalfOptions).toList();

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Container(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.of(context).size.height * 0.82,
        ),
        decoration: const BoxDecoration(
          color: NmdColors.surfaceBase,
          borderRadius: BorderRadius.vertical(
            top: Radius.circular(CustomizationTokens.sheetRadius),
          ),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: CustomizationTokens.sm),
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: NmdColors.borderSubtle.withValues(alpha: 0.8),
                borderRadius: BorderRadius.circular(99),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(
                CustomizationTokens.md,
                CustomizationTokens.sm,
                CustomizationTokens.md,
                CustomizationTokens.xs,
              ),
              child: Row(
                children: [
                  IconButton(
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(Icons.close, size: 20),
                  ),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(
                          ModifierGroupPresentationResolver.pizzaSplitTitle(),
                          textAlign: TextAlign.right,
                          style: NmdTypography.h3.copyWith(fontSize: 15),
                        ),
                        Text(
                          ModifierGroupPresentationResolver.pizzaSplitSubtitle(),
                          textAlign: TextAlign.right,
                          style: NmdTypography.micro.copyWith(
                            color: NmdColors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            Flexible(
              child: ListenableBuilder(
                listenable: controller,
                builder: (context, _) {
                  final left = <String>[];
                  final right = <String>[];
                  final whole = <String>[];
                  final tiles = <Widget>[];

                  for (final group in halfGroups) {
                    for (final item in group.items) {
                      if (!productOptionSupportsHalf(item, group)) continue;
                      if (!controller.selectedIdsFor(group.id).contains(item.id)) {
                        continue;
                      }
                      final side =
                          (controller.placementsFor(group.id)[item.id] ??
                                  PizzaPlacement.defaultPlacement)
                              .toUpperCase();
                      switch (side) {
                        case PizzaPlacement.left:
                          left.add(item.name);
                        case PizzaPlacement.right:
                          right.add(item.name);
                        default:
                          whole.add(item.name);
                      }

                      tiles.add(
                        _ToppingPlacementRow(
                          name: item.name,
                          side: side,
                          onSideChanged: (p) {
                            HapticFeedback.selectionClick();
                            controller.setItemPlacement(group.id, item.id, p);
                          },
                        ),
                      );
                    }
                  }

                  if (tiles.isEmpty) {
                    return Center(
                      child: Padding(
                        padding: const EdgeInsets.all(CustomizationTokens.lg),
                        child: Text(
                          ModifierGroupPresentationResolver.pizzaSplitEmptyHint(),
                          textAlign: TextAlign.center,
                          style: NmdTypography.bodySmall,
                        ),
                      ),
                    );
                  }

                  final onlyWhole = left.isEmpty &&
                      right.isEmpty &&
                      whole.isNotEmpty;

                  return ListView(
                    padding: const EdgeInsets.symmetric(
                      horizontal: CustomizationTokens.md,
                    ),
                    children: [
                      if (onlyWhole)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 6),
                          child: Text(
                            ModifierGroupPresentationResolver.pizzaFullModeTitle(),
                            textAlign: TextAlign.right,
                            style: NmdTypography.label.copyWith(
                              color: NmdColors.textSecondary,
                            ),
                          ),
                        ),
                      PizzaSplitVisual(
                        leftLabels: left,
                        rightLabels: right,
                        wholeLabels: whole,
                      ),
                      const SizedBox(height: CustomizationTokens.sm),
                      Text(
                        onlyWhole
                            ? 'تظهر الإضافات موزعة على كامل البيتزا'
                            : 'اختر لكل نصف',
                        textAlign: TextAlign.right,
                        style: NmdTypography.micro.copyWith(
                          color: NmdColors.textSecondary.withValues(alpha: 0.92),
                          fontSize: 10,
                        ),
                      ),
                      const SizedBox(height: CustomizationTokens.xs),
                      ...tiles,
                    ],
                  );
                },
              ),
            ),
            Padding(
              padding: EdgeInsets.fromLTRB(
                CustomizationTokens.md,
                CustomizationTokens.xs,
                CustomizationTokens.md,
                bottom + CustomizationTokens.sm,
              ),
              child: SizedBox(
                width: double.infinity,
                height: PremiumDockLayout.ctaHeight + 8,
                child: FilledButton(
                  onPressed: () => Navigator.pop(context),
                  style: FilledButton.styleFrom(
                    backgroundColor: NmdColors.brandPrimary,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: Text(
                    'تم — شكّل بيتزا نصفين',
                    style: NmdTypography.button.copyWith(fontSize: 13),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ToppingPlacementRow extends StatelessWidget {
  const _ToppingPlacementRow({
    required this.name,
    required this.side,
    required this.onSideChanged,
  });

  final String name;
  final String side;
  final ValueChanged<String> onSideChanged;

  static const _sides = [
    (PizzaPlacement.right, 'يمين'),
    (PizzaPlacement.whole, 'كامل'),
    (PizzaPlacement.left, 'يسار'),
  ];

  @override
  Widget build(BuildContext context) {
    final selected = side.toUpperCase();
    final visual = PizzaToppingVisualResolver.resolve(modifierName: name);
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Container(
        padding: const EdgeInsets.fromLTRB(10, 8, 10, 8),
        decoration: BoxDecoration(
          color: NmdColors.surfaceMuted.withValues(alpha: 0.55),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: NmdColors.borderSubtle.withValues(alpha: 0.35),
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              textDirection: TextDirection.rtl,
              children: [
                PizzaToppingGlyph(visual: visual, size: 16, dropShadow: false),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    name,
                    textAlign: TextAlign.right,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: NmdTypography.label.copyWith(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Row(
              children: [
                for (var i = 0; i < _sides.length; i++) ...[
                  if (i > 0) const SizedBox(width: 5),
                  Expanded(
                    child: _SideChip(
                      label: _sides[i].$2,
                      selected: selected == _sides[i].$1,
                      onTap: () => onSideChanged(_sides[i].$1),
                    ),
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _SideChip extends StatelessWidget {
  const _SideChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected
          ? NmdColors.success.withValues(alpha: 0.95)
          : NmdColors.surfaceBase.withValues(alpha: 0.9),
      borderRadius: BorderRadius.circular(8),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 7),
          child: Center(
            child: Text(
              label,
              style: NmdTypography.micro.copyWith(
                fontSize: 10,
                fontWeight: FontWeight.w700,
                color: selected ? NmdColors.textOnBrand : NmdColors.textPrimary,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

bool hasSelectedHalfCapableToppings(
  Product product,
  ProductCustomizationController controller,
) {
  for (final group in activeOptionGroups(product)) {
    if (!productGroupHasHalfOptions(group)) continue;
    for (final item in group.items) {
      if (!productOptionSupportsHalf(item, group)) continue;
      if (controller.selectedIdsFor(group.id).contains(item.id)) {
        return true;
      }
    }
  }
  return false;
}
