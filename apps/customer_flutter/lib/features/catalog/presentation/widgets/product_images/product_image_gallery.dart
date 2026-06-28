import 'package:flutter/material.dart';

import '../../../../../design_system/premium/premium_marketplace_design_system.dart';
import '../../../../../design_system/tokens/nmd_colors.dart';
import '../../../../../design_system/tokens/nmd_typography.dart';
import 'product_image_hero.dart';
import 'product_image_preloader.dart';
import 'product_image_viewer.dart';
import 'product_thumbnail_strip.dart';

/// Premium swipe gallery with counter, thumbnails, hero, and fullscreen viewer.
class ProductImageGallery extends StatefulWidget {
  const ProductImageGallery({
    super.key,
    required this.imageUrls,
    required this.heroTag,
    required this.initialIndex,
    required this.height,
    required this.imageKey,
    this.isServices = false,
    this.onActiveIndexChanged,
  });

  final List<String> imageUrls;
  final String heroTag;
  final int initialIndex;
  final double height;
  final GlobalKey imageKey;
  final bool isServices;
  final ValueChanged<int>? onActiveIndexChanged;

  static const BorderRadius galleryRadius = BorderRadius.all(Radius.circular(20));

  @override
  State<ProductImageGallery> createState() => _ProductImageGalleryState();
}

class _ProductImageGalleryState extends State<ProductImageGallery> {
  late final PageController _pageController;
  late int _activeIndex;

  @override
  void initState() {
    super.initState();
    final urls = widget.imageUrls;
    _activeIndex = urls.isEmpty
        ? 0
        : widget.initialIndex.clamp(0, urls.length - 1);
    _pageController = PageController(initialPage: _activeIndex);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ProductImagePreloader.precacheAdjacent(
        context,
        widget.imageUrls,
        _activeIndex,
      );
    });
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  void _onPageChanged(int index) {
    setState(() => _activeIndex = index);
    widget.onActiveIndexChanged?.call(index);
    ProductImagePreloader.precacheAdjacent(context, widget.imageUrls, index);
  }

  void _openViewer() {
    if (widget.imageUrls.isEmpty) return;
    ProductImageViewer.show(
      context,
      imageUrls: widget.imageUrls,
      initialIndex: _activeIndex,
    );
  }

  void _jumpTo(int index) {
    if (index == _activeIndex) return;
    _pageController.animateToPage(
      index,
      duration: const Duration(milliseconds: 320),
      curve: Curves.easeOutCubic,
    );
  }

  @override
  Widget build(BuildContext context) {
    final urls = widget.imageUrls;
    final layoutWidth = MediaQuery.sizeOf(context).width;
    final hasMultiple = urls.length > 1;
    final bg = widget.isServices
        ? const Color(0xFF141A22)
        : NmdColors.tintAliveSoft;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox(
          height: widget.height,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 0, 12, 0),
            child: ClipRRect(
              borderRadius: ProductImageGallery.galleryRadius,
              child: ColoredBox(
                color: bg,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    if (urls.isEmpty)
                      const ProductImageHero(
                        imageUrl: '',
                        layoutWidth: 360,
                        borderRadius: ProductImageGallery.galleryRadius,
                      )
                    else if (!hasMultiple)
                      ProductImageHero(
                        imageUrl: urls.first,
                        layoutWidth: layoutWidth,
                        heroTag: widget.heroTag,
                        enableHero: true,
                        imageKey: widget.imageKey,
                        onTap: _openViewer,
                        backgroundColor: bg,
                        borderRadius: ProductImageGallery.galleryRadius,
                        padding: const EdgeInsets.all(8),
                      )
                    else
                      PageView.builder(
                        controller: _pageController,
                        itemCount: urls.length,
                        onPageChanged: _onPageChanged,
                        physics: const BouncingScrollPhysics(
                          parent: PageScrollPhysics(),
                        ),
                        itemBuilder: (context, index) {
                          return ProductImageHero(
                            imageUrl: urls[index],
                            layoutWidth: layoutWidth,
                            heroTag: widget.heroTag,
                            enableHero: index == widget.initialIndex,
                            imageKey: index == _activeIndex ? widget.imageKey : null,
                            onTap: _openViewer,
                            backgroundColor: bg,
                            padding: const EdgeInsets.all(8),
                            semanticLabel:
                                'صورة ${index + 1} من ${urls.length}',
                          );
                        },
                      ),
                    if (widget.isServices)
                      const IgnorePointer(
                        child: DecoratedBox(
                          decoration: BoxDecoration(
                            gradient: PremiumMarketplaceDesignSystem
                                .cinematicDarkOverlay,
                          ),
                        ),
                      ),
                    if (hasMultiple) ...[
                      Positioned(
                        top: 12,
                        left: 12,
                        child: _ImageCounterBadge(
                          current: _activeIndex + 1,
                          total: urls.length,
                        ),
                      ),
                      Positioned(
                        left: 0,
                        right: 0,
                        bottom: 10,
                        child: _ModernPageIndicator(
                          count: urls.length,
                          index: _activeIndex,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ),
        if (hasMultiple) ...[
          const SizedBox(height: 10),
          ProductThumbnailStrip(
            imageUrls: urls,
            activeIndex: _activeIndex,
            onSelected: _jumpTo,
          ),
        ],
      ],
    );
  }
}

class _ImageCounterBadge extends StatelessWidget {
  const _ImageCounterBadge({required this.current, required this.total});

  final int current;
  final int total;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'صورة $current من $total',
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: Colors.black.withValues(alpha: 0.52),
          borderRadius: BorderRadius.circular(20),
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
          child: Text(
            '$current / $total',
            style: NmdTypography.label.copyWith(
              color: Colors.white,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.2,
            ),
          ),
        ),
      ),
    );
  }
}

