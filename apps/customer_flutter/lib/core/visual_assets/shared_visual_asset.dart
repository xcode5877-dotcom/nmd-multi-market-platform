/// Client-side visual asset descriptor — maps admin-uploaded URLs to UI slots.
/// No backend schema change; resolves from existing entity fields (iconUrl, imageUrl).
enum SharedVisualAssetType {
  rewardIcon,
  categoryIcon,
  serviceIcon,
  communityBanner,
  sectionCover,
  placeholder,
}

class SharedVisualAsset {
  const SharedVisualAsset({
    required this.id,
    required this.type,
    required this.title,
    this.imageUrl,
    this.thumbnailUrl,
    this.darkModeUrl,
    this.active = true,
    this.createdAt,
  });

  final String id;
  final SharedVisualAssetType type;
  final String title;
  final String? imageUrl;
  final String? thumbnailUrl;
  final String? darkModeUrl;
  final bool active;
  final DateTime? createdAt;

  String? resolveUrl({required bool darkMode}) {
    if (!active) return null;
    if (darkMode && darkModeUrl != null && darkModeUrl!.trim().isNotEmpty) {
      return darkModeUrl;
    }
    final primary = imageUrl?.trim();
    if (primary != null && primary.isNotEmpty) return primary;
    final thumb = thumbnailUrl?.trim();
    if (thumb != null && thumb.isNotEmpty) return thumb;
    return null;
  }

  /// Build from any API field that carries an image URL.
  factory SharedVisualAsset.fromUrl({
    required String id,
    required SharedVisualAssetType type,
    required String title,
    String? imageUrl,
    String? thumbnailUrl,
  }) {
    return SharedVisualAsset(
      id: id,
      type: type,
      title: title,
      imageUrl: imageUrl,
      thumbnailUrl: thumbnailUrl,
      createdAt: DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'type': type.name,
        'title': title,
        'imageUrl': imageUrl,
        'thumbnailUrl': thumbnailUrl,
        'darkModeUrl': darkModeUrl,
        'active': active,
        'createdAt': createdAt?.toIso8601String(),
      };

  factory SharedVisualAsset.fromJson(Map<String, dynamic> json) {
    return SharedVisualAsset(
      id: json['id'] as String? ?? '',
      type: SharedVisualAssetType.values.firstWhere(
        (t) => t.name == json['type'],
        orElse: () => SharedVisualAssetType.placeholder,
      ),
      title: json['title'] as String? ?? '',
      imageUrl: json['imageUrl'] as String?,
      thumbnailUrl: json['thumbnailUrl'] as String?,
      darkModeUrl: json['darkModeUrl'] as String?,
      active: json['active'] as bool? ?? true,
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'] as String)
          : null,
    );
  }
}
