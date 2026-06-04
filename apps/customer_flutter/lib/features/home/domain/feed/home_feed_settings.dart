enum HomeFeedSpacingStyle {
  compact,
  normal,
  spacious,
}

/// Default rhythm: up to 3 promos on main home, first after section 1, then every 2 sections.
class HomeFeedSettings {
  const HomeFeedSettings({
    this.maxBlocksPerHome = 3,
    this.maxPromoBlocksPerHome = 3,
    this.minStoreSectionsBetweenPromos = 2,
    this.firstPromoAfterSectionIndex = 1,
    this.spacingStyle = HomeFeedSpacingStyle.normal,
    this.preventAdjacentLargeVisual = true,
    this.showLegacyBanners = true,
    this.showPillars = true,
  });

  /// Legacy alias — prefer [maxPromoBlocksPerHome].
  final int maxBlocksPerHome;

  final int maxPromoBlocksPerHome;
  final int minStoreSectionsBetweenPromos;

  /// 1-based store section index after which the first promo may appear.
  final int firstPromoAfterSectionIndex;
  final HomeFeedSpacingStyle spacingStyle;
  final bool preventAdjacentLargeVisual;
  final bool showLegacyBanners;
  final bool showPillars;

  int get effectiveMaxPromos =>
      maxPromoBlocksPerHome > 0 ? maxPromoBlocksPerHome : maxBlocksPerHome;

  static const defaults = HomeFeedSettings();

  factory HomeFeedSettings.fromJson(Map<String, dynamic>? json) {
    if (json == null || json.isEmpty) return defaults;
    final maxPromo = (json['maxPromoBlocksPerHome'] as num?)?.toInt() ??
        (json['maxBlocksPerHome'] as num?)?.toInt() ??
        3;
    return HomeFeedSettings(
      maxBlocksPerHome: maxPromo.clamp(0, 6),
      maxPromoBlocksPerHome: maxPromo.clamp(0, 6),
      minStoreSectionsBetweenPromos:
          (json['minStoreSectionsBetweenPromos'] as num?)?.toInt().clamp(1, 12) ??
              2,
      firstPromoAfterSectionIndex:
          (json['firstPromoAfterSectionIndex'] as num?)?.toInt().clamp(1, 12) ??
              1,
      spacingStyle: _spacingFrom(json['spacingStyle']?.toString()),
      preventAdjacentLargeVisual: json['preventAdjacentLargeVisual'] != false,
      showLegacyBanners: json['showLegacyBanners'] != false,
      showPillars: json['showPillars'] != false,
    );
  }

  static HomeFeedSpacingStyle _spacingFrom(String? raw) {
    switch ((raw ?? '').toLowerCase()) {
      case 'compact':
        return HomeFeedSpacingStyle.compact;
      case 'spacious':
        return HomeFeedSpacingStyle.spacious;
      default:
        return HomeFeedSpacingStyle.normal;
    }
  }

  double get blockVerticalPadding {
    switch (spacingStyle) {
      case HomeFeedSpacingStyle.compact:
        return 6;
      case HomeFeedSpacingStyle.spacious:
        return 16;
      case HomeFeedSpacingStyle.normal:
        return 10;
    }
  }
}
