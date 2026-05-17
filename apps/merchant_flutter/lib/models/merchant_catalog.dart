class MerchantCatalog {
  const MerchantCatalog({
    required this.categories,
    required this.products,
    required this.optionGroups,
    required this.optionItems,
    this.raw = const {},
  });

  final List<MerchantCategory> categories;
  final List<MerchantProduct> products;
  final List<dynamic> optionGroups;
  final List<dynamic> optionItems;
  final Map<String, dynamic> raw;

  static MerchantCatalog fromJson(Map<String, dynamic> json) {
    final categories = (json['categories'] as List<dynamic>? ?? const [])
        .whereType<Map>()
        .map((row) => MerchantCategory.fromJson(Map<String, dynamic>.from(row)))
        .toList()
      ..sort((a, b) => a.sortOrder.compareTo(b.sortOrder));
    final products = (json['products'] as List<dynamic>? ?? const [])
        .whereType<Map>()
        .map((row) => MerchantProduct.fromJson(Map<String, dynamic>.from(row)))
        .toList()
      ..sort((a, b) => a.sortOrder.compareTo(b.sortOrder));
    return MerchantCatalog(
      categories: categories,
      products: products,
      optionGroups: json['optionGroups'] as List<dynamic>? ?? const [],
      optionItems: json['optionItems'] as List<dynamic>? ?? const [],
      raw: Map<String, dynamic>.from(json),
    );
  }

  Map<String, dynamic> toJson() => {
        ...raw,
        'categories': categories.map((category) => category.toJson()).toList(),
        'products': products.map((product) => product.toJson()).toList(),
        'optionGroups': optionGroups,
        'optionItems': optionItems,
      };
}

class MerchantCategory {
  const MerchantCategory({
    required this.id,
    required this.name,
    required this.slug,
    required this.sortOrder,
    required this.isVisible,
    required this.raw,
  });

  final String id;
  final String name;
  final String slug;
  final int sortOrder;
  final bool isVisible;
  final Map<String, dynamic> raw;

  static MerchantCategory fromJson(Map<String, dynamic> json) {
    return MerchantCategory(
      id: (json['id'] ?? '').toString(),
      name: (json['name'] ?? '').toString(),
      slug: (json['slug'] ?? '').toString(),
      sortOrder: _int(json['sortOrder']),
      isVisible: json['isVisible'] != false,
      raw: Map<String, dynamic>.from(json),
    );
  }

  MerchantCategory copyWith({
    String? name,
    String? slug,
    int? sortOrder,
    bool? isVisible,
  }) {
    return MerchantCategory.fromJson({
      ...raw,
      'name': name ?? this.name,
      'slug': slug ?? this.slug,
      'sortOrder': sortOrder ?? this.sortOrder,
      'isVisible': isVisible ?? this.isVisible,
    });
  }

  Map<String, dynamic> toJson() => {
        ...raw,
        'id': id,
        'name': name,
        'slug': slug,
        'sortOrder': sortOrder,
        'isVisible': isVisible,
      };
}

class MerchantProduct {
  const MerchantProduct({
    required this.id,
    required this.name,
    required this.slug,
    required this.categoryId,
    required this.basePrice,
    required this.currency,
    required this.isAvailable,
    required this.isArchived,
    required this.sortOrder,
    required this.imageUrl,
    required this.description,
    required this.raw,
  });

  final String id;
  final String name;
  final String slug;
  final String categoryId;
  final double basePrice;
  final String currency;
  final bool isAvailable;
  final bool isArchived;
  final int sortOrder;
  final String imageUrl;
  final String description;
  final Map<String, dynamic> raw;

  static MerchantProduct fromJson(Map<String, dynamic> json) {
    return MerchantProduct(
      id: (json['id'] ?? '').toString(),
      name: (json['name'] ?? '').toString(),
      slug: (json['slug'] ?? '').toString(),
      categoryId: (json['categoryId'] ?? '').toString(),
      basePrice: _double(json['basePrice'] ?? json['price']),
      currency: (json['currency'] ?? 'ILS').toString(),
      isAvailable: json['isAvailable'] != false,
      isArchived: json['isArchived'] == true,
      sortOrder: _int(json['sortOrder']),
      imageUrl: (json['imageUrl'] ??
              json['image'] ??
              json['photoUrl'] ??
              json['thumbnailUrl'] ??
              '')
          .toString(),
      description: (json['description'] ??
              json['details'] ??
              json['shortDescription'] ??
              json['productDescription'] ??
              json['menuDescription'] ??
              '')
          .toString(),
      raw: Map<String, dynamic>.from(json),
    );
  }

  MerchantProduct copyWith({
    String? name,
    String? slug,
    String? categoryId,
    double? basePrice,
    bool? isAvailable,
    bool? isArchived,
    int? sortOrder,
    String? imageUrl,
    String? description,
  }) {
    return MerchantProduct.fromJson({
      ...raw,
      'name': name ?? this.name,
      'slug': slug ?? this.slug,
      'categoryId': categoryId ?? this.categoryId,
      'basePrice': basePrice ?? this.basePrice,
      'currency': currency,
      'isAvailable': isAvailable ?? this.isAvailable,
      'isArchived': isArchived ?? this.isArchived,
      'sortOrder': sortOrder ?? this.sortOrder,
      'imageUrl': imageUrl ?? this.imageUrl,
      'description': description ?? this.description,
    });
  }

  Map<String, dynamic> toJson() => {
        ...raw,
        'id': id,
        'name': name,
        'slug': slug,
        'categoryId': categoryId,
        'basePrice': basePrice,
        'currency': currency,
        'isAvailable': isAvailable,
        'isArchived': isArchived,
        'sortOrder': sortOrder,
        'imageUrl': imageUrl,
        'description': description,
      };
}

class MerchantStats {
  const MerchantStats({
    required this.orderCount,
    required this.totalSales,
    required this.cashOrderCount,
    required this.cashSales,
    required this.cardOrderCount,
    required this.cardSales,
  });

  final int orderCount;
  final double totalSales;
  final int cashOrderCount;
  final double cashSales;
  final int cardOrderCount;
  final double cardSales;

  static MerchantStats zero() => const MerchantStats(
        orderCount: 0,
        totalSales: 0,
        cashOrderCount: 0,
        cashSales: 0,
        cardOrderCount: 0,
        cardSales: 0,
      );

  static MerchantStats fromJson(Map<String, dynamic> json) {
    return MerchantStats(
      orderCount: _int(json['orderCount']),
      totalSales: _double(json['totalSales']),
      cashOrderCount: _int(json['cashOrderCount']),
      cashSales: _double(json['cashSales']),
      cardOrderCount: _int(json['onlineOrderCount'] ?? json['cardOrderCount']),
      cardSales: _double(json['onlineSales'] ?? json['cardSales']),
    );
  }
}

String slugify(String value) {
  final normalized = value
      .trim()
      .toLowerCase()
      .replaceAll(RegExp(r'[^a-z0-9]+'), '-')
      .replaceAll(RegExp(r'^-+|-+$'), '');
  return normalized.isEmpty
      ? DateTime.now().millisecondsSinceEpoch.toString()
      : normalized;
}

int _int(Object? value) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  return int.tryParse(value?.toString() ?? '') ?? 0;
}

double _double(Object? value) {
  if (value is num) return value.toDouble();
  return double.tryParse(value?.toString() ?? '') ?? 0;
}
