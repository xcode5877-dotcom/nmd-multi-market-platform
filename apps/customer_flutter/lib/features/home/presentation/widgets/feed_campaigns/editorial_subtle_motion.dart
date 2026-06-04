import 'dart:math' as math;

import 'package:flutter/widgets.dart';

/// Shared 6–12s subtle loop — one ticker per subtree.
class EditorialSubtleMotion extends StatefulWidget {
  const EditorialSubtleMotion({
    super.key,
    required this.period,
    required this.builder,
    this.reverse = true,
  });

  final Duration period;
  final bool reverse;
  final Widget Function(BuildContext context, double t) builder;

  @override
  State<EditorialSubtleMotion> createState() => _EditorialSubtleMotionState();
}

class _EditorialSubtleMotionState extends State<EditorialSubtleMotion>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: widget.period);
    if (widget.reverse) {
      _controller.repeat(reverse: true);
    } else {
      _controller.repeat();
    }
  }

  @override
  void didUpdateWidget(EditorialSubtleMotion oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.period != widget.period) {
      _controller.duration = widget.period;
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) =>
          widget.builder(context, _controller.value),
    );
  }
}

/// Drifts a child on a slow vertical sine — chips / floating assets.
class EditorialFloatDrift extends StatelessWidget {
  const EditorialFloatDrift({
    super.key,
    required this.phase,
    required this.amplitude,
    required this.t,
    required this.child,
  });

  final double phase;
  final double amplitude;
  final double t;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final wave = math.sin(t * 2 * math.pi + phase) * amplitude;
    return Transform.translate(offset: Offset(0, wave), child: child);
  }
}
