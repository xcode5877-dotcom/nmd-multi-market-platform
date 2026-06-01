import 'package:flutter/material.dart';

import '../../domain/feed/feed_campaign.dart';
import '../../domain/feed/home_feed_block.dart';
import '../widgets/feed_campaigns/category_discovery_campaign.dart';
import '../widgets/feed_campaigns/editorial_hero_campaign.dart';
import '../widgets/feed_campaigns/compact_promo_strip.dart';
import '../widgets/feed_campaigns/interactive_event_card.dart';
import '../widgets/feed_campaigns/reward_card_campaign.dart';
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
            child: _buildBlock(
              context,
              block,
              marketSlug: marketSlug,
              storeIdBySlug: storeIdBySlug,
              campaignIndex: idx,
              resolveStores: resolveStores,
            ),
          ),
        );
      } else {
        slivers.add(
          SliverToBoxAdapter(
            child: _buildBlock(
              context,
              block,
              marketSlug: marketSlug,
              storeIdBySlug: storeIdBySlug,
              campaignIndex: 0,
              resolveStores: resolveStores,
            ),
          ),
        );
      }
    }

    return slivers;
  }

  static Widget _buildBlock(
    BuildContext context,
    HomeFeedBlock block, {
    required String marketSlug,
    required Map<String, String> storeIdBySlug,
    required int campaignIndex,
    HomeFeedStoreResolver? resolveStores,
  }) {
    void open(FeedCampaign campaign) {
      handleFeedCampaignAction(
        context,
        campaign: campaign,
        marketSlug: marketSlug,
        storeIdBySlug: storeIdBySlug,
      );
    }

    switch (block) {
      case StoreSectionFeedBlock(:final section):
        return HomeStoreSectionStrip(
          marketSlug: marketSlug,
          title: section.title,
          stores: resolveStores!(section),
        );
      case HeroBannerFeedBlock(:final campaign):
      case StoreFeatureFeedBlock(:final campaign):
        return EditorialHeroCampaign(
          campaign: campaign,
          listIndex: campaignIndex,
          onCta: () => open(campaign),
        );
      case OfferStripFeedBlock(:final campaign):
        return CompactPromoStrip(
          campaign: campaign,
          listIndex: campaignIndex,
          onTap: () => open(campaign),
        );
      case CompetitionCardFeedBlock(:final campaign):
        return InteractiveEventCard(
          campaign: campaign,
          listIndex: campaignIndex,
          onCta: () => open(campaign),
        );
      case RewardCardFeedBlock(:final campaign):
        return RewardCardCampaign(
          campaign: campaign,
          listIndex: campaignIndex,
          onCta: () => open(campaign),
        );
      case CategoryDiscoveryFeedBlock(:final campaign):
        return CategoryDiscoveryCampaign(
          campaign: campaign,
          listIndex: campaignIndex,
          onCategoryTap: (_) => open(campaign),
        );
    }
  }
}
