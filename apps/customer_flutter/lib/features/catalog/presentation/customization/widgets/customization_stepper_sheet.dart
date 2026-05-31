import 'package:flutter/material.dart';

import '../../../../../api/models/product.dart';
import '../../../../../design_system/design_system.dart';
import '../../widgets/pizza_side_toggle.dart';
import '../customization_selection_summary.dart';
import '../customization_step_plan.dart';
import '../customization_tokens.dart';
import '../product_complexity_classifier.dart';
import '../product_customization_controller.dart';
import 'modifier_chip_grid.dart';
import 'required_group_badge.dart';

/// Fullscreen rounded modal bottom sheet for advanced product customization.
class CustomizationStepperSheet extends StatefulWidget {
  const CustomizationStepperSheet({
    super.key,
    required this.product,
    required this.controller,
    required this.onAddToCart,
    required this.storeClosed,
  });

  final Product product;
  final ProductCustomizationController controller;
  final VoidCallback onAddToCart;
  final bool storeClosed;

  static Future<void> show(
    BuildContext context, {
    required Product product,
    required ProductCustomizationController controller,
    required VoidCallback onAddToCart,
    required bool storeClosed,
  }) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (context) => CustomizationStepperSheet(
        product: product,
        controller: controller,
        onAddToCart: onAddToCart,
        storeClosed: storeClosed,
      ),
    );
  }

  @override
  State<CustomizationStepperSheet> createState() =>
      _CustomizationStepperSheetState();
}

class _CustomizationStepperSheetState extends State<CustomizationStepperSheet> {
  late final CustomizationStepPlan _plan;
  int _stepIndex = 0;

  @override
  void initState() {
    super.initState();
    _plan = planCustomizationSteps(widget.product);
    logCustomizationPlan(
      widget.product,
      'advanced-stepper',
      _plan,
    );
  }

  List<CustomizationStepDefinition> get _steps =>
      _plan.resolveSteps(widget.controller);

  CustomizationStepDefinition get _currentStep {
    final steps = _steps;
    final idx = _stepIndex.clamp(0, steps.length - 1);
    return steps[idx];
  }

  bool _isReviewStep(CustomizationStepDefinition step) =>
      step.kind == CustomizationStepKind.review;

  bool _isPlacementStep(CustomizationStepDefinition step) =>
      step.kind == CustomizationStepKind.placement;

  bool _canAdvance(CustomizationStepDefinition step) {
    if (_isReviewStep(step)) return true;
    if (_isPlacementStep(step)) return true;

    for (final group in step.groups) {
      final min = group.required
          ? (group.minSelected > 0 ? group.minSelected : 1)
          : group.minSelected;
      if (widget.controller.selectedIdsFor(group.id).length < min) {
        return false;
      }
    }
    return true;
  }

  void _clampStepIndex() {
    final max = _steps.length - 1;
    if (_stepIndex > max) {
      _stepIndex = max;
    }
  }

  void _next() {
    final step = _currentStep;
    if (!_canAdvance(step)) return;

    if (_isReviewStep(step)) {
      widget.onAddToCart();
      Navigator.of(context).pop();
      return;
    }

    setState(() {
      _stepIndex += 1;
      _clampStepIndex();
    });
  }

  void _back() {
    if (_stepIndex == 0) {
      Navigator.of(context).pop();
      return;
    }
    setState(() => _stepIndex -= 1);
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).padding.bottom;

