import '../../../../core/debug/nmd_feed_trace.dart';
import 'feed_campaign.dart';
import 'home_feed_block.dart';
import 'home_feed_settings.dart';

/// Composes store sections + admin-configured editorial blocks for **main home only**.
class HomeFeedComposer {
  HomeFeedComposer._();

  static const int maxEditorialBlocksPerHome = 3;

  @Deprecated('Use maxEditorialBlocksPerHome')
  static const int maxPromoBlocksPerHome = maxEditorialBlocksPerHome;

  static List<HomeFeedBlock> compose({
    required List<HomeFeedStoreSection> sections,
    required List<FeedCampaign> campaigns,
    HomeFeedSettings settings = HomeFeedSettings.defaults,
    String marketSlug = '',
    bool hasLegacyTopBanner = false,
    bool isCategoryPillarView = false,
  }) {
    if (isCategoryPillarView) {
      return sections
          .map((s) => StoreSectionFeedBlock(section: s))
          .toList(growable: false);
    }

    if (sections.isEmpty && campaigns.isEmpty) return const [];

    final maxBlocks = settings.effectiveMaxPromos.clamp(0, 6);
    final eligible = _eligibleCampaigns(campaigns, hasLegacyTopBanner);

    if (sections.isEmpty) {
      if (hasLegacyTopBanner) {
        _logComposer(sections: 0, campaigns: campaigns.length, blocks: const []);
        return const [];
      }
      final picked = _assignCampaignsToSlots(
        eligible,
        sectionCount: 0,
        maxBlocks: maxBlocks,
        settings: settings,
      );
      final blocks = picked.values.map(_blockForCampaign).toList();
      _logComposer(sections: 0, campaigns: campaigns.length, blocks: blocks);
      return blocks;
    }

    final assignment = _assignCampaignsToSlots(
      eligible,
      sectionCount: sections.length,
      maxBlocks: maxBlocks,
      settings: settings,
    );

    final blocks = <HomeFeedBlock>[];
    for (var i = 0; i < sections.length; i++) {
      blocks.add(StoreSectionFeedBlock(section: sections[i]));
      final campaign = assignment[i];
      if (campaign != null) {
        blocks.add(_blockForCampaign(campaign));
      }
    }

    _logComposer(
      sections: sections.length,
      campaigns: campaigns.length,
      blocks: blocks,
    );
    return blocks;
  }

  /// Legal 0-based section indices **after which** a promo may be inserted.
  static List<int> legalPromoSlots({
    required int sectionCount,
    required HomeFeedSettings settings,
  }) {
    if (sectionCount <= 0) return const [];
    final first = (settings.firstPromoAfterSectionIndex - 1)
        .clamp(0, sectionCount - 1);
    final step = settings.minStoreSectionsBetweenPromos.clamp(1, 12);
    final slots = <int>[];
    for (var i = first; i < sectionCount; i += step) {
      slots.add(i);
    }
    return slots;
  }

  static List<FeedCampaign> _eligibleCampaigns(
    List<FeedCampaign> campaigns,
    bool hasLegacyTopBanner,
  ) {
    return campaigns.where((c) {
      if (!c.active || !c.isWithinSchedule) return false;
      if (!hasLegacyTopBanner) return true;
      if (c.placement == FeedCampaignPlacement.topAfterLegacyBanners) {
        return false;
      }
      if (c.kind == FeedCampaignKind.popupTrigger) return false;
      if (c.kind == FeedCampaignKind.heroBanner &&
          c.visualWeight == FeedCampaignVisualWeight.heavy &&
          !c.allowAdjacentLargeVisual) {
        final raw = c.placement;
        if (raw == FeedCampaignPlacement.top ||
            raw == FeedCampaignPlacement.topAfterLegacyBanners ||
            raw == FeedCampaignPlacement.afterPillars) {
          return false;
        }
      }
      return true;
    }).toList();
  }

