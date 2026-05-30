/// Customer-facing price and money formatting (RTL marketplace).
abstract final class NmdFormat {
  static String price(num value) => value.toStringAsFixed(2);

  static String money(num value) => '₪${price(value)}';

  static String moneySigned(num value, {bool negative = false}) {
    final prefix = negative ? '-₪' : '₪';
    return '$prefix${price(value.abs())}';
  }
}
