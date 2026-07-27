import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../core/network/dio_client.dart';
import '../core/network/token_storage.dart';
import '../features/account/application/customer_profile_cubit.dart';
import '../features/auth/data/auth_remote_data_source.dart';
import '../features/auth/data/auth_repository_impl.dart';
import '../features/auth/presentation/bloc/auth_bloc.dart';
import '../features/cart/application/cart_cubit.dart';
import '../features/loyalty/application/coins_balance_cubit.dart';
import '../features/loyalty/application/coins_balance_registry.dart';
import '../core/bootstrap/first_frame_controller.dart';
import '../core/debug/boot_trace.dart';
import '../core/debug/order_window_route_observer.dart';
import '../core/push/push_notification_listener.dart';
import '../core/support/support_hub_chrome.dart';
import '../features/support/presentation/widgets/support_floating_hub_host.dart';
import 'app_scroll_behavior.dart';
import 'router.dart';
import 'theme/app_theme.dart';

class NowMarketApp extends StatefulWidget {
  const NowMarketApp({super.key});

  @override
  State<NowMarketApp> createState() => _NowMarketAppState();
}

class _NowMarketAppState extends State<NowMarketApp> {
  late final TokenStorage _tokenStorage;
  late final Dio _dio;
  late final AuthRemoteDataSource _authRemoteDataSource;
  late final AuthRepositoryImpl _authRepository;
  late final AuthBloc _authBloc;
  late final CartCubit _cartCubit;
  late final CustomerProfileCubit _customerProfileCubit;
  late final CoinsBalanceCubit _coinsBalanceCubit;
  late final OrderWindowGoRouterObserver _orderWindowRouteObserver;

  @override
  void initState() {
    super.initState();
    _tokenStorage = TokenStorage();
    _dio = DioClient.create(_tokenStorage);
    _authRemoteDataSource = AuthRemoteDataSource(_dio);
    _authRepository = AuthRepositoryImpl(
      remote: _authRemoteDataSource,
      tokenStorage: _tokenStorage,
    );
    _authBloc = AuthBloc(_authRepository);
    _cartCubit = CartCubit();
    _cartCubit.restorePersisted();
    _customerProfileCubit = CustomerProfileCubit(_dio);
    _coinsBalanceCubit = CoinsBalanceCubit(_dio, _tokenStorage);
    CoinsBalanceRegistry.register(_coinsBalanceCubit);
    // Warm session before first tap (coalesced with splash restore).
    _authBloc.restoreSession().then((ok) {
      if (ok) _customerProfileCubit.refresh();
    });
    _authBloc.stream.listen((state) {
      if (state.step == AuthStep.done) {
        _customerProfileCubit.refresh();
      } else if (state.step == AuthStep.phone) {
        _customerProfileCubit.clear();
      }
    });
    _orderWindowRouteObserver = OrderWindowGoRouterObserver(appRouter);
    // Attach only after first frame is released and router is mounted — never during initState.
    FirstFrameController.instance.addOnReleasedListener((reason) {
      if (!mounted) return;
      _orderWindowRouteObserver.attach();
      bootTrace('OrderWindowGoRouterObserver attached after firstFrame reason=$reason');
    });
  }

  @override
  void dispose() {
    _orderWindowRouteObserver.detach();
    _cartCubit.close();
    _customerProfileCubit.close();
    CoinsBalanceRegistry.register(null);
    _coinsBalanceCubit.close();
    _authBloc.close();
    _dio.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MultiRepositoryProvider(
      providers: [
        RepositoryProvider<TokenStorage>.value(value: _tokenStorage),
        RepositoryProvider<Dio>.value(value: _dio),
        RepositoryProvider<AuthRepositoryImpl>.value(value: _authRepository),
      ],
      child: MultiBlocProvider(
        providers: [
          BlocProvider<AuthBloc>.value(value: _authBloc),
          BlocProvider<CartCubit>.value(value: _cartCubit),
          BlocProvider<CustomerProfileCubit>.value(value: _customerProfileCubit),
          BlocProvider<CoinsBalanceCubit>.value(value: _coinsBalanceCubit),
        ],
        child: PushNotificationListener(
          router: appRouter,
          child: MaterialApp.router(
            title: 'Now Market',
            debugShowCheckedModeBanner: false,
            theme: AppTheme.light,
            scrollBehavior: const NmdAppScrollBehavior(),
            routerConfig: appRouter,
            builder: (context, child) {
              final content = child ??
                  const ColoredBox(
                    color: Colors.white,
                    child: Center(child: CircularProgressIndicator()),
                  );
              return SupportFloatingHubHost(
                router: appRouter,
                modalDepth: SupportHubChrome.modalDepth,
                child: content,
              );
            },
          ),
        ),
      ),
    );
  }
}
