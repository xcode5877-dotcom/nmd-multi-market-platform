import 'package:flutter/material.dart';

import '../../../../design_system/design_system.dart';
import '../../../catalog/presentation/widgets/home_store_card.dart';
import '../../../catalog/presentation/widgets/marketplace_card_layout.dart';
import 'home_feed_store_view.dart';

/// Horizontal store section row (shared by classic layout + dynamic feed).
class HomeStoreSectionStrip extends StatelessWidget {
  const HomeStoreSectionStrip({
    super.key,
    required this.marketSlug,
    required this.title,
    required this.stores,
  });

  final String marketSlug;
  final String title;
  final List<HomeFeedStoreView> stores;

  @override
  Widget build(BuildContext context) {
    if (stores.isEmpty) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.only(bottom: NmdSpacing.homeSectionGap),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          NmdSectionHeader(title: title),
          SizedBox(
            height: HomeStoreCard.cardHeight,
            child: Directionality(
              textDirection: TextDirection.rtl,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                primary: false,
                shrinkWrap: true,
                physics: MarketplaceStripScrollPhysics(
                  itemExtent: HomeStoreCard.cardWidth,
                  separatorWidth: MarketplaceCardLayout.stripSeparator,
                  parent: const BouncingScrollPhysics(),
                ),
                padding: MarketplaceCardLayout.stripPadding,
                itemCount: stores.length,
                separatorBuilder: (_, __) => const SizedBox(
                  width: MarketplaceCardLayout.stripSeparator,
                ),
                itemBuilder: (context, i) {
                  final s = stores[i];
                  return HomeStoreCard(
                    marketSlug: marketSlug,
                    storeId: s.id,
                    storeName: s.name,
                    categoryLabel: homeStoreCategoryLabel(s.category),
                    logoUrl: s.logoUrl,
                    openStatus: s.openStatus,
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}
