import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../core/network/token_storage.dart';
import '../features/auth/presentation/bloc/auth_bloc.dart';
import '../features/account/presentation/pages/account_page.dart';
import '../features/account/presentation/pages/addresses_page.dart';
import '../features/account/presentation/pages/edit_profile_page.dart';
import '../features/account/presentation/pages/help_support_page.dart';
import '../features/account/presentation/pages/notification_settings_page.dart';
import '../features/account/presentation/pages/payment_methods_page.dart';
import '../features/cart/presentation/pages/cart_page.dart';
import '../features/cart/presentation/pages/checkout_page.dart';
import '../features/payments/presentation/pages/hyp_payment_webview_page.dart';
import '../features/catalog/application/home_cubit.dart';
import '../features/catalog/presentation/pages/home_page.dart';
import '../features/catalog/presentation/pages/category_products_page.dart';
import '../features/catalog/presentation/pages/store_detail_page.dart';
import '../features/catalog/presentation/pages/product_details_page.dart';
import '../features/markets/presentation/pages/market_selection_page.dart';
import '../features/offers/presentation/pages/offers_page.dart';
import '../features/orders/application/orders_cubit.dart';
import '../features/orders/presentation/pages/orders_page.dart';
import '../features/loyalty/application/coins_balance_cubit.dart';
import '../features/rewards/application/rewards_cubit.dart';
import '../features/rewards/presentation/pages/rewards_page.dart';
import '../features/splash/presentation/pages/splash_page.dart';
import '../presentation/layouts/main_layout.dart';
import 'theme/app_colors.dart';

final GoRouter appRouter = GoRouter(
  initialLocation: '/splash',
  routes: [
    GoRoute(
      path: '/splash',
      builder: (context, state) => const SplashPage(),
    ),
    GoRoute(
      path: '/main',
      pageBuilder: (context, state) => CustomTransitionPage<void>(
        key: state.pageKey,
        child: const MarketSelectionPage(),
        transitionDuration: const Duration(milliseconds: 550),
        reverseTransitionDuration: const Duration(milliseconds: 350),
        transitionsBuilder: (context, animation, secondaryAnimation, child) {
          final fade =
              CurvedAnimation(parent: animation, curve: Curves.easeOutCubic);
          final slide = Tween<Offset>(
            begin: const Offset(0.06, 0),
            end: Offset.zero,
          ).animate(
              CurvedAnimation(parent: animation, curve: Curves.easeOutCubic));
          return FadeTransition(
            opacity: fade,
            child: SlideTransition(position: slide, child: child),
          );
        },
      ),
    ),
    ShellRoute(
      builder: (context, state, child) {
        final slug = state.pathParameters['slug']!;
        return BlocProvider(
          create: (ctx) => CoinsBalanceCubit(ctx.read<Dio>())..refresh(),
          child: BlocListener<AuthBloc, AuthState>(
            listenWhen: (prev, curr) =>
                curr.step == AuthStep.done && prev.step != AuthStep.done,
            listener: (ctx, _) {
              ctx.read<CoinsBalanceCubit>().load();
            },
            child: MainLayout(marketSlug: slug, child: child),
          ),
        );
      },
      routes: [
        GoRoute(
          path: '/market/:slug',
          builder: (context, state) => BlocProvider(
            create: (ctx) => HomeCubit(ctx.read<Dio>())..load(),
            child: HomePage(
              slug: state.pathParameters['slug'] ?? 'dabburiyya',
            ),
          ),
          routes: [
            GoRoute(
              path: 'rewards',
              builder: (context, state) => BlocProvider(
                create: (ctx) => RewardsCubit(ctx.read<Dio>())..load(),
                child: const RewardsPage(),
              ),
            ),
            GoRoute(
              path: 'offers',
              builder: (context, state) => const OffersPage(),
            ),
            GoRoute(
              path: 'orders',
              builder: (context, state) => BlocProvider(
                create: (ctx) => OrdersCubit(
                  ctx.read<Dio>(),
                  ctx.read<TokenStorage>(),
                ),
                child: const OrdersPage(),
              ),
            ),
            GoRoute(
              path: 'account',
              builder: (context, state) => const AccountPage(),
              routes: [
                GoRoute(
                  path: 'edit-profile',
                  builder: (context, state) => const EditProfilePage(),
                ),
                GoRoute(
                  path: 'addresses',
                  builder: (context, state) => const AddressesPage(),
                ),
                GoRoute(
                  path: 'payment-methods',
                  builder: (context, state) => const PaymentMethodsPage(),
                ),
                GoRoute(
                  path: 'notification-settings',
                  builder: (context, state) => const NotificationSettingsPage(),
                ),
                GoRoute(
                  path: 'help',
                  builder: (context, state) => const HelpSupportPage(),
                ),
              ],
            ),
            GoRoute(
              path: 'store/:storeId',
              builder: (context, state) => StoreDetailPage(
                marketSlug: state.pathParameters['slug']!,
                storeId: state.pathParameters['storeId']!,
              ),
              routes: [
                GoRoute(
                  path: 'product/:productId',
                  builder: (context, state) => ProductDetailsPage(
                    marketSlug: state.pathParameters['slug']!,
                    storeId: state.pathParameters['storeId']!,
                    productId: state.pathParameters['productId']!,
                  ),
                ),
                GoRoute(
                  path: 'category/:categoryId',
                  builder: (context, state) => CategoryProductsPage(
                    marketSlug: state.pathParameters['slug']!,
                    storeId: state.pathParameters['storeId']!,
                    categoryId: state.pathParameters['categoryId']!,
                    title: state.uri.queryParameters['title'],
                  ),
                ),
              ],
            ),
            GoRoute(
              path: 'cart',
              builder: (context, state) => const CartPage(),
            ),
            GoRoute(
              path: 'checkout',
              builder: (context, state) =>
                  CheckoutPage(marketSlug: state.pathParameters['slug'] ?? ''),
            ),
            GoRoute(
              path: 'payment/hyp',
              builder: (context, state) {
                var url = '';
                final extra = state.extra;
                if (extra is String) {
                  url = extra.trim();
                } else if (extra is Map) {
                  url = (extra['url'] ?? extra['paymentUrl'] ?? '')
                      .toString()
                      .trim();
                }
                if (url.isEmpty) {
                  return Scaffold(
                    appBar: AppBar(
                      backgroundColor: AppColors.surface,
                      foregroundColor: AppColors.textPrimary,
                      title: const Text('دفع بالبطاقة'),
                    ),
                    body: const Center(
                      child: Padding(
                        padding: EdgeInsets.all(24),
                        child: Text('رابط الدفع غير مُتاح'),
                      ),
                    ),
                  );
                }
                return HypPaymentWebViewPage(paymentUrl: url);
              },
            ),
          ],
        ),
      ],
    ),
  ],
);
