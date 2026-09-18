import 'dart:async';

import 'package:flutter/material.dart';

import '../../../../core/support/support_config.dart';
import '../../../../design_system/design_system.dart';

/// Premium floating support capsule — not a stock FloatingActionButton.
class SupportFloatingCapsule extends StatefulWidget {
  const SupportFloatingCapsule({
    super.key,
    required this.label,
    required this.onTap,
    required this.animationEnabled,
    this.semanticLabel = 'فتح مركز دعم Now Market',
  });

  final String label;
  final VoidCallback onTap;
  final bool animationEnabled;
  final String semanticLabel;

  @override
  State<SupportFloatingCapsule> createState() => _SupportFloatingCapsuleState();
}

class _SupportFloatingCapsuleState extends State<SupportFloatingCapsule>
    with TickerProviderStateMixin {
  late final AnimationController _enter;
  late final AnimationController _breathe;
  late final Animation<double> _fade;
  late final Animation<Offset> _slide;
  late final Animation<double> _enterScale;
  Timer? _breatheTimer;

  @override
  void initState() {
    super.initState();
    _enter = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 320),
    );
    _breathe = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    );
    _fade = CurvedAnimation(parent: _enter, curve: Curves.easeOutCubic);
    _slide = Tween<Offset>(
      begin: const Offset(0, 0.18),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _enter, curve: Curves.easeOutCubic));
    _enterScale = Tween<double>(begin: 0.96, end: 1).animate(
      CurvedAnimation(parent: _enter, curve: Curves.easeOutCubic),
    );
    // Animation must never control basic visibility.
    if (!widget.animationEnabled) {
      _enter.value = 1;
    }
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final reduce = MediaQuery.disableAnimationsOf(context) ||
          (MediaQuery.maybeOf(context)?.accessibleNavigation ?? false);
      if (!widget.animationEnabled || reduce) {
        _enter.value = 1;
      } else if (_enter.value < 1) {
        _enter.forward();
      }
      _scheduleBreathe();
    });
  }

  @override
  void didUpdateWidget(covariant SupportFloatingCapsule oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.animationEnabled != widget.animationEnabled) {
      if (!widget.animationEnabled) {
        _enter.value = 1;
      }
      _scheduleBreathe();
    }
  }

  void _scheduleBreathe() {
    _breatheTimer?.cancel();
    _breatheTimer = null;
    _breathe.stop();
    _breathe.value = 0;
    if (!widget.animationEnabled) return;
    if (!mounted) return;
    if (MediaQuery.disableAnimationsOf(context)) return;
    _breatheTimer = Timer.periodic(const Duration(seconds: 20), (_) {
      if (!mounted) return;
      if (MediaQuery.disableAnimationsOf(context) || !widget.animationEnabled) {
        return;
      }
      _breathe.forward(from: 0).then((_) {
        if (mounted) _breathe.reverse();
      });
    });
  }

  @override
  void dispose() {
    _breatheTimer?.cancel();
    _enter.dispose();
    _breathe.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final breatheScale = Tween<double>(begin: 1, end: 1.025)
        .animate(CurvedAnimation(parent: _breathe, curve: Curves.easeInOut));

    return Semantics(
      button: true,
      label: widget.semanticLabel,
      child: FadeTransition(
        opacity: _fade,
        child: SlideTransition(
          position: _slide,
          child: ScaleTransition(
            scale: _enterScale,
            child: AnimatedBuilder(
              animation: breatheScale,
              builder: (context, child) {
                return Transform.scale(
                  scale: breatheScale.value,
                  child: child,
                );
              },
              child: Material(
                color: Colors.transparent,
                child: InkWell(
                  onTap: widget.onTap,
                  borderRadius: BorderRadius.circular(28),
                  child: Ink(
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(28),
                      gradient: const LinearGradient(
                        begin: Alignment.topRight,
                        end: Alignment.bottomLeft,
                        colors: [
                          NmdColors.brandPrimary,
                          NmdColors.brandDeep,
                        ],
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.12),
                          blurRadius: 10,
                          offset: const Offset(0, 4),
                        ),
                      ],
                      border: Border.all(
                        color: Colors.white.withValues(alpha: 0.18),
                      ),
                    ),
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(
                        minHeight: NmdSizes.touchTarget + 4,
                        minWidth: 48,
                      ),
                      child: Padding(
                        padding: const EdgeInsetsDirectional.fromSTEB(
                          14,
                          10,
                          16,
                          10,
                        ),
                        child: Directionality(
                          textDirection: TextDirection.rtl,
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(
                                Icons.headset_mic_rounded,
                                color: NmdColors.textOnBrand,
                                size: 22,
                              ),
                              const SizedBox(width: 8),
                              Flexible(
                                child: Text(
                                  widget.label,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: NmdTypography.label.copyWith(
                                    color: NmdColors.textOnBrand,
                                    fontWeight: FontWeight.w800,
                                    fontSize: 14,
                                    height: 1.1,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Horizontal alignment helper from [FloatingSupportPosition].
AlignmentDirectional capsuleAlignment(FloatingSupportPosition position) {
  return switch (position) {
    FloatingSupportPosition.logicalStart =>
      AlignmentDirectional.bottomStart,
    FloatingSupportPosition.logicalEnd => AlignmentDirectional.bottomEnd,
  };
}
