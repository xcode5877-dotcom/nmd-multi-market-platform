import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';

import '../../../../../design_system/premium/premium_marketplace_design_system.dart';
import '../../../../../design_system/tokens/nmd_colors.dart';

/// Premium shimmer placeholder for product gallery slots.
class ProductImageShimmer extends StatelessWidget {
  const ProductImageShimmer({
    super.key,
    this.borderRadius = BorderRadius.zero,
    this.baseColor,
    this.highlightColor,
  });

  final BorderRadius borderRadius;
  final Color? baseColor;
  final Color? highlightColor;

  @override
  Widget build(BuildContext context) {
    return Shimmer.fromColors(
      period: PremiumMarketplaceDesignSystem.shimmer,
      baseColor: baseColor ?? NmdColors.tintAliveMuted,
      highlightColor: highlightColor ?? NmdColors.surfaceElevated,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: NmdColors.tintAliveSoft,
          borderRadius: borderRadius,
        ),
      ),
    );
  }
}
