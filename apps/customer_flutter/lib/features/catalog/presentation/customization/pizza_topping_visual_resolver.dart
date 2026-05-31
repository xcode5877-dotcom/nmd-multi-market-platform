import 'package:flutter/material.dart';

import '../../../../../api/models/pizza_placement.dart';

/// Visual category for pizza topping representation (UI-only).
enum PizzaToppingVisualCategory {
  olive,
  mushroom,
  corn,
  onion,
  pepper,
  cheese,
  meat,
  chicken,
  tuna,
  sauce,
  vegetable,
  fallback,
}

/// Resolved visual metadata for a pizza modifier (UI-only).
class PizzaToppingVisual {
  const PizzaToppingVisual({
    required this.category,
    required this.emojiFallback,
    required this.colorFallback,
    required this.displayLabel,
    this.assetPath,
  });

  final PizzaToppingVisualCategory category;

  /// Future: `assets/toppings/olive.png` when art is available.
  final String? assetPath;
  final String emojiFallback;
  final Color colorFallback;
  final String displayLabel;

  /// Wire/API-friendly category slug (`default` for unknown).
  String get categorySlug => switch (category) {
        PizzaToppingVisualCategory.fallback => 'default',
        _ => category.name,
      };
}

/// Maps modifier names to deterministic topping visuals (emoji/color for now).
///
/// TODO(admin): allow per-item `toppingVisualCategory` or `assetPath` override
/// from catalog admin without changing order/cart payloads.
abstract final class PizzaToppingVisualResolver {
  static const String pizzaBaseAssetPath =
      'assets/images/pizza_builder/pizza_base.png';

  static const String _toppingAssetRoot =
      'assets/images/pizza_builder/toppings/';

  /// Asset path for a category (may be absent at runtime — use [PizzaToppingGlyph]).
  static String assetPathForCategory(PizzaToppingVisualCategory category) {
    final slug = category == PizzaToppingVisualCategory.fallback
        ? 'default'
        : category.name;
    return '$_toppingAssetRoot$slug.png';
  }
  static PizzaToppingVisual resolve({
    String? modifierName,
    String? groupName,
    String? placement,
  }) {
    final label = _displayLabel(modifierName, groupName);
    final haystack = _searchText(modifierName, groupName);

    // TODO(admin): check admin override map before heuristic matching.
    final category = _matchCategory(haystack);
    final meta = _metaFor(category);

    return PizzaToppingVisual(
      category: category,
      assetPath: assetPathForCategory(category),
      emojiFallback: meta.emoji,
      colorFallback: meta.color,
      displayLabel: _labelWithPlacement(label, placement),
    );
  }

  /// Normalizes modifier/group text for deterministic matching.
  static String normalize(String? input) {
    if (input == null) return '';
    var s = input.trim().toLowerCase();
    if (s.isEmpty) return '';

    s = s.replaceAll(RegExp(r'[\u064B-\u065F\u0670\u06D6-\u06ED]'), '');
    s = s.replaceAll(RegExp(r'[إأآٱ]'), 'ا');
    s = s.replaceAll('ى', 'ي');
    s = s.replaceAll('ؤ', 'و');
    s = s.replaceAll('ئ', 'ي');
    s = s.replaceAll('ة', 'ه');
    s = s.replaceAll(RegExp(r'[\-_/\\.,:;!?()\[\]{}«»"]+'), ' ');
    s = s.replaceAll(RegExp(r'\s+'), ' ').trim();

    return s;
  }

  static String _searchText(String? modifierName, String? groupName) {
    final mod = normalize(modifierName);
    final grp = normalize(groupName);
    if (mod.isEmpty && grp.isEmpty) return '';
    if (mod.isEmpty) return grp;
    if (grp.isEmpty) return mod;
    return '$mod $grp';
  }

  static String _displayLabel(String? modifierName, String? groupName) {
    final mod = modifierName?.trim();
    if (mod != null && mod.isNotEmpty) return mod;
    final grp = groupName?.trim();
    if (grp != null && grp.isNotEmpty) return grp;
    return 'إضافة';
  }

  static String _labelWithPlacement(String label, String? placement) {
    if (placement == null || placement.trim().isEmpty) return label;
    final p = placement.toUpperCase();
    if (p == PizzaPlacement.whole) return label;
    if (p == PizzaPlacement.left) return '$label · يسار';
    if (p == PizzaPlacement.right) return '$label · يمين';
    return label;
  }

  static bool _containsAny(String haystack, List<String> needles) {
    if (haystack.isEmpty) return false;
    for (final needle in needles) {
      final n = normalize(needle);
      if (n.isNotEmpty && haystack.contains(n)) return true;
    }
    return false;
  }

  static PizzaToppingVisualCategory _matchCategory(String haystack) {
    if (haystack.isEmpty) return PizzaToppingVisualCategory.fallback;

    // Order: specific proteins/sauces before broad vegetable/default.
    if (_containsAny(haystack, _tuna)) return PizzaToppingVisualCategory.tuna;
    if (_containsAny(haystack, _chicken)) {
      return PizzaToppingVisualCategory.chicken;
    }
    if (_containsAny(haystack, _meat)) return PizzaToppingVisualCategory.meat;
    if (_containsAny(haystack, _cheese)) {
      return PizzaToppingVisualCategory.cheese;
    }
    if (_containsAny(haystack, _olive)) return PizzaToppingVisualCategory.olive;
    if (_containsAny(haystack, _mushroom)) {
      return PizzaToppingVisualCategory.mushroom;
    }
    if (_containsAny(haystack, _corn)) return PizzaToppingVisualCategory.corn;
    if (_containsAny(haystack, _onion)) {
      return PizzaToppingVisualCategory.onion;
    }
    if (_containsAny(haystack, _pepper)) {
      return PizzaToppingVisualCategory.pepper;
    }
    if (_containsAny(haystack, _sauce)) return PizzaToppingVisualCategory.sauce;
    if (_containsAny(haystack, _vegetable)) {
      return PizzaToppingVisualCategory.vegetable;
    }

    return PizzaToppingVisualCategory.fallback;
  }

