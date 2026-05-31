import '../../../../api/models/pizza_placement.dart';
import '../../../../api/models/product.dart';
import 'product_complexity_classifier.dart';

/// Human-readable selection preview for accordion headers / summary bar.
String groupSelectionPreview(
  ProductOptionGroup group,
  Set<String> selectedIds,
  Map<String, String> placements,
) {
  if (selectedIds.isEmpty) return 'لم يُحدد بعد';
  final names = <String>[];
  for (final id in selectedIds) {
    ProductOptionItem? item;
    for (final i in group.items) {
      if (i.id == id) {
        item = i;
        break;
      }
    }
    if (item == null) continue;
    var label = item.name;
    if (productGroupHasHalfOptions(group) &&
        productOptionSupportsHalf(item, group)) {
      final side = (placements[id] ?? PizzaPlacement.defaultPlacement)
          .toUpperCase();
      if (side != PizzaPlacement.whole) {
        label = '$label (${pizzaSideLabelAr(side)})';
      }
    }
    names.add(label);
  }
  return names.join('، ');
}

String customizationSummaryLine(
  Product product,
  Map<String, Set<String>> selectedByGroup,
  Map<String, Map<String, String>> placementByGroup,
) {
  final parts = <String>[];
  for (final group in activeOptionGroups(product)) {
    final ids = selectedByGroup[group.id];
    if (ids == null || ids.isEmpty) continue;
    parts.add(groupSelectionPreview(
      group,
      ids,
      placementByGroup[group.id] ?? const {},
    ));
  }
  if (parts.isEmpty) return 'اختر الخيارات';
  if (parts.length <= 2) return parts.join(' · ');
  return '${parts.take(2).join(' · ')} +${parts.length - 2}';
}
