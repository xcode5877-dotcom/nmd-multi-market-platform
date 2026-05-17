import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../network/token_storage.dart';
import '../../features/auth/presentation/widgets/auth_bottom_sheet.dart';

/// Returns true if the user has a customer token or completes OTP successfully.
Future<bool> ensureCustomerAuth(BuildContext context) async {
  final tokenStorage = context.read<TokenStorage>();
  final token = await tokenStorage.getCustomerToken();
  if (token != null && token.isNotEmpty) return true;
  if (!context.mounted) return false;
  return showNmdAuthBottomSheet(context);
}
