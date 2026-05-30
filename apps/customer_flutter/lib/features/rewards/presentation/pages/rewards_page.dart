import 'dart:ui' show ImageFilter;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/auth/ensure_customer_auth.dart';
import '../../../../core/errors/app_error_mapper.dart';
import '../../../../widgets/app_error_view.dart';
import '../../../../design_system/design_system.dart';
import '../../../auth/presentation/bloc/auth_bloc.dart';
import '../../../loyalty/application/coins_balance_cubit.dart';
import '../../application/rewards_cubit.dart';
import '../../data/reward_item.dart';

class RewardsPage extends StatefulWidget {
  const RewardsPage({super.key});

  @override
  State<RewardsPage> createState() => _RewardsPageState();
}

class _RewardsPageState extends State<RewardsPage> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      context.read<CoinsBalanceCubit>().load();
    });
  }

  @override
  Widget build(BuildContext context) {
    return BlocListener<RewardsCubit, RewardsState>(
      listenWhen: (p, c) =>
          p.status != c.status && c.status == RewardsStatus.failure,
      listener: (context, state) {
        if (state.errorMessage != null) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(state.errorMessage!)),
          );
        }
      },
      child: const _RewardsBody(),
    );
  }
}

class _RewardsBody extends StatelessWidget {
  const _RewardsBody();

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<RewardsCubit, RewardsState>(
      builder: (context, state) {
        switch (state.status) {
          case RewardsStatus.initial:
          case RewardsStatus.loading:
            return const ColoredBox(
              color: NmdColors.surfaceCommunity,
              child: NmdLoading(
                fullscreen: true,
                message: 'جاري تحميل المكافآت...',
                size: NmdLoadingSize.large,
              ),
            );
          case RewardsStatus.failure:
            return ColoredBox(
              color: NmdColors.surfaceCommunity,
              child: Center(
                child: Padding(
                  padding: const EdgeInsets.all(NmdSpacing.xl),
                  child: NmdCard(
                    child: AppErrorView(
                    title: 'تعذّر تحميل المكافآت',
                    message: state.errorMessage ?? AppErrorMapper.unknownMessage,
                    compact: true,
                    onRetry: () => context.read<RewardsCubit>().load(),
                  ),
                  ),
                ),
              ),
            );
          case RewardsStatus.loaded:
            return ColoredBox(
              color: NmdColors.surfaceCommunity,
              child: RefreshIndicator(
                color: NmdColors.brandPrimary,
                onRefresh: () async {
                  await Future.wait([
                    context.read<RewardsCubit>().load(),
                    context.read<CoinsBalanceCubit>().load(),
                  ]);
                },
                child: CustomScrollView(
                  primary: true,
                  physics: const AlwaysScrollableScrollPhysics(
                    parent: BouncingScrollPhysics(),
                  ),
                  slivers: [
                    const SliverToBoxAdapter(
                      child: Padding(
                        padding: EdgeInsets.fromLTRB(
                          NmdSpacing.screenHorizontal,
                          NmdSpacing.md,
                          NmdSpacing.screenHorizontal,
                          NmdSpacing.xs,
                        ),
                        child: _RewardsCommunityHeader(),
                      ),
                    ),
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(
                          NmdSpacing.screenHorizontal,
                          NmdSpacing.xs,
                          NmdSpacing.screenHorizontal,
                          NmdSpacing.sm,
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: const [
                            _PremiumGlassBalanceCard(),
                            SizedBox(height: NmdSpacing.sm),
                            _LoyaltyTierProgressSection(),
                            SizedBox(height: NmdSpacing.sm),
                            _CommunityParticipationStrip(),
                          ],
                        ),
                      ),
                    ),
                    SliverToBoxAdapter(
                      child: _FilterChipsRow(
                        selected: state.filter,
                        onSelect: context.read<RewardsCubit>().setFilter,
                      ),
                    ),
                    if (state.filteredRewards.isNotEmpty)
                      SliverToBoxAdapter(
                        child: Padding(
                          padding: const EdgeInsetsDirectional.fromSTEB(
                            NmdSpacing.screenHorizontal,
                            NmdSpacing.xs,
                            NmdSpacing.screenHorizontal,
                            NmdSpacing.xs,
                          ),
                          child: Align(
                            alignment: AlignmentDirectional.centerEnd,
                            child: NmdBadge(
                              label:
                                  '${state.filteredRewards.length} مكافأة متاحة',
                              tone: NmdBadgeTone.neutral,
                              compact: true,
                            ),
                          ),
                        ),
                      ),
                    if (state.filteredRewards.isEmpty)
                      SliverFillRemaining(
                        hasScrollBody: false,
                        child: _RewardsFilteredEmptyState(filter: state.filter),
                      )
                    else
                      SliverPadding(
                        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                        sliver: SliverList(
                          delegate: SliverChildBuilderDelegate(
                            (context, index) {
                              final r = state.filteredRewards[index];
                              final authBloc = context.watch<AuthBloc>().state;
                              final coins =
                                  context.watch<CoinsBalanceCubit>().state;
                              final isAuth = authBloc.step == AuthStep.done ||
                                  coins.isAuthenticated;
                              return Padding(
                                padding: const EdgeInsets.only(bottom: 12),
                                child: _TicketRewardCard(
                                  item: r,
                                  balance: coins.balance,
                                  isAuthenticated: isAuth,
                                  redeeming: state.redeemingId == r.id,
                                ),
                              );
                            },
                            childCount: state.filteredRewards.length,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            );
        }
      },
    );
  }
}

/// Community identity header — emotional copy, no fabricated balances.
class _RewardsCommunityHeader extends StatelessWidget {
  const _RewardsCommunityHeader();

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'مجتمع المكافآت',
            style: NmdTypography.h1.copyWith(color: NmdColors.textOnDark),
            textAlign: TextAlign.right,
          ),
          const SizedBox(height: NmdSpacing.xxs),
          Text(
            'كل طلب وكل مشاركة تقرّبك من مكافآت حقيقية في سوقك المحلي',
            style: NmdTypography.bodySmall.copyWith(
              color: NmdColors.textOnDark.withValues(alpha: 0.72),
            ),
            textAlign: TextAlign.right,
          ),
          const SizedBox(height: NmdSpacing.sm),
          const Wrap(
            spacing: NmdSpacing.xs,
            runSpacing: NmdSpacing.xs,
            alignment: WrapAlignment.end,
            children: [
              NmdBadge(
                label: 'مجتمع Now Market',
                tone: NmdBadgeTone.brand,
                compact: true,
              ),
              NmdBadge(
                label: 'عملات قابلة للاستبدال',
                tone: NmdBadgeTone.gold,
                compact: true,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Participation copy only — explains earning without inventing transactions.
class _CommunityParticipationStrip extends StatelessWidget {
  const _CommunityParticipationStrip();

  @override
  Widget build(BuildContext context) {
    return NmdCard(
      variant: NmdCardVariant.community,
      padding: const EdgeInsets.all(NmdSpacing.md),
      child: Directionality(
        textDirection: TextDirection.rtl,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: NmdColors.brandPrimary.withValues(alpha: 0.35),
              ),
              child: const Icon(
                Icons.groups_rounded,
                color: NmdColors.brandSecondary,
                size: 26,
              ),
            ),
            const SizedBox(width: NmdSpacing.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'شارك واحصل',
                    style:
                        NmdTypography.h3.copyWith(color: NmdColors.textOnDark),
                  ),
                  const SizedBox(height: NmdSpacing.xxs),
                  Text(
                    'تجمّع العملات من التسوق والنشاط في السوق — واستبدلها بعروض حصرية للمجتمع.',
                    style: NmdTypography.bodySmall.copyWith(
                      color: NmdColors.textOnDark.withValues(alpha: 0.7),
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

class _RewardsFilteredEmptyState extends StatelessWidget {
  const _RewardsFilteredEmptyState({required this.filter});

  final RewardFilter filter;

  @override
  Widget build(BuildContext context) {
    final scope = _filterScopeLabelAr(filter);
    return ColoredBox(
      color: NmdColors.surfaceCommunity,
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(NmdSpacing.xl),
          child: NmdCard(
            child: NmdEmptyState(
              icon: Icons.auto_awesome_outlined,
              title: 'القاعة تنتظر جوائزك',
              message:
                  'لا توجد مكافآت في «$scope» حالياً — استمر بجمع العملات، وستُضاف عروض جديدة قريباً.',
            ),
          ),
        ),
      ),
    );
  }
}

/// Premium balance card — RTL: badge top-right, label + [amount][orange coin] row (web parity).
class _PremiumGlassBalanceCard extends StatelessWidget {
  const _PremiumGlassBalanceCard();

  static const _gold = NmdColors.accentGold;
  static const _slate = Color(0xFF0C1222);
  static const _teal = NmdColors.brandPrimary;

  @override
  Widget build(BuildContext context) {
    final coins = context.watch<CoinsBalanceCubit>().state;
    final balance = coins.balance ?? 0;
    final authBlocDone = context.watch<AuthBloc>().state.step == AuthStep.done;
    final loggedIn = coins.isAuthenticated || authBlocDone;
    final tier = loggedIn ? loyaltyTierLabel(balance) : null;

    return ClipRRect(
      borderRadius: BorderRadius.circular(28),
      child: SizedBox(
        height: 232,
        width: double.infinity,
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            Positioned.fill(
              child: Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [
                      _gold.withValues(alpha: 0.42),
                      _teal.withValues(alpha: 0.9),
                      _slate,
                    ],
                    stops: const [0.0, 0.38, 0.92],
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: _teal.withValues(alpha: 0.5),
                      blurRadius: 56,
                      offset: const Offset(0, 28),
                      spreadRadius: -16,
                    ),
                    BoxShadow(
                      color: _gold.withValues(alpha: 0.12),
                      blurRadius: 40,
                      offset: const Offset(0, 12),
                    ),
                    BoxShadow(
                      color: Colors.white.withValues(alpha: 0.06),
                      blurRadius: 0,
                      spreadRadius: 1,
                    ),
                  ],
                ),
              ),
            ),
            Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: RadialGradient(
                    center: Alignment.topRight,
                    radius: 1.15,
                    colors: [
                      const Color(0x38FDE047),
                      Colors.transparent,
                    ],
                  ),
                ),
              ),
            ),
            Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: RadialGradient(
                    center: Alignment.bottomLeft,
                    radius: 1.0,
                    colors: [
                      AppColors.secondaryTeal.withValues(alpha: 0.18),
                      Colors.transparent,
                    ],
                  ),
                ),
              ),
            ),
            Positioned.fill(
              child: CustomPaint(
                painter: _BalanceWaveBlendPainter(),
              ),
            ),
            Positioned(
              top: 0,
              left: 0,
              right: 0,
              height: 112,
              child: ClipRect(
                child: BackdropFilter(
                  filter: ImageFilter.blur(sigmaX: 24, sigmaY: 24),
                  child: Container(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          Colors.white.withValues(alpha: 0.12),
                          Colors.white.withValues(alpha: 0.02),
                          Colors.transparent,
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
            Positioned(
              left: -36,
              top: -8,
              child: IgnorePointer(
                child: Container(
                  width: 140,
                  height: 140,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: RadialGradient(
                      colors: [
                        Colors.amber.shade400.withValues(alpha: 0.15),
                        Colors.transparent,
                      ],
                    ),
                  ),
                ),
              ),
            ),
            Positioned(
              right: -20,
              bottom: -36,
              child: IgnorePointer(
                child: Container(
                  width: 160,
                  height: 160,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: RadialGradient(
                      colors: [
                        AppColors.secondaryTeal.withValues(alpha: 0.12),
                        Colors.transparent,
                      ],
                    ),
                  ),
                ),
              ),
            ),
            Positioned(
              top: 16,
              right: 16,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  const NmdBadge(
                    label: 'نادي الولاء',
                    tone: NmdBadgeTone.gold,
                    compact: true,
                  ),
                  const SizedBox(height: NmdSpacing.xxs),
                  Text(
                    'NMD',
                    style: NmdTypography.micro.copyWith(
                      color: NmdColors.textOnDark.withValues(alpha: 0.45),
                    ),
                  ),
                  if (tier != null) ...[
                    const SizedBox(height: 2),
                    NmdBadge(
                      label: tier,
                      tone: NmdBadgeTone.neutral,
                      compact: true,
                    ),
                  ],
                ],
              ),
            ),
            // Content: vertically centered below badge — label tight above one RTL row [value][icon]
            Positioned(
              top: 68,
              left: 0,
              right: 0,
              bottom: 0,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(22, 0, 22, 14),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        Text(
                          'الرصيد الحالي',
                          textAlign: TextAlign.center,
                          style: GoogleFonts.cairo(
                            color: Colors.white.withValues(alpha: 0.92),
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 0.2,
                          ).merge(const TextStyle(
                            height: 1.0,
                            leadingDistribution: TextLeadingDistribution.even,
                          )),
                        ),
                        const SizedBox(height: 5),
                        IntrinsicHeight(
                          child: Row(
                            textDirection: TextDirection.rtl,
                            mainAxisSize: MainAxisSize.min,
                            crossAxisAlignment: CrossAxisAlignment.center,
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              if (loggedIn)
                                _AnimatedPointsCounter(points: balance)
                              else
                                const _BalancePlaceholderDashes(),
                              const SizedBox(width: 10),
                              const _OrangeCurrencyTile(),
                            ],
                          ),
                        ),
                      ],
                    ),
                    if (!loggedIn) ...[
                      const SizedBox(height: 10),
                      Align(
                        alignment: Alignment.center,
                        child: TextButton(
                          onPressed: () async {
                            final ok = await ensureCustomerAuth(context);
                            if (!context.mounted || !ok) return;
                            await Future.wait([
                              context.read<RewardsCubit>().load(),
                              context.read<CoinsBalanceCubit>().load(),
                            ]);
                          },
                          style: TextButton.styleFrom(
                            padding: EdgeInsets.zero,
                            minimumSize: Size.zero,
                            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                            foregroundColor: Colors.amber.shade100,
                          ),
                          child: Text(
                            'سجّل الدخول لعرض رصيدك',
                            style: GoogleFonts.cairo(
                              decoration: TextDecoration.underline,
                              fontSize: 14,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Web parity: progress toward next loyalty tier (فضي → ذهبي → VIP).
class _LoyaltyTierProgressSection extends StatelessWidget {
  const _LoyaltyTierProgressSection();

  @override
  Widget build(BuildContext context) {
    final coins = context.watch<CoinsBalanceCubit>().state;
    final authBlocDone = context.watch<AuthBloc>().state.step == AuthStep.done;
    final loggedIn = coins.isAuthenticated || authBlocDone;
    if (!loggedIn) {
      return const SizedBox.shrink();
    }
    final b = coins.balance ?? 0;
    final p = loyaltyTierProgressForBalance(b);
    return NmdSurface(
      mode: NmdSurfaceMode.community,
      padding: const EdgeInsets.fromLTRB(
        NmdSpacing.md,
        NmdSpacing.sm,
        NmdSpacing.md,
        NmdSpacing.md,
      ),
      borderRadius: NmdRadius.borderMd,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            textDirection: TextDirection.rtl,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'التقدّم للمستوى التالي',
                style: NmdTypography.label.copyWith(
                  color: NmdColors.textOnDark.withValues(alpha: 0.85),
                ),
              ),
              NmdBadge(
                label: p.isMaxTier
                    ? 'أعلى مستوى'
                    : '${(p.fraction * 100).round()}%',
                tone: NmdBadgeTone.gold,
                compact: true,
              ),
            ],
          ),
          const SizedBox(height: NmdSpacing.sm),
          ClipRRect(
            borderRadius: NmdRadius.borderPill,
            child: LinearProgressIndicator(
              value: p.isMaxTier ? 1.0 : p.fraction.clamp(0.0, 1.0),
              minHeight: 8,
              backgroundColor: Colors.white.withValues(alpha: 0.08),
              color: NmdColors.brandSecondary,
            ),
          ),
          const SizedBox(height: NmdSpacing.sm),
          Text(
            p.isMaxTier
                ? 'أنت في مستوى VIP — شكراً لمشاركتك في مجتمع Now Market'
                : 'المستوى الحالي: ${p.currentTierAr} — باقي ${p.coinsToNext} عملة للوصول إلى ${p.nextTierAr} (${p.nextThreshold} عملة)',
            textAlign: TextAlign.right,
            style: NmdTypography.bodySmall.copyWith(
              color: NmdColors.textOnDark.withValues(alpha: 0.55),
            ),
          ),
        ],
      ),
    );
  }
}

