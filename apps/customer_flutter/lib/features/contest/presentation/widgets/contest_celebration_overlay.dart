import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lottie/lottie.dart';

import '../../../../app/theme/app_colors.dart';

/// Premium celebration: blurred dark scrim, golden pulsing card, Lottie trophy/gift,
/// slide-up copy, tap-to-dismiss with flight toward bottom nav (activity / rewards).
Future<void> showContestCelebration({
  required BuildContext context,
  required int httpStatus,
  required Map<String, dynamic> responseBody,
  required bool isPredictionContest,
  required bool isQuizContest,
}) async {
  if (httpStatus < 200 || httpStatus >= 300) return;
  if (!context.mounted) return;

  await Navigator.of(context, rootNavigator: true).push<void>(
    PageRouteBuilder<void>(
      opaque: false,
      barrierDismissible: false,
      barrierColor: Colors.transparent,
      transitionDuration: const Duration(milliseconds: 420),
      reverseTransitionDuration: const Duration(milliseconds: 280),
      pageBuilder: (ctx, animation, secondary) {
        final curved = CurvedAnimation(
          parent: animation,
          curve: Curves.easeOutCubic,
          reverseCurve: Curves.easeInCubic,
        );
        return FadeTransition(
          opacity: curved,
          child: ScaleTransition(
            scale: Tween<double>(begin: 0.92, end: 1).animate(curved),
            child: _ContestCelebrationPage(
              responseBody: responseBody,
              isPredictionContest: isPredictionContest,
              isQuizContest: isQuizContest,
              openAnimation: curved,
            ),
          ),
        );
      },
    ),
  );
}

bool contestResponseIndicatesWin(Map<String, dynamic> body) {
  if (body['correct'] == true) return true;
  if (body['won'] == true) return true;
  if (body['isWinner'] == true) return true;
  return false;
}

class _ContestCelebrationPage extends StatefulWidget {
  const _ContestCelebrationPage({
    required this.responseBody,
    required this.isPredictionContest,
    required this.isQuizContest,
    required this.openAnimation,
  });

  final Map<String, dynamic> responseBody;
  final bool isPredictionContest;
  final bool isQuizContest;
  final Animation<double> openAnimation;

  @override
  State<_ContestCelebrationPage> createState() =>
      _ContestCelebrationPageState();
}

