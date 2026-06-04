import 'feed_campaign_chip.dart';

/// Home feed promo block (presentation/content only).
enum FeedCampaignKind {
  heroBanner,
  offerStrip,
  competitionCard,
  rewardCard,
  storeFeature,
  popupTrigger,
  categoryDiscovery,
}

enum FeedCampaignActionType {
  openStore,
  openReward,
  openCompetition,
  openCategory,
  openSearch,
  openPopup,
  externalLink,
  none,
}

enum FeedCampaignPlacement {
  top,
  topAfterLegacyBanners,
  afterPillars,
  afterSection1,
  afterSection2,
  afterEvery2Rows,
  afterEveryNSections,
  manualOrder,
}

enum FeedCampaignDesignVariant {
  softTeal,
  whiteCard,
  darkTealStrip,
  imageEditorial,
  minimalText,
}

enum FeedCampaignVisualWeight {
  light,
  medium,
  heavy,
}

enum FeedCampaignBackgroundStyle {
  tealGradient,
  navySoft,
  whiteCard,
}

class FeedCampaign {
  const FeedCampaign({
    required this.id,
    required this.marketSlug,
    required this.kind,
    required this.title,
    required this.subtitle,
    required this.ctaLabel,
    required this.actionType,
    this.imageUrl,
    this.targetId,
    this.targetUrl,
    this.popupBody,
    this.active = true,
    this.placement = FeedCampaignPlacement.afterEvery2Rows,
    this.manualAfterSection,
    this.priority = 0,
    this.sortOrder = 0,
    this.startsAt,
    this.endsAt,
    this.participantCount,
    this.countdownEndsAt,
    this.categoryLabels = const [],
    this.chips = const [],
    this.backgroundStyle = FeedCampaignBackgroundStyle.tealGradient,
    this.designVariant = FeedCampaignDesignVariant.softTeal,
    this.visualWeight = FeedCampaignVisualWeight.light,
    this.afterEveryNSections = 2,
    this.allowAdjacentLargeVisual = false,
    this.titleColor,
    this.backgroundColor,
    this.iconEmoji,
  });

  final String id;
  final String marketSlug;
  final FeedCampaignKind kind;
  final String title;
  final String subtitle;
  final String? imageUrl;
  final String ctaLabel;
  final FeedCampaignActionType actionType;
  final String? targetId;
  final String? targetUrl;
  final String? popupBody;
  final bool active;
  final FeedCampaignPlacement placement;
  final int? manualAfterSection;
  final int priority;
  final int sortOrder;
  final DateTime? startsAt;
  final DateTime? endsAt;
  final int? participantCount;
  final DateTime? countdownEndsAt;
  final List<String> categoryLabels;
  final List<FeedCampaignChip> chips;
  final FeedCampaignBackgroundStyle backgroundStyle;
  final FeedCampaignDesignVariant designVariant;
  final FeedCampaignVisualWeight visualWeight;
  final int afterEveryNSections;
  final bool allowAdjacentLargeVisual;
  final String? titleColor;
  final String? backgroundColor;
  final String? iconEmoji;

  bool get isWithinSchedule {
    final now = DateTime.now();
    if (startsAt != null && now.isBefore(startsAt!)) return false;
    if (endsAt != null && now.isAfter(endsAt!)) return false;
    return true;
  }

  bool get hasCta => actionType != FeedCampaignActionType.none;

  bool get isLargeVisual =>
      visualWeight == FeedCampaignVisualWeight.heavy ||
      (kind == FeedCampaignKind.heroBanner &&
          designVariant != FeedCampaignDesignVariant.minimalText) ||
      (kind == FeedCampaignKind.storeFeature &&
          (imageUrl?.isNotEmpty ?? false));

  List<FeedCampaignChip> get moodChips {
    final List<FeedCampaignChip> source;
    if (chips.isNotEmpty) {
      source = chips;
    } else if (categoryLabels.isNotEmpty) {
      source = categoryLabels
          .map((l) => FeedCampaignChip(label: l, emoji: ''))
          .toList();
    } else {
      return const [];
    }
    return source.where((c) => c.active && c.label.trim().isNotEmpty).toList()
      ..sort((a, b) => a.sortOrder.compareTo(b.sortOrder));
  }

