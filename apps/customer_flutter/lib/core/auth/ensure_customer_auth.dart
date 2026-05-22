import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../network/token_storage.dart';
import '../../features/auth/presentation/bloc/auth_bloc.dart';
import '../../features/auth/presentation/widgets/auth_bottom_sheet.dart';

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
  if (await isCustomerSessionActive(context)) {
    return true;
  }
  if (!context.mounted) return false;
  return showNmdAuthBottomSheet(context);
}

/// Account tab: logged-in users go to account; guests get the OTP sheet (then account on success).
Future<void> openCustomerAccount(BuildContext context, String marketSlug) async {
  final base = '/market/$marketSlug/account';
  if (await isCustomerSessionActive(context)) {
    if (!context.mounted) return;
    context.go(base);
    return;
  }
  if (!context.mounted) return;
  final ok = await showNmdAuthBottomSheet(context);
  if (!context.mounted) return;
  if (ok) {
    context.go(base);
  } else {
    // Still navigate so the tab never feels dead; page shows sign-in UI.
    context.go(base);
  }
}
