import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

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

// Account navigation lives in protected_customer_navigation.dart
// (openCustomerAccount → navigateToProtectedCustomerDestination).
