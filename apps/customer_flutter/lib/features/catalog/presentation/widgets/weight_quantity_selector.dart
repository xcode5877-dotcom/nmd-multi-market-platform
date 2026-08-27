import 'package:flutter/material.dart';

import '../../../../api/models/product_measurement.dart';
import '../../../../design_system/design_system.dart';
import 'product_details/product_details_layout_tokens.dart';

/// Discrete weight/volume quantity chips (Measurement V2 — not option modifiers).
class WeightQuantitySelector extends StatelessWidget {
  const WeightQuantitySelector({
    super.key,
    required this.measurement,
    required this.selectedQuantity,
    required this.onSelected,
    this.enabled = true,
    this.unitPricePerBase,
  });

  final ProductMeasurement measurement;
  final double selectedQuantity;
  final ValueChanged<double> onSelected;
  final bool enabled;
  final double? unitPricePerBase;

  @override
  Widget build(BuildContext context) {
    final options = measurement.selectableQuantities();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'اختر الكمية',
          textAlign: TextAlign.right,
          style: NmdTypography.label.copyWith(
            fontSize: ProductDetailsLayoutTokens.typeLabel,
            fontWeight: FontWeight.w600,
            color: NmdColors.textPrimary,
          ),
        ),
        SizedBox(height: ProductDetailsLayoutTokens.itemGap),
        Wrap(
          spacing: ProductDetailsLayoutTokens.itemGap,
          runSpacing: ProductDetailsLayoutTokens.itemGap,
          alignment: WrapAlignment.start,
          textDirection: TextDirection.rtl,
          children: [
            for (final qty in options)
              _WeightChip(
                label: measurement.formatQuantityLabel(qty),
                selected: (selectedQuantity - qty).abs() < 0.0001,
                enabled: enabled,
                sublabel: unitPricePerBase != null
                    ? NmdFormat.money(
                        measurement.lineTotal(unitPricePerBase!, qty),
                      )
                    : null,
                onTap: () => onSelected(qty),
              ),
          ],
        ),
      ],
    );
  }
}

class _WeightChip extends StatelessWidget {
  const _WeightChip({
    required this.label,
    required this.selected,
    required this.enabled,
    required this.onTap,
    this.sublabel,
  });

  final String label;
  final bool selected;
  final bool enabled;
  final VoidCallback onTap;
  final String? sublabel;

  @override
  Widget build(BuildContext context) {
    final borderColor = selected
        ? NmdColors.brandPrimary
        : NmdColors.borderSubtle.withValues(alpha: 0.85);
    final fill = selected
        ? NmdColors.brandPrimary.withValues(alpha: 0.1)
        : NmdColors.surfaceElevated;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: enabled ? onTap : null,
        borderRadius:
            BorderRadius.circular(ProductDetailsLayoutTokens.radiusSm),
        child: AnimatedContainer(
          duration: ProductDetailsLayoutTokens.motionFast,
          curve: ProductDetailsLayoutTokens.motionCurve,
          padding: EdgeInsets.symmetric(
            horizontal: ProductDetailsLayoutTokens.blockGap,
            vertical: ProductDetailsLayoutTokens.grid + 2,
          ),
          decoration: BoxDecoration(
            color: fill,
            borderRadius:
                BorderRadius.circular(ProductDetailsLayoutTokens.radiusSm),
            border: Border.all(color: borderColor, width: selected ? 1.5 : 1),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                label,
                style: NmdTypography.label.copyWith(
                  fontWeight: FontWeight.w700,
                  color: selected
                      ? NmdColors.brandPrimary
                      : NmdColors.textPrimary,
                ),
              ),
              if (sublabel != null) ...[
                const SizedBox(height: 2),
                Text(
                  sublabel!,
                  style: NmdTypography.micro.copyWith(
                    color: NmdColors.textSecondary,
                    fontSize: 10,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