  static _CategoryMeta _metaFor(PizzaToppingVisualCategory category) {
    return _catalog[category] ?? _catalog[PizzaToppingVisualCategory.fallback]!;
  }

  static const _tuna = [
    'tuna', 'tuna fish', 'טונה', 'תונה', 'تونا', 'تونه', 'تuna',
  ];

  static const _chicken = [
    'chicken', 'shawarma', 'shwarma', 'עוף', 'שווארמה', 'دجاج', 'شاورما',
    'شاورמה', 'فراخ', 'chicken breast',
  ];

  static const _meat = [
    'meat', 'beef', 'steak', 'kefta', 'kafta', 'kofta', 'בשר', 'בקר',
    'קציצה', 'קפתה', 'لحمه', 'لحم', 'لحمة', 'كفتة', 'كفتة', 'برجر',
    'burger patty', 'ground beef',
  ];

  static const _cheese = [
    'cheese', 'mozzarella', 'mozarella', 'parmesan', 'parmigiana',
    'גבינה', 'מוצרלה', 'מוצarella', 'جبنه', 'جبنة', 'جبن', 'موزاريلا',
    'موتزاريلا', 'اكسترا جبنة', 'extra cheese', 'cheddar',
  ];

  static const _olive = [
    'olive', 'olives', 'black olive', 'green olive', 'זית', 'זיתים',
    'זית שחור', 'زيتون', 'زيتون اسود', 'زيتون أسود', 'زيتون اخضر',
  ];

  static const _mushroom = [
    'mushroom', 'mushrooms', 'פטריה', 'פטריות', 'פטרייה', 'فطر', 'مشروم',
    'مشروم', 'champignon',
  ];

  static const _corn = ['corn', 'sweet corn', 'תירס', 'תירס מתוק', 'ذرة', 'ذره'];

  static const _onion = [
    'onion', 'onions', 'red onion', 'white onion', 'בצל', 'בצל סגול',
    'بصل', 'بصل احمر', 'بصل أحمر',
  ];

  static const _pepper = [
    'pepper', 'peppers', 'chili', 'chilli', 'jalapeno', 'jalapeño',
    'bell pepper', 'hot pepper', 'sweet pepper', 'פלפל', 'פלפל חריף',
    'פלפל מתוק', 'فلفل', 'فلفل حار', 'فلفل حلو', 'هالابينو',
  ];

  static const _sauce = [
    'sauce', 'garlic', 'ranch', 'bbq', 'barbecue', 'pesto', 'tomato sauce',
    'marinara', 'שום', 'רוטב', 'רנץ', 'صوص', 'صلصة', 'ثوم', 'رانش', 'باربيكيو',
    'بيستو',
  ];

  static const _vegetable = [
    'vegetable', 'vegetables', 'veggie', 'veggies', 'salad', 'greens',
    'spinach', 'tomato', 'tomatoes', 'خضار', 'خضروات', 'ירק', 'ירקות',
    'rucola', 'rocket', 'basil', 'בזיליקום', 'רucola',
  ];

  static const Map<PizzaToppingVisualCategory, _CategoryMeta> _catalog = {
    PizzaToppingVisualCategory.olive: _CategoryMeta(
      emoji: '🫒',
      color: Color(0xFF3F6212),
    ),
    PizzaToppingVisualCategory.mushroom: _CategoryMeta(
      emoji: '🍄',
      color: Color(0xFF92400E),
    ),
    PizzaToppingVisualCategory.corn: _CategoryMeta(
      emoji: '🌽',
      color: Color(0xFFEAB308),
    ),
    PizzaToppingVisualCategory.onion: _CategoryMeta(
      emoji: '🧅',
      color: Color(0xFF7C3AED),
    ),
    PizzaToppingVisualCategory.pepper: _CategoryMeta(
      emoji: '🌶️',
      color: Color(0xFFDC2626),
    ),
    PizzaToppingVisualCategory.cheese: _CategoryMeta(
      emoji: '🧀',
      color: Color(0xFFF59E0B),
    ),
    PizzaToppingVisualCategory.meat: _CategoryMeta(
      emoji: '🥩',
      color: Color(0xFF991B1B),
    ),
    PizzaToppingVisualCategory.chicken: _CategoryMeta(
      emoji: '🍗',
      color: Color(0xFFD97706),
    ),
    PizzaToppingVisualCategory.tuna: _CategoryMeta(
      emoji: '🐟',
      color: Color(0xFF0369A1),
    ),
    PizzaToppingVisualCategory.sauce: _CategoryMeta(
      emoji: '🥫',
      color: Color(0xFFEA580C),
    ),
    PizzaToppingVisualCategory.vegetable: _CategoryMeta(
      emoji: '🥬',
      color: Color(0xFF059669),
    ),
    PizzaToppingVisualCategory.fallback: _CategoryMeta(
      emoji: '➕',
      color: Color(0xFF64748B),
    ),
  };
}

class _CategoryMeta {
  const _CategoryMeta({
    required this.emoji,
    required this.color,
  });

  final String emoji;
  final Color color;
}