class _ModernPageIndicator extends StatelessWidget {
  const _ModernPageIndicator({required this.count, required this.index});

  final int count;
  final int index;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(count, (i) {
        final active = i == index;
        return AnimatedContainer(
          duration: const Duration(milliseconds: 260),
          curve: Curves.easeOutCubic,
          margin: const EdgeInsets.symmetric(horizontal: 3),
          width: active ? 22 : 6,
          height: 6,
          decoration: BoxDecoration(
            color: active
                ? Colors.white
                : Colors.white.withValues(alpha: 0.45),
            borderRadius: BorderRadius.circular(99),
          ),
        );
      }),
    );
  }
}

/// Curved bottom clip retained from legacy product details hero.
class ProductImageCurvedClipper extends CustomClipper<Path> {
  @override
  Path getClip(Size size) {
    final path = Path()..lineTo(0, size.height - 20);
    final control = Offset(size.width * 0.5, size.height + 12);
    final end = Offset(size.width, size.height - 20);
    path.quadraticBezierTo(control.dx, control.dy, end.dx, end.dy);
    path.lineTo(size.width, 0);
    path.close();
    return path;
  }

  @override
  bool shouldReclip(covariant CustomClipper<Path> oldClipper) => false;
}

/// Computes adaptive hero height for product details gallery.
double productImageGalleryHeight(BuildContext context, {required bool isServices}) {
  if (isServices) return MediaQuery.sizeOf(context).height * 0.44;
  final h = MediaQuery.sizeOf(context).height;
  return (h * 0.38).clamp(280.0, 420.0);
}

/// Thumbnail strip adds vertical space when multiple images exist.
double productImageGalleryBlockHeight(
  BuildContext context, {
  required bool isServices,
  required int imageCount,
}) {
  final base = productImageGalleryHeight(context, isServices: isServices);
  if (imageCount <= 1) return base;
  return base + ProductThumbnailStrip.thumbSize + 18;
}
