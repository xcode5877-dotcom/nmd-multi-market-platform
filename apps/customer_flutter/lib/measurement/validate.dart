import 'decimal.dart';
import 'types.dart';

/// Client-side measurement config gate (mirrors server fail-closed intent).
/// Does not replace server validation.
class MeasurementConfigValidation {
  const MeasurementConfigValidation.ok(this.config)
      : ok = true,
        reason = null;
  const MeasurementConfigValidation.fail(this.reason)
      : ok = false,
        config = null;

  final bool ok;
  final ProductMeasurement? config;
  final String? reason;
}

bool _pairAllowed(String type, String base, String display) {
  switch (type) {
    case measurementTypeWeight:
      return base == 'kg' && (display == 'kg' || display == 'g');
    case measurementTypeVolume:
      return base == 'l' && (display == 'l' || display == 'ml');
    case measurementTypePiece:
      return base == 'piece' && display == 'piece';
    case measurementTypePackage:
      return (base == 'pack' || base == 'box' || base == 'bundle') &&
          display == base;
    default:
      return false;
  }
}

MeasurementConfigValidation validateProductMeasurement(ProductMeasurement m) {
  if (!_pairAllowed(m.measurementType, m.baseUnitCode, m.displayUnitCode)) {
    return const MeasurementConfigValidation.fail('illegal_unit_pair');
  }
  final step = parseMeasurementDecimalStrict(m.quantityStep);
  if (!step.ok || step.milli <= 0) {
    return const MeasurementConfigValidation.fail('invalid_step');
  }
  if (step.milli > 1000 * 1000) {
    return const MeasurementConfigValidation.fail('step_too_large');
  }
  final min = parseMeasurementDecimalStrict(m.minimumQuantity);
  if (!min.ok || min.milli <= 0 || min.milli < step.milli) {
    return const MeasurementConfigValidation.fail('invalid_minimum');
  }
  if (m.maximumQuantity != null && m.maximumQuantity!.trim().isNotEmpty) {
    final max = parseMeasurementDecimalStrict(m.maximumQuantity);
    if (!max.ok || max.milli < min.milli) {
      return const MeasurementConfigValidation.fail('invalid_maximum');
    }
  }
  if (m.isPieceLike && !isIntegerMilli(step.milli)) {
    return const MeasurementConfigValidation.fail('piece_fractional_step');
  }
  if (m.measurementVersion < 1) {
    return const MeasurementConfigValidation.fail('invalid_version');
  }
  if (m.displayPrecision != null &&
      (m.displayPrecision! < 0 || m.displayPrecision! > 3)) {
    return const MeasurementConfigValidation.fail('invalid_precision');
  }
  return MeasurementConfigValidation.ok(m);
}
