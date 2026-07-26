import 'decimal.dart';
import 'types.dart';
import 'validate.dart';

ProductMeasurement defaultPieceMeasurement() => const ProductMeasurement(
      measurementType: measurementTypePiece,
      baseUnitCode: 'piece',
      displayUnitCode: 'piece',
      quantityStep: '1',
      minimumQuantity: '1',
      maximumQuantity: null,
      priceBasis: priceBasisPerBaseUnit,
      measurementVersion: 1,
      displayPrecision: 0,
    );

/// Result of reading product measurement from catalog JSON.
class ProductMeasurementResolve {
  const ProductMeasurementResolve({
    required this.measurement,
    required this.valid,
    this.errorCode,
  });

  final ProductMeasurement measurement;
  final bool valid;
  final String? errorCode;
}

bool _hasAuthoritativeFields(Map<String, dynamic> json) {
  return json['measurementType'] != null ||
      json['baseUnitCode'] != null ||
      json['displayUnitCode'] != null ||
      json['minimumQuantity'] != null ||
      json.containsKey('maximumQuantity') ||
      json['priceBasis'] != null ||
      json['measurementVersion'] != null ||
      json.containsKey('displayPrecision');
}

/// Resolve product measurement from server fields.
///
/// Precedence:
/// 1. Authoritative V2 fields when present (never overridden by `unitName`).
/// 2. Missing V2 fields → safe legacy PIECE defaults.
/// 3. Explicit invalid V2 config → [valid]=false (not silently converted to PIECE).
///
/// Do not invent WEIGHT from `unitName` / `isWeightBased` alone without base units.
ProductMeasurementResolve resolveProductMeasurementDetailed(
  Map<String, dynamic>? json,
) {
  if (json == null) {
    return ProductMeasurementResolve(
      measurement: defaultPieceMeasurement(),
      valid: true,
    );
  }

  final hasAuth = _hasAuthoritativeFields(json);

  if (!hasAuth) {
    // Legacy-only / missing: PIECE. Do not invent WEIGHT from unitName.
    if (json['isWeightBased'] == true) {
      final base = (json['baseUnitCode']?.toString() ?? '').toLowerCase();
      if (base != 'kg' && base != 'l') {
        // Legacy weight flag without V2 units — unavailable rather than fake PIECE.
        return ProductMeasurementResolve(
          measurement: defaultPieceMeasurement(),
          valid: false,
          errorCode: 'legacy_weight_without_v2',
        );
      }
    }
    final step = coerceMeasurementDecimalString(json['quantityStep'], '1');
    final m = ProductMeasurement(
      measurementType: measurementTypePiece,
      baseUnitCode: 'piece',
      displayUnitCode: 'piece',
      quantityStep: step == '0' ? '1' : step,
      minimumQuantity: '1',
      maximumQuantity: null,
      priceBasis: priceBasisPerBaseUnit,
      measurementVersion: 1,
      displayPrecision: 0,
    );
    final v = validateProductMeasurement(m);
    return ProductMeasurementResolve(
      measurement: m,
      valid: v.ok,
      errorCode: v.reason,
    );
  }

  final typeRaw = (json['measurementType']?.toString() ?? '').trim().toUpperCase();
  if (typeRaw.isEmpty) {
    return ProductMeasurementResolve(
      measurement: defaultPieceMeasurement(),
      valid: false,
      errorCode: 'missing_measurement_type',
    );
  }

  const known = {
    measurementTypePiece,
    measurementTypeWeight,
    measurementTypeVolume,
    measurementTypePackage,
  };
  if (!known.contains(typeRaw)) {
    return ProductMeasurementResolve(
      measurement: defaultPieceMeasurement(),
      valid: false,
      errorCode: 'unknown_measurement_type',
    );
  }

  String base;
  String display;
  switch (typeRaw) {
    case measurementTypeWeight:
      base = 'kg';
      display = (json['displayUnitCode']?.toString() ?? 'g').toLowerCase();
      if (display != 'kg' && display != 'g') {
        return ProductMeasurementResolve(
          measurement: defaultPieceMeasurement(),
          valid: false,
          errorCode: 'invalid_display_unit',
        );
      }
      break;
    case measurementTypeVolume:
      base = 'l';
      display = (json['displayUnitCode']?.toString() ?? 'ml').toLowerCase();
      if (display != 'l' && display != 'ml') {
        return ProductMeasurementResolve(
          measurement: defaultPieceMeasurement(),
          valid: false,
          errorCode: 'invalid_display_unit',
        );
      }
      break;
    case measurementTypePackage:
      base = (json['baseUnitCode']?.toString() ?? '').toLowerCase();
      if (base != 'pack' && base != 'box' && base != 'bundle') {
        return ProductMeasurementResolve(
          measurement: defaultPieceMeasurement(),
          valid: false,
          errorCode: 'invalid_package_unit',
        );
      }
      display = base;
      break;
    default:
      base = 'piece';
      display = 'piece';
  }

  final stepParsed = parseMeasurementDecimalStrict(json['quantityStep'] ?? '1');
  if (!stepParsed.ok) {
    return ProductMeasurementResolve(
      measurement: defaultPieceMeasurement(),
      valid: false,
      errorCode: 'invalid_step',
    );
  }
  final minParsed = parseMeasurementDecimalStrict(
    json['minimumQuantity'] ?? stepParsed.normalized,
  );
  if (!minParsed.ok) {
    return ProductMeasurementResolve(
      measurement: defaultPieceMeasurement(),
      valid: false,
      errorCode: 'invalid_minimum',
    );
  }

  String? max;
  if (json['maximumQuantity'] != null &&
      json['maximumQuantity'].toString().trim().isNotEmpty) {
    final maxParsed = parseMeasurementDecimalStrict(json['maximumQuantity']);
    if (!maxParsed.ok) {
      return ProductMeasurementResolve(
        measurement: defaultPieceMeasurement(),
        valid: false,
        errorCode: 'invalid_maximum',
      );
    }
    max = maxParsed.normalized;
  }

  final versionRaw = json['measurementVersion'];
  final version = versionRaw is num
      ? versionRaw.toInt()
      : int.tryParse(versionRaw?.toString() ?? '') ?? 1;

  int? precision;
  if (json['displayPrecision'] != null &&
      json['displayPrecision'].toString().trim().isNotEmpty) {
    precision = json['displayPrecision'] is num
        ? (json['displayPrecision'] as num).toInt()
        : int.tryParse(json['displayPrecision'].toString());
  }

  final candidate = ProductMeasurement(
    measurementType: typeRaw,
    baseUnitCode: base,
    displayUnitCode: display,
    quantityStep: stepParsed.normalized,
    minimumQuantity: minParsed.normalized,
    maximumQuantity: max,
    priceBasis: priceBasisPerBaseUnit,
    measurementVersion: version,
    displayPrecision: precision,
  );
  final v = validateProductMeasurement(candidate);
  if (!v.ok) {
    return ProductMeasurementResolve(
      measurement: candidate,
      valid: false,
      errorCode: v.reason,
    );
  }
  return ProductMeasurementResolve(measurement: candidate, valid: true);
}