/// Same visual weight as [_AnimatedPointsCounter] for a cohesive placeholder row.
class _BalancePlaceholderDashes extends StatelessWidget {
  const _BalancePlaceholderDashes();

  @override
  Widget build(BuildContext context) {
    return Text(
      '———',
      textAlign: TextAlign.center,
      textHeightBehavior: const TextHeightBehavior(
        applyHeightToFirstAscent: false,
        applyHeightToLastDescent: false,
      ),
      strutStyle: const StrutStyle(
        fontSize: 38,
        height: 1.0,
        forceStrutHeight: true,
      ),
      style: GoogleFonts.cairo(
        color: Colors.white,
        fontSize: 38,
        fontWeight: FontWeight.w900,
        letterSpacing: 1,
        shadows: const [
          Shadow(
            color: Color(0x66000000),
            blurRadius: 14,
            offset: Offset(0, 2),
          ),
        ],
      ).merge(const TextStyle(
        height: 1.0,
        leadingDistribution: TextLeadingDistribution.even,
      )),
    );
  }
}

/// Soft wave + darkening at bottom so the card blends like the web hero.
class _BalanceWaveBlendPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final h = size.height;
    final w = size.width;
    final path = Path()
      ..moveTo(0, h * 0.42)
      ..cubicTo(
        w * 0.2,
        h * 0.52,
        w * 0.35,
        h * 0.38,
        w * 0.52,
        h * 0.48,
      )
      ..cubicTo(
        w * 0.68,
        h * 0.58,
        w * 0.82,
        h * 0.44,
        w,
        h * 0.5,
      )
      ..lineTo(w, h)
      ..lineTo(0, h)
      ..close();

    final paint = Paint()
      ..shader = LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [
          const Color(0xFF0F172A).withValues(alpha: 0.0),
          const Color(0xFF020617).withValues(alpha: 0.88),
        ],
        stops: const [0.2, 1.0],
      ).createShader(Rect.fromLTWH(0, 0, w, h));

    canvas.drawPath(path, paint);

    final stroke = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.2
      ..shader = LinearGradient(
        colors: [
          const Color(0xFFFFE082).withValues(alpha: 0.35),
          const Color(0xFF14B8A6).withValues(alpha: 0.25),
        ],
      ).createShader(Rect.fromLTWH(0, h * 0.4, w, h * 0.2));

    final curvePath = Path()
      ..moveTo(0, h * 0.44)
      ..cubicTo(
        w * 0.22,
        h * 0.54,
        w * 0.38,
        h * 0.4,
        w * 0.52,
        h * 0.49,
      )
      ..cubicTo(
        w * 0.7,
        h * 0.6,
        w * 0.85,
        h * 0.42,
        w,
        h * 0.5,
      );
    canvas.drawPath(curvePath, stroke);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class _AnimatedPointsCounter extends StatelessWidget {
  const _AnimatedPointsCounter({required this.points});

  final int points;

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<int>(
      tween: IntTween(begin: 0, end: points),
      duration: const Duration(milliseconds: 1200),
      curve: Curves.easeOutCubic,
      builder: (context, value, child) {
        return Text(
          value.toString().replaceAllMapped(
                RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'),
                (m) => '${m[1]},',
              ),
          textHeightBehavior: const TextHeightBehavior(
            applyHeightToFirstAscent: false,
            applyHeightToLastDescent: false,
          ),
          strutStyle: const StrutStyle(
            fontSize: 38,
            height: 1.0,
            forceStrutHeight: true,
          ),
          style: GoogleFonts.cairo(
            color: Colors.white,
            fontSize: 38,
            fontWeight: FontWeight.w900,
            letterSpacing: 0.35,
            shadows: const [
              Shadow(
                color: Color(0x59000000),
                blurRadius: 16,
                offset: Offset(0, 2),
              ),
            ],
          ).merge(const TextStyle(
            height: 1.0,
            leadingDistribution: TextLeadingDistribution.even,
          )),
        );
      },
    );
  }
}

