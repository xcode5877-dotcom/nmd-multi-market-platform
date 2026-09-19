import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../support/support_config_repository.dart';
import '../support/support_route_policy.dart';
import '../../features/support/presentation/widgets/support_hub_sheet.dart';
import '../../app/app_routes.dart';

/// Opens the support hub sheet from header/account (never a floating overlay).
Future<void> openCustomerSupport(
  BuildContext context, {
  required String source,
}) async {
  final path = () {
    try {
      return GoRouterState.of(context).uri.path;
    } catch (_) {
      return '';
    }
  }();
  try {
    final dio = context.read<Dio>();
    final config = await SupportConfigRepository(dio).fetch();
    if (!context.mounted) return;
    if (!config.supportEnabled) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('مركز المساعدة غير متاح حالياً')),
      );
      return;
    }
    await showSupportHubSheet(
      context,
      config: config,
      analyticsSource: source.isNotEmpty
          ? source
          : SupportRoutePolicy.analyticsSourceForPath(path),
    );
  } catch (e, st) {
    debugPrint('openCustomerSupport failed: $e\n$st');
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('تعذر فتح مركز المساعدة حالياً')),
    );
  }
}

/// Navigates to the dedicated help page under Account when preferred.
void goCustomerHelpPage(BuildContext context, String marketSlug) {
  final slug = marketSlug.trim();
  if (slug.isEmpty) return;
  context.push(AppRoutes.help(slug));
}
