/// Measurement V2 fields from catalog API (weight / volume / piece).
class ProductMeasurement {
  const ProductMeasurement({
    required this.measurementType,
    required this.baseUnitCode,
    required this.displayUnitCode,
    required this.quantityStep,
    required this.minimumQuantity,
    this.maximumQuantity,
    required this.priceBasis,
    required this.measurementVersion,
    this.displayPrecision,
    required this.isWeightBased,
    required this.unitName,
  });

  final String measurementType;
  final String baseUnitCode;
  final String displayUnitCode;
  final double quantityStep;
  final double minimumQuantity;
  final double? maximumQuantity;
  final String priceBasis;
  final int measurementVersion;
  final int? displayPrecision;
  final bool isWeightBased;
  final String unitName;

  /// True for WEIGHT/VOLUME (and legacy weighted) — uses step list, not piece ±1.
  bool get isWeightProduct =>
      measurementType == 'WEIGHT' ||
      measurementType == 'VOLUME' ||
      isWeightBased;

  /// Discrete base-unit quantities from min → max by [quantityStep].
  ///
  /// Uses integer milli-units (×1000) so 0.1 / 0.25 / 0.5 never drift.
  /// Legacy null [maximumQuantity]: expose only the configured minimum
  /// (no invented open-ended sequence). New WEIGHT/VOLUME writes require max.
  List<double> selectableQuantities() {
    final stepMilli = (quantityStep * 1000).round();
    final minBase =
        minimumQuantity > 0 ? minimumQuantity : (quantityStep > 0 ? quantityStep : 1.0);
    final minMilli = (minBase * 1000).round();
    if (stepMilli <= 0) return [_roundBaseQuantity(minBase)];

    // Legacy / incomplete: no max → single selectable quantity (the min/default).
    if (maximumQuantity == null) {
      return [_roundBaseQuantity(minBase)];
    }

    final maxMilli = (maximumQuantity! * 1000).round();
    if (maxMilli < minMilli) {
      return [_roundBaseQuantity(minBase)];
    }

    final out = <double>[];
    var qMilli = minMilli;
    var guard = 0;
    while (qMilli <= maxMilli && guard < 256) {
      out.add(_roundBaseQuantity(qMilli / 1000));
      qMilli += stepMilli;
      guard++;
    }
    if (out.isEmpty) out.add(_roundBaseQuantity(minBase));
    return out;
  }

  /// Index of [quantity] in [selectableQuantities], or -1 if not exact.
  int indexOfSelectable(double quantity) {
    final options = selectableQuantities();
    return options.indexWhere((q) => (q - quantity).abs() < 0.0001);
  }

  bool canDecrementFrom(double quantity) => indexOfSelectable(quantity) > 0;

  bool canIncrementFrom(double quantity) {
    final options = selectableQuantities();
    final idx = indexOfSelectable(quantity);
    return idx >= 0 && idx < options.length - 1;
  }

  String formatQuantityLabel(double quantityInBase) {
    if (displayUnitCode == 'g' && baseUnitCode == 'kg') {
      final grams = (quantityInBase * 1000).round();
      return '$grams غرام';
    }
    if (displayUnitCode == 'kg' || baseUnitCode == 'kg') {
      final rounded = _roundBaseQuantity(quantityInBase);
      final unit = unitName.trim().isNotEmpty ? unitName.trim() : 'كغ';
      if (rounded == rounded.roundToDouble()) {
        return '${rounded.toInt()} $unit';
      }
      return '$rounded $unit';
    }
    if (quantityInBase == quantityInBase.roundToDouble()) {
      return '${quantityInBase.toInt()} $unitName';
    }
    return '$quantityInBase $unitName';
  }

  double lineTotal(double pricePerBaseUnit, double quantityInBase) =>
      pricePerBaseUnit * quantityInBase;

  static ProductMeasurement? fromProductJson(Map<String, dynamic> json) {
    final type = (json['measurementType']?.toString() ?? '').trim();
    final legacyWeight = json['isWeightBased'] == true;
    final stepRaw = json['quantityStep'];
    final step = _parseNum(stepRaw);
    final treatAsMeasured = type == 'WEIGHT' ||
        type == 'VOLUME' ||
        legacyWeight ||
        (step > 0 && step < 1);

    if (!treatAsMeasured && type != 'WEIGHT' && type != 'VOLUME') {
      return null;
    }

    final base = (json['baseUnitCode']?.toString() ?? 'kg').trim().toLowerCase();
    final display =
        (json['displayUnitCode']?.toString() ?? base).trim().toLowerCase();
    final min = _parseNum(json['minimumQuantity'], fallback: step > 0 ? step : 1);
    final maxRaw = json['maximumQuantity'];
    final max = maxRaw == null || '$maxRaw'.trim().isEmpty
        ? null
        : _parseNum(maxRaw);
    final versionRaw = json['measurementVersion'];
    final version = versionRaw is num
        ? versionRaw.toInt()
        : int.tryParse('$versionRaw') ?? 1;
    final dpRaw = json['displayPrecision'];
    final dp = dpRaw == null
        ? null
        : (dpRaw is num ? dpRaw.toInt() : int.tryParse('$dpRaw'));

    return ProductMeasurement(
      measurementType: type.isNotEmpty
          ? type
          : (legacyWeight || base == 'kg' ? 'WEIGHT' : 'PIECE'),
      baseUnitCode: base.isNotEmpty ? base : 'kg',
      displayUnitCode: display.isNotEmpty ? display : 'kg',
      quantityStep: step > 0 ? step : 0.25,
      minimumQuantity: min > 0 ? min : (step > 0 ? step : 0.25),
      maximumQuantity: max,
      priceBasis:
          (json['priceBasis']?.toString() ?? 'PER_BASE_UNIT').trim(),
      measurementVersion: version,
      displayPrecision: dp,
      isWeightBased: legacyWeight || type == 'WEIGHT' || type == 'VOLUME',
      unitName: (json['unitName']?.toString() ?? '').trim().isNotEmpty
          ? json['unitName'].toString().trim()
          : (display == 'g' ? 'غرام' : 'كغم'),
    );
  }

  Map<String, dynamic> toOrderSnapshot() => {
        'measurementType': measurementType,
        'baseUnitCode': baseUnitCode,
        'displayUnitCode': displayUnitCode,
        'quantityStep': quantityStep,
        'minimumQuantity': minimumQuantity,
        if (maximumQuantity != null) 'maximumQuantity': maximumQuantity,
        'priceBasis': priceBasis,
        'measurementVersion': measurementVersion,
        if (displayPrecision != null) 'displayPrecision': displayPrecision,
        'isWeightBased': isWeightBased,
        'unitName': unitName,
      };

  static double _parseNum(dynamic value, {double fallback = 0}) {
    if (value == null) return fallback;
    if (value is num) return value.toDouble();
    return double.tryParse(value.toString().trim()) ?? fallback;
  }

  static double _roundBaseQuantity(double q) {
    // Avoid float drift on 0.25 multiples (milli-scale).
    final milli = (q * 1000).round();
    return milli / 1000;
  }
}