class _ContestCelebrationPageState extends State<_ContestCelebrationPage>
    with TickerProviderStateMixin {
  late final AnimationController _pulseController;
  late final AnimationController _textRevealController;
  late final AnimationController _exitController;

  late final Animation<double> _glowPulse;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1800),
    )..repeat(reverse: true);
    _glowPulse = CurvedAnimation(
      parent: _pulseController,
      curve: Curves.easeInOutCubic,
    );

    _textRevealController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 520),
    );

    _exitController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 520),
    );

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      Future<void>.delayed(const Duration(milliseconds: 120), () {
        if (mounted) _textRevealController.forward();
      });
    });
  }

  @override
  void dispose() {
    _pulseController.dispose();
    _textRevealController.dispose();
    _exitController.dispose();
    super.dispose();
  }

  Future<void> _dismissWithExit() async {
    if (!mounted) return;
    if (_exitController.isAnimating || _exitController.value > 0) return;
    await _exitController.forward();
    if (!mounted) return;
    Navigator.of(context).pop();
  }

  String _successMessage(bool showWinningDialog, bool showPredictionBanner) {
    if (showWinningDialog) {
      return 'جوابك صح! رح نبعثلك رسالة بالجائزة قريباً 🎁';
    }
    if (showPredictionBanner) {
      return 'تم تسجيل توقعك.. فالك الربح! 🚀';
    }
    return 'تم تسجيل مشاركتك — فالك الفوز!';
  }

  @override
  Widget build(BuildContext context) {
    final won = contestResponseIndicatesWin(widget.responseBody);
    final showWinningDialog =
        widget.isQuizContest && won && !widget.isPredictionContest;
    final showPredictionBanner = widget.isPredictionContest;

    final size = MediaQuery.sizeOf(context);
    // RTL: fly toward bottom area where rewards / activity live (slightly left of center).
    final flightTarget = Offset(-size.width * 0.18, size.height * 0.42);

    return AnimatedBuilder(
      animation: Listenable.merge([widget.openAnimation, _exitController]),
      builder: (context, child) {
        final exitT = Curves.easeInCubic.transform(
          _exitController.value.clamp(0.0, 1.0),
        );
        final overlayOpacity =
            (widget.openAnimation.value * (1 - exitT)).clamp(0.0, 1.0);

        return Material(
          color: Colors.transparent,
          child: Stack(
            fit: StackFit.expand,
            children: [
              // Blurred dark overlay
              Opacity(
                opacity: overlayOpacity,
                child: BackdropFilter(
                  filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
                  child: ColoredBox(
                    color: Colors.black.withValues(alpha: 0.58),
                  ),
                ),
              ),
              Center(
                child: _buildHeroCard(
                  context: context,
                  showWinningDialog: showWinningDialog,
                  showPredictionBanner: showPredictionBanner,
                  flightTarget: flightTarget,
                  exitT: exitT,
                ),
              ),
              // On top: tap anywhere (including over the card) to dismiss with exit flight.
              Positioned.fill(
                child: GestureDetector(
                  behavior: HitTestBehavior.translucent,
                  onTap: _dismissWithExit,
                  child: const SizedBox.expand(),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildHeroCard({
    required BuildContext context,
    required bool showWinningDialog,
    required bool showPredictionBanner,
    required Offset flightTarget,
    required double exitT,
  }) {
    // Exit-only scale: route [ScaleTransition] + [FadeTransition] handle enter.
    final scale = Tween<double>(begin: 1, end: 0.12).transform(exitT);

    final slideEnter = Tween<Offset>(
      begin: const Offset(0, 0.06),
      end: Offset.zero,
    ).transform(Curves.easeOutCubic.transform(widget.openAnimation.value));

    final flight = Offset.lerp(Offset.zero, flightTarget, exitT)!;
    final h = MediaQuery.sizeOf(context).height;

    return Transform.translate(
      offset: flight + Offset(0, slideEnter.dy * h),
      child: Transform.scale(
        scale: scale,
        alignment: Alignment.center,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            _LottieHero(),
            const SizedBox(height: 22),
            _GoldenWinningCard(
              glowPulse: _glowPulse,
              goldStrong: showWinningDialog,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  SlideTransition(
                    position: Tween<Offset>(
                      begin: const Offset(0, 0.35),
                      end: Offset.zero,
                    ).animate(
                      CurvedAnimation(
                        parent: _textRevealController,
                        curve: Curves.easeOutCubic,
                      ),
                    ),
                    child: FadeTransition(
                      opacity: _textRevealController,
                      child: Text(
                        _successMessage(
                          showWinningDialog,
                          showPredictionBanner,
                        ),
                        textAlign: TextAlign.center,
                        style: GoogleFonts.cairo(
                          fontSize: 17,
                          fontWeight: FontWeight.w800,
                          height: 1.45,
                          color: showWinningDialog
                              ? Colors.white
                              : AppColors.textPrimary,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Lottie asset (gift / celebration) with graceful fallback.
class _LottieHero extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 132,
      width: 132,
      child: Lottie.asset(
        'assets/lottie/contest_celebration.json',
        fit: BoxFit.contain,
        repeat: true,
        errorBuilder: (_, __, ___) => Icon(
          Icons.emoji_events_rounded,
          size: 96,
          color: const Color(0xFFD4AF37),
          shadows: [
            Shadow(
              color: const Color(0xFFD4AF37).withValues(alpha: 0.65),
              blurRadius: 28,
            ),
          ],
        ),
      ),
    );
  }
}

class _GoldenWinningCard extends StatelessWidget {
  const _GoldenWinningCard({
    required this.glowPulse,
    required this.goldStrong,
    required this.child,
  });

  final Animation<double> glowPulse;
  final bool goldStrong;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: glowPulse,
      builder: (context, child) {
        final g = 0.55 + 0.45 * glowPulse.value;
        final blur = 18 + 14 * glowPulse.value;
        return Container(
          constraints: const BoxConstraints(maxWidth: 340),
          padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 24),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(26),
            gradient: goldStrong
                ? LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [
                      const Color(0xFF2DD4BF).withValues(alpha: 0.95),
                      AppColors.shellTeal,
                    ],
                  )
                : const LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [
                      Color(0xFFFFF8E7),
                      Color(0xFFFFE8A3),
                      Color(0xFFD4AF37),
                    ],
                  ),
            border: Border.all(
              color: const Color(0xFFFFE066).withValues(alpha: 0.85 * g),
              width: 1.2,
            ),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFFD4AF37).withValues(alpha: 0.55 * g),
                blurRadius: blur,
                spreadRadius: 2 + 3 * glowPulse.value,
                offset: const Offset(0, 10),
              ),
              BoxShadow(
                color: Colors.white.withValues(alpha: 0.35 * g),
                blurRadius: 12,
                spreadRadius: -2,
                offset: const Offset(0, -4),
              ),
            ],
          ),
          child: child,
        );
      },
      child: child,
    );
  }
}
