/// Mirrors `interface Market` in `apps/storefront/src/pages/MarketsPickerPage.tsx`.
class Market {
  const Market({
    required this.id,
    required this.name,
    required this.slug,
    this.imageUrl,
    required this.isActive,
    this.sortOrder = 999,
  });

  final String id;
  final String name;
  final String slug;
  final String? imageUrl;
  final bool isActive;
  final int sortOrder;

  factory Market.fromJson(Map<String, dynamic> json) {
    final brandingRaw = json['branding'];
    final branding = brandingRaw is Map
        ? Map<String, dynamic>.from(brandingRaw)
        : const <String, dynamic>{};
    final raw = (json['imageUrl']?.toString() ??
            json['logoUrl']?.toString() ??
            json['iconUrl']?.toString() ??
            branding['logoUrl']?.toString() ??
            branding['imageUrl']?.toString())
        ?.trim();
    final image = (raw == null || raw.isEmpty) ? null : raw;
    return Market(
      id: json['id']?.toString() ?? '',
      name: (json['name']?.toString() ?? '').trim(),
      slug: (json['slug']?.toString() ?? '').trim(),
      imageUrl: image,
      isActive: json['isActive'] == true,
      sortOrder:
          json['sortOrder'] is num ? (json['sortOrder'] as num).toInt() : 999,
    );
  }
}
