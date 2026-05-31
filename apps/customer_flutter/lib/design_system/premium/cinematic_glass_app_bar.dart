import 'dart:ui' show ImageFilter;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../tokens/nmd_typography.dart';
import 'premium_marketplace_design_system.dart';

/// Floating glass app bar — transparent at rest, blurs on scroll.
class CinematicGlassAppBar extends StatelessWidget {
  const CinematicGlassAppBar({
    super.key,
    required this.scrollOffset,
    this.title,
    this.leading,
    this.actions = const [],
    this.fullyTransparentAtTop = true,
  });

  final double scrollOffset;
  final String? title;
  final Widget? leading;
  final List<Widget> actions;
  final bool fullyTransparentAtTop;

  static const double barHeight = 56;
  static const double scrollThreshold = 48;

  double get _progress =>
      (scrollOffset / scrollThreshold).clamp(0.0, 1.0);

  @override
  Widget build(BuildContext context) {
    final blur = _progress * 20;
    final bgOpacity = fullyTransparentAtTop ? _progress * 0.72 : 0.55;

    return RepaintBoundary(
      child: ClipRect(
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: blur, sigmaY: blur),
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: Colors.black.withValues(alpha: bgOpacity),
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  Colors.black.withValues(alpha: 0.28 + _progress * 0.18),
                  Colors.transparent,
                ],
                stops: const [0.0, 1.0],
              ),
              border: Border(
                bottom: BorderSide(
                  color: Colors.white.withValues(alpha: _progress * 0.08),
                ),
              ),
            ),
            child: SafeArea(
              bottom: false,
              child: SizedBox(
                height: barHeight,
                child: Padding(
                  padding: const EdgeInsetsDirectional.fromSTEB(12, 4, 14, 4),
                  child: Directionality(
                    textDirection: TextDirection.rtl,
                    child: Row(
                      children: [
                        if (leading != null) leading!,
                        if (title != null && title!.isNotEmpty) ...[
                          const SizedBox(width: 4),
                          Expanded(
                            child: AnimatedOpacity(
                              duration: PremiumMarketplaceDesignSystem.micro,
                              opacity: _progress.clamp(0.0, 1.0),
                              child: Text(
                                title!,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                textAlign: TextAlign.center,
                                style: NmdTypography.label.copyWith(
                                  color: Colors.white.withValues(alpha: 0.92),
                                  fontSize: 14,
                                  fontWeight: FontWeight.w700,
                                  letterSpacing: 0.2,
                                ),
                              ),
                            ),
                          ),
                        ] else
                          const Spacer(),
                        ...actions,
                      ],
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

/// Soft glass icon button for cinematic chrome.
class CinematicGlassIconButton extends StatelessWidget {
  const CinematicGlassIconButton({
    super.key,
    required this.icon,
    required this.onPressed,
    this.size = 40,
  });

  final IconData icon;
  final VoidCallback? onPressed;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onPressed == null
            ? null
            : () {
                HapticFeedback.selectionClick();
                onPressed!();
              },
        borderRadius: BorderRadius.circular(14),
        child: Ink(
          width: size,
          height: size,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            color: Colors.white.withValues(alpha: 0.08),
            border: Border.all(
              color: Colors.white.withValues(alpha: 0.11),
            ),
          ),
          child: Icon(
            icon,
            size: 19,
            color: Colors.white.withValues(alpha: 0.9),
          ),
        ),
      ),
    );
  }
}

/// Tracks vertical scroll and overlays [CinematicGlassAppBar].
class CinematicScrollChrome extends StatefulWidget {
  const CinematicScrollChrome({
    super.key,
    required this.body,
    this.title,
    this.leading,
    this.actions = const [],
    this.scrollController,
    this.backgroundColor = Colors.transparent,
  });

  final Widget body;
  final String? title;
  final Widget? leading;
  final List<Widget> actions;
  final ScrollController? scrollController;
  final Color backgroundColor;

  @override
  State<CinematicScrollChrome> createState() => _CinematicScrollChromeState();
}

class _CinematicScrollChromeState extends State<CinematicScrollChrome> {
  late ScrollController _ctrl;
  double _offset = 0;
  bool _ownsController = false;

  @override
  void initState() {
    super.initState();
    _ownsController = widget.scrollController == null;
    _ctrl = widget.scrollController ?? ScrollController();
    _ctrl.addListener(_onScroll);
  }

  @override
  void didUpdateWidget(covariant CinematicScrollChrome oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.scrollController != widget.scrollController) {
      _ctrl.removeListener(_onScroll);
      if (_ownsController) _ctrl.dispose();
      _ownsController = widget.scrollController == null;
      _ctrl = widget.scrollController ?? ScrollController();
      _ctrl.addListener(_onScroll);
      _offset = _ctrl.hasClients ? _ctrl.offset : 0;
    }
  }

  void _onScroll() {
    if (!_ctrl.hasClients) return;
    final next = _ctrl.offset;
    if ((next - _offset).abs() > 0.5) {
      setState(() => _offset = next);
    }
  }

  @override
  void dispose() {
    _ctrl.removeListener(_onScroll);
    if (_ownsController) _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final content = widget.scrollController == null
        ? PrimaryScrollController(
            controller: _ctrl,
            child: widget.body,
          )
        : widget.body;

    return ColoredBox(
      color: widget.backgroundColor,
      child: Stack(
        fit: StackFit.expand,
        children: [
          NotificationListener<ScrollNotification>(
            onNotification: (n) {
              if (n.metrics.axis == Axis.vertical) {
                final px = n.metrics.pixels;
                if ((px - _offset).abs() > 0.5) {
                  setState(() => _offset = px);
                }
              }
              return false;
            },
            child: content,
          ),
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: CinematicGlassAppBar(
              scrollOffset: _offset,
              title: widget.title,
              leading: widget.leading,
              actions: widget.actions,
            ),
          ),
        ],
      ),
    );
  }
}

/// Glass header row for modal sheets (reward detail).
class CinematicSheetGlassHeader extends StatelessWidget {
  const CinematicSheetGlassHeader({
    super.key,
    required this.onClose,
    this.title,
  });

  final VoidCallback onClose;
  final String? title;

  @override
  Widget build(BuildContext context) {
    return ClipRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 16, sigmaY: 16),
        child: Container(
          padding: EdgeInsets.only(
            top: MediaQuery.paddingOf(context).top + 6,
            left: 14,
            right: 14,
            bottom: 8,
          ),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [
                Colors.black.withValues(alpha: 0.55),
                Colors.transparent,
              ],
            ),
          ),
          child: Row(
            children: [
              CinematicGlassIconButton(
                icon: Icons.close_rounded,
                onPressed: onClose,
              ),
              if (title != null) ...[
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    title!,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    textAlign: TextAlign.right,
                    style: NmdTypography.label.copyWith(
                      color: Colors.white.withValues(alpha: 0.85),
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
