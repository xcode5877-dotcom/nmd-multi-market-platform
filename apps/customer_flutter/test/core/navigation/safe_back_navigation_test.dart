import 'package:customer_flutter/core/navigation/safe_back_navigation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

void main() {
  testWidgets('safeNmdBack does not throw when navigator cannot pop', (
    tester,
  ) async {
    final router = GoRouter(
      routes: [
        GoRoute(
          path: '/market/:slug',
          builder: (context, state) => Scaffold(
            body: Center(
              child: Builder(
                builder: (ctx) => TextButton(
                  onPressed: () => safeNmdBack(
                    ctx,
                    marketSlug: state.pathParameters['slug'],
                  ),
                  child: const Text('back'),
                ),
              ),
            ),
          ),
        ),
      ],
      initialLocation: '/market/dabburiyya',
    );

    await tester.pumpWidget(MaterialApp.router(routerConfig: router));
    await tester.pumpAndSettle();

    await tester.tap(find.text('back'));
    await tester.pumpAndSettle();

    expect(find.text('back'), findsOneWidget);
  });
}
