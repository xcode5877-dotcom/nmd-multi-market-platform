/// Super-admin shared modifier icon library entry (market-scoped).
class ModifierIconEntry {
  const ModifierIconEntry({
    required this.id,
    required this.key,
    required this.labelAr,
    required this.iconUrl,
    required this.keywords,
    required this.active,
    required this.sortOrder,
    this.labelHe,
    this.labelEn,
    this.category,
  });

  final String id;
  final String key;
  final String labelAr;
  final String? labelHe;
  final String? labelEn;
  final String iconUrl;
  final List<String> keywords;
  final String? category;
  final bool active;
  final int sortOrder;

  factory ModifierIconEntry.fromJson(Map<String, dynamic> json) {
    final rawKw = json['keywords'];
    return ModifierIconEntry(
      id: (json['id']?.toString() ?? '').trim(),
      key: (json['key'] ?? json['icon_key']?.toString() ?? '')
          .toString()
          .trim()
          .toLowerCase(),
      labelAr: (json['labelAr'] ?? json['label_ar']?.toString() ?? '').toString().trim(),
      labelHe: json['labelHe']?.toString() ?? json['label_he']?.toString(),
      labelEn: json['labelEn']?.toString() ?? json['label_en']?.toString(),
      iconUrl: (json['iconUrl'] ?? json['icon_url']?.toString() ?? '').toString().trim(),
      keywords: rawKw is List
          ? rawKw.map((e) => e.toString().trim()).where((s) => s.isNotEmpty).toList()
          : const [],
      category: json['category']?.toString(),
      active: json['active'] != false,
      sortOrder: json['sortOrder'] is num ? (json['sortOrder'] as num).toInt() : 0,
    );
  }
}
