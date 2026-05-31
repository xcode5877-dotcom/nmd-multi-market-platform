/// Display helpers for modifier price deltas (customer-facing).
String formatCustomizationDelta(double delta) {
  final abs = delta.abs().toStringAsFixed(2);
  final sign = delta >= 0 ? '+' : '-';
  return '$sign$abs₪';
}