    return Directionality(
      textDirection: TextDirection.rtl,
      child: ListenableBuilder(
        listenable: widget.controller,
        builder: (context, _) {
          _clampStepIndex();
          final steps = _steps;
          final step = _currentStep;
          final canAdvance = _canAdvance(step);

          return Container(
            height: MediaQuery.of(context).size.height * 0.94,
            decoration: const BoxDecoration(
              color: NmdColors.surfaceBase,
              borderRadius: BorderRadius.vertical(
                top: Radius.circular(CustomizationTokens.sheetRadius),
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(height: CustomizationTokens.sm),
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: NmdColors.borderSubtle,
                      borderRadius: BorderRadius.circular(99),
                    ),
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
                        onPressed: _back,
                        icon: const Icon(
                          Icons.arrow_forward_ios_rounded,
                          size: 18,
                        ),
                      ),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text(
                              widget.product.name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style:
                                  NmdTypography.bodyBold.copyWith(fontSize: 15),
                            ),
                            Text(
                              step.title,
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
                Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: CustomizationTokens.md,
                  ),
                  child: _StepIndicator(
                    current: _stepIndex,
                    total: steps.length,
                  ),
                ),
                const SizedBox(height: CustomizationTokens.sm),
                Expanded(
                  child: _buildStepBody(step),
                ),
                Container(
                  padding: EdgeInsets.fromLTRB(
                    CustomizationTokens.md,
                    CustomizationTokens.sm,
                    CustomizationTokens.md,
                    bottom + CustomizationTokens.sm,
                  ),
                  decoration: BoxDecoration(
                    color: NmdColors.surfaceBase,
                    border: Border(
                      top: BorderSide(
                        color: NmdColors.divider.withValues(alpha: 0.8),
                      ),
                    ),
                  ),
                  child: Row(
                    textDirection: TextDirection.rtl,
                    children: [
                      Expanded(
                        flex: 2,
                        child: NmdButton(
                          label: _isReviewStep(step) ? 'أضف للسلة' : 'التالي',
                          onPressed: (widget.storeClosed ||
                                  !widget.product.canAddToCart ||
                                  !canAdvance)
                              ? null
                              : _next,
                          size: NmdButtonSize.medium,
                        ),
                      ),
                      const SizedBox(width: CustomizationTokens.sm),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            NmdFormat.money(
                              widget.controller.customerUnitPrice,
                            ),
                            style: NmdTypography.price.copyWith(fontSize: 15),
                          ),
                          if (!canAdvance && !_isReviewStep(step))
                            Text(
                              'أكمل الاختيارات المطلوبة',
                              style: NmdTypography.micro.copyWith(
                                color: NmdColors.error,
                              ),
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildStepBody(CustomizationStepDefinition step) {
    if (_isReviewStep(step)) {
      return _ReviewStep(
        product: widget.product,
        controller: widget.controller,
      );
    }
    if (_isPlacementStep(step)) {
      return _PlacementStep(
        groups: _plan.halfCapableGroups,
        controller: widget.controller,
      );
    }

    return ListView(
      padding: const EdgeInsets.fromLTRB(
        CustomizationTokens.md,
        0,
        CustomizationTokens.md,
        CustomizationTokens.xl,
      ),
      children: [
        for (final group in step.groups) ...[
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              RequiredGroupBadge(
                required: group.required,
                missing: widget.controller.missingRequired
                    .any((g) => g.id == group.id),
              ),
              const SizedBox(width: CustomizationTokens.xs),
              Text(
                group.name,
                style: NmdTypography.bodyBold.copyWith(
                  color: NmdColors.brandPrimary,
                ),
              ),
            ],
          ),
          const SizedBox(height: CustomizationTokens.xs),
          ModifierChipGrid(
            group: group,
            selectedItemIds: widget.controller.selectedIdsFor(group.id),
            placements: widget.controller.placementsFor(group.id),
            inlineHalfPlacement: true,
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
          const SizedBox(height: CustomizationTokens.lg),
        ],
      ],
    );
  }
}

class _StepIndicator extends StatelessWidget {
  const _StepIndicator({required this.current, required this.total});

  final int current;
  final int total;

  @override
  Widget build(BuildContext context) {
    if (total <= 1) return const SizedBox.shrink();
    return Row(
      children: [
        for (var i = 0; i < total; i++) ...[
          if (i > 0) const SizedBox(width: 6),
          Expanded(
            child: AnimatedContainer(
              duration: NmdMotion.fast,
              height: 4,
              decoration: BoxDecoration(
                color: i <= current
                    ? NmdColors.brandPrimary
                    : NmdColors.surfaceMuted,
                borderRadius: BorderRadius.circular(99),
              ),
            ),
          ),
        ],
      ],
    );
  }
}

class _PlacementStep extends StatelessWidget {
  const _PlacementStep({
    required this.groups,
    required this.controller,
  });

  final List<ProductOptionGroup> groups;
  final ProductCustomizationController controller;

  @override
  Widget build(BuildContext context) {
    final tiles = <Widget>[];
    for (final group in groups) {
      for (final item in group.items) {
        if (!productOptionSupportsHalf(item, group)) continue;
        if (!controller.selectedIdsFor(group.id).contains(item.id)) continue;
        final side = controller.placementsFor(group.id)[item.id] ?? 'WHOLE';
        tiles.add(
          Padding(
            padding: const EdgeInsets.only(bottom: CustomizationTokens.sm),
            child: NmdCard(
              variant: NmdCardVariant.outlined,
              padding: const EdgeInsets.all(CustomizationTokens.sm),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    item.name,
                    textAlign: TextAlign.right,
                    style: NmdTypography.bodyBold.copyWith(fontSize: 14),
                  ),
                  const SizedBox(height: CustomizationTokens.xs),
                  PizzaSideToggle(
                    value: side,
                    onChanged: (p) {
                      controller.setItemPlacement(group.id, item.id, p);
                    },
                  ),
                ],
              ),
            ),
          ),
        );
      }
    }

    if (tiles.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(CustomizationTokens.md),
          child: Text(
            'لا توجد إضافات تحتاج توزيع نصف',
            textAlign: TextAlign.center,
            style: NmdTypography.bodySmall.copyWith(
              color: NmdColors.textSecondary,
            ),
          ),
        ),
      );
    }

    return ListView(
      padding: const EdgeInsets.all(CustomizationTokens.md),
      children: tiles,
    );
  }
}

class _ReviewStep extends StatelessWidget {
  const _ReviewStep({
    required this.product,
    required this.controller,
  });

  final Product product;
  final ProductCustomizationController controller;

  @override
  Widget build(BuildContext context) {
    final groups = activeOptionGroups(product);
    return ListView(
      padding: const EdgeInsets.all(CustomizationTokens.md),
      children: [
        for (final group in groups)
          if (controller.selectedIdsFor(group.id).isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(bottom: CustomizationTokens.sm),
              child: NmdCard(
                variant: NmdCardVariant.outlined,
                padding: const EdgeInsets.all(CustomizationTokens.sm),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      group.name,
                      style: NmdTypography.bodyBold.copyWith(
                        color: NmdColors.brandPrimary,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      groupSelectionPreview(
                        group,
                        controller.selectedIdsFor(group.id),
                        controller.placementsFor(group.id),
                      ),
                      textAlign: TextAlign.right,
                      style: NmdTypography.bodySmall,
                    ),
                  ],
                ),
              ),
            ),
        NmdCard(
          variant: NmdCardVariant.flat,
          padding: const EdgeInsets.all(CustomizationTokens.md),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                NmdFormat.money(controller.customerUnitPrice),
                style: NmdTypography.price.copyWith(fontSize: 16),
              ),
              Text('الإجمالي', style: NmdTypography.bodyBold),
            ],
          ),
        ),
      ],
    );
  }
}
