import 'feed_campaign.dart';

/// Structured mood chip from admin builder.
class FeedCampaignChip {
  const FeedCampaignChip({
    required this.label,
    this.emoji = '',
    this.iconUrl,
    this.actionType = FeedCampaignActionType.openCategory,
    this.targetId,
    this.targetSlug,
    this.sortOrder = 0,
    this.active = true,
  });

  final String label;
  final String emoji;
  final String? iconUrl;
  final FeedCampaignActionType actionType;
  final String? targetId;
  final String? targetSlug;
  final int sortOrder;
  final bool active;

  String? get resolvedTarget {
    final id = targetId?.trim();
    if (id != null && id.isNotEmpty) return id;
    final slug = targetSlug?.trim();
    if (slug != null && slug.isNotEmpty) return slug;
    return null;
  }

  bool get isActionable {
    if (!active || label.trim().isEmpty) return false;
    if (actionType == FeedCampaignActionType.none) return false;
    switch (actionType) {
      case FeedCampaignActionType.openCategory:
      case FeedCampaignActionType.openStore:
        return resolvedTarget != null;
      case FeedCampaignActionType.openSearch:
        return (resolvedTarget?.isNotEmpty ?? false) || label.trim().isNotEmpty;
      case FeedCampaignActionType.openReward:
      case FeedCampaignActionType.openCompetition:
      case FeedCampaignActionType.openPopup:
      case FeedCampaignActionType.externalLink:
        return true;
      case FeedCampaignActionType.none:
        return false;
    }
  }

  factory FeedCampaignChip.fromJson(Map<String, dynamic> json) {
    final actionRaw = json['action']?.toString() ?? json['actionType']?.toString();
    return FeedCampaignChip(
      label: json['label']?.toString().trim() ?? '',
      emoji: json['emoji']?.toString().trim() ?? '',
      iconUrl: json['iconUrl']?.toString().trim(),
      actionType: FeedCampaign.actionFromApi(actionRaw),
      targetId: json['targetId']?.toString(),
      targetSlug: json['targetSlug']?.toString(),
      sortOrder: (json['sortOrder'] as num?)?.toInt() ?? 0,
      active: json['active'] != false,
    );
  }
}
