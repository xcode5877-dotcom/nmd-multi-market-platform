import 'package:equatable/equatable.dart';

/// Row from GET `/pillars` — same Super Admin source as `PillarCategoryManagerPage` / mock-api [Pillar].
final class PillarNavItem extends Equatable {
  const PillarNavItem({
    required this.id,
    required this.titleAr,
    required this.slug,
    required this.iconRaw,
    this.networkIconUrl,
    this.iconUrlFromDb,
  });

  /// Stable pillar id from DB (used for `pillar_id` tenant filter).
  final String id;
  final String titleAr;
  final String slug;

  /// Emoji or short text when no image URL.
  final String iconRaw;

  /// Admin `iconUrl` / `icon_url` (preferred for chip image).
  final String? iconUrlFromDb;

  /// Resolved http(s) or `/...` image: prefers [iconUrlFromDb], then `icon` if it looks like a URL.
  final String? networkIconUrl;

  static String _str(dynamic v) => v == null ? '' : v.toString().trim();

  static String? _firstNonEmpty(Map<String, dynamic> json, List<String> keys) {
    for (final k in keys) {
      final s = _str(json[k]);
      if (s.isNotEmpty) return s;
    }
    return null;
  }

  factory PillarNavItem.fromJson(Map<String, dynamic> json) {
    final id = _str(json['id'] ?? json['_id']);
    final nameAr = _firstNonEmpty(json, const ['nameAr', 'name_ar']) ?? '';
    final name = _firstNonEmpty(json, const ['name']) ?? '';
    final slug = _firstNonEmpty(json, const ['slug']) ?? '';
    final iconStr = _firstNonEmpty(json, const ['icon']) ?? '';

    final iconUrlDb = _firstNonEmpty(json, const [
      'iconUrl',
      'icon_url',
      'iconURL',
    ]);

    bool looksLikeUrl(String s) {
      return s.startsWith('http://') ||
          s.startsWith('https://') ||
          s.startsWith('/');
    }

    String? net;
    if (iconUrlDb != null && looksLikeUrl(iconUrlDb)) {
      net = iconUrlDb;
    } else if (iconStr.isNotEmpty && looksLikeUrl(iconStr)) {
      net = iconStr;
    }

    final title = nameAr.isNotEmpty ? nameAr : name;

    return PillarNavItem(
      id: id,
      titleAr: title,
      slug: slug,
      iconRaw: iconStr,
      iconUrlFromDb: iconUrlDb,
      networkIconUrl: net,
    );
  }

  /// Image to load: admin `icon_url` / `iconUrl` wins over emoji field used as URL.
  String? get resolvedNetworkIconUrl {
    if (iconUrlFromDb != null && iconUrlFromDb!.isNotEmpty) {
      return iconUrlFromDb;
    }
    return networkIconUrl;
  }

  @override
  List<Object?> get props =>
      [id, titleAr, slug, iconRaw, networkIconUrl, iconUrlFromDb];
}
