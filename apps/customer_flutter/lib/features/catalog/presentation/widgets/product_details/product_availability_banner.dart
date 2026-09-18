import 'package:flutter/material.dart';

import '../../../../../design_system/design_system.dart';
import '../../../domain/store_availability.dart';
import 'product_details_layout_tokens.dart';

/// Coherent product-page availability banner (closed store / unavailable product).
class ProductAvailabilityBanner extends StatelessWidget {
  const ProductAvailabilityBanner({
    super.key,
    this.storeAvailability,
    this.productUnavailable = false,
  });

  final StoreAvailability? storeAvailability;
  final bool productUnavailable;

  @override
  Widget build(BuildContext context) {
    final closed = storeAvailability?.isClosed == true;
    if (!closed && !productUnavailable) return const SizedBox.shrink();

    final title = closed
        ? (storeAvailability?.bannerTitleAr ?? 'المحل مغلق حالياً')
        : 'المنتج غير متوفر حالياً';
    final body = closed
        ? (storeAvailability?.bannerBodyAr ?? '')
        : 'لا يمكن إضافة هذا المنتج إلى السلة الآن.';

    return Semantics(
      liveRegion: true,
      label: '$title. $body',
      child: Container(
        width: double.infinity,
        padding: EdgeInsets.symmetric(
          horizontal: ProductDetailsLayoutTokens.blockGap,
          vertical: ProductDetailsLayoutTokens.grid + 2,
        ),
        decoration: BoxDecoration(
          color: NmdColors.warningSoft.withValues(alpha: 0.55),
          borderRadius:
              BorderRadius.circular(ProductDetailsLayoutTokens.radiusSm),
          border: Border.all(
            color: NmdColors.warning.withValues(alpha: 0.28),
          ),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          textDirection: TextDirection.rtl,
          children: [
            Icon(
              Icons.storefront_outlined,
              size: 20,
              color: NmdColors.warning.withValues(alpha: 0.9),
            ),
            SizedBox(width: ProductDetailsLayoutTokens.itemGap),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    title,
                    textAlign: TextAlign.right,
                    style: NmdTypography.label.copyWith(
                      fontWeight: FontWeight.w700,
                      color: NmdColors.textPrimary,
                    ),
                  ),
                  if (body.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(
                      body,
                      textAlign: TextAlign.right,
                      style: NmdTypography.bodySmall.copyWith(
                        height: 1.45,
                        color: NmdColors.textSecondary,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Explains legacy weight products with a missing maximum (single selectable qty).
class WeightConfigIncompleteNotice extends StatelessWidget {
  const WeightConfigIncompleteNotice({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: EdgeInsets.symmetric(
        horizontal: ProductDetailsLayoutTokens.blockGap,
        vertical: ProductDetailsLayoutTokens.grid,
      ),
      decoration: BoxDecoration(
        color: NmdColors.info.withValues(alpha: 0.08),
        borderRadius:
            BorderRadius.circular(ProductDetailsLayoutTokens.radiusSm),
        border: Border.all(color: NmdColors.info.withValues(alpha: 0.22)),
      ),
      child: Text(
        'إعداد الكمية غير مكتمل لدى التاجر (لا يوجد حد أقصى). يمكن طلب الكمية الافتراضية فقط.',
        textAlign: TextAlign.right,
        style: NmdTypography.bodySmall.copyWith(
          height: 1.45,
          color: NmdColors.textSecondary,
        ),
      ),
    );
  }
}
