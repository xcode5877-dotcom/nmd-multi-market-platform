import 'decimal.dart';
import 'types.dart';

String arabicUnitLabel(DisplayUnitCode displayUnitCode) {
  switch (displayUnitCode) {
    case 'kg':
      return 'كغم';
    case 'g':
      return 'غرام';
    case 'l':
      return 'لتر';
    case 'ml':
      return 'مل';
    case 'piece':
      return 'حبة';
    case 'pack':
      return 'علبة';
    case 'box':
      return 'كرتونة';
    case 'bundle':
      return 'ربطة';
    default:
      return 'حبة';
  }
}

/// Short unit for price cards: `/ كغم`, `/ لتر`.
String? priceUnitSuffixAr(MeasurementType type) {
  if (type == measurementTypeWeight) return 'كغم';
  if (type == measurementTypeVolume) return 'لتر';
  return null;
}

/// Format a base-unit quantity for display (parity with `@nmd/core` formatQuantity).
String formatQuantity({
  required Object quantityBase,
  required BaseUnitCode baseUnitCode,
  required DisplayUnitCode displayUnitCode,
  int? displayPrecision,
}) {
  final parsed = parseMeasurementDecimalStrict(quantityBase);
  if (!parsed.ok) return '0 ${arabicUnitLabel(displayUnitCode)}';

  final displayMilli = baseMilliToDisplayMilli(
    parsed.milli,
    baseUnitCode,
    displayUnitCode,
  );
  final label = arabicUnitLabel(displayUnitCode);
  final isAtomicDisplay = displayUnitCode == 'g' ||
      displayUnitCode == 'ml' ||
      displayUnitCode == 'piece' ||
      displayUnitCode == 'pack' ||
      displayUnitCode == 'box' ||
      displayUnitCode == 'bundle';

  var amountStr = isAtomicDisplay && displayMilli % 1000 == 0
      ? '${displayMilli ~/ 1000}'
      : milliToNormalizedString(displayMilli);

  final preferred = displayPrecision != null &&
          displayPrecision >= 0 &&
          displayPrecision <= 3
      ? displayPrecision
      : null;
  if (preferred != null) {
    amountStr = _formatWithPreferredPrecision(amountStr, preferred);
  }

  return '$amountStr $label';
}

String formatQuantityFromMeasurement(
  Object quantityBase,
  ProductMeasurement m,
) {
  return formatQuantity(
    quantityBase: quantityBase,
    baseUnitCode: m.baseUnitCode,
    displayUnitCode: m.displayUnitCode,
    displayPrecision: m.displayPrecision,
  );
}

String _formatWithPreferredPrecision(String exactNormalized, int preferred) {
  final required = _decimalPlacesOf(exactNormalized);
  final effective = preferred > required ? preferred : required;
  final n = num.tryParse(exactNormalized);
  if (n == null || !n.isFinite) return exactNormalized;
  if (effective == 0) return '${n.truncate()}';
  var fixed = n.toStringAsFixed(effective);
  fixed = fixed.replaceAll(RegExp(r'0+$'), '').replaceAll(RegExp(r'\.$'), '');
  return fixed;
}

int _decimalPlacesOf(String normalized) {
  final i = normalized.indexOf('.');
  return i < 0 ? 0 : normalized.length - i - 1;
}
