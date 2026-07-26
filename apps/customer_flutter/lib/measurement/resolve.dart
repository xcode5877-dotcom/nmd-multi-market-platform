import 'decimal.dart';
import 'types.dart';

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

/// Resolve product measurement from server fields. Never invent WEIGHT/VOLUME.
/// Legacy `isWeightBased` alone is not used to invent config without type —
/// if authoritative fields exist, use them; otherwise PIECE defaults.
ProductMeasurement resolveProductMeasurement(Map<String, dynamic>? json) {
  if (json == null) return defaultPieceMeasurement();

  if (!_hasAuthoritativeFields(json) && json['isWeightBased'] != true) {
    // Legacy piece / missing fields
    final step = coerceMeasurementDecimalString(json['quantityStep'], '1');
    return ProductMeasurement(
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
  }

  final typeRaw = (json['measurementType']?.toString() ?? '').toUpperCase();
  var type = typeRaw;
  if (type.isEmpty && json['isWeightBased'] == true) {
    // Legacy weight signal without V2 type — treat as WEIGHT kg/g only when
    // dual-emit already present from a V2-capable catalog. Without baseUnitCode,
    // fall back to PIECE to avoid inventing illegal config.
    final base = (json['baseUnitCode']?.toString() ?? '').toLowerCase();
    if (base == 'kg' || base == 'l') {
      type = base == 'l' ? measurementTypeVolume : measurementTypeWeight;
    } else {
      return defaultPieceMeasurement();
    }
  }
  if (type.isEmpty) type = measurementTypePiece;

  String base;
  String display;
  switch (type) {
    case measurementTypeWeight:
      base = 'kg';
      display = (json['displayUnitCode']?.toString() ?? 'g').toLowerCase();
      if (display != 'kg' && display != 'g') display = 'g';
      break;
    case measurementTypeVolume:
      base = 'l';
      display = (json['displayUnitCode']?.toString() ?? 'ml').toLowerCase();
      if (display != 'l' && display != 'ml') display = 'ml';
      break;
    case measurementTypePackage:
      base = (json['baseUnitCode']?.toString() ?? 'pack').toLowerCase();
      if (base != 'pack' && base != 'box' && base != 'bundle') base = 'pack';
      display = base;
      break;
    default:
      type = measurementTypePiece;
      base = 'piece';
      display = 'piece';
  }

  final step = coerceMeasurementDecimalString(json['quantityStep'], '1');
  final min = coerceMeasurementDecimalString(
    json['minimumQuantity'] ?? step,
    step,
  );
  String? max;
  if (json['maximumQuantity'] != null &&
      json['maximumQuantity'].toString().trim().isNotEmpty) {
    max = coerceMeasurementDecimalString(json['maximumQuantity'], min);
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

  return ProductMeasurement(
    measurementType: type,
    baseUnitCode: base,
    displayUnitCode: display,
    quantityStep: step,
    minimumQuantity: min,
    maximumQuantity: max,
    priceBasis: priceBasisPerBaseUnit,
    measurementVersion: version < 1 ? 1 : version,
    displayPrecision: precision,
  );
}

/// Resolve measurement from order-line snapshots (never reinterpret).
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

  return resolveProductMeasurement({
    'measurementType': snapType,
    'baseUnitCode': snapBase,
    'displayUnitCode': snapDisplay,
    'quantityStep': snapStep ?? '1',
    'minimumQuantity': snapMin ?? snapStep ?? '1',
    'maximumQuantity': snapMax,
    'measurementVersion': snapVersion ?? 1,
    'displayPrecision': snapPrecision,
  });
}

String orderLineQuantityDecimal(Map<String, dynamic> m) {
  final qd = m['quantityDecimal'];
  if (qd != null && qd.toString().trim().isNotEmpty) {
    return coerceMeasurementDecimalString(qd, '1');
  }
  if (m['quantity'] != null) {
    return coerceMeasurementDecimalString(m['quantity'], '1');
  }
  return '1';
}
