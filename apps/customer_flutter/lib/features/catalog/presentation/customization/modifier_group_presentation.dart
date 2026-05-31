import '../../../../api/models/product.dart';
import 'modifier_food_category.dart';

/// Maps modifier groups to friendly Arabic food UX labels.
abstract final class ModifierGroupPresentationResolver {
  static String groupTitle(ProductOptionGroup group) {
    final raw = group.name.trim();
    if (raw.isEmpty) return _fallbackTitle(group);

    final normalized = _normalize(raw);
    if (_isTechnicalLabel(normalized)) return _fallbackTitle(group);

    return _prettify(raw);
  }

  static String selectionHint(ProductOptionGroup group) {
    if (group.required) {
      return group.isSingle ? 'اختر المفضل' : 'اختر إضافة';
    }
    if (group.isSingle) return 'اختر واحد';
    return 'لمسة إضافية';
  }

  static String optionalBadge() => 'لمسة إضافية';

  static String requiredBadge({required bool missing}) =>
      missing ? 'مطلوب' : 'تم ✓';

  static String pizzaSplitTitle() => 'نصفين بطريقتك';

  static String pizzaSplitAction() => 'وزّع الإضافات';

  static String pizzaSplitEmptyHint() =>
      'اختر إضافاتك أولاً ثم وزّعها على النصفين';

  static String pizzaSplitSubtitle() =>
      'اختر الإضافات لكل نصف من البيتزا';

  static String pizzaHalfVisualHint() =>
      'الإضافات تظهر على البيتزا حسب اختيارك';

  static String pizzaFullModeSummary() =>
      'تم توزيع الإضافات على كامل البيتزا';

  static String pizzaFullModeTitle() => 'إضافات على كامل البيتزا';

  static String advancedCustomization() => 'تفاصيل أكثر';

  static String _normalize(String s) =>
      s.toLowerCase().replaceAll(RegExp(r'\s+'), ' ').trim();

  static bool _isTechnicalLabel(String normalized) {
    const technical = {
      'خيار واحد',
      'اختيار واحد',
      'single choice',
      'optional',
      'required',
      'modifier',
      'option group',
      'تخصيص',
      'options',
    };
    return technical.contains(normalized);
  }

  static String _fallbackTitle(ProductOptionGroup group) {
    final category = classifyModifierGroup(group);
    final name = group.name.toLowerCase();

    if (name.contains('صوص') || name.contains('sauce')) return 'اختر الصوص';
    if (name.contains('جبن') || name.contains('cheese')) return 'اختر الجبنة';
    if (name.contains('حجم') || name.contains('size')) return 'اختر الحجم';
    if (name.contains('عج') || name.contains('dough')) return 'اختر العجينة';
    if (name.contains('برجر') || name.contains('burger')) {
      return 'تخصيص البرجر';
    }
    if (name.contains('بيتز') || name.contains('pizza')) {
      return 'إضافات البيتزا';
    }
    if (group.isSingle && group.required) return 'اختر المفضل';
    if (group.isSingle) return 'اختر إضافة';
    if (group.required) return 'إضافاتك';

    switch (category) {
      case ModifierFoodCategory.sauces:
        return 'اختر الصوص';
      case ModifierFoodCategory.cheeses:
        return 'اختر الجبنة';
      case ModifierFoodCategory.vegetables:
        return 'أضف نكهتك';
      case ModifierFoodCategory.meats:
        return 'اختر البروتين';
      case ModifierFoodCategory.drinks:
        return 'اختر المشروب';
      case ModifierFoodCategory.sides:
        return 'إضافات جانبية';
      case ModifierFoodCategory.essentials:
        return 'اختر المفضل';
      case ModifierFoodCategory.other:
        return 'إضافاتك';
    }
  }

  static String _prettify(String raw) {
    var s = raw;
    s = s.replaceAll(RegExp(r'خيار\s*واحد', caseSensitive: false), 'اختر إضافة');
    s = s.replaceAll(RegExp(r'^optional\s*', caseSensitive: false), '');
    s = s.replaceAll(RegExp(r'^required\s*', caseSensitive: false), '');
    return s.trim().isEmpty ? 'إضافاتك' : s.trim();
  }
}
