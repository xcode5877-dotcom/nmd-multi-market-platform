import 'decimal.dart';
import 'format.dart';
import 'types.dart';

/// Build selectable quantity options from server step/min/max (chips / wheel).
List<String> buildQuantityOptions(ProductMeasurement m, {int maxOptions = 24}) {
  final step = parseMeasurementDecimalStrict(m.quantityStep);
  final min = parseMeasurementDecimalStrict(m.minimumQuantity);
  if (!step.ok || !min.ok || step.milli <= 0) {
    return const ['1'];
  }

  int? maxMilli;
  if (m.maximumQuantity != null && m.maximumQuantity!.trim().isNotEmpty) {
    final max = parseMeasurementDecimalStrict(m.maximumQuantity);
    if (max.ok) maxMilli = max.milli;
  }

  // Default span: enough to show friendly options (e.g. up to ~2 kg / 2 l / 12 pcs)
  maxMilli ??= min.milli + step.milli * (m.isWeighted ? 8 : 11);
  if (maxMilli < min.milli) maxMilli = min.milli;

  final out = <String>[];
  var cur = min.milli;
  // Align to step grid from min
  while (cur <= maxMilli && out.length < maxOptions) {
    out.add(milliToNormalizedString(cur));
    cur += step.milli;
  }
  if (out.isEmpty) out.add(min.normalized);
  return out;
}

List<String> quantityChipLabels(ProductMeasurement m, List<String> options) {
  return options
      .map((q) => formatQuantityFromMeasurement(q, m))
      .toList(growable: false);
}

/// Next quantity after [current] by one step, or null if above max.
String? nextQuantity(ProductMeasurement m, String current) {
  final cur = parseMeasurementDecimalStrict(current);
  final step = parseMeasurementDecimalStrict(m.quantityStep);
  if (!cur.ok || !step.ok) return null;
  final next = cur.milli + step.milli;
  if (m.maximumQuantity != null && m.maximumQuantity!.trim().isNotEmpty) {
    final max = parseMeasurementDecimalStrict(m.maximumQuantity);
    if (max.ok && next > max.milli) return null;
  }
  return milliToNormalizedString(next);
}

/// Previous quantity, or null if at/below minimum.
String? previousQuantity(ProductMeasurement m, String current) {
  final cur = parseMeasurementDecimalStrict(current);
  final step = parseMeasurementDecimalStrict(m.quantityStep);
  final min = parseMeasurementDecimalStrict(m.minimumQuantity);
  if (!cur.ok || !step.ok || !min.ok) return null;
  final next = cur.milli - step.milli;
  if (next < min.milli) return null;
  return milliToNormalizedString(next);
}

bool quantityMatchesStep(ProductMeasurement m, String quantity) {
  final q = parseMeasurementDecimalStrict(quantity);
  final step = parseMeasurementDecimalStrict(m.quantityStep);
  final min = parseMeasurementDecimalStrict(m.minimumQuantity);
  if (!q.ok || !step.ok || !min.ok || step.milli <= 0) return false;
  if (q.milli < min.milli) return false;
  if (m.maximumQuantity != null && m.maximumQuantity!.trim().isNotEmpty) {
    final max = parseMeasurementDecimalStrict(m.maximumQuantity);
    if (max.ok && q.milli > max.milli) return false;
  }
  return (q.milli - min.milli) % step.milli == 0;
}
