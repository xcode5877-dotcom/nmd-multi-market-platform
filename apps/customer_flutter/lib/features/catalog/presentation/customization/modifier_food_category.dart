import '../../../../api/models/product.dart';

enum ModifierFoodCategory {
  essentials,
  vegetables,
  cheeses,
  meats,
  sauces,
  drinks,
  sides,
  other,
}

class ModifierFoodCategoryMeta {
  const ModifierFoodCategoryMeta({
    required this.category,
    required this.emoji,
    required this.labelAr,
  });

  final ModifierFoodCategory category;
  final String emoji;
  final String labelAr;
}

const _categoryMeta = <ModifierFoodCategory, ModifierFoodCategoryMeta>{
  ModifierFoodCategory.essentials: ModifierFoodCategoryMeta(
    category: ModifierFoodCategory.essentials,
    emoji: '⭐',
    labelAr: 'أساسي',
  ),
  ModifierFoodCategory.vegetables: ModifierFoodCategoryMeta(
    category: ModifierFoodCategory.vegetables,
    emoji: '🥬',
    labelAr: 'خضار',
  ),
  ModifierFoodCategory.cheeses: ModifierFoodCategoryMeta(
    category: ModifierFoodCategory.cheeses,
    emoji: '🧀',
    labelAr: 'أجبان',
  ),
  ModifierFoodCategory.meats: ModifierFoodCategoryMeta(
    category: ModifierFoodCategory.meats,
    emoji: '🥩',
    labelAr: 'لحوم',
  ),
  ModifierFoodCategory.sauces: ModifierFoodCategoryMeta(
    category: ModifierFoodCategory.sauces,
    emoji: '🌶️',
    labelAr: 'صوصات',
  ),
  ModifierFoodCategory.drinks: ModifierFoodCategoryMeta(
    category: ModifierFoodCategory.drinks,
    emoji: '🥤',
    labelAr: 'مشروبات',
  ),
  ModifierFoodCategory.sides: ModifierFoodCategoryMeta(
    category: ModifierFoodCategory.sides,
    emoji: '🍟',
    labelAr: 'إضافات جانبية',
  ),
  ModifierFoodCategory.other: ModifierFoodCategoryMeta(
    category: ModifierFoodCategory.other,
    emoji: '➕',
    labelAr: 'إضافات',
  ),
};

ModifierFoodCategoryMeta metaForCategory(ModifierFoodCategory c) =>
    _categoryMeta[c] ?? _categoryMeta[ModifierFoodCategory.other]!;

ModifierFoodCategory classifyModifierGroup(ProductOptionGroup group) {
  if (group.required || group.isSingle) {
    return ModifierFoodCategory.essentials;
  }

  final name = group.name.toLowerCase();
  final itemsText = group.items.map((i) => i.name.toLowerCase()).join(' ');

  bool has(String s) => name.contains(s) || itemsText.contains(s);

  if (has('خض') ||
      has('veget') ||
      has('زيتون') ||
      has('فلف') ||
      has('بصل') ||
      has('طماط')) {
    return ModifierFoodCategory.vegetables;
  }
  if (has('جب') || has('cheese') || has('موزار') || has('فيتا')) {
    return ModifierFoodCategory.cheeses;
  }
  if (has('لحم') ||
      has('meat') ||
      has('دجاج') ||
      has('chicken') ||
      has('pepperoni') ||
      has('سجق') ||
      has('ببروني')) {
    return ModifierFoodCategory.meats;
  }
  if (has('صو') || has('sauce') || has('صلص') || has('كاتش') || has('مايون')) {
    return ModifierFoodCategory.sauces;
  }
  if (has('مشرو') ||
      has('drink') ||
      has('كولا') ||
      has('عصير') ||
      has('ماء')) {
    return ModifierFoodCategory.drinks;
  }
  if (has('جانب') || has('side') || has('بطاط') || has('fries')) {
    return ModifierFoodCategory.sides;
  }

  if (productGroupHasHalfOptions(group)) {
    return ModifierFoodCategory.meats;
  }

  return ModifierFoodCategory.other;
}

Map<ModifierFoodCategory, List<ProductOptionGroup>> groupByFoodCategory(
  List<ProductOptionGroup> groups,
) {
  final map = <ModifierFoodCategory, List<ProductOptionGroup>>{};
  for (final group in groups) {
    final cat = classifyModifierGroup(group);
    map.putIfAbsent(cat, () => []).add(group);
  }
  return map;
}

List<ModifierFoodCategory> orderedFoodCategories(
  Map<ModifierFoodCategory, List<ProductOptionGroup>> grouped,
) {
  const order = [
    ModifierFoodCategory.essentials,
    ModifierFoodCategory.vegetables,
    ModifierFoodCategory.cheeses,
    ModifierFoodCategory.meats,
    ModifierFoodCategory.sauces,
    ModifierFoodCategory.drinks,
    ModifierFoodCategory.sides,
    ModifierFoodCategory.other,
  ];
  return order.where((c) => grouped[c]?.isNotEmpty == true).toList();
}
