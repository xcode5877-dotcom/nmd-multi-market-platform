/// Visual home page blocks from Super Admin Home Builder.
class HomePageBlock {
  const HomePageBlock({
    required this.id,
    required this.type,
    required this.title,
    required this.visible,
    required this.sortOrder,
    required this.config,
  });

  final String id;
  final HomePageBlockType type;
  final String title;
  final bool visible;
  final int sortOrder;
  final Map<String, dynamic> config;

  static List<HomePageBlock> parseList(dynamic raw) {
    if (raw is! List) return const [];
    final out = <HomePageBlock>[];
    for (final item in raw) {
      if (item is! Map) continue;
      final m = Map<String, dynamic>.from(item);
      final type = _parseType(m['type']?.toString());
      if (type == null) continue;
      final cfgRaw = m['config'];
      final config = cfgRaw is Map
          ? Map<String, dynamic>.from(cfgRaw)
          : const <String, dynamic>{};
      out.add(
        HomePageBlock(
          id: m['id']?.toString() ?? '',
          type: type,
          title: m['title']?.toString() ?? '',
          visible: m['visible'] != false,
          sortOrder: (m['sortOrder'] as num?)?.toInt() ?? 0,
          config: config,
        ),
      );
    }
    out.sort((a, b) => a.sortOrder.compareTo(b.sortOrder));
    return out.where((b) => b.visible && b.id.isNotEmpty).toList();
  }

  static HomePageBlockType? _parseType(String? raw) {
    switch (raw) {
      case 'HERO_BANNERS':
        return HomePageBlockType.heroBanners;
      case 'PILLARS':
        return HomePageBlockType.pillars;
      case 'STORE_SECTION':
        return HomePageBlockType.storeSection;
      case 'EDITORIAL_PROMO':
        return HomePageBlockType.editorialPromo;
      case 'CUSTOM_IMAGE_BANNER':
        return HomePageBlockType.customImageBanner;
      default:
        return null;
    }
  }
}

enum HomePageBlockType {
  heroBanners,
  pillars,
  storeSection,
  editorialPromo,
  customImageBanner,
}
