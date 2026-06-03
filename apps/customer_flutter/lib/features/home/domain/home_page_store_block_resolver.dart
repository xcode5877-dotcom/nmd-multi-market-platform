import '../../../core/debug/nmd_feed_trace.dart';

/// Resolves tenant keys for a [STORE_SECTION] block — no feed composer / legacy loops.
class HomePageStoreBlockResolver {
  HomePageStoreBlockResolver._();

  static List<String> resolveStoreKeys({
    required Map<String, dynamic> config,
    required List<Map<String, dynamic>> tenantMaps,
    List<({String id, List<String> storeIds})> layoutSections = const [],
  }) {
    final source = _normSource(config['source']);
    final limit = (config['limit'] as num?)?.toInt() ?? 24;
    final cap = limit.clamp(1, 48);
    final sectionId = config['layoutSectionId']?.toString().trim() ?? '';

    final embedded = _keysFromConfig(config);
    if (embedded.isNotEmpty && source != 'MANUAL') {
      nmdFeedTrace(
        '[HOME_STORE_BLOCK_STALE_IDS_IGNORED] source=$source count=${embedded.length}',
        verbose: true,
      );
    }

    final List<String> keys;
    switch (source) {
      case 'MANUAL':
        keys = embedded;
        break;
      case 'LAYOUT_SECTION':
        keys = _keysFromLayoutSection(layoutSections, sectionId);
        break;
      case 'FEATURED':
        keys = _keysFromLayoutSection(layoutSections, 'featured');
        break;
      case 'ALL':
        keys = tenantMaps
            .map((t) => _tenantKey(t))
            .where((k) => k.isNotEmpty)
            .toList();
        break;
      case 'PILLAR':
        final pid = config['pillarId']?.toString().trim() ?? '';
        keys = tenantMaps
            .where((t) {
              final p = t['pillarId'] ?? t['pillar_id'];
              return p != null && p.toString().trim() == pid;
            })
            .map((t) => _tenantKey(t))
            .where((k) => k.isNotEmpty)
            .toList();
        break;
      case 'SUB_CATEGORY':
        final scid = config['subCategoryId']?.toString().trim() ?? '';
        keys = tenantMaps
            .where((t) {
              final sc = t['subCategoryId'] ?? t['sub_category_id'];
              return sc != null && sc.toString().trim() == scid;
            })
            .map((t) => _tenantKey(t))
            .where((k) => k.isNotEmpty)
            .toList();
        break;
      default:
        keys = source == 'MANUAL' ? embedded : const [];
    }

    final out = _dedupePreserveOrder(keys).take(cap).toList();
    nmdFeedTrace(
      '[HOME_STORE_BLOCK_RESOLVE] source=$source sectionId=$sectionId resolvedCount=${out.length}',
      verbose: true,
    );
    return out;
  }

  static String _normSource(Object? raw) {
    final s = raw?.toString().trim().toUpperCase() ?? 'MANUAL';
    if (s == 'SUBCATEGORY' || s == 'SUB-CATEGORY') return 'SUB_CATEGORY';
    return s;
  }

  static List<String> _keysFromConfig(Map<String, dynamic> config) {
    for (final field in ['storeIds', 'tenantIds', 'store_ids', 'tenant_ids']) {
      final raw = config[field];
      if (raw is List) {
        return raw
            .map((e) => e.toString().trim())
            .where((e) => e.isNotEmpty)
            .toList();
      }
    }
    return const [];
  }

  static List<String> _keysFromLayoutSection(
    List<({String id, List<String> storeIds})> sections,
    String sectionId,
  ) {
    if (sectionId.isEmpty) return const [];
    for (final s in sections) {
      if (s.id == sectionId) return s.storeIds;
    }
    return const [];
  }

  static String _tenantKey(Map<String, dynamic> t) {
    final id = t['id']?.toString().trim() ?? '';
    if (id.isNotEmpty) return id;
    return t['slug']?.toString().trim() ?? '';
  }

  static List<String> _dedupePreserveOrder(List<String> keys) {
    final seen = <String>{};
    final out = <String>[];
    for (final k in keys) {
      if (seen.add(k)) out.add(k);
    }
    return out;
  }
}
