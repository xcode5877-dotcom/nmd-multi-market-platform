import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import 'auth_failure.dart';
import '../network/token_storage.dart';
import '../debug/nmd_post_login_trace.dart';
import '../../features/auth/presentation/bloc/auth_bloc.dart';
import '../../features/auth/presentation/widgets/auth_bottom_sheet.dart';

/// Clears stored JWT and resets [AuthBloc] after an invalid/expired session.
Future<void> invalidateCustomerSession(BuildContext context) async {
  await context.read<TokenStorage>().clear();
  if (!context.mounted) return;
  context.read<AuthBloc>().add(const AuthResetRequested());
}

/// Session expired UX: clear token, notify, then open OTP sheet.
Future<bool> handleSessionExpired(BuildContext context) async {
  await invalidateCustomerSession(context);
  if (!context.mounted) return false;
  ScaffoldMessenger.of(context).showSnackBar(
    const SnackBar(content: Text(kSessionExpiredMessage)),
  );
  return showNmdAuthBottomSheet(context);
}

/// True when [AuthBloc] is synced or a stored customer JWT restores successfully.
Future<bool> isCustomerSessionActive(BuildContext context) async {
  final authBloc = context.read<AuthBloc>();
  if (authBloc.state.step == AuthStep.done) return true;

  final token = await context.read<TokenStorage>().getCustomerToken();
  if (!context.mounted) return false;
  if (token == null || token.isEmpty) return false;

  try {
    return await authBloc.restoreSession().timeout(const Duration(seconds: 8));
  } on TimeoutException {
    return authBloc.state.step == AuthStep.done;
  }
}

/// Returns true when the customer has a valid session (token + [AuthBloc] synced)
/// or completes OTP in the auth bottom sheet.
Future<bool> ensureCustomerAuth(BuildContext context) async {
  nmdPostLoginTrace('POST_LOGIN_ENSURE_START');
  if (await isCustomerSessionActive(context)) {
    nmdPostLoginTrace('POST_LOGIN_ENSURE_ALREADY_ACTIVE');
    return true;
  }
  if (!context.mounted) return false;

  final ok = await showNmdAuthBottomSheet(context);

  /// Large iPad form sheets sometimes deactivate the initiating [Element]
  /// earlier than callers expect — [GoRouter] is still valid via [router].
  if (!context.mounted) {
    nmdPostLoginTrace('AUTH_SHEET_CLOSED_UNMOUNTED_ENSURE', 'ok=$ok');
    return ok;
  }

  if (ok) {
    nmdPostLoginTrace('POST_LOGIN_ENSURE_OK');
  }
  return ok;
}

/// Account tab: logged-in users go to account; guests get the OTP sheet (then account on success).
Future<void> openCustomerAccount(BuildContext context, String marketSlug) async {
  nmdPostLoginTrace('OPEN_CUSTOMER_ACCOUNT_START marketSlug=$marketSlug');

  final slug = GoRouterState.of(context).pathParameters['slug'] ?? marketSlug;
  final trimmedSlug = slug.trim();
  final target = '/market/$trimmedSlug/account';

  GoRouter router;
  try {
    router = GoRouter.of(context);
  } catch (e, st) {
    nmdPostLoginTrace('ROUTER_LOOKUP_FAILED_ACCOUNT', '$e\n$st');
    rethrow;
  }

  if (trimmedSlug.isEmpty) {
    nmdPostLoginTrace('OPEN_CUSTOMER_ACCOUNT_SKIP_NO_MARKET_SLUG');
    return;
  }

  if (await isCustomerSessionActive(context)) {
    nmdPostLoginTrace('OPEN_CUSTOMER_ACCOUNT_SESSION_ACTIVE_NAV', target);
    if (!context.mounted) {
      nmdPostLoginTrace('NAVIGATING_TO_HOME_ACCOUNT_ROUTER_FALLBACK mounted=false');
      router.go(target);
      return;
    }
    context.go(target);
    return;
  }
  if (!context.mounted) return;

  nmdPostLoginTrace('SHOW_AUTH_BOTTOM_SHEET');
  await showNmdAuthBottomSheet(context);

  /// Always route to account once the sheet is closed so the UX never stalls.
  /// On iPad, [context.mounted] can be false right after dismissal even though routing is OK.
  if (!context.mounted) {
    nmdPostLoginTrace('NAVIGATING_TO_ACCOUNT_ROUTER_FALLBACK mounted=false → $target');
    router.go(target);
    return;
  }

  nmdPostLoginTrace('NAVIGATING_TO_ACCOUNT', target);
  context.go(target);
}
