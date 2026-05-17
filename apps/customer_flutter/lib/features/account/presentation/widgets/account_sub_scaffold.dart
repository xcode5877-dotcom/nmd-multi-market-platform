import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../design_system/design_system.dart';

/// Account sub-routes use this instead of the shell [GlobalNmdHeader] (see [MainLayout]).
class AccountSubScaffold extends StatelessWidget {
  const AccountSubScaffold({
    super.key,
    required this.title,
    required this.body,
    this.bottomNavigationBar,
    this.floatingActionButton,
    this.floatingActionButtonLocation,
  });

  final String title;
  final Widget body;
  final Widget? bottomNavigationBar;
  final Widget? floatingActionButton;
  final FloatingActionButtonLocation? floatingActionButtonLocation;

  @override
  Widget build(BuildContext context) {
    final slug = GoRouterState.of(context).pathParameters['slug'] ?? '';

    return ColoredBox(
      color: NmdColors.surfaceMuted,
      child: Scaffold(
        backgroundColor: NmdColors.surfaceMuted,
        body: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            NmdAppHeader(
              title: title,
              leading: NmdAppHeader.backLeading(
                onPressed: () {
                  if (context.canPop()) {
                    context.pop();
                  } else {
                    context.go('/market/$slug/account');
                  }
                },
              ),
            ),
            Expanded(child: body),
          ],
        ),
        bottomNavigationBar: bottomNavigationBar,
        floatingActionButton: floatingActionButton,
        floatingActionButtonLocation: floatingActionButtonLocation,
      ),
    );
  }
}
