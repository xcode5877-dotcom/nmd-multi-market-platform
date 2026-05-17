import 'models/market.dart';
import 'resolve_image_url.dart';

/// `MARKET_IMAGES` + `getMarketImage` from `MarketsPickerPage.tsx`.
const Map<String, String> kMarketImagesBySlug = {
  'daburiyya':
      'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=400&fit=crop&q=80',
  'dabburiyya':
      'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=400&fit=crop&q=80',
  'iksal':
      'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400&h=400&fit=crop&q=80',
};

/// Same as web `getMarketImage(market)`.
String getMarketDisplayImageUrl(Market market) {
  final raw = market.imageUrl;
  if (raw != null && raw.trim().isNotEmpty) {
    return resolveImageUrl(raw.trim());
  }
  final slug = market.slug.toLowerCase();
  final mapped = kMarketImagesBySlug[slug];
  if (mapped != null) return mapped;
  return 'https://picsum.photos/seed/${market.slug}/400/400';
}
