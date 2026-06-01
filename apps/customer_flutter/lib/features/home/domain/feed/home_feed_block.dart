import 'feed_campaign.dart';

sealed class HomeFeedBlock {}

class HomeFeedStoreSection {
  const HomeFeedStoreSection({
    required this.title,
    required this.storeIds,
    required this.index,
  });

  final String title;
  final List<String> storeIds;
  final int index;
}

class StoreSectionFeedBlock extends HomeFeedBlock {
  StoreSectionFeedBlock({required this.section});

  final HomeFeedStoreSection section;
}

class HeroBannerFeedBlock extends HomeFeedBlock {
  HeroBannerFeedBlock({required this.campaign});

  final FeedCampaign campaign;
}

class OfferStripFeedBlock extends HomeFeedBlock {
  OfferStripFeedBlock({required this.campaign});

  final FeedCampaign campaign;
}

class CompetitionCardFeedBlock extends HomeFeedBlock {
  CompetitionCardFeedBlock({required this.campaign});

  final FeedCampaign campaign;
}

class RewardCardFeedBlock extends HomeFeedBlock {
  RewardCardFeedBlock({required this.campaign});

  final FeedCampaign campaign;
}

class StoreFeatureFeedBlock extends HomeFeedBlock {
  StoreFeatureFeedBlock({required this.campaign});

  final FeedCampaign campaign;
}

class CategoryDiscoveryFeedBlock extends HomeFeedBlock {
  CategoryDiscoveryFeedBlock({required this.campaign});

  final FeedCampaign campaign;
}
