import 'package:equatable/equatable.dart';

/// Row from `GET /sub-categories?pillarId=` — same source as web [MarketSectionPage] sub-filters.
final class SubCategoryNavItem extends Equatable {
  const SubCategoryNavItem({
    required this.id,
    required this.pillarId,
    required this.titleAr,
    this.slug,
    this.sortOrder = 0,
  });

  final String id;
  final String pillarId;

  /// Arabic label preferred (admin parity).
  final String titleAr;
  final String? slug;
  final int sortOrder;

  factory SubCategoryNavItem.fromJson(Map<String, dynamic> json) {
    final id = (json['id'] ?? '').toString().trim();
    final pillarId =
        (json['pillarId'] ?? json['pillar_id'] ?? '').toString().trim();
    final nameAr = (json['nameAr'] ?? json['name_ar'] ?? '').toString().trim();
    final name = (json['name'] ?? '').toString().trim();
    final slug = (json['slug'] ?? '').toString().trim();
    final so = json['sortOrder'] ?? json['sort_order'];
    final sort = so is num ? so.toInt() : 0;
    return SubCategoryNavItem(
      id: id,
      pillarId: pillarId,
      titleAr: nameAr.isNotEmpty ? nameAr : name,
      slug: slug.isNotEmpty ? slug : null,
      sortOrder: sort,
    );
  }

  @override
  List<Object?> get props => [id, pillarId, titleAr, slug, sortOrder];
}
