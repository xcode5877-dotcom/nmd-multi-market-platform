import 'dart:convert';

import '../resolve_image_url.dart';

class ProductCategory {
  const ProductCategory({
    required this.id,
    required this.title,
  });

  final String id;
  final String title;

  factory ProductCategory.fromJson(Map<String, dynamic> json) {
    return ProductCategory(
      id: (json['id']?.toString() ?? '').trim(),
      title:
          (json['title']?.toString() ?? json['name']?.toString() ?? '').trim(),
    );
  }
}

class ProductOptionItem {
  const ProductOptionItem({
    required this.id,
    required this.name,
    required this.priceDelta,
    this.displayPriceDelta,
    this.allowSplitting,
    this.placement,
  });

  final String id;
  final String name;
  final double priceDelta;
  final double? displayPriceDelta;

  double get customerPriceDelta => displayPriceDelta ?? priceDelta;

  /// When true, option can use half-pizza placement (web `optionSupportsHalf`).
  final bool? allowSplitting;

  /// `WHOLE` | `HALF` from catalog; used with [ProductOptionGroup.allowHalfPlacement].
  final String? placement;

  factory ProductOptionItem.fromJson(Map<String, dynamic> json) {
    return ProductOptionItem(
      id: (json['id']?.toString() ?? '').trim(),
      name:
          (json['name']?.toString() ?? json['title']?.toString() ?? '').trim(),
      priceDelta: _parseNum(
        json['priceDelta'] ??
            json['priceModifier'] ??
            json['extraPrice'] ??
            json['price'],
      ),
      displayPriceDelta: json['displayPriceDelta'] != null
          ? _parseNum(json['displayPriceDelta'])
          : null,
      allowSplitting: json['allowSplitting'] == true ? true : null,
      placement: json['placement']?.toString(),
    );
  }
}

/// Half-and-half eligibility (parity with `PizzaAddonsSelector` / web `optionSupportsHalf`).
bool productOptionSupportsHalf(
    ProductOptionItem item, ProductOptionGroup group) {
  if (item.allowSplitting == true) return true;
  final p = (item.placement ?? '').toUpperCase();
  if (p == 'HALF') return true;
  if (group.allowSplitting) return true;
  if (group.allowHalfPlacement && p != 'WHOLE') return true;
  return false;
}

bool productGroupHasHalfOptions(ProductOptionGroup g) {
  return g.allowHalfPlacement ||
      g.allowSplitting ||
      g.items.any((i) => productOptionSupportsHalf(i, g));
}

/// Snapshot for order payload / cart (Arabic names for admin & receipts). Web `CartItem.optionGroups` shape.
String optionGroupsToOrderJson(List<ProductOptionGroup> groups) {
  if (groups.isEmpty) return '[]';
  final list = groups
      .map(
        (g) => <String, dynamic>{
          'id': g.id,
          'name': g.name,
          'items': g.items
              .map((i) => <String, dynamic>{'id': i.id, 'name': i.name})
              .toList(),
        },
      )
      .toList();
  return jsonEncode(list);
}

class ProductOptionGroup {
  const ProductOptionGroup({
    required this.id,
    required this.name,
    required this.required,
    required this.selectionType,
    required this.maxSelected,
    required this.minSelected,
    required this.items,
    required this.allowSplitting,
    required this.allowHalfPlacement,
  });

  final String id;
  final String name;
  final bool required;
  final String selectionType;
  final int maxSelected;
  final int minSelected;
  final List<ProductOptionItem> items;

  final bool allowSplitting;
  final bool allowHalfPlacement;

  bool get isSingle => selectionType == 'single' && maxSelected <= 1;

  factory ProductOptionGroup.fromJson(Map<String, dynamic> json) {
    final rawItems = (json['items'] as List<dynamic>? ?? const <dynamic>[])
        .whereType<Map>()
        .map((e) => ProductOptionItem.fromJson(Map<String, dynamic>.from(e)))
        .where((e) => e.id.isNotEmpty && e.name.isNotEmpty)
        .toList();
    final maxSel = (json['maxSelected'] is num)
        ? (json['maxSelected'] as num).toInt()
        : int.tryParse(json['maxSelected']?.toString() ?? '') ?? 1;
    final minSel = (json['minSelected'] is num)
        ? (json['minSelected'] as num).toInt()
        : int.tryParse(json['minSelected']?.toString() ?? '') ?? 0;
    return ProductOptionGroup(
      id: (json['id']?.toString() ?? '').trim(),
      name:
          (json['name']?.toString() ?? json['title']?.toString() ?? '').trim(),
      required: json['required'] == true,
      selectionType:
          (json['selectionType']?.toString() ?? 'single').trim().toLowerCase(),
      maxSelected: maxSel < 1 ? 1 : maxSel,
      minSelected: minSel < 0 ? 0 : minSel,
      items: rawItems,
      allowSplitting: json['allowSplitting'] == true,
      allowHalfPlacement: json['allowHalfPlacement'] == true,
    );
  }
}

