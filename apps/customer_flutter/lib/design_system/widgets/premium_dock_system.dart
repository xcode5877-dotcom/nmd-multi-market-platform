import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../tokens/nmd_motion.dart';
import '../tokens/nmd_spacing.dart';
import '../tokens/nmd_typography.dart';
import '../tokens/nmd_colors.dart';

/// Unified premium floating dock system (add-to-cart, cart, checkout).
abstract final class PremiumDockLayout {
  static const double radius = 14;
  static const double ctaRadius = 11;
  static const double ctaHeight = 40;
  static const double padV = 6;
  static const double padH = 10;
  static const double gapAboveNav = 10;
  static const double blurSigma = 10;
  static const double height = padV * 2 + ctaHeight;
  static const double scrollInset = height + gapAboveNav + 6;

  static EdgeInsets margin(
    BuildContext context, {
    double extraBottom = 0,
  }) =>
      EdgeInsets.fromLTRB(
        NmdSpacing.screenHorizontal,
        0,
        NmdSpacing.screenHorizontal,
        gapAboveNav +
            MediaQuery.paddingOf(context).bottom * 0.15 +
            extraBottom,
      );
}

/// Shared dock surface (blur, shadow, radius).
class PremiumDockSurface extends StatelessWidget {
  const PremiumDockSurface({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(PremiumDockLayout.radius),
      child: BackdropFilter(
        filter: ImageFilter.blur(
          sigmaX: PremiumDockLayout.blurSigma,
          sigmaY: PremiumDockLayout.blurSigma,
        ),
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: NmdColors.surfaceBase.withValues(alpha: 0.94),
            borderRadius: BorderRadius.circular(PremiumDockLayout.radius),
            border: Border.all(
              color: NmdColors.borderSubtle.withValues(alpha: 0.4),
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.06),
                blurRadius: 12,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: child,
        ),
      ),
    );
  }
}

/// Scale + haptic CTA with optional ready pulse.
class PremiumDockCta extends StatefulWidget {
  const PremiumDockCta({
    super.key,
    required this.label,
    required this.onPressed,
    this.loading = false,
    this.enabled = true,
    this.pulseWhenReady = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool loading;
  final bool enabled;
  final bool pulseWhenReady;

  @override
  State<PremiumDockCta> createState() => _PremiumDockCtaState();
}

class _PremiumDockCtaState extends State<PremiumDockCta>
    with SingleTickerProviderStateMixin {
  bool _pressed = false;
  late final AnimationController _pulseCtrl;
  late final Animation<double> _pulse;

  @override
  void initState() {
    super.initState();
    _pulseCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    );
    _pulse = Tween<double>(begin: 1, end: 1.018).animate(
      CurvedAnimation(parent: _pulseCtrl, curve: Curves.easeInOut),
    );
    _syncPulse();
  }

  @override
  void didUpdateWidget(PremiumDockCta oldWidget) {
    super.didUpdateWidget(oldWidget);
    _syncPulse();
  }

  void _syncPulse() {
    final shouldPulse =
        widget.pulseWhenReady && widget.enabled && !widget.loading;
    if (shouldPulse && !_pulseCtrl.isAnimating) {
      _pulseCtrl.repeat(reverse: true);
    } else if (!shouldPulse) {
      _pulseCtrl.stop();
      _pulseCtrl.value = 0;
    }
  }

  @override
  void dispose() {
    _pulseCtrl.dispose();
    super.dispose();
  }

  bool get _canTap =>
      widget.enabled && !widget.loading && widget.onPressed != null;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _pulse,
      builder: (context, child) {
        final pulseScale = widget.pulseWhenReady ? _pulse.value : 1.0;
        return Listener(
          onPointerDown:
              _canTap ? (_) => setState(() => _pressed = true) : null,
          onPointerUp:
              _canTap ? (_) => setState(() => _pressed = false) : null,
          onPointerCancel:
              _canTap ? (_) => setState(() => _pressed = false) : null,
          child: AnimatedScale(
            scale: _pressed ? 0.97 : pulseScale,
            duration: NmdMotion.instant,
            curve: NmdMotion.standard,
            child: child,
          ),
        );
      },
      child: SizedBox(
        height: PremiumDockLayout.ctaHeight,
        child: FilledButton(
          onPressed: _canTap
              ? () {
                  HapticFeedback.lightImpact();
                  widget.onPressed?.call();
                }
              : null,
          style: FilledButton.styleFrom(
            backgroundColor: NmdColors.brandPrimary,
            disabledBackgroundColor:
                NmdColors.brandPrimary.withValues(alpha: 0.32),
            foregroundColor: NmdColors.textOnBrand,
            elevation: 0,
            padding: const EdgeInsets.symmetric(horizontal: 10),
            shape: RoundedRectangleBorder(
              borderRadius:
                  BorderRadius.circular(PremiumDockLayout.ctaRadius),
            ),
          ),
          child: widget.loading
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: NmdColors.textOnBrand,
                  ),
                )
              : Text(
                  widget.label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: NmdTypography.button.copyWith(fontSize: 12),
                ),
        ),
      ),
    );
  }
}

/// Bottom-aligned floating dock wrapper — never overlaps header.
class PremiumFloatingDock extends StatelessWidget {
  const PremiumFloatingDock({
    super.key,
    required this.visible,
    required this.child,
  });

  final bool visible;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Positioned(
      left: 0,
      right: 0,
      bottom: 0,
      child: IgnorePointer(
        ignoring: !visible,
        child: AnimatedSlide(
          duration: NmdMotion.fast,
          curve: NmdMotion.standard,
          offset: visible ? Offset.zero : const Offset(0, 1.15),
          child: AnimatedOpacity(
            duration: NmdMotion.fast,
            opacity: visible ? 1 : 0,
            child: child,
          ),
        ),
      ),
    );
  }
}
