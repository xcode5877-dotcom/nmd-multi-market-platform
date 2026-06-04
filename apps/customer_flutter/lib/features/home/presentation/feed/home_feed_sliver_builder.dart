import 'package:flutter/material.dart';

import '../../domain/feed/feed_campaign.dart';
import '../../domain/feed/feed_campaign_chip.dart';
import '../../domain/feed/home_feed_block.dart';
import '../widgets/feed_campaigns/challenge_event_editorial_card.dart';
import '../widgets/feed_campaigns/custom_banner_block.dart';
import '../widgets/feed_campaigns/floating_glass_promo_strip.dart';
import '../widgets/feed_campaigns/food_mood_discovery_block.dart';
import '../widgets/feed_campaigns/new_store_story_card.dart';
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
            child: _buildEditorialBlock(
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

  static Widget _buildEditorialBlock(
    BuildContext context,
    HomeFeedBlock block, {
    required String marketSlug,
    required Map<String, String> storeIdBySlug,
    required int campaignIndex,
  }) {
    final campaign = _campaignFrom(block);

    void openCampaign() {
      handleFeedCampaignAction(
        context,
        campaign: campaign,
        marketSlug: marketSlug,
        storeIdBySlug: storeIdBySlug,
      );
    }

    switch (campaign.kind) {
      case FeedCampaignKind.categoryDiscovery:
        return FoodMoodDiscoveryBlock(
          campaign: campaign,
          listIndex: campaignIndex,
          onChipTap: (chip) => _onMoodChipTap(
            context,
            chip: chip,
            campaign: campaign,
            marketSlug: marketSlug,
            storeIdBySlug: storeIdBySlug,
          ),
        );
      case FeedCampaignKind.competitionCard:
        return ChallengeEventEditorialCard(
          campaign: campaign,
          listIndex: campaignIndex,
          onTap: openCampaign,
        );
      case FeedCampaignKind.rewardCard:
        return RewardsDiscoveryEditorialCard(
          campaign: campaign,
          listIndex: campaignIndex,
          onTap: openCampaign,
        );
      case FeedCampaignKind.storeFeature:
        return NewStoreStoryCard(
          campaign: campaign,
          listIndex: campaignIndex,
          onTap: openCampaign,
        );
      case FeedCampaignKind.heroBanner:
      case FeedCampaignKind.popupTrigger:
        return CustomBannerBlock(
          campaign: campaign,
          listIndex: campaignIndex,
          onTap: openCampaign,
        );
      case FeedCampaignKind.offerStrip:
        return FloatingGlassPromoStrip(
          campaign: campaign,
          listIndex: campaignIndex,
          onTap: openCampaign,
        );
    }
  }

  static void _onMoodChipTap(
    BuildContext context, {
    required FeedCampaignChip chip,
    required FeedCampaign campaign,
    required String marketSlug,
    required Map<String, String> storeIdBySlug,
  }) {
    if (!chip.isActionable) return;

    final target = chip.resolvedTarget;
    handleFeedCampaignAction(
      context,
      campaign: FeedCampaign(
        id: campaign.id,
        marketSlug: campaign.marketSlug,
        kind: campaign.kind,
        title: campaign.title,
        subtitle: campaign.subtitle,
        ctaLabel: campaign.ctaLabel,
        actionType: chip.actionType,
        targetId: chip.actionType == FeedCampaignActionType.openSearch
            ? (target ?? chip.label.trim())
            : target,
        targetUrl: campaign.targetUrl,
      ),
      marketSlug: marketSlug,
      storeIdBySlug: storeIdBySlug,
    );
  }

  static FeedCampaign _campaignFrom(HomeFeedBlock block) {
    return switch (block) {
      HeroBannerFeedBlock(:final campaign) => campaign,
      OfferStripFeedBlock(:final campaign) => campaign,
      CompetitionCardFeedBlock(:final campaign) => campaign,
      RewardCardFeedBlock(:final campaign) => campaign,
      StoreFeatureFeedBlock(:final campaign) => campaign,
      CategoryDiscoveryFeedBlock(:final campaign) => campaign,
      StoreSectionFeedBlock() => throw StateError('not an editorial block'),
    };
  }
}
