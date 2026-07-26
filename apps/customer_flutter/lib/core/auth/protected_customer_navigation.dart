import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import 'customer_auth_launcher.dart';
import '../../features/auth/presentation/bloc/auth_bloc.dart';

/// Protected shell destinations that require a customer session before routing.
enum ProtectedCustomerDestination {
  account,
  orders,
}

/// Builds the canonical route for [destination] under [marketSlug].
String protectedCustomerRoute(
  String marketSlug,
  ProtectedCustomerDestination destination,
) {
  final slug = marketSlug.trim();
  return switch (destination) {
    ProtectedCustomerDestination.account => '/market/$slug/account',
    ProtectedCustomerDestination.orders => '/market/$slug/orders',
  };
}

bool _protectedCustomerNavBusy = false;

@visibleForTesting
void resetProtectedCustomerNavBusyForTest() {
  _protectedCustomerNavBusy = false;
}

@visibleForTesting
bool protectedCustomerNavBusyForTest() => _protectedCustomerNavBusy;

void _navAudit(String message) {
  if (kDebugMode) {
    debugPrint('[NAV-AUDIT] $message');
  }
}

/// Single entry for Account/Orders from bottom nav, header profile, and shortcuts.
Future<void> navigateToProtectedCustomerDestination(
  BuildContext context, {
  required String marketSlug,
  required ProtectedCustomerDestination destination,
}) async {
  final routeBefore = GoRouterState.of(context).uri.path;
  _navAudit(
    'tap dest=${destination.name} routeBefore=$routeBefore '
    'mounted=${context.mounted} busy=$_protectedCustomerNavBusy',
  );

  if (_protectedCustomerNavBusy) {
    _navAudit('blocked — protected nav busy');
    return;
  }

  _protectedCustomerNavBusy = true;
  try {
    final slug =
        (GoRouterState.of(context).pathParameters['slug'] ?? marketSlug).trim();
    if (slug.isEmpty) {
      _navAudit('abort — empty market slug');
      return;
    }

    final target = protectedCustomerRoute(slug, destination);
    final authStep = context.read<AuthBloc>().state.step;
    _navAudit('target=$target authStep=${authStep.name}');

    GoRouter router;
    try {
      router = GoRouter.of(context);
    } catch (e, st) {
      _navAudit('router lookup failed: $e\n$st');
      return;
    }

    void goTarget() {
      if (context.mounted) {
        context.go(target);
      } else {
        router.go(target);
      }
      _navAudit('navigated → $target');
    }

    if (isCustomerLoggedIn(context)) {
      goTarget();
      return;
    }

    if (!context.mounted) {
      _navAudit('abort — unmounted before login');
      return;
    }

    _navAudit('guest — presenting login before $target');
    final ok = await presentCustomerLogin(context);
    if (!ok) {
      _navAudit('login cancelled/failed — stay on $routeBefore');
      return;
    }

    if (!context.mounted) {
      _navAudit('login ok but unmounted — router.go $target');
      router.go(target);
      return;
    }

    goTarget();
  } catch (e, st) {
    _navAudit('error: $e\n$st');
  } finally {
    _protectedCustomerNavBusy = false;
    _navAudit('protected nav finished busy=false');
  }
}

/// Header / home shortcuts → Account (same protected flow as bottom nav).
Future<void> openCustomerAccount(BuildContext context, String marketSlug) {
  _navAudit('header/home profile tap marketSlug=$marketSlug');
  return navigateToProtectedCustomerDestination(
    context,
    marketSlug: marketSlug,
    destination: ProtectedCustomerDestination.account,
  );
}