/// Orange currency tile — proportional to balance text (~42dp); RTL row [amount][this].
class _OrangeCurrencyTile extends StatelessWidget {
  const _OrangeCurrencyTile();

  static const double _side = 42;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: _side,
      height: _side,
      child: DecoratedBox(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          gradient: const LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              Color(0xFFFFEDD5),
              Color(0xFFFB923C),
              Color(0xFFC2410C),
            ],
          ),
          border: Border.all(
            color: Colors.orange.shade200.withValues(alpha: 0.45),
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.deepOrange.withValues(alpha: 0.38),
              blurRadius: 12,
              offset: const Offset(0, 4),
            ),
            BoxShadow(
              color: Colors.white.withValues(alpha: 0.2),
              blurRadius: 0,
              offset: const Offset(0, 1),
              spreadRadius: -1,
            ),
          ],
        ),
        child: const Center(
          child: Icon(
            Icons.monetization_on_rounded,
            size: 22,
            color: Colors.white,
            shadows: [
              Shadow(
                color: Color(0x4D000000),
                blurRadius: 6,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

String _filterScopeLabelAr(RewardFilter f) {
  switch (f) {
    case RewardFilter.all:
      return 'كل العروض';
    case RewardFilter.tournaments:
      return 'البطولات';
    case RewardFilter.coupons:
      return 'القسائم';
    case RewardFilter.prizes:
      return 'الجوائز';
  }
}

class _FilterChipsRow extends StatelessWidget {
  const _FilterChipsRow({
    required this.selected,
    required this.onSelect,
  });

  final RewardFilter selected;
  final ValueChanged<RewardFilter> onSelect;

  static const _items = <(RewardFilter, IconData, String)>[
    (RewardFilter.all, Icons.grid_view_rounded, 'الكل'),
    (RewardFilter.tournaments, Icons.emoji_events_outlined, 'البطولات'),
    (RewardFilter.coupons, Icons.confirmation_number_outlined, 'القسائم'),
    (RewardFilter.prizes, Icons.card_giftcard_outlined, 'الجوائز'),
  ];

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Padding(
            padding: const EdgeInsetsDirectional.only(
              start: NmdSpacing.screenHorizontal,
              end: NmdSpacing.screenHorizontal,
              bottom: NmdSpacing.xs,
            ),
            child: Text(
              'اكتشف مكافآت المجتمع',
              textAlign: TextAlign.right,
              style: NmdTypography.label.copyWith(
                color: NmdColors.brandSecondary.withValues(alpha: 0.9),
              ),
            ),
          ),
          SizedBox(
            height: 52,
            child: Directionality(
              textDirection: TextDirection.rtl,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                primary: false,
                shrinkWrap: true,
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
                itemCount: _items.length,
                separatorBuilder: (_, __) => const SizedBox(width: 12),
                itemBuilder: (context, i) {
                  final (filter, icon, label) = _items[i];
                  final isSel = selected == filter;
                  return _GlowTealFilterPill(
                    icon: icon,
                    label: label,
                    selected: isSel,
                    isAllFilter: filter == RewardFilter.all,
                    onTap: () => onSelect(filter),
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _GlowTealFilterPill extends StatelessWidget {
  const _GlowTealFilterPill({
    required this.icon,
    required this.label,
    required this.selected,
    required this.onTap,
    this.isAllFilter = false,
  });

  final IconData icon;
  final String label;
  final bool selected;
  final bool isAllFilter;
  final VoidCallback onTap;

  static const double _r = 999;

  @override
  Widget build(BuildContext context) {
    final premiumAll = selected && isAllFilter;
    final glow = AppColors.secondaryTeal.withValues(alpha: 0.55);
    final borderRadius = BorderRadius.circular(_r);
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: DecoratedBox(
        decoration: BoxDecoration(
          borderRadius: borderRadius,
          color: Colors.transparent,
          boxShadow: selected
              ? [
                  if (premiumAll) ...[
                    BoxShadow(
                      color: const Color(0xFFFDE047).withValues(alpha: 0.35),
                      blurRadius: 26,
                      spreadRadius: -2,
                      offset: const Offset(0, 2),
                    ),
                    BoxShadow(
                      color: Colors.amber.shade700.withValues(alpha: 0.25),
                      blurRadius: 18,
                      offset: const Offset(0, 4),
                    ),
                  ],
                  BoxShadow(
                    color: glow,
                    blurRadius: 18,
                    spreadRadius: 0,
                    offset: const Offset(0, 4),
                  ),
                  BoxShadow(
                    color: AppColors.primaryTeal.withValues(alpha: 0.35),
                    blurRadius: 28,
                    spreadRadius: -2,
                  ),
                ]
              : [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.25),
                    blurRadius: 8,
                    offset: const Offset(0, 3),
                  ),
                ],
        ),
        child: ClipRRect(
          borderRadius: borderRadius,
          clipBehavior: Clip.antiAlias,
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 14, sigmaY: 14),
            child: DecoratedBox(
              decoration: BoxDecoration(
                borderRadius: borderRadius,
                border: Border.all(
                  color: premiumAll
                      ? Colors.amber.shade200.withValues(alpha: 0.45)
                      : selected
                          ? AppColors.secondaryTeal.withValues(alpha: 0.65)
                          : Colors.white.withValues(alpha: 0.12),
                  width: selected ? 1.5 : 1,
                ),
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: premiumAll
                      ? [
                          const Color(0xFF14B8A6),
                          AppColors.primaryTeal,
                          const Color(0xFF065F46),
                        ]
                      : selected
                          ? [
                              AppColors.primaryTeal.withValues(alpha: 0.92),
                              AppColors.primaryTeal.withValues(alpha: 0.75),
                            ]
                          : [
                              Colors.white.withValues(alpha: 0.09),
                              Colors.white.withValues(alpha: 0.04),
                            ],
                ),
              ),
              child: Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      icon,
                      size: 18,
                      color: premiumAll
                          ? Colors.amber.shade100
                          : selected
                              ? Colors.white
                              : Colors.white70,
                      shadows: premiumAll
                          ? [
                              Shadow(
                                color: Colors.amber.shade200
                                    .withValues(alpha: 0.9),
                                blurRadius: 10,
                              ),
                            ]
                          : null,
                    ),
                    const SizedBox(width: 8),
                    Text(
                      label,
                      style: GoogleFonts.cairo(
                        fontSize: 13,
                        fontWeight:
                            selected ? FontWeight.w800 : FontWeight.w600,
                        color: selected ? Colors.white : Colors.white70,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Admin image on top; teal gradient fallback when missing.
class _RewardTicketHeroImage extends StatelessWidget {
  const _RewardTicketHeroImage({required this.imageUrl});

  final String? imageUrl;

  static const _h = 148.0;

  @override
  Widget build(BuildContext context) {
    final u = imageUrl?.trim();
    if (u != null && u.isNotEmpty) {
      return SizedBox(
        height: _h,
        width: double.infinity,
        child: CachedNetworkImage(
          imageUrl: u,
          fit: BoxFit.cover,
          fadeInDuration: const Duration(milliseconds: 200),
          fadeOutDuration: const Duration(milliseconds: 120),
          placeholder: (_, __) => const _RewardImagePlaceholder(),
          errorWidget: (_, __, ___) => const _RewardImagePlaceholder(),
        ),
      );
    }
    return const SizedBox(
      height: _h,
      width: double.infinity,
      child: _RewardImagePlaceholder(),
    );
  }
}

class _RewardImagePlaceholder extends StatelessWidget {
  const _RewardImagePlaceholder();

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            NmdColors.brandPrimary.withValues(alpha: 0.55),
            NmdColors.surfaceCommunitySoft,
            NmdColors.brandSecondary.withValues(alpha: 0.45),
          ],
        ),
      ),
      child: Center(
        child: Icon(
          Icons.card_giftcard_outlined,
          size: 52,
          color: Colors.white.withValues(alpha: 0.28),
        ),
      ),
    );
  }
}

class _TicketRewardCard extends StatelessWidget {
  const _TicketRewardCard({
    required this.item,
    required this.balance,
    required this.isAuthenticated,
    required this.redeeming,
  });

  final RewardItem item;
  final int? balance;
  final bool isAuthenticated;
  final bool redeeming;

  static const _ticketRadius = 28.0;

  @override
  Widget build(BuildContext context) {
    final title = item.titleAr.isNotEmpty ? item.titleAr : item.titleEn;
    final categoryLine = rewardCategoryHeaderAr(item.type);
    final valueLine = valueLabelFor(item);
    final canAfford =
        isAuthenticated && balance != null && balance! >= item.coinsCost;
    final canRedeem = canAfford && !item.locked;
    final locked = item.locked;
    final lockLabel = item.lockReason == 'EXPIRED'
        ? 'منتهي'
        : item.lockReason == 'SOLD_OUT'
            ? 'نفدت الكمية'
            : 'غير متاح';

    return Stack(
      clipBehavior: Clip.none,
      children: [
        Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(_ticketRadius),
            boxShadow: [
              BoxShadow(
                color: NmdColors.brandPrimary.withValues(alpha: 0.12),
                blurRadius: 24,
                offset: const Offset(0, 10),
                spreadRadius: -4,
              ),
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.45),
                blurRadius: 18,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(_ticketRadius),
            clipBehavior: Clip.antiAlias,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _RewardTicketHeroImage(imageUrl: item.imageUrl),
                Container(
                  decoration: BoxDecoration(
                    border: Border(
                      top: BorderSide(
                          color: Colors.white.withValues(alpha: 0.08)),
                    ),
                    gradient: const LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [
                        Color(0xFF1E293B),
                        Color(0xFF0F172A),
                        Color(0xFF020617),
                      ],
                    ),
                  ),
                  child: Directionality(
                    textDirection: TextDirection.ltr,
                    child: IntrinsicHeight(
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Container(
                            width: 7,
                            decoration: const BoxDecoration(
                              gradient: LinearGradient(
                                begin: Alignment.topCenter,
                                end: Alignment.bottomCenter,
                                colors: [
                                  Color(0xFFFFE082),
                                  Color(0xFFFFB300),
                                  Color(0xFFE65100),
                                ],
                              ),
                            ),
                          ),
                          Expanded(
                            child: Directionality(
                              textDirection: TextDirection.rtl,
                              child: Padding(
                                padding:
                                    const EdgeInsets.fromLTRB(10, 14, 14, 14),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Text(
                                      title,
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                      style: GoogleFonts.cairo(
                                        color: Colors.white,
                                        fontSize: 17,
                                        fontWeight: FontWeight.w900,
                                        height: 1.25,
                                      ),
                                    ),
                                    const SizedBox(height: NmdSpacing.xs),
                                    NmdBadge(
                                      label: categoryLine,
                                      tone: NmdBadgeTone.brand,
                                      compact: true,
                                    ),
                                    const SizedBox(height: NmdSpacing.xs),
                                    Text(
                                      valueLine,
                                      style: NmdTypography.bodySmall.copyWith(
                                        color: NmdColors.textOnDark
                                            .withValues(alpha: 0.75),
                                      ),
                                    ),
                                    const SizedBox(height: NmdSpacing.xs),
                                    NmdBadge(
                                      label: '${item.coinsCost} عملة',
                                      tone: NmdBadgeTone.gold,
                                      compact: true,
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                          Container(
                            width: 1,
                            margin: const EdgeInsets.symmetric(vertical: 12),
                            color: Colors.white.withValues(alpha: 0.1),
                          ),
                          SizedBox(
                            width: 104,
                            child: Padding(
                              padding: const EdgeInsets.all(10),
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  if (item.locked)
                                    Text(
                                      lockLabel,
                                      textAlign: TextAlign.center,
                                      style: NmdTypography.micro.copyWith(
                                        color: NmdColors.textOnDark
                                            .withValues(alpha: 0.45),
                                      ),
                                    )
                                  else if (!isAuthenticated)
                                    NmdButton(
                                      label: 'دخول',
                                      size: NmdButtonSize.compact,
                                      expand: false,
                                      onPressed: () async {
                                        final ok =
                                            await ensureCustomerAuth(context);
                                        if (!context.mounted || !ok) return;
                                        await Future.wait([
                                          context.read<RewardsCubit>().load(),
                                          context
                                              .read<CoinsBalanceCubit>()
                                              .load(),
                                        ]);
                                      },
                                    )
                                  else
                                    NmdButton(
                                      label:
                                          canRedeem ? 'استبدال' : 'أكمل النقاط',
                                      size: NmdButtonSize.compact,
                                      expand: false,
                                      loading: redeeming,
                                      onPressed: canRedeem && !redeeming
                                          ? () async {
                                              final err = await context
                                                  .read<RewardsCubit>()
                                                  .redeem(item.id);
                                              if (!context.mounted) return;
                                              if (err == 'login') {
                                                final ok =
                                                    await ensureCustomerAuth(
                                                        context);
                                                if (!context.mounted || !ok) {
                                                  return;
                                                }
                                                await context
                                                    .read<CoinsBalanceCubit>()
                                                    .load();
                                                return;
                                              }
                                              if (err != null) {
                                                ScaffoldMessenger.of(context)
                                                    .showSnackBar(
                                                  SnackBar(
                                                    content: Text(
                                                      err,
                                                      style:
                                                          GoogleFonts.cairo(),
                                                    ),
                                                  ),
                                                );
                                              } else {
                                                await context
                                                    .read<CoinsBalanceCubit>()
                                                    .load();
                                                if (!context.mounted) return;
                                                ScaffoldMessenger.of(context)
                                                    .showSnackBar(
                                                  SnackBar(
                                                    content: Text(
                                                      'تم الاستبدال بنجاح',
                                                      style:
                                                          GoogleFonts.cairo(),
                                                    ),
                                                  ),
                                                );
                                              }
                                            }
                                          : null,
                                      variant: canRedeem
                                          ? NmdButtonVariant.primary
                                          : NmdButtonVariant.secondary,
                                    ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
        if (locked)
          Positioned.fill(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(_ticketRadius),
              child: BackdropFilter(
                filter: ImageFilter.blur(sigmaX: 4, sigmaY: 4),
                child: ColoredBox(
                  color: Colors.black.withValues(alpha: 0.72),
                  child: Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.lock_rounded,
                          size: 36,
                          color: Colors.amber.shade200,
                        ),
                        const SizedBox(height: 8),
                        Text(
                          lockLabel,
                          style: GoogleFonts.cairo(
                            color: Colors.white,
                            fontSize: 15,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}
