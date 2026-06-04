import 'package:customer_flutter/core/app_update/app_update_gate.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('mustForceAndroidUpdate', () {
    test('blocks when current is below minimum', () {
      expect(
        mustForceAndroidUpdate(currentVersionCode: 28, minimumVersionCode: 29),
        isTrue,
      );
    });

    test('allows when current meets minimum', () {
      expect(
        mustForceAndroidUpdate(currentVersionCode: 29, minimumVersionCode: 29),
        isFalse,
      );
      expect(
        mustForceAndroidUpdate(currentVersionCode: 30, minimumVersionCode: 29),
        isFalse,
      );
    });
  });

  group('parseAndroidMinimumVersionCode', () {
    test('reads minimumVersionCode from android block', () {
      expect(
        parseAndroidMinimumVersionCode({
          'android': {'minimumVersionCode': 29, 'latestVersionCode': 30},
        }),
        29,
      );
    });

    test('returns null when payload missing', () {
      expect(parseAndroidMinimumVersionCode(null), isNull);
      expect(parseAndroidMinimumVersionCode({}), isNull);
    });
  });

  group('parseForceUpdateMessageAr', () {
    test('uses server Arabic message when present', () {
      expect(
        parseForceUpdateMessageAr({
          'android': {
            'forceUpdateMessageAr': 'يرجى تحديث التطبيق للاستمرار',
          },
        }),
        'يرجى تحديث التطبيق للاستمرار',
      );
    });

    test('falls back to default when missing', () {
      expect(parseForceUpdateMessageAr({}), kDefaultForceUpdateMessageAr);
    });
  });
}
