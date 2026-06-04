import 'package:customer_flutter/features/home/domain/feed/feed_campaign.dart';
import 'package:customer_flutter/features/home/domain/feed/feed_campaign_chip.dart';
import 'package:customer_flutter/features/home/domain/feed/home_feed_block.dart';
import 'package:customer_flutter/features/home/domain/feed/home_feed_composer.dart';
import 'package:customer_flutter/features/home/domain/feed/home_feed_settings.dart';
import 'package:flutter_test/flutter_test.dart';

List<HomeFeedStoreSection> _sections(int n) => List.generate(
      n,
      (i) => HomeFeedStoreSection(title: 'S$i', storeIds: ['s$i'], index: i),
    );

FeedCampaign _campaign({
  required String id,
  FeedCampaignPlacement placement = FeedCampaignPlacement.afterSection1,
  int priority = 50,
}) {
  return FeedCampaign(
    id: id,
    marketSlug: 'dabburiyya',
    kind: FeedCampaignKind.offerStrip,
    title: id,
    subtitle: '',
    ctaLabel: '',
    actionType: FeedCampaignActionType.none,
    placement: placement,
    priority: priority,
  );
}

List<int> _promoIndicesAfterSection(List<HomeFeedBlock> blocks) {
  final indices = <int>[];
  var sectionIdx = -1;
  for (final b in blocks) {
    if (b is StoreSectionFeedBlock) {
      sectionIdx++;
    } else {
      indices.add(sectionIdx);
    }
  }
  return indices;
}

bool _hasConsecutivePromos(List<HomeFeedBlock> blocks) {
  var prevWasPromo = false;
  for (final b in blocks) {
    final isPromo = b is! StoreSectionFeedBlock;
    if (isPromo && prevWasPromo) return true;
    prevWasPromo = isPromo;
  }
  return false;
}

