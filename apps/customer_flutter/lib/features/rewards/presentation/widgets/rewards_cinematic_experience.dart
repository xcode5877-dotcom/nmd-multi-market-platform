import 'dart:ui' show ImageFilter;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../../api/resolve_image_url.dart';
import '../../../../core/auth/ensure_customer_auth.dart';
import '../../../../design_system/design_system.dart';
import '../../../auth/presentation/bloc/auth_bloc.dart';
import '../../../loyalty/application/coins_balance_cubit.dart';
import '../../application/rewards_cubit.dart';
import '../../data/reward_item.dart';

/// Full-width cinematic hero — balance + emotional headline.
class RewardsCinematicHero extends StatefulWidget {
  const RewardsCinematicHero({super.key});

  @override
  State<RewardsCinematicHero> createState() => _RewardsCinematicHeroState();
}

class _RewardsCinematicHeroState extends State<RewardsCinematicHero>
    with SingleTickerProviderStateMixin {
  late final AnimationController _drift;

  @override
  void initState() {
    super.initState();
    _drift = AnimationController(
      vsync: this,
      duration: PremiumMarketplaceDesignSystem.ambientDrift,
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _drift.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final coins = context.watch<CoinsBalanceCubit>().state;
    final authDone = context.watch<AuthBloc>().state.step == AuthStep.done;
    final loggedIn = coins.isAuthenticated || authDone;
    final balance = coins.balance ?? 0;

    return RepaintBoundary(
      child: AnimatedBuilder(
        animation: _drift,
        builder: (context, child) {
          final t = Curves.easeInOut.transform(_drift.value);
          return SizedBox(
            height: 268,
            width: double.infinity,
            child: Stack(
              fit: StackFit.expand,
              children: [
                const DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: PremiumMarketplaceDesignSystem.cinematicHeroAmbient,
                  ),
                ),
                Positioned(
                  right: -40 + t * 18,
                  top: -30,
                  child: _AmbientOrb(
                    size: 170,
                    color: PremiumMarketplaceDesignSystem.brandGlow(0.1),
                  ),
                ),
                Positioned(
                  left: -50 - t * 14,
                  bottom: -40,
                  child: _AmbientOrb(
                    size: 150,
                    color: PremiumMarketplaceDesignSystem.goldGlow(0.08),
                  ),
                ),
                child!,
              ],
            ),
          );
        },
        child: SafeArea(
          bottom: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(
              PremiumMarketplaceDesignSystem.heroInset,
              12,
              PremiumMarketplaceDesignSystem.heroInset,
              PremiumMarketplaceDesignSystem.heroSpacingLg,
            ),
            child: Directionality(
              textDirection: TextDirection.rtl,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Spacer(),
                  if (loggedIn)
                    TweenAnimationBuilder<int>(
                      tween: IntTween(begin: 0, end: balance),
                      duration: const Duration(milliseconds: 1100),
                      curve: PremiumMarketplaceDesignSystem.cinematicCurve,
                      builder: (context, value, _) => Text(
                        value.toString(),
                        style: GoogleFonts.cairo(
                          color: Colors.white,
                          fontSize: 58,
                          fontWeight: FontWeight.w900,
                          height: 1,
                          letterSpacing: -1.2,
                        ),
                      ),
                    )
                  else
                    Text(
                      '—',
                      style: GoogleFonts.cairo(
                        color: Colors.white.withValues(alpha: 0.28),
                        fontSize: 58,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  const SizedBox(height: 2),
                  Text(
                    loggedIn ? 'عملة' : 'رصيدك',
                    style: NmdTypography.micro.copyWith(
                      color: NmdColors.textOnDark.withValues(alpha: 0.4),
                      fontSize: 10,
                      letterSpacing: 1.6,
                    ),
                  ),
                  const SizedBox(height: 20),
                  Text(
                    'شارك واربح',
                    style: NmdTypography.display.copyWith(
                      color: NmdColors.textOnDark.withValues(alpha: 0.88),
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                      height: 1.1,
                      letterSpacing: -0.3,
                    ),
                  ),
                  if (!loggedIn) ...[
                    const SizedBox(height: 18),
                    _CinematicCta(
                      label: 'ادخل التحدي',
                      onTap: () async {
                        HapticFeedback.lightImpact();
                        final ok = await ensureCustomerAuth(context);
                        if (!context.mounted || !ok) return;
                        await Future.wait([
                          context.read<RewardsCubit>().load(),
                          context.read<CoinsBalanceCubit>().load(),
                        ]);
                      },
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _AmbientOrb extends StatelessWidget {
  const _AmbientOrb({required this.size, required this.color});
  final double size;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: RadialGradient(colors: [color, Colors.transparent]),
        ),
      ),
    );
  }
}

class _CinematicCta extends StatelessWidget {
  const _CinematicCta({required this.label, required this.onTap});
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerRight,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: PremiumMarketplaceDesignSystem.borderSm,
          child: Ink(
            padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 11),
            decoration: BoxDecoration(
              borderRadius: PremiumMarketplaceDesignSystem.borderSm,
              gradient: PremiumMarketplaceDesignSystem.glassTabActive,
              boxShadow: PremiumMarketplaceDesignSystem.focusedCarouselGlow(),
            ),
            child: Text(
              label,
              style: NmdTypography.button.copyWith(
                color: NmdColors.textOnBrand,
                fontSize: 13,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Minimal glass segmented selector — RTL order.
class RewardsCinematicCategoryBar extends StatelessWidget {
  const RewardsCinematicCategoryBar({
    super.key,
    required this.selected,
    required this.onSelect,
  });

  final RewardFilter selected;
  final ValueChanged<RewardFilter> onSelect;

  static const _tabs = <(RewardFilter, String)>[
    (RewardFilter.all, 'الكل'),
    (RewardFilter.tournaments, 'بطولات'),
    (RewardFilter.coupons, 'قسائم'),
    (RewardFilter.prizes, 'تجارب'),
  ];

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: PremiumMarketplaceDesignSystem.heroInset,
      ),
      child: Directionality(
        textDirection: TextDirection.rtl,
        child: ClipRRect(
          borderRadius: PremiumMarketplaceDesignSystem.borderMd,
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
            child: Container(
              padding: const EdgeInsets.all(4),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.05),
                borderRadius: PremiumMarketplaceDesignSystem.borderMd,
              ),
              child: Row(
                children: [
                  for (var i = 0; i < _tabs.length; i++) ...[
                    if (i > 0) const SizedBox(width: 4),
                    Expanded(
                      child: _GlassTab(
                        label: _tabs[i].$2,
                        selected: selected == _tabs[i].$1,
                        onTap: () {
                          HapticFeedback.selectionClick();
                          onSelect(_tabs[i].$1);
                        },
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _GlassTab extends StatelessWidget {
  const _GlassTab({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: PremiumMarketplaceDesignSystem.micro,
        curve: PremiumMarketplaceDesignSystem.cinematicCurve,
        padding: const EdgeInsets.symmetric(vertical: 9),
        decoration: BoxDecoration(
          borderRadius: PremiumMarketplaceDesignSystem.borderSm,
          gradient: selected ? PremiumMarketplaceDesignSystem.glassTabActive : null,
          boxShadow: selected ? PremiumMarketplaceDesignSystem.focusedCarouselGlow() : null,
        ),
        alignment: Alignment.center,
        child: Text(
          label,
          style: NmdTypography.label.copyWith(
            fontSize: 11,
            fontWeight: selected ? FontWeight.w900 : FontWeight.w600,
            color: selected
                ? NmdColors.textOnBrand
                : NmdColors.textOnDark.withValues(alpha: 0.5),
          ),
        ),
      ),
    );
  }
}

/// True RTL cinematic carousel with edge fade + scale falloff.
class RewardsCinematicCarousel extends StatefulWidget {
  const RewardsCinematicCarousel({
    super.key,
    required this.rewards,
    required this.balance,
    required this.isAuthenticated,
    required this.redeemingId,
  });

  final List<RewardItem> rewards;
  final int? balance;
  final bool isAuthenticated;
  final String? redeemingId;

  @override
  State<RewardsCinematicCarousel> createState() =>
      _RewardsCinematicCarouselState();
}

class _RewardsCinematicCarouselState extends State<RewardsCinematicCarousel> {
  late final PageController _pageCtrl;
  int _lastPage = 0;

  @override
  void initState() {
    super.initState();
    _pageCtrl = PageController(
      viewportFraction: PremiumMarketplaceDesignSystem.carouselViewportFraction,
    );
  }

  @override
  void dispose() {
    _pageCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.rewards.isEmpty) {
      return const RewardsCinematicEmpty();
    }

    final cardWidth = MediaQuery.sizeOf(context).width *
        PremiumMarketplaceDesignSystem.carouselViewportFraction;
    final cardHeight =
        cardWidth / PremiumMarketplaceDesignSystem.rewardCarouselAspect;

    return SizedBox(
      height: cardHeight + 20,
      child: Directionality(
        textDirection: TextDirection.rtl,
        child: ShaderMask(
          shaderCallback: (bounds) =>
              PremiumMarketplaceDesignSystem.carouselEdgeFadeRtl
                  .createShader(bounds),
          blendMode: BlendMode.dstIn,
          child: NotificationListener<ScrollNotification>(
            onNotification: (n) {
              if (n is ScrollEndNotification && _pageCtrl.hasClients) {
                final page = (_pageCtrl.page ?? 0).round();
                if (page != _lastPage) {
                  _lastPage = page;
                  HapticFeedback.selectionClick();
                }
              }
              return false;
            },
            child: AnimatedBuilder(
              animation: _pageCtrl,
              builder: (context, _) {
                return PageView.builder(
                  controller: _pageCtrl,
                  padEnds: true,
                  physics: PremiumMarketplaceDesignSystem.carouselPhysics,
                  itemCount: widget.rewards.length,
                  itemBuilder: (context, index) {
                    final item = widget.rewards[index];
                    final page = _pageCtrl.hasClients
                        ? (_pageCtrl.page ?? _pageCtrl.initialPage.toDouble())
                        : 0.0;
                    final delta = (page - index).abs();
                    final scale = (1 - delta * 0.085).clamp(0.86, 1.0);
                    final opacity = (1 - delta * 0.42).clamp(0.45, 1.0);

                    return Opacity(
                      opacity: opacity,
                      child: Transform.scale(
                        scale: scale,
                        alignment: Alignment.center,
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 5),
                          child: _CinematicRewardCard(
                            item: item,
                            onTap: () {
                              HapticFeedback.lightImpact();
                              RewardCinematicDetailSheet.show(
                                context,
                                itemId: item.id,
                              );
                            },
                          ),
                        ),
                      ),
                    );
                  },
                );
              },
            ),
          ),
        ),
      ),
    );
  }
}

class _CinematicRewardCard extends StatelessWidget {
  const _CinematicRewardCard({required this.item, required this.onTap});

  final RewardItem item;
  final VoidCallback onTap;

  String get _statusLabel {
    if (item.redeemed) {
      return rewardRedeemedLabelAr(item.type);
    }
    if (item.locked) {
      return item.lockReason == 'EXPIRED'
          ? 'منتهي'
          : item.lockReason == 'SOLD_OUT'
              ? 'نفدت'
              : 'مغلق';
    }
    return 'متاح الآن';
  }

  @override
  Widget build(BuildContext context) {
    final title = item.titleAr.isNotEmpty ? item.titleAr : item.titleEn;
    final url = item.imageUrl?.trim();

    return RepaintBoundary(
      child: GestureDetector(
        onTap: onTap,
        child: ClipRRect(
          borderRadius: PremiumMarketplaceDesignSystem.borderLg,
          child: AspectRatio(
            aspectRatio: PremiumMarketplaceDesignSystem.rewardCarouselAspect,
            child: Stack(
              fit: StackFit.expand,
              children: [
                if (url != null && url.isNotEmpty)
                  CachedNetworkImage(
                    imageUrl: resolveImageUrl(url),
                    fit: BoxFit.cover,
                    placeholder: (_, __) =>
                        const ColoredBox(color: Color(0xFF1E293B)),
                  )
                else
                  const ColoredBox(color: Color(0xFF1E293B)),
                const DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: PremiumMarketplaceDesignSystem.rewardCardOverlay,
                  ),
                ),
                Positioned(
                  top: 12,
                  right: 12,
                  child: _FloatingStatusPill(
                    label: _statusLabel,
                    locked: item.locked && !item.redeemed,
                    participated: item.redeemed,
                  ),
                ),
                Positioned(
                  left: 18,
                  right: 18,
                  bottom: 18,
                  child: Directionality(
                    textDirection: TextDirection.rtl,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          title,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: NmdTypography.display.copyWith(
                            color: Colors.white,
                            fontSize: 21,
                            fontWeight: FontWeight.w900,
                            height: 1.12,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '${item.coinsCost} عملة',
                          style: NmdTypography.micro.copyWith(
                            color: Colors.white.withValues(alpha: 0.5),
                            letterSpacing: 0.4,
                          ),
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
    );
  }
}

class _FloatingStatusPill extends StatelessWidget {
  const _FloatingStatusPill({
    required this.label,
    required this.locked,
    this.participated = false,
  });

  final String label;
  final bool locked;
  final bool participated;

  @override
  Widget build(BuildContext context) {
    final Color bg;
    if (participated) {
      bg = NmdColors.brandPrimary.withValues(alpha: 0.88);
    } else if (locked) {
      bg = Colors.black.withValues(alpha: 0.42);
    } else {
      bg = NmdColors.success.withValues(alpha: 0.85);
    }
    return DecoratedBox(
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(99),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
        child: Text(
          label,
          style: NmdTypography.micro.copyWith(
            color: Colors.white,
            fontWeight: FontWeight.w800,
            fontSize: 9,
          ),
        ),
      ),
    );
  }
}

class RewardsCinematicEmpty extends StatelessWidget {
  const RewardsCinematicEmpty({super.key});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(48),
      child: Column(
        children: [
          Text(
            'قريباً',
            style: NmdTypography.h2.copyWith(
              color: NmdColors.textOnDark.withValues(alpha: 0.65),
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'تجارب جديدة قادمة',
            style: NmdTypography.bodySmall.copyWith(
              color: NmdColors.textOnDark.withValues(alpha: 0.38),
            ),
          ),
        ],
      ),
    );
  }
}

/// Luxury campaign-style reward detail sheet.
class RewardCinematicDetailSheet {
  static Future<void> show(
    BuildContext context, {
    required String itemId,
  }) {
    debugPrint('[REWARD_OPEN] rewardId=$itemId');
    final rewardsCubit = context.read<RewardsCubit>();
    final coinsCubit = context.read<CoinsBalanceCubit>();
    final authBloc = context.read<AuthBloc>();
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) {
        try {
          return MultiBlocProvider(
            providers: [
              BlocProvider<RewardsCubit>.value(value: rewardsCubit),
              BlocProvider<CoinsBalanceCubit>.value(value: coinsCubit),
              BlocProvider<AuthBloc>.value(value: authBloc),
            ],
            child: BlocBuilder<RewardsCubit, RewardsState>(
            builder: (context, rewardsState) {
              RewardItem? item;
              for (final r in rewardsState.rewards) {
                if (r.id == itemId) {
                  item = r;
                  break;
                }
              }
              debugPrint('[REWARD_OPEN] reward=$item');
              debugPrint(
                '[REWARD_OPEN] route args=itemId=$itemId loaded=${rewardsState.rewards.length}',
              );
              if (item == null) {
                return _RewardDetailMissingSheet(sheetContext: sheetContext);
              }
              return BlocBuilder<CoinsBalanceCubit, CoinsBalanceState>(
                builder: (context, coinsState) {
                  final auth = context.watch<AuthBloc>().state;
                  final isAuth =
                      auth.step == AuthStep.done || coinsState.isAuthenticated;
                  return _RewardDetailBody(
                    item: item!,
                    balance: coinsState.balance,
                    isAuthenticated: isAuth,
                    redeeming: rewardsState.redeemingId == itemId,
                    sheetContext: sheetContext,
                  );
                },
              );
            },
            ),
          );
        } catch (e, st) {
          debugPrint('[REWARD_OPEN] error=$e');
          debugPrintStack(stackTrace: st);
          return _RewardDetailErrorSheet(
            sheetContext: sheetContext,
            message: 'تعذر عرض تفاصيل المكافأة',
          );
        }
      },
    );
  }
}

class _RewardDetailMissingSheet extends StatelessWidget {
  const _RewardDetailMissingSheet({required this.sheetContext});

  final BuildContext sheetContext;

  @override
  Widget build(BuildContext context) {
    return _RewardDetailErrorSheet(
      sheetContext: sheetContext,
      message: 'تعذر العثور على المكافأة',
    );
  }
}

class _RewardDetailErrorSheet extends StatelessWidget {
  const _RewardDetailErrorSheet({
    required this.sheetContext,
    required this.message,
  });

  final BuildContext sheetContext;
  final String message;

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.42,
      minChildSize: 0.32,
      maxChildSize: 0.55,
      builder: (_, scrollController) {
        return DecoratedBox(
          decoration: const BoxDecoration(
            color: Color(0xFF020617),
            borderRadius: BorderRadius.vertical(
              top: Radius.circular(PremiumMarketplaceDesignSystem.radiusHero),
            ),
          ),
          child: ListView(
            controller: scrollController,
            padding: const EdgeInsets.fromLTRB(24, 12, 24, 32),
            children: [
              CinematicSheetGlassHeader(
                onClose: () => Navigator.pop(sheetContext),
              ),
              const SizedBox(height: 24),
              Text(
                message,
                textAlign: TextAlign.center,
                style: NmdTypography.h2.copyWith(
                  color: Colors.white.withValues(alpha: 0.9),
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 20),
              Center(
                child: TextButton(
                  onPressed: () => Navigator.pop(sheetContext),
                  child: const Text('إغلاق'),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _RewardDetailBody extends StatelessWidget {
  const _RewardDetailBody({
    required this.item,
    required this.balance,
    required this.isAuthenticated,
    required this.redeeming,
    required this.sheetContext,
  });

  final RewardItem item;
  final int? balance;
  final bool isAuthenticated;
  final bool redeeming;
  final BuildContext sheetContext;

  @override
  Widget build(BuildContext context) {
    final title = item.titleAr.isNotEmpty ? item.titleAr : item.titleEn;
    final canAfford =
        isAuthenticated && balance != null && balance! >= item.coinsCost;
    final canRedeem = canAfford && !item.locked && !item.redeemed;
    final url = item.imageUrl?.trim();
    final description = item.description?.trim() ?? '';

    return DraggableScrollableSheet(
      initialChildSize: 0.88,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      builder: (context, scrollCtrl) {
        return ClipRRect(
          borderRadius: const BorderRadius.vertical(
            top: Radius.circular(PremiumMarketplaceDesignSystem.radiusHero),
          ),
          child: ColoredBox(
            color: const Color(0xFF020617),
            child: Stack(
              fit: StackFit.expand,
              children: [
                ListView(
                  controller: scrollCtrl,
                  padding: const EdgeInsets.only(bottom: 40),
                  children: [
                    Stack(
                      children: [
                        AspectRatio(
                          aspectRatio:
                              PremiumMarketplaceDesignSystem.rewardCarouselAspect,
                          child: url != null && url.isNotEmpty
                              ? CachedNetworkImage(
                                  imageUrl: resolveImageUrl(url),
                                  fit: BoxFit.cover,
                                  placeholder: (_, __) =>
                                      const ColoredBox(color: Color(0xFF1E293B)),
                                  errorWidget: (_, __, ___) =>
                                      const ColoredBox(color: Color(0xFF1E293B)),
                                )
                              : const ColoredBox(color: Color(0xFF1E293B)),
                        ),
                        const Positioned.fill(
                          child: DecoratedBox(
                            decoration: BoxDecoration(
                              gradient: PremiumMarketplaceDesignSystem
                                  .cinematicDarkOverlay,
                            ),
                          ),
                        ),
                      ],
                    ),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(24, 28, 24, 0),
                      child: Directionality(
                        textDirection: TextDirection.rtl,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              title,
                              style: NmdTypography.display.copyWith(
                                color: Colors.white.withValues(alpha: 0.94),
                                fontSize: 28,
                                fontWeight: FontWeight.w900,
                                height: 1.08,
                                letterSpacing: -0.4,
                              ),
                            ),
                            const SizedBox(height: 14),
                            if (description.isNotEmpty)
                              Text(
                                description,
                                style: NmdTypography.body.copyWith(
                                  color: Colors.white.withValues(alpha: 0.52),
                                  height: 1.7,
                                  fontSize: 15,
                                ),
                              ),
                            const SizedBox(height: 28),
                            Text(
                              '${item.coinsCost} عملة',
                              style: NmdTypography.h2.copyWith(
                                color:
                                    NmdColors.accentGold.withValues(alpha: 0.9),
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            const SizedBox(height: 24),
                            _DetailCta(
                              item: item,
                              canRedeem: canRedeem,
                              redeeming: redeeming,
                              isAuthenticated: isAuthenticated,
                              locked: item.locked,
                              onRedeem: () => _handleRedeem(context),
                              onLogin: () => _handleLogin(context),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
                Positioned(
                  top: 0,
                  left: 0,
                  right: 0,
                  child: CinematicSheetGlassHeader(
                    title: title,
                    onClose: () => Navigator.pop(sheetContext),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Future<void> _handleLogin(BuildContext context) async {
    HapticFeedback.lightImpact();
    final ok = await ensureCustomerAuth(context);
    if (!context.mounted || !ok) return;
    await Future.wait([
      context.read<RewardsCubit>().load(),
      context.read<CoinsBalanceCubit>().load(),
    ]);
    if (sheetContext.mounted) Navigator.pop(sheetContext);
  }

  Future<void> _handleRedeem(BuildContext context) async {
    if (redeeming || item.redeemed) return;
    HapticFeedback.mediumImpact();
    if (!isAuthenticated) {
      await _handleLogin(context);
      return;
    }
    final messenger = ScaffoldMessenger.maybeOf(context);
    final outcome = await context.read<RewardsCubit>().redeem(item.id);
    if (!context.mounted) return;
    if (outcome.sessionExpired) {
      final ok = await handleSessionExpired(context);
      if (!context.mounted || !ok) return;
      await Future.wait([
        context.read<RewardsCubit>().load(),
        context.read<CoinsBalanceCubit>().load(),
      ]);
      return;
    }
    if (outcome.loginRequired) {
      await _handleLogin(context);
      return;
    }
    if (!outcome.ok) {
      messenger?.showSnackBar(
        SnackBar(content: Text(outcome.errorMessage ?? 'تعذّر إتمام العملية')),
      );
      return;
    }
    if (outcome.newBalance != null) {
      context.read<CoinsBalanceCubit>().applyBalance(outcome.newBalance!);
    } else {
      await context.read<CoinsBalanceCubit>().load();
    }
    if (!sheetContext.mounted) return;
    Navigator.pop(sheetContext);
    messenger?.showSnackBar(
      SnackBar(
        content: Text(outcome.successMessage ?? rewardRedeemSuccessMessageAr),
        duration: const Duration(seconds: 5),
      ),
    );
  }
}

class _DetailCta extends StatelessWidget {
  const _DetailCta({
    required this.item,
    required this.canRedeem,
    required this.redeeming,
    required this.isAuthenticated,
    required this.locked,
    required this.onRedeem,
    required this.onLogin,
  });

  final RewardItem item;
  final bool canRedeem;
  final bool redeeming;
  final bool isAuthenticated;
  final bool locked;
  final VoidCallback onRedeem;
  final VoidCallback onLogin;

  @override
  Widget build(BuildContext context) {
    if (item.redeemed) {
      return SizedBox(
        width: double.infinity,
        height: PremiumMarketplaceDesignSystem.ctaHeight,
        child: FilledButton(
          onPressed: null,
          style: FilledButton.styleFrom(
            disabledBackgroundColor: NmdColors.brandPrimary.withValues(alpha: 0.35),
            disabledForegroundColor: Colors.white.withValues(alpha: 0.92),
            shape: RoundedRectangleBorder(
              borderRadius: PremiumMarketplaceDesignSystem.borderSm,
            ),
          ),
          child: Text(
            rewardRedeemedLabelAr(item.type),
            style: NmdTypography.button.copyWith(fontSize: 14),
          ),
        ),
      );
    }
    if (locked) {
      return Text(
        'غير متاح حالياً',
        style: NmdTypography.label.copyWith(color: Colors.white38),
      );
    }
    if (!isAuthenticated) {
      return _CinematicCta(label: 'تنافس واربح', onTap: onLogin);
    }
    return SizedBox(
      width: double.infinity,
      height: PremiumMarketplaceDesignSystem.ctaHeight,
      child: FilledButton(
        onPressed: (canRedeem && !redeeming)
            ? () {
                onRedeem();
              }
            : null,
        style: FilledButton.styleFrom(
          backgroundColor: NmdColors.brandPrimary,
          disabledBackgroundColor: Colors.white12,
          shape: RoundedRectangleBorder(
            borderRadius: PremiumMarketplaceDesignSystem.borderSm,
          ),
        ),
        child: redeeming
            ? const SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            : Text(
                canRedeem ? 'استبدل الآن' : 'اجمع المزيد',
                style: NmdTypography.button.copyWith(fontSize: 14),
              ),
      ),
    );
  }
}
