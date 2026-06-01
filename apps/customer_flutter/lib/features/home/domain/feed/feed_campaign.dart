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
  openPopup,
  externalLink,
  none,
}

enum FeedCampaignPlacement {
  top,
  afterSection1,
  afterSection2,
  afterEvery2Rows,
  manualOrder,
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
    this.backgroundStyle = FeedCampaignBackgroundStyle.tealGradient,
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
  final FeedCampaignBackgroundStyle backgroundStyle;

  bool get isWithinSchedule {
    final now = DateTime.now();
    if (startsAt != null && now.isBefore(startsAt!)) return false;
    if (endsAt != null && now.isAfter(endsAt!)) return false;
    return true;
  }

  bool get hasCta => actionType != FeedCampaignActionType.none;

  factory FeedCampaign.fromJson(Map<String, dynamic> json) {
    final actionRaw =
        json['ctaAction']?.toString() ?? json['targetKind']?.toString();
    final typeRaw = json['type']?.toString() ?? json['kind']?.toString();
    final placementRaw = json['placement']?.toString();

    return FeedCampaign(
      id: json['id']?.toString() ?? '',
      marketSlug: json['marketSlug']?.toString() ?? '',
      kind: _kindFrom(typeRaw),
      title: json['title']?.toString() ?? '',
      subtitle: json['subtitle']?.toString() ?? '',
      imageUrl: json['imageUrl']?.toString(),
      ctaLabel: json['ctaLabel']?.toString() ?? 'اكتشف',
      actionType: _actionFrom(actionRaw),
      targetId: json['targetId']?.toString() ??
          json['targetStoreId']?.toString(),
      targetUrl: json['targetUrl']?.toString() ?? json['targetRoute']?.toString(),
      popupBody: json['popupBody']?.toString(),
      active: json['active'] != false,
      placement: _placementFrom(placementRaw),
      manualAfterSection: (json['manualAfterSection'] as num?)?.toInt(),
      priority: (json['priority'] as num?)?.toInt() ?? 0,
      sortOrder: (json['sortOrder'] as num?)?.toInt() ?? 0,
      startsAt: _parseDate(json['startDate'] ?? json['startsAt']),
      endsAt: _parseDate(json['endDate'] ?? json['endsAt']),
      participantCount: (json['participantCount'] as num?)?.toInt(),
      countdownEndsAt: _parseDate(json['countdownEndsAt']),
      categoryLabels: _labelsFrom(json['categoryLabels']),
      backgroundStyle: _bgFrom(json['backgroundStyle']?.toString()),
    );
  }

  static List<String> _labelsFrom(dynamic raw) {
    if (raw is! List) return const [];
    return raw.map((e) => e.toString().trim()).where((e) => e.isNotEmpty).toList();
  }

  static FeedCampaignKind _kindFrom(String? raw) {
    switch ((raw ?? '').toUpperCase().replaceAll('_', '')) {
      case 'HEROBANNER':
      case 'EDITORIALHERO':
        return FeedCampaignKind.heroBanner;
      case 'OFFERSTRIP':
      case 'COMPACTPROMO':
        return FeedCampaignKind.offerStrip;
      case 'COMPETITIONCARD':
      case 'INTERACTIVEEVENT':
        return FeedCampaignKind.competitionCard;
      case 'REWARDCARD':
        return FeedCampaignKind.rewardCard;
      case 'STOREFEATURE':
      case 'ANNOUNCEMENT':
        return FeedCampaignKind.storeFeature;
      case 'POPUPTRIGGER':
        return FeedCampaignKind.popupTrigger;
      case 'CATEGORYDISCOVERY':
        return FeedCampaignKind.categoryDiscovery;
      default:
        return FeedCampaignKind.heroBanner;
    }
  }

  static FeedCampaignActionType _actionFrom(String? raw) {
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

  static FeedCampaignPlacement _placementFrom(String? raw) {
    switch ((raw ?? '').toUpperCase()) {
      case 'TOP':
        return FeedCampaignPlacement.top;
      case 'AFTER_SECTION_1':
        return FeedCampaignPlacement.afterSection1;
      case 'AFTER_SECTION_2':
        return FeedCampaignPlacement.afterSection2;
      case 'MANUAL_ORDER':
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

  static DateTime? _parseDate(dynamic v) {
    if (v == null) return null;
    return DateTime.tryParse(v.toString());
  }
}
