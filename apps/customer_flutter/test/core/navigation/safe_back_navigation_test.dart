import 'package:customer_flutter/core/navigation/safe_back_navigation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

void main() {
  testWidgets('safeNmdBack pops child route back to market home', (tester) async {
    final router = GoRouter(
      routes: [
        GoRoute(
          path: '/market/:slug',
          builder: (context, state) => const Scaffold(
            body: Text('market-home'),
          ),
          routes: [
            GoRoute(
              path: 'product/:id',
              builder: (context, state) => Scaffold(
                body: Builder(
                  builder: (ctx) => TextButton(
                    key: const Key('child_back'),
                    onPressed: () => safeNmdBack(
                      ctx,
                      marketSlug: state.pathParameters['slug'],
                    ),
                    child: const Text('back'),
                  ),
                ),
              ),
            ),
          ],
        ),
      ],
      initialLocation: '/market/aljabal/product/p1',
    );

    await tester.pumpWidget(MaterialApp.router(routerConfig: router));
    await tester.pumpAndSettle();
    expect(find.text('back'), findsOneWidget);

    await tester.tap(find.byKey(const Key('child_back')));
    await tester.pumpAndSettle();
    expect(find.text('market-home'), findsOneWidget);
  });

  testWidgets('safeNmdBack with slug and empty stack goes to market home not /main',
      (tester) async {
    final router = GoRouter(
      routes: [
        GoRoute(
          path: '/main',
          builder: (context, state) => const Scaffold(body: Text('main-stub')),
        ),
        GoRoute(
          path: '/market/:slug',
          builder: (context, state) => Scaffold(
            body: Builder(
              builder: (ctx) => TextButton(
                key: const Key('root_back'),
                onPressed: () => safeNmdBack(
                  ctx,
                  marketSlug: state.pathParameters['slug'],
                ),
                child: const Text('home-back'),
              ),
            ),
          ),
        ),
      ],
      initialLocation: '/market/aljabal',
    );

    await tester.pumpWidget(MaterialApp.router(routerConfig: router));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('root_back')));
    await tester.pumpAndSettle();

    expect(find.text('main-stub'), findsNothing);
    expect(find.text('home-back'), findsOneWidget);
  });

  testWidgets('preferMarketPicker without slug may open /main picker', (tester) async {
    final router = GoRouter(
      routes: [
        GoRoute(
          path: '/main',
          builder: (context, state) => const Scaffold(body: Text('market-picker')),
        ),
        GoRoute(
          path: '/orphan',
          builder: (context, state) => Scaffold(
            body: Builder(
              builder: (ctx) => TextButton(
                onPressed: () => safeNmdBack(ctx, preferMarketPicker: true),
                child: const Text('leave'),
              ),
            ),
          ),
        ),
      ],
      initialLocation: '/orphan',
    );

    await tester.pumpWidget(MaterialApp.router(routerConfig: router));
    await tester.pumpAndSettle();
    await tester.tap(find.text('leave'));
    await tester.pumpAndSettle();
    expect(find.text('market-picker'), findsOneWidget);
  });
}
