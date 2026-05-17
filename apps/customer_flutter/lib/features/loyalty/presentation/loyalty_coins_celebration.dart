import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:google_fonts/google_fonts.dart';

import '../application/coins_balance_cubit.dart';

/// Brief “golden coins” burst from screen center toward the bottom-nav rewards zone, then [onComplete].
class LoyaltyCoinsCelebrationOverlay extends StatefulWidget {
  const LoyaltyCoinsCelebrationOverlay({
    super.key,
    required this.coinsEarned,
    required this.onComplete,
  });

  final int coinsEarned;
  final Future<void> Function() onComplete;

  @override
  State<LoyaltyCoinsCelebrationOverlay> createState() =>
      _LoyaltyCoinsCelebrationOverlayState();
}

class _LoyaltyCoinsCelebrationOverlayState
    extends State<LoyaltyCoinsCelebrationOverlay>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1400),
  );

  @override
  void initState() {
    super.initState();
    _c.forward().whenComplete(() async {
      if (!mounted) return;
      await widget.onComplete();
    });
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.sizeOf(context);
    // RTL bottom nav: "المكافآت" is second tab from the right → ~62% from left edge.
    final target = Offset(size.width * 0.62, size.height - 52);
    const start = Offset(0.5, 0.42);
    return IgnorePointer(
      child: Material(
        color: Colors.black.withValues(alpha: 0.08),
        child: AnimatedBuilder(
          animation: _c,
          builder: (context, _) {
            final t = Curves.easeInOutCubic.transform(_c.value);
            return CustomPaint(
              size: size,
              painter: _CoinsPainter(
                progress: t,
                startFraction: start,
                target: target,
                coinCount: 8,
              ),
            );
          },
        ),
      ),
    );
  }
}

class _CoinsPainter extends CustomPainter {
  _CoinsPainter({
    required this.progress,
    required this.startFraction,
    required this.target,
    required this.coinCount,
  });

  final double progress;
  final Offset startFraction;
  final Offset target;
  final int coinCount;

  @override
  void paint(Canvas canvas, Size size) {
    final start = Offset(
      size.width * startFraction.dx,
      size.height * startFraction.dy,
    );
    for (var i = 0; i < coinCount; i++) {
      final stagger = i / coinCount;
      final t = ((progress - stagger * 0.35) / 0.65).clamp(0.0, 1.0);
      if (t <= 0) continue;
      final ang = (i / coinCount) * 2 * math.pi;
      final wobble = Offset(math.cos(ang) * 12, math.sin(ang) * 10) * (1 - t);
      final p = Offset.lerp(start + wobble, target, t)!;
      final opacity = (1 - t) * 0.85 + 0.15;
      final r = 9.0 + (1 - t) * 4;
      final gold = Color.lerp(
        const Color(0xFFFFE566),
        const Color(0xFFB8860B),
        t,
      )!
          .withValues(alpha: opacity);
      final sh = Paint()
        ..color = Colors.black.withValues(alpha: 0.2 * (1 - t))
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 3);
      canvas.drawCircle(p.translate(1, 2), r, sh);
      canvas.drawCircle(
        p,
        r,
        Paint()..color = gold,
      );
      canvas.drawCircle(
        p,
        r * 0.55,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.2
          ..color = Colors.white.withValues(alpha: 0.45 * opacity),
      );
    }
  }

  @override
  bool shouldRepaint(covariant _CoinsPainter oldDelegate) {
    return oldDelegate.progress != progress;
  }
}

void showLoyaltyCoinsCelebration(
  BuildContext context, {
  required int coinsEarned,
}) {
  final overlay = Overlay.maybeOf(context);
  if (overlay == null) return;
  late OverlayEntry entry;
  entry = OverlayEntry(
    builder: (ctx) => LoyaltyCoinsCelebrationOverlay(
      coinsEarned: coinsEarned,
      onComplete: () async {
        entry.remove();
        if (!ctx.mounted) return;
        try {
          await ctx.read<CoinsBalanceCubit>().load();
        } catch (_) {
          // ignore
        }
        if (!ctx.mounted) return;
        final newBal = ctx.read<CoinsBalanceCubit>().state.balance;
        final balLine = newBal != null ? ' — رصيدك الآن: $newBal' : '';
        ScaffoldMessenger.of(ctx).showSnackBar(
          SnackBar(
            behavior: SnackBarBehavior.floating,
            content: Text(
              'مبروك! ربحت $coinsEarned عملة جديدة 🪙$balLine',
              style: GoogleFonts.cairo(fontWeight: FontWeight.w700),
              textAlign: TextAlign.right,
            ),
          ),
        );
      },
    ),
  );
  overlay.insert(entry);
}
