import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../core/network/dio_client.dart';
import '../core/network/token_storage.dart';
import '../features/auth/data/auth_remote_data_source.dart';
import '../features/auth/data/auth_repository_impl.dart';
import '../features/auth/presentation/bloc/auth_bloc.dart';
import '../features/cart/application/cart_cubit.dart';
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
  }

  @override
  void dispose() {
    _cartCubit.close();
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
        ],
        child: MaterialApp.router(
          title: 'Now Market',
          debugShowCheckedModeBanner: false,
          theme: AppTheme.light,
          scrollBehavior: const NmdAppScrollBehavior(),
          routerConfig: appRouter,
        ),
      ),
    );
  }
}
