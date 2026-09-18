import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../../design_system/design_system.dart';
import 'product_details_layout_tokens.dart';

/// Fixed bottom action: integrated quantity + primary CTA (Now Market dock).
class ProductDetailsBottomBar extends StatelessWidget {
  const ProductDetailsBottomBar({
    super.key,
    required this.unitPrice,
    required this.quantity,
    required this.onQuantityChanged,
    required this.onPressed,
    this.disabled = false,
    this.quantityInteractionEnabled = true,
    this.missingRequired = false,
    this.loading = false,
    this.scale = 1,
    this.isWeightProduct = false,
    this.weightQuantityLabel,
    this.lineTotal,
    this.onWeightStep,
    this.canWeightDecrement = false,
    this.canWeightIncrement = false,
    this.disabledCtaLabel,
  });

  final double unitPrice;
  final int quantity;
  final ValueChanged<int> onQuantityChanged;
  final VoidCallback? onPressed;
  final bool disabled;
  /// When false, steppers are inert; cart CTA still follows [disabled].
  final bool quantityInteractionEnabled;
  final bool missingRequired;
  final bool loading;
  final double scale;
  final bool isWeightProduct;
  final String? weightQuantityLabel;
  final double? lineTotal;
  final ValueChanged<int>? onWeightStep;
  final bool canWeightDecrement;
  final bool canWeightIncrement;
  final String? disabledCtaLabel;

  bool get _canTap => !disabled && !loading && onPressed != null;

  double get _total => lineTotal ?? unitPrice * quantity;

  String get _ctaActionLabel {
    if (loading) return '...';
    if (disabled && disabledCtaLabel != null && disabledCtaLabel!.isNotEmpty) {
      return disabledCtaLabel!;
    }
    if (missingRequired && !disabled) return 'أكمل الاختيارات';
    return 'أضف إلى السلة';
  }

  static double scrollInset(BuildContext context) {
    return ProductDetailsLayoutTokens.bottomBarHeight +
        ProductDetailsLayoutTokens.blockGap +
        ProductDetailsLayoutTokens.grid * 2;
  }

  @override
  Widget build(BuildContext context) {
    return Positioned(
      left: 0,
      right: 0,
      bottom: 0,
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          ProductDetailsLayoutTokens.pageHorizontal,
          0,
          ProductDetailsLayoutTokens.pageHorizontal,
          PremiumDockLayout.gapAboveNav,
        ),
        child: Transform.scale(
          scale: scale,
          alignment: Alignment.bottomCenter,
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: NmdColors.surfaceElevated.withValues(alpha: 0.97),
              borderRadius: BorderRadius.circular(
                ProductDetailsLayoutTokens.bottomBarRadius,
              ),
              border: Border.all(
                color: NmdColors.borderSubtle.withValues(alpha: 0.65),
              ),
              boxShadow: ProductDetailsLayoutTokens.shadowDock,
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(
                ProductDetailsLayoutTokens.bottomBarRadius,
              ),
              child: Padding(
                padding: EdgeInsets.all(ProductDetailsLayoutTokens.grid),
                child: Row(
                  textDirection: TextDirection.ltr,
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    if (isWeightProduct)
                      _WeightDockQuantity(
                        label: weightQuantityLabel ?? '',
                        enabled: quantityInteractionEnabled && !loading,
                        canDecrement: canWeightDecrement,
                        canIncrement: canWeightIncrement,
                        onStep: onWeightStep,
                      )
                    else
                      _QuantityStepper(
                        quantity: quantity,
                        enabled: quantityInteractionEnabled && !loading,
                        onChanged: onQuantityChanged,
                      ),
                    Container(
                      width: 1,
                      height: ProductDetailsLayoutTokens.stepperHeight - 20,
                      margin: EdgeInsets.symmetric(
                        horizontal: ProductDetailsLayoutTokens.grid,
                      ),
                      color: NmdColors.borderSubtle.withValues(alpha: 0.45),
                    ),
                    Expanded(
                      child: _CtaButton(
                        actionLabel: _ctaActionLabel,
                        total: _total,
                        loading: loading,
                        enabled: _canTap,
                        onPressed: onPressed,
                      ),
                    ),
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

class _WeightDockQuantity extends StatelessWidget {
  const _WeightDockQuantity({
    required this.label,
    required this.enabled,
    required this.canDecrement,
    required this.canIncrement,
    this.onStep,
  });

  final String label;
  final bool enabled;
  final bool canDecrement;
  final bool canIncrement;
  final ValueChanged<int>? onStep;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: ProductDetailsLayoutTokens.stepperHeight,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _StepIcon(
            icon: Icons.remove_rounded,
            enabled: enabled && canDecrement && onStep != null,
            onTap: () => onStep?.call(-1),
          ),
          SizedBox(
            width: ProductDetailsLayoutTokens.blockGap + 12,
            child: AnimatedSwitcher(
              duration: ProductDetailsLayoutTokens.motionFast,
              child: Text(
                label,
                key: ValueKey<String>(label),
                textAlign: TextAlign.center,
                style: NmdTypography.label.copyWith(
                  fontWeight: FontWeight.w700,
                  fontSize: ProductDetailsLayoutTokens.typeLabel,
                  color: NmdColors.brandPrimary,
                ),
              ),
            ),
          ),
          _StepIcon(
            icon: Icons.add_rounded,
            enabled: enabled && canIncrement && onStep != null,
            onTap: () => onStep?.call(1),
          ),
        ],
      ),
    );
  }
}

class _CtaButton extends StatelessWidget {
  const _CtaButton({
    required this.actionLabel,
    required this.total,
    required this.loading,
    required this.enabled,
    required this.onPressed,
  });

