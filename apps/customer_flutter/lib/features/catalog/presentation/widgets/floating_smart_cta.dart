import 'package:flutter/material.dart';

import '../../../../design_system/design_system.dart';

/// Scroll-aware floating add-to-cart bar — bottom anchored only.
class FloatingSmartCta extends StatefulWidget {
  const FloatingSmartCta({
    super.key,
    required this.scrollController,
    required this.price,
    required this.onPressed,
    this.disabled = false,
    this.missingRequired = false,
    this.loading = false,
    this.scale = 1,
    this.visible = true,
  });

  final ScrollController scrollController;
  final double price;
  final VoidCallback? onPressed;
  final bool disabled;
  final bool missingRequired;
  final bool loading;
  final double scale;
  final bool visible;

  @override
  State<FloatingSmartCta> createState() => _FloatingSmartCtaState();
}

class _FloatingSmartCtaState extends State<FloatingSmartCta> {
  bool _scrollVisible = true;
  double _lastOffset = 0;

  @override
  void initState() {
    super.initState();
    widget.scrollController.addListener(_onScroll);
  }

  @override
  void didUpdateWidget(FloatingSmartCta oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.scrollController != widget.scrollController) {
      oldWidget.scrollController.removeListener(_onScroll);
      widget.scrollController.addListener(_onScroll);
    }
  }

  @override
  void dispose() {
    widget.scrollController.removeListener(_onScroll);
    super.dispose();
  }

  void _onScroll() {
    if (!widget.scrollController.hasClients) return;
    final offset = widget.scrollController.offset;
    final delta = offset - _lastOffset;
    if (delta.abs() < 8) return;

    final nextVisible = delta < 0 || offset <= 24;
    if (nextVisible != _scrollVisible) {
      setState(() => _scrollVisible = nextVisible);
    }
    _lastOffset = offset;
  }

  bool get _canTap =>
      !widget.disabled && !widget.loading && widget.onPressed != null;

  String get _ctaLabel {
    if (widget.loading) return '...';
    if (widget.missingRequired && !widget.disabled) {
      return 'أكمل الاختيارات المطلوبة';
    }
    return 'أضف للسلة';
  }

  @override
  Widget build(BuildContext context) {
    final showDock = widget.visible && _scrollVisible;

    return PremiumFloatingDock(
      visible: showDock,
      child: Padding(
        padding: PremiumDockLayout.margin(context),
        child: Transform.scale(
          scale: widget.scale,
          child: PremiumDockSurface(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(
                PremiumDockLayout.padH,
                PremiumDockLayout.padV,
                PremiumDockLayout.padH,
                PremiumDockLayout.padV,
              ),
              child: Row(
                textDirection: TextDirection.rtl,
                children: [
                  Expanded(
                    flex: 3,
                    child: PremiumDockCta(
                      label: _ctaLabel,
                      loading: widget.loading,
                      enabled: _canTap && !widget.missingRequired,
                      pulseWhenReady:
                          _canTap && !widget.missingRequired && !widget.loading,
                      onPressed: widget.onPressed,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Text(
                    NmdFormat.money(widget.price),
                    style: NmdTypography.price.copyWith(fontSize: 14),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

const double kFloatingProductCtaScrollInset = PremiumDockLayout.scrollInset;
