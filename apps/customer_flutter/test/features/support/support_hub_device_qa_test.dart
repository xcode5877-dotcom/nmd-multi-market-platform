import 'package:customer_flutter/core/network/token_storage.dart';
import 'package:customer_flutter/core/support/support_config_repository.dart';
import 'package:customer_flutter/core/support/support_hub_chrome.dart';
import 'package:customer_flutter/core/support/support_route_policy.dart';
import 'package:customer_flutter/features/auth/data/auth_remote_data_source.dart';
import 'package:customer_flutter/features/auth/data/auth_repository_impl.dart';
import 'package:customer_flutter/features/auth/presentation/bloc/auth_bloc.dart';
import 'package:customer_flutter/features/auth/presentation/widgets/auth_bottom_sheet.dart';
import 'package:customer_flutter/features/cart/application/cart_cubit.dart';
import 'package:customer_flutter/features/support/presentation/widgets/support_floating_capsule.dart';
import 'package:customer_flutter/features/support/presentation/widgets/support_floating_hub_host.dart';
import 'package:customer_flutter/features/support/presentation/widgets/support_hub_sheet.dart';
import 'package:customer_flutter/presentation/layouts/main_layout.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() {
    GoogleFonts.config.allowRuntimeFetching = false;
  });

  late Dio dio;
  late GoRouter router;
  late AuthBloc authBloc;
  late CartCubit cartCubit;

  setUp(() {
    SupportConfigRepository.resetSharedCacheForTest();
    SupportHubChrome.resetForTest();
    resetAuthSheetOpenForTest();

    dio = Dio(BaseOptions(baseUrl: 'https://example.test/api'));
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          final p = options.path;
          if (p.contains('config/support') || p.contains('analytics/support')) {
            handler.resolve(
              Response<dynamic>(
                requestOptions: options,
                statusCode: 200,
                data: p.contains('analytics')
                    ? {'ok': true}
                    : {
                        'support': {
                          'supportPhone': '0548289765',
                          'supportWhatsapp': '0548289765',
                          'supportEnabled': true,
                          'phoneEnabled': true,
                          'whatsappEnabled': true,
                          'workingHours': '09:00 – 21:00',
                          'supportTitle': 'كيف يمكننا مساعدتك؟',
                          'supportDescription': 'فريق Now Market جاهز لمساعدتك',
                          'defaultWhatsappMessage': 'مرحبًا',
                          'floatingSupportAnimationEnabled': false,
                        },
                      },
              ),
            );
            return;
          }
          handler.reject(
            DioException(requestOptions: options, error: 'unexpected $p'),
          );
        },
      ),
    );

    final tokens = TokenStorage();
    authBloc = AuthBloc(
      AuthRepositoryImpl(
        remote: AuthRemoteDataSource(dio),
        tokenStorage: tokens,
      ),
    );
    cartCubit = CartCubit();

    router = GoRouter(
      navigatorKey: SupportHubChrome.rootNavigatorKey,
      observers: [SupportHubChrome.modalObserver],
      initialLocation: '/market/dabburiyya',
      routes: [
        ShellRoute(
          builder: (context, state, child) => MainLayout(
            marketSlug: state.pathParameters['slug'] ?? 'dabburiyya',
            child: child,
          ),
          routes: [
            GoRoute(
              path: '/market/:slug',
              builder: (_, __) =>
                  const Scaffold(body: Center(child: Text('HOME'))),
            ),
          ],
        ),
      ],
    );
  });

  tearDown(() async {
    resetAuthSheetOpenForTest();
    customerAuthSheetOpen.value = false;
    await authBloc.close();
    await cartCubit.close();
    router.dispose();
    SupportConfigRepository.resetSharedCacheForTest();
    SupportHubChrome.resetForTest();
  });

  Widget harness() {
    return MultiRepositoryProvider(
      providers: [
        RepositoryProvider<Dio>.value(value: dio),
        RepositoryProvider<TokenStorage>.value(value: TokenStorage()),
      ],
      child: MultiBlocProvider(
        providers: [
          BlocProvider<AuthBloc>.value(value: authBloc),
          BlocProvider<CartCubit>.value(value: cartCubit),
        ],
        child: MaterialApp.router(
          routerConfig: router,
          builder: (context, child) {
            return SupportFloatingHubHost(
              router: router,
              modalDepth: SupportHubChrome.modalDepth,
              child: child ?? const SizedBox.shrink(),
            );
          },
        ),
      ),
    );
  }

  testWidgets('help tap opens support sheet when navigator is wired',
      (tester) async {
    await tester.pumpWidget(harness());
    await tester.pumpAndSettle();

    expect(find.byKey(const ValueKey('nmd-support-capsule')), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('nmd-support-capsule')));
    await tester.pumpAndSettle();

    expect(find.byType(SupportHubSheet), findsOneWidget);
  });

  testWidgets('help hidden while root modal sheet is open', (tester) async {
    await tester.pumpWidget(harness());
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('nmd-support-capsule')), findsOneWidget);

    final navContext = SupportHubChrome.navigatorContext;
    expect(navContext, isNotNull);
    showModalBottomSheet<void>(
      context: navContext!,
      builder: (_) => const SizedBox(height: 120, child: Text('MODAL')),
    );
    await tester.pump();
    await tester.pump();

    expect(find.byKey(const ValueKey('nmd-support-capsule')), findsNothing);

    await tester.tapAt(const Offset(20, 20));
    await tester.pumpAndSettle();

    expect(find.byKey(const ValueKey('nmd-support-capsule')), findsOneWidget);
  });

  test('auth sheet notifier drives modal policy', () {
    customerAuthSheetOpen.value = false;
    expect(
      SupportRoutePolicy.evaluate(
        path: '/market/dabburiyya',
        modalRouteActive: customerAuthSheetOpen.value,
      ).visible,
      isTrue,
    );
    customerAuthSheetOpen.value = true;
    expect(
      SupportRoutePolicy.evaluate(
        path: '/market/dabburiyya',
        modalRouteActive: customerAuthSheetOpen.value,
      ).visible,
      isFalse,
    );
    customerAuthSheetOpen.value = false;
  });

  testWidgets('help hidden while keyboard is visible', (tester) async {
    await tester.pumpWidget(
      MediaQuery(
        data: const MediaQueryData(
          viewInsets: EdgeInsets.only(bottom: 280),
          size: Size(360, 800),
        ),
        child: harness(),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byKey(const ValueKey('nmd-support-capsule')), findsNothing);
  });

  testWidgets('dead navigator shows feedback snackbar', (tester) async {
    final routerWithoutKey = GoRouter(
      initialLocation: '/market/dabburiyya',
      routes: [
        GoRoute(
          path: '/market/:slug',
          builder: (_, __) =>
              const Scaffold(body: Center(child: Text('HOME'))),
        ),
      ],
    );
    addTearDown(routerWithoutKey.dispose);

    await tester.pumpWidget(
      MultiRepositoryProvider(
        providers: [
          RepositoryProvider<Dio>.value(value: dio),
          RepositoryProvider<TokenStorage>.value(value: TokenStorage()),
        ],
        child: MaterialApp.router(
          routerConfig: routerWithoutKey,
          builder: (context, child) {
            return SupportFloatingHubHost(
              router: routerWithoutKey,
              modalDepth: SupportHubChrome.modalDepth,
              child: child ?? const SizedBox.shrink(),
            );
          },
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const ValueKey('nmd-support-capsule')));
    await tester.pump();

    expect(find.text('تعذر فتح المساعدة. حاول مرة أخرى.'), findsOneWidget);
  });

  test('contest popup policy: home route only', () {
    expect(
      SupportRoutePolicy.evaluate(path: '/market/dabburiyya').visible,
      isTrue,
    );
    expect(
      SupportRoutePolicy.evaluate(
        path: '/market/dabburiyya/store/x/product/y',
      ).visible,
      isFalse,
    );
  });
}
