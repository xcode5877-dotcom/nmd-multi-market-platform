import 'package:flutter/foundation.dart';

import '../../../api/models/modifier_icon.dart';
import '../../../api/storefront_api.dart';

/// In-memory cache of market-scoped modifier icon library (UI only).
final class ModifierIconLibrary {
  ModifierIconLibrary._();
  static final ModifierIconLibrary instance = ModifierIconLibrary._();

  String? _marketSlug;
  Map<String, ModifierIconEntry> _byKey = {};

  bool get isLoaded => _byKey.isNotEmpty;

  Future<void> ensureLoaded(StorefrontApi api, String marketSlug) async {
    final slug = marketSlug.trim();
    if (slug.isEmpty) return;
    if (_marketSlug == slug && _byKey.isNotEmpty) return;
    final list = await api.fetchModifierIcons(slug);
    _byKey = {
      for (final entry in list)
        if (entry.key.isNotEmpty) entry.key: entry,
    };
    _marketSlug = slug;
  }

  void clear() {
    _marketSlug = null;
    _byKey = {};
  }

  ModifierIconEntry? byKey(String? key) {
    if (key == null || key.trim().isEmpty) return null;
    final normalized = key.trim().toLowerCase();
    final hit = _byKey[normalized];
    if (kDebugMode) {
      debugPrint(
        '[MODIFIER_ICON] library lookup iconKey=$normalized '
        'found=${hit != null} iconUrl=${hit?.iconUrl ?? ''}',
      );
    }
    return hit;
  }

  /// All cached entries (read-only).
  Iterable<ModifierIconEntry> get entries => _byKey.values;
}
