import 'home_feed_block.dart';

/// Builds feed sections from admin layout rows, or synthetic pairs for promo placement.
List<HomeFeedStoreSection> resolveHomeFeedSections({
  required List<({String title, List<String> storeIds})> layoutSections,
  required List<String> tenantStoreIds,
  String fallbackSectionTitle = 'اكتشف المحلات',
}) {
  final fromLayout = layoutSections
      .asMap()
      .entries
      .map(
        (e) => HomeFeedStoreSection(
          title: e.value.title,
          storeIds: e.value.storeIds,
          index: e.key,
        ),
      )
      .where((s) => s.storeIds.isNotEmpty)
      .toList();

  if (fromLayout.isNotEmpty) return fromLayout;
  return syntheticSectionsFromStoreIds(
    tenantStoreIds,
    sectionTitle: fallbackSectionTitle,
  );
}

/// Pairs of stores so [HomeFeedComposer] can insert AFTER_EVERY_2_ROWS promos.
List<HomeFeedStoreSection> syntheticSectionsFromStoreIds(
  List<String> storeIds, {
  String sectionTitle = 'اكتشف المحلات',
}) {
  if (storeIds.isEmpty) return const [];

  final sections = <HomeFeedStoreSection>[];
  for (var i = 0; i < storeIds.length; i += 2) {
    final pair = storeIds.skip(i).take(2).toList();
    if (pair.isEmpty) continue;
    sections.add(
      HomeFeedStoreSection(
        title: i == 0 ? sectionTitle : '',
        storeIds: pair,
        index: sections.length,
      ),
    );
  }
  return sections;
}
