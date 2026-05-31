import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../../api/models/pizza_placement.dart';
import '../../../../../api/models/product.dart';
import '../../../../../design_system/design_system.dart';
import '../../widgets/pizza_side_toggle.dart';
import '../customization_format.dart';
import '../customization_tokens.dart';

typedef ModifierSelectionChanged = void Function(Set<String> next);
typedef ModifierPlacementChanged = void Function(String itemId, String placement);
typedef ModifierHalfRemoved = void Function(String itemId);

/// Compact pill chips for food-first modifier selection.
class ModifierChipGrid extends StatelessWidget {
  const ModifierChipGrid({
    super.key,
    required this.group,
    required this.selectedItemIds,
    required this.placements,
    required this.onSelectionChanged,
    required this.onPlacement,
    required this.onRemoveHalf,
    this.inlineHalfPlacement = false,
    @Deprecated('Use inlineHalfPlacement') this.showPlacementOnlyWhenSelected = true,
  });

  final ProductOptionGroup group;
  final Set<String> selectedItemIds;
  final Map<String, String> placements;
  final ModifierSelectionChanged onSelectionChanged;
  final ModifierPlacementChanged onPlacement;
  final ModifierHalfRemoved onRemoveHalf;
  final bool inlineHalfPlacement;
  final bool showPlacementOnlyWhenSelected;

  bool get _useInlineHalf => inlineHalfPlacement;

  @override
  Widget build(BuildContext context) {
    final hasHalf = productGroupHasHalfOptions(group);

    if (hasHalf && _useInlineHalf) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (final item in group.items) ...[
            if (productOptionSupportsHalf(item, group))
              _HalfModifierTile(
                item: item,
                selected: selectedItemIds.contains(item.id),
                side: (placements[item.id] ?? PizzaPlacement.defaultPlacement)
                    .toUpperCase(),
                showToggle: !showPlacementOnlyWhenSelected ||
                    selectedItemIds.contains(item.id),
                onSelect: () {
                  if (selectedItemIds.contains(item.id)) {
                    onRemoveHalf(item.id);
                  } else if (selectedItemIds.length < group.maxSelected) {
                    onPlacement(item.id, PizzaPlacement.defaultPlacement);
                  }
                },
                onPlacement: (p) => onPlacement(item.id, p),
              )
            else
              _ModifierChip(
                label: item.name,
                deltaLabel: formatCustomizationDelta(item.priceDelta),
                selected: selectedItemIds.contains(item.id),
                enabled: selectedItemIds.contains(item.id) ||
                    selectedItemIds.length < group.maxSelected,
                onTap: () {
                  final selected = selectedItemIds.contains(item.id);
                  final next = {...selectedItemIds};
                  if (selected) {
                    next.remove(item.id);
                  } else {
                    next.add(item.id);
                  }
                  onSelectionChanged(next);
                },
              ),
            const SizedBox(height: CustomizationTokens.xxs),
          ],
        ],
      );
    }

    if (hasHalf && !_useInlineHalf) {
      return Wrap(
        spacing: CustomizationTokens.xxs,
        runSpacing: CustomizationTokens.xxs,
        children: group.items.map((item) {
          final selected = selectedItemIds.contains(item.id);
          final disabled =
              !selected && selectedItemIds.length >= group.maxSelected;
          return _ModifierChip(
            label: item.name,
            deltaLabel: formatCustomizationDelta(item.priceDelta),
            selected: selected,
            enabled: !disabled,
            onTap: () {
              if (disabled) return;
              if (selected) {
                onRemoveHalf(item.id);
              } else {
                onPlacement(item.id, PizzaPlacement.defaultPlacement);
              }
            },
          );
        }).toList(),
      );
    }

    if (group.isSingle) {
      return SizedBox(
        height: CustomizationTokens.chipMinHeight + 2,
        child: ListView.separated(
          reverse: true,
          scrollDirection: Axis.horizontal,
          primary: false,
          shrinkWrap: true,
          itemCount: group.items.length,
          separatorBuilder: (_, __) =>
              const SizedBox(width: CustomizationTokens.xxs),
          itemBuilder: (context, index) {
            final item = group.items[index];
            return _ModifierChip(
              label: item.name,
              deltaLabel: formatCustomizationDelta(item.priceDelta),
              selected: selectedItemIds.contains(item.id),
              enabled: true,
              onTap: () => onSelectionChanged({item.id}),
            );
          },
        ),
      );
    }

    return Wrap(
      spacing: CustomizationTokens.xs,
      runSpacing: CustomizationTokens.xs,
      children: group.items.map((item) {
        final selected = selectedItemIds.contains(item.id);
        final disabled =
            !selected && selectedItemIds.length >= group.maxSelected;
        return _ModifierChip(
          label: item.name,
          deltaLabel: formatCustomizationDelta(item.priceDelta),
          selected: selected,
          enabled: !disabled,
          onTap: () {
            if (disabled) return;
            final next = {...selectedItemIds};
            if (selected) {
              next.remove(item.id);
            } else {
              next.add(item.id);
            }
            onSelectionChanged(next);
          },
        );
      }).toList(),
    );
  }
}

