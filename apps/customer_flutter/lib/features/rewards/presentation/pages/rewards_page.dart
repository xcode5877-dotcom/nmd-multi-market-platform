import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/auth/ensure_customer_auth.dart';
import '../../../../core/errors/app_error_mapper.dart';
import '../../../../widgets/app_error_view.dart';
import '../../../../design_system/design_system.dart';
import '../../../auth/presentation/bloc/auth_bloc.dart';
import '../../../cart/presentation/widgets/global_cart_icon.dart';
import '../../../loyalty/application/coins_balance_cubit.dart';
import '../../application/rewards_cubit.dart';
import '../widgets/rewards_cinematic_experience.dart';

class RewardsPage extends StatefulWidget {
  const RewardsPage({super.key});

  @override
  State<RewardsPage> createState() => _RewardsPageState();
}

class _RewardsPageState extends State<RewardsPage> {
  final _scrollCtrl = ScrollController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      context.read<CoinsBalanceCubit>().load();
    });
  }

  @override
  void dispose() {
    _scrollCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final marketSlug = GoRouterState.of(context).pathParameters['slug'] ?? '';

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
      child: _RewardsCinematicBody(
        scrollController: _scrollCtrl,
        marketSlug: marketSlug,
      ),
    );
  }
}

class _RewardsCinematicBody extends StatelessWidget {
  const _RewardsCinematicBody({
    required this.scrollController,
    required this.marketSlug,
  });

  final ScrollController scrollController;
  final String marketSlug;

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
                message: 'جاري التحميل...',
                size: NmdLoadingSize.large,
              ),
            );
          case RewardsStatus.failure:
            return ColoredBox(
              color: NmdColors.surfaceCommunity,
              child: Center(
                child: Padding(
                  padding: const EdgeInsets.all(NmdSpacing.xl),
                  child: AppErrorView(
                    title: 'تعذّر التحميل',
                    message:
                        state.errorMessage ?? AppErrorMapper.unknownMessage,
                    compact: true,
                    onRetry: () => context.read<RewardsCubit>().load(),
                  ),
                ),
              ),
            );
          case RewardsStatus.loaded:
            final auth = context.watch<AuthBloc>().state;
            final coins = context.watch<CoinsBalanceCubit>().state;
            final isAuth =
                auth.step == AuthStep.done || coins.isAuthenticated;

            return CinematicScrollChrome(
              scrollController: scrollController,
              title: 'المكافآت',
              backgroundColor: NmdColors.surfaceCommunity,
              leading: CinematicGlassIconButton(
                icon: Icons.arrow_back_ios_new_rounded,
                onPressed: () {
                  if (context.canPop()) {
                    context.pop();
                  } else if (marketSlug.isNotEmpty) {
                    context.go('/market/$marketSlug');
                  }
                },
              ),
              actions: [
                CinematicGlassIconButton(
                  icon: Icons.person_outline_rounded,
                  onPressed: () async {
                    if (marketSlug.isEmpty) return;
                    final ok = await ensureCustomerAuth(context);
                    if (!context.mounted || !ok) return;
                    context.go('/market/$marketSlug/account');
                  },
                ),
                if (marketSlug.isNotEmpty) ...[
                  const SizedBox(width: 6),
                  GlobalCartIcon(
                    marketSlug: marketSlug,
                    iconColor: Colors.white,
                    iconSize: 19,
                    style: ButtonStyle(
                      padding: WidgetStateProperty.all(EdgeInsets.zero),
                      minimumSize: WidgetStateProperty.all(const Size(40, 40)),
                    ),
                  ),
                ],
              ],
              body: RefreshIndicator(
                color: NmdColors.brandPrimary,
                onRefresh: () async {
                  await Future.wait([
                    context.read<RewardsCubit>().load(),
                    context.read<CoinsBalanceCubit>().load(),
                  ]);
                },
                child: CustomScrollView(
                  controller: scrollController,
                  physics: const AlwaysScrollableScrollPhysics(
                    parent: BouncingScrollPhysics(),
                  ),
                  slivers: [
                    const SliverToBoxAdapter(child: RewardsCinematicHero()),
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.only(top: 4, bottom: 22),
                        child: RewardsCinematicCategoryBar(
                          selected: state.filter,
                          onSelect: context.read<RewardsCubit>().setFilter,
                        ),
                      ),
                    ),
                    SliverToBoxAdapter(
                      child: RewardsCinematicCarousel(
                        rewards: state.filteredRewards,
                        balance: coins.balance,
                        isAuthenticated: isAuth,
                        redeemingId: state.redeemingId,
                      ),
                    ),
                    const SliverPadding(padding: EdgeInsets.only(bottom: 56)),
                  ],
                ),
              ),
            );
        }
      },
    );
  }
}
