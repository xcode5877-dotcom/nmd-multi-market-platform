import 'feed_campaign.dart';

/// How a campaign should render in the home feed (editorial, not ad banners).
extension FeedCampaignDisplay on FeedCampaign {
  bool get showsAsFoodMood => kind == FeedCampaignKind.categoryDiscovery;

  bool get showsAsFloatingGlass =>
      kind == FeedCampaignKind.offerStrip ||
      kind == FeedCampaignKind.rewardCard ||
      kind == FeedCampaignKind.competitionCard;
}
