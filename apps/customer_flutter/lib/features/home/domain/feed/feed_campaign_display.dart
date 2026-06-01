import 'feed_campaign.dart';

/// How a campaign should render in the home feed (editorial, not ad banners).
extension FeedCampaignDisplay on FeedCampaign {
  bool get showsAsFoodMood =>
      kind == FeedCampaignKind.categoryDiscovery ||
      (categoryLabels.isNotEmpty &&
          (kind == FeedCampaignKind.heroBanner ||
              kind == FeedCampaignKind.popupTrigger));

  bool get showsAsNewStoreStory =>
      kind == FeedCampaignKind.storeFeature ||
      ((kind == FeedCampaignKind.heroBanner ||
              kind == FeedCampaignKind.popupTrigger) &&
          !showsAsFoodMood);
}
