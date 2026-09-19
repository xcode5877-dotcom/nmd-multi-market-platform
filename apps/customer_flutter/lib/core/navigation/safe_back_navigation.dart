import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// Pops when possible; otherwise navigates to a safe market route.
///
/// Never leaves the user on a blank stub. Prefer the known market home over
/// `/main` whenever a market slug is available.
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

  if (marketHome != null) {
    context.go(marketHome);
    return;
  }

  // No market context — only then open the market picker (never a blank route).
  if (preferMarketPicker || slug.isEmpty) {
    context.go('/main');
  }
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
