import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../../../../../design_system/tokens/nmd_colors.dart';
import '../../../../../design_system/tokens/nmd_typography.dart';

/// Horizontal thumbnail selector for the product gallery.
class ProductThumbnailStrip extends StatelessWidget {
  const ProductThumbnailStrip({
    super.key,
    required this.imageUrls,
    required this.activeIndex,
    required this.onSelected,
  });

  final List<String> imageUrls;
  final int activeIndex;
  final ValueChanged<int> onSelected;

  static const double thumbSize = 56;
  static const double gap = 8;

  @override
  Widget build(BuildContext context) {
    if (imageUrls.length <= 1) return const SizedBox.shrink();

    return SizedBox(
      height: thumbSize + 4,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: imageUrls.length,
        separatorBuilder: (_, __) => const SizedBox(width: gap),
        itemBuilder: (context, index) {
          final selected = index == activeIndex;
          return Semantics(
            label: 'صورة ${index + 1} من ${imageUrls.length}',
            selected: selected,
            button: true,
            child: GestureDetector(
              onTap: () => onSelected(index),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 220),
                curve: Curves.easeOutCubic,
                width: thumbSize,
                height: thumbSize,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: selected
                        ? NmdColors.brandPrimary
                        : NmdColors.divider,
                    width: selected ? 2.2 : 1,
                  ),
                  boxShadow: selected
                      ? [
                          BoxShadow(
                            color: NmdColors.brandPrimary.withValues(alpha: 0.18),
                            blurRadius: 8,
                            offset: const Offset(0, 2),
                          ),
                        ]
                      : null,
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(10),
                  child: Opacity(
                    opacity: selected ? 1 : 0.72,
                    child: CachedNetworkImage(
                      imageUrl: imageUrls[index],
                      fit: BoxFit.contain,
                      memCacheWidth: 112,
                      placeholder: (_, __) => ColoredBox(
                        color: NmdColors.tintAliveMuted,
                      ),
                      errorWidget: (_, __, ___) => ColoredBox(
                        color: NmdColors.tintAliveMuted,
                        child: Center(
                          child: Text(
                            '${index + 1}',
                            style: NmdTypography.label,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}