  factory FeedCampaign.fromJson(Map<String, dynamic> json) {
    final actionRaw =
        json['ctaAction']?.toString() ?? json['targetKind']?.toString();
    final typeRaw = json['type']?.toString() ?? json['kind']?.toString();
    final placementRaw = json['placement']?.toString();

    return FeedCampaign(
      id: json['id']?.toString() ?? '',
      marketSlug: json['marketSlug']?.toString() ?? '',
      kind: kindFromApi(typeRaw),
      title: json['title']?.toString() ?? '',
      subtitle: json['subtitle']?.toString() ?? '',
      imageUrl: json['imageUrl']?.toString(),
      ctaLabel: json['ctaLabel']?.toString() ?? 'اكتشف',
      actionType: actionFromApi(actionRaw),
      targetId: json['targetId']?.toString() ??
          json['targetStoreId']?.toString(),
      targetUrl: json['targetUrl']?.toString() ?? json['targetRoute']?.toString(),
      popupBody: json['popupBody']?.toString(),
      active: json['active'] != false,
      placement: placementFromApi(placementRaw),
      manualAfterSection: (json['manualAfterSection'] as num?)?.toInt(),
      priority: (json['priority'] as num?)?.toInt() ?? 0,
      sortOrder: (json['sortOrder'] as num?)?.toInt() ?? 0,
      startsAt: _parseDate(json['startDate'] ?? json['startsAt']),
      endsAt: _parseDate(json['endDate'] ?? json['endsAt']),
      participantCount: (json['participantCount'] as num?)?.toInt(),
      countdownEndsAt: _parseDate(json['countdownEndsAt']),
      categoryLabels: _labelsFrom(json['categoryLabels']),
      chips: _chipsFrom(json['chips']),
      backgroundStyle: _bgFrom(json['backgroundStyle']?.toString()),
      designVariant: _designFrom(json['designVariant']?.toString()),
      visualWeight: _weightFrom(json['visualWeight']?.toString(), typeRaw),
      afterEveryNSections:
          (json['afterEveryNSections'] as num?)?.toInt().clamp(1, 12) ?? 2,
      allowAdjacentLargeVisual: json['allowAdjacentLargeVisual'] == true,
      titleColor: json['titleColor']?.toString(),
      backgroundColor: json['backgroundColor']?.toString(),
      iconEmoji: json['iconEmoji']?.toString(),
    );
  }

  static List<String> _labelsFrom(dynamic raw) {
    if (raw is! List) return const [];
    return raw.map((e) => e.toString().trim()).where((e) => e.isNotEmpty).toList();
  }

  static List<FeedCampaignChip> _chipsFrom(dynamic raw) {
    if (raw is! List) return const [];
    return raw
        .whereType<Map>()
        .map((e) => FeedCampaignChip.fromJson(Map<String, dynamic>.from(e)))
        .where((c) => c.label.isNotEmpty)
        .toList();
  }

  static FeedCampaignKind kindFromApi(String? raw) {
    switch ((raw ?? '').toUpperCase().replaceAll('_', '')) {
      case 'HEROBANNER':
      case 'EDITORIALHERO':
      case 'CUSTOMBANNER':
        return FeedCampaignKind.heroBanner;
      case 'OFFERSTRIP':
      case 'COMPACTPROMO':
      case 'GLASSSTRIP':
        return FeedCampaignKind.offerStrip;
      case 'COMPETITIONCARD':
      case 'INTERACTIVEEVENT':
      case 'CHALLENGECARD':
        return FeedCampaignKind.competitionCard;
      case 'REWARDCARD':
      case 'REWARDSDISCOVERY':
        return FeedCampaignKind.rewardCard;
      case 'STOREFEATURE':
      case 'ANNOUNCEMENT':
      case 'FEATUREDSTORESTORY':
        return FeedCampaignKind.storeFeature;
      case 'POPUPTRIGGER':
        return FeedCampaignKind.popupTrigger;
      case 'CATEGORYDISCOVERY':
      case 'MOODDISCOVERY':
        return FeedCampaignKind.categoryDiscovery;
      default:
        return FeedCampaignKind.heroBanner;
    }
  }

