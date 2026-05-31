import 'package:flutter/material.dart';

import '../pizza_topping_visual_resolver.dart';

/// Renders topping asset; emoji text only when asset load fails.
class PizzaToppingGlyph extends StatelessWidget {
  const PizzaToppingGlyph({
    super.key,
    required this.visual,
    required this.size,
    this.dropShadow = true,
  });

  final PizzaToppingVisual visual;
  final double size;
  final bool dropShadow;

  @override
  Widget build(BuildContext context) {
    final path = visual.assetPath;
    if (path == null || path.isEmpty) {
      return _EmojiOnlyFallback(visual: visual, size: size);
    }

    final image = Image.asset(
      path,
      width: size,
      height: size,
      fit: BoxFit.contain,
      filterQuality: FilterQuality.medium,
      errorBuilder: (_, __, ___) =>
          _EmojiOnlyFallback(visual: visual, size: size),
    );

    if (!dropShadow) return image;

    return DecoratedBox(
      decoration: BoxDecoration(
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.12),
            blurRadius: 3,
            offset: const Offset(0, 1),
          ),
        ],
      ),
      child: image,
    );
  }
}

/// Plain emoji — no colored circle UI.
class _EmojiOnlyFallback extends StatelessWidget {
  const _EmojiOnlyFallback({required this.visual, required this.size});

  final PizzaToppingVisual visual;
  final double size;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: Center(
        child: Text(
          visual.emojiFallback,
          style: TextStyle(
            fontSize: size * 0.72,
            height: 1,
            shadows: [
              Shadow(
                color: Colors.black.withValues(alpha: 0.15),
                blurRadius: 2,
                offset: const Offset(0, 1),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Premium pizza base with warmth + vignette; painted fallback if asset missing.
class PizzaBaseImage extends StatelessWidget {
  const PizzaBaseImage({super.key, required this.size});

  final double size;

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        ColorFiltered(
          colorFilter: const ColorFilter.matrix([
            1.04, 0.02, 0, 0, 4,
            0.02, 1.02, 0, 0, 2,
            0, 0, 0.98, 0, 0,
            0, 0, 0, 1, 0,
          ]),
          child: Image.asset(
            PizzaToppingVisualResolver.pizzaBaseAssetPath,
            width: size,
            height: size,
            fit: BoxFit.cover,
            errorBuilder: (_, __, ___) => CustomPaint(
              painter: _PizzaBaseFallbackPainter(),
            ),
          ),
        ),
        DecoratedBox(
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: RadialGradient(
              colors: [
                Colors.transparent,
                Colors.black.withValues(alpha: 0.06),
              ],
              stops: const [0.72, 1.0],
            ),
          ),
        ),
      ],
    );
  }
}

class _PizzaBaseFallbackPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2 - 2;

    canvas.drawCircle(
      center,
      radius,
      Paint()..color = const Color(0xFFE8950A),
    );
    canvas.drawCircle(
      center,
      radius - 7,
      Paint()..color = const Color(0xFFDC2626).withValues(alpha: 0.35),
    );
    canvas.drawCircle(
      center,
      radius - 12,
      Paint()..color = const Color(0xFFFFF3D6),
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
