import 'package:flutter/material.dart';

import 'nmd_colors.dart';

/// Operational / order status semantic colors for store and order UI.
enum NmdStoreStatus { open, busy, closed, unknown }

enum NmdBadgeTone { brand, gold, success, warning, error, neutral, info }

/// Maps API operational status strings to semantic presentation.
abstract final class NmdSemantic {
  static NmdStoreStatus storeStatusFromApi(String? raw) {
    final s = (raw ?? '').trim().toLowerCase();
    return switch (s) {
      'open' => NmdStoreStatus.open,
      'busy' => NmdStoreStatus.busy,
      'closed' => NmdStoreStatus.closed,
      _ => NmdStoreStatus.unknown,
    };
  }

  static Color storeStatusBackground(NmdStoreStatus status) => switch (status) {
        NmdStoreStatus.open => NmdColors.successSoft,
        NmdStoreStatus.busy => NmdColors.warningSoft,
        NmdStoreStatus.closed => const Color(0xFFF1F5F9),
        NmdStoreStatus.unknown => const Color(0xFFF1F5F9),
      };

  static Color storeStatusForeground(NmdStoreStatus status) => switch (status) {
        NmdStoreStatus.open => NmdColors.success,
        NmdStoreStatus.busy => NmdColors.warning,
        NmdStoreStatus.closed => NmdColors.textSecondary,
        NmdStoreStatus.unknown => NmdColors.textSecondary,
      };

  static String storeStatusLabelAr(NmdStoreStatus status) => switch (status) {
        NmdStoreStatus.open => 'مفتوح',
        NmdStoreStatus.busy => 'مزدحم',
        NmdStoreStatus.closed => 'مغلق',
        NmdStoreStatus.unknown => '—',
      };

  static Color badgeBackground(NmdBadgeTone tone) => switch (tone) {
        NmdBadgeTone.brand => NmdColors.brandPrimary,
        NmdBadgeTone.gold => NmdColors.accentGold,
        NmdBadgeTone.success => NmdColors.success,
        NmdBadgeTone.warning => NmdColors.warning,
        NmdBadgeTone.error => NmdColors.error,
        NmdBadgeTone.neutral => const Color(0xFF64748B),
        NmdBadgeTone.info => NmdColors.info,
      };

  static Color badgeForeground(NmdBadgeTone tone) => switch (tone) {
        NmdBadgeTone.gold => const Color(0xFF1A1A1A),
        _ => NmdColors.textOnBrand,
      };
}
