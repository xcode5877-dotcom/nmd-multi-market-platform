import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// Pops when possible; otherwise navigates to a safe market or picker route.
void safeNmdBack(
  BuildContext context, {
  String? marketSlug,
  bool preferMarketPicker = false,
}) {
  if (!context.mounted) return;

  final slug = _resolveMarketSlug(context, marketSlug);
  final marketHome =
      slug.isNotEmpty ? '/market/${Uri.encodeComponent(slug)}' : null;

  try {
    final router = GoRouter.of(context);
    if (!preferMarketPicker && router.canPop()) {
      router.pop();
      return;
    }
  } catch (_) {
    // Router not ready — fall through to go().
  }

  if (preferMarketPicker) {
    context.go('/main');
    return;
  }
  if (marketHome != null) {
    context.go(marketHome);
    return;
  }
  context.go('/main');
}

String _resolveMarketSlug(BuildContext context, String? explicit) {
  final fromArg = explicit?.trim() ?? '';
  if (fromArg.isNotEmpty) return fromArg;
  try {
    final slug = GoRouterState.of(context).pathParameters['slug']?.trim();
    if (slug != null && slug.isNotEmpty) return slug;
  } catch (_) {}
  return '';
}
