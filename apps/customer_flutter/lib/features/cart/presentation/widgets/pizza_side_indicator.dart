import 'package:flutter/material.dart';

import '../../../../app/theme/app_colors.dart';

/// Small pizza-disc icon: teal fill for whole, left half, or right half (`WHOLE`|`LEFT`|`RIGHT`).
class PizzaSideIndicator extends StatelessWidget {
  const PizzaSideIndicator({
    super.key,
    required this.placement,
    this.size = 18,
  });

  final String placement;
  final double size;

  @override
  Widget build(BuildContext context) {
    final p = placement.toUpperCase();
    return SizedBox(
      width: size,
      height: size,
      child: CustomPaint(
        painter: _PizzaSidePainter(
          side: p,
          teal: AppColors.primaryTeal,
          rim: const Color(0xFFCBD5E1),
        ),
      ),
    );
  }
}

class _PizzaSidePainter extends CustomPainter {
  _PizzaSidePainter({
    required this.side,
    required this.teal,
    required this.rim,
  });

  final String side;
  final Color teal;
  final Color rim;

  @override
  void paint(Canvas canvas, Size size) {
    final c = Offset(size.width / 2, size.height / 2);
    final r = size.shortestSide / 2 - 0.5;
    final stroke = Paint()
      ..color = rim
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1;

    if (side == 'WHOLE') {
      canvas.drawCircle(c, r, Paint()..color = teal);
      canvas.drawCircle(c, r, stroke);
      return;
    }

    if (side == 'LEFT') {
      canvas.save();
      canvas.clipRect(Rect.fromLTRB(0, 0, c.dx, size.height));
      canvas.drawCircle(c, r, Paint()..color = teal);
      canvas.restore();
      canvas.drawCircle(c, r, stroke);
      return;
    }

    if (side == 'RIGHT') {
      canvas.save();
      canvas.clipRect(Rect.fromLTRB(c.dx, 0, size.width, size.height));
      canvas.drawCircle(c, r, Paint()..color = teal);
      canvas.restore();
      canvas.drawCircle(c, r, stroke);
      return;
    }

    canvas.drawCircle(c, r, Paint()..color = const Color(0xFFE2E8F0));
    canvas.drawCircle(c, r, stroke);
  }

  @override
  bool shouldRepaint(covariant _PizzaSidePainter oldDelegate) =>
      oldDelegate.side != side || oldDelegate.teal != teal;
}