class Product {
  const Product({
    required this.id,
    required this.name,
    required this.description,
    required this.imageUrl,
    required this.categoryId,
    required this.basePrice,
    this.displayPrice,
    required this.optionGroups,
    required this.isAvailable,
    required this.stockQuantity,
  });

  final String id;
  final String name;
  final String description;
  final String imageUrl;
  final String categoryId;
  final double basePrice;
  final double? displayPrice;
  final List<ProductOptionGroup> optionGroups;
  final bool isAvailable;
  final int? stockQuantity;

  /// Customer-visible list price (marketplace repriced when [displayPrice] is set).
  double get customerListPrice => displayPrice ?? basePrice;

  bool get isInStock => (stockQuantity ?? 1) > 0;
  bool get canAddToCart => isAvailable && isInStock;

  factory Product.fromJson(Map<String, dynamic> json) {
    final groups = (json['optionGroups'] as List<dynamic>? ?? const <dynamic>[])
        .whereType<Map>()
        .map((e) => ProductOptionGroup.fromJson(Map<String, dynamic>.from(e)))
        .where((g) => g.id.isNotEmpty && g.items.isNotEmpty)
        .toList();
    return Product(
      id: (json['id']?.toString() ?? '').trim(),
      name: (json['name']?.toString() ?? '').trim(),
      description: (json['description']?.toString() ?? '').trim(),
      imageUrl: _resolveProductImage(json),
      categoryId: (json['categoryId']?.toString() ?? '').trim(),
      basePrice: _parseMerchantBasePrice(json),
      displayPrice: json['displayPrice'] != null
          ? _parseNum(json['displayPrice'])
          : null,
      optionGroups: groups,
      isAvailable: _parseAvailability(json),
      stockQuantity: _parseStock(json),
    );
  }
}

bool _parseAvailability(Map<String, dynamic> json) {
  final explicit = json['isAvailable'];
  if (explicit is bool) return explicit;
  final status = (json['status']?.toString() ?? '').toLowerCase();
  if (status == 'out_of_stock' ||
      status == 'unavailable' ||
      status == 'disabled') return false;
  return true;
}

int? _parseStock(Map<String, dynamic> json) {
  final stock = json['stockQuantity'] ?? json['stock'] ?? json['quantity'];
  if (stock == null) return null;
  if (stock is num) return stock.toInt();
  return int.tryParse(stock.toString());
}

double _parseMerchantBasePrice(Map<String, dynamic> json) {
  final base = json['basePrice'];
  if (base != null) {
    final n = _parseNum(base);
    if (n > 0) return n;
  }
  return _parseRealPrice(json);
}

double _parseRealPrice(Map<String, dynamic> json) {
  final candidates = <dynamic>[
    json['basePrice'],
    json['price'],
    json['unitPrice'],
    json['salePrice'],
    json['finalPrice'],
  ];
  for (final c in candidates) {
    final n = _parseNum(c);
    if (n > 0) return n;
  }
  return _parseNum(json['basePrice'] ?? json['price']);
}

double _parseNum(dynamic value) {
  if (value == null) return 0;
  if (value is num) return value.toDouble();
  final raw = value.toString().trim();
  if (raw.isEmpty) return 0;
  return double.tryParse(raw) ?? 0;
}

String _resolveProductImage(Map<String, dynamic> json) {
  final direct = (json['imageUrl']?.toString() ?? '').trim();
  if (direct.isNotEmpty) return resolveImageUrl(direct);
  final images = json['images'];
  if (images is List && images.isNotEmpty) {
    final first = images.first;
    if (first is Map) {
      final fromMap = (first['url']?.toString() ?? '').trim();
      if (fromMap.isNotEmpty) return resolveImageUrl(fromMap);
    }
    final fromString = first.toString().trim();
    if (fromString.isNotEmpty) return resolveImageUrl(fromString);
  }
  return '';
}
