import 'package:flutter/foundation.dart';

import 'feed_campaign.dart';
import 'home_feed_block.dart';

/// Composes store sections + promo blocks with placement rules (max one promo per slot).
class HomeFeedComposer {
  HomeFeedComposer._();

  static List<HomeFeedBlock> compose({
    required List<HomeFeedStoreSection> sections,
    required List<FeedCampaign> campaigns,
  }) {
    if (sections.isEmpty && campaigns.isEmpty) return const [];

    if (sections.isEmpty) {
      final promoOnly = campaigns.map(_blockForCampaign).toList();
      _logComposer(sections: 0, campaigns: campaigns.length, blocks: promoOnly);
      return promoOnly;
    }

    final active = List<FeedCampaign>.from(campaigns)
      ..sort((a, b) {
        final byPriority = b.priority.compareTo(a.priority);
        if (byPriority != 0) return byPriority;
        return a.sortOrder.compareTo(b.sortOrder);
      });

    final top = _takePlacement(active, FeedCampaignPlacement.top);
    final after1 = _takePlacement(active, FeedCampaignPlacement.afterSection1);
    final after2 = _takePlacement(active, FeedCampaignPlacement.afterSection2);
    final every2Queue = active
        .where((c) => c.placement == FeedCampaignPlacement.afterEvery2Rows)
        .toList();
    final manual = active
        .where((c) => c.placement == FeedCampaignPlacement.manualOrder)
        .toList();

    final blocks = <HomeFeedBlock>[];
    final insertedIds = <String>{};

    void addPromo(FeedCampaign c) {
      if (c.id.isEmpty || insertedIds.contains(c.id)) return;
      insertedIds.add(c.id);
      blocks.add(_blockForCampaign(c));
    }

    if (top != null) addPromo(top);

    var every2Idx = 0;

    for (var i = 0; i < sections.length; i++) {
      blocks.add(StoreSectionFeedBlock(section: sections[i]));

      for (final c in manual.where((c) => (c.manualAfterSection ?? -1) == i)) {
        addPromo(c);
      }

      if (i == 0 && after1 != null) addPromo(after1);
      if (i == 1 && after2 != null) addPromo(after2);

      final isPairEnd = (i + 1) % 2 == 0;
      if (isPairEnd && every2Idx < every2Queue.length) {
        addPromo(every2Queue[every2Idx]);
        every2Idx++;
      }
    }

    _ensurePromoBeforeFirstSection(blocks, campaigns, insertedIds);

    _logComposer(
      sections: sections.length,
      campaigns: campaigns.length,
      blocks: blocks,
    );
    return blocks;
  }

  /// QA: at least one promo visible above the first store row when campaigns exist.
  static void _ensurePromoBeforeFirstSection(
    List<HomeFeedBlock> blocks,
    List<FeedCampaign> campaigns,
    Set<String> insertedIds,
  ) {
    if (campaigns.isEmpty || blocks.isEmpty) return;
    if (blocks.first is! StoreSectionFeedBlock) return;

    final sorted = List<FeedCampaign>.from(campaigns)
      ..sort((a, b) {
        final byPriority = b.priority.compareTo(a.priority);
        if (byPriority != 0) return byPriority;
        return a.sortOrder.compareTo(b.sortOrder);
      });

    FeedCampaign? lead;
    for (final c in sorted) {
      if (!insertedIds.contains(c.id)) {
        lead = c;
        break;
      }
    }
    if (lead == null) return;

    blocks.insert(0, _blockForCampaign(lead));
    insertedIds.add(lead.id);
  }

  static void _logComposer({
    required int sections,
    required int campaigns,
    required List<HomeFeedBlock> blocks,
  }) {
    if (!kDebugMode) return;
    final promos = blocks.where((b) => b is! StoreSectionFeedBlock).length;
    debugPrint(
      '[FEED_COMPOSER] sections=$sections campaigns=$campaigns '
      'insertedBlocks=$promos totalBlocks=${blocks.length}',
    );
  }

  static FeedCampaign? _takePlacement(
    List<FeedCampaign> pool,
    FeedCampaignPlacement placement,
  ) {
    final idx = pool.indexWhere((c) => c.placement == placement);
    if (idx < 0) return null;
    return pool.removeAt(idx);
  }

  static HomeFeedBlock _blockForCampaign(FeedCampaign campaign) {
    switch (campaign.kind) {
      case FeedCampaignKind.heroBanner:
      case FeedCampaignKind.popupTrigger:
        return HeroBannerFeedBlock(campaign: campaign);
      case FeedCampaignKind.offerStrip:
        return OfferStripFeedBlock(campaign: campaign);
      case FeedCampaignKind.competitionCard:
        return CompetitionCardFeedBlock(campaign: campaign);
      case FeedCampaignKind.rewardCard:
        return RewardCardFeedBlock(campaign: campaign);
      case FeedCampaignKind.storeFeature:
        return StoreFeatureFeedBlock(campaign: campaign);
      case FeedCampaignKind.categoryDiscovery:
        return CategoryDiscoveryFeedBlock(campaign: campaign);
    }
  }
}
