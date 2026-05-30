import 'package:flutter/material.dart';

import '../../core/errors/app_error_mapper.dart';
import '../../widgets/app_error_view.dart';

/// Recoverable error presentation with retry.
///
/// Prefer [AppErrorView.fromError] for new code; this wrapper keeps legacy call sites
/// styled consistently.
class NmdErrorState extends StatelessWidget {
  const NmdErrorState({
    super.key,
    required this.title,
    this.message,
    this.onRetry,
    this.retryLabel = 'إعادة المحاولة',
    this.showSupportButton = true,
  });

  factory NmdErrorState.fromError({
    Key? key,
    required Object error,
    VoidCallback? onRetry,
    String? context,
    String? retryLabel,
    bool showSupportButton = true,
  }) {
    final presentation = AppErrorMapper.map(error);
    AppErrorMapper.log(error, context: context);
    return NmdErrorState(
      key: key,
      title: presentation.title,
      message: presentation.message,
      onRetry: onRetry,
      retryLabel: retryLabel ?? 'إعادة المحاولة',
      showSupportButton: showSupportButton,
    );
  }

  final String title;
  final String? message;
  final VoidCallback? onRetry;
  final String retryLabel;
  final bool showSupportButton;

  @override
  Widget build(BuildContext context) {
    return AppErrorView(
      title: title,
      message: message ?? '',
      primaryButtonText: retryLabel,
      onRetry: onRetry,
      showSupportButton: showSupportButton,
      compact: true,
    );
  }
}
