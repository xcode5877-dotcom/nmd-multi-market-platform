import '../../../../../api/resolve_image_url.dart';

/// Extracts gallery URLs from raw catalog JSON without touching [Product].
List<String> extractProductImageUrls(Map<String, dynamic> json) {
  final seen = <String>{};
  final urls = <String>[];

  void add(String raw) {
    final trimmed = raw.trim();
    if (trimmed.isEmpty) return;
    final resolved = resolveImageUrl(trimmed);
    if (resolved.isEmpty || seen.contains(resolved)) return;
    seen.add(resolved);
    urls.add(resolved);
  }

  add(json['imageUrl']?.toString() ?? '');

  final images = json['images'];
  if (images is List) {
    for (final entry in images) {
      if (entry is Map) {
        add(entry['url']?.toString() ?? '');
      } else {
        add(entry.toString());
      }
    }
  }

  return urls;
}

/// Index of the URL shown on listing cards (hero source), defaulting to 0.
int productHeroImageIndex(List<String> urls, String cardImageUrl) {
  if (urls.isEmpty) return 0;
  final card = cardImageUrl.trim();
  if (card.isEmpty) return 0;
  final resolved = resolveImageUrl(card);
  final idx = urls.indexOf(resolved);
  return idx >= 0 ? idx : 0;
}

/// Shared hero tag for store-strip → product details transitions.
String productDetailsHeroTag(String storeId, String productId) =>
    'product-$storeId-$productId';
