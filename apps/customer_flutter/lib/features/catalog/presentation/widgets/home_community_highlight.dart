import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../design_system/design_system.dart';

/// Alive community band — uses real market name and optional counts only.
class HomeCommunityHighlight extends StatelessWidget {
  const HomeCommunityHighlight({
    super.key,
    required this.marketSlug,
    this.marketName,
    this.pillarCount,
    this.storeCount,
  });

  final String marketSlug;
  final String? marketName;
  final int? pillarCount;
  final int? storeCount;

  @override
  Widget build(BuildContext context) {
    final name = (marketName ?? '').trim();
    if (name.isEmpty && pillarCount == null && storeCount == null) {
      return const SizedBox.shrink();
    }

    final stats = <String>[];
    if (pillarCount != null && pillarCount! > 0) {
      stats.add('$pillarCount أقسام');
    }
    if (storeCount != null && storeCount! > 0) {
      stats.add('$storeCount محل');
    }
    final statsLine = stats.join(' · ');

    return Padding(
      padding: const EdgeInsetsDirectional.fromSTEB(
        NmdSpacing.screenHorizontal,
        NmdSpacing.xs,
        NmdSpacing.screenHorizontal,
        NmdSpacing.sm,
      ),
      child: NmdSurface(
        mode: NmdSurfaceMode.alive,
        padding: const EdgeInsets.symmetric(
          horizontal: NmdSpacing.md,
          vertical: NmdSpacing.sm + 2,
        ),
        borderRadius: NmdRadius.borderLg,
        child: Directionality(
          textDirection: TextDirection.rtl,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (name.isNotEmpty)
                      Text(
                        name,
                        textAlign: TextAlign.right,
                        style: NmdTypography.h2,
                      ),
                    const SizedBox(height: NmdSpacing.xxs),
                    Text(
                      statsLine.isNotEmpty
                          ? 'سوقك المحلي · $statsLine'
                          : 'اكتشف محلات مجتمعك المحلي',
                      textAlign: TextAlign.right,
                      style: NmdTypography.bodySmall,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: NmdSpacing.sm),
              _QuickLinkChip(
                icon: Icons.card_giftcard_rounded,
                label: 'المكافآت',
                onTap: () => context.go('/market/$marketSlug/rewards'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _QuickLinkChip extends StatelessWidget {
  const _QuickLinkChip({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: NmdColors.brandPrimary.withValues(alpha: 0.08),
      borderRadius: NmdRadius.borderPill,
      child: InkWell(
        onTap: onTap,
        borderRadius: NmdRadius.borderPill,
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: NmdSpacing.sm,
            vertical: NmdSpacing.xxs + 2,
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 18, color: NmdColors.brandPrimary),
              const SizedBox(width: 6),
              Text(
                label,
                style:
                    NmdTypography.label.copyWith(color: NmdColors.brandPrimary),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
