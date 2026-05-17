import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../../app/theme/app_colors.dart';

/// Store strip + category grid — **identical** card height; title area reserves 2 lines; price row fixed.
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
  });

  final double width;
  final String name;
  final double price;
  final String imageUrl;
  final bool available;
  final String heroTag;
  final VoidCallback onTap;

  static const double cardHeight = 205;
  static const double imageHeight = 116;
  static const double priceRowHeight = 26;

  @override
  Widget build(BuildContext context) {
    final priceStr = price.toStringAsFixed(2);
    return SizedBox(
      width: width,
      height: cardHeight,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(14),
          child: Ink(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0x14D1D5DB)),
              boxShadow: const [
                BoxShadow(
                    color: Color(0x10000000),
                    blurRadius: 12,
                    offset: Offset(0, 4)),
              ],
            ),
            child: LayoutBuilder(
              builder: (context, constraints) {
                final resolvedImageHeight =
                    (constraints.maxHeight * 0.57).clamp(108.0, imageHeight);
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    SizedBox(
                      height: resolvedImageHeight,
                      child: ClipRRect(
                        borderRadius: const BorderRadius.vertical(
                            top: Radius.circular(14)),
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
                                      ? const ColoredBox(color: Colors.white)
                                      : CachedNetworkImage(
                                          imageUrl: imageUrl,
                                          fit: BoxFit.cover,
                                          errorWidget: (_, __, ___) =>
                                              const ColoredBox(
                                                  color: Colors.white),
                                          placeholder: (_, __) =>
                                              const ColoredBox(
                                                  color: Colors.white),
                                        ),
                                ),
                              ),
                            ),
                            PositionedDirectional(
                              start: 8,
                              top: 8,
                              child: Container(
                                width: 28,
                                height: 28,
                                decoration: BoxDecoration(
                                  color: available
                                      ? AppColors.primaryTeal
                                      : const Color(0xFF9CA3AF),
                                  shape: BoxShape.circle,
                                  boxShadow: const [
                                    BoxShadow(
                                      color: Color(0x6614B8A6),
                                      blurRadius: 8,
                                      offset: Offset(0, 2),
                                    ),
                                  ],
                                ),
                                child: const Icon(Icons.add,
                                    size: 18, color: Colors.white),
                              ),
                            ),
                            if (!available)
                              PositionedDirectional(
                                end: 8,
                                top: 8,
                                child: Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 8, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: const Color(0xE55B6470),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: const Text(
                                    'غير متوفر حالياً',
                                    style: TextStyle(
                                      color: Colors.white,
                                      fontWeight: FontWeight.w800,
                                      fontSize: 10,
                                    ),
                                  ),
                                ),
                              ),
                          ],
                        ),
                      ),
                    ),
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(8, 8, 8, 8),
                        child: ClipRect(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Expanded(
                                child: Align(
                                  alignment: Alignment.topRight,
                                  child: Text(
                                    name,
                                    textAlign: TextAlign.right,
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                    textScaler: const TextScaler.linear(1),
                                    style: GoogleFonts.cairo(
                                      fontWeight: FontWeight.w700,
                                      fontSize: 14,
                                      height: 1.2,
                                      color: const Color(0xFF111827),
                                    ),
                                  ),
                                ),
                              ),
                              const SizedBox(height: 4),
                              SizedBox(
                                height: priceRowHeight,
                                child: Row(
                                  textDirection: TextDirection.rtl,
                                  mainAxisAlignment:
                                      MainAxisAlignment.spaceBetween,
                                  crossAxisAlignment: CrossAxisAlignment.center,
                                  children: [
                                    Flexible(
                                      child: Text(
                                        priceStr,
                                        maxLines: 1,
                                        overflow: TextOverflow.fade,
                                        softWrap: false,
                                        textScaler: const TextScaler.linear(1),
                                        style: GoogleFonts.cairo(
                                          color: available
                                              ? AppColors.primaryTeal
                                              : const Color(0xFF94A3B8),
                                          fontWeight: FontWeight.w800,
                                          fontSize: 16,
                                          letterSpacing: 0.2,
                                        ),
                                      ),
                                    ),
                                    Text(
                                      '₪',
                                      textScaler: const TextScaler.linear(1),
                                      style: GoogleFonts.cairo(
                                        color: const Color(0xFF64748B),
                                        fontWeight: FontWeight.w700,
                                        fontSize: 12,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                );
              },
            ),
          ),
        ),
      ),
    );
  }
}
