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

  group('mustForceIosUpdate', () {
    test('blocks when current build is below minimum', () {
      expect(
        mustForceIosUpdate(currentBuildNumber: 23, minimumBuildNumber: 24),
        isTrue,
      );
    });

    test('allows when current build meets minimum', () {
      expect(
        mustForceIosUpdate(currentBuildNumber: 24, minimumBuildNumber: 24),
        isFalse,
      );
      expect(
        mustForceIosUpdate(currentBuildNumber: 30, minimumBuildNumber: 24),
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

  group('parseIosMinimumBuildNumber', () {
    test('reads minimumBuildNumber from ios block', () {
      expect(
        parseIosMinimumBuildNumber({
          'ios': {'minimumBuildNumber': 24, 'latestBuildNumber': 30},
        }),
        24,
      );
    });
  });

  group('parseIosAppStoreId', () {
    test('returns trimmed id when present', () {
      expect(
        parseIosAppStoreId({'ios': {'appStoreId': ' 1234567890 '}}),
        '1234567890',
      );
    });

    test('returns null when missing or blank', () {
      expect(parseIosAppStoreId({'ios': {}}), isNull);
      expect(parseIosAppStoreId({'ios': {'appStoreId': ''}}), isNull);
      expect(parseIosAppStoreId({'ios': {'appStoreId': '   '}}), isNull);
    });
  });

  group('parseForceUpdateMessageAr', () {
    test('uses server Arabic message for android', () {
      expect(
        parseForceUpdateMessageAr(
          {
            'android': {
              'forceUpdateMessageAr': 'يرجى تحديث التطبيق للاستمرار',
            },
          },
          platformKey: 'android',
        ),
        'يرجى تحديث التطبيق للاستمرار',
      );
    });

    test('uses server Arabic message for ios', () {
      expect(
        parseForceUpdateMessageAr(
          {
            'ios': {
              'forceUpdateMessageAr': 'حدّث التطبيق',
            },
          },
          platformKey: 'ios',
        ),
        'حدّث التطبيق',
      );
    });

    test('falls back to default when missing', () {
      expect(
        parseForceUpdateMessageAr({}, platformKey: 'android'),
        kDefaultForceUpdateMessageAr,
      );
    });
  });
}