class _HalfModifierTile extends StatelessWidget {
  const _HalfModifierTile({
    required this.item,
    required this.selected,
    required this.side,
    required this.showToggle,
    required this.onSelect,
    required this.onPlacement,
  });

  final ProductOptionItem item;
  final bool selected;
  final String side;
  final bool showToggle;
  final VoidCallback onSelect;
  final ValueChanged<String> onPlacement;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _ModifierChip(
          label: item.name,
          deltaLabel: formatCustomizationDelta(item.priceDelta),
          selected: selected,
          enabled: true,
          onTap: onSelect,
        ),
        if (selected && showToggle) ...[
          const SizedBox(height: CustomizationTokens.xxs),
          PizzaSideToggle(value: side, onChanged: onPlacement),
        ],
      ],
    );
  }
}

class _ModifierChip extends StatefulWidget {
  const _ModifierChip({
    required this.label,
    required this.deltaLabel,
    required this.selected,
    required this.enabled,
    required this.onTap,
  });

  final String label;
  final String deltaLabel;
  final bool selected;
  final bool enabled;
  final VoidCallback onTap;

  @override
  State<_ModifierChip> createState() => _ModifierChipState();
}

class _ModifierChipState extends State<_ModifierChip> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final showDelta =
        widget.deltaLabel != '+0.00₪' && widget.deltaLabel != '-0.00₪';

    return Opacity(
      opacity: widget.enabled ? 1 : 0.42,
      child: Listener(
        onPointerDown: widget.enabled
            ? (_) => setState(() => _pressed = true)
            : null,
        onPointerUp: widget.enabled
            ? (_) => setState(() => _pressed = false)
            : null,
        onPointerCancel: widget.enabled
            ? (_) => setState(() => _pressed = false)
            : null,
        child: AnimatedScale(
          scale: _pressed ? 0.96 : 1,
          duration: NmdMotion.instant,
          curve: NmdMotion.standard,
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: widget.enabled
                  ? () {
                      HapticFeedback.selectionClick();
                      widget.onTap();
                    }
                  : null,
              borderRadius:
                  BorderRadius.circular(CustomizationTokens.chipRadius),
              child: AnimatedContainer(
                duration: NmdMotion.fast,
                curve: NmdMotion.standard,
                constraints: const BoxConstraints(
                  minHeight: CustomizationTokens.chipMinHeight,
                ),
                padding: const EdgeInsets.symmetric(
                  horizontal: CustomizationTokens.sm,
                  vertical: CustomizationTokens.xxs + 1,
                ),
                decoration: BoxDecoration(
                  color: widget.selected
                      ? NmdColors.success
                      : NmdColors.surfaceMuted.withValues(alpha: 0.88),
                  borderRadius:
                      BorderRadius.circular(CustomizationTokens.chipRadius),
                  border: widget.selected
                      ? null
                      : Border.all(
                          color: Colors.transparent,
                        ),
                  boxShadow: widget.selected
                      ? [
                          BoxShadow(
                            color: NmdColors.success.withValues(alpha: 0.28),
                            blurRadius: 10,
                            offset: const Offset(0, 2),
                          ),
                        ]
                      : null,
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (widget.selected) ...[
                      Icon(
                        Icons.check_rounded,
                        size: 14,
                        color: NmdColors.textOnBrand.withValues(alpha: 0.92),
                      ),
                      const SizedBox(width: 4),
                    ],
                    Text(
                      widget.label,
                      style: NmdTypography.label.copyWith(
                        fontSize: 12,
                        fontWeight:
                            widget.selected ? FontWeight.w700 : FontWeight.w600,
                        color: widget.selected
                            ? NmdColors.textOnBrand
                            : NmdColors.textPrimary,
                      ),
                    ),
                    if (showDelta) ...[
                      const SizedBox(width: 4),
                      Text(
                        widget.deltaLabel,
                        style: NmdTypography.micro.copyWith(
                          fontSize: 10,
                          color: widget.selected
                              ? NmdColors.textOnBrand.withValues(alpha: 0.82)
                              : NmdColors.textSecondary,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
