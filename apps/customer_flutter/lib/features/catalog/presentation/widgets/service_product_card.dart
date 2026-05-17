import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../../app/theme/app_colors.dart';

/// Vertical service tile — **leads / contact** only (no cart). خدمات pillar.
/// Fixed height matches store horizontal strip (`StoreDetail` list height 248).
class ServiceProductCard extends StatelessWidget {
  const ServiceProductCard({
    super.key,
    this.width,
    required this.name,
    required this.price,
    required this.imageUrl,
    required this.available,
    required this.heroTag,
    required this.onOpenDetail,
  });

  /// When null (store horizontal strip), uses [cardWidth]. Pass grid cell width in category grids.
  final double? width;

  final String name;
  final double price;
  final String imageUrl;
  final bool available;
  final String heroTag;

  /// Opens product / booking detail (no WhatsApp on card — product policy).
  final VoidCallback onOpenDetail;

  static const double cardWidth = 162;
  static const double cardHeight = 248;
  static const double imageHeight = 156;
  static const double priceRowHeight = 26;

  @override
  Widget build(BuildContext context) {
    final priceStr = price.toStringAsFixed(2);
    return SizedBox(
      width: width ?? cardWidth,
      height: cardHeight,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: available ? onOpenDetail : null,
          borderRadius: BorderRadius.circular(16),
          child: Ink(
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFE2E8F0)),
              boxShadow: const [
                BoxShadow(
                    color: Color(0x0A0F172A),
                    blurRadius: 16,
                    offset: Offset(0, 6)),
              ],
            ),
            child: LayoutBuilder(
              builder: (context, constraints) {
                final resolvedImageHeight =
                    (constraints.maxHeight * 0.62).clamp(136.0, imageHeight);
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    SizedBox(
                      height: resolvedImageHeight,
                      child: ClipRRect(
                        borderRadius: const BorderRadius.vertical(
                            top: Radius.circular(15)),
                        child: Stack(
                          fit: StackFit.expand,
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
                                      ? const ColoredBox(
                                          color: Color(0xFFE2E8F0))
                                      : CachedNetworkImage(
                                          imageUrl: imageUrl,
                                          fit: BoxFit.cover,
                                          errorWidget: (_, __, ___) =>
                                              const ColoredBox(
                                                  color: Color(0xFFE2E8F0)),
                                          placeholder: (_, __) =>
                                              const ColoredBox(
                                                  color: Color(0xFFF1F5F9)),
                                        ),
                                ),
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
                                    color: const Color(0xE6454B5C),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Text(
                                    'غير متاح',
                                    style: GoogleFonts.cairo(
                                      color: Colors.white,
                                      fontWeight: FontWeight.w700,
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
                        padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
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
                                      fontWeight: FontWeight.w600,
                                      fontSize: 14.5,
                                      height: 1.2,
                                      color: const Color(0xFF0F172A),
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
