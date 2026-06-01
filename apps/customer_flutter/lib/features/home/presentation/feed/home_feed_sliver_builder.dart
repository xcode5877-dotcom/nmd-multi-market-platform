import 'package:flutter/material.dart';

import '../../domain/feed/feed_campaign.dart';
import '../../domain/feed/feed_campaign_display.dart';
import '../../domain/feed/home_feed_block.dart';
import '../widgets/feed_campaigns/challenge_event_editorial_card.dart';
import '../widgets/feed_campaigns/food_mood_discovery_card.dart';
import '../widgets/feed_campaigns/new_store_story_card.dart';
import '../widgets/feed_campaigns/night_offers_feed_strip.dart';
import '../widgets/feed_campaigns/rewards_discovery_editorial_card.dart';
import 'feed_campaign_actions.dart';
import 'home_feed_store_view.dart';
import 'home_store_section_strip.dart';

typedef HomeFeedStoreResolver = List<HomeFeedStoreView> Function(
  HomeFeedStoreSection section,
);

class HomeFeedSliverBuilder {
  HomeFeedSliverBuilder._();

  static List<Widget> buildSlivers({
    required BuildContext context,
    required List<HomeFeedBlock> blocks,
    required String marketSlug,
    required HomeFeedStoreResolver resolveStores,
    required Map<String, String> storeIdBySlug,
  }) {
    var campaignIndex = 0;
    final slivers = <Widget>[];

    for (final block in blocks) {
      if (block is! StoreSectionFeedBlock) {
        final idx = campaignIndex;
        campaignIndex++;
        slivers.add(
          SliverToBoxAdapter(
            child: _buildPromoBlock(
              context,
              block,
              marketSlug: marketSlug,
              storeIdBySlug: storeIdBySlug,
              campaignIndex: idx,
            ),
          ),
        );
      } else {
        slivers.add(
          SliverToBoxAdapter(
            child: HomeStoreSectionStrip(
              marketSlug: marketSlug,
              title: block.section.title,
              stores: resolveStores(block.section),
            ),
          ),
        );
      }
    }

    return slivers;
  }

  static Widget _buildPromoBlock(
    BuildContext context,
    HomeFeedBlock block, {
    required String marketSlug,
    required Map<String, String> storeIdBySlug,
    required int campaignIndex,
  }) {
    final campaign = _campaignFrom(block);
    void open() {
      handleFeedCampaignAction(
        context,
        campaign: campaign,
        marketSlug: marketSlug,
        storeIdBySlug: storeIdBySlug,
      );
    }

    if (campaign.showsAsFoodMood) {
      return FoodMoodDiscoveryCard(
        campaign: campaign,
        listIndex: campaignIndex,
        onCategoryTap: (_) => open(),
      );
    }

    switch (campaign.kind) {
      case FeedCampaignKind.competitionCard:
        return ChallengeEventEditorialCard(
          campaign: campaign,
          listIndex: campaignIndex,
          onTap: open,
        );
      case FeedCampaignKind.rewardCard:
        return RewardsDiscoveryEditorialCard(
          campaign: campaign,
          listIndex: campaignIndex,
          onTap: open,
        );
      case FeedCampaignKind.offerStrip:
        return NightOffersFeedStrip(
          campaign: campaign,
          listIndex: campaignIndex,
          onTap: open,
        );
      case FeedCampaignKind.storeFeature:
      case FeedCampaignKind.heroBanner:
      case FeedCampaignKind.popupTrigger:
        return NewStoreStoryCard(
          campaign: campaign,
          listIndex: campaignIndex,
          onTap: open,
        );
      case FeedCampaignKind.categoryDiscovery:
        return FoodMoodDiscoveryCard(
          campaign: campaign,
          listIndex: campaignIndex,
          onCategoryTap: (_) => open(),
        );
    }
  }

  static FeedCampaign _campaignFrom(HomeFeedBlock block) {
    return switch (block) {
      HeroBannerFeedBlock(:final campaign) => campaign,
      OfferStripFeedBlock(:final campaign) => campaign,
      CompetitionCardFeedBlock(:final campaign) => campaign,
      RewardCardFeedBlock(:final campaign) => campaign,
      StoreFeatureFeedBlock(:final campaign) => campaign,
      CategoryDiscoveryFeedBlock(:final campaign) => campaign,
      StoreSectionFeedBlock() => throw StateError('not a promo block'),
    };
  }
}
