import 'package:flutter/material.dart';

import '../../../../api/models/pizza_placement.dart';
import '../../../../design_system/design_system.dart';

/// Tristate control: full pizza / left half / right half (web `PizzaAddonsSelector` order L–W–R in LTR).
class PizzaSideToggle extends StatelessWidget {
  const PizzaSideToggle({
    super.key,
    required this.value,
    required this.onChanged,
    this.enabled = true,
  });

  final String value;
  final ValueChanged<String> onChanged;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final v = value.toUpperCase();
    return Directionality(
      textDirection: TextDirection.ltr,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _SideButton(
            selected: v == PizzaPlacement.left,
            onTap: enabled ? () => onChanged(PizzaPlacement.left) : null,
            child: _HalfCirclePainterWidget(
              side: _HalfSide.left,
              ink: v == PizzaPlacement.left
                  ? NmdColors.textOnBrand
                  : NmdColors.brandPrimary,
            ),
          ),
          const SizedBox(width: 4),
          _SideButton(
            selected: v == PizzaPlacement.whole,
            onTap: enabled ? () => onChanged(PizzaPlacement.whole) : null,
            child: _HalfCirclePainterWidget(
              side: _HalfSide.full,
              ink: v == PizzaPlacement.whole
                  ? NmdColors.textOnBrand
                  : NmdColors.brandPrimary,
            ),
          ),
          const SizedBox(width: 4),
          _SideButton(
            selected: v == PizzaPlacement.right,
            onTap: enabled ? () => onChanged(PizzaPlacement.right) : null,
            child: _HalfCirclePainterWidget(
              side: _HalfSide.right,
              ink: v == PizzaPlacement.right
                  ? NmdColors.textOnBrand
                  : NmdColors.brandPrimary,
            ),
          ),
        ],
      ),
    );
  }
}

class _SideButton extends StatelessWidget {
  const _SideButton({
    required this.selected,
    required this.onTap,
    required this.child,
  });

  final bool selected;
  final VoidCallback? onTap;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? NmdColors.brandPrimary : NmdColors.surfaceMuted,
      shape: const CircleBorder(),
      child: InkWell(
        onTap: onTap,
        customBorder: const CircleBorder(),
        child: Padding(
          padding: const EdgeInsets.all(8),
          child: IconTheme(
            data: IconThemeData(
              color: selected ? NmdColors.textOnBrand : NmdColors.brandPrimary,
              size: 22,
            ),
            child: child,
          ),
        ),
      ),
    );
  }
}

enum _HalfSide { full, left, right }

class _HalfCirclePainterWidget extends StatelessWidget {
  const _HalfCirclePainterWidget({required this.side, required this.ink});

  final _HalfSide side;
  final Color ink;

  @override
  Widget build(BuildContext context) {
    const size = 22.0;
    return SizedBox(
      width: size,
      height: size,
      child: CustomPaint(
        painter: _HalfCirclePainter(side: side, ink: ink),
      ),
    );
  }
}

class _HalfCirclePainter extends CustomPainter {
  _HalfCirclePainter({required this.side, required this.ink});

  final _HalfSide side;
  final Color ink;

  @override
  void paint(Canvas canvas, Size size) {
    final c = Offset(size.width / 2, size.height / 2);
    final r = size.width / 2 - 1;
    final fill = Paint()
      ..style = PaintingStyle.fill
      ..isAntiAlias = true;

    final stroke = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.2
      ..color = ink;

    switch (side) {
      case _HalfSide.full:
        fill.color = ink;
        canvas.drawCircle(c, r, fill);
        break;
      case _HalfSide.left:
        canvas.drawCircle(c, r, stroke);
        fill.color = ink;
        canvas.drawArc(
            Rect.fromCircle(center: c, radius: r), 1.5708, 3.14159, true, fill);
        break;
      case _HalfSide.right:
        canvas.drawCircle(c, r, stroke);
        fill.color = ink;
        canvas.drawArc(Rect.fromCircle(center: c, radius: r), -1.5708, 3.14159,
            true, fill);
        break;
    }
  }

  @override
  bool shouldRepaint(covariant _HalfCirclePainter oldDelegate) =>
      oldDelegate.side != side || oldDelegate.ink != ink;
}
