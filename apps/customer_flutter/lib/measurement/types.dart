// Measurement V2 types — mirror of `@nmd/core` measurement types.
// Never infer; values come from the server.

typedef MeasurementType = String;
typedef BaseUnitCode = String;
typedef DisplayUnitCode = String;
typedef PriceBasis = String;

const measurementTypePiece = 'PIECE';
const measurementTypeWeight = 'WEIGHT';
const measurementTypeVolume = 'VOLUME';
const measurementTypePackage = 'PACKAGE';

const priceBasisPerBaseUnit = 'PER_BASE_UNIT';

class ProductMeasurement {
  const ProductMeasurement({
    required this.measurementType,
    required this.baseUnitCode,
    required this.displayUnitCode,
    required this.quantityStep,
    required this.minimumQuantity,
    this.maximumQuantity,
    this.priceBasis = priceBasisPerBaseUnit,
    this.measurementVersion = 1,
    this.displayPrecision,
  });

  final MeasurementType measurementType;
  final BaseUnitCode baseUnitCode;
  final DisplayUnitCode displayUnitCode;

  /// Base-unit increment, normalized decimal string (e.g. `"0.25"`).
  final String quantityStep;

  /// Base-unit minimum, normalized decimal string.
  final String minimumQuantity;

  /// Base-unit maximum, or null.
  final String? maximumQuantity;

  final PriceBasis priceBasis;
  final int measurementVersion;
  final int? displayPrecision;

  bool get isPieceLike =>
      measurementType == measurementTypePiece ||
      measurementType == measurementTypePackage;

  bool get isWeighted =>
      measurementType == measurementTypeWeight ||
      measurementType == measurementTypeVolume;
}
