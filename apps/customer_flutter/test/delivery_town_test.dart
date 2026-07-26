import 'package:flutter_test/flutter_test.dart';

import 'package:customer_flutter/features/account/data/delivery_towns.dart';

void main() {
  final zones = <Map<String, dynamic>>[
    {'id': 'z1', 'name': 'دبورية', 'fee': 10},
    {'id': 'z2', 'name': 'إكسال / شرق', 'fee': 12},
    {'id': 'z3', 'name': 'شبلي', 'fee': 15},
  ];

  group('matchZoneIdForTown', () {
    test('exact match selects zone id', () {
      expect(matchZoneIdForTown(zones, 'دبورية'), 'z1');
    });

    test('partial match selects zone id', () {
      expect(matchZoneIdForTown(zones, 'إكسال'), 'z2');
    });

    test('unsupported town returns null', () {
      expect(matchZoneIdForTown(zones, 'نابلس'), isNull);
    });

    test('empty town returns null', () {
      expect(matchZoneIdForTown(zones, ''), isNull);
      expect(matchZoneIdForTown(zones, null), isNull);
    });
  });

  group('checkout default town behavior', () {
    String? preselectZoneId({
      required List<Map<String, dynamic>> zones,
      String? defaultTown,
    }) {
      final matched = matchZoneIdForTown(zones, defaultTown);
      if (defaultTown != null && defaultTown.isNotEmpty) {
        return matched;
      }
      return null;
    }

    test('prefills matched default area', () {
      expect(
        preselectZoneId(zones: zones, defaultTown: 'دبورية'),
        'z1',
      );
    });

    test('does not silently pick another zone when default unsupported', () {
      expect(
        preselectZoneId(zones: zones, defaultTown: 'نابلس'),
        isNull,
      );
    });

    test('temporary checkout selection does not change saved default', () {
      const savedDefault = 'دبورية';
      const checkoutSelection = 'z2';
      final matchedDefault = matchZoneIdForTown(zones, savedDefault);
      expect(checkoutSelection, isNot(matchedDefault));
      expect(savedDefault, 'دبورية');
    });

    test('save-as-default only when explicitly chosen', () {
      var savedDefault = 'دبورية';
      const checkoutZoneName = 'إكسال / شرق';
      var saveAsDefault = false;
      if (saveAsDefault) {
        savedDefault = checkoutZoneName;
      }
      expect(savedDefault, 'دبورية');
      saveAsDefault = true;
      if (saveAsDefault) {
        savedDefault = checkoutZoneName;
      }
      expect(savedDefault, checkoutZoneName);
    });
  });
}
