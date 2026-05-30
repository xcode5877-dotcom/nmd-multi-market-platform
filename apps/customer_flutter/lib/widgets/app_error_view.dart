import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../core/errors/app_error_mapper.dart';
import '../core/errors/app_error_type.dart';
import '../core/support/open_support_whatsapp.dart';
import '../design_system/design_system.dart';

/// Branded customer-facing error UI — never shows raw technical details.
class AppErrorView extends StatelessWidget {
  const AppErrorView({
    super.key,
    required this.title,
    required this.message,
    this.type = AppErrorType.unknown,
    this.icon,
    this.primaryButtonText = 'إعادة المحاولة',
    this.onRetry,
    this.secondaryButtonText = 'تواصل مع الدعم',
    this.onSecondaryAction,
    this.showSupportButton = true,
    this.showHomeButton = false,
    this.onGoHome,
    this.compact = false,
  });

  final String title;
  final String message;
  final AppErrorType type;
  final IconData? icon;
  final String primaryButtonText;
  final VoidCallback? onRetry;
  final String secondaryButtonText;
  final VoidCallback? onSecondaryAction;
  final bool showSupportButton;
  final bool showHomeButton;
  final VoidCallback? onGoHome;
  final bool compact;

  factory AppErrorView.fromError({
    Key? key,
    required Object error,
    VoidCallback? onRetry,
    String? context,
    bool showSupportButton = true,
    bool showHomeButton = false,
    VoidCallback? onGoHome,
    bool compact = false,
    String? primaryButtonText,
  }) {
    if (context != null) {
      AppErrorMapper.log(error, context: context);
    } else {
      AppErrorMapper.log(error);
    }
    final presentation = AppErrorMapper.map(error);
    return AppErrorView(
      key: key,
      title: presentation.title,
      message: presentation.message,
      type: presentation.type,
      onRetry: onRetry,
      showSupportButton: showSupportButton,
      showHomeButton: showHomeButton,
      onGoHome: onGoHome,
      compact: compact,
      primaryButtonText: primaryButtonText ?? 'إعادة المحاولة',
    );
  }

  factory AppErrorView.fromHttpStatus({
    Key? key,
    required int? statusCode,
    VoidCallback? onRetry,
    String? context,
    String? endpoint,
    String? rawResponse,
    String? errorMessage,
    bool showSupportButton = true,
    bool compact = false,
  }) {
    if (context != null) {
      AppErrorMapper.logHttp(
        context: context,
        statusCode: statusCode,
        endpoint: endpoint,
        rawResponse: rawResponse,
        errorMessage: errorMessage,
      );
    }
    final presentation = AppErrorMapper.mapHttpStatus(statusCode);
    return AppErrorView(
      key: key,
      title: presentation.title,
      message: presentation.message,
      type: presentation.type,
      onRetry: onRetry,
      showSupportButton: showSupportButton,
      compact: compact,
    );
  }

  IconData get _resolvedIcon {
    if (icon != null) return icon!;
    return switch (type) {
      AppErrorType.noConnection => Icons.wifi_off_rounded,
      AppErrorType.timeout => Icons.hourglass_top_rounded,
      AppErrorType.server => Icons.cloud_off_rounded,
      AppErrorType.notFound => Icons.search_off_rounded,
      AppErrorType.unauthorized => Icons.lock_outline_rounded,
      AppErrorType.maintenance => Icons.construction_rounded,
      AppErrorType.unknown => Icons.sentiment_dissatisfied_outlined,
    };
  }

  Future<void> _defaultSupportAction(BuildContext context) async {
    await launchNmdSupportWhatsApp(
      messenger: ScaffoldMessenger.maybeOf(context),
    );
  }

  @override
  Widget build(BuildContext context) {
    final content = _ErrorCard(
      title: title,
      message: message,
      icon: _resolvedIcon,
      primaryButtonText: primaryButtonText,
      onRetry: onRetry,
      secondaryButtonText: secondaryButtonText,
      onSecondaryAction: onSecondaryAction ??
          (showSupportButton ? () => _defaultSupportAction(context) : null),
      showSupportButton: showSupportButton,
      showHomeButton: showHomeButton,
      onGoHome: onGoHome ?? (showHomeButton ? () => context.go('/main') : null),
      compact: compact,
    );

    if (compact) {
      return content;
    }

    return ColoredBox(
      color: NmdColors.surfaceBase,
      child: Center(
        child: SingleChildScrollView(
          primary: false,
          padding: const EdgeInsets.all(NmdSpacing.xl),
          child: content,
        ),
      ),
    );
  }
}

class _ErrorCard extends StatelessWidget {
  const _ErrorCard({
    required this.title,
    required this.message,
    required this.icon,
    required this.primaryButtonText,
    required this.onRetry,
    required this.secondaryButtonText,
    required this.onSecondaryAction,
    required this.showSupportButton,
    required this.showHomeButton,
    required this.onGoHome,
    required this.compact,
  });

  final String title;
  final String message;
  final IconData icon;
  final String primaryButtonText;
  final VoidCallback? onRetry;
  final String secondaryButtonText;
  final VoidCallback? onSecondaryAction;
  final bool showSupportButton;
  final bool showHomeButton;
  final VoidCallback? onGoHome;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: TextDirection.rtl,
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: compact ? double.infinity : 360),
        child: Padding(
          padding: EdgeInsets.symmetric(
            horizontal: compact ? NmdSpacing.md : NmdSpacing.lg,
            vertical: compact ? NmdSpacing.lg : NmdSpacing.xl,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: compact ? 72 : 88,
                height: compact ? 72 : 88,
                decoration: BoxDecoration(
                  color: NmdColors.tintAliveSoft,
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  icon,
                  size: compact ? 34 : 40,
                  color: NmdColors.brandPrimary,
                ),
              ),
              SizedBox(height: compact ? NmdSpacing.sm : NmdSpacing.md),
              Text(
                title,
                textAlign: TextAlign.center,
                style: NmdTypography.h2.copyWith(
                  fontSize: compact ? 18 : 20,
                  height: 1.25,
                ),
              ),
              const SizedBox(height: NmdSpacing.xs),
              if (message.isNotEmpty)
                Text(
                  message,
                  textAlign: TextAlign.center,
                  style: NmdTypography.bodySmall.copyWith(
                    color: NmdColors.textSecondary,
                    height: 1.55,
                  ),
                ),
              if (onRetry != null) ...[
                SizedBox(height: compact ? NmdSpacing.md : NmdSpacing.lg),
                NmdButton(
                  label: primaryButtonText,
                  onPressed: onRetry,
                  expand: true,
                  size: NmdButtonSize.medium,
                ),
              ],
              if (showSupportButton && onSecondaryAction != null) ...[
                const SizedBox(height: NmdSpacing.sm),
                NmdButton(
                  label: secondaryButtonText,
                  onPressed: onSecondaryAction,
                  variant: NmdButtonVariant.secondary,
                  expand: true,
                  size: NmdButtonSize.medium,
                ),
              ],
              if (showHomeButton && onGoHome != null) ...[
                const SizedBox(height: NmdSpacing.xs),
                TextButton(
                  onPressed: onGoHome,
                  child: Text(
                    'العودة للرئيسية',
                    style: NmdTypography.label.copyWith(
                      color: NmdColors.brandPrimary,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
