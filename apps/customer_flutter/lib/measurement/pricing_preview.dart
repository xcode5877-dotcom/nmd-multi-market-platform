import 'decimal.dart';

const int _agora = 100;
const int _milli = 1000;

int? shekelsToAgora(Object? amount) {
  if (amount == null || amount == '') return null;
  if (amount is num) {
    if (!amount.isFinite) return null;
    return (amount * _agora).round();
  }
  final s = amount.toString().trim();
  if (s.isEmpty || RegExp(r'[eE]').hasMatch(s)) return null;
  if (!RegExp(r'^-?\d+(\.\d+)?$').hasMatch(s)) return null;
  final n = num.tryParse(s);
  if (n == null || !n.isFinite) return null;
  return (n * _agora).round();
}

double agoraToShekels(int agora) => agora / _agora;

/// Preview-only line subtotal via integer agora × milli math.
/// Server remains authoritative at checkout.
double calculateLineSubtotal(Object? unitPriceShekels, Object? quantity) {
  final unitAgora = shekelsToAgora(unitPriceShekels);
  if (unitAgora == null) return 0;
  final qty = quantity is int && quantity.abs() < 1000000000000
      ? parseMeasurementDecimalStrict(milliToNormalizedString(quantity * _milli))
      : parseMeasurementDecimalStrict(quantity);
  if (!qty.ok) return 0;
  final subtotalAgora = ((unitAgora * qty.milli) / _milli).round();
  return agoraToShekels(subtotalAgora);
}
