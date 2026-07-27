import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../features/auth/presentation/bloc/auth_bloc.dart';
import '../../features/auth/presentation/widgets/auth_bottom_sheet.dart';

/// Synchronous logged-in check — [AuthBloc] is the UI source of truth.
bool isCustomerLoggedIn(BuildContext context) {
  return context.read<AuthBloc>().state.step == AuthStep.done;
}

void _authAudit(String message) {
  if (kDebugMode) {
    debugPrint('[AUTH-AUDIT] $message');
  }
}

/// Presents the OTP/login bottom sheet when [AuthBloc] is not [AuthStep.done].
Future<bool> presentCustomerLogin(BuildContext context) async {
  _authAudit(
    'presentCustomerLogin start mounted=${context.mounted} '
    'step=${context.read<AuthBloc>().state.step.name}',
  );

  if (isCustomerLoggedIn(context)) {
    _authAudit('presentCustomerLogin skip — already logged in');
    return true;
  }

  if (!context.mounted) {
    _authAudit('presentCustomerLogin abort — context unmounted');
    return false;
  }

  recoverStuckAuthSheetIfNeeded(context);

  _authAudit('presentCustomerLogin → showNmdAuthBottomSheet');
  final ok = await showNmdAuthBottomSheet(context);

  if (!context.mounted) {
    _authAudit('presentCustomerLogin done unmounted ok=$ok');
    return ok;
  }

  final step = context.read<AuthBloc>().state.step;
  _authAudit('presentCustomerLogin closed ok=$ok step=${step.name}');
  return ok && step == AuthStep.done;
}
