/// Luhn check for payment card PAN (digits only or with spaces).
bool luhnCheck(String input) {
  final digits = input.replaceAll(RegExp(r'\D'), '');
  if (digits.length < 13 || digits.length > 19) return false;
  var sum = 0;
  var alt = false;
  for (var i = digits.length - 1; i >= 0; i--) {
    var n = int.tryParse(digits.substring(i, i + 1)) ?? 0;
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 == 0;
}

String inferCardBrand(String digitsRaw) {
  final d = digitsRaw.replaceAll(RegExp(r'\D'), '');
  if (d.startsWith('4')) return 'Visa';
  if (RegExp(r'^5[1-5]').hasMatch(d)) return 'Mastercard';
  if (RegExp(r'^3[47]').hasMatch(d)) return 'Amex';
  if (RegExp(r'^6(?:011|5)').hasMatch(d)) return 'Discover';
  return 'Card';
}

int expectedCvvLength(String digitsRaw) {
  final d = digitsRaw.replaceAll(RegExp(r'\D'), '');
  return inferCardBrand(d) == 'Amex' ? 4 : 3;
}
