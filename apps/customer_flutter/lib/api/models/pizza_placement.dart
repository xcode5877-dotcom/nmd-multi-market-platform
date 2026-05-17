/// Matches web `@nmd/core` [PizzaPlacement] / `PizzaAddonsSelector` (`WHOLE` | `LEFT` | `RIGHT`).
abstract final class PizzaPlacement {
  static const String whole = 'WHOLE';
  static const String left = 'LEFT';
  static const String right = 'RIGHT';

  /// Default for modifiers without an explicit side (web uses `WHOLE`).
  static const String defaultPlacement = whole;
}

String pizzaSideLabelAr(String api) {
  switch (api.toUpperCase()) {
    case PizzaPlacement.left:
      return 'نصف يسار';
    case PizzaPlacement.right:
      return 'نصف يمين';
    case PizzaPlacement.whole:
      return 'كاملة';
    default:
      return api;
  }
}

/// Whole: name only; left/right: `name (نصف …)` — matches `@nmd/core` [formatAddonNameWithPlacement].
String formatAddonNameWithPlacementAr(String name, String? placementApi) {
  final p = (placementApi ?? PizzaPlacement.whole).toUpperCase();
  if (p == PizzaPlacement.whole) return name;
  return '$name (${pizzaSideLabelAr(p)})';
}