void main() {
  test('legal slots: first after section 1, then every 2 sections', () {
    expect(
      HomeFeedComposer.legalPromoSlots(
        sectionCount: 5,
        settings: HomeFeedSettings.defaults,
      ),
      [0, 2, 4],
    );
  });

  test('multiple promos inserted with rhythm spacing on 5 sections', () {
    final blocks = HomeFeedComposer.compose(
      sections: _sections(5),
      campaigns: [
        _campaign(id: 'a', priority: 100),
        _campaign(id: 'b', priority: 90),
        _campaign(id: 'c', priority: 80),
      ],
      settings: HomeFeedSettings.defaults,
      hasLegacyTopBanner: true,
    );

    expect(blocks[0], isA<StoreSectionFeedBlock>());
    expect(blocks[1], isA<OfferStripFeedBlock>());
    expect(blocks[2], isA<StoreSectionFeedBlock>());
    expect(blocks[3], isA<StoreSectionFeedBlock>());
    expect(blocks[4], isA<OfferStripFeedBlock>());
    expect(blocks[5], isA<StoreSectionFeedBlock>());
    expect(blocks[6], isA<StoreSectionFeedBlock>());
    expect(blocks[7], isA<OfferStripFeedBlock>());
    expect(_hasConsecutivePromos(blocks), isFalse);
  });

  test('no consecutive promos even with many campaigns', () {
    final blocks = HomeFeedComposer.compose(
      sections: _sections(7),
      campaigns: List.generate(
        6,
        (i) => _campaign(id: 'c$i', priority: 100 - i),
      ),
      hasLegacyTopBanner: true,
    );
    expect(_hasConsecutivePromos(blocks), isFalse);
  });

  test('first promo appears after first store section', () {
    final blocks = HomeFeedComposer.compose(
      sections: _sections(3),
      campaigns: [_campaign(id: 'only')],
      hasLegacyTopBanner: true,
    );
    expect(blocks.first, isA<StoreSectionFeedBlock>());
    expect(blocks[1], isA<OfferStripFeedBlock>());
  });

  test('4 campaigns + 7 sections → exactly 3 spaced promos', () {
    final blocks = HomeFeedComposer.compose(
      sections: _sections(7),
      campaigns: List.generate(
        4,
        (i) => _campaign(id: 'c$i', priority: 100 - i),
      ),
      settings: HomeFeedSettings.defaults,
      hasLegacyTopBanner: true,
    );
    expect(blocks.where((b) => b is! StoreSectionFeedBlock).length, 3);
    expect(_promoIndicesAfterSection(blocks), [0, 2, 4]);
    expect(_hasConsecutivePromos(blocks), isFalse);
  });

  test('2 campaigns + 2 sections → only 1 promo after section 1', () {
    final blocks = HomeFeedComposer.compose(
      sections: _sections(2),
      campaigns: [
        _campaign(id: 'a', priority: 100),
        _campaign(id: 'b', priority: 90),
      ],
      settings: HomeFeedSettings.defaults,
      hasLegacyTopBanner: true,
    );
    expect(blocks.where((b) => b is! StoreSectionFeedBlock).length, 1);
    expect(_promoIndicesAfterSection(blocks), [0]);
  });

  test('max 3 promos cap', () {
    final blocks = HomeFeedComposer.compose(
      sections: _sections(9),
      campaigns: List.generate(
        8,
        (i) => _campaign(id: 'c$i', priority: 100 - i),
      ),
      settings: HomeFeedSettings.defaults,
      hasLegacyTopBanner: true,
    );
    expect(blocks.where((b) => b is! StoreSectionFeedBlock).length, 3);
  });

  test('pillar/category view has no promos', () {
    final blocks = HomeFeedComposer.compose(
      sections: _sections(4),
      campaigns: [_campaign(id: 'x'), _campaign(id: 'y')],
      isCategoryPillarView: true,
    );
    expect(blocks.every((b) => b is StoreSectionFeedBlock), isTrue);
  });

  test('TOP placement remaps to after first section slot', () {
    final blocks = HomeFeedComposer.compose(
      sections: _sections(4),
      campaigns: [
        FeedCampaign(
          id: 'top',
          marketSlug: '',
          kind: FeedCampaignKind.heroBanner,
          title: 'Hero',
          subtitle: '',
          ctaLabel: '',
          actionType: FeedCampaignActionType.none,
          placement: FeedCampaignPlacement.top,
          visualWeight: FeedCampaignVisualWeight.light,
          priority: 100,
        ),
      ],
      hasLegacyTopBanner: true,
    );
    expect(blocks.length, greaterThan(1));
    expect(blocks[0], isA<StoreSectionFeedBlock>());
    expect(blocks[1], isA<HeroBannerFeedBlock>());
  });

  test('heavy hero at TOP excluded when legacy carousel exists', () {
    final blocks = HomeFeedComposer.compose(
      sections: _sections(2),
      campaigns: [
        FeedCampaign(
          id: 'hero',
          marketSlug: '',
          kind: FeedCampaignKind.heroBanner,
          title: 'Hero',
          subtitle: '',
          ctaLabel: '',
          actionType: FeedCampaignActionType.none,
          placement: FeedCampaignPlacement.top,
          visualWeight: FeedCampaignVisualWeight.heavy,
          priority: 100,
        ),
      ],
      hasLegacyTopBanner: true,
    );
    expect(blocks.every((b) => b is StoreSectionFeedBlock), isTrue);
  });

  test('release path: no campaigns → store sections only', () {
    final blocks = HomeFeedComposer.compose(
      sections: _sections(2),
      campaigns: const [],
      hasLegacyTopBanner: true,
    );
    expect(blocks.every((b) => b is StoreSectionFeedBlock), isTrue);
  });

  test('mood discovery after section1 when configured', () {
    final blocks = HomeFeedComposer.compose(
      sections: _sections(3),
      campaigns: [
        FeedCampaign(
          id: 'mood',
          marketSlug: 'dabburiyya',
          kind: FeedCampaignKind.categoryDiscovery,
          title: 'شو جاي عبالك اليوم؟',
          subtitle: '',
          ctaLabel: 'اكتشف',
          actionType: FeedCampaignActionType.none,
          placement: FeedCampaignPlacement.afterSection1,
          chips: const [FeedCampaignChip(label: 'بيتزا', emoji: '🍕')],
          priority: 100,
        ),
      ],
      hasLegacyTopBanner: true,
    );
    expect(blocks[1], isA<CategoryDiscoveryFeedBlock>());
  });
}
