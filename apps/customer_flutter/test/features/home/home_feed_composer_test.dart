import 'package:customer_flutter/features/home/domain/feed/feed_campaign.dart';
import 'package:customer_flutter/features/home/domain/feed/home_feed_block.dart';
import 'package:customer_flutter/features/home/domain/feed/home_feed_composer.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('inserts AFTER_EVERY_2_ROWS campaign after every two store sections', () {
    final sections = List.generate(
      5,
      (i) => HomeFeedStoreSection(
        title: 'Section $i',
        storeIds: ['s$i'],
        index: i,
      ),
    );

    final campaigns = [
      FeedCampaign(
        id: 'a',
        marketSlug: 'dabburiyya',
        kind: FeedCampaignKind.heroBanner,
        title: 'A',
        subtitle: '',
        ctaLabel: 'Go',
        actionType: FeedCampaignActionType.openPopup,
        placement: FeedCampaignPlacement.afterEvery2Rows,
      ),
      FeedCampaign(
        id: 'b',
        marketSlug: 'dabburiyya',
        kind: FeedCampaignKind.offerStrip,
        title: 'B',
        subtitle: '',
        ctaLabel: 'Go',
        actionType: FeedCampaignActionType.openPopup,
        placement: FeedCampaignPlacement.afterEvery2Rows,
      ),
    ];

    final blocks = HomeFeedComposer.compose(
      sections: sections,
      campaigns: campaigns,
    );

    expect(blocks.whereType<StoreSectionFeedBlock>().length, 5);
    expect(blocks.whereType<HeroBannerFeedBlock>().length, 1);
    expect(blocks.whereType<OfferStripFeedBlock>().length, 1);

    final promoIndices = <int>[];
    for (var i = 0; i < blocks.length; i++) {
      if (blocks[i] is! StoreSectionFeedBlock) promoIndices.add(i);
    }
    expect(promoIndices, [2, 5]);
  });

  test('campaigns without sections still render promo blocks', () {
    final blocks = HomeFeedComposer.compose(
      sections: const [],
      campaigns: [
        FeedCampaign(
          id: 'solo',
          marketSlug: 'dabburiyya',
          kind: FeedCampaignKind.heroBanner,
          title: 'عرض',
          subtitle: 'وصف',
          ctaLabel: 'اكتشف',
          actionType: FeedCampaignActionType.none,
          placement: FeedCampaignPlacement.top,
        ),
      ],
    );
    expect(blocks.length, 1);
    expect(blocks.first, isA<HeroBannerFeedBlock>());
  });

  test('TOP placement appears before first section', () {
    final sections = [
      const HomeFeedStoreSection(title: 'S0', storeIds: ['a'], index: 0),
    ];
    final blocks = HomeFeedComposer.compose(
      sections: sections,
      campaigns: [
        FeedCampaign(
          id: 'top',
          marketSlug: '',
          kind: FeedCampaignKind.heroBanner,
          title: 'Top',
          subtitle: '',
          ctaLabel: 'Go',
          actionType: FeedCampaignActionType.none,
          placement: FeedCampaignPlacement.top,
        ),
      ],
    );
    expect(blocks.first, isA<HeroBannerFeedBlock>());
    expect(blocks[1], isA<StoreSectionFeedBlock>());
  });
}
