import 'package:flutter/material.dart';

import '../../../../../api/models/product.dart';
import '../../../../../design_system/design_system.dart';
import '../customization_selection_summary.dart';
import '../customization_tokens.dart';
import '../product_customization_controller.dart';
import 'modifier_chip_grid.dart';
import 'modifier_group_navigator.dart';
import 'required_group_badge.dart';

/// Single-expand accordion list for standard-tier customization.
class ModifierGroupAccordionList extends StatefulWidget {
  const ModifierGroupAccordionList({
    super.key,
    required this.controller,
    required this.groups,
  });

  final ProductCustomizationController controller;
  final List<ProductOptionGroup> groups;

  @override
  State<ModifierGroupAccordionList> createState() =>
      _ModifierGroupAccordionListState();
}

class _ModifierGroupAccordionListState
    extends State<ModifierGroupAccordionList> {
  String? _expandedGroupId;

  @override
  void initState() {
    super.initState();
    _expandedGroupId = _initialExpandedId();
  }

  String? _initialExpandedId() {
    for (final group in widget.groups) {
      final min = group.required
          ? (group.minSelected > 0 ? group.minSelected : 1)
          : group.minSelected;
      final selected = widget.controller.selectedIdsFor(group.id).length;
      if (group.required && selected < min) return group.id;
    }
    return widget.groups.isNotEmpty ? widget.groups.first.id : null;
  }

  void _onHeaderTap(String groupId) {
    setState(() {
      _expandedGroupId = _expandedGroupId == groupId ? null : groupId;
    });
  }

  void _selectGroup(String groupId) {
    setState(() => _expandedGroupId = groupId);
  }

  void _jumpNextIncomplete() {
    final next = nextIncompleteGroupId(widget.groups, widget.controller);
    if (next != null) {
      setState(() => _expandedGroupId = next);
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: widget.controller,
      builder: (context, _) {
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (widget.groups.length > 2) ...[
              ModifierGroupNavigator(
                controller: widget.controller,
                groups: widget.groups,
                selectedGroupId: _expandedGroupId,
                onSelectGroup: _selectGroup,
                onNextIncomplete: _jumpNextIncomplete,
              ),
              const SizedBox(height: CustomizationTokens.sm),
            ],
            for (final group in widget.groups)
              ModifierGroupAccordion(
                group: group,
                expanded: _expandedGroupId == group.id,
                preview: groupSelectionPreview(
                  group,
                  widget.controller.selectedIdsFor(group.id),
                  widget.controller.placementsFor(group.id),
                ),
                missing: widget.controller.missingRequired
                    .any((g) => g.id == group.id),
                onHeaderTap: () => _onHeaderTap(group.id),
                child: ModifierChipGrid(
                  group: group,
                  selectedItemIds: widget.controller.selectedIdsFor(group.id),
                  placements: widget.controller.placementsFor(group.id),
                  onSelectionChanged: (next) {
                    widget.controller.setGroupSelection(group.id, next);
                  },
                  onPlacement: (itemId, p) {
                    widget.controller.setItemPlacement(group.id, itemId, p);
                  },
                  onRemoveHalf: (itemId) {
                    widget.controller.removeHalfItem(group.id, itemId);
                  },
                ),
              ),
          ],
        );
      },
    );
  }
}

class ModifierGroupAccordion extends StatelessWidget {
  const ModifierGroupAccordion({
    super.key,
    required this.group,
    required this.expanded,
    required this.preview,
    required this.missing,
    required this.onHeaderTap,
    required this.child,
  });

  final ProductOptionGroup group;
  final bool expanded;
  final String preview;
  final bool missing;
  final VoidCallback onHeaderTap;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final complete = !missing &&
        preview != 'لم يُحدد بعد' &&
        preview.isNotEmpty;

    return Padding(
      padding: const EdgeInsets.only(bottom: CustomizationTokens.sm),
      child: NmdCard(
        variant: NmdCardVariant.outlined,
        padding: EdgeInsets.zero,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            InkWell(
              onTap: onHeaderTap,
              borderRadius:
                  BorderRadius.circular(CustomizationTokens.cardRadius),
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: CustomizationTokens.md,
                  vertical: CustomizationTokens.sm,
                ),
                child: Row(
                  textDirection: TextDirection.rtl,
                  children: [
                    AnimatedRotation(
                      turns: expanded ? 0.5 : 0,
                      duration: NmdMotion.fast,
                      child: const Icon(
                        Icons.expand_more,
                        color: NmdColors.brandPrimary,
                        size: 22,
                      ),
                    ),
                    const SizedBox(width: CustomizationTokens.xs),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.end,
                            children: [
                              if (complete)
                                Padding(
                                  padding: const EdgeInsets.only(left: 6),
                                  child: Text(
                                    '✓ تم',
                                    style: NmdTypography.micro.copyWith(
                                      color: NmdColors.brandPrimary,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                ),
                              RequiredGroupBadge(
                                required: group.required,
                                missing: missing,
                              ),
                              const SizedBox(width: CustomizationTokens.xs),
                              Flexible(
                                child: Text(
                                  group.name,
                                  textAlign: TextAlign.right,
                                  style: NmdTypography.bodyBold.copyWith(
                                    fontSize: 14,
                                    color: NmdColors.brandPrimary,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(
                            preview,
                            textAlign: TextAlign.right,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: NmdTypography.micro.copyWith(
                              color: missing
                                  ? NmdColors.error
                                  : NmdColors.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            AnimatedCrossFade(
              firstChild: const SizedBox.shrink(),
              secondChild: Padding(
                padding: const EdgeInsets.fromLTRB(
                  CustomizationTokens.md,
                  0,
                  CustomizationTokens.md,
                  CustomizationTokens.md,
                ),
                child: child,
              ),
              crossFadeState: expanded
                  ? CrossFadeState.showSecond
                  : CrossFadeState.showFirst,
              duration: NmdMotion.fast,
            ),
          ],
        ),
      ),
    );
  }
}
