import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';

import '../../../../design_system/design_system.dart';
import '../widgets/home_store_card.dart';
import 'marketplace_card_layout.dart';

/// Skeleton for home layout while market data loads.
class HomeLayoutShimmer extends StatelessWidget {
  const HomeLayoutShimmer({super.key});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.only(bottom: NmdSpacing.xxl),
      children: const [
        _BannerShimmer(),
        SizedBox(height: NmdSpacing.homeSectionGap),
        _HomeStoresShimmer(),
        SizedBox(height: NmdSpacing.homeSectionGap),
        _HomeStoresShimmer(),
      ],
    );
  }
}

class _BannerShimmer extends StatelessWidget {
  const _BannerShimmer();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsetsDirectional.fromSTEB(
        NmdSpacing.screenHorizontal,
        NmdSpacing.sm,
        NmdSpacing.screenHorizontal,
        0,
      ),
      child: Shimmer.fromColors(
        baseColor: NmdColors.borderSubtle,
        highlightColor: NmdColors.surfaceBase,
        child: Container(
          height: 148,
          decoration: BoxDecoration(
            color: NmdColors.borderSubtle,
            borderRadius: NmdRadius.borderMd,
          ),
        ),
      ),
    );
  }
}

class _HomeStoresShimmer extends StatelessWidget {
  const _HomeStoresShimmer();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsetsDirectional.fromSTEB(12, 8, 12, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Shimmer.fromColors(
            baseColor: NmdColors.borderSubtle,
            highlightColor: NmdColors.surfaceBase,
            child: Container(
              height: 18,
              width: 140,
              decoration: BoxDecoration(
                color: NmdColors.borderSubtle,
                borderRadius: NmdRadius.borderXs,
              ),
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: HomeStoreCard.cardHeight,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              primary: false,
              shrinkWrap: true,
              padding: EdgeInsets.zero,
              itemCount: 4,
              separatorBuilder: (_, __) => const SizedBox(
                width: MarketplaceCardLayout.stripSeparator,
              ),
              itemBuilder: (_, __) => Shimmer.fromColors(
                baseColor: NmdColors.borderSubtle,
                highlightColor: NmdColors.surfaceBase,
                child: Container(
                  width: HomeStoreCard.cardWidth,
                  height: HomeStoreCard.cardHeight,
                  decoration: BoxDecoration(
                    color: NmdColors.borderSubtle,
                    borderRadius: NmdRadius.borderMd,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
