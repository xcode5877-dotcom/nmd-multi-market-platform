import 'decimal.dart';
import 'format.dart';
import 'types.dart';

/// Build bounded chip options from server step/min/max.
/// Cap prevents huge lists (e.g. step 0.05 × max 100). Remaining range via ±.
List<String> buildQuantityOptions(ProductMeasurement m, {int maxOptions = 12}) {
  final step = parseMeasurementDecimalStrict(m.quantityStep);
  final min = parseMeasurementDecimalStrict(m.minimumQuantity);
  if (!step.ok || !min.ok || step.milli <= 0) {
    return const ['1'];
  }

  int? configuredMax;
  if (m.maximumQuantity != null && m.maximumQuantity!.trim().isNotEmpty) {
    final max = parseMeasurementDecimalStrict(m.maximumQuantity);
    if (max.ok) configuredMax = max.milli;
  }

  // Practical chip window: ~8 steps above min when max is huge/absent.
  final practicalEnd = min.milli + step.milli * (m.isWeighted ? 8 : 11);
  final end = configuredMax == null
      ? practicalEnd
      : (configuredMax < practicalEnd ? configuredMax : practicalEnd);
  final maxMilli = end < min.milli ? min.milli : end;

  final out = <String>[];
  var cur = min.milli;
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
