import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../../design_system/tokens/nmd_typography.dart';
import 'product_image_preloader.dart';
import 'product_image_shimmer.dart';

/// Immersive fullscreen product image viewer with smart zoom and swipe gallery.
class ProductImageViewer extends StatefulWidget {
  const ProductImageViewer({
    super.key,
    required this.imageUrls,
    required this.initialIndex,
  });

  final List<String> imageUrls;
  final int initialIndex;

  static Future<void> show(
    BuildContext context, {
    required List<String> imageUrls,
    required int initialIndex,
  }) {
    return Navigator.of(context).push<void>(
      PageRouteBuilder<void>(
        opaque: false,
        barrierColor: Colors.black87,
        transitionDuration: const Duration(milliseconds: 280),
        reverseTransitionDuration: const Duration(milliseconds: 240),
        pageBuilder: (context, animation, secondaryAnimation) {
          return FadeTransition(
            opacity: animation,
            child: ProductImageViewer(
              imageUrls: imageUrls,
              initialIndex: initialIndex,
            ),
          );
        },
      ),
    );
  }

  @override
  State<ProductImageViewer> createState() => _ProductImageViewerState();
}

class _ProductImageViewerState extends State<ProductImageViewer>
    with TickerProviderStateMixin {
  late final PageController _pageController;
  late int _index;
  double _dragOffset = 0;

  @override
  void initState() {
    super.initState();
    final urls = widget.imageUrls;
    _index = urls.isEmpty ? 0 : widget.initialIndex.clamp(0, urls.length - 1);
    _pageController = PageController(initialPage: _index);
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ProductImagePreloader.precacheAdjacent(
        context,
        widget.imageUrls,
        _index,
      );
    });
  }

  @override
  void dispose() {
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    _pageController.dispose();
    super.dispose();
  }

  void _close() => Navigator.of(context).maybePop();

  void _onPageChanged(int i) {
    setState(() => _index = i);
    ProductImagePreloader.precacheAdjacent(context, widget.imageUrls, i);
  }

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.paddingOf(context).top;
    final urls = widget.imageUrls;

    return Material(
      color: Colors.black.withValues(alpha: 0.96),
      child: GestureDetector(
        onVerticalDragUpdate: (d) {
          if (d.delta.dy > 0 || _dragOffset > 0) {
            setState(() => _dragOffset += d.delta.dy);
          }
        },
        onVerticalDragEnd: (d) {
          if (_dragOffset > 120 || d.primaryVelocity != null && d.primaryVelocity! > 700) {
            _close();
          } else {
            setState(() => _dragOffset = 0);
          }
        },
        child: Transform.translate(
          offset: Offset(0, _dragOffset),
          child: Opacity(
            opacity: (1 - (_dragOffset / 320)).clamp(0.4, 1.0),
            child: Stack(
              fit: StackFit.expand,
              children: [
                PageView.builder(
                  controller: _pageController,
                  itemCount: urls.length,
                  onPageChanged: _onPageChanged,
                  physics: const BouncingScrollPhysics(
                    parent: PageScrollPhysics(),
                  ),
                  itemBuilder: (context, pageIndex) {
                    return _ZoomableImagePage(imageUrl: urls[pageIndex]);
                  },
                ),
                Positioned(
                  top: top + 4,
                  left: 8,
                  right: 8,
                  child: Row(
                    children: [
                      Semantics(
                        label: 'إغلاق',
                        button: true,
                        child: IconButton(
                          onPressed: _close,
                          icon: const Icon(Icons.close_rounded,
                              color: Colors.white, size: 28),
                        ),
                      ),
                      Expanded(
                        child: Center(
                          child: Text(
                            urls.length > 1
                                ? '${_index + 1} / ${urls.length}'
                                : '',
                            style: NmdTypography.label.copyWith(
                              color: Colors.white70,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ),
                      Semantics(
                        label: 'مشاركة — قريباً',
                        button: true,
                        child: IconButton(
                          onPressed: () {
                            // Future-ready share hook.
                          },
                          icon: Icon(
                            Icons.ios_share_rounded,
                            color: Colors.white.withValues(alpha: 0.35),
                            size: 24,
                          ),
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
    );
  }
}

class _ZoomableImagePage extends StatefulWidget {
  const _ZoomableImagePage({required this.imageUrl});

  final String imageUrl;

  @override
  State<_ZoomableImagePage> createState() => _ZoomableImagePageState();
}

class _ZoomableImagePageState extends State<_ZoomableImagePage>
    with SingleTickerProviderStateMixin {
  final TransformationController _transform = TransformationController();
  late final AnimationController _zoomAnim;
  Animation<Matrix4>? _zoomMatrixAnim;
  int _zoomStep = 0;

  static const _zoomLevels = [1.0, 2.0, 4.0];

  @override
  void initState() {
    super.initState();
    _zoomAnim = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 260),
    )..addListener(() {
        if (_zoomMatrixAnim != null) {
          _transform.value = _zoomMatrixAnim!.value;
        }
      });
  }

  @override
  void dispose() {
    _zoomAnim.dispose();
    _transform.dispose();
    super.dispose();
  }

  void _onDoubleTap(TapDownDetails details) {
    _zoomStep = (_zoomStep + 1) % _zoomLevels.length;
    final targetScale = _zoomLevels[_zoomStep];
    final position = details.localPosition;

    final matrix = Matrix4.identity()
      ..translateByDouble(position.dx, position.dy, 0, 1)
      ..scaleByDouble(targetScale, targetScale, 1, 1)
      ..translateByDouble(-position.dx, -position.dy, 0, 1);

    _zoomMatrixAnim = Matrix4Tween(
      begin: _transform.value,
      end: matrix,
    ).animate(CurvedAnimation(parent: _zoomAnim, curve: Curves.easeOutCubic));

    _zoomAnim.forward(from: 0);
  }

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    final memWidth = ProductImagePreloader.memCacheWidthForLayout(context, width);

    return InteractiveViewer(
      transformationController: _transform,
      minScale: 0.85,
      maxScale: 5,
      panEnabled: true,
      scaleEnabled: true,
      clipBehavior: Clip.none,
      child: GestureDetector(
        onDoubleTapDown: _onDoubleTap,
        child: Center(
          child: CachedNetworkImage(
            imageUrl: widget.imageUrl,
            fit: BoxFit.contain,
            memCacheWidth: memWidth,
            fadeInDuration: const Duration(milliseconds: 280),
            placeholder: (_, __) => const SizedBox.expand(
              child: ProductImageShimmer(
                borderRadius: BorderRadius.all(Radius.circular(8)),
              ),
            ),
            errorWidget: (_, __, ___) => const Icon(
              Icons.broken_image_outlined,
              color: Colors.white54,
              size: 48,
            ),
          ),
        ),
      ),
    );
  }
}

/// Future media kinds for 360° / video without redesigning gallery host.
enum ProductMediaKind { image, video, viewer360 }

class ProductMediaItem {
  const ProductMediaItem({required this.kind, required this.url});

  final ProductMediaKind kind;
  final String url;

  bool get isImage => kind == ProductMediaKind.image;
}

List<ProductMediaItem> productMediaFromUrls(List<String> urls) => urls
    .map((u) => ProductMediaItem(kind: ProductMediaKind.image, url: u))
    .toList(growable: false);
