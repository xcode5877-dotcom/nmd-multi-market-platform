import 'dart:ui';

import 'package:flutter/material.dart';

import '../../../../design_system/design_system.dart';
import '../customization/customization_tokens.dart';

/// Premium compact add-to-cart bar for product details.
class ProductAddToCartDock extends StatelessWidget {
  const ProductAddToCartDock({
    super.key,
    required this.price,
    required this.onPressed,
    this.disabled = false,
    this.missingRequired = false,
    this.loading = false,
    this.scale = 1,
  });

  final double price;
  final VoidCallback? onPressed;
  final bool disabled;
  final bool missingRequired;
  final bool loading;
  final double scale;

  bool get _canTap => !disabled && !loading && onPressed != null;

  String get _ctaLabel {
    if (loading) return 'جاري الإضافة...';
    if (missingRequired && !disabled) return 'أكمل الاختيارات المطلوبة';
    return 'أضف للسلة';
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).padding.bottom;

    return Padding(
      padding: EdgeInsets.fromLTRB(
        CustomizationTokens.md,
        0,
        CustomizationTokens.md,
        bottom + CustomizationTokens.sm,
      ),
      child: Transform.scale(
        scale: scale,
        child: ClipRRect(
          borderRadius: BorderRadius.circular(14),
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
            child: DecoratedBox(
              decoration: BoxDecoration(
                color: NmdColors.surfaceBase.withValues(alpha: 0.94),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                  color: NmdColors.borderSubtle.withValues(alpha: 0.85),
                ),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.06),
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(
                  CustomizationTokens.sm,
                  CustomizationTokens.xs,
                  CustomizationTokens.xs,
                  CustomizationTokens.xs,
                ),
                child: Row(
                  textDirection: TextDirection.rtl,
                  children: [
                    Expanded(
                      flex: 3,
                      child: _DockCtaButton(
                        label: _ctaLabel,
                        enabled: _canTap && !missingRequired,
                        loading: loading,
                        onPressed: _canTap && !missingRequired ? onPressed : null,
                      ),
                    ),
                    const SizedBox(width: CustomizationTokens.sm),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          NmdFormat.money(price),
                          style: NmdTypography.price.copyWith(fontSize: 15),
                        ),
                        if (missingRequired && !disabled)
                          Text(
                            'اختيار مطلوب',
                            style: NmdTypography.micro.copyWith(
                              color: NmdColors.error,
                            ),
                          ),
                      ],
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

class _DockCtaButton extends StatelessWidget {
  const _DockCtaButton({
    required this.label,
    required this.enabled,
    required this.loading,
    required this.onPressed,
  });

  final String label;
  final bool enabled;
  final bool loading;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 44,
      child: FilledButton(
        onPressed: enabled ? onPressed : null,
        style: FilledButton.styleFrom(
          backgroundColor: NmdColors.brandPrimary,
          disabledBackgroundColor:
              NmdColors.brandPrimary.withValues(alpha: 0.35),
          foregroundColor: NmdColors.textOnBrand,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          elevation: 0,
        ),
        child: loading
            ? const SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: NmdColors.textOnBrand,
                ),
              )
            : Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: NmdTypography.label.copyWith(
                  color: NmdColors.textOnBrand,
                  fontWeight: FontWeight.w700,
                  fontSize: 13,
                ),
              ),
      ),
    );
  }
}