  /// At most one campaign per slot; never back-to-back in the output list.
  static Map<int, FeedCampaign> _assignCampaignsToSlots(
    List<FeedCampaign> campaigns, {
    required int sectionCount,
    required int maxBlocks,
    required HomeFeedSettings settings,
  }) {
    final legal = legalPromoSlots(
      sectionCount: sectionCount,
      settings: settings,
    );
    if (legal.isEmpty || maxBlocks <= 0) return {};

    final sorted = _byPriority(campaigns);
    final assigned = <int, FeedCampaign>{};

    for (final campaign in sorted) {
      if (assigned.length >= maxBlocks) break;

      final preferred = _preferredSlots(
        campaign,
        sectionCount: sectionCount,
        legalSlots: legal,
      );

      var placed = false;
      for (final slot in preferred) {
        if (!legal.contains(slot)) continue;
        if (assigned.containsKey(slot)) continue;
        assigned[slot] = campaign;
        placed = true;
        break;
      }

      if (placed) continue;

      // MANUAL_PRIORITY / overflow: next free legal slot by rhythm.
      for (final slot in legal) {
        if (assigned.containsKey(slot)) continue;
        assigned[slot] = campaign;
        break;
      }
    }

    return assigned;
  }

  static FeedCampaignPlacement _normalizedPlacement(FeedCampaignPlacement p) {
    switch (p) {
      case FeedCampaignPlacement.top:
      case FeedCampaignPlacement.topAfterLegacyBanners:
      case FeedCampaignPlacement.afterPillars:
        return FeedCampaignPlacement.afterSection1;
      case FeedCampaignPlacement.afterEvery2Rows:
        return FeedCampaignPlacement.afterEveryNSections;
      default:
        return p;
    }
  }

  static List<int> _preferredSlots(
    FeedCampaign c, {
    required int sectionCount,
    required List<int> legalSlots,
  }) {
    if (sectionCount <= 0 || legalSlots.isEmpty) return const [];

    final p = _normalizedPlacement(c.placement);
    switch (p) {
      case FeedCampaignPlacement.afterSection1:
        return [legalSlots.first];
      case FeedCampaignPlacement.afterSection2:
        final second = 1;
        if (legalSlots.contains(second)) return [second];
        return legalSlots;
      case FeedCampaignPlacement.afterEveryNSections:
        final n = c.afterEveryNSections.clamp(1, 12);
        return legalSlots
            .where((slot) => (slot + 1) % n == 0 || slot == legalSlots.first)
            .toList();
      case FeedCampaignPlacement.afterEvery2Rows:
        return legalSlots
            .where((slot) => slot % 2 == legalSlots.first % 2)
            .toList();
      case FeedCampaignPlacement.manualOrder:
        final n = c.manualAfterSection ?? legalSlots.first;
        if (n >= 0 && n < sectionCount && legalSlots.contains(n)) {
          return [n];
        }
        return legalSlots;
      case FeedCampaignPlacement.top:
      case FeedCampaignPlacement.topAfterLegacyBanners:
      case FeedCampaignPlacement.afterPillars:
        return [legalSlots.first];
    }
  }

  static List<FeedCampaign> _byPriority(List<FeedCampaign> campaigns) {
    return List<FeedCampaign>.from(campaigns)
      ..sort((a, b) {
        final byPriority = b.priority.compareTo(a.priority);
        if (byPriority != 0) return byPriority;
        return a.sortOrder.compareTo(b.sortOrder);
      });
  }

  static HomeFeedBlock _blockForCampaign(FeedCampaign campaign) {
    switch (campaign.kind) {
      case FeedCampaignKind.heroBanner:
        return HeroBannerFeedBlock(campaign: campaign);
      case FeedCampaignKind.offerStrip:
        return OfferStripFeedBlock(campaign: campaign);
      case FeedCampaignKind.competitionCard:
        return CompetitionCardFeedBlock(campaign: campaign);
      case FeedCampaignKind.rewardCard:
        return RewardCardFeedBlock(campaign: campaign);
      case FeedCampaignKind.storeFeature:
        return StoreFeatureFeedBlock(campaign: campaign);
      case FeedCampaignKind.popupTrigger:
        return HeroBannerFeedBlock(campaign: campaign);
      case FeedCampaignKind.categoryDiscovery:
        return CategoryDiscoveryFeedBlock(campaign: campaign);
    }
  }

  static void _logComposer({
    required int sections,
    required int campaigns,
    required List<HomeFeedBlock> blocks,
  }) {
    final promos = blocks.where((b) => b is! StoreSectionFeedBlock).length;
    nmdFeedTrace(
      '[FEED_COMPOSER] insertedBlocks=$promos sections=$sections '
      'campaigns=$campaigns max=$maxEditorialBlocksPerHome',
    );
  }
}
