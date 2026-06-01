/// Store row data for home feed sections (presentation-only).
class HomeFeedStoreView {
  const HomeFeedStoreView({
    required this.id,
    required this.slug,
    required this.name,
    required this.category,
    required this.logoUrl,
    required this.openStatus,
  });

  final String id;
  final String slug;
  final String name;
  final String category;
  final String logoUrl;
  final String openStatus;
}
