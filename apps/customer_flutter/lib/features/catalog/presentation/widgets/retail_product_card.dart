import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../../../../design_system/design_system.dart';

/// Store strip + category grid — unified Now Market product tile (retail).
class RetailProductCard extends StatelessWidget {
  const RetailProductCard({
    super.key,
    required this.width,
    required this.name,
    required this.price,
    required this.imageUrl,
    required this.available,
    required this.heroTag,
    required this.onTap,
    this.description,
  });

  final double width;
  final String name;
  final double price;
  final String imageUrl;
  final bool available;
  final String heroTag;
  final VoidCallback onTap;
  final String? description;

  static const double cardHeight = 210;
  static const double imageHeight = 118;
  static const double priceRowHeight = 26;

  @override
  Widget build(BuildContext context) {
    final priceStr = price.toStringAsFixed(2);
    final desc = (description ?? '').trim();
    final showDesc = desc.isNotEmpty;

    return SizedBox(
      width: width,
      height: cardHeight,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: NmdRadius.borderMd,
          child: Ink(
            decoration: BoxDecoration(
              color: NmdColors.surfaceBase,
              borderRadius: NmdRadius.borderMd,
              border: const Border.fromBorderSide(
                BorderSide(color: NmdColors.borderSubtle),
              ),
              boxShadow: NmdShadows.sm,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                SizedBox(
                  height: imageHeight,
                  child: ClipRRect(
                    borderRadius: const BorderRadius.vertical(
                      top: Radius.circular(NmdRadius.md),
                    ),
                    child: Stack(
                      children: [
                        Positioned.fill(
                          child: ColorFiltered(
                            colorFilter: available
                                ? const ColorFilter.mode(
                                    Colors.transparent, BlendMode.dst)
                                : const ColorFilter.matrix(<double>[
                                    0.2126,
                                    0.7152,
                                    0.0722,
                                    0,
                                    0,
                                    0.2126,
                                    0.7152,
                                    0.0722,
                                    0,
                                    0,
                                    0.2126,
                                    0.7152,
                                    0.0722,
                                    0,
                                    0,
                                    0,
                                    0,
                                    0,
                                    1,
                                    0,
                                  ]),
                            child: Hero(
                              tag: heroTag,
                              child: imageUrl.isEmpty
                                  ? ColoredBox(color: NmdColors.tintAliveMuted)
                                  : CachedNetworkImage(
                                      imageUrl: imageUrl,
                                      fit: BoxFit.cover,
                                      fadeInDuration: NmdMotion.fast,
                                      errorWidget: (_, __, ___) => ColoredBox(
                                        color: NmdColors.tintAliveMuted,
                                      ),
                                      placeholder: (_, __) => ColoredBox(
                                        color: NmdColors.tintAliveSoft,
                                      ),
                                    ),
                            ),
                          ),
                        ),
                        PositionedDirectional(
                          start: NmdSpacing.xs,
                          top: NmdSpacing.xs,
                          child: _AddFab(enabled: available),
                        ),
                        if (!available)
                          PositionedDirectional(
                            end: NmdSpacing.xs,
                            top: NmdSpacing.xs,
                            child: NmdBadge(
                              label: 'غير متوفر',
                              tone: NmdBadgeTone.neutral,
                              compact: true,
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(8, 8, 8, 8),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Expanded(
                          child: Align(
                            alignment: Alignment.topRight,
                            child: Text(
                              name,
                              textAlign: TextAlign.right,
                              maxLines: showDesc ? 1 : 2,
                              overflow: TextOverflow.ellipsis,
                              style: NmdTypography.bodyBold.copyWith(
                                fontSize: 14,
                                color: available
                                    ? NmdColors.textPrimary
                                    : NmdColors.textTertiary,
                              ),
                            ),
                          ),
                        ),
                        if (showDesc) ...[
                          const SizedBox(height: 2),
                          Text(
                            desc,
                            textAlign: TextAlign.right,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: NmdTypography.micro.copyWith(
                              color: NmdColors.textSecondary,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                        const SizedBox(height: 4),
                        SizedBox(
                          height: priceRowHeight,
                          child: Row(
                            textDirection: TextDirection.rtl,
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Flexible(
                                child: Text(
                                  priceStr,
                                  maxLines: 1,
                                  overflow: TextOverflow.fade,
                                  style: NmdTypography.h3.copyWith(
                                    fontSize: 16,
                                    color: available
                                        ? NmdColors.brandPrimary
                                        : NmdColors.textTertiary,
                                  ),
                                ),
                              ),
                              Text(
                                '₪',
                                style: NmdTypography.label.copyWith(
                                  color: NmdColors.textSecondary,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _AddFab extends StatelessWidget {
  const _AddFab({required this.enabled});

  final bool enabled;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 30,
      height: 30,
      decoration: BoxDecoration(
        color: enabled ? NmdColors.brandPrimary : NmdColors.textTertiary,
        shape: BoxShape.circle,
        boxShadow: enabled ? NmdShadows.brandGlow(alpha: 0.22) : null,
      ),
      child:
          const Icon(Icons.add_rounded, size: 18, color: NmdColors.textOnBrand),
    );
  }
}
