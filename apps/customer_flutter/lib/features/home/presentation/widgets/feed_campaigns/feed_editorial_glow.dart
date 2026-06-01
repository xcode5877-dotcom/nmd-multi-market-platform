import 'package:flutter/material.dart';

import 'feed_editorial_tokens.dart';

/// Subtle pulsing glow behind editorial cards (no heavy cinematic effects).
class FeedEditorialGlow extends StatefulWidget {
  const FeedEditorialGlow({
    super.key,
    required this.child,
    this.color = FeedEditorialTokens.teal,
  });

  final Widget child;
  final Color color;

  @override
  State<FeedEditorialGlow> createState() => _FeedEditorialGlowState();
}

class _FeedEditorialGlowState extends State<FeedEditorialGlow>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2800),
    )..repeat(reverse: true);
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
      builder: (context, child) {
        final t = 0.35 + _controller.value * 0.25;
        return Stack(
          clipBehavior: Clip.none,
          children: [
            PositionedDirectional(
              top: -12,
              end: -8,
              child: Container(
                width: 120,
                height: 120,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: widget.color.withValues(alpha: t),
                      blurRadius: 48,
                      spreadRadius: 4,
                    ),
                  ],
                ),
              ),
            ),
            child!,
          ],
        );
      },
      child: widget.child,
    );
  }
}
