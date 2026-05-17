import 'package:collection/collection.dart';

/// Parity with web `PizzaSelectedOption` / `SelectedOption` in `@nmd/core` cart types.
final class CartSelectedOption {
  const CartSelectedOption({
    required this.optionGroupId,
    required this.optionItemIds,
    this.sliceSelection,
    this.optionPlacements = const {},
  });

  final String optionGroupId;
  final List<String> optionItemIds;

  /// Required on web for `PizzaSelectedOption`; addon rows use `'WHOLE'`.
  final String? sliceSelection;

  /// `optionId` -> `WHOLE` | `LEFT` | `RIGHT` (same keys as web `optionPlacements`).
  final Map<String, String> optionPlacements;

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is CartSelectedOption &&
        other.optionGroupId == optionGroupId &&
        const ListEquality<String>()
            .equals(other.optionItemIds, optionItemIds) &&
        other.sliceSelection == sliceSelection &&
        const MapEquality<String, String>()
            .equals(other.optionPlacements, optionPlacements);
  }

  @override
  int get hashCode {
    final entries = optionPlacements.entries.toList()
      ..sort((a, b) => a.key.compareTo(b.key));
    return Object.hash(
      optionGroupId,
      Object.hashAll(optionItemIds),
      sliceSelection,
      Object.hashAll(entries.map((e) => Object.hash(e.key, e.value))),
    );
  }
}

bool cartSelectedOptionsListsEqual(
  List<CartSelectedOption> a,
  List<CartSelectedOption> b,
) {
  if (a.length != b.length) return false;
  final sa = [...a]..sort((x, y) => x.optionGroupId.compareTo(y.optionGroupId));
  final sb = [...b]..sort((x, y) => x.optionGroupId.compareTo(y.optionGroupId));
  for (var i = 0; i < sa.length; i++) {
    if (sa[i] != sb[i]) return false;
  }
  return true;
}