/// Convenience: measurement only (legacy callers). Prefer [resolveProductMeasurementDetailed].
ProductMeasurement resolveProductMeasurement(Map<String, dynamic>? json) {
  return resolveProductMeasurementDetailed(json).measurement;
}

/// Resolve measurement from order-line snapshots (never reinterpret via catalog).
ProductMeasurement resolveMeasurementFromOrderLine(Map<String, dynamic> m) {
  final snapType = m['measurementTypeSnapshot'] ?? m['measurementType'];
  final snapBase = m['baseUnitCodeSnapshot'] ?? m['baseUnitCode'];
  final snapDisplay = m['displayUnitCodeSnapshot'] ?? m['displayUnitCode'];
  final snapStep = m['quantityStepSnapshot'] ?? m['quantityStep'];
  final snapMin = m['minimumQuantitySnapshot'] ?? m['minimumQuantity'];
  final snapMax = m['maximumQuantitySnapshot'] ?? m['maximumQuantity'];
  final snapVersion = m['measurementVersionSnapshot'] ?? m['measurementVersion'];
  final snapPrecision = m['displayPrecisionSnapshot'] ?? m['displayPrecision'];

  if (snapType == null && snapBase == null) {
    return defaultPieceMeasurement();
  }

  return resolveProductMeasurementDetailed({
    'measurementType': snapType,
    'baseUnitCode': snapBase,
    'displayUnitCode': snapDisplay,
    'quantityStep': snapStep ?? '1',
    'minimumQuantity': snapMin ?? snapStep ?? '1',
    'maximumQuantity': snapMax,
    'measurementVersion': snapVersion ?? 1,
    'displayPrecision': snapPrecision,
  }).measurement;
}

String orderLineQuantityDecimal(Map<String, dynamic> m) {
  if (m['measurementV2Required'] == true && m['quantity'] == null) {
    // Redacted for unsupported clients — supported app should still have quantityDecimal.
    final qd = m['quantityDecimal'];
    if (qd != null && qd.toString().trim().isNotEmpty) {
      return coerceMeasurementDecimalString(qd, '1');
    }
    return '1';
  }
  final qd = m['quantityDecimal'];
  if (qd != null && qd.toString().trim().isNotEmpty) {
    return coerceMeasurementDecimalString(qd, '1');
  }
  if (m['quantity'] != null) {
    return coerceMeasurementDecimalString(m['quantity'], '1');
  }
  return '1';
}
