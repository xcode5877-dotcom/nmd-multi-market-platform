import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../features/auth/presentation/bloc/auth_bloc.dart';
import '../../features/loyalty/application/coins_balance_cubit.dart';
import '../network/token_storage.dart';

/// Signs the customer out of the local session.
///
/// Clears the access token, AuthBloc state, and coins cache.
/// Does **not** clear cart contents, selected market, or app settings.
///
/// Callers that hold contest/rewards session caches should invalidate them
/// separately (token key already cleared here).
Future<void> performCustomerLogout(BuildContext context) async {
  if (kDebugMode) {
    debugPrint('[AUTH-AUDIT] performCustomerLogout start');
  }

  await context.read<TokenStorage>().clear();
  if (!context.mounted) return;

  try {
    context.read<CoinsBalanceCubit>().clearForLogout();
  } catch (_) {
    // Coins cubit may be absent in isolated tests.
  }

  context.read<AuthBloc>().add(const AuthResetRequested());

  if (kDebugMode) {
    debugPrint('[AUTH-AUDIT] performCustomerLogout done (cart preserved)');
  }
}
