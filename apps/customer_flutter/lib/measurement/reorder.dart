import 'quantity_steps.dart';
import 'resolve.dart';
import 'types.dart';

/// Result of checking whether an order line can be re-ordered into the cart.
class ReorderLineCheck {
  const ReorderLineCheck.ok({
    required this.quantity,
    required this.measurement,
  })  : blocked = false,
        messageAr = null;

  const ReorderLineCheck.blocked(this.messageAr)
      : blocked = true,
        quantity = null,
        measurement = null;

  final bool blocked;
  final String? messageAr;
  final String? quantity;
  final ProductMeasurement? measurement;
}

const kReorderConfigChangedAr =
    'تغيّرت إعدادات هذا المنتج. يرجى اختيار كمية جديدة.';

/// Block reorder of a single line when catalog measurement no longer matches
/// the order-line snapshot (type/step/version). Never auto-round.
ReorderLineCheck evaluateReorderLine({
  required Map<String, dynamic> orderItem,
  ProductMeasurement? currentCatalogMeasurement,
}) {
  final snapshot = resolveMeasurementFromOrderLine(orderItem);
  final qty = orderLineQuantityDecimal(orderItem);

  if (currentCatalogMeasurement == null) {
    if (snapshot.isWeighted) {
      return const ReorderLineCheck.blocked(kReorderConfigChangedAr);
    }
    return ReorderLineCheck.ok(quantity: qty, measurement: snapshot);
  }

  final cur = currentCatalogMeasurement;
  final changed = snapshot.measurementType != cur.measurementType ||
      snapshot.baseUnitCode != cur.baseUnitCode ||
      snapshot.quantityStep != cur.quantityStep ||
      snapshot.measurementVersion != cur.measurementVersion;

  if (changed) {
    return const ReorderLineCheck.blocked(kReorderConfigChangedAr);
  }

  if (!quantityMatchesStep(cur, qty)) {
    return const ReorderLineCheck.blocked(kReorderConfigChangedAr);
  }

  return ReorderLineCheck.ok(quantity: qty, measurement: cur);
}