  final String actionLabel;
  final double total;
  final bool loading;
  final bool enabled;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: ProductDetailsLayoutTokens.ctaHeight,
      child: FilledButton(
        onPressed: enabled
            ? () {
                HapticFeedback.lightImpact();
                onPressed?.call();
              }
            : null,
        style: FilledButton.styleFrom(
          backgroundColor: NmdColors.brandPrimary,
          disabledBackgroundColor:
              NmdColors.brandPrimary.withValues(alpha: 0.28),
          foregroundColor: NmdColors.textOnBrand,
          elevation: 0,
          shadowColor: Colors.transparent,
          shape: RoundedRectangleBorder(
            borderRadius:
                BorderRadius.circular(ProductDetailsLayoutTokens.radiusSm),
          ),
        ),
        child: loading
            ? SizedBox(
                width: ProductDetailsLayoutTokens.iconSm,
                height: ProductDetailsLayoutTokens.iconSm,
                child: const CircularProgressIndicator(
                  strokeWidth: 2,
                  color: NmdColors.textOnBrand,
                ),
              )
            : Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Flexible(
                    child: Text(
                      actionLabel,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: NmdTypography.button.copyWith(
                        fontSize: ProductDetailsLayoutTokens.typeLabel + 1,
                        fontWeight: FontWeight.w600,
                        letterSpacing: -0.1,
                      ),
                    ),
                  ),
                  if (actionLabel == 'أضف إلى السلة') ...[
                    SizedBox(width: ProductDetailsLayoutTokens.itemGap),
                    AnimatedSwitcher(
                      duration: ProductDetailsLayoutTokens.motionFast,
                      switchInCurve: ProductDetailsLayoutTokens.motionCurve,
                      transitionBuilder: (child, animation) =>
                          FadeTransition(opacity: animation, child: child),
                      child: Text(
                        NmdFormat.money(total),
                        key: ValueKey<double>(total),
                        style: NmdTypography.button.copyWith(
                          fontSize: ProductDetailsLayoutTokens.typeLabel + 1,
                          fontWeight: FontWeight.w600,
                          letterSpacing: -0.1,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
      ),
    );
  }
}

class _QuantityStepper extends StatelessWidget {
  const _QuantityStepper({
    required this.quantity,
    required this.enabled,
    required this.onChanged,
  });

  final int quantity;
  final bool enabled;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: ProductDetailsLayoutTokens.stepperHeight,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _StepIcon(
            icon: Icons.remove_rounded,
            enabled: enabled && quantity > 1,
            onTap: () => onChanged(quantity - 1),
          ),
          SizedBox(
            width: ProductDetailsLayoutTokens.blockGap + 4,
            child: AnimatedSwitcher(
              duration: ProductDetailsLayoutTokens.motionFast,
              switchInCurve: ProductDetailsLayoutTokens.motionCurve,
              transitionBuilder: (child, animation) => FadeTransition(
                opacity: animation,
                child: child,
              ),
              child: Text(
                '$quantity',
                key: ValueKey<int>(quantity),
                textAlign: TextAlign.center,
                style: NmdTypography.label.copyWith(
                  fontWeight: FontWeight.w600,
                  fontSize: ProductDetailsLayoutTokens.typeLabel + 1,
                ),
              ),
            ),
          ),
          _StepIcon(
            icon: Icons.add_rounded,
            enabled: enabled && quantity < 99,
            onTap: () => onChanged(quantity + 1),
          ),
        ],
      ),
    );
  }
}

class _StepIcon extends StatelessWidget {
  const _StepIcon({
    required this.icon,
    required this.enabled,
    required this.onTap,
  });

  final IconData icon;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: enabled
            ? () {
                HapticFeedback.selectionClick();
                onTap();
              }
            : null,
        borderRadius:
            BorderRadius.circular(ProductDetailsLayoutTokens.radiusSm),
        child: Padding(
          padding: EdgeInsets.all(ProductDetailsLayoutTokens.grid),
          child: Icon(
            icon,
            size: ProductDetailsLayoutTokens.iconSm,
            color: enabled
                ? NmdColors.brandPrimary
                : NmdColors.textTertiary.withValues(alpha: 0.4),
          ),
        ),
      ),
    );
  }
}