  static FeedCampaignActionType actionFromApi(String? raw) {
    switch ((raw ?? '').toUpperCase()) {
      case 'OPEN_STORE':
      case 'STORE':
        return FeedCampaignActionType.openStore;
      case 'OPEN_REWARD':
      case 'REWARD':
        return FeedCampaignActionType.openReward;
      case 'OPEN_COMPETITION':
      case 'EVENT':
        return FeedCampaignActionType.openCompetition;
      case 'OPEN_CATEGORY':
        return FeedCampaignActionType.openCategory;
      case 'OPEN_SEARCH':
        return FeedCampaignActionType.openSearch;
      case 'OPEN_POPUP':
      case 'POPUP':
        return FeedCampaignActionType.openPopup;
      case 'EXTERNAL_LINK':
      case 'ROUTE':
        return FeedCampaignActionType.externalLink;
      case 'NONE':
        return FeedCampaignActionType.none;
      default:
        return FeedCampaignActionType.openPopup;
    }
  }

  static FeedCampaignPlacement placementFromApi(String? raw) {
    switch ((raw ?? '').toUpperCase()) {
      case 'TOP':
        return FeedCampaignPlacement.afterSection1;
      case 'TOP_AFTER_LEGACY_BANNERS':
        return FeedCampaignPlacement.afterSection1;
      case 'AFTER_PILLARS':
        return FeedCampaignPlacement.afterSection1;
      case 'AFTER_SECTION_1':
      case 'AFTER_STORE_SECTION_1':
      case 'AFTER_FIRST_SECTION':
        return FeedCampaignPlacement.afterSection1;
      case 'AFTER_SECTION_2':
      case 'AFTER_STORE_SECTION_2':
      case 'AFTER_SECOND_SECTION':
        return FeedCampaignPlacement.afterSection2;
      case 'AFTER_EVERY_N_SECTIONS':
      case 'AFTER_EVERY_2_SECTIONS':
        return FeedCampaignPlacement.afterEveryNSections;
      case 'MANUAL_ORDER':
      case 'MANUAL_PRIORITY':
        return FeedCampaignPlacement.manualOrder;
      case 'AFTER_EVERY_2_ROWS':
      default:
        return FeedCampaignPlacement.afterEvery2Rows;
    }
  }

  static FeedCampaignBackgroundStyle _bgFrom(String? raw) {
    final normalized = (raw ?? '').toLowerCase().replaceAll('_', '');
    if (normalized.isEmpty) return FeedCampaignBackgroundStyle.tealGradient;
    return FeedCampaignBackgroundStyle.values.firstWhere(
      (e) => e.name.toLowerCase() == normalized,
      orElse: () => FeedCampaignBackgroundStyle.tealGradient,
    );
  }

  static FeedCampaignDesignVariant _designFrom(String? raw) {
    final normalized = (raw ?? '').toLowerCase().replaceAll('_', '');
    if (normalized.isEmpty) return FeedCampaignDesignVariant.softTeal;
    return FeedCampaignDesignVariant.values.firstWhere(
      (e) => e.name.toLowerCase() == normalized,
      orElse: () => FeedCampaignDesignVariant.softTeal,
    );
  }

  static FeedCampaignVisualWeight _weightFrom(String? raw, String? typeRaw) {
    final normalized = (raw ?? '').toLowerCase();
    if (normalized == 'light') return FeedCampaignVisualWeight.light;
    if (normalized == 'medium') return FeedCampaignVisualWeight.medium;
    if (normalized == 'heavy') return FeedCampaignVisualWeight.heavy;
    final type = (typeRaw ?? '').toUpperCase();
    if (type.contains('CUSTOM') || type.contains('HERO')) {
      return FeedCampaignVisualWeight.heavy;
    }
    return FeedCampaignVisualWeight.light;
  }

  static DateTime? _parseDate(dynamic v) {
    if (v == null) return null;
    return DateTime.tryParse(v.toString());
  }
}