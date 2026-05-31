import 'package:flutter/material.dart';

import '../../../../../design_system/design_system.dart';
import '../customization_tokens.dart';
import '../product_customization_controller.dart';

/// Sticky summary strip: selections, extras count, live price, missing required.
class CustomizationSummaryBar extends StatelessWidget {
  const CustomizationSummaryBar({
    super.key,
    required this.controller,
    this.compact = false,
  });

  final ProductCustomizationController controller;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: controller,
      builder: (context, _) {
        final missing = controller.missingRequired;
        final extras = controller.selectedModifierCount;
        final hasMissing = missing.isNotEmpty;

        return AnimatedContainer(
          duration: NmdMotion.fast,
          curve: NmdMotion.standard,
          padding: EdgeInsets.symmetric(
            horizontal: compact ? CustomizationTokens.sm : CustomizationTokens.md,
            vertical: compact ? CustomizationTokens.xxs : CustomizationTokens.xs,
          ),
          decoration: BoxDecoration(
            color: compact
                ? NmdColors.tintAliveSoft.withValues(alpha: 0.48)
                : NmdColors.surfaceBase.withValues(alpha: 0.96),
            borderRadius: BorderRadius.circular(compact ? 10 : 0),
            border: Border.all(
              color: hasMissing
                  ? NmdColors.error.withValues(alpha: 0.25)
                  : NmdColors.borderSubtle.withValues(alpha: 0.5),
            ),
          ),
          child: Row(
            textDirection: TextDirection.rtl,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    NmdFormat.money(controller.customerUnitPrice),
                    style: NmdTypography.price.copyWith(
                      fontSize: compact ? 14 : 15,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  if (extras > 0)
                    Text(
                      '$extras إضافة',
                      style: NmdTypography.micro.copyWith(
                        fontSize: 10,
                        color: NmdColors.textSecondary,
                      ),
                    ),
                ],
              ),
              const SizedBox(width: CustomizationTokens.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      controller.summaryLine,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      textAlign: TextAlign.right,
                      style: NmdTypography.label.copyWith(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    if (hasMissing)
                      Text(
                        'اختر: ${missing.first.name}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        textAlign: TextAlign.right,
                        style: NmdTypography.micro.copyWith(
                          fontSize: 10,
                          color: NmdColors.error,
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
