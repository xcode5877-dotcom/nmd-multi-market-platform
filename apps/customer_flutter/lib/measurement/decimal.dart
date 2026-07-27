// Decimal-safe helpers for measurement quantities (max 3 decimal places).
// Uses integer milli-units (×1000) to avoid floating-point artefacts.

const int kMeasurementScale = 1000;

class MeasurementDecimalParse {
  const MeasurementDecimalParse._ok(this.milli, this.normalized)
      : ok = true,
        reason = null;
  const MeasurementDecimalParse._fail(this.reason)
      : ok = false,
        milli = 0,
        normalized = '';

  final bool ok;
  final int milli;
  final String normalized;
  final String? reason;
}

MeasurementDecimalParse parseMeasurementDecimalStrict(Object? value) {
  if (value == null || value == '') {
    return const MeasurementDecimalParse._fail('missing');
  }

  if (value is num) {
    if (!value.isFinite) {
      return const MeasurementDecimalParse._fail('not_finite');
    }
    final milli = (value * kMeasurementScale).round();
    if (((milli / kMeasurementScale) - value).abs() > 1e-9) {
      return const MeasurementDecimalParse._fail('too_many_decimals');
    }
    return MeasurementDecimalParse._ok(milli, milliToNormalizedString(milli));
  }

  final s = value.toString().trim();
  if (s.isEmpty) return const MeasurementDecimalParse._fail('empty');
  if (!RegExp(r'^-?\d+(\.\d+)?$').hasMatch(s)) {
    return const MeasurementDecimalParse._fail('invalid_format');
  }
  final frac = RegExp(r'^-?\d+\.(\d+)$').firstMatch(s);
  if (frac != null && frac.group(1)!.length > 3) {
    return const MeasurementDecimalParse._fail('too_many_decimals');
  }
  final n = num.tryParse(s);
  if (n == null || !n.isFinite) {
    return const MeasurementDecimalParse._fail('not_finite');
  }
  final milli = (n * kMeasurementScale).round();
  return MeasurementDecimalParse._ok(milli, milliToNormalizedString(milli));
}

String coerceMeasurementDecimalString(Object? value, [String fallback = '1']) {
  final parsed = parseMeasurementDecimalStrict(value);
  if (parsed.ok) return parsed.normalized;
  if (value != null) {
    final again = parseMeasurementDecimalStrict(value.toString());
    if (again.ok) return again.normalized;
  }
  return fallback;
}

String milliToNormalizedString(int milli) {
  final neg = milli < 0;
  final abs = milli.abs();
  final whole = abs ~/ kMeasurementScale;
  final frac = abs % kMeasurementScale;
  if (frac == 0) return '${neg ? '-' : ''}$whole';
  final fracStr = frac.toString().padLeft(3, '0').replaceAll(RegExp(r'0+$'), '');
  return '${neg ? '-' : ''}$whole.$fracStr';
}

bool isIntegerMilli(int milli) => milli % kMeasurementScale == 0;

int baseMilliToDisplayMilli(
  int baseMilli,
  String baseUnitCode,
  String displayUnitCode,
) {
  if (baseUnitCode == 'kg' && displayUnitCode == 'g') {
    return baseMilli * 1000;
  }
  if (baseUnitCode == 'l' && displayUnitCode == 'ml') {
    return baseMilli * 1000;
  }
  return baseMilli;
}

/// Add two normalized decimal strings via milli arithmetic.
String addQuantityDecimals(String a, String b) {
  final pa = parseMeasurementDecimalStrict(a);
  final pb = parseMeasurementDecimalStrict(b);
  if (!pa.ok || !pb.ok) return a;
  return milliToNormalizedString(pa.milli + pb.milli);
}

/// Subtract [step] from [value]; returns null if result would be < minimum.
String? subtractQuantityDecimal(String value, String step, String minimum) {
  final pv = parseMeasurementDecimalStrict(value);
  final ps = parseMeasurementDecimalStrict(step);
  final pm = parseMeasurementDecimalStrict(minimum);
  if (!pv.ok || !ps.ok || !pm.ok) return null;
  final next = pv.milli - ps.milli;
  if (next < pm.milli) return null;
  return milliToNormalizedString(next);
}
